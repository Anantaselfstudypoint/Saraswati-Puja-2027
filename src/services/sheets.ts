import { CollectionRecord, ExpenseRecord, SheetsConfig } from '../types';

const SHEETS_CONFIG_KEY = 'sp2027_sheets_config';

export const APPS_SCRIPT_TEMPLATE = `
/**
 * Saraswati Puja 2027 - Google Sheets Auto-Sync Webhook
 * 
 * Instructions:
 * 1. Open your Google Sheet
 * 2. Click Extensions -> Apps Script
 * 3. Replace all code in Code.gs with this code
 * 4. Click Deploy -> New deployment
 * 5. Select type: "Web app"
 * 6. Set Description: "Puja 2027 Sync"
 * 7. Set "Execute as": "Me"
 * 8. Set "Who has access": "Anyone"
 * 9. Click Deploy, Authorize access, and copy the Web App URL!
 */

function doGet(e) {
  return handleFetchData();
}

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // Ping check
    if (data.action === "ping") {
      return ContentService.createTextOutput(JSON.stringify({
        status: "ok",
        spreadsheetName: ss.getName(),
        message: "Successfully connected to Google Sheet!"
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // Pull/Fetch records from sheet into app
    if (data.action === "fetch" || data.action === "pull") {
      return handleFetchData();
    }

    var donationsAdded = 0;
    var expensesAdded = 0;

    // 1. Sync Donations
    if (data.donations && data.donations.length > 0) {
      var donSheet = ss.getSheetByName("Donations");
      if (!donSheet) {
        donSheet = ss.insertSheet("Donations");
        donSheet.appendRow([
          "RecordID", "ReceiptNo", "Name", "Amount", "Mobile", 
          "UniqueID", "PaymentMethod", "Date", "TransactionID", "Notes", "Timestamp"
        ]);
        donSheet.getRange("A1:K1").setFontWeight("bold").setBackground("#EDE9FE");
      }

      var existingDonValues = donSheet.getDataRange().getValues();
      var existingDonIds = {};
      for (var i = 1; i < existingDonValues.length; i++) {
        existingDonIds[existingDonValues[i][0]] = true; // Index 0 is RecordID
      }

      for (var d = 0; d < data.donations.length; d++) {
        var item = data.donations[d];
        if (!existingDonIds[item.id]) {
          donSheet.appendRow([
            item.id,
            item.receiptNumber,
            item.name,
            item.amount,
            item.mobile,
            item.uniqueId || "N/A",
            item.paymentMethod,
            item.date,
            item.transactionId || "N/A",
            item.notes || "",
            new Date().toISOString()
          ]);
          donationsAdded++;
        }
      }
    }

    // 2. Sync Expenses
    if (data.expenses && data.expenses.length > 0) {
      var expSheet = ss.getSheetByName("Expenses");
      if (!expSheet) {
        expSheet = ss.insertSheet("Expenses");
        expSheet.appendRow([
          "ExpenseID", "ItemName", "Amount", "Category", 
          "PaymentMethod", "PaidBy", "Date", "Notes", "Timestamp"
        ]);
        expSheet.getRange("A1:I1").setFontWeight("bold").setBackground("#FEE2E2");
      }

      var existingExpValues = expSheet.getDataRange().getValues();
      var existingExpIds = {};
      for (var j = 1; j < existingExpValues.length; j++) {
        existingExpIds[existingExpValues[j][0]] = true;
      }

      for (var x = 0; x < data.expenses.length; x++) {
        var exp = data.expenses[x];
        if (!existingExpIds[exp.id]) {
          expSheet.appendRow([
            exp.id,
            exp.name,
            exp.amount,
            exp.category,
            exp.paymentMethod,
            exp.paidBy,
            exp.date,
            exp.notes || "",
            new Date().toISOString()
          ]);
          expensesAdded++;
        }
      }
    }

    return ContentService.createTextOutput(JSON.stringify({
      status: "ok",
      success: true,
      donationsAdded: donationsAdded,
      expensesAdded: expensesAdded,
      syncedAt: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function handleFetchData() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var donations = [];
    var expenses = [];

    var donSheet = ss.getSheetByName("Donations") || ss.getSheets()[0];
    if (donSheet) {
      var dRows = donSheet.getDataRange().getValues();
      if (dRows.length > 1) {
        for (var i = 1; i < dRows.length; i++) {
          var r = dRows[i];
          if (!r || (!r[0] && !r[1] && !r[2])) continue;
          donations.push({
            id: String(r[0] || ("col_sheet_" + i)),
            receiptNumber: String(r[1] || r[0] || ("SP2027-" + i)),
            name: String(r[2] || r[1] || "Donor"),
            amount: Number(r[3] || r[2] || 0),
            mobile: String(r[4] || r[3] || ""),
            uniqueId: String(r[5] || r[4] || ""),
            paymentMethod: String(r[6] || r[5] || "Cash"),
            date: String(r[7] || r[6] || new Date().toISOString().slice(0, 10)),
            transactionId: String(r[8] || r[7] || "N/A"),
            notes: String(r[9] || r[8] || "")
          });
        }
      }
    }

    var expSheet = ss.getSheetByName("Expenses");
    if (expSheet) {
      var eRows = expSheet.getDataRange().getValues();
      if (eRows.length > 1) {
        for (var j = 1; j < eRows.length; j++) {
          var er = eRows[j];
          if (!er || (!er[0] && !er[1] && !er[2])) continue;
          expenses.push({
            id: String(er[0] || ("exp_sheet_" + j)),
            name: String(er[1] || er[0] || "Expense Item"),
            amount: Number(er[2] || er[1] || 0),
            category: String(er[3] || er[2] || "Other"),
            paymentMethod: String(er[4] || er[3] || "Cash"),
            paidBy: String(er[5] || er[4] || ""),
            date: String(er[6] || er[5] || new Date().toISOString().slice(0, 10)),
            notes: String(er[7] || er[6] || "")
          });
        }
      }
    }

    return ContentService.createTextOutput(JSON.stringify({
      status: "ok",
      success: true,
      donations: donations,
      expenses: expenses,
      spreadsheetName: ss.getName()
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
`.trim();

