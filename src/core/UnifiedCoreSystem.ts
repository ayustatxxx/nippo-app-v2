// src/core/UnifiedCoreSystem.ts
// 統一アーキテクチャ核心システム - 高品質コンポーネント統合

import { Post, Group, User } from '../types';
import { getCurrentUser } from '../utils/authUtil';
import { createPost } from '../firebase/firestore';
import { DBUtil, STORES } from '../utils/dbUtil';
import { FileValidator } from '../utils/fileValidation';

// 既存高品質コンポーネントのインポート
import { UserGroupResolver } from '../utils/userGroupResolver';
import { getGroupPosts } from '../utils/firestoreService';

// ⭐ Firestore のページネーション機能をインポート ⭐
import { 
  getFirestore, 
  collection, 
  query, 
  where, 
  orderBy, 
  limit as limitQuery,  // ⭐ 「as limitQuery」を追加！
  getDocs,
  startAfter,  // ← 「続きから」取得する機能
  doc,         // ← ドキュメントを指定する機能
  getDoc       // ← ドキュメントを取得する機能
} from 'firebase/firestore';

/**
 * 統一コアシステム
 * 既存の最高品質コンポーネントを統合し、統一APIを提供
 */
export class UnifiedCoreSystem {
  private static instance: UnifiedCoreSystem | null = null;

  // Tier 1: 基盤システム（100%再利用）
  static groupResolver = UserGroupResolver;

  static fileValidator = FileValidator;
// PermissionManagerは別途import予定

  /**
   * シングルトンインスタンス取得
   */
  static getInstance(): UnifiedCoreSystem {
    if (!this.instance) {
      this.instance = new UnifiedCoreSystem();
    }
    return this.instance;
  }

  /**
   * 統一投稿保存システム
   * PostPage.tsxの完璧なデータフロー統合パターンを標準化
   */
  static async savePost(postData: {
    message: string;
    files?: File[];
    tags?: string[];
    groupId: string;
  }): Promise<string> {
    try {
      console.log('🚀 UnifiedCoreSystem: 統一投稿保存開始');

      // Step 1: ユーザー認証確認
      const user = await getCurrentUser();
      if (!user) {
        throw new Error('ユーザー認証が必要です');
      }

      // Step 2: ファイル検証・処理（FileValidator統合完了）
let processedImages: string[] = [];
if (postData.files && postData.files.length > 0) {
  console.log('📁 ファイル検証・処理を開始');
  
  // ファイル検証
  const validationResult = await this.fileValidator.validateFiles(postData.files);
  if (validationResult.errors.length > 0) {
    throw new Error(`ファイル検証エラー: ${validationResult.errors.join(', ')}`);
  }
  
  // ファイル処理（圧縮・Base64変換）
  processedImages = await this.fileValidator.processFilesInBatches(validationResult.validFiles);
  console.log('✅ ファイル処理完了:', processedImages.length, '枚');
}

      // Step 3: 投稿データ準備
      const sanitizedMessage = this.sanitizeInput(postData.message || '');
      const processedTags = this.processTags(postData.tags || []);
      const timestamp = Date.now();

      // Step 4: Firestore保存（PostPageパターン）
      const firestorePost = {
        userId: user.id,
        userName: user.displayName || user.username || 'ユーザー',
        groupId: postData.groupId,
        message: sanitizedMessage,
        images: processedImages,
        tags: processedTags,
        status: '未確認' as const,
        isWorkTimePost: false,
        isEdited: false,
        createdAt: timestamp
      };

      const postId = await createPost(firestorePost);
      console.log('✅ Firestore保存完了:', postId);

      // Step 5: IndexedDB同期（PostPageパターン）
      const legacyPost: Post = {
  id: postId,
  message: sanitizedMessage,
  time: this.formatTime(new Date()),
  photoUrls: processedImages,
  tags: processedTags,
  userId: user.id,
  username: user.displayName || user.username || 'ユーザー',
  groupId: postData.groupId,
  timestamp: timestamp,
  createdAt: timestamp,
  status: '未確認' as const
};

      const dbUtil = DBUtil.getInstance();
      await dbUtil.save(STORES.POSTS, legacyPost);
      console.log('✅ IndexedDB同期完了');

      // Step 6: 全システム更新通知（PostPageパターン）
      await this.notifyAllSystems(postId, legacyPost);

      return postId;

    } catch (error) {
      console.error('❌ UnifiedCoreSystem: 投稿保存エラー', error);
      throw error;
    }
  }

