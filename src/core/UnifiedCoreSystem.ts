// src/core/UnifiedCoreSystem.ts
// 統一アーキテクチャ核心システム - 高品質コンポーネント統合

import { Post, Group, User } from '../types';
import { getCurrentUser } from '../utils/authUtil';
import { createPost } from '../firebase/firestore';
import { DBUtil, STORES } from '../utils/dbUtil';
import { FileValidator } from '../utils/fileValidation';

// 既存高品質コンポーネントのインポート
import { UserGroupResolver } from '../utils/userGroupResolver';
import { getGroupPosts } from '../utils/firestoreService';

/**
 * 統一コアシステム
 * 既存の最高品質コンポーネントを統合し、統一APIを提供
 */
export class UnifiedCoreSystem {
  private static instance: UnifiedCoreSystem | null = null;

  // Tier 1: 基盤システム（100%再利用）
  static groupResolver = UserGroupResolver;

  static fileValidator = FileValidator;
// PermissionManagerは別途import予定

  /**
   * シングルトンインスタンス取得
   */
  static getInstance(): UnifiedCoreSystem {
    if (!this.instance) {
      this.instance = new UnifiedCoreSystem();
    }
    return this.instance;
  }

  /**
   * 統一投稿保存システム
   * PostPage.tsxの完璧なデータフロー統合パターンを標準化
   */
  static async savePost(postData: {
    message: string;
    files?: File[];
    tags?: string[];
    groupId: string;
  }): Promise<string> {
    try {
      console.log('🚀 UnifiedCoreSystem: 統一投稿保存開始');

      // Step 1: ユーザー認証確認
      const user = await getCurrentUser();
      if (!user) {
        throw new Error('ユーザー認証が必要です');
      }

      // Step 2: ファイル検証・処理（FileValidator統合完了）
let processedImages: string[] = [];
if (postData.files && postData.files.length > 0) {
  console.log('📁 ファイル検証・処理を開始');
  
  // ファイル検証
  const validationResult = await this.fileValidator.validateFiles(postData.files);
  if (validationResult.errors.length > 0) {
    throw new Error(`ファイル検証エラー: ${validationResult.errors.join(', ')}`);
  }
  
  // ファイル処理（圧縮・Base64変換）
  processedImages = await this.fileValidator.processFilesInBatches(validationResult.validFiles);
  console.log('✅ ファイル処理完了:', processedImages.length, '枚');
}

      // Step 3: 投稿データ準備
      const sanitizedMessage = this.sanitizeInput(postData.message || '');
      const processedTags = this.processTags(postData.tags || []);
      const timestamp = Date.now();

      // Step 4: Firestore保存（PostPageパターン）
      const firestorePost = {
        userId: user.id,
        userName: user.displayName || user.username || 'ユーザー',
        groupId: postData.groupId,
        message: sanitizedMessage,
        images: processedImages,
        tags: processedTags,
        status: '未確認' as const,
        isWorkTimePost: false,
        isEdited: false,
        createdAt: timestamp
      };

      const postId = await createPost(firestorePost);
      console.log('✅ Firestore保存完了:', postId);

      // Step 5: IndexedDB同期（PostPageパターン）
      const legacyPost: Post = {
  id: postId,
  message: sanitizedMessage,
  time: this.formatTime(new Date()),
  photoUrls: processedImages,
  tags: processedTags,
  userId: user.id,
  username: user.displayName || user.username || 'ユーザー',
  groupId: postData.groupId,
  timestamp: timestamp,
  createdAt: timestamp,
  status: '未確認' as const
};

      const dbUtil = DBUtil.getInstance();
      await dbUtil.save(STORES.POSTS, legacyPost);
      console.log('✅ IndexedDB同期完了');

      // Step 6: 全システム更新通知（PostPageパターン）
      await this.notifyAllSystems(postId, legacyPost);

      return postId;

    } catch (error) {
      console.error('❌ UnifiedCoreSystem: 投稿保存エラー', error);
      throw error;
    }
  }

