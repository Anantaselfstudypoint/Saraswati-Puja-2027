/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { CollectionRecord, ExpenseRecord, Language, Theme, TabType } from './types';
import { storage } from './services/storage';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { DashboardView } from './components/DashboardView';
import { AddCollectionView } from './components/AddCollectionView';
import { MemberRecordsView } from './components/MemberRecordsView';
import { ExpenseView } from './components/ExpenseView';
import { WhatsAppView } from './components/WhatsAppView';
import { ReportsView } from './components/ReportsView';
import { ReceiptModal } from './components/ReceiptModal';
import { SettingsModal } from './components/SettingsModal';
import { GoogleSheetsModal } from './components/GoogleSheetsModal';
import { initAuth, getAccessToken, onTokenChange } from './services/googleAuth';
import { googleSheetsApi, USER_SPREADSHEET_ID } from './services/googleSheets';
import { sheetsService } from './services/sheets';
import { CheckCircle2, AlertTriangle, Info } from 'lucide-react';

export default function App() {
  const [lang, setLang] = useState<Language>(() => {
    return (localStorage.getItem('sp2027_lang') as Language) || 'hi';
  });

  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem('sp2027_theme') as Theme) || 'light';
  });

  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [collections, setCollections] = useState<CollectionRecord[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);

  // Modals & Navigation state
  const [editingCollection, setEditingCollection] = useState<CollectionRecord | null>(null);
  const [selectedReceipt, setSelectedReceipt] = useState<CollectionRecord | null>(null);
  const [whatsAppRecipient, setWhatsAppRecipient] = useState<CollectionRecord | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'sheets' | 'firebase'>('sheets');
  const [sheetsModalOpen, setSheetsModalOpen] = useState(false);

  // Toast notifications
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'warn' | 'error' } | null>(null);

  // Sync theme to <html>
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('sp2027_theme', theme);
  }, [theme]);

  // Auth listener initialization
  useEffect(() => {
    const unsubscribe = initAuth();
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  // Auto-sync data from Google Sheet if connected so all sheet data is immediately visible in app
  useEffect(() => {
    const syncFromGoogleSheet = async (overrideToken?: string) => {
      try {
        const token = overrideToken || (await getAccessToken());
        if (token) {
          const res = await googleSheetsApi.pullRecordsFromSheet(USER_SPREADSHEET_ID, token);
          if (res.donations.length > 0 || res.expenses.length > 0) {
            const importRes = await storage.importRecordsFromSheet(res.donations, res.expenses);
            if (importRes.addedCollections > 0 || importRes.addedExpenses > 0) {
              refreshData();
              showToast(
                lang === 'hi'
                  ? `Google Sheet से ${importRes.addedCollections} चंदे और ${importRes.addedExpenses} खर्च ऐप में लोड हुए!`
                  : `Imported ${importRes.addedCollections} donations and ${importRes.addedExpenses} expenses from Google Sheet!`,
                'success'
              );
            }
          }
        } else if (sheetsService.isConfigured()) {
          const res = await sheetsService.pullDataFromWebhook();
          if (res.success && (res.donations.length > 0 || res.expenses.length > 0)) {
            const importRes = await storage.importRecordsFromSheet(res.donations, res.expenses);
            if (importRes.addedCollections > 0 || importRes.addedExpenses > 0) {
              refreshData();
              showToast(
                lang === 'hi'
                  ? `Google Sheet से ${importRes.addedCollections} चंदे और ${importRes.addedExpenses} खर्च ऐप में लोड हुए!`
                  : `Imported ${importRes.addedCollections} donations and ${importRes.addedExpenses} expenses from Google Sheet!`,
                'success'
              );
            }
          }
        }
      } catch (err) {
        console.warn('Auto-sync from sheet error:', err);
      }
    };

    const unsubToken = onTokenChange((token) => {
      if (token) {
        syncFromGoogleSheet(token);
      }
    });

    syncFromGoogleSheet();

    return () => unsubToken();
  }, [lang]);

  // Sync language
  const handleLanguageChange = (newLang: Language) => {
    setLang(newLang);
    localStorage.setItem('sp2027_lang', newLang);
  };

  // Theme toggle
  const handleThemeToggle = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  // Load records from storage and listen to live Cloud Firestore updates
  const refreshData = () => {
    setCollections(storage.getCollections());
    setExpenses(storage.getExpenses());
  };

  useEffect(() => {
    refreshData();
    const unsubscribeRealtime = storage.subscribeToRealtimeUpdates(
      (updatedCollections) => setCollections(updatedCollections),
      (updatedExpenses) => setExpenses(updatedExpenses)
    );
    return () => {
      if (typeof unsubscribeRealtime === 'function') unsubscribeRealtime();
    };
  }, []);

  const showToast = (message: string, type: 'success' | 'warn' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 3500);
  };

  // Save donation success
  const handleDonationSaved = (record: CollectionRecord, isEdit: boolean) => {
    refreshData();
    setEditingCollection(null);
    showToast(
      isEdit ? `Donation for ${record.name} updated successfully!` : `Saved! Receipt No: ${record.receiptNumber}`,
      'success'
    );
    if (!isEdit) {
      setSelectedReceipt(record);
    }
  };

  // Delete donation
  const handleDeleteDonation = async (id: string) => {
    await storage.deleteCollection(id);
    refreshData();
    showToast('Donation record deleted.', 'warn');
  };

  // Edit donation
  const handleEditDonation = (record: CollectionRecord) => {
    setEditingCollection(record);
    setActiveTab('add');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Quick WhatsApp from record
  const handleQuickWhatsApp = (record: CollectionRecord) => {
    setWhatsAppRecipient(record);
    setActiveTab('whatsapp');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Open settings modal
  const handleOpenSettings = (initialTab: 'sheets' | 'firebase' = 'sheets') => {
    setSettingsTab(initialTab);
    setSettingsOpen(true);
  };

  // Load sample data
  const handleLoadSampleData = () => {
    storage.loadSamplePujaData();
    refreshData();
    showToast('Loaded sample puja donation and expense data for testing.', 'success');
  };

  // Calculated stats
  const stats = storage.getStats();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200">
      {/* Toast Notification Container */}
      {toast && (
        <div className="fixed top-14 left-4 right-4 sm:left-auto sm:right-6 z-50 flex justify-center no-print animate-fadeIn">
          <div
            className={`px-4 py-2.5 rounded-xl shadow-lg border text-xs sm:text-sm font-semibold flex items-center gap-2 max-w-md ${
              toast.type === 'success'
                ? 'bg-emerald-950 text-emerald-100 border-emerald-700 shadow-emerald-950/20'
                : toast.type === 'warn'
                ? 'bg-amber-950 text-amber-100 border-amber-700 shadow-amber-950/20'
                : 'bg-rose-950 text-rose-100 border-rose-700 shadow-rose-950/20'
            }`}
          >
            {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
            {toast.type === 'warn' && <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />}
            {toast.type === 'error' && <Info className="w-4 h-4 text-rose-400 shrink-0" />}
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* Top Header */}
      <Header
        lang={lang}
        onLanguageChange={handleLanguageChange}
        theme={theme}
        onThemeToggle={handleThemeToggle}
        onOpenSettings={handleOpenSettings}
        onOpenSheetsModal={() => setSheetsModalOpen(true)}
      />

      {/* Main Body Content Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-3 sm:px-4">
        {activeTab === 'dashboard' && (
          <DashboardView
            stats={stats}
            recentCollections={collections}
            lang={lang}
            onNavigate={(tab) => {
              setActiveTab(tab);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onOpenReceipt={(rec) => setSelectedReceipt(rec)}
            onQuickWhatsApp={handleQuickWhatsApp}
            onLoadSampleData={handleLoadSampleData}
            onOpenSheetsModal={() => setSheetsModalOpen(true)}
          />
        )}

        {activeTab === 'add' && (
          <AddCollectionView
            editRecord={editingCollection}
            lang={lang}
            onSaveSuccess={handleDonationSaved}
            onCancelEdit={() => {
              setEditingCollection(null);
              setActiveTab('records');
            }}
            onOpenSheetsModal={() => setSheetsModalOpen(true)}
          />
        )}

        {activeTab === 'records' && (
          <MemberRecordsView
            collections={collections}
            lang={lang}
            onEdit={handleEditDonation}
            onDelete={handleDeleteDonation}
            onOpenReceipt={(rec) => setSelectedReceipt(rec)}
            onQuickWhatsApp={handleQuickWhatsApp}
            onExportCSV={() => storage.exportCollectionsCSV()}
            onBulkWhatsApp={() => {
              setWhatsAppRecipient(null);
              setActiveTab('whatsapp');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        )}

        {activeTab === 'expenses' && (
          <ExpenseView
            expenses={expenses}
            remainingBalance={stats.remainingBalance}
            totalExpenses={stats.totalExpenses}
            lang={lang}
            onExpenseSaved={refreshData}
            onExportCSV={() => storage.exportExpensesCSV()}
          />
        )}

        {activeTab === 'whatsapp' && (
          <WhatsAppView
            collections={collections}
            initialRecord={whatsAppRecipient}
            lang={lang}
          />
        )}

        {activeTab === 'reports' && (
          <ReportsView
            collections={collections}
            expenses={expenses}
            lang={lang}
            onRefreshData={refreshData}
            onOpenSheetsModal={() => setSheetsModalOpen(true)}
          />
        )}
      </main>

      {/* Bottom Navigation for Mobile thumb navigation */}
      <BottomNav
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        lang={lang}
        donationsCount={collections.length}
        expensesCount={expenses.length}
      />

      {/* Printable Receipt Modal */}
      {selectedReceipt && (
        <ReceiptModal
          record={selectedReceipt}
          lang={lang}
          onClose={() => setSelectedReceipt(null)}
          onShareWhatsApp={(rec) => {
            setSelectedReceipt(null);
            handleQuickWhatsApp(rec);
          }}
        />
      )}

      {/* Google Sheets Live Sync Modal */}
      {sheetsModalOpen && (
        <GoogleSheetsModal
          collections={collections}
          expenses={expenses}
          lang={lang}
          onClose={() => setSheetsModalOpen(false)}
          onSyncComplete={() => {
            refreshData();
            showToast('Google Sheets synchronized successfully!', 'success');
          }}
        />
      )}

      {/* Settings & Integrations Modal */}
      {settingsOpen && (
        <SettingsModal
          initialTab={settingsTab}
          lang={lang}
          onClose={() => setSettingsOpen(false)}
          onConfigUpdated={refreshData}
        />
      )}
    </div>
  );
}
