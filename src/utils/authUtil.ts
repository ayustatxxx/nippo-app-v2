// src/utils/authUtil.ts - 既存ファイル完全対応版
import { User } from "../types";
import { 
  getCurrentUser as getFirebaseCurrentUser,
  onAuthStateChange 
} from "../firebase/auth";
import { 
  getUser as getFirestoreUser,
  saveUser as saveFirestoreUser,
  createUserProfile as createFirestoreUser
} from "../firebase/firestore";

import { Group } from '../types';

/**
 * ユーザーデータの完全同期管理クラス
 * リロード時のデータ消失問題を根本解決
 */
class UserSyncManager {
  private static instance: UserSyncManager;
  private currentUser: User | null = null;
  private syncInProgress = false;

  private constructor() {
    // 認証状態の監視を開始
    this.initializeAuthListener();
  }

  static getInstance(): UserSyncManager {
    if (!UserSyncManager.instance) {
      UserSyncManager.instance = new UserSyncManager();
    }
    return UserSyncManager.instance;
  }

  /**
   * Firebase認証状態をリアルタイム監視
   * ログイン/ログアウト時に自動同期
   */
  private initializeAuthListener(): void {
    try {
      onAuthStateChange(async (firebaseUser) => {
        console.log('認証状態変更:', firebaseUser?.email || 'ログアウト');
        
        if (firebaseUser) {
          // ログイン時：自動同期実行
          await this.syncUser();
        } else {
          // ログアウト時：全データクリア
          this.clearAllData();
        }
      });
    } catch (error) {
      console.error('認証監視エラー:', error);
    }
  }

