// types/index.ts - データ構造改善版

// ===== 基本的な型定義 =====
export type PostStatus = '未確認' | '確認済み';
export type UserRole = 'admin' | 'user';
export type ReportFrequency = 'daily' | 'weekly' | 'monthly' | 'custom';
export type TabType = 'post' | 'history' | 'members';

// ===== User型定義（改善版 - userID、displayName、fullNameの明確化） =====
export interface User {
  id: string;
  email: string;
  
  // 認証・識別用（サインアップ時登録）
  userID?: string;       // 8-20文字英数字、一意識別子（旧username）
  
  // 表示用（招待時・グループ内での呼び名）
  displayName?: string;     // アプリ内表示名
  
  // 本人確認用（Profile登録時）
  fullName?: string;        // 正式な氏名
  
  role: UserRole;
  systemRole?: 'system_admin';
  
  // プロファイル情報（すべてオプショナル）
  active?: boolean;
  isActive?: boolean;
  profileImage?: string;
  company?: string;
  position?: string;
  phone?: string;
  
  // グループ情報
  groups?: string[];
  
  // 詳細プロファイル
  profileData?: {
    fullName?: string;
    company?: string;
    position?: string;
    phone?: string;
  };
  
  // 設定
  settings: {
    notifications: boolean;
    reportFrequency: ReportFrequency;
    theme?: 'light' | 'dark';
  };
  
  // Profile完成管理
  profileCompleted?: boolean;
  
  // タイムスタンプ
  createdAt: number;
  updatedAt: number;
  
  // 後方互換性のため残す（段階的移行用）
  username?: string;        // 廃止予定、userIDに移行
}

// ===== GroupMember/Member型定義（displayName対応版） =====
export interface GroupMember {
  id: string;
  userID?: string;          // 新しいuserID
  username?: string;        // 後方互換性
  displayName?: string;     // グループ内表示名
  email?: string;
  role: UserRole;
  
  // 状態管理（両方をサポート）
  active?: boolean;
  isActive?: boolean;
  
  // 管理者フラグ（GroupMembersPageで必要）
  isAdmin: boolean;
  
  // 複数のID形式をサポート
  userId?: string;
  uid?: string;
  _id?: string;
  
  joinedAt: number;
  
  profileData?: {
    fullName?: string;
    company?: string;
    position?: string;
    phone?: string;
  };
}

// ===== Group型定義（完全版） =====
export interface Group {
  id: string;
  name: string;
  description: string;
  address?: string;
  
  // 管理者情報
  adminId?: string;
  adminIds?: string[];
  createdBy?: string;
  
  // メンバー情報（柔軟対応）
  members?: GroupMember[];
  memberIds?: string[];
  
  // 削除機能
  isDeleted?: boolean;
  deletedAt?: number;
  deletedBy?: string;
  permanentlyDeleted?: boolean;
  permanentDeletedAt?: number;
  
  // 招待機能
  inviteCode?: string;
  
  // 設定
  settings: {
    reportDeadline: string;
    reportFrequency?: ReportFrequency;
    reportSettings?: {
      frequency?: ReportFrequency;
      customDays?: number;
    };
    allowMemberInvite?: boolean;
    autoArchive?: boolean;
    location?: {
      address?: string;
      coordinates?: { lat: number; lng: number; };
    };
  };
  
  // タイムスタンプ
  createdAt: number;
  updatedAt: number;
}


// ===== Post型定義（2モード設計 + AI/RAG準備対応版） =====
export interface Post {
  id: string;
  
  // 作成者情報（複数形式対応）
  userId?: string;
  authorId?: string;
  userID?: string;
  username?: string;
  displayName?: string;
  
  // グループ情報
  groupId: string;
  groupName?: string;
  
  // 会社情報（ハイブリッド方式）
  companyName?: string;      // 現在使用：会社名テキスト
  companyId?: string;        // 将来用：会社ID参照
  
  // 基本投稿内容
  message: string;
  tags?: string[];
  
  // ===== 画像データ（後方互換性維持） =====
  photoUrls?: string[];      // 既存：全画像配列
  images?: string[];         // 既存：全画像配列（別名）
  
  // ===== 2モード設計（新規） =====
  thumbnails?: {
    highQuality: string[];   // 高画質サムネイル（最大5枚）
    standard: string[];      // 通常サムネイル（最大10枚）
  };
  highQualityCount?: number; // 高画質画像の枚数
  standardCount?: number;    // 通常画像の枚数
  totalImageCount?: number;  // 合計枚数
  
