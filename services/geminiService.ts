

import { GoogleGenAI, Type } from "@google/genai";
import { ReceiptData } from '../types';
import { DEBIT_ACCOUNTS } from "../constants";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// This is the schema for a single receipt
const singleReceiptSchema = {
    type: Type.OBJECT,
    required: ["storeName", "date", "totalAmount", "suggestedDebitAccount", "suggestedDescription"],
    properties: {
      storeName: {
        type: Type.STRING,
        description: "店名",
      },
      date: {
        type: Type.STRING,
        description: "レシートの日付 (YYYY-MM-DD形式)。和暦の場合は西暦に変換する。",
      },
      totalAmount: {
        type: Type.NUMBER,
        description: "合計金額",
      },
      taxAmount: {
        type: Type.NUMBER,
        description: "消費税額。見つからない場合は 0 とする。",
      },
      taxRate: {
        type: Type.NUMBER,
        description: "消費税率。8%なら8、10%なら10と数値で返す。見つからない場合は0とする。",
      },
      invoiceNumber: {
        type: Type.STRING,
        description: "インボイス登録番号 (Tで始まる13桁の英数字)。見つからない場合は空文字とする。",
      },
      suggestedDebitAccount: {
        type: Type.STRING,
        description: `店名やレシートの内容から最も適切と思われる勘定科目を推測して、以下の選択肢から一つだけ選んでください: ${DEBIT_ACCOUNTS.join(', ')}`,
        enum: DEBIT_ACCOUNTS,
      },
      suggestedDescription: {
        type: Type.STRING,
        description: "取引内容の摘要。店名や購入品目から簡潔に作成してください。",
      },
    },
};

// This is the new schema for handling multiple images in one go.
const multiImageReceiptSchema = {
  type: Type.ARRAY,
  description: "入力されたすべての画像に対するレシート情報の配列。入力画像の順番通りに結果を返すこと。",
  items: {
    type: Type.OBJECT,
    description: "単一の入力画像から抽出された情報。",
    properties: {
        receipts: {
            type: Type.ARRAY,
            description: "この画像から見つかったレシートの配列。レシートが見つからない場合は空配列を返す。",
            items: singleReceiptSchema,
        }
    }
  }
};


export const extractReceiptDataFromImages = async (
    images: { base64: string; fileName: string; mimeType: string }[]
): Promise<ReceiptData[]> => {
    if (images.length === 0) {
        return [];
    }

    try {
        const imageParts = images.map(img => ({
            inlineData: {
                mimeType: img.mimeType,
                data: img.base64,
            },
        }));

        const prompt = {
             text: "提供されたそれぞれの画像からレシート情報を抽出してください。店名や内容に基づき、最も適切な勘定科目と摘要も提案してください。JSONスキーマに従い、入力画像の順番通りに結果を配列で返してください。各画像について、見つかった全てのレシートの情報を抽出してください。もし画像にレシートが含まれていない場合は、その画像に対応するreceipts配列は空にしてください。" 
        };

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: { 
                parts: [prompt, ...imageParts] 
            },
            config: {
                responseMimeType: "application/json",
                responseSchema: multiImageReceiptSchema,
            },
        });
        
        const jsonText = response.text.trim();
        if (!jsonText) {
            console.warn("API returned empty response for multi-image request.");
            return [];
        }

        let parsedResponse;
        try {
            parsedResponse = JSON.parse(jsonText);
        } catch (parseError) {
             console.error("Failed to parse JSON response:", jsonText, parseError);
             throw new Error("AIからの応答を解析できませんでした。予期しない形式のデータが返されました。");
        }

        if (!Array.isArray(parsedResponse) || parsedResponse.length !== images.length) {
            console.error("Mismatched response length. Expected:", images.length, "Got:", parsedResponse.length, parsedResponse);
            throw new Error("AIからの応答が、リクエストした画像の数と一致しませんでした。");
        }

        const allReceipts: ReceiptData[] = [];

        parsedResponse.forEach((imageResult: any, imageIndex: number) => {
            const sourceImage = images[imageIndex];
            if (imageResult && Array.isArray(imageResult.receipts)) {
                 imageResult.receipts.forEach((item: any, receiptIndex: number) => {
                    allReceipts.push({
                        id: `${sourceImage.fileName}-${Date.now()}-${receiptIndex}`,
                        storeName: item.storeName || '不明',
                        date: item.date || '日付不明',
                        totalAmount: item.totalAmount || 0,
                        taxAmount: item.taxAmount || 0,
                        taxRate: item.taxRate || 0,
                        invoiceNumber: item.invoiceNumber || '',
                        sourceFileName: sourceImage.fileName,
                        originalImage: sourceImage.base64,
                        suggestedDebitAccount: item.suggestedDebitAccount,
                        suggestedDescription: item.suggestedDescription,
                    });
                });
            }
        });

        return allReceipts;
    } catch (error) {
        console.error("Error extracting receipt data from images:", error);
        if (error instanceof Error && (error.message.includes('quota exceeded') || error.message.includes('daily limit'))) {
            throw new Error("APIの1日の利用上限に達しました。明日もう一度お試しください。");
        }
        throw new Error("AIによるレシートの読み取りに失敗しました。画像の品質を確認するか、再度お試しください。");
    }
};