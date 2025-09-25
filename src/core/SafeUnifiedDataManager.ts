// src/core/SafeUnifiedDataManager.ts
import { getUser } from '../firebase/firestore';
import { User } from '../types';

/**
 * 安全でデバッグ可能な表示名取得システム
 * Firebase + Firestore + ローカルストレージ対応
 */
export const getDisplayNameSafe = async (userId: string): Promise<string> => {
  // デバッグログの開始
  console.log('🔍 SafeUnifiedDataManager.getDisplayNameSafe 開始');
  console.log('📋 要求されたユーザーID:', userId);
  
  try {
    // Step 1: Firestoreから直接取得を試行
    console.log('⚡ Firestore直接取得を開始...');
    const firestoreUser = await getUser(userId);
    
    if (firestoreUser) {
      console.log('✅ Firestoreから取得成功:', firestoreUser);
      console.log('📝 username:', firestoreUser.username);
      console.log('📝 displayName:', firestoreUser.displayName);
      console.log('📝 email:', firestoreUser.email);
      
      // 優先順位: displayName → username → emailのローカル部分
      const displayName = firestoreUser.displayName || 
                         firestoreUser.username || 
                         (firestoreUser.email ? firestoreUser.email.split('@')[0] : null);
      
      if (displayName) {
        console.log('🎉 Firestoreから表示名決定:', displayName);
        return displayName;
      }
    } else {
      console.warn('⚠️ Firestore取得結果がnull/undefined');
    }

    // Step 2: ローカルストレージからフォールバック
    console.log('🔄 ローカルストレージフォールバック開始...');
    
    // 現在のユーザーIDと一致するかチェック
    const currentUserId = localStorage.getItem("daily-report-user-id");
    console.log('📱 現在のローカルユーザーID:', currentUserId);
    
    if (currentUserId === userId) {
      const localUsername = localStorage.getItem("daily-report-username");
      const localEmail = localStorage.getItem("daily-report-user-email");
      
      console.log('📱 ローカルusername:', localUsername);
      console.log('📱 ローカルemail:', localEmail);
      
      const localDisplayName = localUsername || 
                              (localEmail ? localEmail.split('@')[0] : null);
      
      if (localDisplayName) {
        console.log('🎉 ローカルストレージから表示名決定:', localDisplayName);
        return localDisplayName;
      }
    }

    // Step 3: 最終フォールバック
    console.error('❌ 全ての取得方法が失敗 - フォールバック実行');
    return 'ユーザー';
    
  } catch (error) {
    console.error('💥 SafeUnifiedDataManager エラー:', error);
    console.error('📊 エラー詳細:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    
    // エラー時のフォールバック
    return 'ユーザー';
  }
};

/**
 * ユーザーデータの包括的取得（将来の機能拡張用）
 */
export const getUserDataSafe = async (userId: string): Promise<User | null> => {
  console.log('🔍 getUserDataSafe 開始 - ユーザーID:', userId);
  
  try {
    // Firestoreから取得
    const firestoreUser = await getUser(userId);
    if (firestoreUser) {
      console.log('✅ 包括的ユーザーデータ取得成功:', firestoreUser);
      return firestoreUser;
    }
    
    console.warn('⚠️ 包括的ユーザーデータ取得失敗');
    return null;
  } catch (error) {
    console.error('💥 getUserDataSafe エラー:', error);
    return null;
  }
};