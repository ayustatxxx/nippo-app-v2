import { 
  collection, 
  doc, 
  addDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  query, 
  where, 
  orderBy,
  getFirestore, 
  increment,
  limit as limitFirestore,
} from 'firebase/firestore';

// 既存のFirebase設定をimportで取得
import { db } from '../firebase/firestore';
import { Group, User, Post } from '../types';



/**
 * Firestore直結サービス（修正版）
 * 既存のFirebase設定を使用
 */

/**
 * グループ作成
 */
export const createGroupWithFirestore = async (groupData: any): Promise<string> => {
  try {
    console.log('🔥 グループ作成開始:', groupData.name);
    
    const docRef = await addDoc(collection(db, 'groups'), {
      ...groupData,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isDeleted: false
    });
    
    console.log('✅ グループ作成完了:', docRef.id);
    return docRef.id;
    
  } catch (error) {
    console.error('❌ グループ作成エラー:', error);
    throw error;
  }
};

/**
 * グループ一覧取得
 */
export const getGroups = async (userId: string, userRole: string): Promise<any[]> => {
  try {
    console.log('🔥 グループ一覧取得開始');
    
    const groupsRef = collection(db, 'groups');
const q = query(
  groupsRef,
  orderBy('createdAt', 'desc')
);

const querySnapshot = await getDocs(q);
const groups: any[] = [];

querySnapshot.forEach((doc) => {
  const groupData = doc.data();
  
  // システム管理者：全グループを追加
  // 一般ユーザー：自分が参加しているグループだけ追加
  if (userRole === 'admin') {
    groups.push({
      id: doc.id,
      ...groupData
    });
  } else {
    // members配列に自分のidが含まれているか確認
    const isMember = groupData.members?.some((member: any) => member.id === userId);
    if (isMember) {
      groups.push({
        id: doc.id,
        ...groupData
      });
    }
  }
});
    
    console.log('✅ グループ一覧取得完了:', groups.length, '件');
    return groups;
    
  } catch (error) {
    console.error('❌ グループ一覧取得エラー:', error);
    return [];
  }
};

/**
 * グループ更新
 */
export const updateGroupWithFirestore = async (groupId: string, updateData: any): Promise<void> => {
  try {
    console.log('🔥 グループ更新開始:', groupId);
    
    const groupRef = doc(db, 'groups', groupId);
    await updateDoc(groupRef, {
      ...updateData,
      updatedAt: Date.now()
    });
    
    console.log('✅ グループ更新完了');
    
  } catch (error) {
    console.error('❌ グループ更新エラー:', error);
    throw error;
  }
};

/**
 * ユーザーグループ取得（getGroupsのエイリアス）
 */
export const getUserGroups = getGroups;



