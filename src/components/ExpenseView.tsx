import React, { useState, useEffect, useMemo } from 'react';
import {
  ReceiptIndianRupee,
  PlusCircle,
  Save,
  RotateCcw,
  Trash2,
  Edit2,
  Calendar,
  User,
  CreditCard,
  FileText,
  Download,
  PieChart,
  Tag
} from 'lucide-react';
import { ExpenseRecord, ExpenseCategory, Language, PaymentMethod } from '../types';
import { getTranslation, translations } from '../utils/i18n';
import { formatIndianCurrency } from '../utils/numberToWords';
import { storage } from '../services/storage';
import { getAccessToken, onTokenChange, hasActiveToken } from '../services/googleAuth';
import { googleSheetsApi } from '../services/googleSheets';
import { sheetsService } from '../services/sheets';

interface ExpenseViewProps {
  expenses: ExpenseRecord[];
  remainingBalance: number;
  totalExpenses: number;
  lang: Language;
  onExpenseSaved: () => void;
  onExportCSV: () => void;
}

const CATEGORIES: ExpenseCategory[] = [
  'Idol (Pratima)',
  'Pandal & Decor',
  'Puja Samagri',
  'Prasad & Bhog',
  'Sound & Light',
  'Priest & Rituals',
  'Cultural Event',
  'Other',
];

