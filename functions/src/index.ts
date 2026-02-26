/**
 * MYQUEST Meet - Google Meet連携 Functions
 * Phase 0: テスト環境構築
 */

import { setGlobalOptions } from "firebase-functions/v2";
import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as dotenv from "dotenv";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// 環境変数を読み込む
dotenv.config();

// グローバル設定
setGlobalOptions({
  region: "asia-northeast1", // 東京リージョン
  maxInstances: 10,
});

// Firestore初期化
initializeApp();
const db = getFirestore();

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

/**
 * Firestoreから全グループのメンバー名を取得
 */
async function getAllMemberNames(): Promise<string[]> {
  try {
    const groupsSnapshot = await db.collection("groups").get();
    const names = new Set<string>();

    groupsSnapshot.forEach((doc) => {
      const data = doc.data();
      const members = data.members || [];
      members.forEach((member: any) => {
        if (member.username) names.add(member.username);
      });
    });

    const nameList = Array.from(names);
    logger.info("Member names fetched", { count: nameList.length, names: nameList });
    return nameList;
  } catch (error: any) {
    logger.error("getAllMemberNames failed", { error: error.message });
    return [];
  }
}

/**
 * グループの過去の修正例を取得（Geminiプロンプト用）
 */
async function getCorrectionLogs(groupId: string): Promise<string> {
  try {
    const logsSnapshot = await db
      .collection("correction_logs")
      .doc(groupId)
      .collection("logs")
      .orderBy("correctedAt", "desc")
      .limit(10)
      .get();

    if (logsSnapshot.empty) return "";

    const examples = logsSnapshot.docs.map((doc) => {
      const data = doc.data();
      return `・${data.field}：「${data.before}」→「${data.after}」`;
    });

    return examples.join("\n");
  } catch (error: any) {
    logger.error("getCorrectionLogs failed", { error: error.message });
    return "";
  }
}

/**
 * グループの管理者IDリストを取得（adminId + adminIds）
 */
async function getGroupAdminIds(groupId: string): Promise<string[]> {
  try {
    const groupDoc = await db.collection("groups").doc(groupId).get();
    if (!groupDoc.exists) return [];

    const data = groupDoc.data()!;
    const adminIds = new Set<string>();

    if (data.adminId) adminIds.add(data.adminId);
    if (data.adminIds) data.adminIds.forEach((id: string) => adminIds.add(id));

    return Array.from(adminIds);
  } catch (error: any) {
    logger.error("getGroupAdminIds failed", { error: error.message });
    return [];
  }
}

/**
 * カレンダータイトル / groupNameHint からグループIDを特定
 */
async function identifyGroupId(
  meetingTitle: string,
  groupNameHint?: string
): Promise<string | null> {
  logger.info("identifyGroupId called", { meetingTitle, groupNameHint });

  try {
    const groupsSnapshot = await db.collection("groups").get();
    if (groupsSnapshot.empty) {
      logger.warn("No groups found in Firestore");
      return null;
    }

    const hints = [
      groupNameHint?.trim(),
      meetingTitle?.trim(),
    ].filter(Boolean) as string[];

    for (const hint of hints) {
      for (const doc of groupsSnapshot.docs) {
        const data = doc.data();
        const groupName: string = data.name || data.groupName || "";
        if (!groupName) continue;

        const hintNormalized = hint.toLowerCase();
        const nameNormalized = groupName.toLowerCase();

        if (
          hintNormalized === nameNormalized ||
          hintNormalized.includes(nameNormalized) ||
          nameNormalized.includes(hintNormalized)
        ) {
          logger.info("Group identified!", { groupId: doc.id, groupName });
          return doc.id;
        }
      }
    }

    logger.info("No matching group found", { meetingTitle, groupNameHint });
    return null;
  } catch (error: any) {
    logger.error("identifyGroupId failed", { error: error.message });
    return null;
  }
}

/**
 * Gemini APIで会議内容を分析
 * 
 * @param transcript - 会議の文字起こしテキスト
 * @param metadata - 会議のメタデータ
 * @returns 分析結果（要約、キーポイント、決定事項、アクション）
 */
