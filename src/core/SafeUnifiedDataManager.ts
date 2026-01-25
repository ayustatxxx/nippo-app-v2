// src/core/SafeUnifiedDataManager.ts
import { getUser } from '../firebase/firestore';
import { User } from '../types';

// 表示名キャッシュ（メモリ内キャッシュ）
const displayNameCache = new Map<string, string>();

/**
 * 安全でデバッグ可能な表示名取得システム
 * Firebase + Firestore + ローカルストレージ対応
 */
export const getDisplayNameSafe = async (userId: string): Promise<string> => {
  // デバッグログの開始
  console.log('🔍 SafeUnifiedDataManager.getDisplayNameSafe 開始');
  console.log('📋 要求されたユーザーID:', userId);
  
  // Step 0: キャッシュチェック
  if (displayNameCache.has(userId)) {
    const cachedName = displayNameCache.get(userId)!;
    console.log('💾 キャッシュから取得:', cachedName);
    return cachedName;
  }
  
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
        // キャッシュに保存
        displayNameCache.set(userId, displayName);
        console.log('💾 キャッシュに保存完了');
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
        // キャッシュに保存
        displayNameCache.set(userId, localDisplayName);
        console.log('💾 キャッシュに保存完了');
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
 * 表示名キャッシュをクリア
 */
export const clearDisplayNameCache = () => {
  displayNameCache.clear();
  console.log('🗑️ 表示名キャッシュをクリアしました');
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

/**
 * 複数ユーザーの表示名を一括取得（高速化版）
 * @param userIds ユーザーIDの配列
 * @returns ユーザーIDと表示名のMapオブジェクト
 */
export const getDisplayNamesBatch = async (userIds: string[]): Promise<Map<string, string>> => {
  console.log('🚀 バッチ取得開始:', userIds.length, '人');
  
  const result = new Map<string, string>();
  
  // キャッシュから取得できるものは取得
  const uncachedIds: string[] = [];
  userIds.forEach(userId => {
    if (displayNameCache.has(userId)) {
      result.set(userId, displayNameCache.get(userId)!);
    } else {
      uncachedIds.push(userId);
    }
  });
  
  console.log('💾 キャッシュヒット:', result.size, '件');
  console.log('🔍 Firestore取得必要:', uncachedIds.length, '件');
  
  // キャッシュにないものだけFirestoreから取得
  if (uncachedIds.length > 0) {
    const promises = uncachedIds.map(async (userId) => {
      try {
        const firestoreUser = await getUser(userId);
        const displayName = firestoreUser?.displayName || 
                           firestoreUser?.username || 
                           firestoreUser?.email?.split('@')[0] || 
                           'ユーザー';
        
        // キャッシュに保存
        displayNameCache.set(userId, displayName);
        result.set(userId, displayName);
      } catch (error) {
        console.error('❌ ユーザー取得エラー:', userId, error);
        result.set(userId, 'ユーザー');
      }
    });
    
    await Promise.all(promises);
  }
  
  console.log('✅ バッチ取得完了:', result.size, '件');
  return result;
};