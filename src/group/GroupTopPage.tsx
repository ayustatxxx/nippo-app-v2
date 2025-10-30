// GroupTopPage.tsx
// 🧪 TEST: develop環境の動作確認
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Group } from '../types';
import { DBUtil, STORES } from '../utils/dbUtil';
import GroupFooterNav from '../components/GroupFooterNav';
import { getGroupWithFirestore } from '../utils/dbUtil';
import UnifiedCoreSystem from '../core/UnifiedCoreSystem';



const GroupTopPage: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

   // 🎯 環境判定（本番 or テスト）
  const isTestEnvironment = typeof window !== 'undefined' && 
  window.location.hostname.includes('git-develop');
  
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
  const [isInitialized, setIsInitialized] = useState(false); 
  const [isLoadingCheckInState, setIsLoadingCheckInState] = useState(true); 

  
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

  
  // 今日の作業時間投稿を確認（初回のみ）
if (!isInitialized) {
  console.log('📍 checkTodayWorkTimePost 呼び出し直前');
  await checkTodayWorkTimePost(userIdFromStorage);
  console.log('📍 checkTodayWorkTimePost 呼び出し直後');
  setIsInitialized(true);
} else {
  console.log('📍 checkTodayWorkTimePost スキップ（既に初期化済み）');
}

    
  } catch (error) {
    console.error('データロードエラー:', error);
  }
};

loadData();
}, [groupId]);
  

 // 今日の作業時間投稿を確認（改善版）