async function analyzeMeetingWithGemini(
  transcript: string,
  metadata: any
): Promise<any> {
  logger.info("analyzeMeetingWithGemini called", {
    transcriptLength: transcript.length,
    participants: metadata.participants?.length,
  });

  try {
    // Geminiモデルを取得
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
    });

    // プロンプトを生成
   const memberNames = await getAllMemberNames();
const correctionLogs = await getCorrectionLogs(metadata.groupId || '');
const prompt = generateMeetingAnalysisPrompt(transcript, metadata, memberNames, correctionLogs);

    logger.info("Calling Gemini API for meeting analysis...");

    // Gemini APIを呼び出し
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    logger.info("Gemini API response received", {
      responseLength: text.length,
    });

    // JSONをパース（```json ``` を除去）
    const cleanedText = text.replace(/```json\n?|```\n?/g, "").trim();
    const parsedResult = JSON.parse(cleanedText);

    // IDを追加
    parsedResult.id = `meeting_${Date.now()}`;

    logger.info("Meeting analysis completed", {
      meetingId: parsedResult.id,
      actionsCount: parsedResult.actions?.length || 0,
    });

    return parsedResult;
  } catch (error: any) {
    logger.error("analyzeMeetingWithGemini failed", {
      error: error.message,
      stack: error.stack,
    });
    throw new Error(`Meeting analysis failed: ${error.message}`);
  }
}

/**
 * 会議分析用のプロンプトを生成
 * 
 * @param transcript - 会議の文字起こしテキスト
 * @param metadata - 会議のメタデータ
 * @returns Gemini API用のプロンプト
 */
function generateMeetingAnalysisPrompt(
  transcript: string,
  metadata: any,
  memberNames: string[],
  correctionLogs: string
): string {
  return `
あなたは会議アシスタント（書記官）です。
以下の会議の文字起こしを分析し、簡潔で実用的な議事録を作成してください。

━━━━━━━━━━━━━━━━━━━━━━
【会議情報】
━━━━━━━━━━━━━━━━━━━━━━

会議名: ${metadata.meetingTitle}
会議日: ${metadata.meetingDate}
参加者: ${metadata.participants.join(", ")}
会議時間: 約${metadata.duration}分
登録メンバー: ${memberNames.length > 0 ? memberNames.join(", ") : "なし"}

━━━━━━━━━━━━━━━━━━━━━━
【文字起こし】
━━━━━━━━━━━━━━━━━━━━━━

${transcript}

━━━━━━━━━━━━━━━━━━━━━━
【出力形式】
━━━━━━━━━━━━━━━━━━━━━━

以下のJSON形式で返してください。説明文は不要です。

{
  "summary": {
    "title": "会議の種類を1文で（例：定例ミーティング、進捗確認会議）",
    "overview": "会議全体の要約（200-300文字、誰が何を報告し、何が決まったか）",
    "keyPoints": [
      "重要ポイント1（具体的に、誰が何をいつまでに）",
      "重要ポイント2",
      "重要ポイント3"
    ],
    "decisions": [
      "決定事項1（誰がいつまでに何をするか明確に）",
      "決定事項2"
    ]
  },
  
  "actions": [
  {
    "assignee": "担当者名（文字起こしから正確に抽出。複数人の場合は「山田, 佐藤」のようにカンマ区切り）",
    "task": "具体的なタスク内容（何をどうするか明確に）",
    "deadline": "期限（ISO8601形式、YYYY-MM-DDTHH:MM:SSZ）",
    "priority": "urgent|high|medium|low",
    "exp": 経験値（10-100の整数）
  }
],
  
  "insight": {
    "text": "インサイト内容（1文、100文字以内、具体的に）",
    "category": "risk|opportunity|trend|suggestion",
    "confidence": 0.85
  }
}

━━━━━━━━━━━━━━━━━━━━━━
【重要な指示】
━━━━━━━━━━━━━━━━━━━━━━
0. 【最重要】participants（参加者リスト）に「電気工事坂本」「大工織田」のように役職名＋人名が混在している場合は、人名部分のみを抽出すること（例：「電気工事坂本」→「坂本」、「大工織田」→「織田」）。また役職名のみで人名がない場合は参加者リストから除外すること。
0.5. 【最重要】上記「登録メンバー」リストを参照し、文字起こし中の人名の誤認識を補正すること（例：「最後」→「西郷隆盛」、「小田」→「織田信長」）。参加者・担当者名は必ずこのリストの名前から選ぶこと。登録メンバーの名前は一字一句そのまま使用し、漢字・ひらがな・カタカナを絶対に変更しないこと（例：「竜」を「龍」に変えるなど厳禁）。
1. 【最重要】人名は文字起こしに記載されている話者ラベルをそのまま使用すること。「西郷」は「西郷」のまま、「織田」は「織田」のまま。絶対に変換・補正・漢字変換しないこと。
2. 【最重要】titleは会議コード（例：cjq-jjcp-hrh）を使わず、会議の内容から意味のある日本語タイトルを自動生成すること（例：「◯◯現場 工程調整・安全確認ミーティング」）。
3. 業務の重要事項（安全、品質、進捗、予算など）を最優先
4. 期限が明示されていない場合も文脈から推測
5. overviewは必ず200-300文字に収める
6. keyPointsは3-5個に絞る
7. actionsのdeadlineは会議日（${metadata.meetingDate}）を基準に推測
8. EXPは緊急度・複雑度・影響範囲を考慮（10-100）
9. 複数の担当者がいる場合は、assigneeに「山田, 佐藤」のようにカンマ区切りで記載

${correctionLogs ? `【このグループの過去の修正例】\n${correctionLogs}\n→ これらを参考に今回の議事録を生成してください。\n\n` : ''}JSONのみを返してください。
`.trim();
}

