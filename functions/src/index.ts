/**
 * MYQUEST Meet - Google Meet連携 Functions
 * Phase 0: テスト環境構築
 */

import { setGlobalOptions } from "firebase-functions/v2";
import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as dotenv from "dotenv";

// 環境変数を読み込む
dotenv.config();

// グローバル設定
setGlobalOptions({
  region: "asia-northeast1", // 東京リージョン
  maxInstances: 10,
});

// Gemini APIの初期化
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

/**
 * テストエンドポイント1: 基本的な動作確認
 * URL: https://[region]-[project-id].cloudfunctions.net/testHello
 */
export const testHello = onRequest(async (req, res) => {
  logger.info("testHello called", { method: req.method });
  
  res.json({
    success: true,
    message: "🎉 Firebase Functions is working!",
    timestamp: new Date().toISOString(),
    project: "MYQUEST Meet",
  });
});

/**
 * テストエンドポイント2: Gemini API接続テスト
 * URL: https://[region]-[project-id].cloudfunctions.net/testGemini
 */
export const testGemini = onRequest(async (req, res) => {
  logger.info("testGemini called", { method: req.method });
  
  try {
    // APIキーの存在確認
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not set");
    }
    
    // Gemini APIを呼び出し
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const prompt = "こんにちは！簡単な自己紹介をしてください。";
    
    logger.info("Calling Gemini API...");
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();
    
    logger.info("Gemini API response received");
    
    res.json({
      success: true,
      message: "✅ Gemini API is working!",
      geminiResponse: text,
      timestamp: new Date().toISOString(),
    });
    
  } catch (error: any) {
    logger.error("Gemini API test failed", { error: error.message });
    
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * テストエンドポイント3: 議事録要約のシミュレーション
 * URL: https://[region]-[project-id].cloudfunctions.net/testSummarize
 */
export const testSummarize = onRequest(async (req, res) => {
  logger.info("testSummarize called", { method: req.method });
  
  try {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not set");
    }
    
    // サンプル議事録
    const sampleTranscript = `
【サンプル議事録】
日時: 2026年2月7日 10:00-11:00
参加者: 田中、佐藤、鈴木

田中: おはようございます。今日は来週の現場立ち上げについて確認します。
佐藤: よろしくお願いします。資材の搬入は月曜日の午前中で確定しました。
鈴木: 了解です。作業員は8名手配済みです。
田中: では、安全確認は私が金曜日までに完了させます。
佐藤: ありがとうございます。では次回は木曜日に進捗確認しましょう。
    `;
    
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const prompt = `
以下の議事録を要約してください。
- 重要な決定事項
- アクションアイテム
- 次回ミーティング

【議事録】
${sampleTranscript}
    `;
    
    logger.info("Generating summary...");
    const result = await model.generateContent(prompt);
    const summary = result.response.text();
    
    logger.info("Summary generated");
    
    res.json({
      success: true,
      message: "✅ 議事録要約テスト成功！",
      originalTranscript: sampleTranscript,
      summary: summary,
      timestamp: new Date().toISOString(),
    });
    
  } catch (error: any) {
    logger.error("Summary test failed", { error: error.message });
    
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * テストエンドポイント4: 利用可能なモデルをリスト表示
 * URL: https://[region]-[project-id].cloudfunctions.net/listModels
 */
export const listModels = onRequest(async (req, res) => {
  logger.info("listModels called", { method: req.method });
  
  try {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not set");
    }
    
    // 利用可能なモデルをリスト表示
    const apiKey = process.env.GEMINI_API_KEY;
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    );
    
    const data = await response.json();
    
    res.json({
      success: true,
      message: "✅ 利用可能なモデル一覧",
      models: data.models?.map((m: any) => ({
        name: m.name,
        displayName: m.displayName,
        supportedMethods: m.supportedGenerationMethods,
      })),
      timestamp: new Date().toISOString(),
    });
    
  } catch (error: any) {
    logger.error("List models failed", { error: error.message });
    
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});