  /**
   * 統一投稿取得システム
   * UserGroupResolverの動的検索を活用
   */
 static async getPost(postId: string, userId: string): Promise<Post | null> {
  console.log('🔍 UnifiedCoreSystem: 統一投稿取得開始', postId);
  
  try {
    const userGroups = await this.getUserGroups(userId);
    
    for (const group of userGroups) {
      const posts = await getGroupPosts(group.id);
      const post = posts.find(p => p.id === postId);
      
      if (post) {
        console.log('✅ 投稿発見完了:', postId);
        console.log('🔍 [getPost] 取得した画像枚数:', post.photoUrls?.length || 0);
        
        const dbUtil = DBUtil.getInstance();
        await dbUtil.initDB();
        await dbUtil.save(STORES.POSTS, post);
        console.log('✅ [getPost] IndexedDB同期完了');
        
        return post;
      }
    }
    
    console.warn('⚠️ 投稿が見つかりません:', postId);
    return null;
  } catch (error) {
    console.error('❌ 投稿取得エラー:', error);
    return null;
  }
}

  /**
   * 統一グループ取得システム
   * UserGroupResolverのキャッシュシステム活用
   */
  static async getUserGroups(userId: string): Promise<Group[]> {
    try {
      console.log('👥 UnifiedCoreSystem: ユーザーグループ取得開始');

      const groups = await this.groupResolver.getUserParticipatingGroups(userId);
      
      console.log('✅ グループ取得完了:', groups.length, '件');
      return groups;

    } catch (error) {
      console.error('❌ UnifiedCoreSystem: グループ取得エラー', error);
      return [];
    }
  }


  /**
   * グループの投稿を取得（権限チェック付き）
   * @param groupId グループID
   * @param userId ユーザーID
   * @returns 投稿の配列
   */
  static async getGroupPosts(groupId: string, userId: string, limit?: number): Promise<Post[]> {
  console.log('🔍 UnifiedCoreSystem: グループ投稿取得開始', { groupId, userId, limit });
    
    try {
      // Step 1: 権限確認 - このユーザーはこのグループにアクセスできるか？
      const userGroups = await this.getUserGroups(userId);
      const hasAccess = userGroups.some(g => g.id === groupId);
      
      if (!hasAccess) {
        console.warn('⚠️ アクセス権限なし:', { groupId, userId });
        return [];
      }
      
      console.log('✅ 権限確認OK');
      
      // Step 2: firestoreServiceから投稿を取得
      const { getGroupPosts } = await import('../utils/firestoreService');
      const posts = await getGroupPosts(groupId, limit);
      
      console.log(`✅ グループ投稿取得完了: ${posts.length}件`);
      return posts;
      
    } catch (error) {
      console.error('❌ グループ投稿取得エラー:', error);
      return []; // エラーの場合は空配列を返す（安全）
    }
  }


  // 📁 UnifiedCoreSystem.ts