/**
 * メインエンドポイント: Google Meetの文字起こしを処理
 * GASから呼び出される
 * 
 * Phase 1 Week 1 - Day 3-4
 * URL: https://[region]-[project-id].cloudfunctions.net/processMeetTranscript
 */
export const processMeetTranscript = onRequest(
  {
    timeoutSeconds: 540, // 9分
    memory: "1GiB",
    secrets: [], // 後で設定
  },
  async (req, res) => {
    logger.info("processMeetTranscript called", { method: req.method });

    /**
 * Firestoreに会議データを保存
 * 
 * @param docId - Google DocsのドキュメントID
 * @param docUrl - Google DocsのURL
 * @param transcript - 会議の文字起こし
 * @param metadata - 会議のメタデータ
 * @param analysisResult - Gemini APIの分析結果
 * @returns 保存されたドキュメントID
 */
async function saveMeetingToFirestore(
  docId: string,
  docUrl: string,
  transcript: string,
  metadata: any,
  analysisResult: any,
  resolvedGroupId: string | null  // ← 追加
): Promise<string> {
  logger.info("saveMeetingToFirestore called", {
    docId,
    meetingId: analysisResult.id,
  });

  try {
    const meetingId = analysisResult.id;
    const meetingRef = db.collection("meeting_summaries").doc(meetingId);

    const meetingData = {
      // 基本情報
      docId: docId,
      docUrl: docUrl,
      meetingTitle: metadata.meetingTitle,
      meetingDate: new Date(metadata.meetingDate),
      participants: metadata.participants,
      duration: metadata.duration,
      
      // 文字起こし
      transcript: transcript,
      transcriptLength: transcript.length,
      
      // 分析結果
      summary: analysisResult.summary,
      actions: analysisResult.actions,
      insight: analysisResult.insight,

      // グループ紐付け
      status: 'draft',
      groupId: resolvedGroupId,
      publishedAt: null,
      visibleTo: resolvedGroupId ? await getGroupAdminIds(resolvedGroupId) : null,
      publishedBy: null,
      publishedByName: null,
      
      // メタデータ
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await meetingRef.set(meetingData);

    logger.info("Meeting saved to Firestore", {
      meetingId,
      path: `meeting_summaries/${meetingId}`,
    });

    return meetingId;
  } catch (error: any) {
    logger.error("saveMeetingToFirestore failed", {
      error: error.message,
      stack: error.stack,
    });
    throw new Error(`Failed to save meeting: ${error.message}`);
  }
}

/**
 * Google Sheetsに生データを保存（信頼ベースのロックイン戦略）
 * 
 * クライアント側には生データのみを保存し、
 * AI分析結果はFirestore（MYQUEST側）にのみ保存する
 * 
 * @param docId - Google DocsのドキュメントID
 * @param docUrl - Google DocsのURL
 * @param transcript - 会議の文字起こし（生データ）
 * @param metadata - 会議のメタデータ
 * @returns 成功/失敗
 */
async function saveMeetingToGoogleSheets(
  docId: string,
  docUrl: string,
  transcript: string,
  metadata: any
): Promise<void> {
  logger.info("saveMeetingToGoogleSheets called", {
    docId,
    spreadsheetId: process.env.SPREADSHEET_ID,
  });

  try {
    // TODO: Google Sheets API実装（Phase 1 Week 2で実装予定）
    // 現在は実装スキップ（ログのみ）
    
    logger.info("Google Sheets save skipped (not implemented yet)", {
      docId,
      note: "生データのみ保存予定: docId, meetingTitle, meetingDate, participants, transcript",
    });

    // 将来の実装内容:
    // 1. Google Sheets APIで認証
    // 2. スプレッドシートを開く
    // 3. 新しい行を追加:
    //    - A列: docId
    //    - B列: meetingTitle
    //    - C列: meetingDate
    //    - D列: participants (カンマ区切り)
    //    - E列: duration
    //    - F列: transcript (全文)
    //    - G列: createdAt
    //    - H列: docUrl
    
  } catch (error: any) {
    logger.error("saveMeetingToGoogleSheets failed", {
      error: error.message,
    });
    // エラーでも処理は続行（Google Sheets保存は必須ではない）
  }
}

    // CORS設定
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, X-API-Key");

    // OPTIONSリクエスト対応（プリフライト）
    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }

    // POSTメソッドのみ許可
    if (req.method !== "POST") {
      logger.warn("Invalid method", { method: req.method });
      res.status(405).json({
        success: false,
        error: "Method not allowed. Use POST.",
      });
      return;
    }

    try {
      logger.info("Processing meet transcript...");


      // Step 2: リクエストボディを取得
      const { docId, docUrl, transcript, metadata, processedAt: _processedAt } = req.body;

      // Step 3: バリデーション
      if (!transcript || !metadata) {
        logger.error("Missing required fields");
        res.status(400).json({
          success: false,
          error: "Missing required fields: transcript, metadata",
        });
        return;
      }

      logger.info("Request validated", {
        docId,
        transcriptLength: transcript.length,
        participants: metadata.participants?.length,
      });

      // Step 4: Gemini APIで会議内容を分析
logger.info("Analyzing meeting with Gemini API...");
const analysisResult = await analyzeMeetingWithGemini(transcript, metadata);
logger.info("Meeting analysis completed", {
  meetingId: analysisResult.id,
  actionsCount: analysisResult.actions?.length,
});



// Step 4.5: グループIDを特定
logger.info("Identifying group ID...");
const resolvedGroupId = await identifyGroupId(
  metadata.meetingTitle || "",
  metadata.groupNameHint
);
logger.info("Group ID resolved", { groupId: resolvedGroupId });

// Step 5: Firestoreに保存
logger.info("Saving to Firestore...");
const meetingId = await saveMeetingToFirestore(
  docId,
  docUrl,
  transcript,
  metadata,
  analysisResult,
  resolvedGroupId
);
logger.info("Saved to Firestore", { meetingId });

// Step 6: Google Sheetsに生データを保存（信頼ベースの戦略）
logger.info("Saving raw data to Google Sheets...");
await saveMeetingToGoogleSheets(docId, docUrl, transcript, metadata);
logger.info("Google Sheets save completed");

// レスポンス（分析結果を含める）
res.status(200).json({
  success: true,
  message: "Meet transcript processed successfully",
  data: {
    docId,
    transcriptLength: transcript.length,
    participants: metadata.participants,
    meetingDate: metadata.meetingDate,
    analysisResult: analysisResult, // 追加
  },
  timestamp: new Date().toISOString(),
});
} catch (error: any) {
      logger.error("processMeetTranscript failed", {
        error: error.message,
        stack: error.stack,
      });

      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }
);