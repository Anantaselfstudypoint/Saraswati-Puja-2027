import { jsPDF } from 'jspdf';
import { CollectionRecord, Language } from '../types';
import { numberToWords, formatIndianCurrency } from './numberToWords';

export function createReceiptPdf(record: CollectionRecord, lang: Language = 'en'): jsPDF {
  // A5 size document (148mm x 210mm) - compact, mobile-friendly, printable
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a5',
  });

  const pageWidth = 148;
  const pageHeight = 210;
  const margin = 10;
  const contentWidth = pageWidth - margin * 2;

  // Background tint
  doc.setFillColor(253, 252, 255);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');

  // Outer border (Royal Purple)
  doc.setDrawColor(91, 33, 182);
  doc.setLineWidth(1.2);
  doc.rect(margin, margin, contentWidth, pageHeight - margin * 2);

  // Inner thin border
  doc.setDrawColor(216, 180, 254);
  doc.setLineWidth(0.4);
  doc.rect(margin + 2, margin + 2, contentWidth - 4, pageHeight - margin * 2 - 4);

  let y = margin + 10;

  // Invocation Mantra
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(91, 33, 182);
  doc.text('|| SHREE GANESHAYA NAMAH || || OM AIM SARASWATYAI NAMAH ||', pageWidth / 2, y, {
    align: 'center',
  });

  y += 7;

  // Header Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(76, 29, 149);
  doc.text('SARASWATI PUJA SAMITI 2027', pageWidth / 2, y, {
    align: 'center',
  });

  y += 5;

  // Subtitle
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(107, 114, 128);
  doc.text('OFFICIAL DONATION ACKNOWLEDGMENT RECEIPT', pageWidth / 2, y, {
    align: 'center',
  });

  y += 4;

  // Divider
  doc.setDrawColor(91, 33, 182);
  doc.setLineWidth(0.6);
  doc.line(margin + 6, y, pageWidth - margin - 6, y);

  y += 6;

  // Receipt Meta Row: Receipt Number & Date
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(55, 65, 81);
  doc.text('Receipt No:', margin + 6, y);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(91, 33, 182);
  doc.text(record.receiptNumber, margin + 28, y);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(55, 65, 81);
  doc.text('Date:', pageWidth - margin - 35, y);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(17, 24, 39);
  doc.text(record.date, pageWidth - margin - 23, y);

  y += 5;

  // Divider dashed
  doc.setDrawColor(229, 231, 235);
  doc.setLineWidth(0.3);
  doc.line(margin + 6, y, pageWidth - margin - 6, y);

  y += 8;

  // Details Table
  const drawRow = (label: string, value: string, isHighlight = false) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(107, 114, 128);
    doc.text(label, margin + 6, y);

    doc.setFont('helvetica', isHighlight ? 'bold' : 'normal');
    doc.setFontSize(9.5);
    if (isHighlight) {
      doc.setTextColor(76, 29, 149);
    } else {
      doc.setTextColor(17, 24, 39);
    }
    doc.text(value, margin + 50, y);

    y += 7;
  };

  drawRow('Donor / Member Name:', record.name, true);
  if (record.mobile && record.mobile !== 'N/A') {
    drawRow('Mobile Number:', record.mobile);
  }
  if (record.uniqueId && record.uniqueId !== 'N/A') {
    drawRow('Unique ID / Ward / Flat:', record.uniqueId);
  }
  drawRow('Payment Method:', record.paymentMethod);
  if (record.transactionId && record.transactionId !== 'N/A') {
    drawRow('Transaction / UTR ID:', record.transactionId);
  }
  if (record.notes) {
    drawRow('Remarks / Purpose:', record.notes);
  }

  y += 3;

  // Amount Highlight Box
  doc.setFillColor(245, 243, 255);
  doc.setDrawColor(196, 181, 253);
  doc.setLineWidth(0.5);
  doc.roundedRect(margin + 6, y, contentWidth - 12, 22, 2.5, 2.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(91, 33, 182);
  doc.text('AMOUNT RECEIVED', margin + 10, y + 6);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(76, 29, 149);
  doc.text(`INR ${formatIndianCurrency(record.amount)} /-`, pageWidth - margin - 10, y + 8, {
    align: 'right',
  });

  const words = numberToWords(record.amount, 'en');
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(75, 85, 99);
  doc.text(`In words: ${words}`, margin + 10, y + 16);

  y += 32;

  // Blessings Note
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(107, 114, 128);
  const blessing =
    '"May Goddess Saraswati bless you and your family with wisdom, prosperity, and joy!"';
  doc.text(blessing, pageWidth / 2, y, { align: 'center' });

  y += 24;

  // Signature Section
  doc.setDrawColor(156, 163, 175);
  doc.setLineWidth(0.4);

  // Left: Donor
  doc.line(margin + 10, y, margin + 45, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(107, 114, 128);
  doc.text('Donor Signature', margin + 17, y + 4);

  // Right: Authorized Signatory
  doc.line(pageWidth - margin - 50, y, pageWidth - margin - 10, y);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(76, 29, 149);
  doc.text('Authorized Signatory', pageWidth - margin - 47, y + 4);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(107, 114, 128);
  doc.text('Saraswati Puja Samiti 2027', pageWidth - margin - 46, y + 8);

  return doc;
}

export async function shareReceiptWithPdf(
  record: CollectionRecord,
  message: string,
  lang: Language = 'en'
): Promise<{ method: 'native-share' | 'download-and-whatsapp'; textCopied: boolean; error?: string }> {
  // Always copy message to clipboard so user can paste into WhatsApp if needed
  try {
    await navigator.clipboard.writeText(message);
  } catch (clipErr) {
    console.warn('Clipboard write ignored:', clipErr);
  }

  const cleanMobile = record.mobile.replace(/\D/g, '');
  const phone = cleanMobile.length === 10 ? `91${cleanMobile}` : cleanMobile;
  const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;

  try {
    const doc = createReceiptPdf(record, lang);
    const pdfBlob = doc.output('blob');
    const fileName = `Saraswati_Puja_Receipt_${record.receiptNumber}.pdf`;

    // Try Web Share API with File & Text (Supported on mobile Chrome/Safari)
    if (
      typeof navigator.canShare === 'function' &&
      navigator.canShare({ files: [new File([pdfBlob], fileName, { type: 'application/pdf' })] })
    ) {
      const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
      await navigator.share({
        files: [file],
        title: `Receipt ${record.receiptNumber}`,
        text: message,
      });
      return { method: 'native-share', textCopied: true };
    }

    // Fallback: Download PDF & Open WhatsApp with prefilled text message
    doc.save(fileName);
    window.open(waUrl, '_blank');
    return { method: 'download-and-whatsapp', textCopied: true };
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return { method: 'native-share', textCopied: true }; // User dismissed share sheet
    }
    try {
      const doc = createReceiptPdf(record, lang);
      doc.save(`Saraswati_Puja_Receipt_${record.receiptNumber}.pdf`);
      window.open(waUrl, '_blank');
      return { method: 'download-and-whatsapp', textCopied: true };
    } catch (saveErr: any) {
      window.open(waUrl, '_blank');
      return { method: 'download-and-whatsapp', textCopied: true, error: saveErr.message };
    }
  }
}
