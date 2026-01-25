// src/firebase/firestore.ts
import { 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc,
  getDocs,
  query,
  where,
  orderBy,
  addDoc,
  serverTimestamp,
  onSnapshot,
  Timestamp
} from 'firebase/firestore';
import { db } from './config';
import { User, Group, Post, UserRole, GroupMember } from '../types';

// ===== コレクション名の定義 =====
export const COLLECTIONS = {
  USERS: 'users',
  GROUPS: 'groups', 
  POSTS: 'posts',
  MEMOS: 'memos'
} as const;

// ===== ユーザー管理関数 =====

// ユーザー情報を作成・更新
export const saveUser = async (userId: string, userData: Partial<User>): Promise<void> => {
  try {
    // ★ userIdのバリデーション追加
    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
      console.error('❌ saveUser: 無効なuserId:', userId);
      throw new Error('Invalid userId provided to saveUser');
    }
    
    console.log('🔍 【firestore】saveUser開始');
    console.log('🔍 【firestore】受信したuserData:', {
      username: userData.username,
      fullName: userData.fullName,
      displayName: userData.displayName,
      company: userData.company
    });

    const userRef = doc(db, COLLECTIONS.USERS, userId);
    
    // 更新日時を追加
    const userDataWithTimestamp = {
      ...userData,
      updatedAt: serverTimestamp(),
      // 新規作成の場合はcreatedAtも追加
      ...(userData.id ? {} : { createdAt: serverTimestamp() })
    };

    console.log('🔍 【firestore】Firestoreに保存する直前のデータ:', {
      username: userDataWithTimestamp.username,
      fullName: userDataWithTimestamp.fullName,
      displayName: userDataWithTimestamp.displayName
    });
    
    await setDoc(userRef, userDataWithTimestamp, { merge: true });
    console.log('✅ 【firestore】Firestore保存完了:', userId);
  } catch (error) {
    console.error('❌ ユーザー保存エラー:', error);
    throw error;
  }
};

// 修正版getUser関数
export const getUser = async (userId: string): Promise<User | null> => {
  try {
    // userIdのバリデーション
    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
      console.error('❌ 無効なuserId:', userId);
      return null;
    }
    
    const userRef = doc(db, COLLECTIONS.USERS, userId);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      const userData = userSnap.data();
      console.log('🔍 Firestoreから取得した生データ:', userData);
      
      // ★ 安全なTimestamp変換 ★
      const convertTimestamp = (timestamp: any): number => {
        if (!timestamp) return Date.now();
        
        // Firestore Timestampの場合
        if (timestamp && typeof timestamp.toMillis === 'function') {
          return timestamp.toMillis();
        }
        
        // 既に数値の場合
        if (typeof timestamp === 'number') {
          return timestamp;
        }
        
        // 文字列やDateオブジェクトの場合
        if (timestamp instanceof Date) {
          return timestamp.getTime();
        }
        
        // その他の場合はパースを試行
        if (typeof timestamp === 'string') {
          const parsed = new Date(timestamp).getTime();
          return isNaN(parsed) ? Date.now() : parsed;
        }
        
        // すべて失敗した場合は現在時刻
        return Date.now();
      };
      
      
      // ★ 確実にidを含むユーザーオブジェクトを作成 ★
      const user: User = {
  id: userId,
  email: userData.email || '',
  // ⭐ 修正：usernameとdisplayNameを独立させる
  username: userData.username || userData.email?.split('@')[0] || 'user',
  displayName: userData.displayName || 'ユーザー', // displayNameのみ参照
  fullName: userData.fullName || '', // fullNameを追加
  role: userData.role || 'user',
  active: userData.active !== undefined ? userData.active : true,
  profileImage: userData.profileImage || '',
  company: userData.company || '',
  position: userData.position || '',
  phone: userData.phone || '',
  createdAt: convertTimestamp(userData.createdAt),
  updatedAt: convertTimestamp(userData.updatedAt),
  settings: userData.settings || {
    notifications: true,
    reportFrequency: 'daily',
    theme: 'light'
  }
};
      
      console.log('✅ 構築したユーザーオブジェクト:', user);
      console.log('🔍 user.id:', user.id);
      console.log('🔍 user.username:', user.username);
      
      return user;
    } else {
      console.log('⚠️ ユーザーが見つかりません:', userId);
      return null;
    }
 } catch (error) {
  console.error('❌ ユーザー取得エラー:', error);
  console.error('エラー詳細:', JSON.stringify(error, null, 2));
  return null; // エラー時はnullを返す（throwしない）
}
};