  /**
   * 統一投稿取得システム
   * UserGroupResolverの動的検索を活用
   */
 static async getPost(postId: string, userId: string): Promise<Post | null> {
  console.log('🔍 UnifiedCoreSystem: 統一投稿取得開始', postId);
  
  try {
    // ✅ 改善：投稿IDで直接Firestoreから1件だけ取得（37秒 → 数秒に短縮）
    const db = getFirestore();
    const postRef = doc(db, 'posts', postId);
    const postSnap = await getDoc(postRef);
    
    if (!postSnap.exists()) {
      console.warn('⚠️ 投稿が見つかりません:', postId);
      return null;
    }
    
    const post = { id: postSnap.id, ...postSnap.data() } as Post;

// 🔍 デバッグ：Firestoreから取得した生データを確認
console.log('🔍 [getPost] Firestoreから取得した生データ:', postSnap.data());
console.log('🔍 [getPost] 変換後のpostオブジェクト:', post);
    
    console.log('✅ 投稿発見完了:', postId);
    console.log('🔍 [getPost] 取得した画像枚数:', post.photoUrls?.length || 0);
    console.log('📝 [getPost編集情報-取得直後]');
    console.log('  - post.isEdited:', post.isEdited);
    console.log('  - post.isManuallyEdited:', post.isManuallyEdited);
    console.log('  - post.editedAt:', post.editedAt);
    
    // IndexedDBに保存
    const dbUtil = DBUtil.getInstance();
    await dbUtil.initDB();
    await dbUtil.save(STORES.POSTS, post);
    console.log('✅ [getPost] IndexedDB同期完了');
    console.log('📝 [getPost編集情報-return直前]');
    console.log('  - post.isEdited:', post.isEdited);
    console.log('  - post.isManuallyEdited:', post.isManuallyEdited);
    console.log('  - post.editedAt:', post.editedAt);
    
    return post;
  } catch (error) {
    console.error('❌ 投稿取得エラー:', error);
    return null;
  }
}

  /**
   * 統一グループ取得システム
   * UserGroupResolverのキャッシュシステム活用
   */
  static async getUserGroups(userId: string): Promise<Group[]> {
    try {
      console.log('👥 UnifiedCoreSystem: ユーザーグループ取得開始');

      const groups = await this.groupResolver.getUserParticipatingGroups(userId);
      
      console.log('✅ グループ取得完了:', groups.length, '件');
      return groups;

    } catch (error) {
      console.error('❌ UnifiedCoreSystem: グループ取得エラー', error);
      return [];
    }
  }