// utils/firestoreService.ts の getGroupPosts関数を以下に置き換え
// グループの投稿を取得する関数（メモ情報を含む）
export const getGroupPosts = async (groupId: string, limit?: number): Promise<any[]> => {
  try {
    console.log('🔍 [FirestoreService] グループ投稿取得開始:', groupId);
    
    // シンプルなクエリでFirestoreから取得
    let postsQuery = query(
  collection(db, 'posts'),
  where('groupId', '==', groupId)
);

// 🌟 ここから追加
if (limit) {
  postsQuery = query(postsQuery, limitFirestore(limit));
  console.log(`📊 取得件数を${limit}件に制限`);
}
// 🌟 ここまで追加

const querySnapshot = await getDocs(postsQuery);
    const posts: any[] = [];
    
    // ⭐ メモコレクションを一度だけ取得（パフォーマンス最適化）
   // 🌟 HomePageの高速化：初回はメモ不要なのでコメントアウト
/*
// ⭐ メモコレクションを一度だけ取得（パフォーマンス最適化）
console.log('📝 [FirestoreService] メモ情報取得開始');
const memosRef = collection(db, 'memos');
const memosSnapshot = await getDocs(memosRef);

// メモをpostIdでグループ化
// ⭐ 現在のユーザーIDを取得
const currentUserId = localStorage.getItem("daily-report-user-id");
console.log('👤 [FirestoreService] 現在のユーザーID:', currentUserId);

// メモをpostIdでグループ化（⭐ 現在のユーザーのメモのみ）
const memosByPostId: { [key: string]: any[] } = {};
memosSnapshot.forEach(doc => {
  const memoData = doc.data();
  const postId = memoData.postId;
  
  // ⭐ 重要：現在のユーザーのメモのみ処理
  if (postId && memoData.createdBy === currentUserId) {
    if (!memosByPostId[postId]) {
      memosByPostId[postId] = [];
    }
    memosByPostId[postId].push({
      id: doc.id,
      ...memoData
    });
    
    console.log('✅ [FirestoreService] ユーザーのメモを追加:', {
      メモID: doc.id,
      投稿ID: postId,
      作成者: memoData.createdByName
    });
  } else if (postId && memoData.createdBy !== currentUserId) {
    console.log('⏭️ [FirestoreService] 他ユーザーのメモをスキップ:', {
      メモID: doc.id,
      作成者: memoData.createdByName,
      作成者ID: memoData.createdBy
    });
  }
});

console.log('📝 [FirestoreService] メモ情報取得完了:', Object.keys(memosByPostId).length, '投稿分');
*/
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();

      // 🔍 デバッグコード
      console.log('🔍 [Firestore生データ確認]', {
        投稿ID: doc.id,
        生データ: data,
        フィールド一覧: Object.keys(data),
        userIdフィールド: data.userId,
        authorIdフィールド: data.authorId,
        readByフィールド: data.readBy
      });
      
      // Timestamp型の安全な変換
      let createdAtTimestamp;
      if (data.createdAt?.seconds) {
        createdAtTimestamp = data.createdAt.seconds * 1000;
      } else if (typeof data.createdAt === 'number') {
        createdAtTimestamp = data.createdAt;
      } else {
        createdAtTimestamp = Date.now();
      }
      
      const createdDate = new Date(createdAtTimestamp);
      
      // 日本語形式の時間文字列を生成
      const timeString = createdDate.toLocaleString('ja-JP', {
        year: 'numeric',
        month: 'numeric', 
        day: 'numeric',
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit'
      }).replace(/(\d{4})\/(\d{1,2})\/(\d{1,2})\((.)\)\s(\d{1,2}):(\d{2})/, '$1 / $2 / $3（$4）　$5:$6');
      
      // 表示名の統一
      let displayName = 'ユーザー';
      if (data.userName && data.userName !== 'undefined') {
        displayName = data.userName;
      } else if (data.username && data.username !== 'undefined') {
        displayName = data.username;
      }
      
      // ⭐ この投稿のメモを取得
      const postMemos: any[] = [];  // メモは空配列

      // 🔍 デバッグ：生データを確認
console.log('🔍 [getGroupPosts] 投稿ID:', doc.id);
console.log('  - photoUrls:', data.photoUrls);
console.log('  - photoUrls枚数:', data.photoUrls?.length || 0);
console.log('  - images:', data.images);
console.log('  - images枚数:', data.images?.length || 0);

      
      // Post型に変換（メモ情報を含む）
      const post = {
        id: doc.id,
        message: data.message || '',
        photoUrls: (data.photoUrls && data.photoUrls.length > 0)
        ? data.photoUrls
        : (data.images || []),
        tags: data.tags || [],
        userId: data.userId || data.createdBy || data.authorId || '',
        authorId: data.authorId || data.userId || data.createdBy || '',
        readBy: data.readBy || {},
        username: displayName,
        groupId: data.groupId || groupId,
        status: data.status || '未確認',
        isWorkTimePost: data.isWorkTimePost || false,
        isEdited: data.isEdited || false,
        time: timeString,
        timestamp: createdAtTimestamp,
        memos: postMemos // ⭐ メモ情報を追加
      };
      
      posts.push(post);
    });
    
    // JavaScript側でソート
    posts.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    
    console.log('✅ [FirestoreService] 投稿取得完了:', posts.length, '件（メモ情報含む）');
    return posts;
    
  } catch (error) {
    console.error('❌ [FirestoreService] 投稿取得エラー:', error);
    return [];
  }
};

/**
 * グループメンバーの最新情報を動的取得
 * データ重複を解決し、常に最新のプロフィール情報を取得
 */