// ユーザーのメールアドレスで検索
export const getUserByEmail = async (email: string): Promise<User | null> => {
  try {
    const usersRef = collection(db, COLLECTIONS.USERS);
    const q = query(usersRef, where('email', '==', email));
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const userDoc = querySnapshot.docs[0];
      const userData = userDoc.data();
      console.log('✅ メールでユーザーを発見:', email);
      
      // ★ 安全なTimestamp変換を使用 ★
      const convertTimestamp = (timestamp: any): number => {
        if (!timestamp) return Date.now();
        
        if (timestamp && typeof timestamp.toMillis === 'function') {
          return timestamp.toMillis();
        }
        
        if (typeof timestamp === 'number') {
          return timestamp;
        }
        
        if (timestamp instanceof Date) {
          return timestamp.getTime();
        }
        
        if (typeof timestamp === 'string') {
          const parsed = new Date(timestamp).getTime();
          return isNaN(parsed) ? Date.now() : parsed;
        }
        
        return Date.now();
      };
      
      return {
        ...userData,
        createdAt: convertTimestamp(userData.createdAt),
        updatedAt: convertTimestamp(userData.updatedAt)
      } as User;
    } else {
      console.log('⚠️ メールでユーザーが見つかりません:', email);
      return null;
    }
  } catch (error) {
    console.error('❌ メール検索エラー:', error);
    throw error;
  }
};

// ユーザー情報を削除
export const deleteUser = async (userId: string): Promise<void> => {
  try {
    const userRef = doc(db, COLLECTIONS.USERS, userId);
    await deleteDoc(userRef);
    console.log('✅ ユーザーを削除しました:', userId);
  } catch (error) {
    console.error('❌ ユーザー削除エラー:', error);
    throw error;
  }
};

// ===== 開発・テスト用関数 =====

// Firestoreの接続をテスト
export const testFirestoreConnection = async (): Promise<boolean> => {
  try {
    // テスト用ドキュメントを作成
    const testRef = doc(db, 'test', 'connection-test');
    await setDoc(testRef, {
      message: 'Firestore接続テスト成功',
      timestamp: serverTimestamp()
    });
    
    // 作成したドキュメントを読み取り
    const testSnap = await getDoc(testRef);
    
    if (testSnap.exists()) {
      console.log('✅ Firestore接続テスト成功!');
      
      // テストドキュメントを削除
      await deleteDoc(testRef);
      return true;
    } else {
      console.log('❌ Firestore接続テスト失敗');
      return false;
    }
  } catch (error) {
    console.error('❌ Firestore接続エラー:', error);
    return false;
  }
};

// ===== Firebase認証との連携関数 =====

// Firebase認証ユーザーをFirestoreに保存
export const createUserProfile = async (
  firebaseUser: any, 
  additionalData?: Partial<User>
): Promise<User> => {
  try {
    const userId = firebaseUser.uid;
    const email = firebaseUser.email;
    const displayName = firebaseUser.displayName || additionalData?.username || 'ユーザー';
    
    // 既存ユーザーをチェック
    const existingUser = await getUser(userId);
    if (existingUser) {
      console.log('✅ 既存ユーザーを返します:', userId);
      return existingUser;
    }
    
    // 新規ユーザープロフィールを作成
    const newUser: User = {
      id: userId,
      email: email || '',
      username: displayName,
      role: 'user', // デフォルトはuser
      active: true,
      profileImage: firebaseUser.photoURL || '',
      company: additionalData?.company || '',
      position: additionalData?.position || '',
      phone: additionalData?.phone || '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      settings: {
        notifications: true,
        reportFrequency: 'daily',
        theme: 'light'
      },
      ...additionalData // 追加データがあれば上書き
    };
    
    // Firestoreに保存
    await saveUser(userId, newUser);
    
    console.log('✅ 新規ユーザープロフィールを作成しました:', userId);
    return newUser;
  } catch (error) {
    console.error('❌ ユーザープロフィール作成エラー:', error);
    throw error;
  }
};


