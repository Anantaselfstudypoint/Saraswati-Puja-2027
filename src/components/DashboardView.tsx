import React, { useState, useEffect } from 'react';
import {
  Wallet,
  ArrowUpRight,
  TrendingDown,
  Users,
  Banknote,
  Smartphone,
  Calendar,
  PlusCircle,
  ReceiptIndianRupee,
  Share2,
  Receipt,
  FileSpreadsheet,
  Sparkles,
  ChevronRight,
  ExternalLink
} from 'lucide-react';
import { CollectionRecord, Language, TabType } from '../types';
import { getTranslation } from '../utils/i18n';
import { formatIndianCurrency } from '../utils/numberToWords';
import { onTokenChange, hasActiveToken } from '../services/googleAuth';
import { USER_SPREADSHEET_URL } from '../services/googleSheets';
import { sheetsService } from '../services/sheets';

interface DashboardViewProps {
  stats: {
    totalCollection: number;
    totalExpenses: number;
    remainingBalance: number;
    cashCollection: number;
    onlineCollection: number;
    todayCollection: number;
    totalDonors: number;
    avgDonation: number;
  };
  recentCollections: CollectionRecord[];
  lang: Language;
  onNavigate: (tab: TabType) => void;
  onOpenReceipt: (record: CollectionRecord) => void;
  onQuickWhatsApp: (record: CollectionRecord) => void;
  onLoadSampleData: () => void;
  onOpenSheetsModal?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  stats,
  recentCollections,
  lang,
  onNavigate,
  onOpenReceipt,
  onQuickWhatsApp,
  onLoadSampleData,
  onOpenSheetsModal,
}) => {
  const isSurplus = stats.remainingBalance >= 0;
  const [isSheetsConnected, setIsSheetsConnected] = useState(
    hasActiveToken() || sheetsService.isConfigured()
  );

  useEffect(() => {
    const unsub = onTokenChange((t) =>
      setIsSheetsConnected(Boolean(t) || sheetsService.isConfigured())
    );
    return () => unsub();
  }, []);

  return (
    <div className="space-y-4 pb-20 pt-2">
      {/* Hero Remaining Balance Card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-900 via-indigo-900 to-purple-800 text-white p-5 sm:p-6 shadow-xl border border-purple-700/50">
        {/* Decorative background glows */}
        <div className="absolute top-0 right-0 -mr-8 -mt-8 w-44 h-44 rounded-full bg-amber-400/10 blur-2xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-8 -mb-8 w-44 h-44 rounded-full bg-purple-500/15 blur-2xl pointer-events-none" />

        <div className="relative z-10">
          <div className="flex items-center justify-between text-purple-200 mb-1">
            <span className="text-xs sm:text-sm font-medium tracking-wide uppercase flex items-center gap-1.5">
              <Wallet className="w-4 h-4 text-amber-300" />
              {getTranslation('remainingBalance', lang)}
            </span>
            <span
              className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                isSurplus
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30'
                  : 'bg-rose-500/20 text-rose-300 border-rose-400/30'
              }`}
            >
              {isSurplus ? '● Surplus' : '● Deficit'}
            </span>
          </div>

          <div className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white my-2 font-sans flex items-baseline gap-1">
            <span className="text-2xl sm:text-3xl text-amber-300">₹</span>
            <span>{formatIndianCurrency(stats.remainingBalance)}</span>
          </div>

          <div className="pt-3 border-t border-purple-700/60 flex flex-wrap items-center justify-between gap-2 text-xs text-purple-200">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-amber-300" />
              <span>{getTranslation('todayCollection', lang)}:</span>
              <strong className="text-amber-300 font-bold text-sm">
                ₹{formatIndianCurrency(stats.todayCollection)}
              </strong>
            </div>
            <div className="flex items-center gap-1 text-[11px] bg-purple-950/50 px-2.5 py-1 rounded-lg border border-purple-700/50">
              <span>{getTranslation('avgDonation', lang)}:</span>
              <strong className="text-white">₹{formatIndianCurrency(stats.avgDonation)}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Primary Financial Stats Grid */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {/* Total Collection */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-xs font-semibold">{getTranslation('totalCollection', lang)}</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            ₹{formatIndianCurrency(stats.totalCollection)}
          </div>
          <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 flex items-center gap-1">
            <span>{stats.totalDonors} {getTranslation('totalDonors', lang).toLowerCase()}</span>
          </div>
        </div>

        {/* Total Expenses */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-xs font-semibold">{getTranslation('totalExpenses', lang)}</span>
            <div className="w-7 h-7 rounded-lg bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-rose-600 dark:text-rose-400">
            ₹{formatIndianCurrency(stats.totalExpenses)}
          </div>
          <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
            <span>All puja expenses</span>
          </div>
        </div>

        {/* Cash Collection */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-xs font-semibold">{getTranslation('cashCollection', lang)}</span>
            <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Banknote className="w-4 h-4" />
            </div>
          </div>
          <div className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
            ₹{formatIndianCurrency(stats.cashCollection)}
          </div>
          <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
            Physical cash on hand
          </div>
        </div>

        {/* Online / UPI Collection */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-xs font-semibold">{getTranslation('onlineCollection', lang)}</span>
            <div className="w-7 h-7 rounded-lg bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Smartphone className="w-4 h-4" />
            </div>
          </div>
          <div className="text-lg sm:text-xl font-bold text-purple-600 dark:text-purple-400">
            ₹{formatIndianCurrency(stats.onlineCollection)}
          </div>
          <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
            UPI / Bank transfers
          </div>
        </div>
      </div>

      {/* Google Sheets Sync Card */}
      <div className="bg-gradient-to-r from-emerald-900/10 via-purple-900/10 to-teal-900/10 dark:from-emerald-950/40 dark:via-purple-950/40 dark:to-teal-950/40 p-4 rounded-2xl border border-emerald-300/60 dark:border-emerald-800/60 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                {lang === 'hi' ? 'गूगल शीट लाइव बैकअप एवं सिंक' : 'Google Sheets Live Sync'}
              </h3>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                  isSheetsConnected
                    ? 'bg-emerald-100 dark:bg-emerald-900/80 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700'
                    : 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200 border border-amber-300'
                }`}
              >
                {isSheetsConnected
                  ? (sheetsService.isConfigured()
                    ? (lang === 'hi' ? '● स्थाई कनेक्टेड' : '● Auto-Sync Ready')
                    : (lang === 'hi' ? '● कनेक्टेड' : '● Connected'))
                  : (lang === 'hi' ? '● कनेक्ट करें' : '● Connect')}
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
              {lang === 'hi'
                ? 'सभी दानदाता व खर्च सीधे Google Sheets के "Donations" और "Expenses" टैब में सुरक्षित होते हैं।'
                : 'All donations & expenses safely sync to "Donations" & "Expenses" tabs.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          {onOpenSheetsModal && (
            <button
              type="button"
              onClick={onOpenSheetsModal}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>
                {isSheetsConnected
                  ? (lang === 'hi' ? 'शीट में सिंक करें' : 'Sync to Sheet')
                  : (lang === 'hi' ? 'शीट सिंक सेटअप' : 'Setup Sheets Sync')}
              </span>
            </button>
          )}

          <a
            href={USER_SPREADSHEET_URL}
            target="_blank"
            rel="noreferrer"
            className="p-2 bg-white dark:bg-slate-800 hover:bg-slate-100 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-300 transition-colors shadow-2xs"
            title="Open Google Sheet in new tab"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>

      {/* Quick Action Center */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
          {getTranslation('quickActions', lang)}
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <button
            onClick={() => onNavigate('add')}
            className="flex flex-col items-center justify-center p-3 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-900/60 hover:bg-purple-100 dark:hover:bg-purple-900/60 transition-all cursor-pointer active:scale-95"
          >
            <PlusCircle className="w-6 h-6 mb-1 text-purple-600 dark:text-purple-400" />
            <span className="text-xs font-bold">{getTranslation('addNewDonation', lang)}</span>
          </button>

          <button
            onClick={() => onNavigate('expenses')}
            className="flex flex-col items-center justify-center p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60 hover:bg-rose-100 dark:hover:bg-rose-900/60 transition-all cursor-pointer active:scale-95"
          >
            <ReceiptIndianRupee className="w-6 h-6 mb-1 text-rose-600 dark:text-rose-400" />
            <span className="text-xs font-bold">{getTranslation('recordExpense', lang)}</span>
          </button>

          <button
            onClick={() => onNavigate('whatsapp')}
            className="flex flex-col items-center justify-center p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-all cursor-pointer active:scale-95"
          >
            <Share2 className="w-6 h-6 mb-1 text-emerald-600 dark:text-emerald-400" />
            <span className="text-xs font-bold">{getTranslation('sendWhatsAppReceipt', lang)}</span>
          </button>

          <button
            onClick={() => onNavigate('records')}
            className="flex flex-col items-center justify-center p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-all cursor-pointer active:scale-95"
          >
            <Users className="w-6 h-6 mb-1 text-indigo-600 dark:text-indigo-400" />
            <span className="text-xs font-bold">{getTranslation('viewAllRecords', lang)}</span>
          </button>
        </div>
      </div>

      {/* Recent Collections Feed */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">
              {getTranslation('recentActivity', lang)}
            </h3>
            <span className="text-xs bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-full font-semibold">
              {recentCollections.length}
            </span>
          </div>

          {recentCollections.length > 0 && (
            <button
              onClick={() => onNavigate('records')}
              className="text-xs font-semibold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-0.5 cursor-pointer"
            >
              <span>{getTranslation('viewAllRecords', lang)}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {recentCollections.length === 0 ? (
          <div className="p-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-950/80 text-purple-600 dark:text-purple-400 flex items-center justify-center mx-auto">
              <Users className="w-6 h-6" />
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              {getTranslation('noActivityYet', lang)}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              <button
                onClick={() => onNavigate('add')}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-lg shadow-sm cursor-pointer transition-all active:scale-95"
              >
                ➕ {getTranslation('addNewDonation', lang)}
              </button>
              <button
                onClick={onLoadSampleData}
                className="px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 cursor-pointer transition-all"
              >
                🧪 {getTranslation('loadSampleData', lang)}
              </button>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {recentCollections.slice(0, 5).map((record) => (
              <div
                key={record.id}
                className="p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors flex items-center justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-slate-900 dark:text-white truncate">
                      {record.name}
                    </span>
                    <span className="text-[10px] bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 px-1.5 py-0.5 rounded font-mono font-bold">
                      {record.receiptNumber}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-2 flex-wrap">
                    <span>{record.date}</span>
                    <span>•</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300">{record.paymentMethod}</span>
                    {record.uniqueId && record.uniqueId !== 'N/A' && (
                      <>
                        <span>•</span>
                        <span className="truncate max-w-[120px]">{record.uniqueId}</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <div className="font-bold text-sm text-emerald-600 dark:text-emerald-400 font-sans">
                      ₹{formatIndianCurrency(record.amount)}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onOpenReceipt(record)}
                      className="p-1.5 rounded-lg text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/60 transition-colors cursor-pointer"
                      title={getTranslation('printReceipt', lang)}
                    >
                      <Receipt className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onQuickWhatsApp(record)}
                      className="p-1.5 rounded-lg text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 transition-colors cursor-pointer"
                      title={getTranslation('shareWhatsApp', lang)}
                    >
                      <Share2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
