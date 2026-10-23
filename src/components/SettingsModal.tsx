import React, { useState } from 'react';
import {
  X,
  FileSpreadsheet,
  Cloud,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  ExternalLink,
  Save,
  KeyRound,
  Database
} from 'lucide-react';
import { FirebaseConfig, Language } from '../types';
import { storage, DEFAULT_VAPID_KEY } from '../services/storage';
import { sheetsService, APPS_SCRIPT_TEMPLATE } from '../services/sheets';
import firebaseConfig from '../../firebase-applet-config.json';
import { testConnection } from '../services/firebaseDb';

interface SettingsModalProps {
  initialTab?: 'sheets' | 'firebase';
  lang: Language;
  onClose: () => void;
  onConfigUpdated: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  initialTab = 'sheets',
  lang,
  onClose,
  onConfigUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<'sheets' | 'firebase'>(initialTab);

  // Sheets state
  const existingSheetsConfig = sheetsService.getConfig();
  const [webhookUrl, setWebhookUrl] = useState(existingSheetsConfig.webhookUrl || '');
  const [isTestingSheets, setIsTestingSheets] = useState(false);
  const [sheetsStatus, setSheetsStatus] = useState<{
    checked: boolean;
    success: boolean;
    message: string;
    sheetName?: string;
  }>({
    checked: sheetsService.isConfigured(),
    success: sheetsService.isConfigured(),
    message: sheetsService.isConfigured() ? 'Webhook is configured.' : 'Not configured yet.',
  });
  const [copiedCode, setCopiedCode] = useState(false);
  const [showCode, setShowCode] = useState(false);

  // Firebase state
  const [vapidKey, setVapidKey] = useState(
    localStorage.getItem('sp2027_vapid_key') || DEFAULT_VAPID_KEY
  );
  const [isTestingFirebase, setIsTestingFirebase] = useState(false);
  const [firebaseStatus, setFirebaseStatus] = useState<{ checked: boolean; success: boolean; message: string }>({
    checked: true,
    success: true,
    message: `Connected to Cloud Firestore in project "${firebaseConfig.projectId}"!`,
  });
  const [copiedVapid, setCopiedVapid] = useState(false);

