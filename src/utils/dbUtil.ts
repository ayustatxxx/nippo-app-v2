// utils/dbUtil.ts
import { User, Group } from '../types';
import { getCurrentUser } from './authUtil'; 
import { 
  getUserGroups as getFirestoreUserGroups,
  saveGroup as saveFirestoreGroup,
  createGroup as createFirestoreGroup,
  getGroup as getFirestoreGroup,
  addMemberToGroup as addFirestoreMemberToGroup,
  removeMemberFromGroup as removeFirestoreMemberFromGroup,
  deleteGroup as deleteFirestoreGroup
} from '../firebase/firestore';



// データベース設定
export const DB_NAME = "daily-report-db";
export const DB_VERSION = 4;
export const STORES = {
  USERS: "users",
  GROUPS: "groups", 
  POSTS: "posts",
  NOTIFICATIONS: "notifications",
  WORKTIMES: "worktimes",  // ← この行を追加
  MEMOS: "memos",
};

// IndexedDB初期化関数
export const initIndexedDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = (event) => {
      console.error("IndexedDBエラー:", event);
      reject("データベースの初期化に失敗しました");
    };
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      // ユーザーストア
      if (!db.objectStoreNames.contains(STORES.USERS)) {
        const userStore = db.createObjectStore(STORES.USERS, { keyPath: "id" });
        userStore.createIndex("email", "email", { unique: true });
        userStore.createIndex("role", "role", { unique: false });
      }
      
      // グループストア
      if (!db.objectStoreNames.contains(STORES.GROUPS)) {
        const groupStore = db.createObjectStore(STORES.GROUPS, { keyPath: "id" });
        groupStore.createIndex("adminId", "adminId", { unique: false });
      }
      
      // 既存のPOSTSストアを修正
      if (db.objectStoreNames.contains(STORES.POSTS)) {
        db.deleteObjectStore(STORES.POSTS);
      }
      const postStore = db.createObjectStore(STORES.POSTS, { keyPath: "id" });
      postStore.createIndex("userId", "userId", { unique: false });
      postStore.createIndex("groupId", "groupId", { unique: false });
      postStore.createIndex("timestamp", "timestamp", { unique: false });
      
      // 通知ストア
      if (!db.objectStoreNames.contains(STORES.NOTIFICATIONS)) {
        const notifStore = db.createObjectStore(STORES.NOTIFICATIONS, { keyPath: "id" });
        notifStore.createIndex("userId", "userId", { unique: false });
        notifStore.createIndex("isRead", "isRead", { unique: false });
      }
      // 作業時間ストア
if (!db.objectStoreNames.contains(STORES.WORKTIMES)) {
  const workTimeStore = db.createObjectStore(STORES.WORKTIMES, { keyPath: "id" });
  workTimeStore.createIndex("userId", "userId", { unique: false });
  workTimeStore.createIndex("groupId", "groupId", { unique: false });
  workTimeStore.createIndex("date", "date", { unique: false });
}
// メモストア
if (!db.objectStoreNames.contains(STORES.MEMOS)) {
  const memoStore = db.createObjectStore(STORES.MEMOS, { keyPath: "id" });
  memoStore.createIndex("postId", "postId", { unique: false });
  memoStore.createIndex("createdBy", "createdBy", { unique: false });
  memoStore.createIndex("createdAt", "createdAt", { unique: false });
}
    };
    
    request.onsuccess = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      resolve(db);
    };
  });
};


// データベース操作のユーティリティクラス
export class DBUtil {
  private static instance: DBUtil;
  private db: IDBDatabase | null = null;
  
  private constructor() {}
  
  public static getInstance(): DBUtil {
    if (!DBUtil.instance) {
      DBUtil.instance = new DBUtil();
    }
    return DBUtil.instance;
  }
  
  public async initDB(): Promise<void> {
    if (this.db) return;
    try {
      this.db = await initIndexedDB();
    } catch (error) {
      console.error("DB初期化エラー:", error);
      throw error;
    }
  }
  
