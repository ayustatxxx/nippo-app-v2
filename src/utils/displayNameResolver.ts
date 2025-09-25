// src/utils/displayNameResolver.ts
// ユーザー表示名の統一管理システム

import { User, GroupMember } from '../types';

/**
 * 表示名解決の統一管理クラス
 * 全ての名前表示に関する処理をここに集約
 */
export class DisplayNameResolver {
  
  /**
   * 基本的な表示名解決
   * 優先順位: profileData.fullName > displayName > username > email > fallback
   */
  static resolve(user: any): string {
    if (!user) return 'ユーザー';
    
    // 1. プロフィール内の正式名前を最優先
    if (user.profileData?.fullName && user.profileData.fullName.trim()) {
      return user.profileData.fullName.trim();
    }
    
    // 2. 表示名フィールド
    if (user.displayName && user.displayName.trim()) {
      return user.displayName.trim();
    }
    
    // 3. ユーザー名フィールド
    if (user.username && user.username.trim()) {
      return user.username.trim();
    }
    
    // 4. メールアドレスから生成
    if (user.email && user.email.includes('@')) {
      const emailPrefix = user.email.split('@')[0];
      if (emailPrefix && emailPrefix.length > 0) {
        return emailPrefix;
      }
    }
    
    // 5. IDベースのフォールバック
    if (user.id && typeof user.id === 'string') {
      return `ユーザー${user.id.slice(-4)}`;
    }
    
    // 6. 最終フォールバック
    return 'ユーザー';
  }

  /**
   * メンバーリスト専用の表示名解決
   * GroupMembersPage.tsx用
   */
  static resolveForMemberList(member: any, currentUserId: string): {
    displayName: string;
    isAdmin: boolean;
    isCurrentUser: boolean;
  } {
    const isCurrentUser = this.isCurrentUser(member, currentUserId);
    
    return {
      displayName: this.resolve(member),
      isAdmin: member.role === 'admin' || member.isAdmin || false,
      isCurrentUser
    };
  }

  /**
   * 投稿者名の解決
   * HomePage.tsx、ArchivePage.tsx用
   */
  static resolveForPost(post: any): string {
    // 投稿データから作成者名を解決
    return post.authorName || 
           post.displayName || 
           this.resolve(post.author) ||
           this.resolve(post) ||
           '投稿者';
  }

  /**
   * 現在のユーザーかどうかの正確な判定
   */
  private static isCurrentUser(member: any, currentUserId: string): boolean {
    if (!member || !currentUserId) return false;
    
    const memberId = member.id || member.userId || member.uid;
    return memberId === currentUserId;
  }

  /**
   * メンバーIDの統一取得
   * 複数のIDフィールドに対応
   */
  static extractMemberId(member: any): string {
    return member?.id || 
           member?.userId || 
           member?.uid || 
           member?._id || 
           '';
  }

  /**
   * 安全な表示名取得（エラー耐性）
   */
  static safeResolve(user: any): string {
    try {
      return this.resolve(user);
    } catch (error) {
      console.error('DisplayNameResolver.safeResolve エラー:', error);
      return 'ユーザー';
    }
  }

  /**
   * 複数ユーザーの表示名を一括取得
   * パフォーマンス最適化版
   */
  static bulkResolve(users: any[]): { [key: string]: string } {
    const result: { [key: string]: string } = {};
    
    users.forEach(user => {
      const userId = this.extractMemberId(user);
      if (userId) {
        result[userId] = this.safeResolve(user);
      }
    });
    
    return result;
  }

  /**
   * デバッグ用：ユーザーオブジェクトの名前フィールドを全て表示
   */
  static debugUserNames(user: any): void {
    console.log('🔍 DisplayNameResolver デバッグ:', {
      id: user?.id,
      username: user?.username,
      displayName: user?.displayName,
      fullName: user?.profileData?.fullName,
      email: user?.email,
      resolvedName: this.resolve(user)
    });
  }

  /**
   * プロフィール完了チェック
   * AuthGuard.tsx用
   */
  static isProfileComplete(user: any): boolean {
    const displayName = this.resolve(user);
    
    return !!(
      displayName && 
      displayName !== 'ユーザー' &&
      user?.email &&
      user?.profileData?.company
    );
  }

  /**
   * 表示名の更新時にローカルストレージも同期
   */
  static updateDisplayNameInStorage(userId: string, newDisplayName: string): void {
    try {
      const userDataStr = localStorage.getItem('daily-report-user-data');
      if (userDataStr) {
        const userData = JSON.parse(userDataStr);
        if (userData.id === userId) {
          userData.profileData = userData.profileData || {};
          userData.profileData.fullName = newDisplayName;
          localStorage.setItem('daily-report-user-data', JSON.stringify(userData));
          console.log('✅ DisplayNameResolver: ローカルストレージ更新完了');
        }
      }
    } catch (error) {
      console.error('❌ DisplayNameResolver: ローカルストレージ更新エラー:', error);
    }
  }
}