// 修正版syncCurrentUser関数


// ===== グループ管理関数 =====

// グループを作成・更新
export const saveGroup = async (groupId: string, groupData: Partial<Group>): Promise<void> => {
  try {
    const groupRef = doc(db, COLLECTIONS.GROUPS, groupId);
    
    // 更新日時を追加
    const groupDataWithTimestamp = {
      ...groupData,
      updatedAt: serverTimestamp(),
      // 新規作成の場合はcreatedAtも追加
      ...(groupData.id ? {} : { createdAt: serverTimestamp() })
    };
    
    await setDoc(groupRef, groupDataWithTimestamp, { merge: true });
    console.log('✅ グループ情報を保存しました:', groupId);
  } catch (error) {
    console.error('❌ グループ保存エラー:', error);
    throw error;
  }
};

// グループ情報を取得
export const getGroup = async (groupId: string): Promise<Group | null> => {
  try {
    const groupRef = doc(db, COLLECTIONS.GROUPS, groupId);
    const groupSnap = await getDoc(groupRef);
    
    if (groupSnap.exists()) {
      const groupData = groupSnap.data();
      console.log('✅ グループ情報を取得しました:', groupId);
      
      // ★ 安全なTimestamp変換 ★
      const convertTimestamp = (timestamp: any): number => {
        if (!timestamp) return Date.now();
        
        if (timestamp && typeof timestamp.toMillis === 'function') {
          return timestamp.toMillis();
        }
        
        if (typeof timestamp === 'number') {
          return timestamp;
        }
        
        if (timestamp instanceof Date) {
          return timestamp.getTime();
        }
        
        if (typeof timestamp === 'string') {
          const parsed = new Date(timestamp).getTime();
          return isNaN(parsed) ? Date.now() : parsed;
        }
        
        return Date.now();
      };
      
      return {
        ...groupData,
        createdAt: convertTimestamp(groupData.createdAt),
        updatedAt: convertTimestamp(groupData.updatedAt)
      } as Group;
    } else {
      console.log('⚠️ グループが見つかりません:', groupId);
      return null;
    }
  } catch (error) {
    console.error('❌ グループ取得エラー:', error);
    throw error;
  }
};

// ユーザーが参加しているグループを取得（修正版）
export const getUserGroups = async (userId: string, userRole: string): Promise<Group[]> => {
  try {
    console.log('🔍 getUserGroups開始:', { userId, userRole });
    const groupsRef = collection(db, COLLECTIONS.GROUPS);
    
    if (userRole === 'admin') {
      // 管理者の場合：自分が作成したグループを取得
      const q = query(groupsRef, where('adminId', '==', userId));
      const querySnapshot = await getDocs(q);
      
      const groups: Group[] = [];
      querySnapshot.forEach((doc) => {
        const groupData = doc.data();
        
        // Timestamp変換処理
        const convertTimestamp = (timestamp: any): number => {
          if (!timestamp) return Date.now();
          if (timestamp && typeof timestamp.toMillis === 'function') {
            return timestamp.toMillis();
          }
          if (typeof timestamp === 'number') {
            return timestamp;
          }
          if (timestamp instanceof Date) {
            return timestamp.getTime();
          }
          if (typeof timestamp === 'string') {
            const parsed = new Date(timestamp).getTime();
            return isNaN(parsed) ? Date.now() : parsed;
          }
          return Date.now();
        };
        
        groups.push({
          ...groupData,
          createdAt: convertTimestamp(groupData.createdAt),
          updatedAt: convertTimestamp(groupData.updatedAt)
        } as Group);
      });
      
      console.log('✅ 管理者のグループを取得しました:', groups.length, '件');
      return groups;
    } else {
      // 一般ユーザーの場合：全グループを取得してフィルタリング
      const querySnapshot = await getDocs(groupsRef);
      const groups: Group[] = [];
      
      querySnapshot.forEach((doc) => {
        const groupData = doc.data();
        const members = groupData.members || [];
        
        console.log('🔍 グループチェック:', {
          groupName: groupData.name,
          groupId: doc.id,
          memberCount: members.length,
          targetUserId: userId
        });
        
        // より厳密なメンバーチェック
        let isMember = false;
        
        for (let i = 0; i < members.length; i++) {
          const member = members[i];
          console.log(`🔍 メンバー${i + 1}チェック:`, {
            memberType: typeof member,
            memberValue: member
          });
          
          if (typeof member === 'string') {
            // 文字列ID形式の場合
            if (member === userId) {
              isMember = true;
              console.log('✅ 文字列IDでマッチ:', member);
              break;
            }
          } else if (member && typeof member === 'object') {
            // オブジェクト形式の場合
            const memberId = member.id;
            console.log('🔍 オブジェクトからID取得:', memberId);
            
            if (memberId === userId) {
              isMember = true;
              console.log('✅ オブジェクトIDでマッチ:', memberId);
              break;
            }
          }
        }
        
        console.log('🔍 最終メンバー判定:', {
          groupName: groupData.name,
          isMember,
          userId
        });
        
        if (isMember) {
          const convertTimestamp = (timestamp: any): number => {
            if (!timestamp) return Date.now();
            if (timestamp && typeof timestamp.toMillis === 'function') {
              return timestamp.toMillis();
            }
            if (typeof timestamp === 'number') {
              return timestamp;
            }
            if (timestamp instanceof Date) {
              return timestamp.getTime();
            }
            if (typeof timestamp === 'string') {
              const parsed = new Date(timestamp).getTime();
              return isNaN(parsed) ? Date.now() : parsed;
            }
            return Date.now();
          };
          
          groups.push({
            ...groupData,
            createdAt: convertTimestamp(groupData.createdAt),
            updatedAt: convertTimestamp(groupData.updatedAt)
          } as Group);
          
          console.log('✅ グループを追加しました:', groupData.name);
        }
      });
      
      console.log('✅ ユーザーのグループを取得しました:', groups.length, '件');
      return groups;
    }
  } catch (error) {
    console.error('❌ ユーザーグループ取得エラー:', error);
    throw error;
  }
};


