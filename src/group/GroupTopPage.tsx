// GroupTopPage.tsx
// 🧪 TEST: develop環境の動作確認
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Group } from '../types';
import { DBUtil, STORES } from '../utils/dbUtil';
import GroupFooterNav from '../components/GroupFooterNav';
import { getGroupWithFirestore } from '../utils/dbUtil';
import UnifiedCoreSystem from '../core/UnifiedCoreSystem';
import { invalidateArchiveCache } from './ArchivePage';




const GroupTopPage: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

   // 🎯 環境判定（本番 / プレビュー / ローカル）
const getEnvironmentSuffix = () => {
  if (typeof window === 'undefined') return '';
  
  const hostname = window.location.hostname;
  
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return '*';  // ローカル環境
  }
  
  if (hostname.includes('vercel.app')) {
    return '**';  // プレビュー環境
  }
  
  return '';  // 本番環境
};

const environmentSuffix = getEnvironmentSuffix();
  
  // グループ名の表示制限を追跡するための参照
  const groupNameRef = useRef<HTMLHeadingElement>(null);
  const [nameHeight, setNameHeight] = useState<number>(0);
  const [nameTruncated, setNameTruncated] = useState<boolean>(false);
  
  // 初期値としてグループIDだけセットしておく
  const [group, setGroup] = useState<Group>({
    id: groupId || '',
    name: "北長瀬 / 岡本邸", 
    description: "Master Craft チームです",
    adminId: "admin_user",
    members: [
  {
    id: "admin_user",
    role: 'admin',
    isAdmin: true,
    joinedAt: Date.now() - 1000000,
    email: 'admin@example.com',
    username: 'admin_user'
  },
  {
    id: "user1",
    role: 'user',
    isAdmin: false,
    joinedAt: Date.now() - 900000,
    email: 'user1@example.com',
    username: 'user1'
  },
  {
    id: "user2",
    role: 'user',
    isAdmin: false,
    joinedAt: Date.now() - 800000,
    email: 'user2@example.com',
    username: 'user2'
  }
],
    settings: {
      reportDeadline: "18:00",
      reportSettings: {
        frequency: "daily"
      }
    },
    createdAt: Date.now() - 1000000,
    updatedAt: Date.now()
  });
  
  // アクティブなタブを管理
  const [activeTab, setActiveTab] = useState<'post' | 'history' | 'members'>('post');

  // ユーザー情報
  const [userId, setUserId] = useState<string>('');
  const [username, setUsername] = useState<string>('');
  
  // チェックイン状態（既存の作業時間投稿IDを保持）
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [checkInPostId, setCheckInPostId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false); // 処理中フラグ
  const [checkInTime, setCheckInTime] = useState<number | null>(null); // チェックイン時刻
  const [isLoadingCheckInState, setIsLoadingCheckInState] = useState(true); 


// GroupTopPage読み込み時にフッターを必ず閉じる
useEffect(() => {
  console.log('🚪 GroupTopPage: フッターを閉じる処理実行', { groupId });
  
  const closeFooter = () => {
    const footerState = {
      showFooter: false,
      showFAB: true,
      animationTrigger: 'initial'
    };
    localStorage.setItem('footer-visibility-state', JSON.stringify(footerState));
    window.dispatchEvent(new Event('storage'));
    console.log('✅ フッター閉じる処理完了');
  };
  
  // 即座に閉じる
  closeFooter();
  
  // 念のため、複数回実行して確実に閉じる
  const timerId1 = setTimeout(closeFooter, 50);
  const timerId2 = setTimeout(closeFooter, 100);
  const timerId3 = setTimeout(closeFooter, 200);
  
  return () => {
    clearTimeout(timerId1);
    clearTimeout(timerId2);
    clearTimeout(timerId3);
  };
}, []); // 空の依存配列 = コンポーネントマウント時に1回だけ実行

// groupId が変わった時にも閉じる
useEffect(() => {
  if (groupId) {
    console.log('🔄 groupId変更: フッターを閉じる', { groupId });
    const footerState = {
      showFooter: false,
      showFAB: true,
      animationTrigger: 'initial'
    };
    localStorage.setItem('footer-visibility-state', JSON.stringify(footerState));
    window.dispatchEvent(new Event('storage'));
  }
}, [groupId]);


// // ★ EditPageからの更新を検知してリフレッシュ ★
// useEffect(() => {
//   console.log('🎧 [GroupTopPage] 投稿更新イベント監視を開始');
  
//   const handlePostsUpdate = async () => {
//     console.log('📢 [GroupTopPage] 投稿更新イベントを受信');
//     // チェックイン状態を再確認
//     const userIdFromStorage = localStorage.getItem("daily-report-user-id");
//     if (userIdFromStorage && groupId) {
//       console.log('🔄 [GroupTopPage] チェックイン状態を再確認中...');
//       await checkTodayWorkTimePost(userIdFromStorage);
//     }
//   };
  
