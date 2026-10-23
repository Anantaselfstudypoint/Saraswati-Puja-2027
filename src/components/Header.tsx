import React, { useState, useEffect } from 'react';
import { Flame, Moon, Sun, Languages, Cloud, HardDrive, Settings, FileSpreadsheet } from 'lucide-react';
import { Language, Theme } from '../types';
import { getTranslation } from '../utils/i18n';
import { storage } from '../services/storage';
import { onTokenChange, hasActiveToken } from '../services/googleAuth';
import { USER_SPREADSHEET_ID } from '../services/googleSheets';
import { sheetsService } from '../services/sheets';

interface HeaderProps {
  lang: Language;
  onLanguageChange: (lang: Language) => void;
  theme: Theme;
  onThemeToggle: () => void;
  onOpenSettings: (tab?: 'sheets' | 'firebase') => void;
  onOpenSheetsModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  lang,
  onLanguageChange,
  theme,
  onThemeToggle,
  onOpenSettings,
  onOpenSheetsModal,
}) => {
  const isCloud = storage.isCloudConnected();
  const [isGoogleConnected, setIsGoogleConnected] = useState(
    hasActiveToken() || sheetsService.isConfigured()
  );

  useEffect(() => {
    const unsub = onTokenChange((token) => {
      setIsGoogleConnected(Boolean(token) || sheetsService.isConfigured());
    });
    return () => unsub();
  }, []);

  return (
    <header className="sticky top-0 z-40 bg-gradient-to-r from-purple-900 via-indigo-900 to-purple-800 text-white shadow-md border-b border-purple-700/40">
      <div className="max-w-4xl mx-auto px-3 py-2.5 sm:px-4 sm:py-3 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-400/20 border border-amber-300/40 flex items-center justify-center text-amber-300 shadow-inner">
            <Flame className="w-5 h-5 sm:w-6 sm:h-6 text-amber-300 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-base sm:text-lg tracking-tight font-serif text-amber-100 flex items-center gap-1.5">
                {getTranslation('appTitle', lang)}
              </h1>
              <span className="hidden sm:inline-block text-[11px] bg-amber-400/25 text-amber-200 px-2 py-0.5 rounded-full font-medium border border-amber-300/30">
                2027
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-purple-200">
              <button
                onClick={() => onOpenSettings(isCloud ? 'firebase' : 'sheets')}
                className="flex items-center gap-1 hover:text-amber-200 transition-colors cursor-pointer"
                title="Storage Mode"
              >
                {isCloud ? (
                  <span className="inline-flex items-center gap-1 text-[11px] text-emerald-300 font-medium">
                    <Cloud className="w-3 h-3" /> {getTranslation('storageCloud', lang)}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] text-purple-300 font-medium">
                    <HardDrive className="w-3 h-3" /> {getTranslation('storageLocal', lang)}
                  </span>
                )}
              </button>

              <span className="text-purple-400">•</span>

              <button
                onClick={onOpenSheetsModal}
                className="flex items-center gap-1 hover:text-amber-200 transition-colors cursor-pointer"
                title="Google Sheets Sync"
              >
                <FileSpreadsheet className={`w-3 h-3 ${isGoogleConnected ? 'text-emerald-300' : 'text-amber-300'}`} />
                <span className={`text-[11px] ${isGoogleConnected ? 'text-emerald-300 font-medium' : 'text-purple-200'}`}>
                  {isGoogleConnected
                    ? (sheetsService.isConfigured() ? (lang === 'hi' ? 'शीट: स्थाई एक्टिव' : 'Sheets: Auto-Sync') : (lang === 'hi' ? 'शीट: रेडी' : 'Sheets: Ready'))
                    : (lang === 'hi' ? 'शीट जोड़ें' : 'Connect Sheet')}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 sm:gap-1.5">
          {/* Quick Sheet Sync button */}
          <button
            onClick={onOpenSheetsModal}
            className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 sm:py-1.5 text-[11px] sm:text-xs font-bold rounded-lg border transition-all cursor-pointer active:scale-95 ${
              isGoogleConnected
                ? 'bg-emerald-600/90 hover:bg-emerald-600 border-emerald-400 text-white shadow-xs'
                : 'bg-amber-500 hover:bg-amber-400 border-amber-300 text-slate-950 font-extrabold shadow-sm'
            }`}
            title="Google Sheets Sync"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" />
            <span>{isGoogleConnected ? (lang === 'hi' ? 'शीट सिंक' : 'Sheet Sync') : (lang === 'hi' ? 'शीट जोड़ें' : 'Connect')}</span>
          </button>

          {/* Language Toggle */}
          <button
            onClick={() => onLanguageChange(lang === 'en' ? 'hi' : 'en')}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-purple-950/60 hover:bg-purple-900 border border-purple-600/50 rounded-lg text-purple-100 transition-all cursor-pointer active:scale-95"
            title="Toggle Language / भाषा बदलें"
          >
            <Languages className="w-3.5 h-3.5 text-amber-300" />
            <span>{lang === 'en' ? 'हिंदी' : 'ENG'}</span>
          </button>

          {/* Theme Toggle */}
          <button
            onClick={onThemeToggle}
            className="p-2 text-purple-200 hover:text-white bg-purple-950/60 hover:bg-purple-900 border border-purple-600/50 rounded-lg transition-all cursor-pointer active:scale-95"
            title="Toggle Dark / Light Theme"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-300" />
            ) : (
              <Moon className="w-4 h-4 text-purple-200" />
            )}
          </button>

          {/* Settings */}
          <button
            onClick={() => onOpenSettings()}
            className="p-2 text-purple-200 hover:text-white bg-purple-950/60 hover:bg-purple-900 border border-purple-600/50 rounded-lg transition-all cursor-pointer active:scale-95"
            title="Settings & Backup"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