  static async updatePost(
  postId: string,
  updates: {
    message?: string;
    files?: File[];
    tags?: string[];
    photoUrls?: string[];
  }
): Promise<void> {
  try {
    console.log('🔄 [UnifiedCore] 投稿更新開始:', postId);
    
    // Step 1: ユーザー認証確認
    const user = await getCurrentUser();
    if (!user) {
      throw new Error('ユーザー認証が必要です');
    }

 // Step 2: 更新データ準備
const updateData: any = {
  updatedAt: Date.now(),
  isEdited: true
};

if (updates.message !== undefined) {
  updateData.message = this.sanitizeInput(updates.message);
}

if (updates.tags !== undefined) {
  updateData.tags = this.processTags(updates.tags);
}

// ✅ 新しい画像ファイルの処理を追加
let newProcessedImages: string[] = [];

if (updates.files && updates.files.length > 0) {
  console.log('📁 [UpdatePost] 新規画像ファイル処理開始:', updates.files.length, '枚');
  
  try {
    const validationResult = await this.fileValidator.validateFiles(updates.files);
    
    if (validationResult.errors.length > 0) {
      throw new Error(`ファイル検証エラー: ${validationResult.errors.join(', ')}`);
    }
    
    newProcessedImages = await this.fileValidator.processFilesInBatches(validationResult.validFiles);
    console.log('✅ [UpdatePost] 新規画像処理完了:', newProcessedImages.length, '枚');
    
    // セキュリティログ
    this.fileValidator.logSecurityEvent('files_uploaded', {
      fileCount: validationResult.validFiles.length,
      totalSize: validationResult.totalSize,
      context: 'post_update'
    });
  } catch (fileError) {
    console.error('❌ [UpdatePost] 画像処理エラー:', fileError);
    throw fileError;
  }
}

// photoUrlsの更新処理
if (updates.photoUrls !== undefined) {
  updateData.photoUrls = [...updates.photoUrls, ...newProcessedImages];
  console.log('✅ [UpdatePost] 画像URL更新完了:', updateData.photoUrls.length, '枚');
  console.log('  - 既存画像:', updates.photoUrls.length, '枚');
  console.log('  - 新規画像:', newProcessedImages.length, '枚');
  
  // 🔍 デバッグ：実際のURLを確認
  console.log('🔍 [UpdatePost] 実際に保存する画像URL:');
  updateData.photoUrls.forEach((url, index) => {
    console.log(`  ${index + 1}. ${url.substring(0, 50)}...`);
  });
} else if (newProcessedImages.length > 0) {
  updateData.photoUrls = newProcessedImages;
  console.log('✅ [UpdatePost] 新規画像のみ:', newProcessedImages.length, '枚');
}

// Step 3: Firestoreで更新
const { doc, updateDoc, getDoc, getFirestore } = await import('firebase/firestore');
const db = getFirestore();
const postRef = doc(db, 'posts', postId);

console.log('📡 [UpdatePost] Firestore更新データ:', {
  photoUrlsLength: updateData.photoUrls?.length,
  message: updateData.message?.substring(0, 50),
  tags: updateData.tags
});

await updateDoc(postRef, updateData);
console.log('✅ Firestore更新完了');

// 🔍 デバッグ: 更新直後のFirestoreデータを確認
const verifyDoc = await getDoc(postRef);
if (verifyDoc.exists()) {
  const verifyData = verifyDoc.data();
  console.log('🔍 [Firestore検証] 更新直後のデータ:');
  console.log('  - photoUrls枚数:', verifyData.photoUrls?.length || 0);
  if (verifyData.photoUrls) {
    verifyData.photoUrls.forEach((url: string, index: number) => {
      console.log(`    ${index + 1}. ${url.substring(0, 50)}...`);
    });
  }
} else {
  console.error('❌ [Firestore検証] ドキュメントが見つかりません');
}

// Step 4: IndexedDB同期
const dbUtil = DBUtil.getInstance();
await dbUtil.initDB();
const existingPost = await dbUtil.get(STORES.POSTS, postId);
if (existingPost) {
  const currentPost = existingPost as Post;
  const updatedPost: Post = {
    ...currentPost,
    ...updateData,
    photoUrls: updateData.photoUrls || currentPost.photoUrls,
    id: postId,
    updatedAt: updateData.updatedAt,
    isEdited: true
  };
  
  console.log('🔍 [IndexedDB] 保存する画像枚数:', updatedPost.photoUrls.length);
  
  await dbUtil.save(STORES.POSTS, updatedPost);
  console.log('✅ IndexedDB同期完了');
  
  // Step 5: 全システム更新通知(直接実装)
  const updateFlag = Date.now().toString();
  localStorage.setItem('daily-report-posts-updated', updateFlag);
  localStorage.setItem('last-updated-group-id', updatedPost.groupId);
  const updateEvent = new CustomEvent('postsUpdated', {
    detail: {
      updatedPost: updatedPost,
      timestamp: Date.now(),
      source: 'UnifiedCoreSystem',
      action: 'update'
    }
  });

  window.dispatchEvent(updateEvent);
  window.dispatchEvent(new CustomEvent('refreshPosts'));

  // 段階的通知
  [100, 300, 500, 1000].forEach((delay) => {
    setTimeout(() => {
      localStorage.setItem('daily-report-posts-updated', Date.now().toString());
      window.dispatchEvent(new CustomEvent('postsUpdated', {
        detail: { updatedPost, timestamp: Date.now(), delay }
      }));

      if (window.refreshArchivePage) window.refreshArchivePage();
      if (window.refreshHomePage) window.refreshHomePage();
    }, delay);
  });

  console.log('✅ 投稿更新通知完了');
} else {
  console.warn('⚠️ IndexedDBに投稿が見つかりません:', postId);
}

} catch (error) {
  console.error('❌ UnifiedCoreSystem: 投稿更新エラー', error);
  throw error;
}
}



  /**
   * システム健康状態確認
   * UserGroupResolverのヘルスチェック機能活用
   */
  static getSystemHealth(): {
    isHealthy: boolean;
    groupResolverStatus: any;
    timestamp: string;
  } {
    const healthStatus = this.groupResolver.getHealthStatus();
    
    return {
      isHealthy: healthStatus.isHealthy,
      groupResolverStatus: healthStatus,
      timestamp: new Date().toLocaleString('ja-JP')
    };
  }

