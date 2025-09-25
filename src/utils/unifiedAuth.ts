// utils/unifiedAuth.ts
import { User } from '../types';
import { getUser, createUserProfile, saveUser } from '../firebase/firestore';
import { getCurrentUser as getFirebaseUser } from '../firebase/auth';

/**
 * 統一認証マネージャー
 * 複雑なsyncCurrentUser関数を置き換える軽量な認証システム
 */
export class UnifiedAuthManager {
  private static instance: UnifiedAuthManager;
  private currentUser: User | null = null;
  private isInitialized: boolean = false;

  private constructor() {}

  static getInstance(): UnifiedAuthManager {
    if (!UnifiedAuthManager.instance) {
      UnifiedAuthManager.instance = new UnifiedAuthManager();
    }
    return UnifiedAuthManager.instance;
  }

  /**
   * 現在のユーザーを取得（メイン関数）
   * 複雑なsyncCurrentUserを置き換える
   */
  async getCurrentUser(): Promise<User | null> {
    try {
      // 1. キャッシュされたユーザーを返す（パフォーマンス向上）
      if (this.isInitialized && this.currentUser) {
        return this.currentUser;
      }

      // 2. Firebase認証状態を確認
      const firebaseUser = await this.getFirebaseUser();
      if (!firebaseUser) {
        this.clearUserData();
        return null;
      }

      // 3. Firestoreからユーザーデータを取得
      let user = await getUser(firebaseUser.uid);
      
      if (!user) {
        // 4. 新規ユーザーの場合は作成
        user = await this.createNewUser(firebaseUser);
      } else {
        // 5. 既存ユーザーの場合は必要に応じて更新
        user = await this.updateExistingUser(user, firebaseUser);
      }

      // 6. データを同期・キャッシュ
      this.setCurrentUser(user);
      this.syncToLocalStorage(user);
      
      return user;

    } catch (error) {
      console.error('認証エラー:', error);
      return this.handleAuthError(error);
    }
  }

  /**
   * Firebase認証ユーザーを取得
   */
  private async getFirebaseUser(): Promise<any> {
    try {
      return await getFirebaseUser();
    } catch (error) {
      console.warn('Firebase認証取得失敗:', error);
      return null;
    }
  }

  /**
   * 新規ユーザーを作成
   */
  private async createNewUser(firebaseUser: any): Promise<User> {
    console.log('新規ユーザーを作成中:', firebaseUser.uid);
    
    // 既存のローカルデータを保護
    const existingProfileData = this.getExistingProfileData();
    
    const additionalData = {
      ...(existingProfileData && {
        profileData: existingProfileData
      })
    };

    return await createUserProfile(firebaseUser, additionalData);
  }

  /**
   * 既存ユーザーを更新
   */
  private async updateExistingUser(user: User, firebaseUser: any): Promise<User> {
    const updates: Partial<User> = {};
    let needsUpdate = false;

    // メールアドレスの更新確認
    if (user.email !== firebaseUser.email) {
      updates.email = firebaseUser.email || user.email;
      needsUpdate = true;
    }

    // プロフィール画像の更新確認
    if (firebaseUser.photoURL && user.profileImage !== firebaseUser.photoURL) {
      updates.profileImage = firebaseUser.photoURL;
      needsUpdate = true;
    }

    // 必要な場合のみ更新
    if (needsUpdate) {
      await saveUser(user.id, updates);
      return { ...user, ...updates };
    }

    return user;
  }

  /**
   * 既存のプロフィールデータを保護
   */
  private getExistingProfileData(): any {
    try {
      const existingData = localStorage.getItem('daily-report-user-data');
      if (existingData) {
        const parsed = JSON.parse(existingData);
        if (parsed.profileData?.fullName) {
          console.log('既存プロフィールデータを保護:', parsed.profileData.fullName);
          return parsed.profileData;
        }
      }
    } catch (error) {
      console.warn('既存データ読み込みエラー:', error);
    }
    return null;
  }

  /**
   * ローカルストレージに同期
   */
  private syncToLocalStorage(user: User): void {
    try {
      // 必須データをローカルストレージに保存
      localStorage.setItem('daily-report-user-id', user.id);
      localStorage.setItem('daily-report-user-email', user.email);
      localStorage.setItem('daily-report-user-role', user.role);
      localStorage.setItem('daily-report-username', user.username);
      
      // プロフィール名を優先保存
      if (user.profileData?.fullName) {
        localStorage.setItem('daily-report-profile-name', user.profileData.fullName);
      }
      
      // 完全なユーザーデータも保存
      localStorage.setItem('daily-report-user-data', JSON.stringify(user));
      
      console.log('ローカルストレージ同期完了:', user.username);
    } catch (error) {
      console.error('ローカルストレージ同期エラー:', error);
    }
  }

  /**
   * 現在のユーザーをキャッシュに設定
   */
  private setCurrentUser(user: User): void {
    this.currentUser = user;
    this.isInitialized = true;
  }

  /**
   * ユーザーデータをクリア
   */
  private clearUserData(): void {
    this.currentUser = null;
    this.isInitialized = false;
    
    // ローカルストレージからも削除
    const keysToRemove = [
      'daily-report-user-id',
      'daily-report-user-email', 
      'daily-report-user-role',
      'daily-report-username',
      'daily-report-profile-name',
      'daily-report-user-data'
    ];
    
    keysToRemove.forEach(key => localStorage.removeItem(key));
  }

  /**
   * エラーハンドリング
   */
  private async handleAuthError(error: any): Promise<User | null> {
    console.error('認証エラーハンドリング:', error);
    
    // 緊急時のフォールバック
    const fallbackUserId = localStorage.getItem('daily-report-user-id');
    if (fallbackUserId) {
      try {
        const fallbackUser = await getUser(fallbackUserId);
        if (fallbackUser) {
          console.log('フォールバックユーザーを使用:', fallbackUserId);
          return fallbackUser;
        }
      } catch (fallbackError) {
        console.warn('フォールバック失敗:', fallbackError);
      }
    }

    // 完全に失敗した場合はクリア
    this.clearUserData();
    return null;
  }

  /**
   * 管理者権限確認
   */
  async isAdmin(): Promise<boolean> {
    const user = await this.getCurrentUser();
    return user?.role === 'admin' && user?.email === 'info@ayustat.co.jp';
  }

  /**
   * ログアウト処理
   */
  async logout(): Promise<void> {
    this.clearUserData();
    // Firebase認証からもログアウト
    // TODO: Firebase auth.signOut() を呼び出し
  }

  /**
   * 初期化状態をリセット（テスト用）
   */
  reset(): void {
    this.currentUser = null;
    this.isInitialized = false;
  }
}