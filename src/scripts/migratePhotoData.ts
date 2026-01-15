import { getFirestore, collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { initializeApp } from 'firebase/app';

// Firebase設定（.envから読み込んでいる設定と同じ）
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function migratePhotoData() {
  console.log('🚀 画像データ移行開始...');
  
  const postsRef = collection(db, 'posts');
  const postsSnapshot = await getDocs(postsRef);
  
  let migratedCount = 0;
  let skippedCount = 0;
  
  for (const postDoc of postsSnapshot.docs) {
    const postData = postDoc.data();
    
    // 既にphotoUrlsがある場合はスキップ
    if (postData.photoUrls && Array.isArray(postData.photoUrls)) {
      console.log(`⏭️  ${postDoc.id}: 既に移行済み`);
      skippedCount++;
      continue;
    }
    
    // photoImagesサブコレクションから取得
    const photoImagesRef = collection(db, 'posts', postDoc.id, 'photoImages');
    const photoImagesSnapshot = await getDocs(photoImagesRef);
    
    if (photoImagesSnapshot.empty) {
      console.log(`⚠️  ${postDoc.id}: 画像なし`);
      // 空配列をセット
      await updateDoc(doc(db, 'posts', postDoc.id), {
        photoUrls: []
      });
      migratedCount++;
      continue;
    }
    
    // URLを配列に変換
    const photoUrls: string[] = [];
    photoImagesSnapshot.forEach((photoDoc) => {
      const photoData = photoDoc.data();
      if (photoData.url) {
        photoUrls.push(photoData.url);
      }
    });
    
    // Firestoreを更新
    await updateDoc(doc(db, 'posts', postDoc.id), {
      photoUrls: photoUrls
    });
    
    console.log(`✅ ${postDoc.id}: ${photoUrls.length}枚の画像を移行`);
    migratedCount++;
  }
  
  console.log('');
  console.log('=== 移行完了 ===');
  console.log(`✅ 移行: ${migratedCount}件`);
  console.log(`⏭️  スキップ: ${skippedCount}件`);
}

migratePhotoData()
  .then(() => {
    console.log('✅ すべての処理が完了しました');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ エラー:', error);
    process.exit(1);
  });