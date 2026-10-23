import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  getDocFromServer,
  collection,
  onSnapshot,
  setDoc,
  deleteDoc,
  getDocs,
  writeBatch,
  Firestore
} from 'firebase/firestore';
import { auth } from './googleAuth';
import firebaseConfig from '../../firebase-applet-config.json';
import { CollectionRecord, ExpenseRecord } from '../types';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// CRITICAL: Initialize Firestore using the provisioned firestoreDatabaseId
export const db: Firestore = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId);

// Validate Connection on Boot
export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase client is offline, using offline persistence.');
    }
    return false;
  }
}
testConnection();

// Live listener for collections
export function subscribeToCollections(
  onUpdate: (collections: CollectionRecord[]) => void
) {
  const path = 'puja2027_collections';
  return onSnapshot(
    collection(db, path),
    (snapshot) => {
      const records: CollectionRecord[] = [];
      snapshot.forEach((docSnap) => {
        records.push(docSnap.data() as CollectionRecord);
      });
      // Sort newest first
      records.sort((a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime());
      onUpdate(records);
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

// Live listener for expenses
export function subscribeToExpenses(
  onUpdate: (expenses: ExpenseRecord[]) => void
) {
  const path = 'puja2027_expenses';
  return onSnapshot(
    collection(db, path),
    (snapshot) => {
      const records: ExpenseRecord[] = [];
      snapshot.forEach((docSnap) => {
        records.push(docSnap.data() as ExpenseRecord);
      });
      // Sort newest first
      records.sort((a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime());
      onUpdate(records);
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

// Write Collection to Cloud Firestore
export async function saveCollectionToFirestore(record: CollectionRecord): Promise<void> {
  const path = `puja2027_collections/${record.id}`;
  try {
    await setDoc(doc(db, 'puja2027_collections', record.id), record);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

// Delete Collection from Cloud Firestore
export async function deleteCollectionFromFirestore(id: string): Promise<void> {
  const path = `puja2027_collections/${id}`;
  try {
    await deleteDoc(doc(db, 'puja2027_collections', id));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

// Write Expense to Cloud Firestore
export async function saveExpenseToFirestore(record: ExpenseRecord): Promise<void> {
  const path = `puja2027_expenses/${record.id}`;
  try {
    await setDoc(doc(db, 'puja2027_expenses', record.id), record);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

// Delete Expense from Cloud Firestore
export async function deleteExpenseFromFirestore(id: string): Promise<void> {
  const path = `puja2027_expenses/${id}`;
  try {
    await deleteDoc(doc(db, 'puja2027_expenses', id));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

// Clear all collections from Cloud Firestore
export async function clearAllCollectionsFromFirestore(): Promise<void> {
  const path = 'puja2027_collections';
  try {
    const snap = await getDocs(collection(db, path));
    if (snap.empty) return;
    const batch = writeBatch(db);
    snap.docs.forEach((docSnap) => {
      batch.delete(docSnap.ref);
    });
    await batch.commit();
  } catch (err) {
    console.warn('Failed to clear collections from Firestore:', err);
  }
}

// Clear all expenses from Cloud Firestore
export async function clearAllExpensesFromFirestore(): Promise<void> {
  const path = 'puja2027_expenses';
  try {
    const snap = await getDocs(collection(db, path));
    if (snap.empty) return;
    const batch = writeBatch(db);
    snap.docs.forEach((docSnap) => {
      batch.delete(docSnap.ref);
    });
    await batch.commit();
  } catch (err) {
    console.warn('Failed to clear expenses from Firestore:', err);
  }
}