  // ===== アップロード状態管理（段階アップロード用） =====
  uploadStatus?: 'completed' | 'uploading' | 'partial' | 'failed';
  uploadProgress?: {
    highQuality: { total: number; uploaded: number };
    standard: { total: number; uploaded: number };
  };
  lastUploadAt?: number;
  
  // ===== AI活用準備（将来用） =====
  scheduleId?: string;       // 紐づくスケジュールID
  aiTags?: string[];         // AI生成タグ
  aiSummary?: string;        // AI生成要約
  extractedText?: string;    // OCR抽出テキスト
  
  // ===== RAG/ベクトル検索準備（将来用） =====
  embedding?: number[];      // ベクトル埋め込み（意味検索用）
  embeddingModel?: string;   // 使用した埋め込みモデル（例：text-embedding-3-small）
  embeddingUpdatedAt?: number; // 埋め込み更新日時
  keywords?: string[];       // 抽出キーワード（検索高速化）
  categories?: string[];     // カテゴリ分類（工事種別等）
  sentiment?: 'positive' | 'neutral' | 'negative' | 'concern'; // 感情分析
  
  // 時間情報
  time?: string;
  timestamp?: number;
  createdAt: number;
  updatedAt?: number;
  
  // 作業時間投稿
  isWorkTimePost?: boolean;
  checkInTime?: number;
  checkOutTime?: number;
  workDuration?: number;
  
  // 編集履歴
  isEdited?: boolean;
  isManuallyEdited?: boolean;
  editedAt?: number;
  
  // ステータス管理
  status?: PostStatus;  // 🔄 後方互換性のため残す（オプショナルに変更）
  statusByUser?: { [userId: string]: string };  // 🆕 ユーザーごとのステータス
  statusUpdatedAt?: number;
  statusUpdatedBy?: string;
  statusUpdatedByName?: string;
  
  // メモ機能
  memos?: Memo[];
  
  // 既読管理
  readBy?: { [userId: string]: number };
  readCount?: number;
  
  // 追加プロパティ（エラー回避用）
  name?: string;
  position?: string;
  company?: string;
  location?: string;
  
  [key: string]: any;
}


// ===== 2モード設計：サブコレクション用型定義 =====
export interface DocumentImage {
  id: string;
  postId: string;
  image: string;             // 1000px圧縮済み画像
  order: number;
  uploadedAt: number;
  
  // AI準備フィールド（将来用）
  ocrText?: string;          // OCR結果
  documentType?: string;     // 書類タイプ（図面、契約書等）
  aiAnalysis?: string;       // AI分析結果
  embedding?: number[];      // 画像単位のベクトル埋め込み
}

export interface PhotoImage {
  id: string;
  postId: string;
  image: string;             // 720px圧縮済み画像
  order: number;
  uploadedAt: number;
  
  // AI準備フィールド（将来用）
  location?: string;         // GPS位置情報
  aiAnalysis?: string;       // AI分析結果
  embedding?: number[];      // 画像単位のベクトル埋め込み
}

// ===== アップロード設定型 =====
export interface ImageUploadConfig {
  maxHighQuality: number;    // 高画質最大枚数（5）
  maxStandard: number;       // 通常最大枚数（10）
  maxTotal: number;          // 合計最大枚数（15）
  highQualitySettings: {
    maxWidth: number;        // 1000px 
    quality: number;         // 0.40 
  };
  standardSettings: {
    maxWidth: number;        // 720px
    quality: number;         // 0.27
  };
}

// ===== デフォルト設定 =====
export const DEFAULT_IMAGE_CONFIG: ImageUploadConfig = {
  maxHighQuality: 5,
  maxStandard: 10,
  maxTotal: 15,
  highQualitySettings: {
    maxWidth: 1500,   // 図面・書類が読める解像度
    quality: 0.55,    // 文字が潰れない品質
  },
  standardSettings: {
    maxWidth: 720,    // 現場写真用
    quality: 0.27,    // 通常圧縮
  },
};

// ===== 画像容量管理（動的枚数制限用） =====
export const IMAGE_CAPACITY = {
  maxCapacityKB: 750,      // Firestore保存時の上限容量（Base64前）
  highQualityKB: 200,      // 高画質1枚の目標サイズ
  standardKB: 50,          // 通常画質1枚の目標サイズ（実際の設定）
  diffKB: 150,             // 通常→高画質の差分（200 - 50）
};

// ===== アンケート関連型定義（将来用） =====
export type SurveyQuestionType = 'choice' | 'multiple' | 'text' | 'rating' | 'scale';
export type SurveyStatus = 'draft' | 'active' | 'closed' | 'archived';
export type SurveyCategory = 'health' | 'safety' | 'feedback' | 'operations' | 'client' | 'custom';

