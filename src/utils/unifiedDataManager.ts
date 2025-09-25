// src/utils/unifiedDataManager.ts
// 統一データ管理システム - 全データアクセスの単一インターフェース

import { User, Group, Post } from '../types';
import { 
  getUser as getFirestoreUser,
  getUserGroups as getFirestoreUserGroups,
  createUserProfile,
  saveUser as saveFirestoreUser
} from '../firebase/firestore';
import { getCurrentUser as getFirebaseUser } from '../firebase/auth';
import { DBUtil, STORES } from './dbUtil';

// 統一ユーザー型（将来の型統一に向けた準備）
export interface UnifiedUser extends User {
  displayName: string; // 統一表示名
}

/**
 * 統一データマネージャー
 * 全てのデータアクセスを単一インターフェースで管理
 */
export class UnifiedDataManager {
  private static instance: UnifiedDataManager;
  private userCache = new Map<string, UnifiedUser>();
  private groupCache = new Map<string, Group>();
  private postsCache = new Map<string, Post[]>();
  private initialized = false;

  private constructor() {}

  public static getInstance(): UnifiedDataManager {
    if (!UnifiedDataManager.instance) {
      UnifiedDataManager.instance = new UnifiedDataManager();
    }
    return UnifiedDataManager.instance;
  }

  /**
   * 現在のユーザーを確実に取得
   * 優先順位: Firestore → LocalStorage復元
   */
  async getCurrentUser(): Promise<UnifiedUser | null> {
    try {
      console.log('🔍 UnifiedDataManager: ユーザー取得開始');
      
      // 1. Firebase認証確認
      const firebaseUser = getFirebaseUser();
      if (!firebaseUser) {
        console.log('❌ Firebase認証ユーザーなし');
        return null;
      }

      const userId = firebaseUser.uid;
      console.log('✅ Firebase認証ユーザー確認:', firebaseUser.email);

      // 2. キャッシュ確認
      if (this.userCache.has(userId)) {
        console.log('📋 キャッシュからユーザー取得');
        return this.userCache.get(userId)!;
      }

      // 3. Firestoreから取得
      try {
        const firestoreUser = await getFirestoreUser(userId);
        if (firestoreUser) {
          const unifiedUser = this.normalizeUser(firestoreUser);
          this.userCache.set(userId, unifiedUser);
          this.syncToLocal(unifiedUser);
          console.log('✅ Firestoreからユーザー取得成功:', unifiedUser.displayName);
          return unifiedUser;
        }
      } catch (firestoreError) {
        console.warn('⚠️ Firestore取得失敗、ローカル復元を試行:', firestoreError);
      }

      // 4. ローカルストレージから復元
      const restoredUser = await this.restoreFromLocal(userId, firebaseUser);
      if (restoredUser) {
        console.log('💾 ローカルストレージから復元成功');
        return restoredUser;
      }

      console.log('❌ 全ての方法でユーザー取得失敗');
      return null;

    } catch (error) {
      console.error('❌ getCurrentUser エラー:', error);
      return null;
    }
  }

  /**
   * グループベースの投稿取得（他ユーザー投稿含む）
   * 現在の最重要問題を解決
   */
  async getGroupPosts(groupId: string): Promise<Post[]> {
    try {
      console.log('📊 グループ投稿取得開始:', groupId);

      // キャッシュ確認
      const cacheKey = `group_${groupId}`;
      if (this.postsCache.has(cacheKey)) {
        console.log('📋 キャッシュから投稿取得');
        return this.postsCache.get(cacheKey)!;
      }

      // 1. グループメンバー取得
      const group = await this.getGroup(groupId);
      if (!group || !group.members) {
        console.log('⚠️ グループまたはメンバー情報なし');
        return [];
      }

      // 2. 全メンバーの投稿を取得
      const allPosts: Post[] = [];
      
      // Firestoreから取得を試行
      try {
        const firestorePosts: Post[] = [];
        
        // 各メンバーの投稿を個別に取得
        if (group.members && Array.isArray(group.members)) {
          for (const member of group.members) {
            const memberId = typeof member === 'string' ? member : member.id || member.userId;
            
            if (memberId) {
              try {
                // IndexedDBから該当メンバーの投稿を取得
                const dbUtil = DBUtil.getInstance();
                const memberPosts = await dbUtil.getByIndex<Post>(STORES.POSTS, 'authorId', memberId);
                
                // グループIDも確認（さらに絞り込み）
                const groupFilteredPosts = memberPosts.filter(post => 
                  post.groupId === groupId || !post.groupId // groupIdが未設定の場合は含める
                );
                
                firestorePosts.push(...groupFilteredPosts);
                console.log(`メンバー ${memberId} の投稿:`, groupFilteredPosts.length, '件');
              } catch (memberError) {
                console.warn(`メンバー ${memberId} の投稿取得失敗:`, memberError);
              }
            }
          }
        }
        
        if (firestorePosts && firestorePosts.length > 0) {
          console.log('投稿取得成功:', firestorePosts.length, '件');
          allPosts.push(...firestorePosts);
        }
      } catch (firestoreError) {
        console.warn('投稿取得失敗:', firestoreError);
      }

      // IndexedDBからも取得（補完用）
      try {
        const dbUtil = DBUtil.getInstance();
        await dbUtil.initDB();
        
        // 全ての投稿を取得してグループでフィルタリング
        const allLocalPosts = await dbUtil.getAll<Post>(STORES.POSTS);
        const groupLocalPosts = allLocalPosts.filter(post => 
          post.groupId === groupId || !post.groupId
        );
        
        // 重複除去しながらマージ
        const existingIds = new Set(allPosts.map(p => p.id));
        const uniqueLocalPosts = groupLocalPosts.filter(p => !existingIds.has(p.id));
        allPosts.push(...uniqueLocalPosts);
        
        console.log('IndexedDBから追加投稿:', uniqueLocalPosts.length, '件');
      } catch (localError) {
        console.warn('IndexedDB投稿取得失敗:', localError);
      }

      // 3. 投稿者の表示名を統一
      const postsWithDisplayNames = await Promise.all(
        allPosts.map(async (post) => {
          const displayName = await this.getDisplayName(post.authorId || post.userId);
          return {
            ...post,
            displayName,
            username: displayName // 既存コードとの互換性
          };
        })
      );

      // 4. 時系列順にソート
      const sortedPosts = postsWithDisplayNames.sort((a, b) => 
        (b.createdAt || b.timestamp || 0) - (a.createdAt || a.timestamp || 0)
      );

      // キャッシュに保存
      this.postsCache.set(cacheKey, sortedPosts);
      
      console.log('✅ グループ投稿取得完了:', sortedPosts.length, '件');
      return sortedPosts;

    } catch (error) {
      console.error('❌ getGroupPosts エラー:', error);
      return [];
    }
  }

