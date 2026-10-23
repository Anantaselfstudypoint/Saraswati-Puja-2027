import React, { useState } from 'react';
import { X, Printer, Share2, FileDown, CheckCircle2 } from 'lucide-react';
import { CollectionRecord, Language } from '../types';
import { getTranslation } from '../utils/i18n';
import { numberToWords, formatIndianCurrency } from '../utils/numberToWords';
import { createReceiptPdf, shareReceiptWithPdf } from '../utils/receiptPdf';

interface ReceiptModalProps {
  record: CollectionRecord | null;
  lang: Language;
  onClose: () => void;
  onShareWhatsApp: (record: CollectionRecord) => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  record,
  lang,
  onClose,
  onShareWhatsApp,
}) => {
  if (!record) return null;

  const [isSharingPdf, setIsSharingPdf] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);

  const words = numberToWords(record.amount, lang);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = () => {
    const doc = createReceiptPdf(record, lang);
    doc.save(`Saraswati_Puja_Receipt_${record.receiptNumber}.pdf`);
  };

  const handleShareWhatsAppPdf = async () => {
    setIsSharingPdf(true);
    setShareFeedback(null);

    const message =
      lang === 'hi'
        ? `🪔 *श्री श्री सरस्वती पूजा समिति २०२७* 🪔\n|| ॐ ऐं सरस्वत्यै नमः ||\n\nआदरणीय *${record.name}* जी,\n\nसरस्वती पूजा २०२७ हेतु आपका पावन सहयोग हमें सधन्यवाद प्राप्त हुआ है। आपकी आधिकारिक दान रसीद PDF इस संदेश के साथ संलग्न है।\n\n📜 *रसीद विवरण:*\n• रसीद संख्या: *${record.receiptNumber}*\n• प्राप्त राशि: *₹${formatIndianCurrency(record.amount)}*\n• भुगतान माध्यम: ${record.paymentMethod}\n• तारीख: ${record.date}\n\nमाँ सरस्वती की कृपा आप और आपके परिवार पर सदा बनी रहे! 🙏`
        : `🪔 *Saraswati Puja Samiti 2027* 🪔\n\nDear *${record.name}*,\n\nThank you for your generous contribution towards Saraswati Puja 2027. Your official donation receipt PDF is attached below.\n\n📜 *Receipt Details:*\n• Receipt No: *${record.receiptNumber}*\n• Amount: *INR ${formatIndianCurrency(record.amount)}*\n• Payment Mode: ${record.paymentMethod}\n• Date: ${record.date}\n\nWarm regards,\n*Saraswati Puja Samiti 2027*`;

    const res = await shareReceiptWithPdf(record, message, lang);
    setIsSharingPdf(false);

    if (res.method === 'native-share') {
      setShareFeedback('WhatsApp share opened with PDF attached!');
    } else {
      setShareFeedback('PDF receipt downloaded & WhatsApp opened! Please attach the downloaded PDF in the chat.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Top Header (Hidden on print) */}
        <div className="no-print px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/60">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">
              {getTranslation('officialReceipt', lang)}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Printable Receipt Paper Container */}
        <div className="overflow-y-auto p-4 sm:p-6 bg-slate-100/60 dark:bg-slate-950/40 flex-1">
          <div
            id="printable-receipt-container"
            className="bg-white text-slate-900 border-2 border-purple-800 rounded-xl p-5 sm:p-6 shadow-sm relative overflow-hidden font-sans"
          >
            {/* Watermark / Deity Symbol */}
            <div className="text-center pb-2 border-b-2 border-purple-800">
              <div className="text-[11px] font-bold text-purple-900 tracking-wider font-serif">
                {getTranslation('mantra', lang)}
              </div>
              <h2 className="text-lg sm:text-xl font-extrabold text-purple-950 uppercase tracking-tight mt-1 font-serif">
                {getTranslation('committeeHeading', lang)}
              </h2>
              <p className="text-[10px] text-purple-800 uppercase tracking-widest font-semibold mt-0.5">
                Official Donation Acknowledgment Slip • 2027
              </p>
            </div>

            {/* Receipt Meta (No & Date) */}
            <div className="flex items-center justify-between py-2 text-xs border-b border-dashed border-purple-200 font-medium text-slate-700">
              <div>
                <span>{getTranslation('receiptNo', lang)} </span>
                <strong className="text-purple-900 font-mono font-bold text-xs">
                  {record.receiptNumber}
                </strong>
              </div>
              <div>
                <span>{getTranslation('receiptDate', lang)} </span>
                <strong className="text-slate-900">{record.date}</strong>
              </div>
            </div>

            {/* Donor Details Table */}
            <div className="py-3 space-y-2 text-xs">
              <div className="flex items-baseline justify-between border-b border-slate-100 pb-1.5">
                <span className="text-slate-500">{getTranslation('donor', lang)}</span>
                <strong className="text-slate-900 text-sm font-bold text-right">
                  {record.name}
                </strong>
              </div>

              {record.mobile && record.mobile !== 'N/A' && (
                <div className="flex items-baseline justify-between border-b border-slate-100 pb-1.5">
                  <span className="text-slate-500">{getTranslation('mobile', lang)}</span>
                  <span className="text-slate-800 font-medium">{record.mobile}</span>
                </div>
              )}

              {record.uniqueId && record.uniqueId !== 'N/A' && (
                <div className="flex items-baseline justify-between border-b border-slate-100 pb-1.5">
                  <span className="text-slate-500">{getTranslation('uniqueIdLabel', lang)}</span>
                  <span className="text-slate-800 font-medium">{record.uniqueId}</span>
                </div>
              )}

              <div className="flex items-baseline justify-between border-b border-slate-100 pb-1.5">
                <span className="text-slate-500">{getTranslation('mode', lang)}</span>
                <span className="text-purple-900 font-semibold">{record.paymentMethod}</span>
              </div>

              {record.transactionId && record.transactionId !== 'N/A' && (
                <div className="flex items-baseline justify-between border-b border-slate-100 pb-1.5">
                  <span className="text-slate-500">{getTranslation('txnIdLabel', lang)}</span>
                  <span className="font-mono text-slate-800 text-[11px]">{record.transactionId}</span>
                </div>
              )}

              {record.notes && (
                <div className="text-slate-600 text-[11px] italic pt-1">
                  Remark: {record.notes}
                </div>
              )}
            </div>

            {/* Highlighted Amount Box */}
            <div className="my-3 p-3 bg-purple-50 rounded-lg border border-purple-200 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-purple-800 uppercase font-bold tracking-wider block">
                  {getTranslation('amountReceived', lang)}
                </span>
                <span className="text-xs text-slate-600 italic mt-0.5 block">
                  {words}
                </span>
              </div>
              <div className="text-xl sm:text-2xl font-black text-purple-950 font-sans tracking-tight">
                ₹{formatIndianCurrency(record.amount)}
              </div>
            </div>

            {/* Footer Blessing & Signature */}
            <div className="pt-2 text-center">
              <p className="text-[11px] text-slate-600 italic">
                "{getTranslation('receiptGratitude', lang)}"
              </p>

              <div className="mt-6 flex items-end justify-between text-[11px] text-slate-600 px-2">
                <div className="text-center">
                  <div className="w-20 border-b border-slate-400 mb-1"></div>
                  <span>Devotee Sign</span>
                </div>
                <div className="text-center">
                  <div className="w-24 border-b border-purple-900 mb-1"></div>
                  <strong className="text-purple-950 block">{getTranslation('authorizedSignatory', lang)}</strong>
                  <span className="text-[9px] text-slate-400">Treasurer / President</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Share feedback banner */}
        {shareFeedback && (
          <div className="px-4 py-2 bg-emerald-50 dark:bg-emerald-950/60 border-t border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{shareFeedback}</span>
          </div>
        )}

        {/* Modal Bottom Actions */}
        <div className="no-print p-3 sm:p-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col sm:flex-row items-center gap-2">
          {/* Main WhatsApp + PDF Share Button */}
          <button
            onClick={handleShareWhatsAppPdf}
            disabled={isSharingPdf}
            className="w-full sm:flex-1 py-2.5 px-3 bg-gradient-to-r from-[#16A34A] to-[#15803D] hover:from-[#15803D] hover:to-[#166534] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-95 disabled:opacity-50"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>{isSharingPdf ? 'Sharing PDF...' : 'WhatsApp + PDF रसीद भेजें'}</span>
          </button>

          {/* Download PDF button */}
          <button
            onClick={handleDownloadPdf}
            className="w-full sm:w-auto py-2.5 px-3 bg-purple-50 dark:bg-purple-950/40 hover:bg-purple-100 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95"
          >
            <FileDown className="w-3.5 h-3.5" />
            <span>डाउनलोड PDF</span>
          </button>

          {/* Print button */}
          <button
            onClick={handlePrint}
            className="w-full sm:w-auto py-2.5 px-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>प्रिंट</span>
          </button>

          <button
            onClick={onClose}
            className="w-full sm:w-auto py-2.5 px-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold cursor-pointer text-center"
          >
            {getTranslation('close', lang)}
          </button>
        </div>
      </div>
    </div>
  );
};
