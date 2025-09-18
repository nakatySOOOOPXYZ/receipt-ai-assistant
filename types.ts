

export interface ReceiptData {
  id: string;
  storeName?: string;
  date?: string;
  totalAmount?: number;
  taxAmount?: number;
  taxRate?: number;
  invoiceNumber?: string;
  sourceFileName: string;
  originalImage: string;
  suggestedDebitAccount?: string;
  suggestedDescription?: string;
}

export interface JournalEntry {
  id: string; // Corresponds to ReceiptData id
  transactionDate: string;
  debitAccount: string;
  creditAccount: string;
  amount: number;
  description: string;
  storeName: string;
  invoiceNumber?: string;
}

export enum AppState {
  IDLE,
  PROCESSING_FILES,
  PROCESSING_AI,
  SUCCESS,
  ERROR
}