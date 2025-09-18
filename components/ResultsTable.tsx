

import React from 'react';
import { ReceiptData, JournalEntry } from '../types';

interface ResultsTableProps {
  receipts: ReceiptData[];
  journalEntries: JournalEntry[];
  onOpenJournalModal: (receipt: ReceiptData) => void;
  onImageClick: (base64Image: string) => void;
}

const ResultsTable: React.FC<ResultsTableProps> = ({ receipts, journalEntries, onOpenJournalModal, onImageClick }) => {
  const getJournalEntryForReceipt = (receiptId: string) => {
    return journalEntries.find(entry => entry.id === receiptId);
  };

  if (receipts.length === 0) {
    return (
      <div className="text-center py-10 px-4">
        <p className="text-gray-500">ここに読み取り結果が表示されます。</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto bg-white shadow-lg rounded-lg mt-8 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left text-gray-600">
          <thead className="text-xs text-gray-700 uppercase bg-gray-100">
            <tr>
              <th scope="col" className="px-4 py-3">プレビュー</th>
              <th scope="col" className="px-4 py-3">店名</th>
              <th scope="col" className="px-4 py-3">日付</th>
              <th scope="col" className="px-4 py-3 text-right">合計金額</th>
              <th scope="col" className="px-4 py-3">インボイス番号</th>
              <th scope="col" className="px-4 py-3">仕訳内容</th>
              <th scope="col" className="px-4 py-3 text-center">アクション</th>
            </tr>
          </thead>
          <tbody>
            {receipts.map((receipt) => {
              const journalEntry = getJournalEntryForReceipt(receipt.id);
              return (
                <tr key={receipt.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-2">
                    <img 
                      src={`data:image/jpeg;base64,${receipt.originalImage}`} 
                      alt="Receipt thumbnail" 
                      className="h-16 w-16 object-cover rounded-md cursor-pointer hover:scale-110 transition-transform"
                      onClick={() => onImageClick(receipt.originalImage)}
                      aria-label="レシート画像を拡大表示"
                    />
                  </td>
                  <td className="px-4 py-2 font-medium text-gray-900">{receipt.storeName}</td>
                  <td className="px-4 py-2">{receipt.date}</td>
                  <td className="px-4 py-2 text-right">
                    <div>&yen;{receipt.totalAmount?.toLocaleString()}</div>
                     {receipt.taxAmount > 0 && (
                        <div className="text-xs text-gray-500">
                            (内消費税 &yen;{receipt.taxAmount?.toLocaleString()})
                        </div>
                    )}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">{receipt.invoiceNumber || '該当なし'}</td>
                  <td className="px-4 py-2">
                    {journalEntry ? (
                      <div>
                        <p className="font-semibold">{journalEntry.debitAccount}</p>
                        <p className="text-xs text-gray-500">{journalEntry.description}</p>
                      </div>
                    ) : (
                      <span className="text-gray-400">作成中...</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-center">
                    <button
                      onClick={() => onOpenJournalModal(receipt)}
                      className="font-medium text-blue-600 hover:text-blue-800 disabled:text-gray-400 disabled:cursor-not-allowed"
                      disabled={!journalEntry}
                    >
                      {journalEntry ? '編集' : '作成中...'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ResultsTable;