// 全グループを取得（管理者用）
export const getAllGroups = async (): Promise<Group[]> => {
  try {
    const groupsRef = collection(db, COLLECTIONS.GROUPS);
    const querySnapshot = await getDocs(groupsRef);
    
    const groups: Group[] = [];
    querySnapshot.forEach((doc) => {
      const groupData = doc.data();
      
      // 安全なTimestamp変換
      const convertTimestamp = (timestamp: any): number => {
        if (!timestamp) return Date.now();
        
        if (timestamp && typeof timestamp.toMillis === 'function') {
          return timestamp.toMillis();
        }
        
        if (typeof timestamp === 'number') {
          return timestamp;
        }
        
        if (timestamp instanceof Date) {
          return timestamp.getTime();
        }
        
        if (typeof timestamp === 'string') {
          const parsed = new Date(timestamp).getTime();
          return isNaN(parsed) ? Date.now() : parsed;
        }
        
        return Date.now();
      };
      
      groups.push({
        ...groupData,
        createdAt: convertTimestamp(groupData.createdAt),
        updatedAt: convertTimestamp(groupData.updatedAt)
      } as Group);
    });
    
    console.log('✅ 全グループ情報を取得しました:', groups.length, '件');
    return groups;
  } catch (error) {
    console.error('❌ 全グループ取得エラー:', error);
    throw error;
  }
};

