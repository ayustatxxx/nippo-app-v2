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

// ===== Post型定義（displayName対応版） =====
export interface Post {
  id: string;
  
  // 作成者情報（複数形式対応）
  userId?: string;
  authorId?: string;
  userID?: string;          // 新しいuserID
  username?: string;        // 後方互換性
  displayName?: string;     // 投稿者の表示名
  
  // グループ情報
  groupId: string;
  groupName?: string;
  
  // 基本投稿内容
  message: string;
  photoUrls?: string[];
  images?: string[];
  tags?: string[];
  
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
  
  // ステータス管理
  status: PostStatus;
  statusUpdatedAt?: number;
  statusUpdatedBy?: string;
  statusUpdatedByName?: string;
  
  // メモ機能
  memos?: Memo[];
  
  // 追加プロパティ（エラー回避用）
  name?: string;
  position?: string;
  company?: string;
  location?: string;
  
  [key: string]: any;

  readBy?: { [userId: string]: number }; // userId: timestamp
  readCount?: number; // 既読者数（パフォーマンス向上用）
  
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