  /**
   * グループの投稿を取得（権限チェック付き）
   * @param groupId グループID
   * @param userId ユーザーID
   * @returns 投稿の配列
   */
  static async getGroupPosts(groupId: string, userId: string, limit?: number): Promise<Post[]> {
  console.log('🔍 UnifiedCoreSystem: グループ投稿取得開始', { groupId, userId, limit });
    
    try {
      // Step 1: 権限確認 - このユーザーはこのグループにアクセスできるか？
      const userGroups = await this.getUserGroups(userId);
      const hasAccess = userGroups.some(g => g.id === groupId);
      
      if (!hasAccess) {
        console.warn('⚠️ アクセス権限なし:', { groupId, userId });
        return [];
      }
      
      console.log('✅ 権限確認OK');
      
      // Step 2: firestoreServiceから投稿を取得
      const { getGroupPosts } = await import('../utils/firestoreService');
      const posts = await getGroupPosts(groupId, limit);
      
      console.log(`✅ グループ投稿取得完了: ${posts.length}件`);
      return posts;
      
    } catch (error) {
      console.error('❌ グループ投稿取得エラー:', error);
      return []; // エラーの場合は空配列を返す（安全）
    }
     }
    /**
   * グループの投稿を段階的に取得（ページネーション対応）
   * Phase A4: Firestore段階的取得の実装
   * ArchivePage専用の最適化された実装
   * 
   * @param groupId - グループID
   * @param userId - ユーザーID
   * @param limit - 取得件数（デフォルト10件）
   * @param startAfterDoc - 前回取得の最終ドキュメント（次のページ取得時に使用）
   * @returns 投稿配列、最終ドキュメント、追加データの有無
   */
  static async getGroupPostsPaginated(
    groupId: string,
    userId: string,
    limit: number = 10,
    startAfterDoc?: any
  ): Promise<{ posts: Post[]; lastDoc: any; hasMore: boolean }> {
    
    try {

      // ⏱️ パフォーマンス計測開始
  const startTime = performance.now();
  console.log('⏱️ [性能計測] 取得開始:', {
    groupId,
    limit,
    hasCursor: !!startAfterDoc
  });
      
      console.log(`📥 [UnifiedCore-Paginated] 段階的取得開始: groupId=${groupId}, limit=${limit}, startAfter=${startAfterDoc?.id || 'なし'}`);
      
      // Step 1: ユーザーのグループ参加権限を確認
      const userGroups = await this.getUserGroups(userId);
      const hasAccess = userGroups.some(g => g.id === groupId);
      
      if (!hasAccess) {
        console.warn(`⚠️ [UnifiedCore-Paginated] ユーザー ${userId} はグループ ${groupId} へのアクセス権限がありません`);
        return { posts: [], lastDoc: null, hasMore: false };
      }

      console.log('✅ [UnifiedCore-Paginated] 権限確認OK');

      // Step 2: Firestoreクエリ作成
      const db = getFirestore();
      const postsRef = collection(db, 'posts');  // ← トップレベルコレクション
      let q;

      // 前回の最終ドキュメントがあれば、その後から取得
      if (startAfterDoc) {
        q = query(
          postsRef,
          where('groupId', '==', groupId),  // ← この行を追加！
          orderBy('createdAt', 'desc'),     // ← timestamp → createdAt に変更
          startAfter(startAfterDoc),
          limitQuery(limit)
        );
        console.log('📄 [UnifiedCore-Paginated] 続きから取得モード');
      } else {
        // 初回取得
        q = query(
          postsRef,
          where('groupId', '==', groupId),  // ← この行を追加！
          orderBy('createdAt', 'desc'),     // ← timestamp → createdAt に変更
          limitQuery(limit)
        );
        console.log('📄 [UnifiedCore-Paginated] 初回取得モード');
      }

      // Step 3: データ取得
      const querySnapshot = await getDocs(q);
      
      // 最終ドキュメントを保存（次回のページネーション用）
      const lastDoc = querySnapshot.docs[querySnapshot.docs.length - 1] || null;
      
      // まだデータがあるかチェック
      const hasMore = querySnapshot.docs.length === limit;

 
// Step 4: データ整形（画像サブコレクション取得を含む）
const posts = await Promise.all(
  querySnapshot.docs.map(async (doc) => {
    const data = doc.data() as any;
    
// 🖼️ 画像取得の優先順位: photoUrls（新形式）→ サブコレクション（旧形式）
let imageUrls: string[] = [];

// ✅ 新形式: photoUrls フィールドがあればそれを使用
if (data.photoUrls && Array.isArray(data.photoUrls) && data.photoUrls.length > 0) {
  imageUrls = data.photoUrls;
  console.log(`✅ [新形式] 投稿ID: ${doc.id} - photoUrls から ${imageUrls.length}枚取得`);
  
// ✅ 中間形式: images フィールドをチェック（旧データ対応）
} else if (data.images && Array.isArray(data.images) && data.images.length > 0) {
  imageUrls = data.images;
  console.log(`✅ [中間形式] 投稿ID: ${doc.id} - images から ${imageUrls.length}枚取得`);
  
} else {
  // 📦 旧形式: サブコレクションから取得（後方互換性）
  try {
    // 図面・書類画像を取得
    const documentImagesRef = collection(db, 'posts', doc.id, 'documentImages');
    const documentSnapshot = await getDocs(query(documentImagesRef, orderBy('order')));
    const documentImages = documentSnapshot.docs.map(imgDoc => imgDoc.data().image as string);
    
    // 現場写真を取得
    const photoImagesRef = collection(db, 'posts', doc.id, 'photoImages');
    const photoSnapshot = await getDocs(query(photoImagesRef, orderBy('order')));
    const photoImages = photoSnapshot.docs.map(imgDoc => imgDoc.data().image as string);
    
    // 2つの配列を結合
    imageUrls = [...documentImages, ...photoImages];
    
    if (imageUrls.length > 0) {
      console.log(`📦 [旧形式] 投稿ID: ${doc.id} - サブコレクションから ${imageUrls.length}枚取得`);
    }
  } catch (error) {
    console.warn('⚠️ [画像取得エラー]', doc.id, error);
  }
}
    
    // timeフィールドを生成（存在しない場合）
    let timeString = data.time;
if (!timeString && (data.updatedAt || data.createdAt)) {
  try {
    // ✅ updatedAtを優先的に使用
    const timestamp = data.createdAt || data.updatedAt;
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
    const weekday = weekdays[date.getDay()];
    const dateStr = `${date.getFullYear()} / ${date.getMonth() + 1} / ${date.getDate()}（${weekday}）`;
    const timeStr = date.toLocaleTimeString('ja-JP', { hour: "2-digit", minute: "2-digit" });
    timeString = `${dateStr}　${timeStr}`;
      } catch (error) {
        console.error('❌ [UnifiedCore] time生成エラー:', error);
        timeString = '日付不明　00:00';
      }
    }
    
    return {
      id: doc.id,
      ...(data as any),
      time: timeString || '日付不明　00:00',
      timestamp: data.timestamp || data.createdAt || Date.now(),
      username: data.username || data.userName || data.authorName || 'ユーザー',
      photoUrls: imageUrls,  // ✅ サブコレクションから取得した画像
      images: imageUrls,      // ✅ 同じデータを両方のフィールドに
      userId: data.userId || data.authorId || data.createdBy || '',
      authorId: data.authorId || data.userId || data.createdBy || ''
    } as Post;
  })
);

console.log(`✅ [UnifiedCore-Paginated] 取得完了: ${posts.length}件, hasMore: ${hasMore}`);

// ⏱️ パフォーマンス計測終了
const endTime = performance.now();
const duration = endTime - startTime;
console.log('⏱️ [性能計測] Firestore取得完了:', {
  投稿数: posts.length,
  画像取得時間含む: `${duration.toFixed(0)}ms`,
  平均_1件あたり: `${(duration / posts.length).toFixed(0)}ms`
});

return { posts, lastDoc, hasMore };

} catch (error) {
  console.error('❌ [UnifiedCore-Paginated] 段階的投稿取得エラー:', error);
  throw error;
}

}


