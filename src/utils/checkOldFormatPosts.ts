import { collection, getDocs, getFirestore } from 'firebase/firestore';

export const checkOldFormatPosts = async () => {
  console.log('🔍 投稿データ形式の分析を開始...');
  
  const db = getFirestore();
  const postsRef = collection(db, 'posts');
  
  try {
    const snapshot = await getDocs(postsRef);
    
    let oldFormatCount = 0;
    let newFormatCount = 0;
    let middleFormatCount = 0;
    const oldFormatIds: string[] = [];
    
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      
      // ✅ 新形式: photoUrls フィールド
      if (data.photoUrls && Array.isArray(data.photoUrls) && data.photoUrls.length > 0) {
        newFormatCount++;
        
      // 🔄 中間形式: images フィールド
      } else if (data.images && Array.isArray(data.images) && data.images.length > 0) {
        middleFormatCount++;
        
      // 📦 旧形式: サブコレクションに画像がある
      } else {
        oldFormatCount++;
        oldFormatIds.push(doc.id);
      }
    });
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 データ形式の分布:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`  ✅ 新形式 (photoUrls):  ${newFormatCount}件 (${((newFormatCount/snapshot.docs.length)*100).toFixed(1)}%)`);
    console.log(`  🔄 中間形式 (images):    ${middleFormatCount}件 (${((middleFormatCount/snapshot.docs.length)*100).toFixed(1)}%)`);
    console.log(`  📦 旧形式 (要変換):      ${oldFormatCount}件 (${((oldFormatCount/snapshot.docs.length)*100).toFixed(1)}%)`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`  📈 合計: ${snapshot.docs.length}件`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    if (oldFormatCount > 0) {
      console.log(`\n⚠️ 旧形式投稿が ${oldFormatCount}件 存在します`);
      console.log('💡 データ移行を推奨します（パフォーマンス向上）');
      console.log(`\n📝 旧形式投稿ID（最初の10件）:`);
      oldFormatIds.slice(0, 10).forEach(id => console.log(`  - ${id}`));
      if (oldFormatIds.length > 10) {
        console.log(`  ... 他 ${oldFormatIds.length - 10}件`);
      }
    } else {
      console.log('\n✨ すべての投稿が新形式または中間形式です！');
    }
    
    return { 
      oldFormatCount, 
      newFormatCount, 
      middleFormatCount, 
      total: snapshot.docs.length,
      oldFormatIds 
    };
    
  } catch (error) {
    console.error('❌ データ形式の分析中にエラー:', error);
    throw error;
  }
};