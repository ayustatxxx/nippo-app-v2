// src/core/UnifiedCoreSystem.ts
// 統一アーキテクチャ核心システム - 高品質コンポーネント統合

import { Post, Group, User } from '../types';
import { getCurrentUser } from '../utils/authUtil';
import { createPost } from '../firebase/firestore';
import { DBUtil, STORES } from '../utils/dbUtil';

// 既存高品質コンポーネントのインポート
import { UserGroupResolver } from '../utils/userGroupResolver';

/**
 * 統一コアシステム
 * 既存の最高品質コンポーネントを統合し、統一APIを提供
 */
export class UnifiedCoreSystem {
  private static instance: UnifiedCoreSystem | null = null;

  // Tier 1: 基盤システム（100%再利用）
  static groupResolver = UserGroupResolver;

  // PostPage.tsxのFileValidatorクラスは別途import予定
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

      // Step 2: ファイル検証・処理（FileValidator統合予定）
      let processedImages: string[] = [];
      if (postData.files && postData.files.length > 0) {
        // TODO: FileValidator.processFilesInBatches()を統合
        console.log('📁 ファイル処理をスキップ（FileValidator統合待ち）');
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
    try {
      console.log('🔍 UnifiedCoreSystem: 統一投稿取得開始', postId);

      // UserGroupResolverによる動的検索
      const post = await this.groupResolver.findPostInUserGroups(postId, userId);
      
      if (post) {
        console.log('✅ 投稿発見完了:', post.id);
        return post;
      }

      console.log('⚠️ 投稿未発見:', postId);
      return null;

    } catch (error) {
      console.error('❌ UnifiedCoreSystem: 投稿取得エラー', error);
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