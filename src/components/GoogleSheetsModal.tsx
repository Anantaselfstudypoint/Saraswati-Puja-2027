import React, { useState, useEffect } from 'react';
import {
  X,
  FileSpreadsheet,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  LogOut,
  ShieldCheck,
  Database,
  ArrowRight,
  Info,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Zap,
  Globe,
  Sliders,
  Download,
  ArrowDownToLine,
  UploadCloud,
  CheckCheck
} from 'lucide-react';
import { User } from 'firebase/auth';
import { CollectionRecord, ExpenseRecord, Language } from '../types';
import { getTranslation } from '../utils/i18n';
import { formatIndianCurrency } from '../utils/numberToWords';
import { googleSignIn, logout, getAccessToken, hasActiveToken, onTokenChange, auth } from '../services/googleAuth';
import {
  googleSheetsApi,
  USER_SPREADSHEET_ID,
  USER_SPREADSHEET_URL,
  SyncResult
} from '../services/googleSheets';
import { sheetsService, APPS_SCRIPT_TEMPLATE } from '../services/sheets';
import { storage } from '../services/storage';

interface GoogleSheetsModalProps {
  collections: CollectionRecord[];
  expenses: ExpenseRecord[];
  lang: Language;
  onClose: () => void;
  onSyncComplete: () => void;
}