export const getGroupMembersWithLatestProfile = async (groupId: string): Promise<any[]> => {
  try {
    console.log('📋 [新機能] グループメンバーの最新情報取得開始:', groupId);
    
    // Step 1: グループ情報を取得
    const groupRef = doc(db, 'groups', groupId);
    const groupDoc = await getDoc(groupRef);
    
    if (!groupDoc.exists()) {
      console.error('❌ グループが見つかりません:', groupId);
      return [];
    }
    
    const groupData = groupDoc.data();
    const members = groupData.members || [];
    
    console.log('👥 処理対象メンバー数:', members.length);
    
    // Step 2: 各メンバーの最新ユーザー情報を並行取得
    const memberPromises = members.map(async (memberData: any) => {
      try {
        // メンバーIDを抽出（文字列またはオブジェクト形式に対応）
        const memberId = typeof memberData === 'string' ? memberData : memberData.id;
        
        if (!memberId) {
          console.warn('⚠️ メンバーIDが見つかりません:', memberData);
          return null;
        }
        
        // Firestoreから最新のユーザー情報を取得
        const userRef = doc(db, 'users', memberId);
        const userDoc = await getDoc(userRef);
        
        if (!userDoc.exists()) {
          console.warn('⚠️ ユーザー情報が見つかりません:', memberId);
          // フォールバック：元のメンバーデータを使用
          return {
            id: memberId,
            username: typeof memberData === 'object' ? memberData.username || 'ユーザー' : 'ユーザー',
            email: typeof memberData === 'object' ? memberData.email || '' : '',
            role: typeof memberData === 'object' ? memberData.role || 'user' : 'user',
            isAdmin: typeof memberData === 'object' ? memberData.isAdmin || false : false,
            profileData: {
              fullName: typeof memberData === 'object' ? memberData.username || 'ユーザー' : 'ユーザー',
              company: '',
              position: '',
              phone: ''
            }
          };
        }
        
        const userData = userDoc.data();
        
        // Step 3: 最新データとグループ固有データを統合
        const memberInfo = {
          id: memberId,
          username: userData.displayName || userData.username || 'ユーザー',
          email: userData.email || '',
          role: (typeof memberData === 'object' ? memberData.role : null) || 'user',
          isAdmin: (typeof memberData === 'object' ? memberData.isAdmin : null) || 
                   userData.role === 'admin' || 
                   groupData.adminId === memberId || 
                   groupData.createdBy === memberId,
          active: (typeof memberData === 'object' ? memberData.active : null) !== false,
          joinedAt: (typeof memberData === 'object' ? memberData.joinedAt : null) || Date.now(),
          profileData: {
            fullName: userData.displayName || userData.profileData?.fullName || userData.username || 'ユーザー',
            company: userData.company || userData.profileData?.company || '',
            position: userData.position || userData.profileData?.position || '',
            phone: userData.phone || userData.profileData?.phone || ''
          }
        };
        
        console.log('✅ メンバー情報統合完了:', memberInfo.username);
        return memberInfo;
        
      } catch (error) {
        console.error('❌ メンバー情報取得エラー:', error);
        return null;
      }
    });
    
    // Step 4: 全メンバー情報を並行処理で取得
    const resolvedMembers = await Promise.all(memberPromises);
    
    // null値を除外してソート
    const validMembers = resolvedMembers
      .filter(member => member !== null)
      .sort((a, b) => {
        // 管理者を最上位に
        if (a.isAdmin && !b.isAdmin) return -1;
        if (!a.isAdmin && b.isAdmin) return 1;
        
        // 同じ権限の場合は名前順
        return a.username.localeCompare(b.username, 'ja');
      });
    
    console.log('🎯 最新メンバー情報取得完了:', validMembers.length, '人');
    validMembers.forEach((member, i) => {
      console.log(`  ${i + 1}. ${member.username} (${member.isAdmin ? '管理者' : 'メンバー'})`);
    });
    
    return validMembers;
    
  } catch (error) {
    console.error('❌ グループメンバー取得エラー:', error);
    return [];
  }
};


/**
 * 投稿を既読としてマーク
 */
export const markPostAsRead = async (postId: string, userId: string): Promise<void> => {
  try {
    console.log('📖 既読マーク開始:', postId, userId);
    
    const postRef = doc(db, 'posts', postId);
    const now = Date.now();
    
    // 重複チェック：既に既読済みかを確認
    const postSnap = await getDoc(postRef);
    if (postSnap.exists() && postSnap.data().readBy?.[userId]) {
      console.log('ℹ️ 既に既読済み:', postId, userId);
      return;
    }
    
    // 既読情報を追加
    await updateDoc(postRef, {
      [`readBy.${userId}`]: now,
      readCount: increment(1)
    });
    
    console.log('✅ 既読マーク完了:', postId);
  } catch (error) {
    console.error('❌ 既読マークエラー:', error);
    throw error;
  }
};

