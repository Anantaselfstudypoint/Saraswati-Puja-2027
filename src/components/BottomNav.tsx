import React from 'react';
import { LayoutDashboard, PlusCircle, Users, ReceiptIndianRupee, MessageCircle, FileText } from 'lucide-react';
import { TabType, Language } from '../types';
import { getTranslation } from '../utils/i18n';

interface BottomNavProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  lang: Language;
  donationsCount: number;
  expensesCount: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onTabChange,
  lang,
  donationsCount,
  expensesCount,
}) => {
  const tabs = [
    { id: 'dashboard' as TabType, label: getTranslation('navHome', lang), icon: LayoutDashboard },
    { id: 'add' as TabType, label: getTranslation('navAdd', lang), icon: PlusCircle, isPrimary: true },
    { id: 'records' as TabType, label: getTranslation('navRecords', lang), icon: Users, badge: donationsCount },
    { id: 'expenses' as TabType, label: getTranslation('navExpenses', lang), icon: ReceiptIndianRupee, badge: expensesCount },
    { id: 'whatsapp' as TabType, label: getTranslation('navWhatsapp', lang), icon: MessageCircle },
    { id: 'reports' as TabType, label: getTranslation('navReports', lang), icon: FileText },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-purple-100 dark:border-purple-950/60 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] no-print pb-safe">
      <div className="max-w-4xl mx-auto grid grid-cols-6 h-15 items-center px-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          if (tab.isPrimary) {
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className="flex flex-col items-center justify-center -mt-4 group cursor-pointer focus:outline-none"
              >
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all ${
                    isActive
                      ? 'bg-amber-500 text-purple-950 ring-4 ring-purple-100 dark:ring-purple-900 scale-105'
                      : 'bg-gradient-to-tr from-purple-700 to-indigo-600 text-white shadow-purple-600/30 hover:scale-105 active:scale-95'
                  }`}
                >
                  <Icon className="w-6 h-6 stroke-[2.2]" />
                </div>
                <span
                  className={`text-[10px] mt-0.5 font-bold tracking-tight ${
                    isActive ? 'text-purple-700 dark:text-purple-300' : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {tab.label}
                </span>
              </button>
            );
          }

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`relative flex flex-col items-center justify-center py-1 transition-all cursor-pointer ${
                isActive
                  ? 'text-purple-700 dark:text-purple-300 font-semibold'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110' : ''}`} />
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className="absolute -top-1 -right-2 min-w-4 h-4 px-1 rounded-full bg-purple-600 text-white text-[9px] flex items-center justify-center font-bold">
                    {tab.badge > 99 ? '99+' : tab.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] mt-0.5 truncate max-w-full px-0.5 leading-tight">{tab.label}</span>
              {isActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-purple-600 dark:bg-purple-400 mt-0.5"></span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
