// src/firebase/test.ts
import { auth, db, storage } from './config';
import { collection, addDoc } from 'firebase/firestore';

export const testFirebaseConnection = async () => {
  try {
    console.log('🔥 Firebase接続テスト開始...');
    console.log('Auth:', auth);
    console.log('Database:', db);
    console.log('Storage:', storage);
    
    // テストデータをFirestoreに追加
    const testDoc = await addDoc(collection(db, 'test'), {
      message: 'Firebase接続テスト成功！',
      timestamp: new Date(),
      source: 'StackBlitz'
    });
    
    console.log('✅ テストドキュメント作成成功! ID:', testDoc.id);
    return true;
  } catch (error) {
    console.error('❌ Firebase接続エラー:', error);
    return false;
  }
};