/**
 * 投稿の既読状況を分析
 */
export const getPostReadStatus = (post: Post, userId: string) => {
  const isAuthor = post.authorId === userId || post.createdBy === userId || post.userId === userId;
  
  // readByオブジェクトから実際の既読者数を計算
  const readBy = post.readBy || {};
  const readCount = Object.keys(readBy).length;
  const isRead = readBy[userId] ? true : false;
  
  return {
    isAuthor,      // この投稿の作成者か
    readCount,     // 既読者数（リアルタイム計算）
    isRead         // 現在のユーザーが既読済みか
  };
};


// 投稿ステータス更新関数
export const updatePostStatus = async (groupId: string, postId: string, status: string, userId: string, userName: string): Promise<void> => {
  try {
    // まず投稿の場所を確認
    console.log('更新対象:', { groupId, postId, status });
    
    // 複数の可能性のあるパスを試行
    const possiblePaths = [
      doc(db, 'groups', groupId, 'posts', postId),
      doc(db, 'posts', postId),
      doc(db, 'dailyReports', postId)
    ];
    
    for (const postRef of possiblePaths) {
      try {
        const docSnap = await getDoc(postRef);
        if (docSnap.exists()) {
          await updateDoc(postRef, {
            status: status,
            statusUpdatedAt: Date.now(),
            statusUpdatedBy: userId,
            statusUpdatedByName: userName
          });
          console.log('ステータス更新完了:', { postId, status, path: postRef.path });
          return;
        }
      } catch (error) {
        console.log('パス試行失敗:', postRef.path);
      }
    }
    
    throw new Error('投稿が見つかりません');
  } catch (error) {
    console.error('Firestoreステータス更新エラー:', error);
    throw error;
  }
};


/**
 * メンバーの管理者権限を更新
 */
export const updateMemberRole = async (
  groupId: string,
  memberId: string,
  isAdmin: boolean
): Promise<void> => {
  try {
    console.log('🔄 メンバー権限更新開始:', { groupId, memberId, isAdmin });
    
    const groupRef = doc(db, 'groups', groupId);
    const groupDoc = await getDoc(groupRef);
    
    if (!groupDoc.exists()) {
      throw new Error('グループが見つかりません');
    }
    
    const groupData = groupDoc.data();
    const members = groupData.members || [];
    
    // メンバーリストを更新
    const updatedMembers = members.map((member: any) => {
      const currentMemberId = typeof member === 'string' ? member : member.id;
      
      if (currentMemberId === memberId) {
        // オブジェクト形式に変換して権限を更新
        return {
          ...(typeof member === 'object' ? member : { id: member }),
          id: memberId,
          isAdmin: isAdmin,
          role: isAdmin ? 'admin' : 'user',
          updatedAt: Date.now()
        };
      }
      
      return member;
    });
    
    // Firestoreに保存
    await updateDoc(groupRef, {
      members: updatedMembers,
      updatedAt: Date.now()
    });
    
    console.log('✅ メンバー権限更新完了');
    
  } catch (error) {
    console.error('❌ メンバー権限更新エラー:', error);
    throw error;
  }
};

/**
 * グループからメンバーを削除
 */
export const removeMemberFromGroup = async (
  groupId: string,
  memberId: string
): Promise<void> => {
  try {
    console.log('🗑️ メンバー削除開始:', { groupId, memberId });
    
    const groupRef = doc(db, 'groups', groupId);
    const groupDoc = await getDoc(groupRef);
    
    if (!groupDoc.exists()) {
      throw new Error('グループが見つかりません');
    }
    
    const groupData = groupDoc.data();
    const members = groupData.members || [];
    
    // メンバーリストから削除
    const updatedMembers = members.filter((member: any) => {
      const currentMemberId = typeof member === 'string' ? member : member.id;
      return currentMemberId !== memberId;
    });
    
    // Firestoreに保存
    await updateDoc(groupRef, {
      members: updatedMembers,
      updatedAt: Date.now()
    });
    
    console.log('✅ メンバー削除完了');
    
  } catch (error) {
    console.error('❌ メンバー削除エラー:', error);
    throw error;
  }
};