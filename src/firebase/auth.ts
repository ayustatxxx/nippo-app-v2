// src/firebase/auth.ts
import { 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  User
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from './config';

// Googleプロバイダーの設定
const googleProvider = new GoogleAuthProvider();

// ユーザーデータの型定義
export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: 'admin' | 'user';
  createdAt: number;
  updatedAt: number;
}

// メール/パスワードでログイン
export const loginWithEmailPassword = async (email: string, password: string) => {
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    return { success: true, user: result.user };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

// メール/パスワードでサインアップ
export const signupWithEmailPassword = async (
  email: string, 
  password: string, 
  displayName: string
) => {
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    
    // Firestoreにユーザープロフィールを保存
    const userProfile: UserProfile = {
      uid: result.user.uid,
      email: email,
      displayName: displayName,
      role: 'user', // デフォルトはuser、管理者は手動で変更
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    
    await setDoc(doc(db, 'users', result.user.uid), userProfile);
    
    return { success: true, user: result.user };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

// Googleでログイン
export const loginWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    
    // 既存ユーザーかチェック
    const userDoc = await getDoc(doc(db, 'users', result.user.uid));
    
    if (!userDoc.exists()) {
      // 新規ユーザーの場合、プロフィールを作成
      const userProfile: UserProfile = {
        uid: result.user.uid,
        email: result.user.email || '',
        displayName: result.user.displayName || 'Google User',
        role: 'user',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      
      await setDoc(doc(db, 'users', result.user.uid), userProfile);
    }
    
    return { success: true, user: result.user };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

// ログアウト
export const logout = async () => {
  try {
    await signOut(auth);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

// 認証状態の監視
export const onAuthStateChange = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback);
};


// 現在のユーザーを取得（Promise版）
export const getCurrentUser = (): Promise<User | null> => {
  return new Promise((resolve) => {
    // Firebaseの初期化が完了するまで待つ
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe(); // 監視を即座に解除
      resolve(user);
    });
  });
};

// ユーザープロフィールを取得
export const getUserProfile = async (uid: string) => {
  try {
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (userDoc.exists()) {
      return userDoc.data() as UserProfile;
    }
    return null;
  } catch (error) {
    console.error('ユーザープロフィール取得エラー:', error);
    return null;
  }
};


// Firebase + Firestore連携テスト用の関数
import { testFirestoreConnection, createUserProfile } from './firestore';

export const testFirebaseFirestoreIntegration = async () => {
  try {
    console.log('🧪 Firebase + Firestore統合テスト開始...');
    
    // 1. Firestore接続テスト
    const firestoreConnected = await testFirestoreConnection();
    if (!firestoreConnected) {
      throw new Error('Firestore接続に失敗しました');
    }
    
    // 2. 現在のFirebaseユーザーを確認
const currentUser = await getCurrentUser();
if (currentUser) {
  console.log('✅ 現在のFirebaseユーザー:', currentUser.email);
  
  // 3. Firestoreにユーザープロフィールのテスト作成
  const userProfile = await createUserProfile(currentUser, {
    username: currentUser.displayName || 'テストユーザー',
    company: 'テスト会社',
    position: 'テスト職位'
  });
      
      console.log('✅ Firestoreユーザープロフィール作成完了:', userProfile.username);
      console.log('🎉 Firebase + Firestore統合テスト成功！');
      return true;
    } else {
      console.log('⚠️ Firebaseユーザーが見つかりません');
      return false;
    }
  } catch (error) {
    console.error('❌ 統合テストエラー:', error);
    return false;
  }
};