  /**
   * 複数グループから最新の投稿を効率的に取得
   * @param groupIds グループIDの配列
   * @param limit 取得件数（デフォルト20件）
   * @returns 最新順にソートされた投稿
   */
  static async getLatestPostsFromMultipleGroups(
    groupIds: string[],
    limit: number = 20
  ): Promise<Post[]> {
    console.log(`🔍 [UnifiedCore] ${groupIds.length}グループから最新${limit}件を取得開始`);
    
    if (groupIds.length === 0) {
      console.log('⚠️ [UnifiedCore] グループIDが空です');
      return [];
    }

    try {
      const allPosts: Post[] = [];
      
      // Firebaseの制限：where('groupId', 'in', ...) は最大10個まで
      // グループを10個ずつに分割して取得
      const batchSize = 10;
      const batches = Math.ceil(groupIds.length / batchSize);
      
      console.log(`📦 [UnifiedCore] ${batches}バッチに分割して取得`);
      
      for (let i = 0; i < batches; i++) {
        const start = i * batchSize;
        const end = Math.min(start + batchSize, groupIds.length);
        const batchGroupIds = groupIds.slice(start, end);
        
        console.log(`📦 [UnifiedCore] バッチ${i + 1}/${batches}: ${batchGroupIds.length}グループ`);
        
        // firestoreServiceから直接取得
        const { collection, query, where, orderBy, limit: limitQuery, getDocs, getFirestore } = await import('firebase/firestore');
        const db = getFirestore();
        
        const postsRef = collection(db, 'posts');
        const q = query(
          postsRef,
          where('groupId', 'in', batchGroupIds),
          orderBy('createdAt', 'desc'),
          limitQuery(limit)
        );
        
        const snapshot = await getDocs(q);
        const posts = await Promise.all(snapshot.docs.map(async (doc) => {
  const data = doc.data();
  const postId = doc.id;
  
  // 画像取得の優先順位: photoUrls（新形式） → サブコレクション（古い形式）
  let fullImages: string[] = [];
  
  // ✅ 新形式: photoUrls フィールドがあればそれを使用
if (data.photoUrls && Array.isArray(data.photoUrls) && data.photoUrls.length > 0) {
  fullImages = data.photoUrls;
  console.log(`✅ [新形式] 投稿ID: ${postId} - photoUrls から ${fullImages.length}枚取得`);
  
// ✅ 中間形式: images フィールドをチェック（旧データ対応）
} else if (data.images && Array.isArray(data.images) && data.images.length > 0) {
  fullImages = data.images;
  console.log(`✅ [中間形式] 投稿ID: ${postId} - images から ${fullImages.length}枚取得`);
  
} else {
  
    // 古い形式：サブコレクションから取得（移行前の投稿用）
    try {
      const { getPostImages } = await import('../firebase/firestore');
      const { documentImages, photoImages } = await getPostImages(postId);
      fullImages = [...documentImages, ...photoImages];
      if (fullImages.length > 0) {
       console.log(`📦 [旧形式] 投稿ID: ${postId} - サブコレクションから ${fullImages.length}枚取得`);
      }
    } catch (error) {
      console.warn(`⚠️ 投稿ID: ${postId} の画像取得エラー:`, error);
    }
  }
  
  return {
    id: postId,
    ...data,
    createdAt: data.createdAt,
    images: fullImages.length > 0 ? fullImages : (data.images || []),
  } as Post;
}));
        
        console.log(`✅ [UnifiedCore] バッチ${i + 1}: ${posts.length}件取得`);
        allPosts.push(...posts);
      }
      
      // 全バッチの投稿を最新順にソート
      allPosts.sort((a, b) => {
        // createdAtをany型として扱うことで型エラーを回避
        const aTime = (a.createdAt as any)?.toMillis?.() || (a.createdAt as any) || 0;
        const bTime = (b.createdAt as any)?.toMillis?.() || (b.createdAt as any) || 0;
        return (bTime as number) - (aTime as number);
      });
      
      // 必要な件数だけ返す
      const result = allPosts.slice(0, limit);
      
      console.log(`✅ [UnifiedCore] 最新${result.length}件を取得完了（全${allPosts.length}件から抽出）`);
      return result;
      
    } catch (error) {
      console.error('❌ [UnifiedCore] 投稿取得エラー:', error);
      throw error;
    }
  }


