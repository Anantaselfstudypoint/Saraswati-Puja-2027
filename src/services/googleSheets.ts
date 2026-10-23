import { CollectionRecord, ExpenseRecord } from '../types';

export const USER_SPREADSHEET_ID = '10YPNMN_4Usc-UL4NnLTWgYBhPceJFy2dfDzIKBlbrz8';
export const USER_SPREADSHEET_URL = `https://docs.google.com/spreadsheets/d/${USER_SPREADSHEET_ID}/edit`;

export interface SyncResult {
  success: boolean;
  message: string;
  donationsAdded: number;
  expensesAdded: number;
  spreadsheetTitle?: string;
  spreadsheetUrl: string;
}

export class GoogleSheetsApiService {
  private getHeaders(token: string) {
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  // 1. Fetch metadata to inspect tabs and spreadsheet name
  public async getSpreadsheetInfo(spreadsheetId: string, token: string) {
    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`, {
      headers: this.getHeaders(token),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Failed to fetch spreadsheet info (${res.status})`);
    }

    const data = await res.json();
    const sheetTitles = (data.sheets || []).map((s: any) => s.properties?.title as string);
    return {
      title: data.properties?.title || 'Saraswati Puja 2027 Sheet',
      sheets: sheetTitles,
    };
  }

  // 2. Ensure "Donations" and "Expenses" tabs exist with proper headers
  public async ensurePujaTabs(spreadsheetId: string, token: string) {
    const info = await this.getSpreadsheetInfo(spreadsheetId, token);
    const existingSheets = info.sheets;
    const requests: any[] = [];

    const needsDonations = !existingSheets.includes('Donations');
    const needsExpenses = !existingSheets.includes('Expenses');

    if (needsDonations) {
      requests.push({
        addSheet: {
          properties: {
            title: 'Donations',
            gridProperties: { frozenRowCount: 1 },
          },
        },
      });
    }

    if (needsExpenses) {
      requests.push({
        addSheet: {
          properties: {
            title: 'Expenses',
            gridProperties: { frozenRowCount: 1 },
          },
        },
      });
    }

    if (requests.length > 0) {
      const batchRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
        {
          method: 'POST',
          headers: this.getHeaders(token),
          body: JSON.stringify({ requests }),
        }
      );

      if (!batchRes.ok) {
        const err = await batchRes.json().catch(() => ({}));
        throw new Error(err.error?.message || 'Failed to create Donations/Expenses sheet tabs');
      }
    }

    // Check & write headers if row 1 is empty
    const donationHeaderCheck = await this.getValues(spreadsheetId, 'Donations!A1:B1', token);
    if (!donationHeaderCheck || donationHeaderCheck.length === 0 || !donationHeaderCheck[0] || donationHeaderCheck[0].length === 0) {
      await this.setValues(
        spreadsheetId,
        'Donations!A1:K1',
        [
          [
            'रसीद सं. (Receipt No)',
            'दानदाता का नाम (Donor Name)',
            'राशि (Amount ₹)',
            'मोबाइल नंबर (Mobile)',
            'पहचान / वार्ड / फ्लैट (ID/Ward)',
            'भुगतान माध्यम (Method)',
            'तारीख (Date)',
            'ट्रांजेक्शन ID (Txn/UTR)',
            'विवरण / नोट्स (Notes)',
            'सिंक समय (Synced At)',
            'रिकॉर्ड ID (Record ID)',
          ],
        ],
        token
      );
    }

    const expenseHeaderCheck = await this.getValues(spreadsheetId, 'Expenses!A1:B1', token);
    if (!expenseHeaderCheck || expenseHeaderCheck.length === 0 || !expenseHeaderCheck[0] || expenseHeaderCheck[0].length === 0) {
      await this.setValues(
        spreadsheetId,
        'Expenses!A1:I1',
        [
          [
            'खर्च का नाम (Expense Item)',
            'राशि (Amount ₹)',
            'श्रेणी (Category)',
            'भुगतान माध्यम (Method)',
            'भुगतानकर्ता (Paid By)',
            'तारीख (Date)',
            'विवरण / नोट्स (Notes)',
            'सिंक समय (Synced At)',
            'रिकॉर्ड ID (Record ID)',
          ],
        ],
        token
      );
    }

    return info.title;
  }

  // 3. Write exact range values via PUT
  private async setValues(spreadsheetId: string, range: string, values: any[][], token: string) {
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
        range
      )}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: this.getHeaders(token),
        body: JSON.stringify({ values }),
      }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Failed to update rows in ${range}`);
    }

    return await res.json();
  }

  // 4. Append values via sheets values.append API
  private async appendValues(spreadsheetId: string, range: string, values: any[][], token: string) {
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
        range
      )}:append?valueInputOption=USER_ENTERED`,
      {
        method: 'POST',
        headers: this.getHeaders(token),
        body: JSON.stringify({ values }),
      }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Failed to append rows to ${range}`);
    }

    return await res.json();
  }

  // 5. Read range values
  public async getValues(spreadsheetId: string, range: string, token: string): Promise<any[][]> {
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`,
      {
        headers: this.getHeaders(token),
      }
    );

    if (!res.ok) {
      return [];
    }

    const data = await res.json();
    return data.values || [];
  }

  // 6. Real-time Append Single Donation
  public async appendSingleDonation(
    donation: CollectionRecord,
    token: string,
    spreadsheetId: string = USER_SPREADSHEET_ID
  ): Promise<boolean> {
    try {
      await this.ensurePujaTabs(spreadsheetId, token);

      // Check if already present by Record ID (column K) or Receipt No (column A)
      const existingRows = await this.getValues(spreadsheetId, 'Donations!A:K', token);
      const isAlreadyAdded = existingRows.some(
        (r) => String(r[0] || '').trim() === donation.receiptNumber || String(r[10] || '').trim() === donation.id
      );

      if (isAlreadyAdded) {
        return true; // Already exists
      }

      const row = [
        donation.receiptNumber,
        donation.name,
        Number(donation.amount || 0),
        donation.mobile,
        donation.uniqueId || 'N/A',
        donation.paymentMethod,
        donation.date,
        donation.transactionId || 'N/A',
        donation.notes || '',
        new Date().toLocaleString('en-IN'),
        donation.id,
      ];

      await this.appendValues(spreadsheetId, 'Donations!A1', [row], token);
      return true;
    } catch (e) {
      console.warn('Could not append single donation to sheets:', e);
      throw e;
    }
  }

  // 7. Real-time Append Single Expense
  public async appendSingleExpense(
    expense: ExpenseRecord,
    token: string,
    spreadsheetId: string = USER_SPREADSHEET_ID
  ): Promise<boolean> {
    try {
      await this.ensurePujaTabs(spreadsheetId, token);

      // Check if already present by Record ID (column I)
      const existingRows = await this.getValues(spreadsheetId, 'Expenses!A:I', token);
      const isAlreadyAdded = existingRows.some((r) => String(r[8] || '').trim() === expense.id);

      if (isAlreadyAdded) {
        return true;
      }

      const row = [
        expense.name,
        Number(expense.amount || 0),
        expense.category,
        expense.paymentMethod,
        expense.paidBy,
        expense.date,
        expense.notes || '',
        new Date().toLocaleString('en-IN'),
        expense.id,
      ];

      await this.appendValues(spreadsheetId, 'Expenses!A1', [row], token);
      return true;
    } catch (e) {
      console.warn('Could not append single expense to sheets:', e);
      throw e;
    }
  }

  // 8. Complete Deduplicated Sync for Collections & Expenses
  public async syncAll(
    spreadsheetId: string,
    token: string,
    collections: CollectionRecord[],
    expenses: ExpenseRecord[],
    userConfirmed: boolean
  ): Promise<SyncResult> {
    if (!userConfirmed) {
      throw new Error('User confirmation is required before syncing data to Google Sheets.');
    }

    // Step A: Ensure tabs exist
    const title = await this.ensurePujaTabs(spreadsheetId, token);

    // Step B: Check existing IDs in Donations tab to avoid duplicates
    const existingDonationRows = await this.getValues(spreadsheetId, 'Donations!A:K', token);
    const existingDonationIds = new Set<string>();
    existingDonationRows.slice(1).forEach((r) => {
      const receiptNo = String(r[0] || '').trim();
      const recId = String(r[10] || '').trim();
      if (receiptNo) existingDonationIds.add(receiptNo);
      if (recId) existingDonationIds.add(recId);
    });

    const newDonationRows: any[][] = [];
    for (const c of collections) {
      if (!existingDonationIds.has(c.id) && !existingDonationIds.has(c.receiptNumber)) {
        newDonationRows.push([
          c.receiptNumber,
          c.name,
          Number(c.amount || 0),
          c.mobile,
          c.uniqueId || 'N/A',
          c.paymentMethod,
          c.date,
          c.transactionId || 'N/A',
          c.notes || '',
          new Date().toLocaleString('en-IN'),
          c.id,
        ]);
      }
    }

    if (newDonationRows.length > 0) {
      await this.appendValues(spreadsheetId, 'Donations!A1', newDonationRows, token);
    }

    // Step C: Check existing IDs in Expenses tab to avoid duplicates
    const existingExpenseRows = await this.getValues(spreadsheetId, 'Expenses!A:I', token);
    const existingExpenseIds = new Set<string>();
    existingExpenseRows.slice(1).forEach((r) => {
      const expId = String(r[8] || '').trim();
      if (expId) existingExpenseIds.add(expId);
    });

    const newExpenseRows: any[][] = [];
    for (const x of expenses) {
      if (!existingExpenseIds.has(x.id)) {
        newExpenseRows.push([
          x.name,
          Number(x.amount || 0),
          x.category,
          x.paymentMethod,
          x.paidBy,
          x.date,
          x.notes || '',
          new Date().toLocaleString('en-IN'),
          x.id,
        ]);
      }
    }

    if (newExpenseRows.length > 0) {
      await this.appendValues(spreadsheetId, 'Expenses!A1', newExpenseRows, token);
    }

    return {
      success: true,
      message: `Google Sheet synchronized! Added ${newDonationRows.length} donations and ${newExpenseRows.length} expenses to tabs 'Donations' and 'Expenses'.`,
      donationsAdded: newDonationRows.length,
      expensesAdded: newExpenseRows.length,
      spreadsheetTitle: title,
      spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
    };
  }

  // 9. Read all records from Google Sheet tabs and parse into app records
  public async pullRecordsFromSheet(
    spreadsheetId: string,
    token: string
  ): Promise<{ donations: CollectionRecord[]; expenses: ExpenseRecord[]; sheetTitle: string }> {
    const info = await this.getSpreadsheetInfo(spreadsheetId, token);
    const existingSheets = info.sheets || [];

    const donations: CollectionRecord[] = [];
    const expenses: ExpenseRecord[] = [];

    // --- READ DONATIONS ---
    const donSheetName =
      existingSheets.find((s: string) => s.toLowerCase() === 'donations') ||
      (existingSheets.length > 0 ? existingSheets[0] : null);

    if (donSheetName) {
      const rows = await this.getValues(spreadsheetId, `'${donSheetName}'!A1:Z1000`, token);
      if (rows && rows.length > 1) {
        const headerRow = rows[0].map((h: any) => String(h || '').toLowerCase().trim());

        let receiptIdx = headerRow.findIndex((h) => h.includes('रसीद') || h.includes('receipt'));
        let nameIdx = headerRow.findIndex(
          (h) => h.includes('नाम') || h.includes('name') || h.includes('donor')
        );
        let amountIdx = headerRow.findIndex((h) => h.includes('राशि') || h.includes('amount'));
        let mobileIdx = headerRow.findIndex(
          (h) => h.includes('मोबाइल') || h.includes('mobile') || h.includes('phone')
        );
        let uniqueIdIdx = headerRow.findIndex(
          (h) =>
            h.includes('पहचान') ||
            h.includes('वार्ड') ||
            h.includes('flat') ||
            h.includes('ward') ||
            h.includes('unique')
        );
        let methodIdx = headerRow.findIndex(
          (h) => h.includes('माध्यम') || h.includes('method') || h.includes('mode')
        );
        let dateIdx = headerRow.findIndex((h) => h.includes('तारीख') || h.includes('date'));
        let txnIdx = headerRow.findIndex(
          (h) => h.includes('ट्रांजेक्शन') || h.includes('txn') || h.includes('utr')
        );
        let notesIdx = headerRow.findIndex(
          (h) =>
            h.includes('नोट्स') ||
            h.includes('notes') ||
            h.includes('remark') ||
            h.includes('विवरण')
        );
        let idIdx = headerRow.findIndex(
          (h) =>
            h.includes('रिकॉर्ड id') ||
            h.includes('record id') ||
            h === 'id' ||
            h === 'recordid'
        );

        // Fallbacks for standard sheets
        if (receiptIdx === -1) receiptIdx = 0;
        if (nameIdx === -1) nameIdx = 1;
        if (amountIdx === -1) amountIdx = 2;
        if (mobileIdx === -1) mobileIdx = 3;
        if (uniqueIdIdx === -1) uniqueIdIdx = 4;
        if (methodIdx === -1) methodIdx = 5;
        if (dateIdx === -1) dateIdx = 6;
        if (txnIdx === -1) txnIdx = 7;
        if (notesIdx === -1) notesIdx = 8;
        if (idIdx === -1) idIdx = 10;

        for (let i = 1; i < rows.length; i++) {
          const r = rows[i];
          if (!r || r.length === 0) continue;

          const rawAmount = r[amountIdx] !== undefined ? String(r[amountIdx]).replace(/[^\d.]/g, '') : '';
          const numAmount = Number(rawAmount) || 0;
          const rawName = String(r[nameIdx] || '').trim();

          if (!rawName && numAmount === 0) continue;

          const rawMethod = String(r[methodIdx] || '').trim();
          let method: 'Cash' | 'UPI' | 'Online' = 'Cash';
          if (rawMethod.toLowerCase().includes('upi')) method = 'UPI';
          else if (rawMethod.toLowerCase().includes('online') || rawMethod.toLowerCase().includes('net'))
            method = 'Online';

          const recordId =
            (idIdx >= 0 && r[idIdx] && String(r[idIdx]).trim()) ||
            `col_sheet_${i}_${Date.now()}`;
          const receiptNo =
            (receiptIdx >= 0 && r[receiptIdx] && String(r[receiptIdx]).trim()) ||
            `SP2027-${String(i).padStart(4, '0')}`;
          const dateVal =
            (dateIdx >= 0 && r[dateIdx] && String(r[dateIdx]).trim()) ||
            new Date().toISOString().slice(0, 10);

          donations.push({
            id: recordId,
            receiptNumber: receiptNo,
            name: rawName || 'Anonymous Donor',
            amount: numAmount,
            mobile: mobileIdx >= 0 && r[mobileIdx] ? String(r[mobileIdx]).trim() : '',
            uniqueId: uniqueIdIdx >= 0 && r[uniqueIdIdx] ? String(r[uniqueIdIdx]).trim() : '',
            paymentMethod: method,
            date: dateVal,
            transactionId: txnIdx >= 0 && r[txnIdx] ? String(r[txnIdx]).trim() : 'N/A',
            notes: notesIdx >= 0 && r[notesIdx] ? String(r[notesIdx]).trim() : '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
      }
    }

    // --- READ EXPENSES ---
    const expSheetName = existingSheets.find((s: string) => s.toLowerCase() === 'expenses');
    if (expSheetName) {
      const rows = await this.getValues(spreadsheetId, `'${expSheetName}'!A1:Z1000`, token);
      if (rows && rows.length > 1) {
        const headerRow = rows[0].map((h: any) => String(h || '').toLowerCase().trim());

        let nameIdx = headerRow.findIndex(
          (h) => h.includes('खर्च') || h.includes('item') || h.includes('name') || h.includes('purpose')
        );
        let amountIdx = headerRow.findIndex((h) => h.includes('राशि') || h.includes('amount'));
        let catIdx = headerRow.findIndex((h) => h.includes('श्रेणी') || h.includes('category'));
        let methodIdx = headerRow.findIndex((h) => h.includes('माध्यम') || h.includes('method'));
        let paidByIdx = headerRow.findIndex(
          (h) => h.includes('भुगतानकर्ता') || h.includes('paid by') || h.includes('paidby')
        );
        let dateIdx = headerRow.findIndex((h) => h.includes('तारीख') || h.includes('date'));
        let notesIdx = headerRow.findIndex(
          (h) => h.includes('विवरण') || h.includes('notes') || h.includes('remark')
        );
        let idIdx = headerRow.findIndex(
          (h) => h.includes('रिकॉर्ड id') || h.includes('expenseid') || h === 'id'
        );

        if (nameIdx === -1) nameIdx = 0;
        if (amountIdx === -1) amountIdx = 1;
        if (catIdx === -1) catIdx = 2;
        if (methodIdx === -1) methodIdx = 3;
        if (paidByIdx === -1) paidByIdx = 4;
        if (dateIdx === -1) dateIdx = 5;
        if (notesIdx === -1) notesIdx = 6;
        if (idIdx === -1) idIdx = 8;

        for (let j = 1; j < rows.length; j++) {
          const r = rows[j];
          if (!r || r.length === 0) continue;

          const rawAmount = r[amountIdx] !== undefined ? String(r[amountIdx]).replace(/[^\d.]/g, '') : '';
          const numAmount = Number(rawAmount) || 0;
          const rawName = String(r[nameIdx] || '').trim();

          if (!rawName && numAmount === 0) continue;

          const rawMethod = String(r[methodIdx] || '').trim();
          let method: 'Cash' | 'UPI' | 'Online' = 'Cash';
          if (rawMethod.toLowerCase().includes('upi')) method = 'UPI';
          else if (rawMethod.toLowerCase().includes('online')) method = 'Online';

          expenses.push({
            id:
              (idIdx >= 0 && r[idIdx] && String(r[idIdx]).trim()) ||
              `exp_sheet_${j}_${Date.now()}`,
            name: rawName || 'Puja Expense',
            amount: numAmount,
            category: (catIdx >= 0 && r[catIdx] ? String(r[catIdx]).trim() : 'Other') as any,
            paymentMethod: method,
            paidBy: paidByIdx >= 0 && r[paidByIdx] ? String(r[paidByIdx]).trim() : '',
            date:
              (dateIdx >= 0 && r[dateIdx] ? String(r[dateIdx]).trim() : new Date().toISOString().slice(0, 10)),
            notes: notesIdx >= 0 && r[notesIdx] ? String(r[notesIdx]).trim() : '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
      }
    }

    return {
      donations,
      expenses,
      sheetTitle: info.title || 'Google Sheet',
    };
  }
}

export const googleSheetsApi = new GoogleSheetsApiService();