//   // localStorageフラグ監視
//   let lastUpdateFlag = localStorage.getItem('daily-report-posts-updated') || '';
//   const checkForUpdates = () => {
//     const currentFlag = localStorage.getItem('daily-report-posts-updated') || '';
//     if (currentFlag !== lastUpdateFlag && currentFlag !== '') {
//       console.log('📱 [GroupTopPage] localStorageフラグ変更を検知:', currentFlag);
//       lastUpdateFlag = currentFlag;
//       handlePostsUpdate();
//     }
//   };
  
//   // イベントリスナーの設定
//   window.addEventListener('postsUpdated', handlePostsUpdate);
//   window.addEventListener('refreshPosts', handlePostsUpdate);
  
//   // ポーリング開始（1秒間隔）
//   const pollingInterval = setInterval(checkForUpdates, 1000);
  
//   // クリーンアップ
//   return () => {
//     console.log('🔌 [GroupTopPage] 更新イベント監視を終了');
//     window.removeEventListener('postsUpdated', handlePostsUpdate);
//     window.removeEventListener('refreshPosts', handlePostsUpdate);
//     clearInterval(pollingInterval);
//   };
// }, [groupId]);

useEffect(() => {
  // データ読み込み処理
  const loadData = async () => {
      if (!groupId) {
        console.error('グループIDが見つかりません');
        return;
      }
      
      try {
        // ユーザー情報を取得
        const userIdFromStorage = localStorage.getItem("daily-report-user-id") || "admin_user";
        const usernameFromStorage = localStorage.getItem("daily-report-username") || "ユーザー";
        
        setUserId(userIdFromStorage);
        setUsername(usernameFromStorage);
        

        
        // Firestoreから実際のグループデータを取得
try {
  console.log('📊 Firestoreからグループデータを取得中...', groupId);
  
  // 1. まずFirestoreから取得を試行
  const firestoreGroup = await getGroupWithFirestore(groupId);
  if (firestoreGroup) {
    console.log('✅ Firestoreからグループを取得:', firestoreGroup.name);
    setGroup(firestoreGroup);
  } else {
    console.log('⚠️ Firestoreでグループが見つかりません、IndexedDBを確認');
    
    // 2. Firestoreで取得できない場合、IndexedDBから取得
    const dbUtil = DBUtil.getInstance();
    await dbUtil.initDB();
    const indexedGroup = await dbUtil.get<Group>(STORES.GROUPS, groupId);
    
    if (indexedGroup) {
      console.log('📱 IndexedDBからグループを取得:', indexedGroup.name);
      setGroup(indexedGroup);
    } else {
      console.log('❌ グループが見つかりません、ダミーデータを使用:', groupId);
      // 最後の手段としてダミーデータ
      const dummyGroup: Group = {
        id: groupId,
        name: "グループが見つかりません",
        description: "データの読み込みに失敗しました",
        adminId: "admin_user",
        members: [{
  id: "admin_user",
  role: 'admin',
  isAdmin: true,
  joinedAt: Date.now() - 1000000,
  email: 'admin@example.com',
  username: 'admin_user'
}],
        settings: {
          reportDeadline: "18:00",
          reportSettings: {
            frequency: "daily"
          }
        },
        createdAt: Date.now() - 1000000,
        updatedAt: Date.now()
      };
      setGroup(dummyGroup);
     }
    }
  } catch (groupError) {
    console.error('グループ取得エラー:', groupError);
  }

  
// 今日の作業時間投稿を確認（ページに戻るたびに実行）
console.log('📍 checkTodayWorkTimePost 呼び出し直前');
await checkTodayWorkTimePost(userIdFromStorage);
console.log('📍 checkTodayWorkTimePost 呼び出し直後');

    
  } catch (error) {
    console.error('データロードエラー:', error);
  }
};

loadData();
}, [groupId]);

