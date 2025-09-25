// src/utils/permissionManager.ts
import { getCurrentUser } from './authUtil';
import { getGroupWithFirestore } from './dbUtil';

/**
 * 権限管理システム - 新アーキテクチャ
 * グローバル権限とグループ内権限を明確に分離
 */
export class PermissionManager {
  
  /**
   * システム管理者権限チェック（アプリ全体の管理権限）
   */
  static async isSystemAdmin(): Promise<boolean> {
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser) return false;
      
      // 新しい権限システム
      if ((currentUser as any).systemRole === 'system_admin') return true;
      
      // 既存の管理者メールアドレス（段階的移行）
      const adminEmails = ['info@ayustat.co.jp', 'sharaku@ayustat.co.jp'];
      return adminEmails.includes(currentUser.email || '');
      
    } catch (error) {
      console.error('システム管理者権限チェックエラー:', error);
      return false;
    }
  }
  
  /**
   * グループ作成権限チェック（全ユーザーが作成可能）
   */
  static async canCreateGroup(): Promise<boolean> {
    try {
      const currentUser = await getCurrentUser();
      return !!currentUser; // ログイン済みユーザーなら誰でも作成可能
    } catch (error) {
      console.error('グループ作成権限チェックエラー:', error);
      return false;
    }
  }
  
  /**
   * グループ内管理者権限チェック（特定グループでの管理権限）
   */
  static async isGroupAdmin(groupId: string, userId?: string): Promise<boolean> {
    try {
      const currentUserId = userId || (await getCurrentUser())?.id;
      if (!currentUserId) return false;
      
      const group = await getGroupWithFirestore(groupId);
      if (!group) return false;
      
      // 1. グループ作成者チェック
      if ((group as any).createdBy === currentUserId) return true;
      
      // 2. 管理者リストチェック（複数管理者対応）
      if (group.adminIds?.includes(currentUserId)) return true;
      
      // 3. メンバーリストでの管理者権限チェック
      if (group.members) {
        const memberData = group.members.find(member => {
          const memberId = typeof member === 'string' ? member : member.id || member.userId;
          return memberId === currentUserId;
        });
        
        if (memberData && typeof memberData === 'object') {
          return memberData.role === 'admin' || memberData.isAdmin === true;
        }
      }
      
      // 4. システム管理者は全グループの管理者
      return await this.isSystemAdmin();
      
    } catch (error) {
      console.error('グループ管理者権限チェックエラー:', error);
      return false;
    }
  }
  
  /**
   * 統合権限チェック（既存のisAdmin関数の置き換え）
   */
  static async isAdmin(groupId?: string): Promise<boolean> {
    if (groupId) {
      // グループIDが指定された場合はグループ内権限をチェック
      return await this.isGroupAdmin(groupId);
    } else {
      // グループIDが未指定の場合はシステム管理者権限をチェック
      return await this.isSystemAdmin();
    }
  }
  
  /**
   * メンバー管理権限チェック
   */
  static async canManageMembers(groupId: string, userId?: string): Promise<boolean> {
    return await this.isGroupAdmin(groupId, userId);
  }
  
  /**
   * 投稿編集権限チェック
   */
  static async canEditPost(postAuthorId: string, groupId?: string): Promise<boolean> {
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser) return false;
      
      // 投稿者本人は編集可能
      if (currentUser.id === postAuthorId) return true;
      
      // グループ管理者は編集可能
      if (groupId && await this.isGroupAdmin(groupId)) return true;
      
      // システム管理者は編集可能
      return await this.isSystemAdmin();
      
    } catch (error) {
      console.error('投稿編集権限チェックエラー:', error);
      return false;
    }
  }
}