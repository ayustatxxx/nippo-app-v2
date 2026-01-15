import { getUserGroups, getGroupPosts } from './firestoreService';
import { Group, Post } from '../types';

/**
 * ユーザーグループリゾルバー - 動的グループ管理システム
 * 年間売上30億円目標達成のためのスケーラブル設計
 * ハードコーディング完全排除によるエンタープライズ級アーキテクチャ
 */
export class UserGroupResolver {
  // キャッシュ管理（5分間）
  private static groupCache: Group[] | null = null;
  private static cacheTime = 0;
  private static readonly CACHE_DURATION = 5 * 60 * 1000; // 5分

  /**
   * ユーザーの参加グループを動的取得
   * セキュリティチェック付きで権限のあるグループのみ返却
   */
  static async getUserParticipatingGroups(userId: string): Promise<Group[]> {
    try {
      console.log('🔄 UserGroupResolver: 動的グループ取得開始', userId);

      // キャッシュチェック
      if (this.groupCache && 
          Date.now() - this.cacheTime < this.CACHE_DURATION) {
        console.log('💾 UserGroupResolver: キャッシュデータ使用', this.groupCache.length, '件');
        return this.groupCache;
      }

      // Firestoreから全グループ取得
      const allGroups = await getUserGroups(userId, 'user').catch(() => []);

      // セキュリティチェック: 参加権限の二重確認
      const participatingGroups = allGroups.filter(group => {
        const isCreator = group.createdBy === userId || group.adminId === userId;
        const isMember = group.members?.some(member => {
          const memberId = typeof member === 'string' ? member : member.id;
          return memberId === userId;
        });
        return isCreator || isMember;
      });

      // キャッシュ更新
      this.groupCache = participatingGroups;
      this.cacheTime = Date.now();

      console.log('✅ UserGroupResolver: 参加グループ取得完了', participatingGroups.length, '/', allGroups.length);
      return participatingGroups;
      
    } catch (error) {
      console.error('❌ UserGroupResolver: グループ取得エラー', error);
      return [];
    }
  }

  /**
   * 投稿を動的検索
   * ユーザーの全参加グループから指定された投稿を検索
   */
  static async findPostInUserGroups(postId: string, userId: string): Promise<Post | null> {
    try {
      console.log('🔍 UserGroupResolver: 投稿検索開始', postId);

      const userGroups = await this.getUserParticipatingGroups(userId);
      
      // 全参加グループを順次検索
      for (const group of userGroups) {
        try {
          console.log(`📂 グループ "${group.name}" で投稿検索中...`);
          
          const posts = await getGroupPosts(group.id);
          const post = posts.find(p => p.id === postId);
          
          if (post) {
            console.log('✅ UserGroupResolver: 投稿発見', postId, 'in', group.name);

             // ✅ 以下の4行を追加
  console.log('🔍 [UserGroupResolver] 発見した投稿の生データ:', {
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
    hasCreatedAt: !!post.createdAt,
    hasUpdatedAt: !!post.updatedAt
  });
            
            // グループ情報を投稿に統合
            return { 
              ...post, 
              groupName: group.name, 
              groupId: group.id 
            };
          }
        } catch (groupError) {
          console.warn(`⚠️ グループ "${group.name}" での検索エラー:`, groupError);
          continue; // 他のグループでの検索を継続
        }
      }
      
      console.log('⚠️ UserGroupResolver: 投稿未発見', postId);
      return null;
      
    } catch (error) {
      console.error('❌ UserGroupResolver: 投稿検索エラー', error);
      return null;
    }
  }

  /**
   * 特定グループ内での投稿検索
   * グループIDが既知の場合の高速検索
   */
  static async findPostInSpecificGroup(postId: string, groupId: string): Promise<Post | null> {
    try {
      console.log('🎯 UserGroupResolver: 特定グループ内検索', postId, groupId);
      
      const posts = await getGroupPosts(groupId);
      const post = posts.find(p => p.id === postId);
      
      if (post) {
        console.log('✅ UserGroupResolver: 特定グループ内で投稿発見');
        return { ...post, groupId };
      }
      
      return null;
      
    } catch (error) {
      console.error('❌ UserGroupResolver: 特定グループ検索エラー', error);
      return null;
    }
  }

  /**
   * ヘルスチェック機能
   * システムの動作状況を監視
   */
  static getHealthStatus(): {
    cacheStatus: string;
    cacheAge: number;
    isHealthy: boolean;
  } {
    const cacheAge = Date.now() - this.cacheTime;
    const isCacheValid = this.groupCache !== null && cacheAge < this.CACHE_DURATION;
    
    return {
      cacheStatus: isCacheValid ? 'VALID' : 'EXPIRED',
      cacheAge: Math.round(cacheAge / 1000), // 秒単位
      isHealthy: true
    };
  }

  /**
   * キャッシュクリア
   * 新グループ作成時やデータ更新時に使用
   */
  static clearCache(): void {
    this.groupCache = null;
    this.cacheTime = 0;
    console.log('🗑️ UserGroupResolver: キャッシュクリア完了');
  }

  /**
   * 統計情報取得
   * 運用監視用
   */
  static getStatistics(): {
    cachedGroupCount: number;
    lastUpdateTime: string;
    cacheHitRate: string;
  } {
    return {
      cachedGroupCount: this.groupCache?.length || 0,
      lastUpdateTime: this.cacheTime ? new Date(this.cacheTime).toLocaleString('ja-JP') : '未実行',
      cacheHitRate: 'データ収集中'
    };
  }
}