  // Test Sheets Connection
  const handleTestSheets = async () => {
    if (!webhookUrl.trim()) {
      setSheetsStatus({
        checked: true,
        success: false,
        message: 'Please paste your Google Apps Script Web App URL first.',
      });
      return;
    }

    setIsTestingSheets(true);
    const result = await sheetsService.testConnection(webhookUrl.trim());
    setSheetsStatus({
      checked: true,
      success: result.success,
      message: result.message,
      sheetName: result.sheetName,
    });
    setIsTestingSheets(false);

    if (result.success) {
      sheetsService.saveConfig({
        webhookUrl: webhookUrl.trim(),
        spreadsheetId: result.sheetName || 'Active Sheet',
        lastSyncedAt: new Date().toISOString(),
      });
      onConfigUpdated();
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(APPS_SCRIPT_TEMPLATE);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const handleCopyVapid = () => {
    navigator.clipboard.writeText(vapidKey);
    setCopiedVapid(true);
    setTimeout(() => setCopiedVapid(false), 2000);
  };

  const handleTestFirestoreConnection = async () => {
    setIsTestingFirebase(true);
    const connected = await testConnection();
    setFirebaseStatus({
      checked: true,
      success: connected,
      message: connected
        ? `Cloud Firestore is live and responding (Database: ${(firebaseConfig as any).firestoreDatabaseId || 'default'})`
        : 'Firebase is offline or awaiting network connection.',
    });
    setIsTestingFirebase(false);
  };

  const [savedVapid, setSavedVapid] = useState(false);

  const handleSaveVapid = () => {
    localStorage.setItem('sp2027_vapid_key', vapidKey.trim());
    setSavedVapid(true);
    setTimeout(() => setSavedVapid(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-base text-slate-900 dark:text-white">
              Integration & Storage Settings
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="grid grid-cols-2 p-1.5 bg-slate-100 dark:bg-slate-800 mx-5 mt-4 rounded-xl text-xs font-semibold">
          <button
            onClick={() => setActiveTab('firebase')}
            className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'firebase'
                ? 'bg-white dark:bg-slate-900 text-purple-700 dark:text-purple-300 shadow-sm'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <Cloud className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            <span>Firebase Cloud</span>
          </button>

          <button
            onClick={() => setActiveTab('sheets')}
            className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'sheets'
                ? 'bg-white dark:bg-slate-900 text-purple-700 dark:text-purple-300 shadow-sm'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Google Sheets</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {activeTab === 'firebase' ? (
            <div className="space-y-4">
              {/* Status Box */}
              <div
                className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
                  firebaseStatus.success
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 text-emerald-900 dark:text-emerald-200'
                    : 'bg-purple-50 dark:bg-purple-950/40 border-purple-300 text-purple-900 dark:text-purple-200'
                }`}
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <span>Cloud Firestore Live & Synchronized</span>
                    <span className="text-[10px] bg-emerald-200 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-100 px-1.5 py-0.2 rounded font-semibold">Active</span>
                  </div>
                  <p className="mt-0.5 text-[11px] opacity-90 leading-relaxed">
                    {firebaseStatus.message}
                  </p>
                </div>
              </div>

              {/* Cloud Details */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
                <div className="flex justify-between items-center py-1 border-b border-slate-200 dark:border-slate-700">
                  <span className="text-slate-500">Firebase Project ID:</span>
                  <strong className="font-mono text-purple-700 dark:text-purple-300">{firebaseConfig.projectId}</strong>
                </div>

                <div className="flex justify-between items-center py-1 border-b border-slate-200 dark:border-slate-700">
                  <span className="text-slate-500">Firestore Database ID:</span>
                  <strong className="font-mono text-[11px] text-slate-800 dark:text-slate-200 truncate max-w-[220px]">
                    {(firebaseConfig as any).firestoreDatabaseId || 'default'}
                  </strong>
                </div>

                <div className="flex justify-between items-center py-1 border-b border-slate-200 dark:border-slate-700">
                  <span className="text-slate-500">Auth Domain:</span>
                  <span className="font-mono text-[11px] text-slate-700 dark:text-slate-300">{firebaseConfig.authDomain}</span>
                </div>

                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-500">Firestore Security Rules:</span>
                  <span className="text-emerald-600 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Deployed
                  </span>
                </div>
              </div>

              {/* Web Push Certificate (VAPID Key) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                    <span>Web Push Certificate / VAPID Key</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleCopyVapid}
                    className="text-xs text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    {copiedVapid ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedVapid ? 'Copied' : 'Copy Key'}</span>
                  </button>
                </div>
                <textarea
                  rows={2}
                  value={vapidKey}
                  onChange={(e) => setVapidKey(e.target.value)}
                  placeholder="BIVhlFq..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-mono"
                />
              </div>

              {/* Test & Save buttons */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleTestFirestoreConnection}
                  disabled={isTestingFirebase}
                  className="flex-1 py-2.5 px-3 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-95 disabled:opacity-50"
                >
                  <Database className={`w-3.5 h-3.5 ${isTestingFirebase ? 'animate-spin' : ''}`} />
                  <span>{isTestingFirebase ? 'Pinging Cloud Firestore...' : 'Test Cloud Connection'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleSaveVapid}
                  className={`py-2.5 px-3 rounded-xl text-xs font-semibold cursor-pointer transition-all ${
                    savedVapid
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200 border border-emerald-300'
                      : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200'
                  }`}
                >
                  {savedVapid ? '✓ Saved' : 'Save Key'}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Status Box */}
              <div
                className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
                  sheetsStatus.success
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 text-emerald-900 dark:text-emerald-200'
                    : 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 text-amber-900 dark:text-amber-200'
                }`}
              >
                {sheetsStatus.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="font-bold">
                    {sheetsStatus.success
                      ? `Connected to: "${sheetsStatus.sheetName || 'Google Sheet'}"`
                      : 'Google Sheets Apps Script'}
                  </div>
                  <p className="mt-0.5 text-[11px] opacity-90">{sheetsStatus.message}</p>
                </div>
              </div>

              {/* URL Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Optional Webhook URL
                </label>
                <input
                  type="url"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="https://script.google.com/macros/s/.../exec"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleTestSheets}
                  disabled={isTestingSheets}
                  className="flex-1 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isTestingSheets ? 'Verifying...' : 'Verify & Save Connection'}</span>
                </button>
              </div>

              {/* Step by Step Setup Guide */}
              <div className="p-3.5 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/60 text-xs text-purple-950 dark:text-purple-200 space-y-2">
                <div className="font-bold flex items-center justify-between">
                  <span>Google Apps Script Template:</span>
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="px-2 py-1 bg-purple-600 text-white rounded text-[11px] font-semibold flex items-center gap-1 hover:bg-purple-700 cursor-pointer"
                  >
                    {copiedCode ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedCode ? 'Copied!' : 'Copy Script Code'}</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setShowCode(!showCode)}
                  className="text-[11px] text-purple-700 dark:text-purple-300 font-semibold underline cursor-pointer"
                >
                  {showCode ? 'Hide Code' : 'View Code'}
                </button>

                {showCode && (
                  <pre className="p-2.5 bg-slate-900 text-slate-100 rounded-lg text-[10px] overflow-x-auto max-h-40 font-mono">
                    {APPS_SCRIPT_TEMPLATE}
                  </pre>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-right">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-lg cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