  // 📁 UnifiedCoreSystem.ts

  static async updatePost(
  postId: string,
  updates: {
  message?: string;
  files?: File[];
  tags?: string[];
  photoUrls?: string[];
  isManuallyEdited?: boolean;  // ← 新規追加
  updatedAt?: number;
}
): Promise<void> {
  try {
    console.log('🔄 [UnifiedCore] 投稿更新開始:', postId);
    
    // Step 1: ユーザー認証確認
    const user = await getCurrentUser();
    if (!user) {
      throw new Error('ユーザー認証が必要です');
    }

 // Step 2: 更新データ準備
const updateData: any = {
  updatedAt: updates.updatedAt || Date.now(),
  isEdited: true
};

// isManuallyEditedがtrueの場合、必ず保存
if (updates.isManuallyEdited === true) {
  updateData.isEdited = true;
  updateData.isManuallyEdited = true;
}

if (updates.message !== undefined) {
  updateData.message = this.sanitizeInput(updates.message);
}

if (updates.tags !== undefined) {
  updateData.tags = this.processTags(updates.tags);
}

// ✅ 新しい画像ファイルの処理を追加
let newProcessedImages: string[] = [];

if (updates.files && updates.files.length > 0) {
  console.log('📁 [UpdatePost] 新規画像ファイル処理開始:', updates.files.length, '枚');
  
  try {
    const validationResult = await this.fileValidator.validateFiles(updates.files);
    
    if (validationResult.errors.length > 0) {
      throw new Error(`ファイル検証エラー: ${validationResult.errors.join(', ')}`);
    }
    
    newProcessedImages = await this.fileValidator.processFilesInBatches(validationResult.validFiles);
    console.log('✅ [UpdatePost] 新規画像処理完了:', newProcessedImages.length, '枚');
    
    // セキュリティログ
    this.fileValidator.logSecurityEvent('files_uploaded', {
      fileCount: validationResult.validFiles.length,
      totalSize: validationResult.totalSize,
      context: 'post_update'
    });
  } catch (fileError) {
    console.error('❌ [UpdatePost] 画像処理エラー:', fileError);
    throw fileError;
  }
}

// photoUrlsの更新処理
if (updates.photoUrls !== undefined) {
  updateData.photoUrls = [...updates.photoUrls, ...newProcessedImages];
  console.log('✅ [UpdatePost] 画像URL更新完了:', updateData.photoUrls.length, '枚');
  console.log('  - 既存画像:', updates.photoUrls.length, '枚');
  console.log('  - 新規画像:', newProcessedImages.length, '枚');
  
  // 🔍 デバッグ：実際のURLを確認
  console.log('🔍 [UpdatePost] 実際に保存する画像URL:');
  updateData.photoUrls.forEach((url, index) => {
    console.log(`  ${index + 1}. ${url.substring(0, 50)}...`);
  });
} else if (newProcessedImages.length > 0) {
  updateData.photoUrls = newProcessedImages;
  console.log('✅ [UpdatePost] 新規画像のみ:', newProcessedImages.length, '枚');
}

// Step 3: Firestoreで更新
const { doc, updateDoc, getDoc, getFirestore } = await import('firebase/firestore');
const db = getFirestore();
const postRef = doc(db, 'posts', postId);

console.log('📡 [UpdatePost] Firestore更新データ:', {
  photoUrlsLength: updateData.photoUrls?.length,
  message: updateData.message?.substring(0, 50),
  tags: updateData.tags,
  isEdited: updateData.isEdited,
  isManuallyEdited: updateData.isManuallyEdited,  // ← この行を追加!
  updatedAt: updateData.updatedAt
});

await updateDoc(postRef, updateData);
console.log('✅ Firestore更新完了');

// 🔍 デバッグ: 更新直後のFirestoreデータを確認
const verifyDoc = await getDoc(postRef);
if (verifyDoc.exists()) {
  const verifyData = verifyDoc.data();
  console.log('🔍 [Firestore検証] 更新直後のデータ:');
  console.log('  - photoUrls枚数:', verifyData.photoUrls?.length || 0);
  if (verifyData.photoUrls) {
    verifyData.photoUrls.forEach((url: string, index: number) => {
      console.log(`    ${index + 1}. ${url.substring(0, 50)}...`);
    });
  }
} else {
  console.error('❌ [Firestore検証] ドキュメントが見つかりません');
}

// Step 4: IndexedDB同期
const dbUtil = DBUtil.getInstance();
await dbUtil.initDB();
const existingPost = await dbUtil.get(STORES.POSTS, postId);
if (existingPost) {
  const currentPost = existingPost as Post;
  const updatedPost: Post = {
    ...currentPost,
    ...updateData,
    photoUrls: updateData.photoUrls || currentPost.photoUrls,
    id: postId,
    updatedAt: updateData.updatedAt,
    isEdited: true
  };
  
  console.log('🔍 [IndexedDB] 保存する画像枚数:', updatedPost.photoUrls.length);
  
  await dbUtil.save(STORES.POSTS, updatedPost);
  console.log('✅ IndexedDB同期完了');
  
  // Step 5: 全システム更新通知(直接実装)
  const updateFlag = Date.now().toString();
  localStorage.setItem('daily-report-posts-updated', updateFlag);
  localStorage.setItem('last-updated-group-id', updatedPost.groupId);
  const updateEvent = new CustomEvent('postsUpdated', {
    detail: {
      updatedPost: updatedPost,
      timestamp: Date.now(),
      source: 'UnifiedCoreSystem',
      action: 'update'
    }
  });

  window.dispatchEvent(updateEvent);
  window.dispatchEvent(new CustomEvent('refreshPosts'));

  // 段階的通知
  [100, 300, 500, 1000].forEach((delay) => {
    setTimeout(() => {
      localStorage.setItem('daily-report-posts-updated', Date.now().toString());
      window.dispatchEvent(new CustomEvent('postsUpdated', {
        detail: { updatedPost, timestamp: Date.now(), delay }
      }));

      if (window.refreshArchivePage) window.refreshArchivePage();
      if (window.refreshHomePage) window.refreshHomePage();
    }, delay);
  });

  console.log('✅ 投稿更新通知完了');
} else {
  console.warn('⚠️ IndexedDBに投稿が見つかりません:', postId);
}

} catch (error) {
  console.error('❌ UnifiedCoreSystem: 投稿更新エラー', error);
  throw error;
}
}

/**
   * 投稿を削除
   * チェックアウト時に古い投稿を削除するために使用
   */
  static async deletePost(postId: string, userId: string): Promise<void> {
  try {
    console.log('🗑️ UnifiedCoreSystem: 投稿削除開始:', postId);

    // Step 1: Firestoreから直接削除（getPostを使わない）
    const { doc, deleteDoc, getFirestore } = await import('firebase/firestore');
    const db = getFirestore();
    const postRef = doc(db, 'posts', postId);
    
    // 権限確認なしで削除（チェックアウト時は自分の投稿なので安全）
    await deleteDoc(postRef);

    console.log('✅ Firestoreから削除完了');

    // Step 2: IndexedDBからも削除
    const dbUtil = DBUtil.getInstance();
    await dbUtil.initDB();
    await dbUtil.delete(STORES.POSTS, postId);

    console.log('✅ IndexedDBから削除完了');
    console.log('✅ 投稿削除完了:', postId);
  } catch (error) {
    console.error('❌ UnifiedCoreSystem: 投稿削除エラー', error);
    throw error;
  }
}