export interface SurveyQuestion {
  id: string;
  questionText: string;
  questionType: SurveyQuestionType;
  choices?: string[];        // 選択肢（choice/multiple用）
  required: boolean;
  order: number;
  
  // AI分析用メタデータ
  analysisHint?: string;     // AIへの分析ヒント（例：「メンタルヘルス指標」）
  weightForScoring?: number; // スコアリング用重み付け
}

export interface Survey {
  id: string;
  groupId: string;
  companyId?: string;
  createdBy: string;
  
  // 基本情報
  title: string;
  description?: string;
  category: SurveyCategory;
  
  // 質問
  questions: SurveyQuestion[];
  
  // 期間・状態
  status: SurveyStatus;
  startDate?: number;
  endDate?: number;
  isAnonymous: boolean;      // 匿名回答かどうか
  
  // 設定
  allowMultipleResponses: boolean;  // 複数回回答可能か
  notifyOnResponse: boolean;        // 回答時に通知するか
  
  // タイムスタンプ
  createdAt: number;
  updatedAt: number;
  
  // AI/RAG準備
  aiSummary?: string;        // AI生成の回答サマリー
  embedding?: number[];      // アンケート全体のベクトル埋め込み
}

export interface SurveyResponse {
  id: string;
  surveyId: string;
  groupId: string;
  respondentId?: string;     // 匿名の場合はnull
  
  // 回答データ
  answers: {
    questionId: string;
    answer: string | string[] | number;  // テキスト、選択肢、評価値
  }[];
  
  // メタデータ
  submittedAt: number;
  deviceInfo?: string;
  
  // AI/RAG準備
  sentiment?: 'positive' | 'neutral' | 'negative' | 'concern';
  aiAnalysis?: string;       // AI分析結果
  embedding?: number[];      // 回答のベクトル埋め込み
  flaggedForReview?: boolean; // 要確認フラグ（異常値検出時）
}

// ===== AI分析結果型（グループ全体のサマリー用） =====
export interface GroupAIInsights {
  groupId: string;
  generatedAt: number;
  
  // 日報分析
  postsSummary?: string;           // 日報全体の要約
  postsTopKeywords?: string[];     // 頻出キーワード
  postsTrends?: string;            // トレンド分析
  
  // アンケート分析
  surveySummary?: string;          // アンケート回答の要約
  surveyAlerts?: string[];         // 注意が必要な回答
  
  // 総合分析
  teamMorale?: 'high' | 'medium' | 'low';  // チーム士気
  safetyScore?: number;            // 安全スコア（0-100）
  productivityScore?: number;      // 生産性スコア（0-100）
  
  // 推奨アクション
  recommendations?: string[];
}

// ===== Memo型定義 =====
export interface Memo {
  id: string;
  content: string;
  createdAt: number;
  createdBy: string;
  createdByName: string;
  postId: string;
  imageUrls?: string[];
  tags?: string[];
  status?: string;
}

// ===== バリデーション型定義 =====
export interface UserIDValidation {
  isValid: boolean;
  message?: string;
}

// ===== ヘルパー関数の型定義 =====
export interface UserHelpers {
  validateUserID: (userID: string) => UserIDValidation;
  getDisplayName: (user: User) => string;
  getUserID: (user: User) => string;
}

// ===== 認証関連型定義 =====
export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

// ===== API応答型定義 =====
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// ===== 検索・フィルター型定義 =====
export interface SearchFilters {
  dateRange?: {
    start: Date;
    end: Date;
  };
  groups?: string[];
  users?: string[];
  tags?: string[];
  status?: PostStatus[];
  keyword?: string;
}

// ===== ページネーション型定義 =====
export interface PaginationOptions {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// ===== 設定型定義 =====
export interface AppSettings {
  theme: 'light' | 'dark';
  language: 'ja' | 'en';
  notifications: {
    email: boolean;
    push: boolean;
    inApp: boolean;
  };
  privacy: {
    shareProfileImage: boolean;
    shareContactInfo: boolean;
  };
}

// ===== ユーティリティ型定義 =====
export type StringOrNumber = string | number;
export type AnyObject = { [key: string]: any };
export type FlexibleReportFrequency = ReportFrequency | string;
export type FlexibleUserRole = UserRole | string;

// ===== Header Props型定義 =====
export interface HeaderProps {
  title: string;
  showBack?: boolean;
  showSearch?: boolean;
  onBack?: () => void;
  onSearch?: () => void;
}