const checkTodayWorkTimePost = async (userId: string) => {
  try {
    setIsLoadingCheckInState(true);
    console.log('🔍 今日のチェックイン状態を確認中...');
    
    const dbUtil = DBUtil.getInstance();
    await dbUtil.initDB();
    
    // 今日の日付を取得
    const today = new Date();
    const dateStr = `${today.getFullYear()} / ${today.getMonth() + 1} / ${today.getDate()}`;
    
    console.log('📅 検索対象日付:', dateStr);
    
    // 少し待ってからIndexedDBを確認（同期を待つ）
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // 今日の作業時間投稿を検索（エラーハンドリング強化）
    let posts = [];
    try {
      posts = await dbUtil.getAll<any>(STORES.POSTS);
      console.log('📦 取得した投稿数:', posts.length);
    } catch (dbError) {
      console.error('❌ IndexedDB取得エラー:', dbError);
      posts = [];
    }
    
    // 🔧 新しいロジック：今日の全ての出退勤投稿を取得
    const todayWorkTimePosts = posts.filter(post => {
      const isUserMatch = post.userId === userId;
      const isGroupMatch = post.groupId === groupId;
      const hasWorkTimeTag = post.tags?.includes('#出退勤時間');
      const isToday = post.createdAt && new Date(post.createdAt).toDateString() === today.toDateString();
      
      return isUserMatch && isGroupMatch && hasWorkTimeTag && isToday;
    });

    console.log('📦 今日の出退勤投稿数:', todayWorkTimePosts.length);

    // 投稿が0件の場合
    if (todayWorkTimePosts.length === 0) {
      console.log('❌ チェックイン状態の投稿なし');
      setIsCheckedIn(false);
      setCheckInPostId(null);
      setCheckInTime(null);
      return;
    }

    // 🔧 重要：最新の投稿を取得（createdAtでソート）
    const latestPost = todayWorkTimePosts.sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime();
      const timeB = new Date(b.createdAt).getTime();
      return timeB - timeA; // 新しい順にソート
    })[0];

    console.log('📋 最新の出退勤投稿:', {
      id: latestPost.id,
      tags: latestPost.tags,
      createdAt: latestPost.createdAt
    });

    // 🔧 最新の投稿がチェックインかチェックアウトかを判定
    const hasCheckInTag = latestPost.tags?.includes('#チェックイン');
    const hasCheckOutTag = latestPost.tags?.includes('#チェックアウト');

    if (hasCheckInTag && !hasCheckOutTag) {
      // 最新がチェックイン → チェックイン中
      console.log('✅ チェックイン状態の投稿を発見:', latestPost.id);
      setIsCheckedIn(true);
      setCheckInPostId(latestPost.id);
      
      // チェックイン時刻を復元
      if (latestPost.createdAt) {
        setCheckInTime(new Date(latestPost.createdAt).getTime());
      }
    } else if (hasCheckOutTag) {
      // 最新がチェックアウト → チェックアウト済み
      console.log('✅ チェックアウト済み:', latestPost.id);
      setIsCheckedIn(false);
      setCheckInPostId(null);
      setCheckInTime(null);
    } else {
      // どちらのタグもない場合（念のため）
      console.log('⚠️ タグ情報が不明:', latestPost.id);
      setIsCheckedIn(false);
      setCheckInPostId(null);
      setCheckInTime(null);
    }
    
  } catch (error) {
    console.error('作業時間投稿の確認エラー:', error);
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
  // 🔍 診断ログ追加（ここから）
  console.log('🔍🔍🔍 ===== handleCheckInOut 呼び出し診断 =====');
  console.log('📞 呼び出し元のスタックトレース:');
  console.log(new Error().stack);
  console.log('📊 現在の状態:');
  console.log({
    isCheckedIn,
    isProcessing,
    isLoadingCheckInState,
    checkInPostId,
    checkInTime
  });
  console.log('🔍🔍🔍 =========================================');

    // ここから追加 ↓
  console.log('🎯 イベント情報詳細:');
  console.log('- イベントタイプ:', window.event?.type);
  console.log('- イベント全体:', window.event);
  console.log('- フォーカス中の要素:', document.activeElement);
  console.log('- フォーカス中の要素タグ:', document.activeElement?.tagName);
  
  const button = document.activeElement;
  if (button?.tagName === 'BUTTON') {
    console.log('- ボタンのテキスト:', button.textContent);
    console.log('- ボタンのdisabled:', button.hasAttribute('disabled'));
  }


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
        
        const postId = await UnifiedCoreSystem.savePost({
          message: `作業開始: ${time}\n日時: ${date}　${time}`,
          files: [],
          tags: ["#出退勤時間", "#チェックイン"],
          groupId: groupId
        });

        console.log('✅ チェックイン投稿保存完了:', postId);

// ⭐ ここから追加：HomePageとArchivePageに通知 ⭐
const updateFlag = Date.now().toString();  // ← ✅ 数値のみ！
localStorage.setItem('daily-report-posts-updated', updateFlag);
localStorage.setItem('posts-need-refresh', 'true');  // ← ✅ 'true'に統一
console.log('🔍 [デバッグ] チェックイン通知:', updateFlag);

// イベント発火
window.dispatchEvent(new Event('storage'));
window.dispatchEvent(new CustomEvent('refreshPosts'));

console.log('📢 [GroupTopPage] チェックイン通知を送信');


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
      // チェックアウト処理
      try {
        console.log('🔴 チェックアウト処理開始');
        
        // 作業時間を計算（実際の時間差）
        let hours = 0;
        let minutes = 0;
        
        if (checkInTime) {
          const duration = Math.floor((now.getTime() - checkInTime) / 1000 / 60); // 分単位
          hours = Math.floor(duration / 60);
          minutes = duration % 60;
          console.log(`⏱️ 作業時間計算: ${hours}時間${minutes}分`);
        } else {
          // フォールバック（チェックイン時刻が不明な場合）
          hours = 8;
          minutes = 0;
          console.log('⚠️ チェックイン時刻不明、デフォルト値使用');
        }
        
        const postId = await UnifiedCoreSystem.savePost({
          message: `作業終了: ${time}\n日時: ${date}　${time}\n作業時間: ${hours}時間${minutes}分`,
          files: [],
          tags: ["#出退勤時間", "#チェックアウト"],
          groupId: groupId
        });

        console.log('✅ チェックアウト投稿保存完了:', postId);

// ⭐ ここから追加：HomePageとArchivePageに通知 ⭐
const updateFlag = Date.now().toString();  // ← ✅ 数値のみ！
localStorage.setItem('daily-report-posts-updated', updateFlag);
localStorage.setItem('posts-need-refresh', 'true');  // ← ✅ 'true'に統一
console.log('🔍 [デバッグ] チェックアウト通知:', updateFlag);

// HomePageのキャッシュを強制無効化
if (window.forceRefreshPosts) {
  window.forceRefreshPosts();
}

// イベント発火
window.dispatchEvent(new Event('storage'));
window.dispatchEvent(new CustomEvent('postsUpdated'));
window.dispatchEvent(new CustomEvent('refreshPosts'));

console.log('📢 [GroupTopPage] チェックアウト通知を送信');
        
        // 状態をリセット
        setIsCheckedIn(false);
        setCheckInPostId(null);
        setCheckInTime(null);
        
        // 成功メッセージ
        alert(`✅ 作業終了を記録しました (${time})\n作業時間: ${hours}時間${minutes}分`);
        
      } catch (error) {
        console.error('❌ チェックアウト保存エラー:', error);
        alert('チェックアウト記録の保存に失敗しました。もう一度お試しください。');
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
      fontSize: '22px',
      fontWeight: 'bold',
      lineHeight: '1.4',
      margin: '0 0 20px 0',
      padding: '0 15px',
      width: '100%',
      maxWidth: '270px',
      textAlign: 'center',
      wordBreak: 'break-word',
      overflow: 'hidden',
      display: '-webkit-box',
      WebkitLineClamp: 2,
      WebkitBoxOrient: 'vertical',
      textOverflow: 'ellipsis',
    }}
  >
    {isTestEnvironment && '🧪テスト '}
    {group.name}
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
      onClick={handleCheckInOut}
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
        activeTab={activeTab} 
        onTabChange={handleTabChange} 
      />
    </div>
  );
};

export default GroupTopPage;