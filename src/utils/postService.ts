import { getGroupPosts } from './firestoreService';
import { Post } from '../types';
import { updatePostStatus as firestoreUpdateStatus } from './firestoreService';
import { withErrorHandling } from './errorHandler';

export class PostService {
  // 投稿取得
  static getPost = withErrorHandling(
  async (postId: string): Promise<Post | null> => {
    const groups = ['wIXThgBDhzi7VaRFCS0l', 'RoPn9JmPal4BNsr6sdIf'];
    
    for (const groupId of groups) {
      const groupPosts = await getGroupPosts(groupId);
      const post = groupPosts.find(p => p.id === postId);
      if (post) return post;
    }
    
    return null;
  },
  null,
  '投稿取得に失敗しました'
);

  // ステータス更新（まず基本実装）
  static updatePostStatus = withErrorHandling(
  async (postId: string, status: string, userId: string, userName: string): Promise<void> => {
    const groups = ['wIXThgBDhzi7VaRFCS0l', 'RoPn9JmPal4BNsr6sdIf'];
    
    // 投稿がどのグループにあるか確認
    const post = await PostService.getPost(postId);
    if (!post) {
      throw new Error('投稿が見つかりません');
    }
    
    await firestoreUpdateStatus(post.groupId, postId, status, userId, userName);
    console.log('ステータス更新完了:', { postId, status });
  },
  undefined,
  'ステータス更新に失敗しました'
);
}