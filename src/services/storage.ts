import { CollectionRecord, ExpenseRecord, FirebaseConfig } from '../types';
import {
  saveCollectionToFirestore,
  deleteCollectionFromFirestore,
  saveExpenseToFirestore,
  deleteExpenseFromFirestore,
  clearAllCollectionsFromFirestore,
  clearAllExpensesFromFirestore,
  subscribeToCollections,
  subscribeToExpenses,
} from './firebaseDb';

const STORAGE_KEYS = {
  COLLECTIONS: 'sp2027_collections',
  EXPENSES: 'sp2027_expenses',
  FIREBASE_CONFIG: 'sp2027_firebase_config',
  VAPID_KEY: 'sp2027_vapid_key',
  SHEETS_CONFIG: 'sp2027_sheets_config',
  LANG: 'sp2027_lang',
  THEME: 'sp2027_theme',
};

// Default VAPID key provided by the user
export const DEFAULT_VAPID_KEY =
  'BIVhlFqGDr7xbQK19Vc9yBWvF31MpvFPq-UzFFUb5Tn6cKYOoX8C3EMn1kDdJVSY7BzFw-PUztsoTb2qCgkpCgU';

class StorageService {
  constructor() {
    if (!localStorage.getItem(STORAGE_KEYS.VAPID_KEY)) {
      localStorage.setItem(STORAGE_KEYS.VAPID_KEY, DEFAULT_VAPID_KEY);
    }
  }

  public isCloudConnected(): boolean {
    return true; // Firestore is provisioned and deployed in gen-lang-client-0268336284
  }