  /**
   * システム健康状態確認
   * UserGroupResolverのヘルスチェック機能活用
   */
  static getSystemHealth(): {
    isHealthy: boolean;
    groupResolverStatus: any;
    timestamp: string;
  } {
    const healthStatus = this.groupResolver.getHealthStatus();
    
    return {
      isHealthy: healthStatus.isHealthy,
      groupResolverStatus: healthStatus,
      timestamp: new Date().toLocaleString('ja-JP')
    };
  }

  /**
   * 全システム更新通知
   * PostPageの多層通知システムを標準化
   */
  private static async notifyAllSystems(postId: string, postData: Post): Promise<void> {
    try {
      console.log('📢 UnifiedCoreSystem: 全システム更新通知開始');

      // Step 1: localStorage更新フラグ設定
      const updateFlag = Date.now().toString();
      localStorage.setItem('daily-report-posts-updated', updateFlag);
      localStorage.setItem('last-updated-group-id', postData.groupId);
      localStorage.setItem('posts-need-refresh', updateFlag);
      localStorage.setItem('archive-posts-updated', updateFlag);

      // Step 2: カスタムイベント発火
      const updateEvent = new CustomEvent('postsUpdated', {
        detail: {
          newPost: postData,
          timestamp: Date.now(),
          source: 'UnifiedCoreSystem',
          action: 'create'
        }
      });

      window.dispatchEvent(updateEvent);
      window.dispatchEvent(new CustomEvent('refreshPosts'));
      window.dispatchEvent(new CustomEvent('storage', {
        detail: { key: 'daily-report-posts-updated', newValue: updateFlag }
      }));

      // Step 3: 段階的追加通知（PostPageパターン）
      const notificationSchedule = [100, 300, 500, 1000];
      notificationSchedule.forEach((delay, index) => {
        setTimeout(() => {
          const delayedFlag = Date.now().toString();
          localStorage.setItem('daily-report-posts-updated', delayedFlag);
          
          window.dispatchEvent(new CustomEvent('postsUpdated', {
            detail: {
              newPost: postData,
              timestamp: Date.now(),
              source: 'UnifiedCoreSystem-delayed',
              delay: delay
            }
          }));

          // グローバル関数呼び出し
          if (window.refreshArchivePage) {
            window.refreshArchivePage();
          }
          if (window.refreshHomePage) {
            window.refreshHomePage();
          }
        }, delay);
      });

      console.log('✅ 全システム更新通知完了');

    } catch (error) {
      console.error('❌ 更新通知エラー:', error);
    }
  }

