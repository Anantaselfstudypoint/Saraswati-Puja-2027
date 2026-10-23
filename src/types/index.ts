export type PaymentMethod = 'Cash' | 'UPI' | 'Online';

export type ExpenseCategory =
  | 'Idol (Pratima)'
  | 'Pandal & Decor'
  | 'Puja Samagri'
  | 'Prasad & Bhog'
  | 'Sound & Light'
  | 'Priest & Rituals'
  | 'Cultural Event'
  | 'Other';

export interface CollectionRecord {
  id: string;
  receiptNumber: string;
  name: string;
  amount: number;
  mobile: string;
  uniqueId: string; // Flat, Ward, Member ID or Village/Colony
  paymentMethod: PaymentMethod;
  date: string; // YYYY-MM-DD
  transactionId: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  syncedToSheets?: boolean;
}

export interface ExpenseRecord {
  id: string;
  name: string;
  amount: number;
  date: string; // YYYY-MM-DD
  category: ExpenseCategory;
  paymentMethod: PaymentMethod;
  paidBy: string; // Committee Member name
  notes?: string;
  createdAt: string;
  updatedAt: string;
  syncedToSheets?: boolean;
}

export type Language = 'en' | 'hi';
export type Theme = 'light' | 'dark';
export type TabType = 'dashboard' | 'add' | 'records' | 'expenses' | 'whatsapp' | 'reports';

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

export interface SheetsConfig {
  webhookUrl: string;
  spreadsheetId: string;
  lastSyncedAt?: string;
}