export const GoogleSheetsModal: React.FC<GoogleSheetsModalProps> = ({
  collections,
  expenses,
  lang,
  onClose,
  onSyncComplete,
}) => {
  const [currentUser, setCurrentUser] = useState<User | null>(auth.currentUser);
  const [hasToken, setHasToken] = useState<boolean>(hasActiveToken());
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [spreadsheetTitle, setSpreadsheetTitle] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Sync mode: 'oauth' (Google Sign In) vs 'webhook' (Apps Script Web App)
  const isWebhookActive = sheetsService.isConfigured();
  const [syncMode, setSyncMode] = useState<'oauth' | 'webhook'>(
    isWebhookActive ? 'webhook' : 'oauth'
  );
  const [showVerificationGuide, setShowVerificationGuide] = useState(true);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);
  const [showScriptCode, setShowScriptCode] = useState(false);

  // Webhook sync state
  const sheetsConfig = sheetsService.getConfig();
  const [webhookUrl, setWebhookUrl] = useState(sheetsConfig.webhookUrl || '');
  const [isTestingWebhook, setIsTestingWebhook] = useState(false);
  const [isSyncingWebhook, setIsSyncingWebhook] = useState(false);
  const [webhookTestMessage, setWebhookTestMessage] = useState<string | null>(null);

  const [isPulling, setIsPulling] = useState(false);

  // Subscribe to real token changes
  useEffect(() => {
    const unsub = onTokenChange((token) => {
      setHasToken(Boolean(token));
      setCurrentUser(auth.currentUser);
    });
    return () => unsub();
  }, []);

  // Inspect sheet if token exists
  useEffect(() => {
    const checkTokenAndSheet = async () => {
      const token = await getAccessToken();
      if (token) {
        try {
          const info = await googleSheetsApi.getSpreadsheetInfo(USER_SPREADSHEET_ID, token);
          setSpreadsheetTitle(info.title);
        } catch (e: any) {
          console.warn('Could not inspect sheet:', e);
        }
      }
    };
    checkTokenAndSheet();
  }, [hasToken]);

  const handlePullFromSheets = async (forcedToken?: string) => {
    setIsPulling(true);
    setErrorMessage(null);
    try {
      const token = forcedToken || (await getAccessToken());
      if (!token) {
        setErrorMessage(
          lang === 'hi'
            ? 'शीट से डेटा लोड करने के लिए पहले गूगल अकाउंट से लॉगिन करें।'
            : 'Please sign in with Google first to load data from sheet.'
        );
        setIsPulling(false);
        return;
      }

      const res = await googleSheetsApi.pullRecordsFromSheet(USER_SPREADSHEET_ID, token);
      const importRes = await storage.importRecordsFromSheet(res.donations, res.expenses);
      onSyncComplete();

      setSpreadsheetTitle(res.sheetTitle || spreadsheetTitle);

      setInfoMessage(
        lang === 'hi'
          ? `🎉 गूगल शीट से डेटा लोड हो गया! ${importRes.addedCollections} नए चंदे और ${importRes.addedExpenses} खर्च ऐप में जोड़े गए (शीट में कुल: ${res.donations.length} चंदे, ${res.expenses.length} खर्च)।`
          : `🎉 Google Sheet loaded! ${importRes.addedCollections} new donations and ${importRes.addedExpenses} expenses imported into app (${res.donations.length} donations, ${res.expenses.length} expenses found in sheet).`
      );
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to pull records from Google Sheet.');
    } finally {
      setIsPulling(false);
    }
  };

  const handlePullFromWebhook = async (customUrl?: string) => {
    setIsPulling(true);
    setErrorMessage(null);
    try {
      const urlToUse = customUrl || webhookUrl.trim();
      const res = await sheetsService.pullDataFromWebhook(urlToUse);
      if (res.success) {
        const importRes = await storage.importRecordsFromSheet(res.donations, res.expenses);
        onSyncComplete();

        setInfoMessage(
          lang === 'hi'
            ? `🎉 वेबहुक द्वारा शीट से ${importRes.addedCollections} नए चंदे और ${importRes.addedExpenses} खर्च ऐप में लोड हो गए!`
            : `🎉 Imported ${importRes.addedCollections} donations and ${importRes.addedExpenses} expenses from Google Sheet via Webhook.`
        );
      } else {
        setErrorMessage(res.message || 'Could not fetch records from Webhook.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Webhook pull failed.');
    } finally {
      setIsPulling(false);
    }
  };

  const handleSignIn = async () => {
    setIsSigningIn(true);
    setErrorMessage(null);
    setInfoMessage(null);
    try {
      const res = await googleSignIn();
      if (res) {
        setCurrentUser(res.user);
        setHasToken(true);
        try {
          const info = await googleSheetsApi.getSpreadsheetInfo(USER_SPREADSHEET_ID, res.accessToken);
          setSpreadsheetTitle(info.title);
        } catch {
          // ignore if sheets api hasn't initialized tabs yet
        }

        // IMMEDIATELY PULL & SHOW DATA FROM GOOGLE SHEET!
        await handlePullFromSheets(res.accessToken);
      } else {
        // User closed or dismissed popup window - do not treat as an error
        setInfoMessage(
          lang === 'hi'
            ? 'साइन-इन विंडो बंद कर दी गई थी। जब भी चाहें दोबारा "Sign in with Google" पर क्लिक करें।'
            : 'Sign-in window was closed. Click the button whenever you are ready to sign in.'
        );
      }
    } catch (err: any) {
      if (err.message === 'POPUP_BLOCKED') {
        setErrorMessage(
          lang === 'hi'
            ? 'ब्राउज़र ने गूगल लॉगिन पॉपअप को रोक दिया है। कृपया अपने ब्राउज़र एड्रेस बार में पॉप-अप (Pop-ups) की अनुमति दें और पुनः प्रयास करें।'
            : 'Browser blocked the login popup. Please allow popups for this site in your browser address bar and try again.'
        );
      } else {
        setErrorMessage(err.message || 'Failed to sign in with Google');
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    await logout();
    setCurrentUser(null);
    setHasToken(false);
    setSpreadsheetTitle(null);
    setSyncResult(null);
    setInfoMessage(null);
    setErrorMessage(null);
  };

  // Trigger sync after user confirmation
  const executeSync = async () => {
    setShowConfirmDialog(false);
    setIsSyncing(true);
    setErrorMessage(null);
    setInfoMessage(null);
    setSyncResult(null);

    try {
      let token = await getAccessToken();
      if (!token) {
        // If token not active, prompt sign in first
        const res = await googleSignIn();
        if (!res) {
          // User dismissed popup without signing in
          setInfoMessage(
            lang === 'hi'
              ? 'गूगल शीट में सिंक करने के लिए पहले गूगल अकाउंट से जुड़ना आवश्यक है।'
              : 'Google sign-in is required to synchronize with the Google Sheet.'
          );
          setIsSyncing(false);
          return;
        }
        token = res.accessToken;
      }

      // Execute sync with user confirmation true
      const result = await googleSheetsApi.syncAll(
        USER_SPREADSHEET_ID,
        token,
        collections,
        expenses,
        true
      );

      setSyncResult(result);
      setSpreadsheetTitle(result.spreadsheetTitle || spreadsheetTitle);
      onSyncComplete();
    } catch (err: any) {
      if (err.message === 'POPUP_BLOCKED') {
        setErrorMessage(
          lang === 'hi'
            ? 'ब्राउज़र ने पॉपअप विंडो को रोक दिया है। कृपया एड्रेस बार में पॉपअप की अनुमति दें।'
            : 'Popup was blocked by the browser. Please allow popups in your address bar.'
        );
      } else {
        setErrorMessage(err.message || 'Sync operation failed');
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCopyEmail = () => {
    navigator.clipboard.writeText('factb6833@gmail.com');
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2500);
  };

  const handleCopyScript = () => {
    navigator.clipboard.writeText(APPS_SCRIPT_TEMPLATE);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2500);
  };

  const handleTestWebhook = async () => {
    if (!webhookUrl.trim() || !webhookUrl.startsWith('https://script.google.com/')) {
      setErrorMessage(
        lang === 'hi'
          ? 'कृपया वैध Google Apps Script Webhook URL दर्ज करें।'
          : 'Please enter a valid Google Apps Script Webhook URL.'
      );
      return;
    }
    setIsTestingWebhook(true);
    setErrorMessage(null);
    setWebhookTestMessage(null);

    try {
      const res = await sheetsService.testConnection(webhookUrl.trim());
      if (res.success) {
        setWebhookTestMessage(res.message);
        sheetsService.saveConfig({
          webhookUrl: webhookUrl.trim(),
          spreadsheetId: res.sheetName || USER_SPREADSHEET_ID,
        });

        // Automatically pull and show all data from the sheet!
        await handlePullFromWebhook(webhookUrl.trim());
      } else {
        setErrorMessage(res.message);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Connection test failed');
    } finally {
      setIsTestingWebhook(false);
    }
  };

  const handleWebhookSync = async () => {
    if (!webhookUrl.trim() || !webhookUrl.startsWith('https://script.google.com/')) {
      setErrorMessage(
        lang === 'hi'
          ? 'कृपया पहले Google Apps Script Webhook URL दर्ज करें।'
          : 'Please enter a valid Google Apps Script Webhook URL.'
      );
      return;
    }

    setShowConfirmDialog(false);
    setIsSyncingWebhook(true);
    setErrorMessage(null);
    setInfoMessage(null);
    setSyncResult(null);

    sheetsService.saveConfig({
      webhookUrl: webhookUrl.trim(),
      spreadsheetId: USER_SPREADSHEET_ID,
    });

    try {
      const res = await sheetsService.syncData(collections, expenses);
      if (res.success) {
        setSyncResult({
          success: true,
          message: res.message,
          donationsAdded: res.donationsAdded || 0,
          expensesAdded: res.expensesAdded || 0,
          spreadsheetTitle: 'Google Sheet (Puja 2027)',
          spreadsheetUrl: USER_SPREADSHEET_URL,
        });
        onSyncComplete();
      } else {
        setErrorMessage(res.message);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Webhook sync failed');
    } finally {
      setIsSyncingWebhook(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/40">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                {lang === 'hi' ? 'गूगल शीट लाइव सिंक' : 'Google Sheets Live Sync'}
              </h3>
              <span className="text-[11px] text-slate-500">Official Google Workspace Sheets API</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Method Selector Tabs */}
        <div className="grid grid-cols-2 p-1.5 bg-slate-100 dark:bg-slate-800/80 mx-5 mt-3 rounded-xl text-xs font-bold">
          <button
            type="button"
            onClick={() => setSyncMode('oauth')}
            className={`py-2 px-1 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              syncMode === 'oauth'
                ? 'bg-white dark:bg-slate-900 text-purple-700 dark:text-purple-300 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
            <span className="truncate">{lang === 'hi' ? 'विधि 1: गूगल लॉगिन' : 'Method 1: Google Login'}</span>
          </button>

          <button
            type="button"
            onClick={() => setSyncMode('webhook')}
            className={`py-2 px-1 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              syncMode === 'webhook'
                ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Globe className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="truncate">{lang === 'hi' ? 'विधि 2: स्थाई वेबहुक' : 'Method 2: Permanent Webhook'}</span>
            {isWebhookActive && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" title="Active" />
            )}
          </button>
        </div>

        {/* Reconnect notice banner explaining why OAuth expires and how Webhook avoids it */}
        <div className="mx-5 mt-2.5 p-2.5 rounded-xl bg-purple-50/80 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 text-[11px] text-slate-700 dark:text-slate-300 flex items-start gap-2">
          <Info className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
          <div className="leading-snug">
            <span className="font-bold text-purple-950 dark:text-purple-200 block">
              {lang === 'hi' ? '💡 बार-बार कनेक्ट करने से बचने का स्थाई उपाय:' : '💡 Avoid Reconnecting Every Session:'}
            </span>
            <span>
              {lang === 'hi'
                ? 'Google OAuth सुरक्षा नियमों के कारण रिफ्रेश होने पर दोबारा लॉगिन मांगता है। बार-बार कनेक्ट से बचने के लिए ऊपर "विधि 2: स्थाई वेबहुक" चुनें — यह एक बार लगाने के बाद हमेशा अपने आप सिंक करता रहता है!'
                : 'Google OAuth sessions expire when refreshing. To keep it permanently connected without logging in again, use "Method 2: Permanent Webhook".'}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* Target Spreadsheet Card */}
          <div className="p-3.5 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/60">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="text-[10px] font-bold text-purple-700 dark:text-purple-300 uppercase tracking-wider block">
                  {lang === 'hi' ? 'आपकी गूगल शीट' : 'Target Google Sheet'}
                </span>
                <div className="font-bold text-sm text-slate-900 dark:text-white mt-0.5">
                  {spreadsheetTitle || 'Saraswati Puja 2027 Spreadsheet'}
                </div>
                <div className="text-[11px] font-mono text-purple-900 dark:text-purple-300 mt-0.5 truncate max-w-xs">
                  ID: {USER_SPREADSHEET_ID}
                </div>
              </div>

              <a
                href={USER_SPREADSHEET_URL}
                target="_blank"
                rel="noreferrer"
                className="px-2.5 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 border border-purple-200 dark:border-purple-700 rounded-lg text-xs font-semibold text-purple-700 dark:text-purple-300 flex items-center gap-1 shadow-xs transition-colors shrink-0"
              >
                <span>{lang === 'hi' ? 'शीट खोलें' : 'Open Sheet'}</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            {/* Crucial Tab Information for User */}
            <div className="mt-2.5 pt-2 border-t border-purple-200/60 dark:border-purple-800/40 flex items-center gap-3 text-[11px] text-slate-600 dark:text-slate-300">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>{lang === 'hi' ? 'चंदा टैब: ' : 'Tab: '}<strong>Donations</strong></span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                <span>{lang === 'hi' ? 'खर्च टैब: ' : 'Tab: '}<strong>Expenses</strong></span>
              </span>
            </div>
          </div>

          {/* TAB 1: OAUTH GOOGLE SIGN IN */}
          {syncMode === 'oauth' && (
            <div className="space-y-3">
              {!hasToken ? (
                <div className="p-4 rounded-xl border-2 border-amber-300 dark:border-amber-700/60 bg-amber-50/70 dark:bg-amber-950/30 text-center space-y-3">
                  <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-amber-900 dark:text-amber-200">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>
                      {lang === 'hi'
                        ? 'गूगल शीट में डेटा लिखने के लिए लॉगिन करें'
                        : 'Google Sign-in Required to Write to Spreadsheet'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300 max-w-sm mx-auto leading-relaxed">
                    {lang === 'hi'
                      ? 'अपनी गूगल शीट में चंदा और खर्च सीधे सुरक्षित लिखने हेतु नीचे "Sign in with Google" दबाएं।'
                      : 'Sign in with your Google account to grant write permission to your Google Sheet.'}
                  </p>

                  {/* Official Google Sign-in Button */}
                  <div className="flex justify-center pt-1">
                    <button
                      type="button"
                      onClick={handleSignIn}
                      disabled={isSigningIn}
                      className="inline-flex items-center gap-3 px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-bold text-xs sm:text-sm shadow-md transition-all cursor-pointer disabled:opacity-60 active:scale-95"
                    >
                      <svg className="w-5 h-5 shrink-0" viewBox="0 0 48 48">
                        <path
                          fill="#EA4335"
                          d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                        />
                        <path
                          fill="#4285F4"
                          d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                        />
                        <path
                          fill="#34A853"
                          d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                        />
                      </svg>
                      <span>
                        {isSigningIn
                          ? (lang === 'hi' ? 'गूगल से कनेक्ट हो रहा है...' : 'Connecting with Google...')
                          : (lang === 'hi' ? 'गूगल अकाउंट से कनेक्ट करें (Sign in with Google)' : 'Sign in with Google')}
                      </span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 rounded-xl border border-emerald-300 dark:border-emerald-800/60 bg-emerald-50/70 dark:bg-emerald-950/30 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center">
                      {currentUser?.displayName ? currentUser.displayName[0].toUpperCase() : 'G'}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <span>{currentUser?.displayName || 'Authorized User'}</span>
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      </div>
                      <div className="text-[11px] text-slate-600 dark:text-slate-400">
                        {currentUser?.email || 'Sheets Session Active'}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="text-xs text-rose-600 hover:text-rose-700 flex items-center gap-1 font-semibold cursor-pointer"
                    title="Sign Out"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>{lang === 'hi' ? 'हटाएं' : 'Disconnect'}</span>
                  </button>
                </div>
              )}

              {/* Explicit Helper Card for "Access blocked: ... has not completed the Google verification process" */}
              <div className="p-3.5 rounded-xl bg-amber-50/90 dark:bg-amber-950/40 border border-amber-300/80 dark:border-amber-700/80 text-xs space-y-2.5">
                <div
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => setShowVerificationGuide(!showVerificationGuide)}
                >
                  <div className="flex items-center gap-1.5 font-bold text-amber-900 dark:text-amber-200">
                    <HelpCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>
                      {lang === 'hi'
                        ? "⚠️ 'Access blocked / verification process' का समाधान"
                        : "⚠️ Fix 'Access blocked: verification process not completed'"}
                    </span>
                  </div>
                  <button type="button" className="text-amber-700 dark:text-amber-300">
                    {showVerificationGuide ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>

                {showVerificationGuide && (
                  <div className="space-y-2 text-slate-700 dark:text-slate-300 pt-1 border-t border-amber-200/80 dark:border-amber-800/60 leading-relaxed text-[11px]">
                    <p>
                      <strong>{lang === 'hi' ? 'यह क्यों दिखता है?' : 'Why does this happen?'}</strong>{' '}
                      {lang === 'hi'
                        ? 'Google Cloud प्रोजेक्ट (gen-lang-client-0268336284) टेस्टिंग मोड में है। Google केवल उन्हीं खातों को अनुमति देता है जो "Test users" सूची में जोड़े गए हैं।'
                        : 'Your Google Cloud Project (gen-lang-client-0268336284) is in Testing mode. Google restricts access to emails added under "Test users".'}
                    </p>

                    <div className="bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-amber-200 dark:border-amber-800 space-y-1.5 font-sans">
                      <div className="font-bold text-slate-900 dark:text-white flex items-center justify-between">
                        <span>{lang === 'hi' ? '30 सेकंड का आसान उपाय:' : 'Easy 30-Second Fix:'}</span>
                        <a
                          href="https://console.cloud.google.com/apis/credentials/consent?project=gen-lang-client-0268336284"
                          target="_blank"
                          rel="noreferrer"
                          className="text-purple-600 dark:text-purple-400 underline font-semibold flex items-center gap-1 hover:text-purple-700"
                        >
                          <span>{lang === 'hi' ? 'Google Cloud खोलें' : 'Open Google Cloud Console'}</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                      <ol className="list-decimal pl-4 space-y-1 text-slate-600 dark:text-slate-400">
                        <li>
                          {lang === 'hi'
                            ? 'ऊपर दिए गए लिंक से Google Cloud OAuth Consent Screen खोलें।'
                            : 'Open OAuth Consent Screen via the link above.'}
                        </li>
                        <li>
                          {lang === 'hi'
                            ? 'नीचे "Audience / Test users" (परीक्षण उपयोगकर्ता) में "+ ADD USERS" पर क्लिक करें।'
                            : 'Under "Test users", click "+ ADD USERS".'}
                        </li>
                        <li className="flex items-center gap-1.5 flex-wrap">
                          <span>{lang === 'hi' ? 'अपना ईमेल जोड़ें:' : 'Add your email:'}</span>
                          <span className="font-mono bg-purple-100 dark:bg-purple-950 px-1.5 py-0.5 rounded text-purple-900 dark:text-purple-200 font-bold">
                            factb6833@gmail.com
                          </span>
                          <button
                            type="button"
                            onClick={handleCopyEmail}
                            className="px-1.5 py-0.5 bg-purple-600 text-white rounded text-[10px] font-semibold flex items-center gap-1 hover:bg-purple-700 cursor-pointer"
                          >
                            {copiedEmail ? <Check className="w-2.5 h-2.5" /> : <Copy className="w-2.5 h-2.5" />}
                            <span>{copiedEmail ? 'Copied' : 'Copy'}</span>
                          </button>
                        </li>
                        <li>
                          {lang === 'hi'
                            ? 'Save करें और वापस आकर "Sign in with Google" दबाएं। स्क्रीन पर "Advanced" (उन्नत) पर क्लिक करें -> "Go to gen-lang-client-0268336284 (unsafe)" -> Allow।'
                            : 'Click Save, return here, click "Sign in with Google", then click "Advanced" -> "Go to gen-lang-client-0268336284 (unsafe)" -> Continue.'}
                        </li>
                      </ol>
                    </div>

                    <div className="flex items-center justify-between text-[11px] pt-1 text-purple-700 dark:text-purple-300">
                      <span>{lang === 'hi' ? 'बिना Google Cloud के तुरंत सिंक करना चाहते हैं?' : 'Prefer not to configure Google Cloud?'}</span>
                      <button
                        type="button"
                        onClick={() => setSyncMode('webhook')}
                        className="font-bold underline hover:text-purple-900 dark:hover:text-purple-200 cursor-pointer flex items-center gap-1"
                      >
                        <span>{lang === 'hi' ? 'विधि 2 (वेबहुक) चुनें' : 'Use Method 2 (Webhook)'}</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: WEBHOOK APPS SCRIPT (ZERO OAUTH / NO VERIFICATION NEEDED) */}
          {syncMode === 'webhook' && (
            <div className="space-y-3.5">
              <div className="p-3.5 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800/60 text-xs space-y-2">
                <div className="font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>
                    {lang === 'hi'
                      ? 'वेबहुक सिंक: कोई गूगल वेरिफिकेशन या टेस्ट यूजर की जरूरत नहीं'
                      : 'Webhook Sync: No Google Verification or Test User Required'}
                  </span>
                </div>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11px]">
                  {lang === 'hi'
                    ? 'अपनी Google Sheet में Apps Script Webhook बनाकर आप बिना किसी लॉगिन रुकावट के सीधे डेटा भेज सकते हैं।'
                    : 'Using a Google Apps Script Web App allows instant sync directly to your spreadsheet with zero OAuth restrictions.'}
                </p>
              </div>

              {/* Webhook URL Input */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  {lang === 'hi' ? 'गूगल ऐप्स स्क्रिप्ट वेबहुक URL' : 'Apps Script Web App URL'}
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    placeholder="https://script.google.com/macros/s/.../exec"
                    className="flex-1 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={handleTestWebhook}
                    disabled={isTestingWebhook}
                    className="px-3 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-800 dark:text-slate-100 text-xs font-semibold rounded-xl cursor-pointer disabled:opacity-50 shrink-0"
                  >
                    {isTestingWebhook ? (lang === 'hi' ? 'जाँच...' : 'Testing...') : (lang === 'hi' ? 'जाँचें' : 'Test')}
                  </button>
                </div>
              </div>

              {/* Webhook Test Success Message */}
              {webhookTestMessage && (
                <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 text-xs text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>{webhookTestMessage}</span>
                </div>
              )}

              {/* Setup Guide for Apps Script */}
              <div className="p-3.5 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/60 text-xs text-purple-950 dark:text-purple-200 space-y-2">
                <div className="font-bold flex items-center justify-between">
                  <span>{lang === 'hi' ? '1 मिनट में स्क्रिप्ट कैसे लगाएं:' : 'How to set up Apps Script (1 min):'}</span>
                  <button
                    type="button"
                    onClick={handleCopyScript}
                    className="px-2 py-1 bg-purple-600 text-white rounded text-[11px] font-semibold flex items-center gap-1 hover:bg-purple-700 cursor-pointer shadow-2xs"
                  >
                    {copiedScript ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedScript ? 'Copied Code' : 'Copy Script'}</span>
                  </button>
                </div>

                <ol className="list-decimal pl-4 space-y-1 text-[11px] text-slate-700 dark:text-slate-300">
                  <li>
                    {lang === 'hi' ? 'अपनी Google Sheet खोलें -> ' : 'Open your Google Sheet -> '}
                    <strong>Extensions</strong> {'->'} <strong>Apps Script</strong>.
                  </li>
                  <li>
                    {lang === 'hi'
                      ? 'वहाँ पुराना कोड हटाकर ऊपर से कॉपी किया गया स्क्रिप्ट कोड पेस्ट करें।'
                      : 'Replace existing code in Code.gs with the copied script.'}
                  </li>
                  <li>
                    <strong>Deploy</strong> {'->'} <strong>New deployment</strong> {'->'} Select <strong>Web app</strong>.
                  </li>
                  <li>
                    Set <strong>Who has access</strong> to <strong>Anyone</strong>, Deploy करें और Web App URL कॉपी करके यहाँ पेस्ट करें!
                  </li>
                </ol>

                <button
                  type="button"
                  onClick={() => setShowScriptCode(!showScriptCode)}
                  className="text-[11px] text-purple-700 dark:text-purple-300 font-semibold underline cursor-pointer mt-1"
                >
                  {showScriptCode ? (lang === 'hi' ? 'कोड छुपाएं' : 'Hide Script') : (lang === 'hi' ? 'स्क्रिप्ट कोड देखें' : 'View Script Code')}
                </button>

                {showScriptCode && (
                  <pre className="p-2.5 bg-slate-900 text-slate-100 rounded-lg text-[10px] overflow-x-auto max-h-40 font-mono">
                    {APPS_SCRIPT_TEMPLATE}
                  </pre>
                )}
              </div>
            </div>
          )}

          {/* Pending Data Overview */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
              <span className="text-slate-500 block">{lang === 'hi' ? 'ऐप में कुल चंदा' : 'Donations in App'}</span>
              <strong className="text-base text-purple-700 dark:text-purple-300 font-bold block mt-0.5">
                {collections.length} records
              </strong>
              <span className="text-[10px] text-slate-400">
                ₹{formatIndianCurrency(collections.reduce((sum, c) => sum + Number(c.amount || 0), 0))} कुल
              </span>
            </div>

            <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
              <span className="text-slate-500 block">{lang === 'hi' ? 'ऐप में कुल खर्च' : 'Expenses in App'}</span>
              <strong className="text-base text-rose-600 dark:text-rose-400 font-bold block mt-0.5">
                {expenses.length} records
              </strong>
              <span className="text-[10px] text-slate-400">
                ₹{formatIndianCurrency(expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0))} कुल
              </span>
            </div>
          </div>

          {/* Soft Info Notice */}
          {infoMessage && (
            <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-xs text-blue-900 dark:text-blue-200 flex items-start justify-between gap-2">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <span>{infoMessage}</span>
              </div>
              <button
                type="button"
                onClick={() => setInfoMessage(null)}
                className="text-blue-400 hover:text-blue-600 cursor-pointer p-0.5"
                title="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 text-xs text-rose-800 dark:text-rose-200 flex items-start justify-between gap-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
              <button
                type="button"
                onClick={() => setErrorMessage(null)}
                className="text-rose-400 hover:text-rose-600 cursor-pointer p-0.5"
                title="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Success Banner */}
          {syncResult && (
            <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 text-xs text-emerald-900 dark:text-emerald-200 space-y-2">
              <div className="flex items-center gap-1.5 font-bold text-emerald-800 dark:text-emerald-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{lang === 'hi' ? 'सफलतापूर्वक सिंक हो गया!' : 'Sync Complete!'}</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                {lang === 'hi'
                  ? `आपकी गूगल शीट में ${syncResult.donationsAdded} नए चंदे और ${syncResult.expensesAdded} नए खर्च जोड़ दिए गए हैं। पुराने रिकॉर्ड्स बिना डुप्लीकेट के सुरक्षित रहे।`
                  : `Added ${syncResult.donationsAdded} new donations and ${syncResult.expensesAdded} new expenses to the Google Sheet without duplicates.`}
              </p>
              <div className="p-2 bg-emerald-100/60 dark:bg-emerald-900/40 rounded-lg text-[11px] flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                <span>
                  {lang === 'hi'
                    ? 'शीट खोलकर नीचे "Donations" और "Expenses" टैब देखें।'
                    : 'Open the sheet and check "Donations" & "Expenses" tabs at the bottom.'}
                </span>
              </div>
              <a
                href={syncResult.spreadsheetUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold shadow-xs hover:bg-emerald-700 transition-all mt-1"
              >
                <span>{lang === 'hi' ? 'अपनी Google Sheet खोलकर देखें' : 'View updated Google Sheet'}</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}

          {/* User Confirmation Dialog before mutating Workspace data */}
          {showConfirmDialog && (
            <div className="p-4 rounded-xl border-2 border-purple-500 bg-purple-50/70 dark:bg-purple-950/50 text-xs text-slate-900 dark:text-slate-100 space-y-2.5 animate-fadeIn">
              <div className="font-bold text-sm text-purple-950 dark:text-purple-200 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>{lang === 'hi' ? 'गूगल शीट में सिंक की पुष्टि करें' : 'Confirm Google Sheets Synchronization'}</span>
              </div>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed text-xs">
                {lang === 'hi'
                  ? `यह क्रिया आपकी Google Sheet (${USER_SPREADSHEET_ID}) के "Donations" और "Expenses" टैब में नए ${collections.length} चंदे और ${expenses.length} खर्च जोड़ेगी। पुराने रिकॉर्ड सुरक्षित रहेंगे।`
                  : `This will append any newly recorded donations (${collections.length}) and expenses (${expenses.length}) into the "Donations" and "Expenses" tabs. Existing records will be preserved.`}
              </p>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    if (syncMode === 'oauth') {
                      executeSync();
                    } else {
                      handleWebhookSync();
                    }
                  }}
                  className="flex-1 py-2 px-3 bg-purple-700 hover:bg-purple-800 text-white font-bold rounded-lg text-xs cursor-pointer shadow-sm active:scale-95"
                >
                  {lang === 'hi' ? 'हाँ, शीट में सिंक करें' : 'Yes, Sync to Google Sheets'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowConfirmDialog(false)}
                  className="py-2 px-3 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded-lg text-xs cursor-pointer"
                >
                  {lang === 'hi' ? 'रद्द करें' : 'Cancel'}
                </button>
              </div>
            </div>
          )}

          {/* Action Buttons: PULL DATA FROM SHEET & PUSH DATA TO SHEET */}
          {!showConfirmDialog && (
            <div className="space-y-2 pt-1">
              {/* BUTTON 1: PULL / LOAD SHEET DATA INTO APP */}
              <button
                type="button"
                disabled={isPulling || isSyncing || isSyncingWebhook}
                onClick={() => {
                  if (syncMode === 'oauth') {
                    if (!hasToken) {
                      handleSignIn();
                    } else {
                      handlePullFromSheets();
                    }
                  } else {
                    if (!webhookUrl.trim()) {
                      setErrorMessage(
                        lang === 'hi'
                          ? 'कृपया पहले Google Apps Script Webhook URL दर्ज करें।'
                          : 'Please enter your Apps Script Webhook URL first.'
                      );
                    } else {
                      handlePullFromWebhook();
                    }
                  }
                }}
                className="w-full py-3 px-4 bg-gradient-to-r from-purple-700 via-indigo-700 to-purple-800 hover:from-purple-800 hover:to-indigo-900 text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98 disabled:opacity-50"
              >
                <ArrowDownToLine className={`w-4 h-4 ${isPulling ? 'animate-bounce' : ''}`} />
                <span>
                  {isPulling
                    ? (lang === 'hi' ? 'गूगल शीट से डेटा लोड हो रहा है...' : 'Loading Data from Google Sheet...')
                    : (lang === 'hi'
                      ? '⬇️ गूगल शीट का सारा डेटा ऐप में लाएं (Pull & Show Sheet Data)'
                      : '⬇️ Load & Show All Sheet Records in App')}
                </span>
              </button>

              {/* BUTTON 2: PUSH / SYNC APP DATA TO SHEET */}
              <button
                type="button"
                disabled={isSyncing || isSyncingWebhook || isPulling}
                onClick={() => {
                  if (syncMode === 'oauth') {
                    if (!hasToken) {
                      handleSignIn();
                    } else {
                      setShowConfirmDialog(true);
                    }
                  } else {
                    if (!webhookUrl.trim()) {
                      setErrorMessage(
                        lang === 'hi'
                          ? 'कृपया पहले Google Apps Script Webhook URL दर्ज करें।'
                          : 'Please enter your Apps Script Webhook URL first.'
                      );
                    } else {
                      setShowConfirmDialog(true);
                    }
                  }
                }}
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing || isSyncingWebhook ? 'animate-spin' : ''}`} />
                <span>
                  {isSyncing || isSyncingWebhook
                    ? (lang === 'hi' ? 'गूगल शीट में डेटा सिंक हो रहा है...' : 'Synchronizing with Google Sheets...')
                    : (lang === 'hi'
                      ? '⬆️ ऐप के नए रिकॉर्ड गूगल शीट में भेजें (Sync to Sheet)'
                      : '⬆️ Sync App Records to Google Sheet')}
                </span>
              </button>
            </div>
          )}

          {/* Helpful Bottom Tip */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 space-y-1">
            <div className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
              <Info className="w-3 h-3 text-purple-600" />
              <span>{lang === 'hi' ? 'डेटा कहाँ दिखेगा?' : 'Where does the data appear?'}</span>
            </div>
            <p className="leading-relaxed">
              {lang === 'hi'
                ? 'गूगल शीट में नीचे दो अलग टैब बनते हैं: 1) "Donations" (सभी चंदा रसीदें) और 2) "Expenses" (सभी खर्च)।'
                : 'Google Sheets keeps donations in the "Donations" tab and expenses in the "Expenses" tab.'}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-right">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-lg cursor-pointer"
          >
            {getTranslation('close', lang)}
          </button>
        </div>
      </div>
    </div>
  );
};
