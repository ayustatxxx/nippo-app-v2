import { collection, addDoc, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase/firestore';
import { Memo } from '../types';
import { withErrorHandling } from './errorHandler';
import { UserGroupResolver } from './userGroupResolver';

export class MemoService {
  // メモ取得 - 動的検索版
  static getPostMemos = withErrorHandling(
    async (postId: string): Promise<Memo[]> => {
      console.log('メモ取得開始:', { postId });
      
      // UserGroupResolverを使用して動的にパス生成
      const currentUserId = localStorage.getItem("daily-report-user-id") || "";
      
      try {
        // ユーザーの参加グループを動的取得
        const userGroups = await UserGroupResolver.getUserParticipatingGroups(currentUserId);
        
        console.log('💾 [MemoService] 動的グループ検索開始:', userGroups.length, 'グループ');
        
        // 各グループのメモパスを動的生成して検索
        for (const group of userGroups) {
          try {
            const groupMemoPath = `groups/${group.id}/posts/${postId}/memos`;
            console.log(`📂 [MemoService] グループ "${group.name}" でメモ検索:`, groupMemoPath);
            
            const memosRef = collection(db, groupMemoPath);
            const q = query(memosRef, orderBy('createdAt', 'desc'));
            const snapshot = await getDocs(q);
            
            if (!snapshot.empty) {
              const memos = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
              })) as Memo[];
              
              console.log('✅ [MemoService] メモ発見:', group.name, memos.length, '件');
              return memos;
            }
          } catch (groupError) {
            console.warn(`⚠️ [MemoService] グループ "${group.name}" 検索エラー:`, groupError);
            continue; // 他のグループでの検索を継続
          }
        }
        
        // グループ検索で見つからない場合は、従来の汎用パスも確認
        try {
          console.log('🔍 [MemoService] 汎用パスでの検索を実行');
          
          const fallbackPaths = [
            `posts/${postId}/memos`,
            `memos`
          ];
          
          for (const path of fallbackPaths) {
            try {
              const memosRef = collection(db, path);
              const q = query(memosRef, orderBy('createdAt', 'desc'));
              const snapshot = await getDocs(q);
              
              if (!snapshot.empty) {
                const memos = snapshot.docs.map(doc => ({
                  id: doc.id,
                  ...doc.data()
                })) as Memo[];
                
                const filteredMemos = path === 'memos' 
                  ? memos.filter(memo => memo.postId === postId)
                  : memos;
                
                if (filteredMemos.length > 0) {
                  console.log('✅ [MemoService] 汎用パスでメモ発見:', path, filteredMemos.length, '件');
                  return filteredMemos;
                }
              }
            } catch (pathError) {
              console.warn(`⚠️ [MemoService] パス "${path}" 検索エラー:`, pathError);
            }
          }
        } catch (fallbackError) {
          console.error('❌ [MemoService] 汎用パス検索エラー:', fallbackError);
        }
        
        console.log('📝 [MemoService] メモが見つかりません - 全検索完了');
        return [];
        
      } catch (error) {
        console.error('❌ [MemoService] 動的メモ検索エラー:', error);
        return [];
      }
    },
    [],
    'メモ取得に失敗しました'
  );

  // メモ保存 - 統一パス版
  static saveMemo = withErrorHandling(
    async (memo: Omit<Memo, 'id'>): Promise<void> => {
      const newMemo = {
        ...memo,
        createdAt: Date.now()
      };
      
      console.log('💾 [MemoService] メモ保存開始:', newMemo);
      
      // 統一されたメモ保存パス（グループに依存しない汎用パス）
      const memosRef = collection(db, 'memos');
      await addDoc(memosRef, newMemo);
      
      console.log('✅ [MemoService] メモ保存完了');
    },
    undefined,
    'メモ保存に失敗しました'
  );
}