  /**
   * 全システム更新通知
   * PostPageの多層通知システムを標準化
   */
  private static async notifyAllSystems(postId: string, postData: Post): Promise<void> {
    try {
      console.log('📢 UnifiedCoreSystem: 全システム更新通知開始');

      // Step 1: localStorage更新フラグ設定
      const updateFlag = Date.now().toString();
      localStorage.setItem('daily-report-posts-updated', updateFlag);
      localStorage.setItem('last-updated-group-id', postData.groupId);
      localStorage.setItem('posts-need-refresh', updateFlag);
      localStorage.setItem('archive-posts-updated', updateFlag);

      // Step 2: カスタムイベント発火
      const updateEvent = new CustomEvent('postsUpdated', {
        detail: {
          newPost: postData,
          timestamp: Date.now(),
          source: 'UnifiedCoreSystem',
          action: 'create'
        }
      });

      window.dispatchEvent(updateEvent);
      window.dispatchEvent(new CustomEvent('refreshPosts'));
      window.dispatchEvent(new CustomEvent('storage', {
        detail: { key: 'daily-report-posts-updated', newValue: updateFlag }
      }));

      // Step 3: 段階的追加通知（PostPageパターン）
      const notificationSchedule = [100, 300, 500, 1000];
      notificationSchedule.forEach((delay, index) => {
        setTimeout(() => {
          const delayedFlag = Date.now().toString();
          localStorage.setItem('daily-report-posts-updated', delayedFlag);
          
          window.dispatchEvent(new CustomEvent('postsUpdated', {
            detail: {
              newPost: postData,
              timestamp: Date.now(),
              source: 'UnifiedCoreSystem-delayed',
              delay: delay
            }
          }));

          // グローバル関数呼び出し
          if (window.refreshArchivePage) {
            window.refreshArchivePage();
          }
          if (window.refreshHomePage) {
            window.refreshHomePage();
          }
        }, delay);
      });

      console.log('✅ 全システム更新通知完了');

    } catch (error) {
      console.error('❌ 更新通知エラー:', error);
    }
  }

  /**
   * 入力値サニタイゼーション
   * 全コンポーネント統一セキュリティ処理
   */
  private static sanitizeInput(input: string): string {
    return input
      .replace(/[<>]/g, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+=/gi, '')
      .trim()
      .substring(0, 5000); // 最大5000文字制限
  }

  /**
   * タグ処理統一
   * 全コンポーネント統一タグ形式
   */
  private static processTags(tags: string[]): string[] {
    return tags
      .map(tag => tag.trim())
      .filter(tag => tag !== '')
      .filter(tag => tag.length <= 50)
      .slice(0, 10)
      .map(tag => tag.startsWith('#') ? tag : `#${tag}`);
  }

  /**
   * 時刻フォーマット統一
   * 全コンポーネント統一時刻表示
   */
  private static formatTime(date: Date): string {
    const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
    const weekday = weekdays[date.getDay()];
    const dateStr = `${date.getFullYear()} / ${date.getMonth() + 1} / ${date.getDate()}（${weekday}）`;
    const timeStr = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return `${dateStr}　${timeStr}`;
  }

  /**
   * キャッシュクリア
   * 開発・デバッグ用
   */
  static clearAllCaches(): void {
    this.groupResolver.clearCache();
    localStorage.removeItem('daily-report-posts-updated');
    localStorage.removeItem('last-updated-group-id');
    localStorage.removeItem('posts-need-refresh');
    localStorage.removeItem('archive-posts-updated');
    console.log('🗑️ UnifiedCoreSystem: 全キャッシュクリア完了');
  }

  /**
   * システム統計情報
   * 運用監視用
   */
  static getSystemStats(): {
    groupResolverStats: any;
    systemUptime: string;
    lastActivity: string;
  } {
    return {
      groupResolverStats: this.groupResolver.getStatistics(),
      systemUptime: 'データ収集中',
      lastActivity: new Date().toLocaleString('ja-JP')
    };
  }
}

// グローバル関数型定義（PostPage.tsxで使用されている関数）
declare global {
  interface Window {
    refreshArchivePage?: () => void;
    refreshHomePage?: () => void;
  }
}

export default UnifiedCoreSystem;