  /**
   * 完全なユーザー同期処理
   * Firebase → Firestore → localStorage の順で確実に同期
   */
  async syncUser(): Promise<User | null> {
    if (this.syncInProgress) {
      // 同期中の場合は現在のユーザーを返却
      return this.currentUser;
    }

    try {
      this.syncInProgress = true;
      console.log('ユーザー同期開始');

      // Step 1: Firebase認証ユーザー取得
      const firebaseUser = getFirebaseCurrentUser();
      if (!firebaseUser) {
        console.log('Firebase認証なし - ローカルデータクリア');
        this.clearAllData();
        return null;
      }

      // Step 2: Firestoreからユーザー詳細取得
      let firestoreUser = await getFirestoreUser(firebaseUser.uid);
      
      // Step 3: Firestoreにユーザーが存在しない場合は新規作成
      if (!firestoreUser) {
        console.log('新規ユーザー作成:', firebaseUser.email);
        
        firestoreUser = await createFirestoreUser(firebaseUser, {
          username: firebaseUser.displayName || this.extractDisplayNameFromEmail(firebaseUser.email || ''),
          company: '未設定',
          position: '未設定'
        });
      }

      if (!firestoreUser) {
        throw new Error('Firestoreユーザー作成に失敗');
      }

      // Step 4: ローカルストレージに安全に保存
      this.saveToLocalStorage(firestoreUser);
      
      // Step 5: メモリ上のインスタンス変数に保存
      this.currentUser = firestoreUser;

      console.log('ユーザー同期完了:', {
        id: firestoreUser.id,
        email: firestoreUser.email,
        displayName: firestoreUser.displayName
      });

      return firestoreUser;

    } catch (error) {
      console.error('ユーザー同期エラー:', error);
      
      // エラー時はローカルストレージからフォールバック
      const fallbackUser = this.loadFromLocalStorage();
      if (fallbackUser) {
        console.log('ローカルストレージからフォールバック');
        this.currentUser = fallbackUser;
      }
      
      return fallbackUser;
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * ユーザー情報の更新（Firestore + ローカル同期）
   */
  async updateUser(updates: Partial<User>): Promise<User | null> {
    if (!this.currentUser) {
      console.error('更新対象ユーザーなし');
      return null;
    }

    try {
      console.log('ユーザー情報更新開始:', updates);

      // Firestoreを更新（saveUser関数を使用）
      await saveFirestoreUser(this.currentUser.id, {
        ...this.currentUser,
        ...updates,
        updatedAt: Date.now()
      });

      // 更新されたユーザー情報を再取得
      const updatedUser = await getFirestoreUser(this.currentUser.id);
      
      if (!updatedUser) {
        throw new Error('Firestore更新後の取得に失敗');
      }

      // ローカルストレージも同期
      this.saveToLocalStorage(updatedUser);
      this.currentUser = updatedUser;

      console.log('ユーザー情報更新完了');
      return updatedUser;

    } catch (error) {
      console.error('ユーザー更新エラー:', error);
      return null;
    }
  }

  /**
   * ローカルストレージへの安全な保存
   */
  private saveToLocalStorage(user: User): void {
    try {
      const userData = JSON.stringify(user);
      
      // 複数の場所に保存して冗長性確保
      localStorage.setItem("daily-report-user", userData);
      localStorage.setItem("daily-report-user-id", user.id);
      sessionStorage.setItem("daily-report-user", userData);
      
      console.log('ローカルストレージ保存完了');
    } catch (error) {
      console.error('ローカルストレージ保存エラー:', error);
    }
  }

  /**
   * ローカルストレージからの安全な読み込み
   */
  private loadFromLocalStorage(): User | null {
    try {
      // localStorage優先、sessionStorageをフォールバック
      let userData = localStorage.getItem("daily-report-user");
      if (!userData) {
        userData = sessionStorage.getItem("daily-report-user");
      }

      if (userData) {
        const user = JSON.parse(userData) as User;
        console.log('ローカルストレージから読み込み:', user.email);
        return user;
      }
    } catch (error) {
      console.error('ローカルストレージ読み込みエラー:', error);
    }
    return null;
  }

  /**
   * 全ローカルデータの完全クリア
   */
  private clearAllData(): void {
    try {
      // 全ストレージをクリア
      localStorage.removeItem("daily-report-user");
      localStorage.removeItem("daily-report-user-id");
      sessionStorage.removeItem("daily-report-user");
      
      // メモリ上のデータもクリア
      this.currentUser = null;
      
      console.log('全ローカルデータクリア完了');
    } catch (error) {
      console.error('データクリアエラー:', error);
    }
  }

  /**
   * メールアドレスから表示名を抽出
   */
  private extractDisplayNameFromEmail(email: string): string {
    const username = email.split('@')[0];
    return username || 'ユーザー';
  }

  /**
   * 現在のユーザー取得（同期済み）
   */
  getCurrentUser(): User | null {
    return this.currentUser;
  }
}

// シングルトンインスタンス生成
const syncManager = UserSyncManager.getInstance();




/**
 * 外部公開API: 現在のユーザー取得
 * 必ず同期済みのユーザー情報を返却
 */
export const getCurrentUser = async (): Promise<User | null> => {
  try {
    return await syncManager.syncUser();
  } catch (error) {
    console.error('getCurrentUserエラー:', error);
    return null;
  }
};

/**
 * 外部公開API: ユーザー情報更新
 */
export const updateCurrentUser = async (updates: Partial<User>): Promise<User | null> => {
  try {
    return await syncManager.updateUser(updates);
  } catch (error) {
    console.error('updateCurrentUserエラー:', error);
    return null;
  }
};

/**
 * 外部公開API: 管理者権限確認
 */
export const isAdmin = async (): Promise<boolean> => {
  try {
    const user = await getCurrentUser();
    return user?.role === 'admin' || false;
  } catch (error) {
    console.error('isAdminエラー:', error);
    return false;
  }
};

/**
 * 外部公開API: 表示名取得
 */
export const getUserDisplayName = async (): Promise<string> => {
  try {
    const user = await getCurrentUser();
    if (!user) return 'ユーザー';
    
    // 優先順位: displayName → fullName → username → emailの@前部分
    return user.displayName && user.displayName !== '未設定' ? 
           user.displayName : 
           (user.fullName && user.fullName !== '未設定' ? 
            user.fullName : 
            (user.username || user.email.split('@')[0] || 'ユーザー'));
  } catch (error) {
    console.error('getUserDisplayNameエラー:', error);
    return 'ユーザー';
  }
};

/**
 * 外部公開API: 即座のユーザー取得（同期なし）
 * パフォーマンス重視の場合に使用
 */
export const getCurrentUserSync = (): User | null => {
  return syncManager.getCurrentUser();
};

/**
 * 外部公開API: ユーザーロール取得（既存コードとの互換性）
 */
export const getUserRole = async (): Promise<'admin' | 'user'> => {
  try {
    const user = await getCurrentUser();
    return user?.role === 'admin' ? 'admin' : 'user';
  } catch (error) {
    console.error('getUserRoleエラー:', error);
    return 'user';
  }
};

/**
 * 外部公開API: グループ管理者権限確認
 */
export const isGroupAdmin = async (userId?: string, groupId?: string): Promise<boolean> => {
  try {
    const user = await getCurrentUser();
    if (!user) return false;
    
    // 基本的な管理者権限チェック
    if (user.role === 'admin') return true;
    
    // TODO: 将来的にグループ別の管理者権限チェックを実装
    // 現在は基本的な管理者権限のみチェック
    return false;
  } catch (error) {
    console.error('isGroupAdminエラー:', error);
    return false;
  }
};

/**
 * 外部公開API: グループ作成権限確認
 */
export const canCreateGroup = async (): Promise<boolean> => {
  try {
    const user = await getCurrentUser();
    return true; // 実証実験用に権限を緩和
  } catch (error) {
    console.error('canCreateGroupエラー:', error);
    return false;
  }
};


// ===== グループ別権限管理関数 =====

/**
 * ユーザーの特定グループでの権限を取得
 */
export const getUserGroupRole = (userId: string, group: Group): 'admin' | 'user' | null => {
  if (!userId || !group) return null;
  
  console.log('権限チェック開始:', { userId, groupId: group.id, groupName: group.name });
  
  // 1. 作成者チェック（最優先）
  if (group.createdBy === userId) {
    console.log('作成者として管理者権限:', group.createdBy);
    return 'admin';
  }
  
  // 2. メイン管理者チェック
  if (group.adminId === userId) {
    console.log('メイン管理者として管理者権限:', group.adminId);
    return 'admin';
  }
  
  // 3. 複数管理者チェック
  if (group.adminIds && group.adminIds.includes(userId)) {
    console.log('副管理者として管理者権限:', group.adminIds);
    return 'admin';
  }
  
  // 4. 一般メンバーチェック
  if (group.members) {
    const isMember = group.members.some(member => {
      const memberId = typeof member === 'string' ? member : member.id;
      return memberId === userId;
    });
    
    if (isMember) {
      console.log('一般メンバーとして参加:', userId);
      return 'user';
    }
  }
  
  console.log('グループに参加していません:', userId);
  return null;
};

/**
 * ユーザーが特定グループを管理できるかチェック
 */
export const canManageGroup = (userId: string, group: Group): boolean => {
  const role = getUserGroupRole(userId, group);
  const canManage = role === 'admin';
  
  console.log('グループ管理権限:', { 
    userId, 
    groupId: group.id, 
    role, 
    canManage 
  });
  
  return canManage;
};

/**
 * ユーザーが管理者として参加しているグループ一覧を取得
 */
export const getManagedGroups = (userId: string, groups: Group[]): Group[] => {
  if (!userId || !groups) return [];
  
  const managedGroups = groups.filter(group => canManageGroup(userId, group));
  
  console.log('管理中のグループ数:', managedGroups.length);
  
  return managedGroups;
};

/**
 * ユーザーが少なくとも1つのグループを管理しているかチェック
 */
export const hasAnyManagedGroups = (userId: string, groups: Group[]): boolean => {
  const hasManagedGroups = getManagedGroups(userId, groups).length > 0;
  
  console.log('管理グループの有無:', hasManagedGroups);
  
  return hasManagedGroups;
};


// authUtil.ts の最後に追加
export const isUserMemberOfGroup = (userId: string, group: Group): boolean => {
  const role = getUserGroupRole(userId, group);
  return role !== null; // 'admin' または 'user' なら参加中
};