  public async get<T>(storeName: string, id: string, retryCount: number = 0): Promise<T | null> {
  if (!this.db) {
    await this.initDB();
  }
  
  try {
    return await new Promise<T | null>((resolve, reject) => {
      try {
        const transaction = this.db!.transaction(storeName, "readonly");
        const store = transaction.objectStore(storeName);
        const request = store.get(id);
        
        request.onerror = () => reject(new Error(`データ取得エラー: ${storeName}`));
        request.onsuccess = () => resolve(request.result || null);
        
        transaction.onerror = () => reject(new Error(`トランザクションエラー: ${storeName}`));
      } catch (innerError) {
        reject(innerError);
      }
    });
  } catch (error) {
    console.error('get() でエラー:', error);
    
    // 🛡️ 安全策：最大2回まで再試行
    if (error instanceof DOMException && 
        error.name === 'InvalidStateError' && 
        retryCount < 2) {
      console.log(`🔄 接続が閉じているため再初期化します（試行${retryCount + 1}/2）`);
      this.db = null;
      await this.initDB();
      return await this.get<T>(storeName, id, retryCount + 1);
    }
    throw error;
  }
}
  
  public async save<T>(storeName: string, data: T, retryCount: number = 0): Promise<void> {
  if (!this.db) {
    await this.initDB();
  }
  
  return new Promise(async (resolve, reject) => {
    try {
      const transaction = this.db!.transaction(storeName, "readwrite");
      const store = transaction.objectStore(storeName);
      const request = store.put(data);
      
      request.onerror = () => reject(new Error(`データ保存エラー: ${storeName}`));
      request.onsuccess = () => resolve();
      
      // トランザクションエラーも検知
      transaction.onerror = () => reject(new Error(`トランザクションエラー: ${storeName}`));
    } catch (error) {
      console.error('save() でエラー:', error);
      
      // 🛡️ 安全策：最大2回まで再試行
      if (error instanceof DOMException && 
          error.name === 'InvalidStateError' && 
          retryCount < 2) {
        console.log(`🔄 接続が閉じているため再初期化します（試行${retryCount + 1}/2）`);
        this.db = null;
        await this.initDB();
        
        try {
          await this.save(storeName, data, retryCount + 1);
          resolve();
        } catch (retryError) {
          reject(retryError);
        }
        return;
      }
      reject(error);
    }
  });
}
  
  public async getByIndex<T>(storeName: string, indexName: string, value: any, retryCount: number = 0): Promise<T[]> {
  if (!this.db) {
    await this.initDB();
  }
  
  return new Promise(async (resolve, reject) => {
    try {
      const transaction = this.db!.transaction(storeName, "readonly");
      const store = transaction.objectStore(storeName);
      const index = store.index(indexName);
      const request = index.getAll(value);
      
      request.onerror = () => reject(new Error(`インデックス検索エラー: ${indexName}`));
      request.onsuccess = () => resolve(request.result);
      
      transaction.onerror = () => reject(new Error(`トランザクションエラー: ${indexName}`));
    } catch (error) {
      console.error('getByIndex() でエラー:', error);
      
      // 🛡️ 安全策：最大2回まで再試行
      if (error instanceof DOMException && 
          error.name === 'InvalidStateError' && 
          retryCount < 2) {
        console.log(`🔄 接続が閉じているため再初期化します（試行${retryCount + 1}/2）`);
        this.db = null;
        await this.initDB();
        
        try {
          const result = await this.getByIndex<T>(storeName, indexName, value, retryCount + 1);
          resolve(result);
        } catch (retryError) {
          reject(retryError);
        }
        return;
      }
      reject(error);
    }
  });
}
  