// ページが表示されるたびにチェックイン状態を再確認
useEffect(() => {
  const recheckCheckInState = async () => {
    const userIdFromStorage = localStorage.getItem("daily-report-user-id");
    if (userIdFromStorage && groupId) {
      console.log('🔄 ページ表示時: チェックイン状態を再確認');
console.log('🔄 [デバッグ] ページ表示時の再確認:', {
  userIdFromStorage,
  groupId,
  現在時刻: new Date().toISOString()
});
await checkTodayWorkTimePost(userIdFromStorage);
    }
  };
  
  recheckCheckInState();
}, [groupId]);

  
// 今日の作業時間投稿を確認（日跨ぎ対応版）
  const checkTodayWorkTimePost = async (userId: string) => {
    try {
      setIsLoadingCheckInState(true);
      console.log('🔍 チェックイン状態を確認中...');
      
      const dbUtil = DBUtil.getInstance();
      await dbUtil.initDB();
      const posts = await dbUtil.getAll<any>(STORES.POSTS);
      
      const now = new Date();
      console.log('📅 現在時刻:', now.toISOString());
      
      // 🔍 チェックイン中の投稿を検索（チェックアウトタグがないもの）
      const checkInPosts = posts.filter(post => {
  const isUserMatch = post.userId === userId;
  const isGroupMatch = post.groupId === groupId;
  const hasWorkTimeTag = post.tags?.includes('#出退勤時間');
  
  
  // チェックアウト: "作業開始"と"作業終了"両方
  const hasCheckOut = post.message?.includes('作業終了') || 
                    post.message?.includes('終了:') ||
                    post.message?.includes('■ 作業時間:');
  
  return isUserMatch && isGroupMatch && hasWorkTimeTag && !hasCheckOut;
});
      
      if (checkInPosts.length === 0) {
        console.log('❌ チェックイン状態の投稿なし');
        setIsCheckedIn(false);
        setCheckInPostId(null);
        setCheckInTime(null);
        return;
      }
      
      // 最新のチェックイン投稿を取得
      const latestCheckIn = checkInPosts.sort((a, b) => {
        const timeA = new Date(a.createdAt).getTime();
        const timeB = new Date(b.createdAt).getTime();
        return timeB - timeA;
      })[0];
      
      // 経過時間を計算
      let postDate: Date = new Date();
      if (typeof latestCheckIn.createdAt === 'object' && 'toDate' in latestCheckIn.createdAt) {
        postDate = (latestCheckIn.createdAt as any).toDate();
      } else if (latestCheckIn.createdAt instanceof Date) {
        postDate = latestCheckIn.createdAt;
      } else if (typeof latestCheckIn.createdAt === 'string') {
        postDate = new Date(latestCheckIn.createdAt);
      }
      
      const elapsed = now.getTime() - postDate.getTime();
      const hoursElapsed = Math.floor(elapsed / (1000 * 60 * 60));
      
      console.log(`⏰ チェックイン投稿発見: ${hoursElapsed}時間前`);
      
      // 🎯 24時間超過している場合、確認ダイアログ
      if (hoursElapsed > 24) {
        const dateStr = postDate.toLocaleString('ja-JP', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        });
        
        const confirmed = confirm(
          `⚠️ ${hoursElapsed}時間前のチェックイン投稿が見つかりました\n\n` +
          `チェックイン時刻: ${dateStr}\n\n` +
          `このままチェックアウトしますか？\n` +
          `（${hoursElapsed}時間の作業時間として記録されます）\n\n` +
          `※後で編集ページから時間を修正できます`
        );
        
        if (!confirmed) {
          console.log('⚠️ ユーザーがキャンセル: チェックイン状態を非表示');
          setIsCheckedIn(false);
          setCheckInPostId(null);
          setCheckInTime(null);
          return;
        }
        
        console.log('✅ ユーザーが承認: チェックアウトを許可');
      }
      
      // チェックイン状態をセット
      setIsCheckedIn(true);
      setCheckInPostId(latestCheckIn.id);
      setCheckInTime(postDate.getTime());
      
      console.log('✅ チェックイン状態を設定:', {
        postId: latestCheckIn.id,
        経過時間: `${hoursElapsed}時間`
      });
      
    } catch (error) {
      console.error('チェックイン状態確認エラー:', error);
    } finally {
      setIsLoadingCheckInState(false);
    }
  };
 
  
  // グループ名の高さを測定し、必要に応じて切り詰める
  useEffect(() => {
    if (groupNameRef.current) {
      const height = groupNameRef.current.scrollHeight;
      const lineHeight = parseInt(window.getComputedStyle(groupNameRef.current).lineHeight);
      const maxLines = 2;
      
      setNameHeight(height);
      
      // 2行以上になっているか確認
      if (height > lineHeight * maxLines) {
        setNameTruncated(true);
      } else {
        setNameTruncated(false);
      }
    }
  }, [group.name]);
  
  const handleTabChange = (tab: 'post' | 'history' | 'members') => {
  setActiveTab(tab);
  
  // ⭐ GroupTopから他のページへ移動する際は、fromパラメータを削除
  // こうすることで、Archive/Members/Postから×で戻る際にGroupListに戻る
  
  console.log('=== handleTabChange実行 ===');
  console.log('tab:', tab);
  console.log('fromパラメータを削除して遷移します');
  
  switch(tab) {
    case 'post':
      console.log('遷移先:', `/group/${groupId}/post`);
      navigate(`/group/${groupId}/post`);
      break;
case 'history':
  console.log('遷移先:', `/group/${groupId}/archive`);
  // ⭐ Archiveページ遷移前にキャッシュをクリア
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem(`archiveCache_${groupId}`);
    console.log('🗑️ [GroupTopPage] Archiveキャッシュをクリア');
  }
  navigate(`/group/${groupId}/archive`);
  break;
    case 'members':
      console.log('遷移先:', `/group/${groupId}/members`);
      navigate(`/group/${groupId}/members`);
      break;
  }
};

      // 戻るボタンの処理
