import { collection, addDoc, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase/firestore';
import { Memo } from '../types';
import { withErrorHandling } from './errorHandler';

export class MemoService {
  // メモ取得
  static getPostMemos = withErrorHandling(
  async (postId: string): Promise<Memo[]> => {
    console.log('メモ取得開始:', { postId });
    
    const possiblePaths = [
      `groups/wIXThgBDhzi7VaRFCS0l/posts/${postId}/memos`,
      `groups/RoPn9JmPal4BNsr6sdIf/posts/${postId}/memos`,
      `posts/${postId}/memos`,
      `memos`
    ];
    
    for (const path of possiblePaths) {
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
            console.log('メモ取得完了:', { path, count: filteredMemos.length });
            return filteredMemos;
          }
        }
      } catch (error) {
        console.log('パス試行失敗:', path);
      }
    }
    
    console.log('メモが見つかりません');
    return [];
  },
  [],
  'メモ取得に失敗しました'
);

  // メモ保存
  static saveMemo = withErrorHandling(
  async (memo: Omit<Memo, 'id' | 'createdAt'>): Promise<void> => {
    const newMemo = {
      ...memo,
      createdAt: Date.now()
    };
    
    console.log('メモ保存開始:', newMemo);
    
    const memosRef = collection(db, 'memos');
    await addDoc(memosRef, newMemo);
    
    console.log('メモ保存完了');
  },
  undefined,
  'メモ保存に失敗しました'
);
}