import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import {
  Sparkles,
  AlertTriangle,
  Receipt,
  RotateCcw,
  Save,
  CheckCircle2,
  Calendar,
  CreditCard,
  Phone,
  User,
  Hash,
  FileText,
  FileSpreadsheet
} from 'lucide-react';
import { CollectionRecord, Language, PaymentMethod } from '../types';
import { getTranslation } from '../utils/i18n';
import { storage } from '../services/storage';
import { getAccessToken, onTokenChange, hasActiveToken } from '../services/googleAuth';
import { googleSheetsApi } from '../services/googleSheets';
import { sheetsService } from '../services/sheets';

interface AddCollectionViewProps {
  editRecord?: CollectionRecord | null;
  lang: Language;
  onSaveSuccess: (record: CollectionRecord, isEdit: boolean) => void;
  onCancelEdit?: () => void;
  onOpenSheetsModal?: () => void;
}

const QUICK_AMOUNTS = [251, 501, 1101, 2100, 5100, 11000];

export const AddCollectionView: React.FC<AddCollectionViewProps> = ({
  editRecord,
  lang,
  onSaveSuccess,
  onCancelEdit,
  onOpenSheetsModal,
}) => {
  const isEdit = Boolean(editRecord);
  const todayStr = new Date().toISOString().split('T')[0];

  const [name, setName] = useState('');
  const [amount, setAmount] = useState<number | ''>('');
  const [mobile, setMobile] = useState('');
  const [uniqueId, setUniqueId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [date, setDate] = useState(todayStr);
  const [transactionId, setTransactionId] = useState('');
  const [notes, setNotes] = useState('');
  const [receiptNumber, setReceiptNumber] = useState('');

  // Duplicate warning state
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [allowDuplicateBypass, setAllowDuplicateBypass] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSheetsConnected, setIsSheetsConnected] = useState(
    hasActiveToken() || sheetsService.isConfigured()
  );

  useEffect(() => {
    const unsub = onTokenChange((t) =>
      setIsSheetsConnected(Boolean(t) || sheetsService.isConfigured())
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    if (editRecord) {
      setName(editRecord.name);
      setAmount(editRecord.amount);
      setMobile(editRecord.mobile);
      setUniqueId(editRecord.uniqueId === 'N/A' ? '' : editRecord.uniqueId);
      setPaymentMethod(editRecord.paymentMethod);
      setDate(editRecord.date);
      setTransactionId(editRecord.transactionId === 'N/A' ? '' : editRecord.transactionId);
      setNotes(editRecord.notes || '');
      setReceiptNumber(editRecord.receiptNumber);
    } else {
      resetForm();
    }
  }, [editRecord]);

  const resetForm = () => {
    setName('');
    setAmount('');
    setMobile('');
    setUniqueId('');
    setPaymentMethod('Cash');
    setDate(new Date().toISOString().split('T')[0]);
    setTransactionId('');
    setNotes('');
    setReceiptNumber(storage.generateReceiptNumber());
    setDuplicateWarning(null);
    setAllowDuplicateBypass(false);
  };

  // Real-time duplicate check as user types
  useEffect(() => {
    if (!name.trim() || !amount || Number(amount) <= 0) {
      setDuplicateWarning(null);
      return;
    }

    const check = storage.checkDuplicateCollection(
      name,
      mobile,
      Number(amount),
      date,
      transactionId,
      editRecord?.id
    );

    if (check.isDuplicate && check.reason) {
      setDuplicateWarning(check.reason);
    } else {
      setDuplicateWarning(null);
    }
  }, [name, mobile, amount, date, transactionId, editRecord]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      alert('Please enter the donor/member name.');
      return;
    }

    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      alert('Please enter a valid donation amount.');
      return;
    }

    const cleanMobile = mobile.replace(/\D/g, '');
    if (cleanMobile.length > 0 && cleanMobile.length < 10) {
      alert('Mobile number must be at least 10 digits.');
      return;
    }

    if ((paymentMethod === 'UPI' || paymentMethod === 'Online') && !transactionId.trim()) {
      alert('Please enter the Transaction ID / UTR number for UPI / Online transfer.');
      return;
    }

    // Check duplicate guard
    if (duplicateWarning && !allowDuplicateBypass && !isEdit) {
      const confirmSave = window.confirm(
        `${duplicateWarning}\n\nDo you still want to save this donation? Click OK to proceed.`
      );
      if (!confirmSave) return;
    }

    setIsSubmitting(true);

    try {
      const record: CollectionRecord = {
        id: editRecord ? editRecord.id : `col_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        receiptNumber: receiptNumber || storage.generateReceiptNumber(),
        name: name.trim(),
        amount: numAmount,
        mobile: cleanMobile || 'N/A',
        uniqueId: uniqueId.trim() || 'N/A',
        paymentMethod,
        date,
        transactionId: transactionId.trim() || 'N/A',
        notes: notes.trim(),
        createdAt: editRecord?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await storage.saveCollection(record);

      // Real-time automatic append to Google Sheets (OAuth or Permanent Webhook)
      const token = await getAccessToken();
      if (token) {
        try {
          await googleSheetsApi.appendSingleDonation(record, token);
          record.syncedToSheets = true;
        } catch (sheetErr) {
          console.warn('Auto-sync via OAuth to Google Sheets failed:', sheetErr);
        }
      } else if (sheetsService.isConfigured()) {
        try {
          await sheetsService.syncData([record], []);
          record.syncedToSheets = true;
        } catch (sheetErr) {
          console.warn('Auto-sync via Webhook to Google Sheets failed:', sheetErr);
        }
      }

      // Trigger celebration confetti
      try {
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.7 },
          colors: ['#5b21b6', '#7c3aed', '#f59e0b', '#10b981'],
        });
      } catch {
        // ignore if browser blocks
      }

      onSaveSuccess(record, isEdit);
      if (!isEdit) resetForm();
    } catch (err: any) {
      alert(`Failed to save donation: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 pb-20 pt-2">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 sm:p-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-4">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              {isEdit
                ? getTranslation('editCollectionTitle', lang)
                : getTranslation('addCollectionTitle', lang)}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Saraswati Puja Samiti 2027 • Official Collection Register
            </p>
          </div>

          <div className="text-right">
            <span className="text-[10px] text-slate-400 dark:text-slate-500 block">
              {getTranslation('receiptNumberPreview', lang)}
            </span>
            <span className="inline-block px-2.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-mono font-bold text-xs border border-purple-200 dark:border-purple-800">
              {receiptNumber || 'SP2027-AUTO'}
            </span>
          </div>
        </div>

        {/* Duplicate Warning Alert */}
        {duplicateWarning && (
          <div className="mb-4 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-semibold block">{duplicateWarning}</span>
              <label className="inline-flex items-center gap-1.5 mt-2 font-medium text-amber-800 dark:text-amber-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowDuplicateBypass}
                  onChange={(e) => setAllowDuplicateBypass(e.target.checked)}
                  className="rounded text-purple-600 focus:ring-purple-500"
                />
                <span>Confirm this is a separate donation, not an accidental double-entry.</span>
              </label>
            </div>
          </div>
        )}

        {/* Donation Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Donor Name */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
              {getTranslation('donorName', lang)} <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={getTranslation('namePlaceholder', lang)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent transition-all"
            />
          </div>

          {/* Amount & Quick Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <span className="text-emerald-600 dark:text-emerald-400 font-bold text-sm">₹</span>
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
                placeholder={getTranslation('amountPlaceholder', lang)}
                className="w-full pl-8 pr-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-base font-bold focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent transition-all font-sans"
              />
            </div>

            {/* Quick Amount Chips */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {QUICK_AMOUNTS.map((val) => (
                <button
                  type="button"
                  key={val}
                  onClick={() => setAmount(val)}
                  className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all cursor-pointer ${
                    Number(amount) === val
                      ? 'bg-purple-600 text-white font-bold shadow-sm'
                      : 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 hover:bg-purple-100 border border-purple-200 dark:border-purple-800/60'
                  }`}
                >
                  ₹{val}
                </button>
              ))}
            </div>
          </div>

          {/* Mobile & Unique ID Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                {getTranslation('mobileNumber', lang)}
              </label>
              <input
                type="tel"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                placeholder={getTranslation('mobilePlaceholder', lang)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                {getTranslation('uniqueId', lang)}
              </label>
              <input
                type="text"
                value={uniqueId}
                onChange={(e) => setUniqueId(e.target.value)}
                placeholder={getTranslation('uniqueIdPlaceholder', lang)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent transition-all"
              />
            </div>
          </div>

          {/* Date & Payment Method */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                {getTranslation('date', lang)} <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                {getTranslation('paymentMethod', lang)} <span className="text-rose-500">*</span>
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent transition-all"
              >
                <option value="Cash">{getTranslation('cash', lang)}</option>
                <option value="UPI">{getTranslation('upi', lang)}</option>
                <option value="Online">{getTranslation('online', lang)}</option>
              </select>
            </div>
          </div>

          {/* Transaction ID (Visible / Required if UPI or Online) */}
          {(paymentMethod === 'UPI' || paymentMethod === 'Online') && (
            <div className="p-3 rounded-xl bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/60 animate-fadeIn">
              <label className="block text-xs font-bold text-purple-900 dark:text-purple-200 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <Receipt className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                {getTranslation('transactionId', lang)} <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={transactionId}
                onChange={(e) => setTransactionId(e.target.value)}
                placeholder={getTranslation('txnPlaceholder', lang)}
                className="w-full px-3.5 py-2 rounded-lg border border-purple-300 dark:border-purple-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-600"
              />
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
              {getTranslation('notes', lang)}
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={getTranslation('notesPlaceholder', lang)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent transition-all"
            />
          </div>

          {/* Google Sheets Sync Status Banner */}
          <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-xs flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className={`w-4 h-4 shrink-0 ${isSheetsConnected ? 'text-emerald-600' : 'text-amber-500'}`} />
              <div>
                <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  {lang === 'hi' ? 'गूगल शीट ऑटो-सिंक' : 'Google Sheets Auto-Sync'}
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                      isSheetsConnected
                        ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                        : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                    }`}
                  >
                    {isSheetsConnected ? (lang === 'hi' ? 'सक्रिय' : 'Active') : (lang === 'hi' ? 'कनेक्ट नहीं' : 'Not Connected')}
                  </span>
                </span>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {isSheetsConnected
                    ? (lang === 'hi' ? 'चंदा सेव होते ही सीधे आपकी गूगल शीट में भी जुड़ जाएगा।' : 'Donation will also append directly to your Google Sheet.')
                    : (lang === 'hi' ? 'गूगल से कनेक्ट करें ताकि डेटा सीधे शीट में भी जाए।' : 'Connect Google to automatically save donations into your sheet.')}
                </p>
              </div>
            </div>
            {!isSheetsConnected && onOpenSheetsModal && (
              <button
                type="button"
                onClick={onOpenSheetsModal}
                className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-lg text-xs shrink-0 cursor-pointer shadow-xs active:scale-95 transition-all"
              >
                {lang === 'hi' ? 'शीट जोड़ें' : 'Connect'}
              </button>
            )}
          </div>

          {/* Form Actions */}
          <div className="pt-2 flex flex-col sm:flex-row gap-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-3 px-4 bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-800 hover:to-indigo-800 text-white font-bold text-sm rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>
                {isEdit
                  ? getTranslation('updateDonation', lang)
                  : getTranslation('saveDonation', lang)}
              </span>
            </button>

            {isEdit && onCancelEdit && (
              <button
                type="button"
                onClick={onCancelEdit}
                className="py-3 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-sm rounded-xl transition-all cursor-pointer"
              >
                {getTranslation('cancelEdit', lang)}
              </button>
            )}

            {!isEdit && (
              <button
                type="button"
                onClick={resetForm}
                className="py-3 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 font-semibold text-sm rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