const handleBack = () => {
  const from = searchParams.get('from');
  const postId = searchParams.get('postId');
  
  console.log('=== handleBack実行 ===');
  console.log('from:', from);
  console.log('postId:', postId);
  
  if (from === 'home-detail' && postId) {
    // Home詳細ページから来た場合は、sessionStorageに保存してHomeに戻る
    console.log('Home詳細ページに戻る');
    sessionStorage.setItem('returnToDetail', postId);
    navigate('/');
  } else if (from === 'post-detail' && postId) {
    // 投稿詳細から来た場合は、必ず投稿詳細に戻る
    console.log('投稿詳細に戻る:', `/post/${postId}`);
    navigate(`/post/${postId}`, { replace: true });
  } else if (from === 'home') {
    // Homeから来た場合はHomeに戻る
    console.log('Homeに戻る');
    navigate('/', { replace: true });
  } else {
    // その他の場合はグループリストに戻る
    console.log('グループリストに戻る');
    navigate('/groups', { replace: true });
  }
};

  
// チェックイン・チェックアウト処理（完全版 - ガード強化）
const handleCheckInOut = async () => {
  // デバッグログ
  console.log('🔍 handleCheckInOut 実行:', { isCheckedIn, isProcessing });


  // 強力なガード：処理中は実行しない
  if (!groupId || !userId || isProcessing) {
    console.log('⚠️ handleCheckInOut: 実行条件を満たしていません', {
      groupId: !!groupId,
      userId: !!userId,
      isProcessing
    });
    return;
  }

  // 連続クリック防止（300msに短縮）
  const now = Date.now();
  const lastClickKey = 'lastCheckInOutClick';
  const lastClick = parseInt(localStorage.getItem(lastClickKey) || '0');
  
  if (now - lastClick < 300) {
    console.log('⚠️ 連続クリック防止');
    return;
  }
  
  localStorage.setItem(lastClickKey, now.toString());

  console.log('🎯 handleCheckInOut: 実行開始', {
    isCheckedIn,
    checkInPostId
  });
  
  try {
    setIsProcessing(true); 
    
    const now = new Date();
    const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
    const weekday = weekdays[now.getDay()];
    const date = `${now.getFullYear()} / ${now.getMonth() + 1} / ${now.getDate()}（${weekday}）`;
    const time = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    
   if (!isCheckedIn) {
  // チェックイン処理
  try {
    console.log('🔵 チェックイン処理開始');
    
    const now = new Date();
    const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
    const weekday = weekdays[now.getDay()];
    const date = `${now.getFullYear()} / ${now.getMonth() + 1} / ${now.getDate()}（${weekday}）`;
    const time = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    
    const postId = await UnifiedCoreSystem.savePost({
  message: `開始: ${time}\n日付: ${date}`,
  files: [],
  tags: ["#出退勤時間"],
  groupId: groupId,
  checkInTime: now.getTime(),
} as any);

    console.log('✅ チェックイン投稿保存完了:', postId);

    // ✅ checkInTimeを追加で保存
const dbUtil = DBUtil.getInstance();
await dbUtil.initDB();
const savedPost = await dbUtil.get(STORES.POSTS, postId) as any;
if (savedPost) {
  savedPost.checkInTime = now.getTime();
  await dbUtil.save(STORES.POSTS, savedPost);
  console.log('✅ checkInTimeを保存完了:', now.getTime());
}

    // ⭐ ここから追加：HomePageとArchivePageに通知 ⭐
    const updateFlag = Date.now().toString();
    localStorage.setItem('daily-report-posts-updated', updateFlag);
    localStorage.setItem('posts-need-refresh', 'true');
    console.log('🔍 [デバッグ] チェックイン通知:', updateFlag);

    // イベント発火
    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new CustomEvent('refreshPosts'));

    console.log('📢 [GroupTopPage] チェックイン通知を送信');

     // 🆕 キャッシュをクリアして最新データを表示
    if (groupId) {
      invalidateArchiveCache(groupId);
      console.log('🗑️ [CheckIn] ArchivePageのキャッシュをクリア');
    }

    // ⭐ さらに追加：HomePageのキャッシュを強制無効化 ⭐
    if (window.forceRefreshPosts) {
      window.forceRefreshPosts();
    }
    window.dispatchEvent(new CustomEvent('postsUpdated'));
    
    // 状態を更新
    setIsCheckedIn(true);
    setCheckInPostId(postId);
    setCheckInTime(now.getTime()); // チェックイン時刻を記録
    
    // 成功メッセージ
    alert(`✅ 作業開始を記録しました (${time})`);
    
  } catch (error) {
    console.error('❌ チェックイン保存エラー:', error);
    alert('チェックイン記録の保存に失敗しました。もう一度お試しください。');
  }
      
   } else {
  // 🟠 チェックアウト処理開始
  console.log('🟠 チェックアウト処理開始');
  
  if (!checkInPostId) {
    alert('❌ チェックイン情報が見つかりません');
    return;
  }
  
  try {
    // 既存のチェックイン投稿を取得
    const dbUtil = DBUtil.getInstance();
    await dbUtil.initDB();
    const checkInPost = await dbUtil.get(STORES.POSTS, checkInPostId) as any;
    
    if (!checkInPost) {
      alert('❌ チェックイン投稿が見つかりません');
      return;
    }
    
    // ✅ 先に変数を宣言（デバッグログの前に！）
    let actualStartTime = checkInPost.checkInTime || checkInTime || 0;
    const checkOutTime = new Date().getTime();
    const workDuration = checkOutTime - actualStartTime;
    const hours = Math.floor(workDuration / (1000 * 60 * 60));
    const minutes = Math.floor((workDuration % (1000 * 60 * 60)) / (1000 * 60));
    
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const date = `${now.getFullYear()} / ${now.getMonth() + 1} / ${now.getDate()}（${['日', '月', '火', '水', '木', '金', '土'][now.getDay()]}）`;
    
    // ===== ここからデバッグログ =====
    console.log('🔍🔍🔍 [重要] チェックアウト開始時の状態:');
    console.log('- isCheckedIn:', isCheckedIn);
    console.log('- checkInPostId:', checkInPostId);
    console.log('- checkInTime:', checkInTime);
    console.log('- checkInTime（日付形式）:', checkInTime ? new Date(checkInTime).toLocaleString('ja-JP') : 'なし');
    console.log('==========================================');
    
    console.log('🔍🔍🔍 [重要] 取得したcheckInPost全体:');
    console.log(JSON.stringify(checkInPost, null, 2));
    console.log('');
    console.log('🔍 個別フィールドの確認:');
    console.log('- checkInPost.id:', checkInPost?.id);
    console.log('- checkInPost.checkInTime:', checkInPost?.checkInTime);
    console.log('- checkInPost.timestamp:', checkInPost?.timestamp);
    console.log('- checkInPost.createdAt:', checkInPost?.createdAt);
    console.log('- checkInPost.message:', checkInPost?.message);
    console.log('- checkInPost.isManuallyEdited:', checkInPost?.isManuallyEdited);
    console.log('- checkInPost.isEdited:', checkInPost?.isEdited);
    console.log('');
    console.log('🔍 型の確認:');
    console.log('- typeof checkInPost.checkInTime:', typeof checkInPost?.checkInTime);
    console.log('- typeof checkInPost.timestamp:', typeof checkInPost?.timestamp);
    console.log('- typeof checkInPost.createdAt:', typeof checkInPost?.createdAt);
    console.log('==========================================');
    
    console.log('🔍🔍🔍 [重要] 作業時間計算前の値:');
    console.log('- actualStartTime:', actualStartTime);
    console.log('- actualStartTime（日付形式）:', new Date(actualStartTime).toLocaleString('ja-JP'));
    console.log('- checkInTime（state）:', checkInTime);
    console.log('- checkInTime（日付形式）:', checkInTime ? new Date(checkInTime).toLocaleString('ja-JP') : 'なし');
    console.log('- checkOutTime:', checkOutTime);
    console.log('- checkOutTime（日付形式）:', new Date(checkOutTime).toLocaleString('ja-JP'));
    console.log('==========================================');
    
    
    // 🆕 編集済みの場合、元のメッセージから時刻を抽出
let startTimeStr = '';
let startDateStr = '';

// 👇 まず時刻を抽出（新旧フォーマット両対応）
if (checkInPost.message) {
  // 新フォーマット: "開始: 23:31"
  const newStartMatch = checkInPost.message.match(/開始:\s*(\d{2}:\d{2})/);
  // 旧フォーマット: "作業開始: 23:31"
  const oldStartMatch = checkInPost.message.match(/作業開始:\s*(\d{2}:\d{2})/);
  
  if (newStartMatch) {
    startTimeStr = newStartMatch[1];
  } else if (oldStartMatch) {
    startTimeStr = oldStartMatch[1];
  }
  
  // 日付も両フォーマット対応
  const newDateMatch = checkInPost.message.match(/日付:\s*([^\n]+)/);
  const oldDateMatch = checkInPost.message.match(/開始日:\s*([^\n]+)/);
  
  if (newDateMatch) {
    startDateStr = newDateMatch[1];
  } else if (oldDateMatch) {
    startDateStr = oldDateMatch[1];
  } else {
  // 🆕 フォールバック: どちらのフォーマットもない場合は現在の日付を使う
  startDateStr = date;
}
      
      // 🔢 時刻を数値に変換
      if (startTimeStr) {
        console.log('🔄 時刻を数値に変換します:', startTimeStr);
        
        const [hourStr, minuteStr] = startTimeStr.split(':');
        const startHour = parseInt(hourStr, 10);
        const startMinute = parseInt(minuteStr, 10);
        
        if (startDateStr) {
          const dateMatch = startDateStr.match(/(\d{4})\s*\/\s*(\d{1,2})\s*\/\s*(\d{1,2})/);
          if (dateMatch) {
            const year = parseInt(dateMatch[1], 10);
            const month = parseInt(dateMatch[2], 10) - 1;
            const day = parseInt(dateMatch[3], 10);
            
            actualStartTime = new Date(year, month, day, startHour, startMinute).getTime();
            console.log('✅ 開始時刻を変換:', new Date(actualStartTime).toLocaleString());
          }
        } else {
          actualStartTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), startHour, startMinute).getTime();
        }
      }
    }
    
    // 時刻が抽出できなかった場合は、チェックイン時刻を使用
    if (!startTimeStr) {
      const checkInDateTime = new Date(checkInTime || 0);
      startTimeStr = `${String(checkInDateTime.getHours()).padStart(2, '0')}:${String(checkInDateTime.getMinutes()).padStart(2, '0')}`;
      startDateStr = date;
    }
    
    console.log('🔍 [チェックアウト] 使用する開始時刻:', startTimeStr);
    console.log('🔍 [チェックアウト] 使用する開始日付:', startDateStr);
    
    console.log('🔍🔍🔍 [重要] 時刻抽出の結果:');
    console.log('- startTimeStr:', startTimeStr);
    console.log('- startDateStr:', startDateStr);
    console.log('- checkInPost.message:', checkInPost.message);
    console.log('- checkInPost.isManuallyEdited:', checkInPost.isManuallyEdited);
    console.log('');
    console.log('🔍 メッセージ内の時刻抽出テスト:');
    if (checkInPost.message) {
      const timeMatch = checkInPost.message.match(/作業開始:\s*(\d{2}:\d{2})/);
      console.log('- 抽出した時刻:', timeMatch ? timeMatch[1] : 'マッチなし');
      console.log('- 元のメッセージ:', checkInPost.message);
    }
    console.log('==========================================');
    
   // 👇 時刻が確定した後で作業時間を計算
let workTimeStr = '0時間0分';
if (startTimeStr) {
  console.log('🔄 作業時間を計算します');
  console.log('🔍 [作業時間計算] 使用する開始時刻:', startTimeStr);
  console.log('🔍 [作業時間計算] 終了時刻:', time);
  
  const startTimeParts = startTimeStr.split(':');
  const startHour = parseInt(startTimeParts[0], 10);
  const startMinute = parseInt(startTimeParts[1], 10);
  
  // ✅ 日跨ぎ対応：開始日付を正しく設定
  let startDateTime: Date;
  if (startDateStr) {
    // 開始日付が指定されている場合（編集済みの場合）
    const dateMatch = startDateStr.match(/(\d{4})\s*\/\s*(\d{1,2})\s*\/\s*(\d{1,2})/);
    if (dateMatch) {
      const year = parseInt(dateMatch[1], 10);
      const month = parseInt(dateMatch[2], 10) - 1;
      const day = parseInt(dateMatch[3], 10);
      startDateTime = new Date(year, month, day, startHour, startMinute);
    } else {
      startDateTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), startHour, startMinute);
    }
  } else {
    // ✅ checkInTimeから正しい日付を取得
    if (checkInTime) {
      const checkInDate = new Date(checkInTime);
      startDateTime = new Date(
        checkInDate.getFullYear(),
        checkInDate.getMonth(),
        checkInDate.getDate(),
        startHour,
        startMinute
      );
    } else {
      startDateTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), startHour, startMinute);
    }
  }
  
  const endDateTime = new Date();
  
  const durationMs = endDateTime.getTime() - startDateTime.getTime();
  const durationHours = Math.floor(durationMs / (1000 * 60 * 60));
  const durationMinutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
  
  // ✅ 負の値のチェック（念のため）
  if (durationHours < 0) {
    console.log('⚠️ 負の値を検出: 0時間0分に設定');
    workTimeStr = '0時間0分';
  } else {
    workTimeStr = `${durationHours}時間${durationMinutes}分`;
  }
  
  console.log('📊 作業時間計算結果:', {
    開始時刻: startDateTime.toLocaleString('ja-JP'),
    終了時刻: endDateTime.toLocaleString('ja-JP'),
    経過ミリ秒: durationMs,
    計算された時間: durationHours,
    計算された分: durationMinutes,
    作業時間: workTimeStr
  });
}
    
    // メッセージを作成（編集済みの時刻を保持）
    // 🆕 新フォーマットに統一
    const updatedMessage = `開始: ${startTimeStr} ー 終了: ${time}\n─────────────────\n■ 作業時間: ${workTimeStr}\n─────────────────\n日付: ${startDateStr}`;

    // 🆕 デバッグログを追加