// グループにメンバーを追加
// グループにメンバーを追加（修正版）
export const addMemberToGroup = async (groupId: string, memberInfo: any): Promise<boolean> => {
  try {
    // デバッグログを詳細化
    console.log('🔍 受信したmemberInfo:', memberInfo);
    console.log('🔍 memberInfo.id:', memberInfo.id);
    console.log('🔍 memberInfo.userId:', memberInfo.userId);
    console.log('🔍 memberInfo.uid:', memberInfo.uid);
    console.log('🔍 利用可能なプロパティ:', Object.keys(memberInfo));
    
    const groupRef = doc(db, COLLECTIONS.GROUPS, groupId);
    const groupSnap = await getDoc(groupRef);
    
    if (groupSnap.exists()) {
      const groupData = groupSnap.data();
      const currentMembers = groupData.members || [];
      
      // より柔軟なユーザーID取得
      const userId = memberInfo.id || memberInfo.userId || memberInfo.uid || memberInfo.user_id;
      console.log('🔍 最終的に取得したユーザーID:', userId);
      
      if (!userId) {
        console.error('❌ すべてのIDフィールドが空です:', {
          id: memberInfo.id,
          userId: memberInfo.userId,
          uid: memberInfo.uid,
          user_id: memberInfo.user_id
        });
        return false;
      }
      
      // 既にメンバーでない場合のみ追加
      const isAlreadyMember = currentMembers.some((member: any) => 
        typeof member === 'string' ? member === userId : member.id === userId
      );

      if (!isAlreadyMember) {
        // 確実なメンバー情報を作成
        const cleanMemberInfo = {
          id: userId,  // 確実にIDを設定
          username: memberInfo.username || 'ユーザー',
          email: memberInfo.email || '',
          profileData: {
            fullName: memberInfo.profileData?.fullName || memberInfo.username || 'ユーザー',
            company: memberInfo.profileData?.company || '',
            position: memberInfo.profileData?.position || '',
            phone: memberInfo.profileData?.phone || ''
          },
          role: memberInfo.role || 'user',
          joinedAt: memberInfo.joinedAt || Date.now()
        };

        console.log('✅ 作成されたクリーンなメンバー情報:', cleanMemberInfo);

        const cleanData = {
          members: [...currentMembers, cleanMemberInfo],
          updatedAt: Date.now()
        };
        
        await updateDoc(groupRef, cleanData);
        console.log('✅ グループにメンバーを追加しました:', groupId, userId);
        return true;
      } else {
        console.log('⚠️ ユーザーは既にメンバーです:', groupId, userId);
        return true;
      }
    } else {
      console.error('❌ グループが存在しません:', groupId);
      return false;
    }
  } catch (error) {
    console.error('❌ メンバー追加エラー:', error);
    return false;
  }
};

// グループを削除
export const deleteGroup = async (groupId: string): Promise<void> => {
  try {
    const groupRef = doc(db, COLLECTIONS.GROUPS, groupId);
    await deleteDoc(groupRef);
    console.log('✅ グループを削除しました:', groupId);
  } catch (error) {
    console.error('❌ グループ削除エラー:', error);
    throw error;
  }
};

