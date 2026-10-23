import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  ArrowUpDown,
  X,
  Receipt,
  Share2,
  Edit2,
  Trash2,
  Phone,
  Calendar,
  Hash,
  CreditCard,
  Users,
  Download
} from 'lucide-react';
import { CollectionRecord, Language, PaymentMethod } from '../types';
import { getTranslation } from '../utils/i18n';
import { formatIndianCurrency } from '../utils/numberToWords';

interface MemberRecordsViewProps {
  collections: CollectionRecord[];
  lang: Language;
  onEdit: (record: CollectionRecord) => void;
  onDelete: (id: string) => void;
  onOpenReceipt: (record: CollectionRecord) => void;
  onQuickWhatsApp: (record: CollectionRecord) => void;
  onExportCSV: () => void;
  onBulkWhatsApp?: () => void;
}

type SortOption = 'newest' | 'oldest' | 'highest' | 'lowest' | 'name';

export const MemberRecordsView: React.FC<MemberRecordsViewProps> = ({
  collections,
  lang,
  onEdit,
  onDelete,
  onOpenReceipt,
  onQuickWhatsApp,
  onExportCSV,
  onBulkWhatsApp,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMethod, setSelectedMethod] = useState<string>('all');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Filtered & Sorted Records
  const filteredRecords = useMemo(() => {
    let result = [...collections];

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.mobile.includes(q) ||
          c.receiptNumber.toLowerCase().includes(q) ||
          (c.uniqueId && c.uniqueId.toLowerCase().includes(q)) ||
          (c.transactionId && c.transactionId.toLowerCase().includes(q))
      );
    }

    // Payment method filter
    if (selectedMethod !== 'all') {
      result = result.filter((c) => c.paymentMethod === selectedMethod);
    }

    // Date filter
    if (selectedDate) {
      result = result.filter((c) => c.date === selectedDate);
    }

    // Sorting
    result.sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime();
      if (sortBy === 'oldest') return new Date(a.createdAt || a.date).getTime() - new Date(b.createdAt || b.date).getTime();
      if (sortBy === 'highest') return Number(b.amount) - Number(a.amount);
      if (sortBy === 'lowest') return Number(a.amount) - Number(b.amount);
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      return 0;
    });

    return result;
  }, [collections, searchQuery, selectedMethod, selectedDate, sortBy]);

  const filteredTotal = useMemo(() => {
    return filteredRecords.reduce((sum, c) => sum + Number(c.amount || 0), 0);
  }, [filteredRecords]);

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedMethod('all');
    setSelectedDate('');
    setSortBy('newest');
  };

  const hasActiveFilters = searchQuery !== '' || selectedMethod !== 'all' || selectedDate !== '';

  const confirmDelete = (record: CollectionRecord) => {
    const confirmed = window.confirm(
      getTranslation('confirmDeleteDonation', lang, {
        amount: formatIndianCurrency(record.amount),
        name: record.name,
      })
    );
    if (confirmed) {
      onDelete(record.id);
    }
  };

  return (
    <div className="space-y-4 pb-20 pt-2">
      {/* Top Bar with Search & Total */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              {getTranslation('memberRecordsTitle', lang)}
            </h2>
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              <span>{filteredRecords.length} records</span>
              <span>•</span>
              <span>Total: <strong className="text-emerald-600 dark:text-emerald-400">₹{formatIndianCurrency(filteredTotal)}</strong></span>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
            {onBulkWhatsApp && (
              <button
                type="button"
                onClick={onBulkWhatsApp}
                className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-xs font-bold rounded-lg border border-emerald-300 dark:border-emerald-800 flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 shadow-2xs"
              >
                <Share2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>{lang === 'hi' ? 'बल्क संदेश (Bulk WhatsApp)' : 'Bulk WhatsApp'}</span>
              </button>
            )}

            <button
              onClick={onExportCSV}
              className="px-3 py-1.5 bg-purple-50 dark:bg-purple-950/40 hover:bg-purple-100 dark:hover:bg-purple-900/40 text-purple-700 dark:text-purple-300 text-xs font-semibold rounded-lg border border-purple-200 dark:border-purple-800/60 flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
            >
              <Download className="w-3.5 h-3.5" />
              <span>CSV Export</span>
            </button>
          </div>
        </div>

        {/* Search input */}
        <div className="relative mb-3">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={getTranslation('searchPlaceholder', lang)}
            className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-600 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filters and Sort Row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {/* Method Filter */}
          <select
            value={selectedMethod}
            onChange={(e) => setSelectedMethod(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-purple-600"
          >
            <option value="all">{getTranslation('allMethods', lang)}</option>
            <option value="Cash">{getTranslation('cash', lang)}</option>
            <option value="UPI">{getTranslation('upi', lang)}</option>
            <option value="Online">{getTranslation('online', lang)}</option>
          </select>

          {/* Date Filter */}
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            title="Filter by Date"
            className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-purple-600"
          />

          {/* Sort By */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="col-span-2 sm:col-span-1 px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-purple-600"
          >
            <option value="newest">{getTranslation('sortNewest', lang)}</option>
            <option value="oldest">{getTranslation('sortOldest', lang)}</option>
            <option value="highest">{getTranslation('sortHighest', lang)}</option>
            <option value="lowest">{getTranslation('sortLowest', lang)}</option>
            <option value="name">{getTranslation('sortName', lang)}</option>
          </select>
        </div>

        {hasActiveFilters && (
          <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-500">Filters applied</span>
            <button
              onClick={clearFilters}
              className="text-purple-600 dark:text-purple-400 font-semibold hover:underline cursor-pointer"
            >
              {getTranslation('clearFilters', lang)}
            </button>
          </div>
        )}
      </div>

      {/* Record Cards List */}
      {filteredRecords.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 text-center">
          <Users className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {getTranslation('noRecordsFound', lang)}
          </p>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="mt-3 px-3 py-1.5 text-xs bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 rounded-lg font-semibold hover:bg-purple-200 cursor-pointer"
            >
              {getTranslation('clearFilters', lang)}
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRecords.map((record) => (
            <div
              key={record.id}
              className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm hover:border-purple-300 dark:hover:border-purple-800 transition-all"
            >
              {/* Card Header: Name + Amount */}
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                    {record.name}
                  </h3>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    <span className="inline-block px-2 py-0.5 rounded bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-mono font-bold text-[11px] border border-purple-200 dark:border-purple-800">
                      {record.receiptNumber}
                    </span>
                    <span
                      className={`text-[11px] font-semibold px-2 py-0.2 rounded-full ${
                        record.paymentMethod === 'Cash'
                          ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                          : record.paymentMethod === 'UPI'
                          ? 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300'
                          : 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                      }`}
                    >
                      {record.paymentMethod}
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-base sm:text-lg font-extrabold text-emerald-600 dark:text-emerald-400 font-sans">
                    ₹{formatIndianCurrency(record.amount)}
                  </div>
                </div>
              </div>

              {/* Details Meta */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-slate-600 dark:text-slate-400 py-2 border-y border-slate-100 dark:border-slate-800 my-2">
                <div className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-purple-500" />
                  <span>{record.date}</span>
                </div>

                {record.mobile && record.mobile !== 'N/A' && (
                  <div className="flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-emerald-500" />
                    <a
                      href={`tel:${record.mobile}`}
                      className="hover:underline text-emerald-600 dark:text-emerald-400 font-medium"
                    >
                      {record.mobile}
                    </a>
                  </div>
                )}

                {record.uniqueId && record.uniqueId !== 'N/A' && (
                  <div className="flex items-center gap-1 col-span-2 sm:col-span-1 truncate">
                    <Hash className="w-3.5 h-3.5 text-purple-500" />
                    <span className="truncate">{record.uniqueId}</span>
                  </div>
                )}

                {record.transactionId && record.transactionId !== 'N/A' && (
                  <div className="flex items-center gap-1 col-span-2 text-[11px] font-mono text-purple-700 dark:text-purple-300 truncate">
                    <CreditCard className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">Txn: {record.transactionId}</span>
                  </div>
                )}
              </div>

              {/* Notes if any */}
              {record.notes && (
                <p className="text-xs text-slate-500 dark:text-slate-400 italic mb-3">
                  "{record.notes}"
                </p>
              )}

              {/* Action Buttons */}
              <div className="flex items-center gap-1.5 flex-wrap pt-1">
                <button
                  onClick={() => onOpenReceipt(record)}
                  className="px-2.5 py-1.5 bg-purple-50 dark:bg-purple-950/40 hover:bg-purple-100 dark:hover:bg-purple-900/60 text-purple-700 dark:text-purple-300 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer"
                >
                  <Receipt className="w-3.5 h-3.5" />
                  <span>{getTranslation('printReceipt', lang)}</span>
                </button>

                <button
                  onClick={() => onQuickWhatsApp(record)}
                  className="px-2.5 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>WhatsApp + PDF</span>
                </button>

                <div className="ml-auto flex items-center gap-1">
                  <button
                    onClick={() => onEdit(record)}
                    className="p-1.5 text-slate-600 dark:text-slate-300 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950 rounded-lg transition-colors cursor-pointer"
                    title={getTranslation('edit', lang)}
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => confirmDelete(record)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                    title={getTranslation('delete', lang)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