console.log('🔍🔍🔍 [重要] updatedMessage の内容:');
console.log(updatedMessage);
console.log('🔍 updatedMessage.length:', updatedMessage.length);
console.log('🔍 日付が含まれているか:', updatedMessage.includes('日付:'));

    console.log('🔍 [チェックアウト] 使用する開始時刻:', startTimeStr);
    console.log('🔍 [チェックアウト] 使用する開始日付:', startDateStr);
    
    // 🔧 修正: 削除して新規作成（投稿が最新位置に移動）
    console.log('🗑️ 古いチェックイン投稿を削除:', checkInPostId);
    
    // 1. 古い投稿を削除
    await UnifiedCoreSystem.deletePost(checkInPostId, userId);
    console.log('✅ 古いチェックイン投稿を削除完了');
    
    // 2. 新しい統合投稿を作成（最新の時間で）
    console.log('🔍🔍🔍 [savePost前] 渡す値:');
    console.log('- message:', updatedMessage);
    console.log('- message.length:', updatedMessage.length);
    console.log('- 日付含む:', updatedMessage.includes('日付:'));

    console.log('🔍 [チェックアウト] checkInPost.isManuallyEdited:', checkInPost.isManuallyEdited);
    console.log('🔍 [チェックアウト] checkInPost.isEdited:', checkInPost.isEdited);
    
    const newPostId = await UnifiedCoreSystem.savePost({
      message: updatedMessage,
      files: [],
      tags: checkInPost.tags || ["#出退勤時間"],
      groupId: groupId
    });
    
    console.log('✅ 新しい統合投稿を作成:', newPostId);
    
    // 編集済みフラグを引き継ぐ
    if (checkInPost.isManuallyEdited) {
      console.log('🔍 [チェックアウト] 編集済みフラグを引き継ぎます');
      const dbUtil = DBUtil.getInstance();
      await dbUtil.initDB();
      const savedPost = await dbUtil.get(STORES.POSTS, newPostId) as any;
      if (savedPost) {
        console.log('🔍 [チェックアウト] 投稿取得成功');
        savedPost.isManuallyEdited = true;
        savedPost.isEdited = true;
        await dbUtil.save(STORES.POSTS, savedPost);
        console.log('✅ IndexedDBに編集済みフラグを保存');
        
        // 🆕 Firestoreにも保存
        try {
          await UnifiedCoreSystem.updatePost(newPostId, {
            message: updatedMessage, 
            isManuallyEdited: true
          });
          console.log('✅ Firestoreにも編集済みフラグを保存');
        } catch (error) {
          console.error('❌ Firestore保存エラー:', error);
        }
      } else {
        console.error('❌ [チェックアウト] 投稿が見つかりません');
      }
    } else {
      console.log('🔍 [チェックアウト] 編集済みフラグなし（引き継ぎスキップ）');
    }
    
    // 3. 新しい投稿IDを保存
    setCheckInPostId(newPostId);
    localStorage.setItem(`checkInPostId_${groupId}`, newPostId);
    
    console.log('✅ チェックアウト完了:', checkInPostId);
    
    // 通知を送信
    const updateFlag = Date.now().toString();
    localStorage.setItem('daily-report-posts-updated', updateFlag);
    localStorage.setItem('posts-need-refresh', 'true');
    
    // HomePageのキャッシュを強制無効化
    if (window.forceRefreshPosts) {
      window.forceRefreshPosts();
    }
    
    // イベント発火
    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new CustomEvent('postsUpdated', {
      detail: {
        updatedPost: checkInPostId,
        timestamp: Date.now(),
        source: 'GroupTopPage',
        action: 'checkout'
      }
    }));
    window.dispatchEvent(new CustomEvent('refreshPosts'));
    
    console.log('📢 [GroupTopPage] チェックアウト通知を送信');

    // 🆕 キャッシュをクリアして最新データを表示
    if (groupId) {
      invalidateArchiveCache(groupId);
      console.log('🗑️ [CheckOut] ArchivePageのキャッシュをクリア');
    }
    
    // 状態をリセット
    setIsCheckedIn(false);
    setCheckInPostId(null);
    setCheckInTime(null);
    
    // 成功メッセージ
    alert(`✅ 作業終了を記録しました (${time})\n作業時間: ${hours}時間${minutes}分`);
    
  } catch (error) {
    console.error('❌ チェックアウト更新エラー:', error);
    alert('チェックアウト記録の更新に失敗しました。もう一度お試しください。');
  }
}
  } catch (error) {
    console.error('作業時間記録エラー:', error);
    alert('作業時間の記録に失敗しました');
  } finally {
    setIsProcessing(false); // 処理終了
  }
};

  
  
  // 日本語形式の日付文字列からDateオブジェクトを作成する関数
  const parseDateString = (dateTimeStr: string): Date => {
    try {
      // "2025 / 4 / 4（金）　12:30" 形式の文字列を解析
      const [datePart, timePart] = dateTimeStr.split('　');
      // 日付部分から括弧内の曜日を削除
      const dateWithoutWeekday = datePart.replace(/（.+）/, '');
      // スラッシュをハイフンに変換（より確実に解析できる形式に）
      const formattedDate = dateWithoutWeekday
        .replace(/\s+/g, '')
        .replace(/\//g, '-');
      // 時間部分と結合
      const dateTimeString = `${formattedDate} ${timePart}`;
      return new Date(dateTimeString);
    } catch (e) {
      console.error('日付解析エラー:', dateTimeStr, e);
      // 解析に失敗した場合は現在の日時を返す
      return new Date();
    }
  };

  // グループ名表示用のスタイル
  const groupNameStyle = {
    color: '#2d6a7e',
    fontSize: '28px',
    fontWeight: 'bold',
    marginBottom: '30px',
    textAlign: 'center' as 'center',
    maxHeight: '4.2rem',
    overflow: 'hidden',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical' as 'vertical',
    textOverflow: 'ellipsis',
    width: '100%',
    position: 'relative' as 'relative',
    wordBreak: 'break-word' as 'break-word',
  };


// 上部の背景高さを調整（可変）
const backgroundHeight = '65vh'; // ビューポートの65%（画面サイズに応じて自動調整）
const bottomBackgroundTop = '65vh';
  
  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100%',
        background: '#f5f5f5',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
      }}
    >
      {/* 背景画像 - 上部のみ表示（常に表示） */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: backgroundHeight,
          background: 'linear-gradient(to top, rgb(7, 112, 144), rgb(7, 107, 127), rgb(0, 102, 114))',
          zIndex: 0,
          transition: 'height 0.5s ease',
        }}
      />

      {/* 下部の背景色 - 残りの30%を埋める（常に表示） */}
      <div
        style={{
          position: 'absolute',
          top: bottomBackgroundTop,
          left: 0,
          width: '100%',
          height: '43%',
          backgroundColor: '#ffffff',
          zIndex: 0,
          transition: 'top 0.5s ease',
        }}
      />
      
      {/* 戻るボタン */}
      <div 
        style={{ 
          position: 'fixed',
          top: '20px', 
          left: '20px', 
          zIndex: 100,
          cursor: 'pointer' 
        }}
        onClick={handleBack}
      >
        <svg 
          width="45" 
          height="45" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="white"
          strokeWidth="1" 
          strokeLinecap="round" 
          strokeLinejoin="round"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </div>
      
      {/* メニューボタン（常に表示） */}
      <div 
        style={{ 
          position: 'fixed',
          top: '20px', 
          right: '20px', 
          zIndex: 100,
          cursor: 'pointer' 
        }}
      >
        <svg 
          width="24" 
          height="24"
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="white"
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="1" />
          <circle cx="12" cy="5" r="1" />
          <circle cx="12" cy="19" r="1" />
        </svg>
      </div>
      

      {/* {/* グループアイコンと名前 */}