class SheetsService {
  public getConfig(): SheetsConfig {
    try {
      const raw = localStorage.getItem(SHEETS_CONFIG_KEY);
      return raw ? JSON.parse(raw) : { webhookUrl: '', spreadsheetId: '' };
    } catch {
      return { webhookUrl: '', spreadsheetId: '' };
    }
  }

  public saveConfig(config: SheetsConfig): void {
    localStorage.setItem(SHEETS_CONFIG_KEY, JSON.stringify(config));
  }

  public isConfigured(): boolean {
    const config = this.getConfig();
    return Boolean(config.webhookUrl && config.webhookUrl.startsWith('https://script.google.com/'));
  }

  public async testConnection(webhookUrl: string): Promise<{ success: boolean; message: string; sheetName?: string }> {
    if (!webhookUrl || !webhookUrl.startsWith('https://script.google.com/')) {
      return { success: false, message: 'Invalid URL. Please enter a valid Google Apps Script Web App URL.' };
    }

    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'ping' }),
      });

      const data = await res.json();
      if (data.status === 'ok') {
        return {
          success: true,
          message: `Connected successfully to Google Sheet: "${data.spreadsheetName || 'Active Sheet'}"!`,
          sheetName: data.spreadsheetName,
        };
      }
      return { success: false, message: data.message || 'Unable to verify spreadsheet connection.' };
    } catch (err: any) {
      return {
        success: false,
        message:
          'Could not reach the Apps Script endpoint. Please check your Web App deployment permissions (Who has access must be set to "Anyone").',
      };
    }
  }

  public async syncData(
    donations: CollectionRecord[],
    expenses: ExpenseRecord[]
  ): Promise<{ success: boolean; message: string; donationsAdded?: number; expensesAdded?: number }> {
    const config = this.getConfig();
    if (!this.isConfigured()) {
      return {
        success: false,
        message: 'Google Sheets sync is not configured yet. Please enter your Webhook URL in settings.',
      };
    }

    try {
      const payload = {
        action: 'sync',
        donations,
        expenses,
      };

      const res = await fetch(config.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      if (result.success || result.status === 'ok') {
        const updatedConfig = {
          ...config,
          lastSyncedAt: new Date().toISOString(),
        };
        this.saveConfig(updatedConfig);

        return {
          success: true,
          message: `Sync successful! ${result.donationsAdded || 0} new donations and ${
            result.expensesAdded || 0
          } new expenses synced to Google Sheets. Duplicates were automatically skipped.`,
          donationsAdded: result.donationsAdded || 0,
          expensesAdded: result.expensesAdded || 0,
        };
      }

      return { success: false, message: result.message || 'Google Sheets sync failed on server.' };
    } catch (err: any) {
      return { success: false, message: `Sync failed: ${err.message}` };
    }
  }

  public async pullDataFromWebhook(customUrl?: string): Promise<{
    success: boolean;
    donations: CollectionRecord[];
    expenses: ExpenseRecord[];
    message?: string;
  }> {
    const url = customUrl || this.getConfig().webhookUrl;
    if (!url || !url.startsWith('https://script.google.com/')) {
      return { success: false, donations: [], expenses: [], message: 'Webhook URL not configured' };
    }

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'fetch' }),
      });
      const data = await res.json();
      if (data.status === 'ok' && (Array.isArray(data.donations) || Array.isArray(data.expenses))) {
        return {
          success: true,
          donations: data.donations || [],
          expenses: data.expenses || [],
          message: `Fetched ${(data.donations || []).length} donations and ${(data.expenses || []).length} expenses from Google Sheet.`,
        };
      }
      return {
        success: false,
        donations: [],
        expenses: [],
        message: data.message || 'No records returned from webhook.',
      };
    } catch (err: any) {
      return { success: false, donations: [], expenses: [], message: err.message };
    }
  }
}

export const sheetsService = new SheetsService();
