

import React, { useState, useCallback } from 'react';
import { AppState, ReceiptData, JournalEntry } from './types';
import { extractReceiptDataFromImages } from './services/geminiService';
import FileUpload from './components/FileUpload';
import ResultsTable from './components/ResultsTable';
import JournalEntryModal from './components/JournalEntryModal';
import ImagePreviewModal from './components/ImagePreviewModal';
import { DEBIT_ACCOUNTS } from './constants';

// Declare pdfjsLib as it's loaded from a script tag
declare const pdfjsLib: any;

// Process images in batches to avoid API limits and browser memory issues
const BATCH_SIZE = 10;

const App: React.FC = () => {
    const [appState, setAppState] = useState<AppState>(AppState.IDLE);
    const [statusMessage, setStatusMessage] = useState<string>('');
    const [error, setError] = useState<string | null>(null);
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [receipts, setReceipts] = useState<ReceiptData[]>([]);
    const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentReceipt, setCurrentReceipt] = useState<ReceiptData | null>(null);
    const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
    const [previewImageUrl, setPreviewImageUrl] = useState<string>('');
    
    const isProcessing = appState === AppState.PROCESSING_FILES || appState === AppState.PROCESSING_AI;

    const fileToDataUrlParts = (file: File): Promise<{base64: string, mimeType: string}> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => {
                const result = reader.result as string;
                const [header, data] = result.split(',');
                const mimeType = header.match(/:(.*?);/)?.[1] || file.type;
                resolve({ base64: data, mimeType });
            };
            reader.onerror = error => reject(error);
        });
    };

    const pdfPageToImageBase64 = async (page: any): Promise<{base64: string, mimeType: string}> => {
        const viewport = page.getViewport({ scale: 2.0 }); // Increased scale for better quality
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        if (!context) throw new Error("Could not get canvas context");

        await page.render({ canvasContext: context, viewport: viewport }).promise;
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9); // Use high quality JPEG
        const [header, data] = dataUrl.split(',');
        const mimeType = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
        return { base64: data, mimeType };
    };

    const processFiles = useCallback(async (files: File[]) => {
        setAppState(AppState.PROCESSING_FILES);
        setError(null);
        setReceipts([]);
        setJournalEntries([]);

        const imagePromises: Promise<{base64: string, fileName: string, mimeType: string}>[] = [];

        for (const file of files) {
            setStatusMessage(`処理中: ${file.name}`);
            if (file.type.startsWith('image/')) {
                 imagePromises.push(fileToDataUrlParts(file).then(({ base64, mimeType }) => ({base64, fileName: file.name, mimeType})));
            } else if (file.type === 'application/pdf') {
                try {
                    const arrayBuffer = await file.arrayBuffer();
                    const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
                    for (let i = 1; i <= pdf.numPages; i++) {
                        const page = await pdf.getPage(i);
                        imagePromises.push(pdfPageToImageBase64(page).then(({base64, mimeType}) => ({base64, fileName: `${file.name}-p${i}`, mimeType})));
                    }
                } catch(err) {
                     setError(`PDFの処理中にエラーが発生しました: ${file.name}`);
                     setAppState(AppState.ERROR);
                     return;
                }
            }
        }
        
        setAppState(AppState.PROCESSING_AI);
        setStatusMessage('AIがレシートを読み取っています...');

        try {
            const imageContents = await Promise.all(imagePromises);
            if (imageContents.length > 0) {
                let totalReceiptsCount = 0;
                const totalBatches = Math.ceil(imageContents.length / BATCH_SIZE);

                for (let i = 0; i < imageContents.length; i += BATCH_SIZE) {
                    const batch = imageContents.slice(i, i + BATCH_SIZE);
                    const currentBatchNumber = i / BATCH_SIZE + 1;
                    const imageRangeStart = i + 1;
                    const imageRangeEnd = Math.min(i + BATCH_SIZE, imageContents.length);

                    setStatusMessage(`AI分析中: バッチ ${currentBatchNumber}/${totalBatches} (画像 ${imageRangeStart}～${imageRangeEnd}/${imageContents.length}) を処理しています...`);

                    const batchExtractedData = await extractReceiptDataFromImages(batch);

                    if (batchExtractedData.length > 0) {
                        setReceipts(prev => [...prev, ...batchExtractedData]);

                        const newJournalEntries = batchExtractedData.map(receipt => ({
                            id: receipt.id,
                            transactionDate: receipt.date || new Date().toISOString().split('T')[0],
                            debitAccount: receipt.suggestedDebitAccount && DEBIT_ACCOUNTS.includes(receipt.suggestedDebitAccount) ? receipt.suggestedDebitAccount : DEBIT_ACCOUNTS[0],
                            creditAccount: '現金',
                            amount: receipt.totalAmount || 0,
                            description: receipt.suggestedDescription || receipt.storeName || '摘要なし',
                            storeName: receipt.storeName || '不明な店名',
                            invoiceNumber: receipt.invoiceNumber
                        }));

                        setJournalEntries(prev => [...prev, ...newJournalEntries]);
                        totalReceiptsCount += batchExtractedData.length;
                    }
                }

                setAppState(AppState.SUCCESS);
                setStatusMessage(`${totalReceiptsCount}件のレシートを読み取りました。`);
            } else {
                 setAppState(AppState.IDLE);
                 setStatusMessage('処理できるファイルがありませんでした。');
            }
        } catch(err: any) {
            setError(err.message || '不明なエラーが発生しました。');
            setAppState(AppState.ERROR);
            setStatusMessage('エラーが発生しました。');
        }

    }, []);

    const handleFilesSelected = (files: File[]) => {
        setSelectedFiles(files);
        processFiles(files);
    };
    
    const handleReset = () => {
        setAppState(AppState.IDLE);
        setStatusMessage('');
        setError(null);
        setSelectedFiles([]);
        setReceipts([]);
        setJournalEntries([]);
    }

    const handleOpenJournalModal = (receipt: ReceiptData) => {
        setCurrentReceipt(receipt);
        setIsModalOpen(true);
    };

    const handleCloseModal = useCallback(() => {
        setIsModalOpen(false);
        setCurrentReceipt(null);
    }, []);

    const handleSaveJournalEntry = (updatedEntry: JournalEntry) => {
        setJournalEntries(prev => prev.map(entry => entry.id === updatedEntry.id ? updatedEntry : entry));
        handleCloseModal();
    };
    
    const handleImageClick = (base64Image: string) => {
        setPreviewImageUrl(`data:image/jpeg;base64,${base64Image}`);
        setIsPreviewModalOpen(true);
    };
    
    const handleClosePreviewModal = useCallback(() => {
        setIsPreviewModalOpen(false);
    }, []);

    const downloadCsv = () => {
        if (journalEntries.length === 0) {
            alert("ダウンロードする仕訳データがありません。");
            return;
        }
        
        // 弥生会計インポート形式に準拠 (https://www.yayoi-kk.co.jp/products/account/import.html)
        const headers = [
            '取引日付', '借方勘定科目', '借方補助科目', '貸方勘定科目', '貸方補助科目',
            '借方税区分', '貸方税区分', '借方金額', '貸方金額', '摘要', '税率', 'インボイス'
        ];
        
        const rows = journalEntries.map(e => {
            const relatedReceipt = receipts.find(r => r.id === e.id);
            const taxRate = relatedReceipt?.taxRate ? `${relatedReceipt.taxRate}%` : '10%'; // Use dynamic tax rate, default to 10%
            
            return [
                e.transactionDate.replace(/-/g, '/'), // YYYY/MM/DD
                e.debitAccount, '', e.creditAccount, '',
                '対象外', '対象外', e.amount, e.amount,
                `${e.storeName} / ${e.description}`, taxRate, e.invoiceNumber ? '1' : '0'
            ];
        });

        let csvContent = headers.join(',') + '\r\n';
        rows.forEach(rowArray => {
            let row = rowArray.map(item => `"${item}"`).join(',');
            csvContent += row + '\r\n';
        });

        const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
        const blob = new Blob([bom, csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', '仕訳データ.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const currentJournalEntry = currentReceipt ? journalEntries.find(j => j.id === currentReceipt.id) : null;

    return (
        <div className="min-h-screen bg-gray-50 font-sans text-gray-800">
            <header className="bg-blue-700 shadow-md">
                <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
                    <h1 className="text-2xl font-bold text-white">レシート仕訳AIアシスタント</h1>
                </div>
            </header>
            
            <main className="py-8">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="bg-white p-6 rounded-lg shadow-md">
                        <h2 className="text-lg font-semibold mb-4">1. レシートをアップロード</h2>
                        <FileUpload onFilesSelected={handleFilesSelected} isProcessing={isProcessing} />
                        {isProcessing && (
                            <div className="mt-4 text-center">
                                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                                <p className="mt-2 text-sm text-blue-600 font-semibold">{statusMessage}</p>
                            </div>
                        )}
                        {appState === AppState.ERROR && <p className="mt-4 text-center text-red-600 font-bold">{error}</p>}
                        {appState === AppState.SUCCESS && <p className="mt-4 text-center text-green-600 font-bold">{statusMessage}</p>}
                    </div>

                    <div className="bg-white p-6 rounded-lg shadow-md mt-8">
                         <h2 className="text-lg font-semibold mb-4">2. 内容を確認して仕訳を編集</h2>
                        <ResultsTable receipts={receipts} journalEntries={journalEntries} onOpenJournalModal={handleOpenJournalModal} onImageClick={handleImageClick} />
                    </div>

                    <div className="mt-8 flex flex-col sm:flex-row justify-center items-center space-y-4 sm:space-y-0 sm:space-x-4">
                        <button 
                            onClick={handleReset} 
                            disabled={isProcessing}
                            className="w-full sm:w-auto px-8 py-3 bg-red-600 text-white font-bold rounded-lg shadow-md hover:bg-red-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                        >
                            やり直し
                        </button>
                        <button 
                            onClick={downloadCsv}
                            disabled={isProcessing || journalEntries.length === 0}
                            className="w-full sm:w-auto px-8 py-3 bg-green-600 text-white font-bold rounded-lg shadow-md hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                        >
                            弥生会計形式でCSVダウンロード
                        </button>
                    </div>
                </div>
            </main>
            
            <JournalEntryModal 
                isOpen={isModalOpen}
                receipt={currentReceipt}
                journalEntry={currentJournalEntry}
                onClose={handleCloseModal}
                onSave={handleSaveJournalEntry}
            />

            <ImagePreviewModal
                isOpen={isPreviewModalOpen}
                onClose={handleClosePreviewModal}
                imageUrl={previewImageUrl}
            />

            <footer className="text-center py-4 text-sm text-gray-500">
                <p>&copy; {new Date().getFullYear()} レシート仕訳AIアシスタント. 無断複写・転載を禁じます。</p>
            </footer>
        </div>
    );
};

export default App;