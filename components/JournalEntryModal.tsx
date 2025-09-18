import React, { useState, useEffect } from 'react';
import { ReceiptData, JournalEntry } from '../types';
import { DEBIT_ACCOUNTS } from '../constants';

interface JournalEntryModalProps {
  receipt: ReceiptData | null;
  journalEntry: JournalEntry | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (entry: JournalEntry) => void;
}

const JournalEntryModal: React.FC<JournalEntryModalProps> = ({ receipt, journalEntry, isOpen, onClose, onSave }) => {
  const [description, setDescription] = useState('');
  const [debitAccount, setDebitAccount] = useState(DEBIT_ACCOUNTS[0]);
  const [transactionDate, setTransactionDate] = useState('');
  const [amount, setAmount] = useState(0);

  useEffect(() => {
    if (isOpen && receipt && journalEntry) {
      setDescription(journalEntry.description);
      setDebitAccount(journalEntry.debitAccount);
      setTransactionDate(journalEntry.transactionDate);
      setAmount(journalEntry.amount);
    }
    
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };

  }, [receipt, journalEntry, isOpen, onClose]);
  
  if (!isOpen || !receipt || !journalEntry) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!journalEntry) return;

    const updatedEntry: JournalEntry = {
      ...journalEntry,
      transactionDate,
      debitAccount,
      amount,
      description: description || '摘要なし',
    };
    onSave(updatedEntry);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="p-6">
          <h3 className="text-xl font-bold text-gray-800 mb-4">仕訳の編集</h3>
          <div className="space-y-2 text-gray-600 bg-gray-50 p-4 rounded-lg border border-gray-200 mb-6">
            <p><strong>店名:</strong> {receipt.storeName}</p>
            {receipt.taxAmount > 0 && <p><strong>(内)消費税:</strong> &yen;{receipt.taxAmount?.toLocaleString()} ({receipt.taxRate || '未設定'}%)</p>}
            {receipt.invoiceNumber && <p><strong>インボイス番号:</strong> <span className="font-mono">{receipt.invoiceNumber}</span></p>}
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
             <div>
              <label htmlFor="transactionDate" className="block text-sm font-medium text-gray-700 mb-1">取引日付</label>
              <input
                type="date"
                id="transactionDate"
                value={transactionDate}
                onChange={(e) => setTransactionDate(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                required
              />
            </div>
             <div>
                <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-1">金額 (借方)</label>
                <input
                    type="number"
                    id="amount"
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    required
                />
            </div>
            <div>
              <label htmlFor="debitAccount" className="block text-sm font-medium text-gray-700 mb-1">勘定科目 (借方)</label>
              <select
                id="debitAccount"
                value={debitAccount}
                onChange={(e) => setDebitAccount(e.target.value)}
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
              >
                {DEBIT_ACCOUNTS.map(acc => <option key={acc} value={acc}>{acc}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">摘要 (取引の内容)</label>
              <input
                type="text"
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="例: クライアントとの打ち合わせ"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                required
              />
            </div>
            <div className="pt-4 flex justify-end space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
              >
                キャンセル
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                保存
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default JournalEntryModal;