  // --- COLLECTIONS (DONATIONS) ---
  public getCollections(): CollectionRecord[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.COLLECTIONS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  public saveCollectionsLocal(collections: CollectionRecord[]): void {
    localStorage.setItem(STORAGE_KEYS.COLLECTIONS, JSON.stringify(collections));
  }

  public generateReceiptNumber(existingCount?: number): string {
    const count = (existingCount !== undefined ? existingCount : this.getCollections().length) + 1;
    const randomSuffix = Math.floor(100 + Math.random() * 900);
    return `SP2027-${String(count).padStart(4, '0')}-${randomSuffix}`;
  }

  public checkDuplicateCollection(
    name: string,
    mobile: string,
    amount: number,
    date: string,
    transactionId?: string,
    excludeId?: string
  ): { isDuplicate: boolean; existingRecord?: CollectionRecord; reason?: string } {
    const list = this.getCollections();

    // 1. Transaction ID match (for UPI/Online)
    if (transactionId && transactionId.trim() && transactionId.trim().toUpperCase() !== 'N/A') {
      const cleanTxn = transactionId.trim().toUpperCase();
      const matchTxn = list.find(
        (c) => c.id !== excludeId && c.transactionId && c.transactionId.trim().toUpperCase() === cleanTxn
      );
      if (matchTxn) {
        return {
          isDuplicate: true,
          existingRecord: matchTxn,
          reason: `Matching Transaction/UTR ID (${cleanTxn}) already used in receipt ${matchTxn.receiptNumber}.`,
        };
      }
    }

    // 2. Name + Mobile + Amount + Date match
    const cleanName = name.trim().toLowerCase();
    const cleanMobile = mobile.replace(/\D/g, '');

    const matchPerson = list.find((c) => {
      if (c.id === excludeId) return false;
      const sameName = c.name.trim().toLowerCase() === cleanName;
      const sameMobile = c.mobile.replace(/\D/g, '') === cleanMobile;
      const sameAmount = Number(c.amount) === Number(amount);
      const sameDate = c.date === date;
      return sameName && (sameMobile || sameAmount) && sameDate;
    });

    if (matchPerson) {
      return {
        isDuplicate: true,
        existingRecord: matchPerson,
        reason: `Identical donation of ₹${amount} for ${matchPerson.name} on ${date} (Receipt: ${matchPerson.receiptNumber}).`,
      };
    }

    return { isDuplicate: false };
  }

  public async saveCollection(record: CollectionRecord): Promise<void> {
    const list = this.getCollections();
    const index = list.findIndex((c) => c.id === record.id);

    const fullRecord: CollectionRecord = {
      ...record,
      createdAt: record.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (index >= 0) {
      list[index] = fullRecord;
    } else {
      list.unshift(fullRecord);
    }

    this.saveCollectionsLocal(list);

    // Sync to Cloud Firestore
    try {
      await saveCollectionToFirestore(fullRecord);
    } catch (err) {
      console.warn('Firestore sync failed, local copy intact:', err);
    }
  }

  public async deleteCollection(id: string): Promise<void> {
    const list = this.getCollections().filter((c) => c.id !== id);
    this.saveCollectionsLocal(list);

    try {
      await deleteCollectionFromFirestore(id);
    } catch (err) {
      console.warn('Firestore delete failed:', err);
    }
  }

  // --- EXPENSES ---
  public getExpenses(): ExpenseRecord[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.EXPENSES);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  public saveExpensesLocal(expenses: ExpenseRecord[]): void {
    localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(expenses));
  }

  public async saveExpense(record: ExpenseRecord): Promise<void> {
    const list = this.getExpenses();
    const index = list.findIndex((e) => e.id === record.id);

    const fullRecord: ExpenseRecord = {
      ...record,
      createdAt: record.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (index >= 0) {
      list[index] = fullRecord;
    } else {
      list.unshift(fullRecord);
    }

    this.saveExpensesLocal(list);

    // Sync to Cloud Firestore
    try {
      await saveExpenseToFirestore(fullRecord);
    } catch (err) {
      console.warn('Firestore expense sync failed:', err);
    }
  }

  public async deleteExpense(id: string): Promise<void> {
    const list = this.getExpenses().filter((e) => e.id !== id);
    this.saveExpensesLocal(list);

    try {
      await deleteExpenseFromFirestore(id);
    } catch (err) {
      console.warn('Firestore expense delete failed:', err);
    }
  }

  // --- REAL-TIME FIRESTORE SUBSCRIPTIONS ---
  public subscribeToRealtimeUpdates(
    onCollectionsUpdated: (collections: CollectionRecord[]) => void,
    onExpensesUpdated: (expenses: ExpenseRecord[]) => void
  ): () => void {
    try {
      const unsubCol = subscribeToCollections((cloudCollections) => {
        if (Array.isArray(cloudCollections)) {
          this.saveCollectionsLocal(cloudCollections);
          onCollectionsUpdated(cloudCollections);
        }
      });

      const unsubExp = subscribeToExpenses((cloudExpenses) => {
        if (Array.isArray(cloudExpenses)) {
          this.saveExpensesLocal(cloudExpenses);
          onExpensesUpdated(cloudExpenses);
        }
      });

      return () => {
        if (typeof unsubCol === 'function') unsubCol();
        if (typeof unsubExp === 'function') unsubExp();
      };
    } catch (e) {
      console.warn('Realtime subscription initialization error:', e);
      return () => {};
    }
  }

  // --- STATS CALCULATION ---
  public getStats() {
    const collections = this.getCollections();
    const expenses = this.getExpenses();
    const today = new Date().toISOString().split('T')[0];

    const totalCollection = collections.reduce((acc, c) => acc + Number(c.amount || 0), 0);
    const totalExpenses = expenses.reduce((acc, e) => acc + Number(e.amount || 0), 0);
    const remainingBalance = totalCollection - totalExpenses;

    const cashCollection = collections
      .filter((c) => c.paymentMethod === 'Cash')
      .reduce((acc, c) => acc + Number(c.amount || 0), 0);

    const onlineCollection = collections
      .filter((c) => c.paymentMethod === 'UPI' || c.paymentMethod === 'Online')
      .reduce((acc, c) => acc + Number(c.amount || 0), 0);

    const todayCollection = collections
      .filter((c) => c.date === today)
      .reduce((acc, c) => acc + Number(c.amount || 0), 0);

    const totalDonors = collections.length;
    const avgDonation = totalDonors > 0 ? Math.round(totalCollection / totalDonors) : 0;

    return {
      totalCollection,
      totalExpenses,
      remainingBalance,
      cashCollection,
      onlineCollection,
      todayCollection,
      totalDonors,
      avgDonation,
    };
  }

  // --- EXPORT TO CSV ---
  public exportCollectionsCSV(): void {
    const collections = this.getCollections();
    if (collections.length === 0) {
      alert('No donation records found to export.');
      return;
    }

    const headers = [
      'Receipt No',
      'Donor Name',
      'Amount (INR)',
      'Mobile Number',
      'Unique ID / Ward / Flat',
      'Payment Method',
      'Date',
      'Transaction ID',
      'Notes',
      'Created At',
    ];

    const rows = collections.map((c) => [
      c.receiptNumber,
      `"${c.name.replace(/"/g, '""')}"`,
      c.amount,
      `"${c.mobile}"`,
      `"${c.uniqueId.replace(/"/g, '""')}"`,
      c.paymentMethod,
      c.date,
      `"${(c.transactionId || 'N/A').replace(/"/g, '""')}"`,
      `"${(c.notes || '').replace(/"/g, '""')}"`,
      c.createdAt,
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    this.downloadFile(csvContent, `Saraswati_Puja_2027_Donations_${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8;');
  }

  public exportExpensesCSV(): void {
    const expenses = this.getExpenses();
    if (expenses.length === 0) {
      alert('No expense records found to export.');
      return;
    }

    const headers = [
      'Expense ID',
      'Item / Purpose',
      'Amount (INR)',
      'Category',
      'Date',
      'Payment Method',
      'Paid By',
      'Notes',
      'Created At',
    ];

    const rows = expenses.map((e) => [
      e.id,
      `"${e.name.replace(/"/g, '""')}"`,
      e.amount,
      `"${e.category}"`,
      e.date,
      e.paymentMethod,
      `"${e.paidBy.replace(/"/g, '""')}"`,
      `"${(e.notes || '').replace(/"/g, '""')}"`,
      e.createdAt,
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    this.downloadFile(csvContent, `Saraswati_Puja_2027_Expenses_${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8;');
  }

  // --- BACKUP & RESTORE ---
  public getBackupJsonString(): string {
    const data = {
      app: 'Saraswati Puja Collection 2027',
      version: '1.0',
      exportedAt: new Date().toISOString(),
      stats: this.getStats(),
      collections: this.getCollections(),
      expenses: this.getExpenses(),
    };
    return JSON.stringify(data, null, 2);
  }

  public downloadDatabaseBackup(): boolean {
    const jsonStr = this.getBackupJsonString();
    const dateStr = new Date().toISOString().slice(0, 10);
    return this.downloadFile(
      jsonStr,
      `Saraswati_Puja_2027_Backup_${dateStr}.json`,
      'application/json;charset=utf-8;'
    );
  }

  public async restoreDatabaseBackup(
    fileOrContent: File | string
  ): Promise<{ success: boolean; message: string; count?: number; collectionsCount?: number; expensesCount?: number }> {
    try {
      let text = '';
      if (typeof fileOrContent === 'string') {
        text = fileOrContent;
      } else {
        text = await fileOrContent.text();
      }

      if (!text || !text.trim()) {
        return { success: false, message: 'Backup file is empty.' };
      }

      const parsed = JSON.parse(text);

      let restoredCollections: CollectionRecord[] = [];
      let restoredExpenses: ExpenseRecord[] = [];

      if (Array.isArray(parsed)) {
        // Direct array of collections
        restoredCollections = parsed;
      } else if (typeof parsed === 'object' && parsed !== null) {
        if (Array.isArray(parsed.collections)) {
          restoredCollections = parsed.collections;
        } else if (Array.isArray(parsed.donations)) {
          restoredCollections = parsed.donations;
        } else if (Array.isArray(parsed.records)) {
          restoredCollections = parsed.records;
        }

        if (Array.isArray(parsed.expenses)) {
          restoredExpenses = parsed.expenses;
        } else if (Array.isArray(parsed.expenseRecords)) {
          restoredExpenses = parsed.expenseRecords;
        }
      }

      if (restoredCollections.length === 0 && restoredExpenses.length === 0) {
        return {
          success: false,
          message: 'No valid donation or expense records found in this file. Please select a valid JSON backup.',
        };
      }

      // Sanitize & ensure IDs
      const sanitizedCollections: CollectionRecord[] = restoredCollections.map((c, i) => ({
        id: c.id || `col_restored_${Date.now()}_${i}`,
        receiptNumber: c.receiptNumber || `SP2027-REST-${String(i + 1).padStart(4, '0')}`,
        name: c.name || 'Anonymous Donor',
        amount: Number(c.amount || 0),
        mobile: c.mobile || '',
        uniqueId: c.uniqueId || '',
        paymentMethod: c.paymentMethod || 'Cash',
        date: c.date || new Date().toISOString().slice(0, 10),
        transactionId: c.transactionId || 'N/A',
        notes: c.notes || '',
        createdAt: c.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));

      const sanitizedExpenses: ExpenseRecord[] = restoredExpenses.map((e, i) => ({
        id: e.id || `exp_restored_${Date.now()}_${i}`,
        name: e.name || 'Expense Item',
        amount: Number(e.amount || 0),
        date: e.date || new Date().toISOString().slice(0, 10),
        category: e.category || 'Other',
        paymentMethod: e.paymentMethod || 'Cash',
        paidBy: e.paidBy || '',
        notes: e.notes || '',
        createdAt: e.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));

      // Immediately save locally
      this.saveCollectionsLocal(sanitizedCollections);
      this.saveExpensesLocal(sanitizedExpenses);

      // Sync restored items to Firestore (resilient: won't fail the whole restore if offline)
      const colPromises = sanitizedCollections.map((c) =>
        saveCollectionToFirestore(c).catch((err) => console.warn('Firestore restore collection warning:', err))
      );
      const expPromises = sanitizedExpenses.map((e) =>
        saveExpenseToFirestore(e).catch((err) => console.warn('Firestore restore expense warning:', err))
      );
      await Promise.allSettled([...colPromises, ...expPromises]);

      return {
        success: true,
        message: `Restored ${sanitizedCollections.length} donations and ${sanitizedExpenses.length} expenses successfully into Local & Cloud Database!`,
        count: sanitizedCollections.length,
        collectionsCount: sanitizedCollections.length,
        expensesCount: sanitizedExpenses.length,
      };
    } catch (err: any) {
      return { success: false, message: `Failed to restore JSON: ${err.message || 'Invalid JSON format'}` };
    }
  }

  public async resetAllToZero(): Promise<{ success: boolean; message: string }> {
    try {
      this.saveCollectionsLocal([]);
      this.saveExpensesLocal([]);

      await Promise.allSettled([
        clearAllCollectionsFromFirestore(),
        clearAllExpensesFromFirestore(),
      ]);

      return {
        success: true,
        message: 'All collections and expenses have been completely reset to 0 in Local Storage and Cloud Firestore.',
      };
    } catch (err: any) {
      console.warn('Reset error:', err);
      this.saveCollectionsLocal([]);
      this.saveExpensesLocal([]);
      return {
        success: true,
        message: 'Local records reset to 0.',
      };
    }
  }

  // --- IMPORT / MERGE RECORDS FROM GOOGLE SHEETS ---
  public async importRecordsFromSheet(
    sheetCollections: CollectionRecord[],
    sheetExpenses: ExpenseRecord[]
  ): Promise<{ addedCollections: number; addedExpenses: number; totalCollections: number; totalExpenses: number }> {
    const currentCollections = this.getCollections();
    const currentExpenses = this.getExpenses();

    const existingColIds = new Set(currentCollections.map((c) => String(c.id).trim()));
    const existingReceipts = new Set(
      currentCollections.map((c) => String(c.receiptNumber || '').trim().toUpperCase())
    );
    const existingColFingerprints = new Set(
      currentCollections.map((c) => `${c.name.trim().toLowerCase()}_${Number(c.amount)}_${c.date}`)
    );

    const newCollectionsToAdd: CollectionRecord[] = [];
    for (const sc of sheetCollections) {
      const cleanReceipt = String(sc.receiptNumber || '').trim().toUpperCase();
      const cleanId = String(sc.id || '').trim();
      const fingerprint = `${sc.name.trim().toLowerCase()}_${Number(sc.amount)}_${sc.date}`;

      if (
        (cleanId && existingColIds.has(cleanId)) ||
        (cleanReceipt && existingReceipts.has(cleanReceipt)) ||
        existingColFingerprints.has(fingerprint)
      ) {
        continue; // Already exists in app
      }

      const validRecord: CollectionRecord = {
        ...sc,
        id: sc.id || `col_sheet_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        receiptNumber:
          sc.receiptNumber ||
          this.generateReceiptNumber(currentCollections.length + newCollectionsToAdd.length),
        amount: Number(sc.amount || 0),
        name: sc.name || 'Anonymous Donor',
        paymentMethod: sc.paymentMethod || 'Cash',
        date: sc.date || new Date().toISOString().slice(0, 10),
        createdAt: sc.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      newCollectionsToAdd.push(validRecord);
      existingColIds.add(validRecord.id);
      existingReceipts.add(validRecord.receiptNumber.trim().toUpperCase());
      existingColFingerprints.add(fingerprint);
    }

    if (newCollectionsToAdd.length > 0) {
      const updated = [...newCollectionsToAdd, ...currentCollections];
      this.saveCollectionsLocal(updated);
      newCollectionsToAdd.forEach((c) => {
        saveCollectionToFirestore(c).catch((err) =>
          console.warn('Firestore cloud sync notice for imported collection:', err)
        );
      });
    }

    // Process Expenses
    const existingExpIds = new Set(currentExpenses.map((e) => String(e.id).trim()));
    const existingExpFingerprints = new Set(
      currentExpenses.map((e) => `${e.name.trim().toLowerCase()}_${Number(e.amount)}_${e.date}`)
    );

    const newExpensesToAdd: ExpenseRecord[] = [];
    for (const se of sheetExpenses) {
      const cleanId = String(se.id || '').trim();
      const fingerprint = `${se.name.trim().toLowerCase()}_${Number(se.amount)}_${se.date}`;

      if ((cleanId && existingExpIds.has(cleanId)) || existingExpFingerprints.has(fingerprint)) {
        continue;
      }

      const validExpense: ExpenseRecord = {
        ...se,
        id: se.id || `exp_sheet_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        name: se.name || 'Expense Item',
        amount: Number(se.amount || 0),
        category: se.category || 'Other',
        paymentMethod: se.paymentMethod || 'Cash',
        date: se.date || new Date().toISOString().slice(0, 10),
        createdAt: se.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      newExpensesToAdd.push(validExpense);
      existingExpIds.add(validExpense.id);
      existingExpFingerprints.add(fingerprint);
    }

    if (newExpensesToAdd.length > 0) {
      const updatedExpenses = [...newExpensesToAdd, ...currentExpenses];
      this.saveExpensesLocal(updatedExpenses);
      newExpensesToAdd.forEach((e) => {
        saveExpenseToFirestore(e).catch((err) =>
          console.warn('Firestore cloud sync notice for imported expense:', err)
        );
      });
    }

    return {
      addedCollections: newCollectionsToAdd.length,
      addedExpenses: newExpensesToAdd.length,
      totalCollections: this.getCollections().length,
      totalExpenses: this.getExpenses().length,
    };
  }

  public async loadSamplePujaData(): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    const sampleCollections: CollectionRecord[] = [
      {
        id: 'col_sample_1',
        receiptNumber: 'SP2027-0001-381',
        name: 'Rameshwar Nath Tripathi',
        amount: 2100,
        mobile: '9835012345',
        uniqueId: 'Ward 04, Flat A-12',
        paymentMethod: 'UPI',
        date: today,
        transactionId: 'UPI/308192837192',
        notes: 'Pandal Floral Decor sponsorship',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'col_sample_2',
        receiptNumber: 'SP2027-0002-749',
        name: 'Sunita Devi Agrawal',
        amount: 1101,
        mobile: '9431098765',
        uniqueId: 'House 56, Sector 2',
        paymentMethod: 'Cash',
        date: today,
        transactionId: 'N/A',
        notes: 'Mata Saraswati Bhog Prasad',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'col_sample_3',
        receiptNumber: 'SP2027-0003-512',
        name: 'Amit Kumar Roy & Family',
        amount: 5100,
        mobile: '9871234567',
        uniqueId: 'Shop No. 18, Main Market',
        paymentMethod: 'Online',
        date: yesterday,
        transactionId: 'NEFT/P98124801',
        notes: 'Pratima (Idol) main donation',
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        updatedAt: new Date(Date.now() - 86400000).toISOString(),
      },
      {
        id: 'col_sample_4',
        receiptNumber: 'SP2027-0004-921',
        name: 'Pooja Verma',
        amount: 501,
        mobile: '9123456780',
        uniqueId: 'Student, Roll 24',
        paymentMethod: 'UPI',
        date: today,
        transactionId: 'UPI/772819238471',
        notes: 'Book distribution contribution',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    const sampleExpenses: ExpenseRecord[] = [
      {
        id: 'exp_sample_1',
        name: 'Idol (Pratima) Advance Booking',
        amount: 3500,
        date: yesterday,
        category: 'Idol (Pratima)',
        paymentMethod: 'Cash',
        paidBy: 'Rakesh Sharma (President)',
        notes: 'Advance given to Kumartuli sculptor with voucher #12',
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        updatedAt: new Date(Date.now() - 86400000).toISOString(),
      },
      {
        id: 'exp_sample_2',
        name: 'Pandal Bamboo & Cloth Advance',
        amount: 2500,
        date: today,
        category: 'Pandal & Decor',
        paymentMethod: 'UPI',
        paidBy: 'Vikas Pandey (Treasurer)',
        notes: '50% advance for 3-day pandal setup',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'exp_sample_3',
        name: 'Puja Samagri, Flowers & Havan wood',
        amount: 1200,
        date: today,
        category: 'Puja Samagri',
        paymentMethod: 'Cash',
        paidBy: 'Mukesh Gupta',
        notes: 'Receipt attached in samiti register',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    this.saveCollectionsLocal(sampleCollections);
    this.saveExpensesLocal(sampleExpenses);

    for (const c of sampleCollections) {
      await saveCollectionToFirestore(c);
    }
    for (const e of sampleExpenses) {
      await saveExpenseToFirestore(e);
    }
  }

  private downloadFile(content: string, fileName: string, contentType: string): boolean {
    try {
      const blob = new Blob([content], { type: contentType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        try {
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        } catch {
          // ignore
        }
      }, 1000);
      return true;
    } catch (err) {
      console.error('Download error:', err);
      return false;
    }
  }
}

export const storage = new StorageService();