// 新規グループを作成
export const createGroup = async (
  groupData: Omit<Group, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> => {
  try {
    // 新しいドキュメント参照を作成
    const groupsRef = collection(db, COLLECTIONS.GROUPS);
    const newGroupRef = doc(groupsRef);
    
    // 管理者ID取得
    const adminId = groupData.adminId;
    
    // 管理者を含むメンバー配列を作成
    const adminMemberInfo = {
      id: adminId,
      role: 'admin' as UserRole, 
      isAdmin: true,          // 管理者フラグ
      joinedAt: Date.now(),
      email: '',              // 後でユーザー情報から補完
      username: 'Admin'       // 後でユーザー情報から補完
    };
    
    // グループデータを作成（管理者権限設定込み）
    const completeGroupData: Group = {
      ...groupData,
      id: newGroupRef.id,
      createdBy: adminId,                    // 作成者設定
      adminIds: [adminId],                   // 管理者ID配列
      members: [adminMemberInfo],            // 管理者を含むメンバー配列
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    
    // Firestoreに保存
    await saveGroup(newGroupRef.id, completeGroupData);
    
    console.log('✅ 新しいグループを作成しました:', newGroupRef.id);
    return newGroupRef.id;
  } catch (error) {
    console.error('❌ グループ作成エラー:', error);
    throw error;
  }
};


// 投稿関連の関数を追加（2モード設計対応）
export const createPost = async (post: Omit<Post, 'id' | 'createdAt'>) => {
  try {
    // メインドキュメント用のデータ（画像はサムネイルのみ保存）
    // 画像データを除外（2重保存を防ぐ）
    const { images, ...postWithoutImages } = post as any;
    
    // 画像を配列として保存（新形式）
    const photoUrls = post.images || [];
    
    const postData = {
      ...postWithoutImages,
      createdAt: new Date(),
      images: [],  // 後方互換性のため空配列を保持
      photoUrls: photoUrls,  // ✅ 新形式：配列で保存
    };
    
    // メインドキュメントを作成
    const docRef = await addDoc(collection(db, 'posts'), postData);
    const postId = docRef.id;
    console.log('✅ 投稿を作成しました:', postId);
    console.log(`📸 画像 ${photoUrls.length}枚を配列で保存（新形式）`);

    return postId;
  } catch (error) {
    console.error('投稿の作成に失敗しました:', error);
    throw error;
  }
};

// ===== 2モード設計：サブコレクションから画像を取得 =====
export const getPostImages = async (postId: string): Promise<{
  documentImages: string[];
  photoImages: string[];
}> => {
  try {
    // まず投稿ドキュメント自体を取得して photoUrls をチェック
    const postRef = doc(db, 'posts', postId);
    const postSnap = await getDoc(postRef);
    
    if (!postSnap.exists()) {
      console.warn(`投稿が見つかりません: ${postId}`);
      return { documentImages: [], photoImages: [] };
    }
    
    const postData = postSnap.data();
    
    // 🆕 新形式: photoUrls フィールドがあればそれを使用
    if (postData.photoUrls && Array.isArray(postData.photoUrls) && postData.photoUrls.length > 0) {
      console.log(`✅ [新形式] 投稿ID: ${postId} - photoUrls から ${postData.photoUrls.length}枚取得`);
      
      // photoUrls を返す
      return {
        documentImages: [], // 新形式では区別しない
        photoImages: postData.photoUrls
      };
    }

    
    
    // 📦 旧形式: サブコレクションから取得（後方互換性）
    console.log(`📦 [旧形式] 投稿ID: ${postId} - サブコレクションから取得中...`);
    // 図面・書類画像を取得
    const documentImagesRef = collection(db, 'posts', postId, 'documentImages');
    const documentSnapshot = await getDocs(query(documentImagesRef, orderBy('order')));
    const documentImages = documentSnapshot.docs.map(doc => doc.data().image as string);

    // 現場写真を取得
    const photoImagesRef = collection(db, 'posts', postId, 'photoImages');
    const photoSnapshot = await getDocs(query(photoImagesRef, orderBy('order')));
    const photoImages = photoSnapshot.docs.map(doc => doc.data().image as string);

    console.log(`📸 画像取得完了: 図面${documentImages.length}枚, 写真${photoImages.length}枚`);

    return { documentImages, photoImages };
  } catch (error) {
    console.error('画像の取得に失敗しました:', error);
    return { documentImages: [], photoImages: [] };
  }
};

export const updatePost = async (postId: string, updates: Partial<Post>) => {
  try {
    const postRef = doc(db, 'posts', postId);
    await updateDoc(postRef, {
      ...updates,
      updatedAt: new Date(),
    });
    console.log('投稿を更新しました:', postId);
  } catch (error) {
    console.error('投稿の更新に失敗しました:', error);
    throw error;
  }
};

export const deletePost = async (postId: string) => {
  try {
    const postRef = doc(db, 'posts', postId);
    await deleteDoc(postRef);
    console.log('投稿を削除しました:', postId);
  } catch (error) {
    console.error('投稿の削除に失敗しました:', error);
    throw error;
  }
};

/**
 * 複数投稿の旧形式画像を一括取得（バッチ版）
 */
export const getOldFormatImagesBatch = async (
  postIds: string[]
): Promise<Map<string, { documentImages: string[]; photoImages: string[] }>> => {
  const results = new Map<string, { documentImages: string[]; photoImages: string[] }>();
  
  if (postIds.length === 0) {
    return results;
  }

  console.log(`🚀 [バッチ] 旧形式画像取得開始: ${postIds.length} 件`);

  try {
    // Promise.allで並列取得
    await Promise.all(
      postIds.map(async (postId) => {
        try {
          // 図面・書類画像を取得
          const documentImagesRef = collection(db, 'posts', postId, 'documentImages');
          const documentSnapshot = await getDocs(query(documentImagesRef, orderBy('order')));
          const documentImages = documentSnapshot.docs.map(doc => doc.data().image as string);

          // 現場写真を取得
          const photoImagesRef = collection(db, 'posts', postId, 'photoImages');
          const photoSnapshot = await getDocs(query(photoImagesRef, orderBy('order')));
          const photoImages = photoSnapshot.docs.map(doc => doc.data().image as string);

          results.set(postId, { documentImages, photoImages });
        } catch (error) {
          console.error(`❌ [バッチ] 投稿ID ${postId} の画像取得失敗:`, error);
          results.set(postId, { documentImages: [], photoImages: [] });
        }
      })
    );

    console.log(`✅ [バッチ] 旧形式画像取得完了: ${results.size} 件`);
    return results;
  } catch (error) {
    console.error('❌ [バッチ] 画像一括取得エラー:', error);
    return results;
  }
};

export const getPostsByGroup = async (groupId: string): Promise<Post[]> => {
  try {
    const postsQuery = query(
      collection(db, 'posts'),
      where('groupId', '==', groupId),
      orderBy('createdAt', 'desc')
    );
    
    const querySnapshot = await getDocs(postsQuery);
    const posts: Post[] = [];
    
    querySnapshot.forEach((doc) => {
      posts.push({
        id: doc.id,
        ...doc.data(),
      } as Post);
    });
    
    console.log(`グループ ${groupId} の投稿を取得しました:`, posts.length, '件');
    return posts;
  } catch (error) {
    console.error('投稿の取得に失敗しました:', error);
    return [];
  }
};


// firestore.tsに追加すべき欠落している関数群

// ===== 欠落している関数を追加 =====

// グループからメンバーを削除
export const removeMemberFromGroup = async (groupId: string, memberId: string): Promise<boolean> => {
  try {
    const groupRef = doc(db, COLLECTIONS.GROUPS, groupId);
    const groupSnap = await getDoc(groupRef);
    
    if (groupSnap.exists()) {
      const groupData = groupSnap.data();
      const currentMembers = groupData.members || [];
      
      // メンバーを除外した新しい配列を作成
      const updatedMembers = currentMembers.filter((member: any) => 
        typeof member === 'string' ? member !== memberId : member.id !== memberId
      );
      
      // グループを更新
      await updateDoc(groupRef, {
        members: updatedMembers,
        updatedAt: serverTimestamp()
      });
      
      console.log('✅ グループからメンバーを削除しました:', groupId, memberId);
      return true;
    } else {
      console.error('❌ グループが存在しません:', groupId);
      return false;
    }
  } catch (error) {
    console.error('❌ メンバー削除エラー:', error);
    return false;
  }
};

// メンバーの権限を更新
export const updateMemberRole = async (groupId: string, memberId: string, newRole: string): Promise<boolean> => {
  try {
    const groupRef = doc(db, COLLECTIONS.GROUPS, groupId);
    const groupSnap = await getDoc(groupRef);
    
    if (groupSnap.exists()) {
      const groupData = groupSnap.data();
      const currentMembers = groupData.members || [];
      
      // メンバーの権限を更新
      const updatedMembers = currentMembers.map((member: any) => {
        if (typeof member === 'string') {
          return member === memberId ? { id: member, role: newRole } : member;
        } else if (member && member.id === memberId) {
          return { ...member, role: newRole };
        }
        return member;
      });
      
      await updateDoc(groupRef, {
        members: updatedMembers,
        updatedAt: serverTimestamp()
      });
      
      console.log('✅ メンバー権限を更新しました:', groupId, memberId, newRole);
      return true;
    } else {
      console.error('❌ グループが存在しません:', groupId);
      return false;
    }
  } catch (error) {
    console.error('❌ メンバー権限更新エラー:', error);
    return false;
  }
};

// メンバーのアクティブ状態を更新
export const updateMemberStatus = async (groupId: string, memberId: string, active: boolean): Promise<boolean> => {
  try {
    const groupRef = doc(db, COLLECTIONS.GROUPS, groupId);
    const groupSnap = await getDoc(groupRef);
    
    if (groupSnap.exists()) {
      const groupData = groupSnap.data();
      const currentMembers = groupData.members || [];
      
      // メンバーのアクティブ状態を更新
      const updatedMembers = currentMembers.map((member: any) => {
        if (typeof member === 'string') {
          return member === memberId ? { id: member, active } : member;
        } else if (member && member.id === memberId) {
          return { ...member, active };
        }
        return member;
      });
      
      await updateDoc(groupRef, {
        members: updatedMembers,
        updatedAt: serverTimestamp()
      });
      
      console.log('✅ メンバー状態を更新しました:', groupId, memberId, active);
      return true;
    } else {
      console.error('❌ グループが存在しません:', groupId);
      return false;
    }
  } catch (error) {
    console.error('❌ メンバー状態更新エラー:', error);
    return false;
  }
};

// 投稿の取得（特定ユーザー）
export const getUserPosts = async (userId: string): Promise<Post[]> => {
  try {
    const postsQuery = query(
      collection(db, COLLECTIONS.POSTS),
      where('authorId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    
    const querySnapshot = await getDocs(postsQuery);
    const posts: Post[] = [];
    
    querySnapshot.forEach((doc) => {
      const postData = doc.data();
      
      // 安全なTimestamp変換
      const convertTimestamp = (timestamp: any): number => {
        if (!timestamp) return Date.now();
        if (timestamp && typeof timestamp.toMillis === 'function') {
          return timestamp.toMillis();
        }
        if (typeof timestamp === 'number') {
          return timestamp;
        }
        if (timestamp instanceof Date) {
          return timestamp.getTime();
        }
        if (typeof timestamp === 'string') {
          const parsed = new Date(timestamp).getTime();
          return isNaN(parsed) ? Date.now() : parsed;
        }
        return Date.now();
      };
      
      posts.push({
        id: doc.id,
        ...postData,
        createdAt: convertTimestamp(postData.createdAt),
        updatedAt: convertTimestamp(postData.updatedAt)
      } as Post);
    });
    
    console.log(`ユーザー ${userId} の投稿を取得しました:`, posts.length, '件');
    return posts;
  } catch (error) {
    console.error('❌ ユーザー投稿取得エラー:', error);
    return [];
  }
};

// 投稿の詳細取得
export const getPost = async (postId: string): Promise<Post | null> => {
  try {
    const postRef = doc(db, COLLECTIONS.POSTS, postId);
    const postSnap = await getDoc(postRef);
    
    if (postSnap.exists()) {
      const postData = postSnap.data();
      
      // 安全なTimestamp変換
      const convertTimestamp = (timestamp: any): number => {
        if (!timestamp) return Date.now();
        if (timestamp && typeof timestamp.toMillis === 'function') {
          return timestamp.toMillis();
        }
        if (typeof timestamp === 'number') {
          return timestamp;
        }
        if (timestamp instanceof Date) {
          return timestamp.getTime();
        }
        if (typeof timestamp === 'string') {
          const parsed = new Date(timestamp).getTime();
          return isNaN(parsed) ? Date.now() : parsed;
        }
        return Date.now();
      };
      
      return {
        id: postId,
        ...postData,
        createdAt: convertTimestamp(postData.createdAt),
        updatedAt: convertTimestamp(postData.updatedAt)
      } as Post;
    } else {
      console.log('⚠️ 投稿が見つかりません:', postId);
      return null;
    }
  } catch (error) {
    console.error('❌ 投稿取得エラー:', error);
    throw error;
  }
};

　
// ユーザーのグループ取得機能（ProfilePage用）
export const getGroupsByUser = async (userId: string): Promise<Group[]> => {
  try {
    console.log('🔍 ユーザーのグループ取得開始:', userId);
    
    // 既存のgetUserGroups関数を使用
    const userRole = localStorage.getItem('daily-report-user-role') || 'user';
    const groups = await getUserGroups(userId, userRole);
    
    console.log('✅ ユーザーグループ取得完了:', groups.length, '件');
    return groups;
  } catch (error) {
    console.error('❌ ユーザーグループ取得エラー:', error);
    return [];
  }
};

// グループ更新機能
export const updateGroup = async (groupId: string, updateData: Partial<Group>): Promise<boolean> => {
  try {
    console.log('🔍 グループ更新処理開始:', groupId);
    
    const groupRef = doc(db, COLLECTIONS.GROUPS, groupId);
    
    // 更新データに更新時刻を追加
    const dataWithTimestamp = {
      ...updateData,
      updatedAt: serverTimestamp()
    };
    
    // Firestoreを更新
    await updateDoc(groupRef, dataWithTimestamp);
    console.log('✅ Firestoreのグループを更新しました:', groupId);
    
    return true;
  } catch (error) {
    console.error('❌ グループ更新エラー:', error);
    return false;
  }
};

// 最下部に追加
export { db } from './config';