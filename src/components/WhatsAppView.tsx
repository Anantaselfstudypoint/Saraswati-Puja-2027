import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  MessageCircle,
  Send,
  User,
  Phone,
  Sparkles,
  Copy,
  Check,
  FileDown,
  Share2,
  CheckCircle2,
  AlertCircle,
  Users,
  Search,
  CheckSquare,
  Square,
  RefreshCw,
  ExternalLink,
  Volume2,
  ArrowRight,
  SkipForward
} from 'lucide-react';
import { CollectionRecord, Language } from '../types';
import { getTranslation } from '../utils/i18n';
import { formatIndianCurrency } from '../utils/numberToWords';
import { createReceiptPdf, shareReceiptWithPdf } from '../utils/receiptPdf';

interface WhatsAppViewProps {
  collections: CollectionRecord[];
  initialRecord?: CollectionRecord | null;
  lang: Language;
}

type SingleTemplateType = 'received' | 'thankyou' | 'request';
type BulkTemplateType = 'pushpanjali' | 'appeal' | 'visarjan' | 'meeting' | 'thankall' | 'custom';

interface QueueContact {
  id: string;
  name: string;
  phone: string;
  amount?: number;
  receiptNumber?: string;
  status: 'pending' | 'sent' | 'skipped';
}

export const WhatsAppView: React.FC<WhatsAppViewProps> = ({
  collections,
  initialRecord,
  lang,
}) => {
  // Mode selection: 'single' (individual receipt + PDF) or 'bulk' (mass message / notes)
  const [activeSubTab, setActiveSubTab] = useState<'single' | 'bulk'>('single');

  // ================= SINGLE MODE STATE =================
  const [selectedDonorId, setSelectedDonorId] = useState<string>(initialRecord?.id || '');
  const [recipientName, setRecipientName] = useState<string>(initialRecord?.name || '');
  const [recipientMobile, setRecipientMobile] = useState<string>(initialRecord?.mobile || '');
  const [singleTemplate, setSingleTemplate] = useState<SingleTemplateType>('received');
  const [singleMessage, setSingleMessage] = useState<string>('');
  const [singleCopied, setSingleCopied] = useState(false);
  const [isSharingPdf, setIsSharingPdf] = useState(false);
  const [statusNotification, setStatusNotification] = useState<{ text: string; type: 'success' | 'info' } | null>(null);

  // ================= BULK MODE STATE =================
  const [selectedDonorIds, setSelectedDonorIds] = useState<Set<string>>(new Set());
  const [donorSearch, setDonorSearch] = useState('');
  const [customPhonesText, setCustomPhonesText] = useState('');
  const [showCustomPhoneInput, setShowCustomPhoneInput] = useState(false);
  const [bulkTemplate, setBulkTemplate] = useState<BulkTemplateType>('pushpanjali');
  const [bulkMessageText, setBulkMessageText] = useState('');
  const [numbersCopied, setNumbersCopied] = useState(false);
  const [groupNoticeCopied, setGroupNoticeCopied] = useState(false);

  // Queue state for Progressive Dispatcher
  const [queue, setQueue] = useState<QueueContact[]>([]);
  const [currentQueueIndex, setCurrentQueueIndex] = useState(0);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync when initialRecord changes
  useEffect(() => {
    if (initialRecord) {
      setSelectedDonorId(initialRecord.id);
      setRecipientName(initialRecord.name);
      setRecipientMobile(initialRecord.mobile === 'N/A' ? '' : initialRecord.mobile);
      setActiveSubTab('single');
    }
  }, [initialRecord]);

  // Handle donor selection change in single mode
  const handleDonorSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setSelectedDonorId(id);
    const rec = collections.find((c) => c.id === id);
    if (rec) {
      setRecipientName(rec.name);
      setRecipientMobile(rec.mobile === 'N/A' ? '' : rec.mobile);
    } else {
      setRecipientName('');
      setRecipientMobile('');
    }
  };

  // Generate Single Message Text
  const generateSingleMessage = (template: SingleTemplateType): string => {
    const rec = collections.find((c) => c.id === selectedDonorId);
    const name = recipientName.trim() || (lang === 'hi' ? 'श्रद्धेय भक्त' : 'Devotee');
    const amount = rec ? `₹${formatIndianCurrency(rec.amount)}` : '₹____';
    const receiptNo = rec ? rec.receiptNumber : 'SP2027-____';
    const date = rec ? rec.date : new Date().toISOString().split('T')[0];
    const mode = rec ? rec.paymentMethod : 'Cash/UPI';

    if (lang === 'hi') {
      if (template === 'received') {
        return `🪔 *श्री श्री सरस्वती पूजा समिति २०२७* 🪔\n|| ॐ ऐं सरस्वत्यै नमः ||\n\nआदरणीय *${name}* जी,\n\nसादर प्रणाम। सरस्वती पूजा २०२७ के पावन अवसर पर आपके द्वारा प्रदान किया गया आर्थिक सहयोग हमें सधन्यवाद प्राप्त हुआ है। आपकी आधिकारिक दान रसीद PDF इस संदेश के साथ संलग्न है।\n\n📜 *रसीद विवरण:*\n• रसीद संख्या: *${receiptNo}*\n• प्राप्त राशि: *${amount}*\n• भुगतान माध्यम: ${mode}\n• तारीख: ${date}\n\nमाँ सरस्वती की कृपा से आपके जीवन में ज्ञान, विद्या, उत्तम स्वास्थ्य एवं सुख-समृद्धि का वास हो! 🙏\n\nसस्नेह,\n*पूजा व्यवस्था समिति २०२७*`;
      }
      if (template === 'thankyou') {
        return `🌸 *हार्दिक आभार एवं आमंत्रण - सरस्वती पूजा २०२७* 🌸\n\nआदरणीय *${name}* जी,\n\nसरस्वती पूजा २०२७ के भव्य आयोजन में आपके अमूल्य सहयोग *${amount}* (रसीद: ${receiptNo}) के लिए पूरी समिति आपकी हृदय से आभारी है।\n\nआप सपरिवार पूजा, पुष्पांजलि एवं महाभोग प्रसाद वितरण में सादर आमंत्रित हैं। आपकी रसीद प्रतिलिपि PDF रूप में उपलब्ध है।\n\n📅 तारीख: बसंत पंचमी २०२७\n📍 स्थान: मुख्य पूजा पंडाल\n\nसादर,\n*श्री श्री सरस्वती पूजा समिति २०२७* 🙏`;
      }
      return `🪔 *विनम्र निवेदन - सरस्वती पूजा २०२७* 🪔\n\nआदरणीय *${name}* जी,\n\nहर वर्ष की भांति इस वर्ष भी हमारे क्षेत्र में *सरस्वती पूजा २०२७* का आयोजन अत्यंत श्रद्धा एवं उल्लास के साथ किया जा रहा है।\n\nइस पुनीत एवं धार्मिक आयोजन को भव्य व सफल बनाने हेतु आपके अमूल्य सहयोग एवं चंदा राशि की विनम्र प्रतीक्षा है।\n\nआप नकद अथवा यूपीआई (UPI) के माध्यम से अपना पावन सहयोग प्रदान कर सकते हैं। सहयोग के उपरांत आधिकारिक डिजिटल रसीद PDF तुरंत प्रदान की जाएगी।\n\nविनीत,\n*समस्त कार्यकर्ता, सरस्वती पूजा समिति २०२७* 🪔`;
    }

    // English templates
    if (template === 'received') {
      return `🪔 *Saraswati Puja Samiti 2027* 🪔\n|| Om Aim Saraswatyai Namah ||\n\nDear *${name}*,\n\nThank you for your generous contribution towards Saraswati Puja 2027. We gratefully acknowledge receipt of your donation. Your official donation receipt PDF is attached with this message.\n\n📜 *Receipt Details:*\n• Receipt No: *${receiptNo}*\n• Amount Received: *${amount}*\n• Payment Mode: ${mode}\n• Date: ${date}\n\nMay Goddess Saraswati shower wisdom, peace, and prosperity upon you and your loved ones! 🙏\n\nWarm regards,\n*Organizing Committee, Saraswati Puja 2027*`;
    }
    if (template === 'thankyou') {
      return `🌸 *Heartfelt Gratitude & Puja Invitation* 🌸\n\nDear *${name}*,\n\nThank you very much for supporting our community with your kind donation of *${amount}* (Receipt: ${receiptNo}).\n\nWe warmly invite you and your family to attend the auspicious Saraswati Puja, Pushpanjali, and Mahaprasad distribution.\n\n📅 Date: Vasant Panchami 2027\n📍 Venue: Main Puja Pandal\n\nWith best wishes,\n*Saraswati Puja Samiti 2027* 🙏`;
    }
    return `🪔 *Donation Appeal - Saraswati Puja 2027* 🪔\n\nDear *${name}*,\n\nOur committee is joyfully organizing the grand celebration of Saraswati Puja 2027. We cordially request your kind support and contribution to make this auspicious celebration a grand success.\n\nOfficial PDF receipts are provided instantly for all contributions via Cash, UPI, and Online transfers.\n\nWarm regards,\n*Saraswati Puja Samiti 2027* 🪔`;
  };

  useEffect(() => {
    setSingleMessage(generateSingleMessage(singleTemplate));
  }, [singleTemplate, selectedDonorId, recipientName, lang]);

  // Generate Bulk Template Content
  const generateBulkTemplate = (template: BulkTemplateType): string => {
    if (lang === 'hi') {
      switch (template) {
        case 'pushpanjali':
          return `🌸 *पावन आमंत्रण: सरस्वती पूजा पुष्पांजलि एवं महाभोग २०२७* 🌸\n|| ॐ ऐं सरस्वत्यै नमः ||\n\nआदरणीय *{name}* जी,\n\nमाँ शारदा के पावन जन्मोत्सव *सरस्वती पूजा २०२७* के शुभ अवसर पर आप सपरिवार सादर आमंत्रित हैं।\n\n📜 *पूजा एवं कार्यक्रम विवरण:*\n• 🪔 प्रातः पूजा एवं संकल्प: प्रातः ०८:३० बजे\n• 🌸 सामूहिक पुष्पांजलि: प्रातः १०:३० बजे एवं १२:०० बजे\n• 🍲 महाप्रसाद वितरण: दोपहर १२:३० बजे से\n• 🎶 शाम की महाआरती एवं भजन: संध्या ०६:३० बजे\n📍 *स्थान:* मुख्य पूजा पंडाल परिसर\n\nकृपया सपरिवार पधारकर माँ सरस्वती का पावन आशीर्वाद ग्रहण करें।\n\nविनीत,\n*श्री श्री सरस्वती पूजा समिति २०२७* 🙏`;
        case 'appeal':
          return `🪔 *पुनीत सहयोग अपील: सरस्वती पूजा २०२७* 🪔\n|| विद्या ददाति विनयं ||\n\nआदरणीय *{name}* जी,\n\nसादर प्रणाम। प्रतिवर्ष की तरह इस वर्ष भी हम सभी मिलकर *सरस्वती पूजा २०२७* का आयोजन अत्यंत हर्ष एवं भक्तिभाव से करने जा रहे हैं।\n\nइस धार्मिक व सांस्कृतिक महोत्सव को गरिमामय एवं भव्य रूप देने हेतु आपके अमूल्य आर्थिक सहयोग (चंदा) की सादर प्रार्थना है।\n\n💳 आप नकद, यूपीआई (UPI) या ऑनलाइन माध्यम से अपना पावन अंशदान दे सकते हैं।\n📜 प्रत्येक सहयोग के लिए डिजिटल व PDF रसीद तुरंत प्रदान की जाती है।\n\nमाँ शारदे आपके परिवार में विद्या, सुख एवं समृद्धि का वास करें!\n\nसस्नेह,\n*समस्त पदाधिकारी एवं कार्यकर्ता, सरस्वती पूजा समिति २०२७*`;
        case 'visarjan':
          return `🥁 *भव्य विसर्जन शोभायात्रा एवं विदाई सूचना* 🥁\n\nआदरणीय *{name}* जी,\n\nमाँ सरस्वती की पावन प्रतिमा का *विसर्जन एवं विदाई शोभायात्रा* का कार्यक्रम नियत समय पर आयोजित किया जाएगा।\n\n📅 *शोभायात्रा प्रारंभ:* दोपहर ०२:३० बजे से\n🚩 *रूट:* मुख्य पूजा पंडाल से पवित्र सरोवर / घाट\n\nआप सभी माता-बहनों व युवाओं से सादर अनुरोध है कि शांतिपूर्ण एवं भक्तिमय माहौल में माँ को विदाई देने हेतु शोभायात्रा में सम्मिलित हों।\n\n*"माँ सरस्वती की जय!"* 🙏\n\nआयोजक,\n*सरस्वती पूजा समिति २०२७*`;
        case 'meeting':
          return `📢 *अति आवश्यक बैठक सूचना - सरस्वती पूजा समिति २०२७* 📢\n\nआदरणीय सदस्य *{name}* जी,\n\nआगामी सरस्वती पूजा महोत्सव के सफल संचालन, पंडाल निर्माण, प्रसाद व्यवस्था, वित्त समीक्षा एवं कार्यकर्ताओं के दायित्व विभाजन हेतु समिति की एक विशेष बैठक बुलाई गई है।\n\n📅 *दिनांक:* आगामी रविवार\n⏰ *समय:* सायं ०७:०० बजे\n📍 *स्थान:* पूजा समिति कार्यालय / पंडाल परिसर\n\nआपकी उपस्थिति अति अनिवार्य है। कृपया समय पर पधारकर अपने महत्वपूर्ण सुझाव दें।\n\nधन्यवाद,\n*सचिव / अध्यक्ष, पूजा समिति २०२७*`;
        case 'thankall':
          return `🙏 *समिति की ओर से हार्दिक आभार एवं साधुवाद* 🙏\n\nआदरणीय *{name}* जी,\n\nसरस्वती पूजा २०२७ के पावन उत्सव में आपके द्वारा प्रदान किए गए पावन सहयोग *{amount}* (रसीद सं. *{receipt}*) के लिए समिति आपकी हृदय से आभारी है।\n\nआपके जैसे धर्मप्रेमी सज्जनों के सहयोग से ही यह वृहद आयोजन सानंद संपन्न हो सका। माँ सरस्वती आपके जीवन में ज्ञान और प्रगति का प्रकाश फैलाएं!\n\nकृतज्ञता सहित,\n*श्री श्री सरस्वती पूजा समिति २०२७* 🌸`;
        case 'custom':
        default:
          return `🪔 *सूचना - श्री श्री सरस्वती पूजा समिति २०२७* 🪔\n\nआदरणीय *{name}* जी,\n\nसादर प्रणाम। सरस्वती पूजा २०२७ के संबंध में आवश्यक सूचना:\n\n[यहाँ अपना संदेश या विवरण लिखें]\n\nअधिक जानकारी हेतु समिति के पदाधिकारियों से संपर्क करें।\n\nभवदीय,\n*सरस्वती पूजा समिति २०२७*`;
      }
    }

    // English templates
    switch (template) {
      case 'pushpanjali':
        return `🌸 *Auspicious Invitation: Saraswati Puja 2027* 🌸\n|| Om Aim Saraswatyai Namah ||\n\nDear *{name}*,\n\nWe cordially invite you and your family to celebrate the divine festival of *Saraswati Puja 2027*.\n\n📜 *Schedule of Rituals:*\n• 🪔 Morning Puja: 08:30 AM\n• 🌸 Pushpanjali & Floral Offerings: 10:30 AM & 12:00 PM\n• 🍲 Mahaprasad Feast: 12:30 PM onwards\n• 🎶 Evening Aarti & Bhajans: 06:30 PM\n📍 *Venue:* Main Puja Pandal\n\nPlease grace the occasion and receive the blessings of Maa Saraswati.\n\nWarm regards,\n*Saraswati Puja Samiti 2027* 🙏`;
      case 'appeal':
        return `🪔 *Heartfelt Donation Appeal - Saraswati Puja 2027* 🪔\n\nDear *{name}*,\n\nOur community is preparing for the grand celebration of *Saraswati Puja 2027*. We warmly appeal for your generous support and contribution to make this spiritual celebration a resounding success.\n\nContributions are welcome via Cash, UPI, and Online transfers with instant official PDF receipts issued.\n\nMay Goddess Saraswati bless your family with wisdom and abundance!\n\nYours faithfully,\n*Organizing Committee, Saraswati Puja 2027*`;
      case 'visarjan':
        return `🥁 *Immersion Procession Notice - Saraswati Puja 2027* 🥁\n\nDear *{name}*,\n\nThe auspicious *Murti Visarjan Shobhayatra* (Immersion Procession) will commence as per schedule.\n\n📅 *Time:* 02:30 PM onwards\n🚩 *Route:* Main Puja Pandal to River Ghat\n\nAll devotees and youth are cordially requested to join the peaceful and devotional procession.\n\nBest regards,\n*Saraswati Puja Committee 2027* 🙏`;
      case 'meeting':
        return `📢 *Urgent Committee Meeting - Saraswati Puja 2027* 📢\n\nDear Member *{name}*,\n\nAn essential planning and logistics meeting is scheduled to finalize pandal decoration, financial audit, and volunteer roles.\n\n📅 *Date:* Upcoming Sunday\n⏰ *Time:* 07:00 PM\n📍 *Location:* Puja Committee Office\n\nYour presence and valuable inputs are warmly requested.\n\nWarm regards,\n*Executive Board, Saraswati Puja 2027*`;
      case 'thankall':
        return `🙏 *Heartfelt Thanks for Your Contribution* 🙏\n\nDear *{name}*,\n\nOur sincere gratitude for your gracious donation of *{amount}* (Receipt No: *{receipt}*) towards Saraswati Puja 2027. Your valuable backing made this grand devotional celebration possible.\n\nWith warm wishes,\n*Saraswati Puja Samiti 2027* 🌸`;
      case 'custom':
      default:
        return `🪔 *Announcement: Saraswati Puja Samiti 2027* 🪔\n\nDear *{name}*,\n\nGreetings! Important update regarding Saraswati Puja 2027:\n\n[Write your custom message or announcement here]\n\nWarm regards,\n*Saraswati Puja Samiti 2027*`;
    }
  };

  useEffect(() => {
    setBulkMessageText(generateBulkTemplate(bulkTemplate));
  }, [bulkTemplate, lang]);

  // Donors with valid phone numbers
  const validDonors = useMemo(() => {
    return collections.filter((c) => {
      const clean = c.mobile.replace(/\D/g, '');
      return clean.length >= 10;
    });
  }, [collections]);

  // Filtered donor list for search
  const displayedDonors = useMemo(() => {
    if (!donorSearch.trim()) return validDonors;
    const q = donorSearch.toLowerCase().trim();
    return validDonors.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.mobile.includes(q) ||
        c.receiptNumber.toLowerCase().includes(q)
    );
  }, [validDonors, donorSearch]);

  // Initialize all donors selected by default once donors exist
  useEffect(() => {
    if (validDonors.length > 0 && selectedDonorIds.size === 0) {
      const initialSet = new Set(validDonors.map((d) => d.id));
      setSelectedDonorIds(initialSet);
    }
  }, [validDonors]);

  // Build the progressive queue whenever selection or custom phones change
  useEffect(() => {
    const list: QueueContact[] = [];

    // 1. Add selected donors
    for (const donor of validDonors) {
      if (selectedDonorIds.has(donor.id)) {
        list.push({
          id: donor.id,
          name: donor.name,
          phone: donor.mobile.replace(/\D/g, ''),
          amount: donor.amount,
          receiptNumber: donor.receiptNumber,
          status: 'pending',
        });
      }
    }

    // 2. Add custom pasted phone numbers
    if (customPhonesText.trim()) {
      const matches = customPhonesText.match(/(\+?91[\-\s]?)?[6-9]\d{9}/g) || [];
      const seen = new Set<string>();
      matches.forEach((m, idx) => {
        const clean = m.replace(/\D/g, '').slice(-10);
        if (clean.length === 10 && !seen.has(clean) && !list.some((c) => c.phone.slice(-10) === clean)) {
          seen.add(clean);
          list.push({
            id: `custom_${idx}_${clean}`,
            name: lang === 'hi' ? 'भक्तजन / सदस्य' : 'Devotee / Member',
            phone: clean,
            status: 'pending',
          });
        }
      });
    }

    setQueue(list);
    setCurrentQueueIndex(0);
  }, [selectedDonorIds, customPhonesText, validDonors, lang]);

  // Queue Statistics
  const totalQueueCount = queue.length;
  const sentCount = queue.filter((c) => c.status === 'sent').length;
  const progressPercent = totalQueueCount > 0 ? Math.round((sentCount / totalQueueCount) * 100) : 0;

  // Active contact currently targeted by dispatcher
  const activeContact = queue[currentQueueIndex] || null;

  // Helper to personalize message for a specific contact
  const formatPersonalizedMessage = (contact: QueueContact | null): string => {
    if (!contact) return bulkMessageText;
    const name = contact.name || (lang === 'hi' ? 'श्रद्धेय भक्त' : 'Devotee');
    const amount = contact.amount ? `₹${formatIndianCurrency(contact.amount)}` : '₹____';
    const receipt = contact.receiptNumber || 'SP2027-____';
    const today = new Date().toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

    return bulkMessageText
      .replace(/{name}/g, name)
      .replace(/{amount}/g, amount)
      .replace(/{receipt}/g, receipt)
      .replace(/{date}/g, today);
  };

  const advanceToNextPending = (startIdx: number) => {
    for (let i = startIdx; i < queue.length; i++) {
      if (queue[i].status === 'pending') {
        setCurrentQueueIndex(i);
        return;
      }
    }
    // If none after, wrap to any pending
    for (let i = 0; i < queue.length; i++) {
      if (queue[i].status === 'pending') {
        setCurrentQueueIndex(i);
        return;
      }
    }
    // All completed
    setCurrentQueueIndex(queue.length);
  };

  // Dispatch Next Contact
  const handleSendNextContact = () => {
    if (!activeContact) return;

    const rawNumber = activeContact.phone.replace(/\D/g, '');
    const phone = rawNumber.length === 10 ? `91${rawNumber}` : rawNumber;
    const msg = formatPersonalizedMessage(activeContact);

    // Copy to clipboard as safety net
    try {
      navigator.clipboard.writeText(msg);
    } catch {
      // ignore
    }

    // Open WhatsApp
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');

    // Mark current contact as 'sent'
    setQueue((prev) =>
      prev.map((item, idx) => (idx === currentQueueIndex ? { ...item, status: 'sent' } : item))
    );

    // Advance cursor to next pending contact
    advanceToNextPending(currentQueueIndex + 1);
  };

  // Skip Contact
  const handleSkipContact = () => {
    if (!activeContact) return;
    setQueue((prev) =>
      prev.map((item, idx) => (idx === currentQueueIndex ? { ...item, status: 'skipped' } : item))
    );
    advanceToNextPending(currentQueueIndex + 1);
  };

  // Reset Queue
  const handleResetQueue = () => {
    setQueue((prev) => prev.map((item) => ({ ...item, status: 'pending' })));
    setCurrentQueueIndex(0);
  };

  // Insert Variable Tag into textarea
  const handleInsertTag = (tag: string) => {
    if (!textareaRef.current) {
      setBulkMessageText((prev) => prev + ` ${tag} `);
      return;
    }
    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
    const text = bulkMessageText;
    const updated = text.substring(0, start) + tag + text.substring(end);
    setBulkMessageText(updated);
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(start + tag.length, start + tag.length);
      }
    }, 50);
  };

  // Copy All Numbers (Broadcast List format)
  const handleCopyAllNumbers = () => {
    const numbers = queue.map((c) => c.phone.replace(/\D/g, '').slice(-10)).filter((p) => p.length === 10);
    const unique = Array.from(new Set(numbers));
    const text = unique.join(', ');
    navigator.clipboard.writeText(text);
    setNumbersCopied(true);
    setTimeout(() => setNumbersCopied(false), 2500);
  };

  // Copy Generic Announcement for WhatsApp Groups
  const handleCopyGroupNotice = () => {
    const cleanNotice = bulkMessageText
      .replace(/{name}/g, lang === 'hi' ? 'समस्त धर्मप्रेमी भक्तजनों' : 'Dear Devotees')
      .replace(/{amount}/g, '')
      .replace(/{receipt}/g, '');
    navigator.clipboard.writeText(cleanNotice);
    setGroupNoticeCopied(true);
    setTimeout(() => setGroupNoticeCopied(false), 2500);
  };

  // Toggle Single Donor selection
  const toggleDonorSelection = (id: string) => {
    setSelectedDonorIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Select All Donors
  const selectAllDonors = () => {
    setSelectedDonorIds(new Set(validDonors.map((d) => d.id)));
  };

  // Deselect All
  const deselectAllDonors = () => {
    setSelectedDonorIds(new Set());
  };

  // Filter Online only
  const selectOnlineOnly = () => {
    const onlineIds = validDonors.filter((d) => d.paymentMethod !== 'Cash').map((d) => d.id);
    setSelectedDonorIds(new Set(onlineIds));
  };

  // Filter Cash only
  const selectCashOnly = () => {
    const cashIds = validDonors.filter((d) => d.paymentMethod === 'Cash').map((d) => d.id);
    setSelectedDonorIds(new Set(cashIds));
  };

  // ================= SINGLE MODE SEND ACTIONS =================
  const handleSendWithPdf = async () => {
    const rawNumber = recipientMobile.replace(/\D/g, '');
    if (rawNumber.length < 10) {
      alert(lang === 'hi' ? 'कृपया 10 अंकों का वैध मोबाइल नंबर दर्ज करें।' : 'Please enter a valid 10-digit mobile number.');
      return;
    }

    const currentRecord = collections.find((c) => c.id === selectedDonorId) || {
      id: `manual_${Date.now()}`,
      receiptNumber: `SP2027-${Math.floor(1000 + Math.random() * 9000)}`,
      name: recipientName.trim() || 'Devotee',
      amount: 501,
      mobile: recipientMobile,
      uniqueId: 'N/A',
      paymentMethod: 'Cash' as const,
      date: new Date().toISOString().split('T')[0],
      transactionId: 'N/A',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setIsSharingPdf(true);
    setStatusNotification(null);

    const result = await shareReceiptWithPdf(currentRecord, singleMessage, lang);
    setIsSharingPdf(false);

    if (result.method === 'native-share') {
      setStatusNotification({
        text: lang === 'hi' ? 'WhatsApp शेयर विंडो आधिकारिक PDF रसीद के साथ खुल गई है!' : 'WhatsApp share sheet opened with PDF receipt attached!',
        type: 'success',
      });
    } else {
      setStatusNotification({
        text: lang === 'hi' ? 'PDF रसीद डाउनलोड हो गई है और WhatsApp चैट खुल गई है! कृपया चैट में डाउनलोड की गई PDF को अटैच करें।' : 'Receipt PDF downloaded & WhatsApp chat opened! Please attach the downloaded PDF in WhatsApp.',
        type: 'info',
      });
    }
  };

  const handleDownloadPdfOnly = () => {
    const currentRecord = collections.find((c) => c.id === selectedDonorId);
    if (!currentRecord) {
      alert(lang === 'hi' ? 'कृपया सूची से दानदाता चुनें।' : 'Please select a donor from the list to generate their official PDF receipt.');
      return;
    }
    const doc = createReceiptPdf(currentRecord, lang);
    doc.save(`Saraswati_Puja_Receipt_${currentRecord.receiptNumber}.pdf`);
  };

  const handleSendSingleTextOnly = () => {
    const rawNumber = recipientMobile.replace(/\D/g, '');
    if (rawNumber.length < 10) {
      alert(lang === 'hi' ? 'कृपया 10 अंकों का वैध मोबाइल नंबर दर्ज करें।' : 'Please enter a valid 10-digit mobile number.');
      return;
    }
    const phone = rawNumber.length === 10 ? `91${rawNumber}` : rawNumber;
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(singleMessage)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-4 pb-20 pt-2 animate-fadeIn">
      {/* Top Main Mode Switcher */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-1.5 flex gap-1">
        <button
          type="button"
          onClick={() => setActiveSubTab('single')}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeSubTab === 'single'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <FileDown className="w-4 h-4" />
          <span>{getTranslation('singleModeTab', lang)}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('bulk')}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer relative ${
            activeSubTab === 'bulk'
              ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>{getTranslation('bulkModeTab', lang)}</span>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-amber-400 text-slate-900 font-extrabold uppercase tracking-wider ml-1">
            Bulk
          </span>
        </button>
      </div>

      {/* ======================= 1. SINGLE DONOR & PDF MODE ======================= */}
      {activeSubTab === 'single' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 sm:p-6 space-y-4">
          {/* Header */}
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <MessageCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                {getTranslation('whatsappCenter', lang)}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {lang === 'hi'
                  ? 'दानदाता को आधिकारिक PDF रसीद और धन्यवाद संदेश सीधे WhatsApp पर भेजें'
                  : 'Send personalized official receipts & PDF documents directly on WhatsApp'}
              </p>
            </div>
          </div>

          {/* Member Dropdown Picker */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
              {getTranslation('selectDonor', lang)}
            </label>
            <select
              value={selectedDonorId}
              onChange={handleDonorSelect}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
            >
              <option value="">{getTranslation('orEnterManual', lang)}</option>
              {collections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} — ₹{c.amount} ({c.receiptNumber}) {c.mobile !== 'N/A' ? `• ${c.mobile}` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Recipient Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                {getTranslation('recipientName', lang)}
              </label>
              <input
                type="text"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="e.g. Ramesh Kumar"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Phone className="w-3.5 h-3.5 text-emerald-600" />
                {getTranslation('whatsappMobile', lang)} <span className="text-rose-500">*</span>
              </label>
              <input
                type="tel"
                value={recipientMobile}
                onChange={(e) => setRecipientMobile(e.target.value)}
                placeholder="10-digit mobile number"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
              />
            </div>
          </div>

          {/* Template Selector Chips */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              {getTranslation('messageTemplate', lang)}
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setSingleTemplate('received')}
                className={`p-2.5 rounded-xl text-xs font-semibold text-left transition-all border cursor-pointer ${
                  singleTemplate === 'received'
                    ? 'bg-purple-50 dark:bg-purple-950/60 border-purple-500 text-purple-800 dark:text-purple-300 shadow-sm'
                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                }`}
              >
                {getTranslation('templateReceived', lang)}
              </button>

              <button
                type="button"
                onClick={() => setSingleTemplate('thankyou')}
                className={`p-2.5 rounded-xl text-xs font-semibold text-left transition-all border cursor-pointer ${
                  singleTemplate === 'thankyou'
                    ? 'bg-purple-50 dark:bg-purple-950/60 border-purple-500 text-purple-800 dark:text-purple-300 shadow-sm'
                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                }`}
              >
                {getTranslation('templateThankyou', lang)}
              </button>

              <button
                type="button"
                onClick={() => setSingleTemplate('request')}
                className={`p-2.5 rounded-xl text-xs font-semibold text-left transition-all border cursor-pointer ${
                  singleTemplate === 'request'
                    ? 'bg-purple-50 dark:bg-purple-950/60 border-purple-500 text-purple-800 dark:text-purple-300 shadow-sm'
                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                }`}
              >
                {getTranslation('templateRequest', lang)}
              </button>
            </div>
          </div>

          {/* Message Preview & Edit */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                {getTranslation('messagePreview', lang)}
              </label>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(singleMessage);
                  setSingleCopied(true);
                  setTimeout(() => setSingleCopied(false), 2000);
                }}
                className="text-xs text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                {singleCopied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{singleCopied ? 'Copied' : 'Copy Text'}</span>
              </button>
            </div>
            <textarea
              rows={7}
              value={singleMessage}
              onChange={(e) => setSingleMessage(e.target.value)}
              className="w-full px-3.5 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-purple-50/20 dark:bg-slate-800/80 text-slate-900 dark:text-white text-xs sm:text-sm font-sans focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all leading-relaxed"
            />
          </div>

          {/* Status Alert */}
          {statusNotification && (
            <div
              className={`p-3 rounded-xl text-xs flex items-start gap-2.5 ${
                statusNotification.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border border-emerald-300'
                  : 'bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-200 border border-blue-300'
              }`}
            >
              {statusNotification.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              )}
              <span className="leading-relaxed">{statusNotification.text}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-2.5 pt-1">
            <button
              type="button"
              disabled={isSharingPdf}
              onClick={handleSendWithPdf}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-[#16A34A] to-[#15803D] hover:from-[#15803D] hover:to-[#166534] text-white font-bold text-sm rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98 disabled:opacity-50"
            >
              <Share2 className="w-4 h-4" />
              <span>
                {isSharingPdf
                  ? (lang === 'hi' ? 'तैयार हो रहा है... (Generating...)' : 'Generating PDF & Share...')
                  : (lang === 'hi' ? 'WhatsApp पर PDF + टेक्स्ट भेजें (Send PDF & Text)' : 'Send PDF Receipt & Text on WhatsApp')}
              </span>
            </button>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleSendSingleTextOnly}
                className="py-2.5 px-3 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <Send className="w-3.5 h-3.5 text-emerald-600" />
                <span>{lang === 'hi' ? 'WhatsApp चैट खोलें (टेक्स्ट संदेश)' : 'Open WhatsApp Chat (Text Only)'}</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadPdfOnly}
                className="py-2.5 px-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <FileDown className="w-3.5 h-3.5 text-purple-600" />
                <span>{lang === 'hi' ? 'PDF रसीद डाउनलोड करें' : 'Download PDF Receipt'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================= 2. BULK MESSAGE & NOTES DISPATCHER ======================= */}
      {activeSubTab === 'bulk' && (
        <div className="space-y-4">
          {/* Card 1: Template & Note Editor */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 sm:p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <Volume2 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                    {getTranslation('bulkModeTab', lang)}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {getTranslation('bulkNotesSubtitle', lang)}
                  </p>
                </div>
              </div>

              {/* Quick Actions Header Pills */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyGroupNotice}
                  className="px-2.5 py-1.5 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 dark:text-emerald-300 text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer transition-all"
                  title="Copy formatted notice to paste in WhatsApp Groups"
                >
                  {groupNoticeCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{groupNoticeCopied ? 'Copied Notice!' : (lang === 'hi' ? 'ग्रुप सूचना कॉपी' : 'Copy Group Notice')}</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyAllNumbers}
                  className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer transition-all"
                  title="Copy all phone numbers for WhatsApp Broadcast"
                >
                  {numbersCopied ? <Check className="w-3.5 h-3.5 text-purple-600" /> : <Phone className="w-3.5 h-3.5" />}
                  <span>{numbersCopied ? 'Copied Numbers!' : (lang === 'hi' ? 'नंबर कॉपी' : 'Copy Numbers')}</span>
                </button>
              </div>
            </div>

            {/* Template Selection Chips */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                {lang === 'hi' ? 'सूचना / संदेश टेम्पलेट चुनें' : 'Choose Note / Notice Template'}
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { key: 'pushpanjali', label: getTranslation('templatePushpanjali', lang) },
                  { key: 'appeal', label: getTranslation('templateRequest', lang) },
                  { key: 'visarjan', label: getTranslation('templateVisarjan', lang) },
                  { key: 'meeting', label: getTranslation('templateMeeting', lang) },
                  { key: 'thankall', label: getTranslation('templateThankyou', lang) },
                  { key: 'custom', label: getTranslation('templateCustomNote', lang) },
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setBulkTemplate(item.key as BulkTemplateType)}
                    className={`p-2.5 rounded-xl text-xs font-semibold text-left transition-all border cursor-pointer truncate ${
                      bulkTemplate === item.key
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-emerald-800 dark:text-emerald-300 shadow-sm'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    <span className="truncate block">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Variable Tags Toolbar */}
            <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center gap-2 flex-wrap text-xs">
              <span className="text-slate-600 dark:text-slate-400 font-semibold flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-500" />
                {getTranslation('insertTagTooltip', lang)}
              </span>
              {[
                { tag: '{name}', label: lang === 'hi' ? '👤 नाम {name}' : '👤 Name {name}' },
                { tag: '{amount}', label: lang === 'hi' ? '💰 राशि {amount}' : '💰 Amount {amount}' },
                { tag: '{receipt}', label: lang === 'hi' ? '📜 रसीद सं. {receipt}' : '📜 Receipt {receipt}' },
                { tag: '{date}', label: lang === 'hi' ? '📅 तारीख {date}' : '📅 Date {date}' },
              ].map((item) => (
                <button
                  key={item.tag}
                  type="button"
                  onClick={() => handleInsertTag(item.tag)}
                  className="px-2 py-1 rounded-md bg-white dark:bg-slate-700 hover:bg-purple-50 dark:hover:bg-purple-950 border border-slate-300 dark:border-slate-600 text-purple-700 dark:text-purple-300 font-mono text-[11px] font-bold cursor-pointer transition-all shadow-xs"
                >
                  {item.label}
                </button>
              ))}
            </div>

            {/* Editable Bulk Textarea */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  {lang === 'hi' ? 'संदेश एवं सूचना प्रारूप (प्रत्यक्ष संपादन योग्य)' : 'Message & Notice Body (Directly Editable)'}
                </label>
                <div className="text-[11px] text-slate-500">
                  {bulkMessageText.length} characters
                </div>
              </div>
              <textarea
                ref={textareaRef}
                rows={7}
                value={bulkMessageText}
                onChange={(e) => setBulkMessageText(e.target.value)}
                className="w-full px-3.5 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-emerald-50/20 dark:bg-slate-800/80 text-slate-900 dark:text-white text-xs sm:text-sm font-sans focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all leading-relaxed"
              />
            </div>
          </div>

          {/* Card 2: Progressive 1-Click Dispatcher */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-950 text-white rounded-2xl p-4 sm:p-6 shadow-md border border-slate-800 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <span className="text-emerald-400 font-extrabold text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                  <Send className="w-3.5 h-3.5" />
                  {getTranslation('dispatcherTitle', lang)}
                </span>
                <h3 className="text-base sm:text-lg font-bold">
                  {lang === 'hi' ? '1-क्लिक क्रमबद्ध संदेश प्रेषक' : '1-Click Progressive WhatsApp Sender'}
                </h3>
              </div>

              {/* Progress Counters */}
              <div className="flex items-center gap-2 text-xs">
                <span className="px-2 py-1 bg-emerald-950/80 border border-emerald-700 text-emerald-300 rounded-lg font-bold">
                  {lang === 'hi' ? `भेजे गए: ${sentCount}` : `Sent: ${sentCount}`}
                </span>
                <span className="px-2 py-1 bg-slate-800 border border-slate-700 text-slate-300 rounded-lg">
                  {lang === 'hi' ? `कुल: ${totalQueueCount}` : `Total: ${totalQueueCount}`}
                </span>
                <button
                  type="button"
                  onClick={handleResetQueue}
                  className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
                  title="Reset Queue"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Visual Progress Bar */}
            <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
              <div
                className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full transition-all duration-300 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* Active Contact Target Card */}
            {activeContact ? (
              <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-full bg-emerald-600/30 text-emerald-400 font-bold flex items-center justify-center text-sm border border-emerald-500/30">
                      {currentQueueIndex + 1}
                    </div>
                    <div>
                      <div className="font-bold text-sm sm:text-base text-white flex items-center gap-2">
                        <span>{activeContact.name}</span>
                        {activeContact.receiptNumber && (
                          <span className="text-[11px] font-mono px-1.5 py-0.2 bg-purple-900/60 text-purple-300 border border-purple-700 rounded">
                            {activeContact.receiptNumber}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-emerald-400 flex items-center gap-1 mt-0.5">
                        <Phone className="w-3 h-3" />
                        <span>+91 {activeContact.phone}</span>
                        {activeContact.amount && (
                          <span className="text-slate-400 ml-1">
                            • दान: ₹{formatIndianCurrency(activeContact.amount)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    {lang === 'hi' ? 'अगला संदेश' : 'Next in Queue'}
                  </span>
                </div>

                {/* Personalized Message Preview for this contact */}
                <div className="p-3 bg-slate-900/80 border border-slate-700/80 rounded-lg text-xs font-mono text-slate-300 max-h-32 overflow-y-auto leading-relaxed whitespace-pre-line">
                  {formatPersonalizedMessage(activeContact)}
                </div>

                {/* Primary Send & Skip Buttons */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleSendNextContact}
                    className="flex-1 py-3 px-4 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-extrabold text-sm rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                  >
                    <Send className="w-4 h-4" />
                    <span>
                      {lang === 'hi'
                        ? `WhatsApp पर भेजें (${activeContact.name.split(' ')[0]})`
                        : `Send to ${activeContact.name.split(' ')[0]} via WhatsApp`}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={handleSkipContact}
                    className="py-3 px-3 bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                    title="Skip this contact and move to next"
                  >
                    <SkipForward className="w-3.5 h-3.5" />
                    <span>{getTranslation('skipContact', lang)}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-6 text-center space-y-2">
                <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
                <h4 className="font-bold text-white text-base">
                  {totalQueueCount > 0
                    ? (lang === 'hi' ? 'शानदार! सभी संदेश सफलतापूर्वक भेजे गए।' : 'All selected contacts sent!')
                    : (lang === 'hi' ? 'कोई संपर्क चयनित नहीं है।' : 'No contacts selected in queue.')}
                </h4>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  {lang === 'hi'
                    ? 'नीचे दिए गए प्राप्तकर्ता सूची से दानदाताओं को चुनें या अन्य मोबाइल नंबर जोड़ें।'
                    : 'Select donors from the list below or paste additional phone numbers.'}
                </p>
                {totalQueueCount > 0 && (
                  <button
                    type="button"
                    onClick={handleResetQueue}
                    className="mt-2 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg cursor-pointer transition-all inline-flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>{lang === 'hi' ? 'कतार पुनः प्रारंभ करें (Restart Queue)' : 'Restart Queue'}</span>
                  </button>
                )}
              </div>
            )}

            {/* Broadcast Direct Link */}
            <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
              <span>
                💡 {lang === 'hi' ? 'सुरक्षित तरीका: ब्राउज़र स्पैम से बचाव हेतु यह 1-क्लिक से अगला संदेश खोलता है।' : 'Anti-spam friendly: safely sends 1-by-1 with single tap.'}
              </span>
              <a
                href="https://web.whatsapp.com/"
                target="_blank"
                rel="noreferrer"
                className="text-emerald-400 hover:underline flex items-center gap-1"
              >
                <span>WhatsApp Web</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          {/* Card 3: Audience Selector & Contact List */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 sm:p-6 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-purple-600" />
                <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                  {getTranslation('audienceSelection', lang)} ({selectedDonorIds.size} / {validDonors.length})
                </h3>
              </div>

              {/* Quick Filter Buttons */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={selectAllDonors}
                  className="px-2 py-1 bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300 text-xs font-semibold rounded-lg hover:bg-purple-100 cursor-pointer"
                >
                  {getTranslation('selectAll', lang)}
                </button>
                <button
                  type="button"
                  onClick={deselectAllDonors}
                  className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-semibold rounded-lg hover:bg-slate-200 cursor-pointer"
                >
                  {getTranslation('deselectAll', lang)}
                </button>
                <button
                  type="button"
                  onClick={selectOnlineOnly}
                  className="px-2 py-1 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-xs font-semibold rounded-lg hover:bg-blue-100 cursor-pointer"
                >
                  {getTranslation('filterOnlineOnly', lang)}
                </button>
                <button
                  type="button"
                  onClick={selectCashOnly}
                  className="px-2 py-1 bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 text-xs font-semibold rounded-lg hover:bg-amber-100 cursor-pointer"
                >
                  {getTranslation('filterCashOnly', lang)}
                </button>
              </div>
            </div>

            {/* Custom Numbers Accordion Toggle */}
            <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{getTranslation('pasteCustomNumbers', lang)}</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowCustomPhoneInput(!showCustomPhoneInput)}
                  className="text-xs text-purple-600 dark:text-purple-400 font-semibold hover:underline cursor-pointer"
                >
                  {showCustomPhoneInput ? (lang === 'hi' ? 'छुपाएं' : 'Hide') : (lang === 'hi' ? '+ अन्य नंबर जोड़ें' : '+ Add Custom Numbers')}
                </button>
              </div>

              {showCustomPhoneInput && (
                <div className="mt-2 space-y-1.5">
                  <textarea
                    rows={3}
                    value={customPhonesText}
                    onChange={(e) => setCustomPhonesText(e.target.value)}
                    placeholder={getTranslation('customNumbersPlaceholder', lang)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <p className="text-[11px] text-slate-500">
                    {lang === 'hi'
                      ? 'आप समिति सदस्यों या गैर-दानदाताओं के 10 अंकों के मोबाइल नंबर यहाँ पेस्ट कर सकते हैं।'
                      : 'Paste raw 10-digit mobile numbers separated by commas, spaces, or lines.'}
                  </p>
                </div>
              )}
            </div>

            {/* Search Donors Filter */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={donorSearch}
                onChange={(e) => setDonorSearch(e.target.value)}
                placeholder={lang === 'hi' ? 'दानदाताओं में खोजें (नाम, मोबाइल, रसीद सं.)...' : 'Search donors to toggle...'}
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            {/* Checkbox List of Donors */}
            <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1 divide-y divide-slate-100 dark:divide-slate-800">
              {displayedDonors.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-400">
                  {lang === 'hi' ? 'कोई वैध मोबाइल नंबर वाले दानदाता नहीं मिले।' : 'No donors with valid mobile numbers found.'}
                </div>
              ) : (
                displayedDonors.map((donor) => {
                  const isChecked = selectedDonorIds.has(donor.id);
                  const queueItem = queue.find((q) => q.id === donor.id);
                  return (
                    <div
                      key={donor.id}
                      onClick={() => toggleDonorSelection(donor.id)}
                      className={`pt-2 pb-1.5 px-2.5 rounded-lg flex items-center justify-between cursor-pointer transition-colors ${
                        isChecked
                          ? 'bg-purple-50/50 dark:bg-purple-950/30'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="text-purple-600 dark:text-purple-400">
                          {isChecked ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4 text-slate-400" />}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                            <span>{donor.name}</span>
                            <span className="text-[10px] text-slate-500 font-mono">({donor.receiptNumber})</span>
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                            <Phone className="w-3 h-3 text-emerald-500" />
                            <span>{donor.mobile}</span>
                            <span>• ₹{formatIndianCurrency(donor.amount)}</span>
                            <span className="text-[10px] px-1 bg-slate-100 dark:bg-slate-800 rounded">
                              {donor.paymentMethod}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Status indicator if in active queue */}
                      {queueItem && (
                        <div>
                          {queueItem.status === 'sent' && (
                            <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 rounded text-[10px] font-bold">
                              ✓ {lang === 'hi' ? 'भेजा गया' : 'Sent'}
                            </span>
                          )}
                          {queueItem.status === 'skipped' && (
                            <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded text-[10px]">
                              {lang === 'hi' ? 'छोड़ा' : 'Skipped'}
                            </span>
                          )}
                          {queueItem.status === 'pending' && isChecked && (
                            <span className="px-2 py-0.5 bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 rounded text-[10px]">
                              {lang === 'hi' ? 'लंबित' : 'Pending'}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
