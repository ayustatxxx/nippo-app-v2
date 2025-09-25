// GroupTopPage.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Group } from '../types';
import { DBUtil, STORES } from '../utils/dbUtil';
import GroupFooterNav from '../components/GroupFooterNav';
import { getGroupWithFirestore } from '../utils/dbUtil';


const GroupTopPage: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
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
    members: ["admin_user", "user1", "user2"],
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
        members: ["admin_user"],
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
} catch (error) {
  console.error('❌ グループデータ取得エラー:', error);
  // エラー時もダミーデータを表示
  const errorGroup: Group = {
    id: groupId,
    name: "エラーが発生しました",
    description: "グループデータの取得に失敗しました",
    adminId: "admin_user",
    members: ["admin_user"],
    settings: {
      reportDeadline: "18:00",
      reportSettings: {
        frequency: "daily"
      }
    },
    createdAt: Date.now() - 1000000,
    updatedAt: Date.now()
  };
  setGroup(errorGroup);
}
        
        // 今日の作業時間投稿を確認
        await checkTodayWorkTimePost(userIdFromStorage);
      } catch (error) {
        console.error('データロードエラー:', error);
      }
    };
    
    loadData();
  }, [groupId]);
  
  // 今日の作業時間投稿を確認
  const checkTodayWorkTimePost = async (userId: string) => {
    try {
      const dbUtil = DBUtil.getInstance();
      await dbUtil.initDB();
      
      // 今日の日付を取得
      const today = new Date();
      const dateStr = `${today.getFullYear()} / ${today.getMonth() + 1} / ${today.getDate()}`;
      
      // 今日の作業時間投稿を検索
      const posts = await dbUtil.getAll<any>(STORES.POSTS);
      const todayWorkPost = posts.find(post => 
        post.userId === userId &&
        post.groupId === groupId &&
        post.isWorkTimePost &&
        post.time.startsWith(dateStr) &&
        !post.checkOutTime
      );
      
      if (todayWorkPost) {
        setIsCheckedIn(true);
        setCheckInPostId(todayWorkPost.id);
      } else {
        setIsCheckedIn(false);
        setCheckInPostId(null);
      }
    } catch (error) {
      console.error('作業時間投稿の確認エラー:', error);
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
    
    // 現在のURLパラメータを取得
    const from = searchParams.get('from');
    const postId = searchParams.get('postId');
    
    // デバッグ用 - ここを追加
    console.log('=== handleTabChange実行 ===');
    console.log('tab:', tab);
    console.log('from:', from);
    console.log('postId:', postId);
    
    // URLパラメータを保持したまま遷移
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (postId) params.set('postId', postId);
    const paramString = params.toString() ? `?${params.toString()}` : '';
    
    // デバッグ用 - ここを追加
    console.log('paramString:', paramString);
    
    switch(tab) {
      case 'post':
        console.log('遷移先:', `/group/${groupId}/post${paramString}`);
        navigate(`/group/${groupId}/post${paramString}`);
        break;
      case 'history':
        console.log('遷移先:', `/group/${groupId}/archive${paramString}`);
        navigate(`/group/${groupId}/archive${paramString}`);
        break;
      case 'members':
        console.log('遷移先:', `/group/${groupId}/members${paramString}`);
        navigate(`/group/${groupId}/members${paramString}`);
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

  
  // チェックイン・チェックアウト処理（修正版）
  const handleCheckInOut = async () => {
    if (!groupId || !userId) return;
    
    try {
      const dbUtil = DBUtil.getInstance();
      await dbUtil.initDB();
      
      const now = new Date();
      const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
      const weekday = weekdays[now.getDay()];
      const date = `${now.getFullYear()} / ${now.getMonth() + 1} / ${now.getDate()}（${weekday}）`;
      const time = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      
      if (!isCheckedIn) {
        // チェックイン処理
        const newPost = {
          id: `worktime_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          message: `作業開始: ${time}`,
          time: `${date}　${time}`,
          photoUrls: [],
          tags: ["#出退勤時間"],
          userId: userId,
          username: username,
          groupId: groupId,
          timestamp: Date.now(),
          isWorkTimePost: true, // 作業時間投稿フラグ
          checkOutTime: null    // チェックアウト時間（null で初期化）
        };

        
        // 投稿を保存
        await dbUtil.save(STORES.POSTS, newPost);
        
        // 状態を更新
        setIsCheckedIn(true);
        setCheckInPostId(newPost.id);
        
        // 成功メッセージ
        alert(`✅ 作業開始を記録しました (${time})`);
        
        // アーカイブページには移動しない
        // navigate(`/group/${groupId}/archive`);
      } else {
        // チェックアウト処理
        if (checkInPostId) {
          const originalPost = await dbUtil.get<any>(STORES.POSTS, checkInPostId);
          
          if (originalPost) {
            // 元の作業開始時間を取得
            const checkInTimeMatch = originalPost.message.match(/作業開始: (\d{2}:\d{2})/);
            const checkInTime = checkInTimeMatch ? checkInTimeMatch[1] : "不明";
            
            // 作業時間を計算
            const checkInDate = parseDateString(originalPost.time);
            const duration = Math.floor((Date.now() - checkInDate.getTime()) / 1000 / 60); // 分単位
            const hours = Math.floor(duration / 60);
            const minutes = duration % 60;
            
            // 投稿内容を更新
            const updatedPost = {
              ...originalPost,
              message: `作業時間: ${checkInTime} - ${time} (${hours}時間${minutes}分)`,
              checkOutTime: now.getTime()
            };
            
            // 投稿を更新
            await dbUtil.save(STORES.POSTS, updatedPost);
            
            // 状態を更新
            setIsCheckedIn(false);
            setCheckInPostId(null);
            
            // 成功メッセージ
            alert(`✅ 作業終了を記録しました (${time})\n作業時間: ${hours}時間${minutes}分`);
            
            // アーカイブページには移動しない
            // navigate(`/group/${groupId}/archive`);
          }
        }
      }
    } catch (error) {
      console.error('作業時間記録エラー:', error);
      alert('作業時間の記録に失敗しました');
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

  // 上部の背景高さを調整
  const backgroundHeight = nameTruncated ? '72%' : '67%';
  const bottomBackgroundTop = nameTruncated ? '72%' : '67%';
  
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
          position: 'absolute', 
          top: '20px', 
          left: '20px', 
          zIndex: 10, 
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
          position: 'absolute', 
          top: '20px', 
          right: '20px', 
          zIndex: 10, 
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
      
      {/* グループアイコンと名前 */}
      <div
        style={{
          position: 'absolute',
          bottom: '120px',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          zIndex: 1,
          width: '70%',
          maxWidth: '250px',
        }}
      >
        {/* グループアイコン (正円) */}
        <div
          style={{
            width: '150px',
            height: '150px',
            borderRadius: '50%',
            backgroundImage: 'url(https://placehold.jp//ffffff/400x400.png?text=Group)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            marginBottom: '10px',
            border: '4px solid white',
            boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
          }}
        />
        
        {/* グループ名 */}
        <h1
          ref={groupNameRef}
          style={groupNameStyle}
        >
          {group.name}
        </h1>
        
        {/* チェックイン・チェックアウトボタン */}
        <button
          onClick={handleCheckInOut}
          style={{
            backgroundColor: isCheckedIn ? '#F6C8A6' : '#F0DB4F',
            color: '#055A68',
            border: 'none',
            borderRadius: '30px',
            padding: '12px 30px',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            boxShadow: '0 4px 10px rgba(0, 0, 0, 0.1)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '0px',
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
          {/* アイコン */}
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
              // チェックアウトアイコン
              <>
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <line x1="9" y1="9" x2="15" y2="15" />
                <line x1="15" y1="9" x2="9" y2="15" />
              </>
            ) : (
              // チェックインアイコン
              <>
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <path d="M9 12l2 2 4-4" />
              </>
            )}
          </svg>
          {isCheckedIn ? 'Check-out' : 'Check-in'}
        </button>
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