<div
  style={{
    position: 'absolute',
    top: 'calc(65vh + 35px)',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    zIndex: 10,
    width: '90%',
    maxWidth: '400px',
  }}
>
  {/* グループアイコン (正円) - 境界線の中心に配置 */}
  <div
    style={{
      width: '150px',
      height: '150px',
      borderRadius: '50%',
      backgroundImage: 'url(https://placehold.jp//ffffff/400x400.png?text=Group)',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      marginBottom: '20px',
      border: '4px solid white',
      boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
      flexShrink: 0,
    }}
  />
  
  {/* グループ名 - アイコンから20px空ける */}
  <h1
    ref={groupNameRef}
    style={{
      color: '#2d6a7e',
      fontSize: '23px',
      fontWeight: 'bold',
      lineHeight: '1.4',
      margin: '0 0 20px 0',
      padding: '0 15px',
      width: '100%',
      maxWidth: '220px',
      textAlign: 'center',
      wordBreak: 'break-word',
      overflow: 'hidden',
      display: '-webkit-box',
      WebkitLineClamp: 2,
      WebkitBoxOrient: 'vertical',
      textOverflow: 'ellipsis',
    }}
  >
   {group.name}{environmentSuffix}
  </h1>
  
  {/* チェックイン・チェックアウトボタン */}
  {isLoadingCheckInState ? (
    <div style={{ 
      padding: '12px 30px',
      color: '#055A68',
      fontSize: '16px',
      fontWeight: 'bold',
      textAlign: 'center'
    }}>
      状態確認中...
    </div>
  ) : (
   <button
  onClick={(e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('🔴🔴🔴 ボタンがクリックされました！');
    console.log('- isLoadingCheckInState:', isLoadingCheckInState);
    console.log('- isProcessing:', isProcessing);
    console.log('- isCheckedIn:', isCheckedIn);
    console.log('- disabled属性:', isLoadingCheckInState || isProcessing);
    handleCheckInOut();
  }}
  disabled={isLoadingCheckInState || isProcessing}
      style={{
        backgroundColor: isCheckedIn ? '#F6C8A6' : '#F0DB4F',
        color: '#055A68',
        border: 'none',
        borderRadius: '30px',
        padding: '12px 30px',
        fontSize: '16px',
        fontWeight: 'bold',
        cursor: isLoadingCheckInState || isProcessing ? 'not-allowed' : 'pointer',
        transition: 'all 0.3s ease',
        boxShadow: '0 4px 10px rgba(0, 0, 0, 0.1)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '50px',
        opacity: isLoadingCheckInState || isProcessing ? 0.5 : 1,
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 6px 12px rgba(0, 0, 0, 0.15)';
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '0 4px 10px rgba(0, 0, 0, 0.1)';
      }}
    >
      <svg 
        width="20" 
        height="20" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      >
        {isCheckedIn ? (
          <>
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <line x1="9" y1="9" x2="15" y2="15" />
            <line x1="15" y1="9" x2="9" y2="15" />
          </>
        ) : (
          <>
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <path d="M9 12l2 2 4-4" />
          </>
        )}
      </svg>
      {isCheckedIn ? 'Check-out' : 'Check-in'}
    </button>
  )}
</div>
      
     {/* GroupFooterNavコンポーネントを使用（常に表示） */}
<GroupFooterNav 
  activeTab={null as any}
  onTabChange={handleTabChange} 
/>
    </div>
  );
};

export default GroupTopPage;