  /**
   * 統一表示名取得
   * 全画面で一貫した表示名を保証
   */
  async getDisplayName(userId: string): Promise<string> {
    try {
      if (!userId || userId === 'undefined') {
        return 'ユーザー';
      }

      // 1. キャッシュから確認
      if (this.userCache.has(userId)) {
        const user = this.userCache.get(userId)!;
        return user.displayName;
      }

      // 2. Firestoreから取得
      try {
        const user = await getFirestoreUser(userId);
        if (user) {
          const normalizedUser = this.normalizeUser(user);
          this.userCache.set(userId, normalizedUser);
          return normalizedUser.displayName;
        }
      } catch (error) {
        console.warn('⚠️ 表示名Firestore取得失敗:', userId);
      }

      // 3. 現在のユーザーの場合はローカルストレージから
      const currentUser = await this.getCurrentUser();
      if (currentUser && currentUser.id === userId) {
        return currentUser.displayName;
      }

      return 'ユーザー';

    } catch (error) {
      console.error('❌ getDisplayName エラー:', error);
      return 'ユーザー';
    }
  }

  /**
   * グループ情報取得
   */
  async getGroup(groupId: string): Promise<Group | null> {
    try {
      // キャッシュ確認
      if (this.groupCache.has(groupId)) {
        return this.groupCache.get(groupId)!;
      }

    
      // Firestoreから取得をスキップ（IndexedDBから取得）
      console.log('📱 IndexedDBからグループ取得:', groupId);

      // IndexedDBからフォールバック
      const dbUtil = DBUtil.getInstance();
      await dbUtil.initDB();
      const group = await dbUtil.get<Group>(STORES.GROUPS, groupId);
      
      if (group) {
        this.groupCache.set(groupId, group);
      }

      return group;

    } catch (error) {
      console.error('❌ getGroup エラー:', error);
      return null;
    }
  }

  /**
   * キャッシュ無効化（投稿作成後等）
   */
  invalidateCache(type: 'posts' | 'groups' | 'users' | 'all' = 'all'): void {
    switch (type) {
      case 'posts':
        this.postsCache.clear();
        break;
      case 'groups':
        this.groupCache.clear();
        break;
      case 'users':
        this.userCache.clear();
        break;
      case 'all':
        this.postsCache.clear();
        this.groupCache.clear();
        this.userCache.clear();
        break;
    }
    console.log('🗑️ キャッシュ無効化:', type);
  }

  /**
   * ユーザー正規化（6つの名前フィールドを統一）
   */
  private normalizeUser(user: any): UnifiedUser {
    // 表示名の優先順位を決定
    const displayName = user.profileData?.fullName || 
                       user.displayName || 
                       user.fullName || 
                       user.username || 
                       'ユーザー';

    return {
      ...user,
      displayName,
      username: displayName, // 既存コードとの互換性
      profileData: {
        ...user.profileData,
        fullName: displayName
      }
    } as UnifiedUser;
  }

  /**
   * ローカルストレージに同期
   */
  private syncToLocal(user: UnifiedUser): void {
    try {
      localStorage.setItem('daily-report-user-data', JSON.stringify(user));
      localStorage.setItem('daily-report-user-id', user.id);
      localStorage.setItem('daily-report-displayname', user.displayName);
      console.log('💾 ローカルストレージ同期完了');
    } catch (error) {
      console.error('❌ ローカルストレージ同期エラー:', error);
    }
  }

  /**
   * ローカルストレージから復元
   */
  private async restoreFromLocal(userId: string, firebaseUser: any): Promise<UnifiedUser | null> {
    try {
      const userData = localStorage.getItem('daily-report-user-data');
      if (!userData) return null;

      const parsedUser = JSON.parse(userData);
      if (parsedUser.id === userId) {
        const restoredUser = this.normalizeUser(parsedUser);
        this.userCache.set(userId, restoredUser);
        console.log('💾 ローカルストレージから復元:', restoredUser.displayName);
        return restoredUser;
      }

      return null;
    } catch (error) {
      console.error('❌ ローカルストレージ復元エラー:', error);
      return null;
    }
  }
}

// シングルトンインスタンスのエクスポート
export const dataManager = UnifiedDataManager.getInstance();