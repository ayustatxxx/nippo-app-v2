import admin from 'firebase-admin';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(
  readFileSync('./firebase-admin-key.json', 'utf8')
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function migratePhotoData() {
  console.log('🚀 画像データ移行開始（修正版：エラースキップ対応）...');
  
  const postsSnapshot = await db.collection('posts').get();
  console.log(`📊 全投稿数: ${postsSnapshot.size}件`);
  
  let migratedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  const errorPosts: string[] = [];
  
  for (const postDoc of postsSnapshot.docs) {
    try {
      const postData = postDoc.data();
      
      if (postData.photoUrls && Array.isArray(postData.photoUrls) && postData.photoUrls.length > 0) {
        console.log(`⏭️  ${postDoc.id}: 既に移行済み（${postData.photoUrls.length}枚）`);
        skippedCount++;
        continue;
      }
      
      const photoImagesSnapshot = await db
        .collection('posts')
        .doc(postDoc.id)
        .collection('photoImages')
        .orderBy('order')
        .get();
      
      if (photoImagesSnapshot.empty) {
        console.log(`⚠️  ${postDoc.id}: 画像なし`);
        await postDoc.ref.update({ photoUrls: [] });
        migratedCount++;
        continue;
      }
      
      const photoUrls: string[] = [];
      photoImagesSnapshot.forEach((photoDoc) => {
        const photoData = photoDoc.data();
        if (photoData.image) {
          photoUrls.push(photoData.image);
        }
      });
      
      await postDoc.ref.update({ photoUrls });
      console.log(`✅ ${postDoc.id}: ${photoUrls.length}枚の画像を移行`);
      migratedCount++;
      
    } catch (error: any) {
      if (error.code === 3 && error.message?.includes('exceeds the maximum allowed size')) {
        console.error(`🚫 ${postDoc.id}: ドキュメントサイズ超過（1MB制限） - スキップ`);
        errorCount++;
        errorPosts.push(postDoc.id);
      } else {
        console.error(`❌ ${postDoc.id}: 予期しないエラー:`, error.message);
        errorCount++;
        errorPosts.push(postDoc.id);
      }
    }
  }
  
  console.log('');
  console.log('=== 移行完了 ===');
  console.log(`✅ 移行成功: ${migratedCount}件`);
  console.log(`⏭️  スキップ: ${skippedCount}件`);
  console.log(`🚫 エラー: ${errorCount}件`);
  
  if (errorPosts.length > 0) {
    console.log('');
    console.log('🚫 エラーが発生した投稿ID:');
    errorPosts.forEach(id => console.log(`  - ${id}`));
    console.log('');
    console.log('💡 これらの投稿は1MB制限を超えているため、別の対策が必要です。');
  }
}

migratePhotoData()
  .then(() => {
    console.log('✅ すべての処理が完了しました');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ 致命的エラー:', error);
    process.exit(1);
  });