  /**
   * 入力値サニタイゼーション
   * 全コンポーネント統一セキュリティ処理
   */
  private static sanitizeInput(input: string): string {
    return input
      .replace(/[<>]/g, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+=/gi, '')
      .trim()
      .substring(0, 5000); // 最大5000文字制限
  }

  /**
   * タグ処理統一
   * 全コンポーネント統一タグ形式
   */
  private static processTags(tags: string[]): string[] {
    return tags
      .map(tag => tag.trim())
      .filter(tag => tag !== '')
      .filter(tag => tag.length <= 50)
      .slice(0, 10)
      .map(tag => tag.startsWith('#') ? tag : `#${tag}`);
  }

  /**
   * 時刻フォーマット統一
   * 全コンポーネント統一時刻表示
   */
  private static formatTime(date: Date): string {
    const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
    const weekday = weekdays[date.getDay()];
    const dateStr = `${date.getFullYear()} / ${date.getMonth() + 1} / ${date.getDate()}（${weekday}）`;
    const timeStr = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return `${dateStr}　${timeStr}`;
  }

  /**
   * キャッシュクリア
   * 開発・デバッグ用
   */
  static clearAllCaches(): void {
    this.groupResolver.clearCache();
    localStorage.removeItem('daily-report-posts-updated');
    localStorage.removeItem('last-updated-group-id');
    localStorage.removeItem('posts-need-refresh');
    localStorage.removeItem('archive-posts-updated');
    console.log('🗑️ UnifiedCoreSystem: 全キャッシュクリア完了');
  }