export const ExpenseView: React.FC<ExpenseViewProps> = ({
  expenses,
  remainingBalance,
  totalExpenses,
  lang,
  onExpenseSaved,
  onExportCSV,
}) => {
  const todayStr = new Date().toISOString().split('T')[0];

  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState<number | ''>('');
  const [date, setDate] = useState(todayStr);
  const [category, setCategory] = useState<ExpenseCategory>('Puja Samagri');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [paidBy, setPaidBy] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');

  const resetForm = () => {
    setEditId(null);
    setName('');
    setAmount('');
    setDate(new Date().toISOString().split('T')[0]);
    setCategory('Puja Samagri');
    setPaymentMethod('Cash');
    setPaidBy('');
    setNotes('');
  };

  const handleEdit = (record: ExpenseRecord) => {
    setEditId(record.id);
    setName(record.name);
    setAmount(record.amount);
    setDate(record.date);
    setCategory(record.category);
    setPaymentMethod(record.paymentMethod);
    setPaidBy(record.paidBy);
    setNotes(record.notes || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (record: ExpenseRecord) => {
    const confirmed = window.confirm(
      getTranslation('confirmDeleteExpense', lang, {
        amount: formatIndianCurrency(record.amount),
        name: record.name,
      })
    );
    if (!confirmed) return;

    try {
      await storage.deleteExpense(record.id);
      onExpenseSaved();
      if (editId === record.id) resetForm();
    } catch (err: any) {
      alert(`Failed to delete: ${err.message}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      alert('Please enter the expense item / purpose.');
      return;
    }

    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      alert('Please enter a valid expense amount.');
      return;
    }

    if (!paidBy.trim()) {
      alert('Please enter who paid for this expense (Committee member name).');
      return;
    }

    setIsSubmitting(true);

    try {
      const record: ExpenseRecord = {
        id: editId || `exp_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        name: name.trim(),
        amount: numAmount,
        date,
        category,
        paymentMethod,
        paidBy: paidBy.trim(),
        notes: notes.trim(),
        createdAt: editId ? (expenses.find((e) => e.id === editId)?.createdAt || new Date().toISOString()) : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await storage.saveExpense(record);

      // Real-time automatic append to Google Sheets (OAuth or Permanent Webhook)
      const token = await getAccessToken();
      if (token) {
        try {
          await googleSheetsApi.appendSingleExpense(record, token);
          record.syncedToSheets = true;
        } catch (sheetErr) {
          console.warn('Auto-sync expense via OAuth failed:', sheetErr);
        }
      } else if (sheetsService.isConfigured()) {
        try {
          await sheetsService.syncData([], [record]);
          record.syncedToSheets = true;
        } catch (sheetErr) {
          console.warn('Auto-sync expense via Webhook failed:', sheetErr);
        }
      }

      onExpenseSaved();
      resetForm();
    } catch (err: any) {
      alert(`Failed to save expense: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtered Expenses
  const filteredExpenses = useMemo(() => {
    if (selectedCategoryFilter === 'all') return expenses;
    return expenses.filter((e) => e.category === selectedCategoryFilter);
  }, [expenses, selectedCategoryFilter]);

  // Category Breakdown summary
  const categorySummary = useMemo(() => {
    const map: Record<string, number> = {};
    expenses.forEach((e) => {
      map[e.category] = (map[e.category] || 0) + Number(e.amount || 0);
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [expenses]);

  return (
    <div className="space-y-4 pb-20 pt-2">
      {/* Overview Stat Bar */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">
            {getTranslation('totalExpenses', lang)}
          </span>
          <div className="text-xl sm:text-2xl font-bold text-rose-600 dark:text-rose-400 font-sans">
            ₹{formatIndianCurrency(totalExpenses)}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">
            {expenses.length} expense items recorded
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">
            {getTranslation('remainingBalance', lang)}
          </span>
          <div
            className={`text-xl sm:text-2xl font-bold font-sans ${
              remainingBalance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600'
            }`}
          >
            ₹{formatIndianCurrency(remainingBalance)}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">
            Collection minus Expenses
          </span>
        </div>
      </div>

      {/* Record Expense Form */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 sm:p-6">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ReceiptIndianRupee className="w-5 h-5 text-rose-600 dark:text-rose-400" />
            {editId
              ? getTranslation('editExpenseTitle', lang)
              : getTranslation('recordExpenseTitle', lang)}
          </h2>
          {editId && (
            <span className="text-xs bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full font-semibold">
              Editing Mode
            </span>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Expense Item Name */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
              {getTranslation('expenseItem', lang)} <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={getTranslation('expenseItemPlaceholder', lang)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 transition-all"
            />
          </div>

          {/* Amount & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <span className="text-rose-600 font-bold text-sm">₹</span>
                {getTranslation('amount', lang)} <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-slate-400 font-bold text-base">₹</span>
                <input
                  type="number"
                  required
                  min="1"
                  step="1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="e.g. 2500"
                  className="w-full pl-8 pr-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-base font-bold focus:outline-none focus:ring-2 focus:ring-rose-500 transition-all font-sans"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                {getTranslation('date', lang)} <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 transition-all"
              />
            </div>
          </div>

          {/* Category & Payment Method */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <PieChart className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                {getTranslation('category', lang)} <span className="text-rose-500">*</span>
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 transition-all"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {(translations[lang]?.categories as any)?.[cat] || cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                {getTranslation('paymentMethod', lang)} <span className="text-rose-500">*</span>
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 transition-all"
              >
                <option value="Cash">{getTranslation('cash', lang)}</option>
                <option value="UPI">{getTranslation('upi', lang)}</option>
                <option value="Online">{getTranslation('online', lang)}</option>
              </select>
            </div>
          </div>

          {/* Paid By */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
              {getTranslation('paidBy', lang)} <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={paidBy}
              onChange={(e) => setPaidBy(e.target.value)}
              placeholder={getTranslation('paidByPlaceholder', lang)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 transition-all"
            />
          </div>

          {/* Bill / Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
              {getTranslation('billNotes', lang)}
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Voucher #104, kumartuli shop bill attached"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 transition-all"
            />
          </div>

          {/* Actions */}
          <div className="pt-2 flex flex-col sm:flex-row gap-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-3 px-4 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white font-bold text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>
                {editId
                  ? getTranslation('updateExpense', lang)
                  : getTranslation('saveExpense', lang)}
              </span>
            </button>

            {editId && (
              <button
                type="button"
                onClick={resetForm}
                className="py-3 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-sm rounded-xl transition-all cursor-pointer"
              >
                {getTranslation('cancelEdit', lang)}
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Category Breakdown Chips */}
      {categorySummary.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-2.5">
            {getTranslation('expenseBreakdown', lang)}
          </span>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedCategoryFilter('all')}
              className={`px-2.5 py-1 text-xs rounded-lg font-semibold transition-all cursor-pointer ${
                selectedCategoryFilter === 'all'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              All ({expenses.length})
            </button>
            {categorySummary.map(([cat, total]) => (
              <button
                key={cat}
                onClick={() => setSelectedCategoryFilter(cat)}
                className={`px-2.5 py-1 text-xs rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  selectedCategoryFilter === cat
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60 hover:bg-rose-100'
                }`}
              >
                <span>{(translations[lang]?.categories as any)?.[cat] || cat}</span>
                <span className="font-mono">₹{formatIndianCurrency(total)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Expense History List */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-3">
          <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white flex items-center gap-2">
            <span>{getTranslation('expenseHistory', lang)}</span>
            <span className="text-xs bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 px-2 py-0.5 rounded-full font-semibold">
              {filteredExpenses.length}
            </span>
          </h3>

          {expenses.length > 0 && (
            <button
              onClick={onExportCSV}
              className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-lg flex items-center gap-1 cursor-pointer transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              <span>CSV</span>
            </button>
          )}
        </div>

        {filteredExpenses.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">
            {getTranslation('noExpensesYet', lang)}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredExpenses.map((exp) => (
              <div
                key={exp.id}
                className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex items-start justify-between gap-3 hover:border-rose-300 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm text-slate-900 dark:text-white truncate">
                      {exp.name}
                    </span>
                    <span className="text-[11px] bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60 px-2 py-0.2 rounded font-medium">
                      {(translations[lang]?.categories as any)?.[exp.category] || exp.category}
                    </span>
                  </div>

                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
                    <span>📅 {exp.date}</span>
                    <span>•</span>
                    <span>👤 Paid by: <strong className="text-slate-700 dark:text-slate-200">{exp.paidBy}</strong></span>
                    <span>•</span>
                    <span className="font-medium">{exp.paymentMethod}</span>
                  </div>

                  {exp.notes && (
                    <p className="text-xs text-slate-500 italic mt-1">"{exp.notes}"</p>
                  )}
                </div>

                <div className="text-right">
                  <div className="font-extrabold text-base text-rose-600 dark:text-rose-400 font-sans">
                    -₹{formatIndianCurrency(exp.amount)}
                  </div>

                  <div className="flex items-center justify-end gap-1 mt-2">
                    <button
                      onClick={() => handleEdit(exp)}
                      className="p-1.5 text-slate-600 dark:text-slate-300 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950 rounded-lg cursor-pointer"
                      title={getTranslation('edit', lang)}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(exp)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950 rounded-lg cursor-pointer"
                      title={getTranslation('delete', lang)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
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