  public async getAll<T>(storeName: string, retryCount: number = 0): Promise<T[]> {
  if (!this.db) {
    await this.initDB();
  }
  
  return new Promise(async (resolve, reject) => {
    try {
      const transaction = this.db!.transaction(storeName, "readonly");
      const store = transaction.objectStore(storeName);
      const request = store.getAll();
      
      request.onerror = () => reject(new Error(`全データ取得エラー: ${storeName}`));
      request.onsuccess = () => resolve(request.result);
      
      transaction.onerror = () => reject(new Error(`トランザクションエラー: ${storeName}`));
    } catch (error) {
      console.error('getAll() でエラー:', error);
      
      // 🛡️ 安全策：最大2回まで再試行
      if (error instanceof DOMException && 
          error.name === 'InvalidStateError' && 
          retryCount < 2) {
        console.log(`🔄 接続が閉じているため再初期化します（試行${retryCount + 1}/2）`);
        this.db = null;
        await this.initDB();
        
        try {
          const result = await this.getAll<T>(storeName, retryCount + 1);
          resolve(result);
        } catch (retryError) {
          reject(retryError);
        }
        return;
      }
      reject(error);
    }
  });
}
  
  public async delete(storeName: string, id: string): Promise<void> {
    if (!this.db) await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, "readwrite");
      const store = transaction.objectStore(storeName);
      const request = store.delete(id);
      
      request.onerror = () => reject(new Error(`データ削除エラー: ${storeName}`));
      request.onsuccess = () => resolve();
    });
  }
}


   