  /**
   * システム統計情報
   * 運用監視用
   */
  static getSystemStats(): {
    groupResolverStats: any;
    systemUptime: string;
    lastActivity: string;
  } {
    return {
      groupResolverStats: this.groupResolver.getStatistics(),
      systemUptime: 'データ収集中',
      lastActivity: new Date().toLocaleString('ja-JP')
    };
  }
  /**
 * ⭐ ページネーション対応版：複数グループから投稿を取得 ⭐
 * 「続きから」データを取得する新機能
 */
static async getLatestPostsFromMultipleGroupsPaginated(
  groupIds: string[],
  limit: number = 20,
  lastVisible: any = null  // ← 前回の最後の位置を覚えておく
): Promise<{
  posts: Post[];
  lastVisible: any;
  hasMore: boolean;
}> {
  console.log(`🔍 [Paginated] ${groupIds.length}グループから最新${limit}件を取得開始`);
  
  if (groupIds.length === 0) {
    return { posts: [], lastVisible: null, hasMore: false };
  }

  try {
    const db = getFirestore();
    const allPosts: Post[] = [];
    
    // グループIDを10個ずつに分割（Firebaseの制限）
    const batchSize = 10;
    const batches: string[][] = [];
    
    for (let i = 0; i < groupIds.length; i += batchSize) {
      batches.push(groupIds.slice(i, i + batchSize));
    }
    
    console.log(`📦 [Paginated] ${batches.length}バッチに分割`);
    
    // 各バッチからデータを取得
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      
      const postsRef = collection(db, 'posts');
      
      // ⭐ クエリを構築 ⭐
      let q = query(
  postsRef,
  where('groupId', 'in', batch),
  orderBy('createdAt', 'desc'),  // ⭐ createdAt に変更
  limitQuery(limit * 2)
);
      
      // ⭐ 前回の続きから取得（重要！）⭐
      if (lastVisible) {
  q = query(
    postsRef,
    where('groupId', 'in', batch),
    orderBy('createdAt', 'desc'),  // ⭐ createdAt に変更
    startAfter(lastVisible),
    limitQuery(limit * 2)
  );
}
      
      const querySnapshot = await getDocs(q);
      
      // 取得したデータを配列に追加
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        allPosts.push({
          id: doc.id,
          groupId: data.groupId || '',
          userId: data.userId || data.authorId || '',
          message: data.message || '',
          timestamp: data.timestamp || Date.now(),
          time: data.time || '',
          status: data.status || '未確認',
          tags: data.tags || [],
          photoUrls: data.photoUrls || data.images || [],
          images: data.photoUrls || data.images || [],
          username: data.username || 'ユーザー',
          authorId: data.authorId || data.userId || '',
          createdBy: data.createdBy || data.userId || '',
          createdAt: data.createdAt || data.timestamp || Date.now(),
          isEdited: data.isEdited || false,
          readBy: data.readBy || [],
          memos: []
        } as Post);
      });
      
      console.log(`✅ [Paginated] バッチ${i + 1}: ${querySnapshot.size}件取得`);
    }
    
    // 時系列でソート
    allPosts.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    
    // 指定件数だけ抽出
    const limitedPosts = allPosts.slice(0, limit);
    
    // ⭐ 最後の位置を保存（次回のために）⭐
    const newLastVisible = limitedPosts.length > 0 
      ? await this.getDocumentSnapshot(limitedPosts[limitedPosts.length - 1].id)
      : null;
    
    // まだデータがあるかチェック
    const hasMore = allPosts.length > limit;
    
    console.log(`✅ [Paginated] ${limitedPosts.length}件取得完了`);
    console.log(`📊 [Paginated] 続きあり: ${hasMore}`);
    
    return {
      posts: limitedPosts,
      lastVisible: newLastVisible,
      hasMore: hasMore
    };
    
  } catch (error) {
    console.error('❌ [Paginated] エラー:', error);
    return { posts: [], lastVisible: null, hasMore: false };
  }
}

/**
 * ⭐ ヘルパーメソッド：データの位置を記録 ⭐
 */
private static async getDocumentSnapshot(postId: string): Promise<any> {
  try {
    const db = getFirestore();
    const docRef = doc(db, 'posts', postId);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? docSnap : null;
  } catch (error) {
    console.error('❌ スナップショット取得エラー:', error);
    return null;
  }
}
}

// グローバル関数型定義（PostPage.tsxで使用されている関数）
declare global {
  interface Window {
    refreshArchivePage?: () => void;
    refreshHomePage?: () => void;
  }
}

export default UnifiedCoreSystem;