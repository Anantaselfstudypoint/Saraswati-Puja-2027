import React, { useState, useMemo } from 'react';
import {
  FileText,
  Calendar,
  CreditCard,
  PieChart,
  Download,
  Upload,
  RefreshCw,
  Trash2,
  FileSpreadsheet,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  ClipboardPaste,
  X,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { CollectionRecord, ExpenseRecord, Language } from '../types';
import { getTranslation } from '../utils/i18n';
import { formatIndianCurrency } from '../utils/numberToWords';
import { storage } from '../services/storage';
import { USER_SPREADSHEET_ID, USER_SPREADSHEET_URL } from '../services/googleSheets';
import { auth } from '../services/googleAuth';

interface ReportsViewProps {
  collections: CollectionRecord[];
  expenses: ExpenseRecord[];
  lang: Language;
  onRefreshData: () => void;
  onOpenSheetsModal: () => void;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  collections,
  expenses,
  lang,
  onRefreshData,
  onOpenSheetsModal,
}) => {
  const isGoogleConnected = Boolean(auth.currentUser);

  // Status and modal states
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pastedJson, setPastedJson] = useState('');
  const [copiedBackup, setCopiedBackup] = useState(false);

  // Daily Summary
  const dailyBreakdown = useMemo(() => {
    const map: Record<string, { count: number; total: number; cash: number; online: number }> = {};
    collections.forEach((c) => {
      const date = c.date || 'Unknown';
      if (!map[date]) {
        map[date] = { count: 0, total: 0, cash: 0, online: 0 };
      }
      map[date].count += 1;
      map[date].total += Number(c.amount || 0);
      if (c.paymentMethod === 'Cash') map[date].cash += Number(c.amount || 0);
      else map[date].online += Number(c.amount || 0);
    });

    return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0]));
  }, [collections]);

  // Monthly Summary
  const monthlyBreakdown = useMemo(() => {
    const map: Record<string, { count: number; total: number }> = {};
    collections.forEach((c) => {
      const month = (c.date || '').slice(0, 7) || 'Unknown';
      if (!map[month]) {
        map[month] = { count: 0, total: 0 };
      }
      map[month].count += 1;
      map[month].total += Number(c.amount || 0);
    });

    return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0]));
  }, [collections]);

  // Payment Breakdown
  const paymentStats = useMemo(() => {
    let cash = 0;
    let upi = 0;
    let online = 0;
    collections.forEach((c) => {
      if (c.paymentMethod === 'Cash') cash += Number(c.amount || 0);
      else if (c.paymentMethod === 'UPI') upi += Number(c.amount || 0);
      else online += Number(c.amount || 0);
    });
    const grand = cash + upi + online;
    return {
      cash,
      upi,
      online,
      grand,
      cashPct: grand ? Math.round((cash / grand) * 100) : 0,
      upiPct: grand ? Math.round((upi / grand) * 100) : 0,
      onlinePct: grand ? Math.round((online / grand) * 100) : 0,
    };
  }, [collections]);

  const handleDownloadBackup = () => {
    const success = storage.downloadDatabaseBackup();
    if (success) {
      setNotification({
        type: 'success',
        message: lang === 'hi'
          ? 'बैकअप (.JSON) फाइल डाउनलोड हो गई है!'
          : 'Backup (.JSON) file downloaded successfully!',
      });
    } else {
      setNotification({
        type: 'info',
        message: lang === 'hi'
          ? 'डाउनलोड आरंभ हुआ। आप नीचे से JSON टेक्स्ट भी कॉपी कर सकते हैं।'
          : 'Download started. You can also copy the backup JSON directly below.',
      });
    }
  };

  const handleCopyBackup = () => {
    try {
      const jsonStr = storage.getBackupJsonString();
      navigator.clipboard.writeText(jsonStr);
      setCopiedBackup(true);
      setTimeout(() => setCopiedBackup(false), 2500);
      setNotification({
        type: 'success',
        message: lang === 'hi'
          ? 'पूरा डेटाबेस JSON क्लिपबोर्ड में कॉपी हो गया!'
          : 'Full database JSON copied to clipboard!',
      });
    } catch {
      setNotification({
        type: 'error',
        message: 'Could not copy to clipboard directly.',
      });
    }
  };

  const handleRestoreFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsRestoring(true);
    setNotification(null);
    try {
      const res = await storage.restoreDatabaseBackup(file);
      if (res.success) {
        setNotification({ type: 'success', message: res.message });
        onRefreshData();
      } else {
        setNotification({ type: 'error', message: res.message });
      }
    } catch (err: any) {
      setNotification({ type: 'error', message: `Restore error: ${err?.message || 'Invalid file format'}` });
    } finally {
      setIsRestoring(false);
      e.target.value = '';
    }
  };

  const handleRestorePastedJson = async () => {
    if (!pastedJson.trim()) return;
    setIsRestoring(true);
    setNotification(null);
    try {
      const res = await storage.restoreDatabaseBackup(pastedJson.trim());
      if (res.success) {
        setNotification({ type: 'success', message: res.message });
        setShowPasteModal(false);
        setPastedJson('');
        onRefreshData();
      } else {
        setNotification({ type: 'error', message: res.message });
      }
    } catch (err: any) {
      setNotification({ type: 'error', message: `Restore error: ${err?.message || 'Invalid JSON syntax'}` });
    } finally {
      setIsRestoring(false);
    }
  };

  const handleConfirmReset = async () => {
    setIsResetting(true);
    try {
      const res = await storage.resetAllToZero();
      onRefreshData();
      setShowResetModal(false);
      setNotification({
        type: 'info',
        message: lang === 'hi'
          ? 'सभी रिकॉर्ड्स (चंदा और खर्च) शून्य (0) कर दिए गए हैं।'
          : res.message,
      });
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: `Reset failed: ${err?.message || 'Unknown error'}`,
      });
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="space-y-4 pb-20 pt-2">
      {/* Official Google Sheets Live Sync Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 sm:p-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white flex items-center gap-2">
                <span>{getTranslation('sheetsTitle', lang)}</span>
                {isGoogleConnected ? (
                  <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full flex items-center gap-1 border border-emerald-200">
                    <ShieldCheck className="w-3 h-3" /> Ready
                  </span>
                ) : (
                  <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-200">
                    Sign-in Required
                  </span>
                )}
              </h3>
              <span className="text-[11px] text-slate-500 font-mono">
                Spreadsheet ID: {USER_SPREADSHEET_ID}
              </span>
            </div>
          </div>

          <a
            href={USER_SPREADSHEET_URL}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-purple-600 dark:text-purple-400 hover:underline font-semibold flex items-center gap-1"
          >
            <span>Open Sheet</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        <p className="text-xs text-slate-600 dark:text-slate-400 mb-3 leading-relaxed">
          Sync your donations and expenses into separate "Donations" and "Expenses" tabs in your linked Google Sheet. Deduplication automatically skips records that were already synchronized.
        </p>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={onOpenSheetsModal}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all cursor-pointer active:scale-95"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{isGoogleConnected ? 'Sync to Google Sheet' : 'Connect & Sync Sheet'}</span>
          </button>

          <button
            onClick={() => storage.exportCollectionsCSV()}
            className="px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Donations CSV</span>
          </button>

          <button
            onClick={() => storage.exportExpensesCSV()}
            className="px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Expenses CSV</span>
          </button>
        </div>
      </div>

      {/* Payment Method Distribution */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 sm:p-5">
        <h3 className="font-bold text-sm text-slate-900 dark:text-white mb-3 flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          {getTranslation('paymentBreakdown', lang)}
        </h3>

        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-center">
            <span className="text-[11px] font-semibold text-amber-800 dark:text-amber-300 block">Cash</span>
            <div className="text-sm sm:text-base font-bold text-amber-900 dark:text-amber-100 font-sans mt-0.5">
              ₹{formatIndianCurrency(paymentStats.cash)}
            </div>
            <span className="text-[10px] text-amber-700 dark:text-amber-400 font-medium">
              {paymentStats.cashPct}%
            </span>
          </div>

          <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900/60 text-center">
            <span className="text-[11px] font-semibold text-purple-800 dark:text-purple-300 block">UPI</span>
            <div className="text-sm sm:text-base font-bold text-purple-900 dark:text-purple-100 font-sans mt-0.5">
              ₹{formatIndianCurrency(paymentStats.upi)}
            </div>
            <span className="text-[10px] text-purple-700 dark:text-purple-400 font-medium">
              {paymentStats.upiPct}%
            </span>
          </div>

          <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 text-center">
            <span className="text-[11px] font-semibold text-blue-800 dark:text-blue-300 block">Online</span>
            <div className="text-sm sm:text-base font-bold text-blue-900 dark:text-blue-100 font-sans mt-0.5">
              ₹{formatIndianCurrency(paymentStats.online)}
            </div>
            <span className="text-[10px] text-blue-700 dark:text-blue-400 font-medium">
              {paymentStats.onlinePct}%
            </span>
          </div>
        </div>

        {/* Visual Progress Bar */}
        {paymentStats.grand > 0 && (
          <div className="w-full h-2.5 rounded-full overflow-hidden flex bg-slate-100 dark:bg-slate-800">
            <div style={{ width: `${paymentStats.cashPct}%` }} className="bg-amber-500 h-full" title={`Cash: ${paymentStats.cashPct}%`} />
            <div style={{ width: `${paymentStats.upiPct}%` }} className="bg-purple-600 h-full" title={`UPI: ${paymentStats.upiPct}%`} />
            <div style={{ width: `${paymentStats.onlinePct}%` }} className="bg-blue-500 h-full" title={`Online: ${paymentStats.onlinePct}%`} />
          </div>
        )}
      </div>

      {/* Daily Breakdown Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 sm:p-5">
        <h3 className="font-bold text-sm text-slate-900 dark:text-white mb-3 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          {getTranslation('dailySummary', lang)}
        </h3>

        {dailyBreakdown.length === 0 ? (
          <div className="text-center py-6 text-xs text-slate-400">No daily records yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400">
                  <th className="pb-2 font-semibold">Date</th>
                  <th className="pb-2 font-semibold text-center">Donors</th>
                  <th className="pb-2 font-semibold text-right">Cash</th>
                  <th className="pb-2 font-semibold text-right">UPI/Online</th>
                  <th className="pb-2 font-semibold text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {dailyBreakdown.map(([date, data]) => (
                  <tr key={date} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-2.5 font-medium text-slate-900 dark:text-white">{date}</td>
                    <td className="py-2.5 text-center text-slate-500">{data.count}</td>
                    <td className="py-2.5 text-right text-amber-600 dark:text-amber-400 font-mono">
                      ₹{formatIndianCurrency(data.cash)}
                    </td>
                    <td className="py-2.5 text-right text-purple-600 dark:text-purple-400 font-mono">
                      ₹{formatIndianCurrency(data.online)}
                    </td>
                    <td className="py-2.5 text-right font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                      ₹{formatIndianCurrency(data.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Monthly Summary */}
      {monthlyBreakdown.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 sm:p-5">
          <h3 className="font-bold text-sm text-slate-900 dark:text-white mb-3 flex items-center gap-2">
            <PieChart className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            {getTranslation('monthlySummary', lang)}
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400">
                  <th className="pb-2 font-semibold">Month</th>
                  <th className="pb-2 font-semibold text-center">Total Donors</th>
                  <th className="pb-2 font-semibold text-right">Total Collection</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {monthlyBreakdown.map(([month, data]) => (
                  <tr key={month} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-2.5 font-medium text-slate-900 dark:text-white">{month}</td>
                    <td className="py-2.5 text-center text-slate-500">{data.count}</td>
                    <td className="py-2.5 text-right font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                      ₹{formatIndianCurrency(data.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Database Backup & Restore */}
      {/* Database Backup & Restore */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div>
            <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <span>{getTranslation('backupTitle', lang)}</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {getTranslation('backupDescription', lang)}
            </p>
          </div>

          <div className="text-[11px] font-mono text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/50 border border-purple-200 dark:border-purple-800 px-2 py-0.5 rounded-full shrink-0">
            {collections.length} Donations | {expenses.length} Expenses
          </div>
        </div>

        {/* Action Feedback Banner */}
        {notification && (
          <div
            className={`p-3 my-3 rounded-xl border text-xs flex items-center justify-between gap-2 animate-fadeIn ${
              notification.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 text-emerald-900 dark:text-emerald-200'
                : notification.type === 'error'
                ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 text-rose-900 dark:text-rose-200'
                : 'bg-purple-50 dark:bg-purple-950/40 border-purple-300 text-purple-900 dark:text-purple-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {notification.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : notification.type === 'error' ? (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-purple-600 shrink-0" />
              )}
              <span className="font-medium">{notification.message}</span>
            </div>
            <button
              onClick={() => setNotification(null)}
              className="text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Buttons Grid */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {/* Download JSON Button */}
          <button
            type="button"
            onClick={handleDownloadBackup}
            className="px-3.5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-95"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{getTranslation('downloadBackup', lang)}</span>
          </button>

          {/* Copy JSON Button */}
          <button
            type="button"
            onClick={handleCopyBackup}
            className="px-3 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer"
            title="Copy full JSON database to clipboard"
          >
            {copiedBackup ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedBackup ? (lang === 'hi' ? 'कॉपी हो गया!' : 'Copied!') : (lang === 'hi' ? 'JSON कॉपी करें' : 'Copy JSON')}</span>
          </button>

          {/* Restore from File */}
          <label className={`px-3.5 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer border border-slate-200 dark:border-slate-700 transition-all ${isRestoring ? 'opacity-50 pointer-events-none' : ''}`}>
            {isRestoring ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-600" />
            ) : (
              <Upload className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
            )}
            <span>{isRestoring ? (lang === 'hi' ? 'रीस्टोर हो रहा है...' : 'Restoring...') : getTranslation('restoreBackup', lang)}</span>
            <input
              type="file"
              accept=".json,application/json"
              onChange={handleRestoreFile}
              disabled={isRestoring}
              className="hidden"
            />
          </label>

          {/* Paste JSON Option */}
          <button
            type="button"
            onClick={() => setShowPasteModal(true)}
            className="px-3 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer"
          >
            <ClipboardPaste className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
            <span>{lang === 'hi' ? 'JSON पेस्ट करें' : 'Paste JSON'}</span>
          </button>

          {/* Reset All Data to Zero */}
          <button
            type="button"
            onClick={() => setShowResetModal(true)}
            className="sm:ml-auto px-3.5 py-2.5 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl text-xs font-bold flex items-center gap-1.5 border border-rose-200 dark:border-rose-900/50 transition-all cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{getTranslation('clearAllData', lang)}</span>
          </button>
        </div>
      </div>

      {/* Confirmation Modal: Reset All Data to Zero */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full shadow-2xl border border-rose-200 dark:border-rose-900 overflow-hidden flex flex-col p-5">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400 mb-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/70 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  {lang === 'hi' ? 'सभी डेटा शून्य (0) करें?' : 'Reset All Data to Zero?'}
                </h3>
                <p className="text-xs text-rose-600 dark:text-rose-400 font-semibold">
                  {lang === 'hi' ? 'स्थाई रूप से सभी रिकॉर्ड डिलीट हो जाएंगे' : 'Permanent Deletion Warning'}
                </p>
              </div>
            </div>

            <div className="p-3 bg-rose-50 dark:bg-rose-950/30 rounded-xl border border-rose-200 dark:border-rose-900/40 text-xs text-slate-700 dark:text-slate-300 space-y-2 mb-4">
              <p>
                {lang === 'hi'
                  ? `यह क्रिया आपके सभी ${collections.length} चंदे और ${expenses.length} खर्चों को लोकल डिवाइस एवं क्लाउड फायरस्टोर से हमेशा के लिए हटा देगी। कुल बैलेंस ₹0 हो जाएगा।`
                  : `This action will permanently delete all ${collections.length} donation records and ${expenses.length} expense records from both Local Storage and Cloud Firestore. Remaining balance will become ₹0.`}
              </p>
              <p className="font-semibold text-rose-700 dark:text-rose-300">
                {lang === 'hi'
                  ? 'हटाने से पहले आप अपनी सुरक्षित कॉपी के लिए बैकअप डाउनलोड कर सकते हैं।'
                  : 'You can download a backup before resetting so you never lose your records.'}
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={handleDownloadBackup}
                className="w-full py-2.5 px-3 bg-purple-50 dark:bg-purple-950/50 hover:bg-purple-100 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{lang === 'hi' ? 'पहले बैकअप (.JSON) सुरक्षित करें' : 'Download Backup (.JSON) First'}</span>
              </button>

              <div className="flex gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => setShowResetModal(false)}
                  disabled={isResetting}
                  className="flex-1 py-2.5 px-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold cursor-pointer disabled:opacity-50"
                >
                  {lang === 'hi' ? 'रद्द करें' : 'Cancel'}
                </button>

                <button
                  type="button"
                  onClick={handleConfirmReset}
                  disabled={isResetting}
                  className="flex-1 py-2.5 px-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-md cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  {isResetting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>{lang === 'hi' ? 'रीसेट हो रहा है...' : 'Resetting...'}</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{lang === 'hi' ? 'हाँ, शून्य (0) करें' : 'Yes, Reset to 0'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Paste JSON Modal */}
      {showPasteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col p-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-3">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <ClipboardPaste className="w-4 h-4 text-purple-600" />
                <span>{lang === 'hi' ? 'JSON बैकअप टेक्स्ट पेस्ट करें' : 'Paste JSON Backup Content'}</span>
              </h3>
              <button
                onClick={() => setShowPasteModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
              {lang === 'hi'
                ? 'अपने पहले डाउनलोड किए गए बैकअप JSON का पूरा कोड यहाँ पेस्ट करें और "रीस्टोर करें" पर क्लिक करें।'
                : 'Paste the contents of your downloaded backup JSON file here and click Restore.'}
            </p>

            <textarea
              rows={8}
              value={pastedJson}
              onChange={(e) => setPastedJson(e.target.value)}
              placeholder='{ "collections": [ ... ], "expenses": [ ... ] }'
              className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-mono focus:outline-none focus:ring-2 focus:ring-purple-500 mb-4"
            />

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowPasteModal(false)}
                className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
              >
                {lang === 'hi' ? 'रद्द करें' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleRestorePastedJson}
                disabled={!pastedJson.trim() || isRestoring}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer"
              >
                {isRestoring ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                <span>{lang === 'hi' ? 'डेटाबेस में रीस्टोर करें' : 'Restore into Database'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