// Firebase + IndexDB対応のグループ作成関数
export const createGroupWithFirestore = async (
  groupData: Omit<Group, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> => {
  try {
    console.log('🔥 Firestoreでグループを作成中...', groupData.name);
    
    // 1. Firestoreにグループを作成
    try {
      const groupId = await createFirestoreGroup(groupData);
      console.log('✅ Firestoreグループ作成完了:', groupId);
      
      // 2. IndexedDBにも保存（互換性のため）
      const dbUtil = DBUtil.getInstance();
      await dbUtil.initDB();
      
      const completeGroupData: Group = {
        ...groupData,
        id: groupId,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      
      await dbUtil.save(STORES.GROUPS, completeGroupData);
      console.log('✅ IndexedDBにもグループを保存');
      
      return groupId;
    } catch (firestoreError) {
      console.error('❌ Firestore作成失敗、IndexedDBのみで作成:', firestoreError);
      
      // 3. Firestoreに失敗した場合、IndexedDBのみで作成
      const dbUtil = DBUtil.getInstance();
      await dbUtil.initDB();
      
      const groupId = `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const completeGroupData: Group = {
        ...groupData,
        id: groupId,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      
      await dbUtil.save(STORES.GROUPS, completeGroupData);
      console.log('✅ IndexedDBでグループを作成:', groupId);
      
      return groupId;
    }
  } catch (error) {
    console.error('❌ グループ作成エラー:', error);
    throw error;
  }
};

// グループ情報更新関数
export const updateGroupWithFirestore = async (
  groupId: string, 
  updateData: Partial<Group>
): Promise<void> => {
  try {
    console.log('🔄 グループを更新中...', groupId);
    
    // 1. Firestoreを更新
    try {
      await saveFirestoreGroup(groupId, updateData);
      console.log('✅ Firestoreグループ更新完了');
    } catch (firestoreError) {
      console.error('❌ Firestore更新失敗:', firestoreError);
    }
    
    // 2. IndexedDBも更新（互換性のため）
    const dbUtil = DBUtil.getInstance();
    await dbUtil.initDB();
    
    const existingGroup = await dbUtil.get<Group>(STORES.GROUPS, groupId);
    if (existingGroup) {
      const updatedGroup = {
        ...existingGroup,
        ...updateData,
        updatedAt: Date.now()
      };
      await dbUtil.save(STORES.GROUPS, updatedGroup);
      console.log('✅ IndexedDBグループ更新完了');
    }
  } catch (error) {
    console.error('❌ グループ更新エラー:', error);
    throw error;
  }
};

// メンバー管理関数
export const addMemberToGroupWithFirestore = async (
  groupId: string, 
  userId: string
): Promise<void> => {
  try {
    // 1. Firestoreにメンバー追加
    try {
      await addFirestoreMemberToGroup(groupId, userId);
      console.log('✅ Firestoreメンバー追加完了');
    } catch (firestoreError) {
      console.error('❌ Firestoreメンバー追加失敗:', firestoreError);
    }
    
    // 2. IndexedDBも更新
    const dbUtil = DBUtil.getInstance();
    await dbUtil.initDB();
    
    const group = await dbUtil.get<Group>(STORES.GROUPS, groupId);
    if (group) {
      const currentMembers = group.members || [];
if (!currentMembers.find(member => member.id === userId)) {
  const newMember = {
    id: userId,
    role: 'user' as const,
    isAdmin: false,
    joinedAt: Date.now(),
    email: '',
    username: userId
  };
  group.members = [...currentMembers, newMember];
        group.updatedAt = Date.now();
        await dbUtil.save(STORES.GROUPS, group);
        console.log('✅ IndexedDBメンバー追加完了');
      }
    }
  } catch (error) {
    console.error('❌ メンバー追加エラー:', error);
    throw error;
  }
};

// グループ作成関数
export const createGroup = async (
  groupData: Omit<Group, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Group | null> => {
  const dbUtil = DBUtil.getInstance();
  await dbUtil.initDB();
  
  try {
    const now = Date.now();
    const newGroup: Group = {
      ...groupData,
      id: `group_${now}_${Math.random().toString(36).substring(2, 10)}`,
      createdAt: now,
      updatedAt: now
    };
    
    await dbUtil.save(STORES.GROUPS, newGroup);
    
    // 管理者自身をグループに追加
    const admin = await dbUtil.get<User>(STORES.USERS, newGroup.adminId);
    if (admin) {
      const updatedAdmin: User = {
        ...admin,
        groups: [...(admin.groups || []), newGroup.id],
        updatedAt: now
      };
      await dbUtil.save(STORES.USERS, updatedAdmin);
    }
    
    return newGroup;
  } catch (error) {
    console.error("グループ作成エラー:", error);
    return null;
  }
};


// ダミーグループ生成関数（開発用）
const generateDummyGroups = async (adminId: string): Promise<Group[]> => {
  const dbUtil = DBUtil.getInstance();
  await dbUtil.initDB();
  
  const dummyGroups: Group[] = [
    {
      id: `group_${Date.now()}_1`,
      name: "北長瀬 / 岡本邸",
      description: "新築工事プロジェクト",
      adminId: adminId,
      members: [{
  id: adminId,
  role: 'admin' as const,
  isAdmin: true,
  joinedAt: Date.now() - 86400000, // 1日前
  email: '',
  username: 'admin'
}],
      inviteCode: `INV_${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      settings: {
        reportDeadline: "18:00",
        reportFrequency: "daily",
        allowMemberInvite: false,
        autoArchive: false,
        location: {
          address: "岡山県岡山市北区北長瀬",
          coordinates: { lat: 34.6851, lng: 133.8851 }
        }
      },
      createdAt: Date.now() - 86400000, // 1日前
      updatedAt: Date.now()
    },
    {
      id: `group_${Date.now()}_2`,
      name: "下石井 / 山下邸",
      description: "リノベーション工事",
      adminId: adminId,
      members: [{
  id: adminId,
  role: 'admin' as const,
  isAdmin: true,
  joinedAt: Date.now() - 86400000, // 1日前
  email: '',
  username: 'admin'
}],
      inviteCode: `INV_${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      settings: {
        reportDeadline: "17:30",
        reportFrequency: "daily",
        allowMemberInvite: true,
        autoArchive: false,
        location: {
          address: "岡山県岡山市北区下石井",
          coordinates: { lat: 34.6721, lng: 133.9181 }
        }
      },
      createdAt: Date.now() - 172800000, // 2日前
      updatedAt: Date.now()
    }
  ];
  
  // ダミーグループをIndexedDBに保存
  for (const group of dummyGroups) {
    await dbUtil.save(STORES.GROUPS, group);
  }
  
  console.log('✅ ダミーグループを生成・保存しました:', dummyGroups.length, '件');
  return dummyGroups;
};


// Firebase + Firestore対応のグループ取得関数
export const getGroups = async (userId: string, userRole: string): Promise<Group[]> => {
  try {
    let actualUserId = userId;
    if (!actualUserId || actualUserId === 'undefined') {
      // 修正: Firebase認証から直接取得
      const currentUser = await getCurrentUser();
      if (currentUser && currentUser.id) {
        actualUserId = currentUser.id;
        console.log('getCurrentUserからユーザーIDを取得:', actualUserId);
      } else {
        // フォールバック
        const userData = localStorage.getItem('daily-report-user-data');
        if (userData) {
          try {
            const parsedUserData = JSON.parse(userData);
            actualUserId = parsedUserData.id || parsedUserData.uid;
            console.log('userDataからユーザーIDを取得:', actualUserId);
          } catch (e) {
            console.error('userDataの解析に失敗:', e);
          }
        }
      }
    }
    
    console.log('グループを取得中...', { userId: actualUserId, userRole });
    
    // actualUserIdが依然として未定義の場合はエラーを避ける
    if (!actualUserId) {
      console.error('有効なユーザーIDが取得できません');
      return [];
    }
    
    // 1. Firestoreから取得を試行
    try {
      const firestoreGroups = await getFirestoreUserGroups(actualUserId, userRole);
      if (firestoreGroups.length > 0) {
        console.log('Firestoreからグループを取得:', firestoreGroups.length, '件');
        return firestoreGroups;
      }
    } catch (firestoreError) {
      console.log('Firestore取得に失敗、localStorageにフォールバック:', firestoreError);
    }
    
    // 2. localStorageから取得
    console.log('localStorageからグループを取得...');
    let groups: Group[] = [];
    
    const localGroupsStr = localStorage.getItem('daily-report-groups');
    if (localGroupsStr && actualUserId) {
      try {
        const localGroups = JSON.parse(localGroupsStr);
        if (userRole === 'admin') {
          groups = localGroups.filter((group: Group) => group.adminId === actualUserId);
        } else {
          groups = localGroups.filter((group: Group) => 
  group.members && group.members.some(member => member.id === actualUserId)
);
        }
      } catch (e) {
        console.error('localStorage解析エラー:', e);
        groups = [];
      }
    }
    
    console.log('localStorageからグループを取得:', groups.length, '件');
    return groups;
    
  } catch (error) {
    console.error('グループ取得エラー:', error);
    return [];
  }
};

// Firestore対応のグループ取得関数（単一グループ）
export const getGroupWithFirestore = async (groupId: string): Promise<Group | null> => {
  try {
    console.log('Firestoreからグループを取得中...', groupId);
    
    // 1. まずFirestoreから取得を試行
    try {
      const group = await getFirestoreGroup(groupId);
      if (group) {
        console.log('Firestoreからグループを取得:', group.name);
        return group;
      }
    } catch (firestoreError) {
      console.log('Firestore取得に失敗、IndexedDBにフォールバック:', firestoreError);
    }
    
    // 2. Firestoreで取得できない場合、IndexedDBから取得
    console.log('IndexedDBからグループを取得...');
    const dbUtil = DBUtil.getInstance();
    await dbUtil.initDB();
    
    const group = await dbUtil.get<Group>(STORES.GROUPS, groupId);
    
    if (group) {
      console.log('IndexedDBからグループを取得:', group.name);
      return group;
    }
    
    console.log('グループが見つかりません:', groupId);
    return null;
  } catch (error) {
    console.error('グループ取得エラー:', error);
    return null;
  }
};

export const getUserGroups = async (userId: string): Promise<Group[]> => {
  console.log('🔍 グループを取得中...', { userId });
  
  
  // ★ 追加: リトライ機能付きでFirestoreから取得 ★
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      console.log(`🔄 Firestore取得試行 ${attempt}/3`);
      
      const currentUser = await getCurrentUser();
      const userRole = currentUser?.role || 'user';
      
      const firestoreGroups = await getFirestoreUserGroups(userId, userRole);
      console.log(`✅ Firestore取得成功(${attempt}回目):`, firestoreGroups?.length || 0, '件');
      
      if (firestoreGroups && firestoreGroups.length > 0) {
        return firestoreGroups;
      }
      
      // 1回目で0件の場合、少し待ってリトライ
      if (attempt < 3) {
        console.log(`⏳ ${attempt}回目は0件、${500 * attempt}ms後にリトライ`);
        await new Promise(resolve => setTimeout(resolve, 500 * attempt));
      }
      
    } catch (error) {
      console.warn(`⚠️ Firestore取得エラー(${attempt}回目):`, error);
      if (attempt < 3) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }
  
  // 3回試してもダメな場合、IndexedDBフォールバック
  console.log('📱 IndexedDBフォールバックに切り替え');
  const dbUtil = DBUtil.getInstance();
  await dbUtil.initDB();
  
  const allGroups = await dbUtil.getAll<Group>(STORES.GROUPS);
  const userGroups = allGroups.filter(group => 
  group.adminId === userId || (group.members && group.members.some(member => member.id === userId))
);
  
  console.log('📱 IndexedDBからグループを取得:', userGroups.length, '件');
  return userGroups;
};


// dbUtil.ts の一番下に追加してください

/**
 * ユーザーをグループに追加する関数
 */
 export const addUserToGroup = async (groupId: string, userId: string): Promise<boolean> => {
  try {
    console.log('グループ参加処理開始:', { groupId, userId });
    console.log('受信したuserIdパラメータ:', userId); // 追加

    // 1. 現在のユーザー情報を取得
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      console.error('現在のユーザー情報が取得できません');
      return false;
    }

    console.log('取得したユーザー情報:', currentUser);

    // 2. 詳細なユーザー情報オブジェクトを作成
    const memberInfo = {
      id: userId, // ここが問題の可能性
      username: currentUser.username || currentUser.profileData?.fullName || 'ユーザー',
      email: currentUser.email || '',
      profileData: {
        fullName: currentUser.profileData?.fullName || currentUser.username || 'ユーザー',
        company: currentUser.profileData?.company || '',
        position: currentUser.profileData?.position || '',
        phone: currentUser.profileData?.phone || ''
      },
      role: currentUser.role || 'user',
      joinedAt: Date.now()
    };

    console.log('作成したメンバー情報:', memberInfo);
    console.log('memberInfo.idの値:', memberInfo.id); // 追加

    // 3. Firestoreにメンバーを追加
    const firestoreSuccess = await addFirestoreMemberToGroup(groupId, memberInfo);
    if (!firestoreSuccess) {
      console.error('Firestoreへのメンバー追加に失敗');
      return false;
    }

    // 4. localStorageも更新
    const existingGroupsStr = localStorage.getItem('daily-report-groups');
    let existingGroups = [];
    if (existingGroupsStr) {
      try {
        existingGroups = JSON.parse(existingGroupsStr);
      } catch (e) {
        existingGroups = [];
      }
    }

    // Firestoreから最新のグループ情報を取得して同期
    const updatedGroup = await getGroupWithFirestore(groupId);
    if (updatedGroup) {
      const groupIndex = existingGroups.findIndex((g: any) => g.id === groupId);
      if (groupIndex >= 0) {
        existingGroups[groupIndex] = updatedGroup;
      } else {
        existingGroups.push(updatedGroup);
      }
      localStorage.setItem('daily-report-groups', JSON.stringify(existingGroups));
    }

    // 5. ユーザーデータも更新
    const updatedUserData = {
      ...currentUser,
      groups: [...(currentUser.groups || []), groupId],
      updatedAt: Date.now()
    };
    localStorage.setItem('daily-report-user-data', JSON.stringify(updatedUserData));

    console.log('グループ参加処理完了');
    return true;

  } catch (error) {
    console.error('グループ参加エラー:', error);
    return false;
  }
};