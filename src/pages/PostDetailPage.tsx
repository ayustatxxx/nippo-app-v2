// /pages/PostDetailPage.tsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import Header from '../components/Header';
import MainFooterNav from '../components/MainFooterNav';
import { getGroupPosts } from '../utils/firestoreService';
import { Post, Group, Memo } from '../types';
import MemoModal, { MemoDisplay } from '../components/MemoModal';
import ImageGalleryModal from '../components/ImageGalleryModal';
import { isAdmin } from '../utils/authUtil';
import { PostService } from '../utils/postService';
import { MemoService } from '../utils/memoService';
import { getUser } from '../firebase/firestore';
import { UserGroupResolver } from '../utils/userGroupResolver';
import { DisplayNameResolver } from '../utils/displayNameResolver';



// ★ここに追加★
const MY_IMAGE_BASE_URL = 'https://ayustatxxx.github.io/my-construction-images/images/';

const MY_IMAGES = [
  `${MY_IMAGE_BASE_URL}construction1.jpg`,
  `${MY_IMAGE_BASE_URL}construction2.jpg`,
  `${MY_IMAGE_BASE_URL}construction3.jpg`,
  `${MY_IMAGE_BASE_URL}construction4.jpg`,
  `${MY_IMAGE_BASE_URL}construction5.jpg`,
  `${MY_IMAGE_BASE_URL}construction6.jpg`,
  `${MY_IMAGE_BASE_URL}construction7.jpg`,
  `${MY_IMAGE_BASE_URL}construction8.jpg`,
  `${MY_IMAGE_BASE_URL}construction9.jpg`,
  `${MY_IMAGE_BASE_URL}construction10.jpg`,
  `${MY_IMAGE_BASE_URL}construction11.jpg`,
  `${MY_IMAGE_BASE_URL}construction12.jpg`,
  `${MY_IMAGE_BASE_URL}construction13.jpg`,
  `${MY_IMAGE_BASE_URL}construction14.jpg`,
];




const PostDetailPage: React.FC = () => {
  const { postId } = useParams<{ postId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams(); // ←この行を追加
  
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [galleryOpen, setGalleryOpen] = useState(false);
const [galleryIndex, setGalleryIndex] = useState(0);

const [memos, setMemos] = useState<Memo[]>([]);
const [isMemosLoading, setIsMemosLoading] = useState(false);
const [isMemoModalOpen, setIsMemoModalOpen] = useState(false);
const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
const [userIsAdmin, setUserIsAdmin] = useState(false); 
const [galleryImages, setGalleryImages] = useState<string[]>([]);



// メモを取得する関数
const fetchMemos = async (postId: string) => {
  try {
    setIsMemosLoading(true);
    const postMemos = await MemoService.getPostMemos(postId);
    setMemos(postMemos);
  } catch (error) {
    console.error('メモの取得に失敗:', error);
  } finally {
    setIsMemosLoading(false);
  }
};


// メモを保存する関数
const handleSaveMemo = async (memoData: Omit<Memo, 'id' | 'createdAt' | 'createdBy' | 'createdByName' | 'postId'>) => {
  try {
    const currentUserId = localStorage.getItem("daily-report-user-id") || "admin_user";
    
      // ✅ DisplayNameResolverを使用
    const currentUser = await getUser(currentUserId);
    const currentUsername = currentUser ? DisplayNameResolver.resolve(currentUser) : "ユーザー";


   

    const newMemo: Memo = {
      ...memoData,
      id: `memo_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      postId: postId!,
      createdAt: Date.now(),
      createdBy: currentUserId,
      createdByName: currentUsername
    };

    console.log('💾 [デバッグ] 保存するメモデータ:', newMemo);

    await MemoService.saveMemo(newMemo);
    
    console.log('✅ [デバッグ] メモが正常に保存されました');
    
    // メモ一覧を更新
    await fetchMemos(postId!);
    
    alert('✅ メモを追加しました！');
  } catch (error) {
    console.error('❌ [デバッグ] メモの保存に失敗:', error);
    alert('メモの保存に失敗しました');
  }
};
  
// ステータス更新処理
// ステータス更新処理
const handleStatusUpdate = async (newStatus: string) => {
  if (!post) return;
  
  try {
    const currentUserId = localStorage.getItem("daily-report-user-id") || "admin_user";
    // ✅ DisplayNameResolverを使用
    const currentUser = await getUser(currentUserId);
    const currentUsername = currentUser ? DisplayNameResolver.resolve(currentUser) : "ユーザー";
    
    const updatedPost = {
      ...post,
      status: newStatus as '未確認' | '確認済み',
      statusUpdatedAt: Date.now(),
      statusUpdatedBy: currentUserId,
      statusUpdatedByName: currentUsername
    };
    
    console.log('📊 [デバッグ] ステータス更新:', newStatus);
    
    await PostService.updatePostStatus(post.id, newStatus, currentUserId, currentUsername);
    
    setPost(updatedPost);
    setIsStatusModalOpen(false);
    
    // ★ ステータス変更時に検索パラメータをクリア ★
    const from = searchParams.get('from');
    const groupId = searchParams.get('groupId');
    const postId = searchParams.get('postId');
    
    if (from === 'archive' && groupId) {
      // 検索パラメータをクリアしてArchiveに戻る
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (postId) params.set('postId', postId);
      // searchQuery, startDate, endDate は追加しない
      
      const paramString = params.toString() ? `?${params.toString()}` : '';
      
      // 少し遅延してからページ遷移（ユーザーが更新メッセージを確認できるように）
      setTimeout(() => {
        navigate(`/group/${groupId}/archive${paramString}`);
      }, 1000);
    }
    
    alert(`✅ ステータスを「${newStatus}」に更新しました`);
  } catch (error) {
    console.error('❌ [デバッグ] ステータス更新に失敗:', error);
    alert('ステータスの更新に失敗しました');
  }
};

  useEffect(() => {
    const fetchPostDetails = async () => {
      if (!postId) {
        setError('投稿IDが見つかりません');
        setLoading(false);
        return;
      }
      
      try {
  setLoading(true);
  
  // UserGroupResolverを使用した動的検索
  const currentUserId = localStorage.getItem("daily-report-user-id") || "";
  
  console.log('🔍 [PostDetailPage] 動的投稿検索開始:', postId);
  
  // ハードコーディング完全排除: 動的投稿検索
  const postData = await UserGroupResolver.findPostInUserGroups(postId, currentUserId);
  
  if (postData) {
    console.log('✅ [PostDetailPage] 投稿発見:', postData.groupName);
    setPost(postData);
    
    // ユーザー情報を取得して会社名・役職を補完
    const fetchUserInfo = async () => {
      try {
        const userInfo = await getUser(postData.userId);
        if (userInfo && userInfo.company) {
          setPost(prevPost => ({
            ...prevPost,
            company: userInfo.company || '会社名なし',
            position: userInfo.position || '役職なし'
          }));
        }
      } catch (error) {
        console.error('ユーザー情報取得エラー:', error);
      }
    };
    
    fetchUserInfo();
  } else {
    console.log('❌ [PostDetailPage] 投稿未発見:', postId);
    setError('指定された投稿が見つかりません');
  }
  
} catch (fetchError) {
  console.error('❌ [PostDetailPage] 投稿検索エラー:', fetchError);
  setError('投稿データの読み込みに失敗しました');
} finally {
  setLoading(false);
}

      
      // 投稿データ取得後にメモも取得
     if (postId) {
     await fetchMemos(postId);
   }
    };

    // 管理者権限をチェック
    const checkAdminRole = async () => {
      const adminStatus = await isAdmin();
      setUserIsAdmin(adminStatus);
    };

    // 両方の関数を実行
    fetchPostDetails();
    checkAdminRole();

    // ページを開いた時に一番上にスクロールする
    window.scrollTo(0, 0);
  }, [postId]);


  // ★ 新しいuseEffectを追加（投稿データ変更時の初期化） ★
  useEffect(() => {
    if (post && post.photoUrls && post.photoUrls.length > 0) {
      setGalleryImages(post.photoUrls);
      console.log('✅ PostDetail画像初期化:', post.photoUrls.length);
    }
  }, [post]);

  
  // 日付と時間を分割する関数
  const extractDateTime = (dateTimeStr: string): { date: string, time: string } => {
    const parts = dateTimeStr.split('　');
    return {
      date: parts[0] || '',
      time: parts[1] || ''
    };
  };
  

 // 他のユーザーが既読したかチェック（編集制限）
  const hasOthersRead = (post: Post): boolean => {
    const currentUserId = localStorage.getItem("daily-report-user-id");
    
    // readByオブジェクトから自分以外のユーザーが既読したかチェック
    if (post.readBy && typeof post.readBy === 'object') {
      const readers = Object.keys(post.readBy);
      const othersRead = readers.some(userId => userId !== currentUserId);
      
      console.log('🔍 既読チェック:', {
        readers,
        currentUserId,
        othersRead
      });
      
      return othersRead;
    }
    
    return false;
  };

  // 削除期限をチェック（24時間制限）
  const isDeleteExpired = (post: Post): boolean => {
    const postTime = new Date(post.timestamp || Date.now());
    const now = new Date();
    const hoursDiff = (now.getTime() - postTime.getTime()) / (1000 * 60 * 60);
    
    console.log('🔍 削除期限チェック:', {
      hoursDiff: hoursDiff.toFixed(1),
      isExpired: hoursDiff > 24
    });
    
    return hoursDiff > 24; // 24時間を超えたら削除不可
  };

  // メモボタンのハンドラー
  const handleMemoClick = (postId: string) => {
    alert(`投稿 ${postId} のメモ機能は準備中です`);
  };

  // 編集ボタンのハンドラー
  const handleEditClick = (postId: string) => {
    const from = searchParams.get('from');
    const groupId = searchParams.get('groupId');
    
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (groupId) params.set('groupId', groupId);
    const paramString = params.toString() ? `?${params.toString()}` : '';
    
    navigate(`/edit-post/${postId}${paramString}`);
  };

  // 削除ボタンのハンドラー
  const handleDeleteClick = async (postId: string) => {
    if (!window.confirm('この投稿を削除してもよろしいですか？')) {
      return;
    }
  
    try {
     // 削除機能は一時的に無効化（PostServiceで後日実装）
console.log('削除機能は準備中です');
      alert('✅ 投稿を削除しました');
      
      // 来た元のページに適切に戻る
      const from = searchParams.get('from');
      const groupId = searchParams.get('groupId');
      
      if (from === 'archive' && groupId) {
        // アーカイブから来た場合はアーカイブに戻る
        navigate(`/group/${groupId}/archive`);
      } else {
        // その他の場合はHomeに戻る
        navigate('/');
      }
    } catch (error) {
      console.error('投稿の削除に失敗しました', error);
      alert('投稿の削除に失敗しました');
    }
  };
  
  // グループページへの遷移
  const handleGroupClick = () => {
    if (post && post.groupId) {
      navigate(`/group/${post.groupId}?from=post-detail&postId=${post.id}`);
    }
  };
  
// ステータスバッジのスタイルを取得
const getStatusStyle = (status: string) => {
  const baseStyle = {
    padding: '0.5rem 1rem',
    borderRadius: '20px',
    fontSize: '0.9rem',
    fontWeight: '600',
    display: 'inline-block',
  };
  
  switch (status) {
    case '確認済み':
      return { 
        ...baseStyle, 
        backgroundColor: '#1f5b91', 
        color: 'white' 
      };
    case '未確認':
    default:
      return { 
        ...baseStyle, 
        backgroundColor: '#ff6b6b', // 赤色
        color: 'white' // 白文字
      };
  }
};

// ステータス選択モーダル用（大きいサイズ）
const getModalStatusStyle = (status: string) => {
  const baseStyle = {
    padding: '0.8rem 0.8rem',    // ← 大きいサイズ
    borderRadius: '15px',
    fontSize: '0.9rem',          // ← 大きい文字
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'opacity 0.2s',
    border: 'none',
    outline: 'none'
  };
  
  switch (status) {
    case '確認済み':
      return { 
        ...baseStyle, 
        backgroundColor: '#1f5b91',
        color: 'white'
      };
    case '未確認':
    default:
      return { 
        ...baseStyle, 
        backgroundColor: '#ff6b6b',
        color: 'white'
      };
  }
};
  

// ステータス選択モーダル
const StatusModal: React.FC<{ 
  isOpen: boolean; 
  onClose: () => void; 
  onSelect: (status: string) => void;
  currentStatus: string;
}> = ({ isOpen, onClose, onSelect, currentStatus }) => {
  if (!isOpen) return null;
  
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '20px',
          width: '100%',
          maxWidth: '320px',
          padding: '1.5rem',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{
          margin: '0 0 1.5rem 0',
          color: '#055A68',
          fontSize: '1.2rem',
          fontWeight: '600',
          textAlign: 'center'
        }}>
          ステータスを選択
        </h3>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
          {['未確認', '確認済み'].map(status => (
            <button
              key={status}
              onClick={() => onSelect(status)}
              style={{
                ...getModalStatusStyle(status),
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'all 0.2s',
                width: '100%',
                // ★ この行を追加 ★
                opacity: currentStatus === status ? 0.5 : 1
              }}
              onMouseEnter={(e) => e.currentTarget.style.opacity = '0.6'}
              onMouseLeave={(e) => {
                // ★ この部分を修正 ★
                e.currentTarget.style.opacity = currentStatus === status ? '0.5' : '1';
              }}
            >
              {status}
            </button>
          ))}
        </div>
        
        <button
          onClick={onClose}
          style={{
            width: '100%',
            marginTop: '1.5rem',
            padding: '0.7rem',
            backgroundColor: '#d6d6d6',
            color: 'black',
            border: 'none',
            borderRadius: '15px',
            fontSize: '0.9rem',
            cursor: 'pointer'
          }}
        >
          キャンセル
        </button>
      </div>
    </div>
  );
};


  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: '#f5f5f5',
      paddingBottom: '80px' // フッターの高さ分
    }}>

      {/* ヘッダー */}
      // PostDetailPage.tsx のヘッダー部分の onBackClick を以下に修正

<Header 
  title="投稿詳細"
  showBackButton={true}
  onBackClick={() => {
    const from = searchParams.get('from');
    const groupId = searchParams.get('groupId');
    const postId = searchParams.get('postId');
    
    // 戻り先ページの即座スクロール復元用フラグを設定
const handleBack = () => {
  const savedPosition = sessionStorage.getItem('homeScrollPosition');
  if (savedPosition) {
    sessionStorage.setItem('restoreScrollImmediately', savedPosition);
  }
  navigate(-1);
};
    
    const searchQuery = searchParams.get('searchQuery');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    
    if (from === 'archive' && groupId) {
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (postId) params.set('postId', postId);
      
      const isStatusSearch = searchQuery && (searchQuery.includes('未確認') || searchQuery.includes('確認済み'));
      
      if (!isStatusSearch) {
        if (searchQuery) params.set('searchQuery', searchQuery);
        if (startDate) params.set('startDate', startDate);
        if (endDate) params.set('endDate', endDate);
      }
      
      const paramString = params.toString() ? `?${params.toString()}` : '';
      navigate(`/group/${groupId}/archive${paramString}`);
    } else {
      navigate('/');
    }
  }}
/>
      
      <div style={{ 
        maxWidth: '480px', 
        margin: '0 auto',
        padding: '1rem',
        paddingTop: '70px', // ヘッダーの高さ分
      }}>
        {loading && (
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            padding: '2rem' 
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              border: '3px solid rgba(5, 90, 104, 0.1)',
              borderTopColor: '#055A68',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }}></div>
            <style>{`
              @keyframes spin {
                to { transform: rotate(360deg); }
              }
            `}</style>
          </div>
        )}
        
        {error && (
          <div style={{
            backgroundColor: '#ffeeee',
            color: '#d32f2f',
            padding: '1rem',
            borderRadius: '8px',
            margin: '1rem 0'
          }}>
            {error}
          </div>
        )}
        
        {post && (
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            overflow: 'hidden',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
            margin: '0.5rem 0 1.5rem 0'
          }}>
            <div style={{
  padding: '1rem',
  borderBottom: '1px solid #f0f0f0',
  display: 'flex',
  alignItems: 'flex-start', // 「center」から「flex-start」に変更 
  gap: '1rem' // 間隔を追加
}}>
  {/* アバター部分 */}
  <div style={{
    width: '50px', // サイズを大きく
    height: '50px', // サイズを大きく
    borderRadius: '50%',
    backgroundColor: 'rgba(5, 90, 104, 0.1)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center'
  }}>
    <svg 
      width="30" // アイコンサイズを大きく
      height="30" // アイコンサイズを大きく
      viewBox="0 0 24 24" 
      fill="#055A68" 
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M12 12C14.21 12 16 10.21 16 8C16 5.79 14.21 4 12 4C9.79 4 8 5.79 8 8C8 10.21 9.79 12 12 12ZM12 14C9.33 14 4 15.34 4 18V20H20V18C20 15.34 14.67 14 12 14Z" />
    </svg>
  </div>
  
  {/* ユーザー情報（名前、役職・会社名） */}
  <div style={{ flex: 1 }}>
    <div style={{ 
      fontWeight: 'bold', 
      color: '#055A68', 
      fontSize: '1.1rem',
      marginBottom: '0.2rem' // 名前の下に余白を追加
    }}>
      {post.username || 'ユーザー'}
    </div>
    <div style={{ 
      color: '#666', 
      fontSize: '0.85rem' 
    }}>
      {/* 役職・会社名 - ダミーデータもしくは実際のデータを表示 */}
      {post.position || '役職なし'} • {post.company || '会社名なし'}
    </div>
  </div>
  
  {/* 日時表示 - 1つのブロックとして表示 */}
  <div style={{ 
  padding: '0.4rem 0.8rem',
  borderRadius: '8px',
  color: '#055A68',
  fontSize: '0.85rem',
  fontWeight: '500',
  display: 'flex',
  flexDirection: 'row',  // ←column から row に変更
  alignItems: 'flex-end',
  gap: '0.0rem'  // ←この行を追加（日付と時間の間にスペース）
}}>
    <div>{extractDateTime(post.time).date}</div>
    <div>{extractDateTime(post.time).time}</div>
  </div>
</div>
            
            {/* グループ情報 - アーカイブから来た場合はクリック不可 */}
            <div 
              style={{
                padding: '0.6rem 1rem',
                backgroundColor: 'rgba(5, 90, 104, 0.05)',
                color: '#055A68',
                fontSize: '0.9rem',
                fontWeight: '500',
                cursor: searchParams.get('from') === 'archive' ? 'default' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid #f0f0f0'
              }}
              onClick={searchParams.get('from') === 'archive' ? undefined : handleGroupClick}
            >
              <span>{post.groupName || 'グループ'}</span>
              {/* アーカイブから来た場合は矢印を非表示 */}
              {searchParams.get('from') !== 'archive' && (
                <svg 
                  width="16" 
                  height="16" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="#055A68"
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                >
                  <path d="M9 18l6-6-6-6" />
                </svg>
              )}
            </div>

            
            
            {/* 投稿内容 */}
            <div style={{ padding: '1.2rem' }}>
              
              {/* メッセージ */}
{post.message && (
  <div style={{
    whiteSpace: 'pre-wrap',
    lineHeight: '1.6',
    color: '#333',
    fontSize: '1rem',
    marginBottom: '1.5rem'
  }}>
  {post.message}
{(() => {
  console.log('🔍 [編集済み判定]', {
    isEdited: post.isEdited,
    tags: post.tags,
    has出退勤: post.tags?.includes('#出退勤時間'),
    hasチェックイン: post.tags?.includes('#チェックイン'),
    hasチェックアウト: post.tags?.includes('#チェックアウト'),
  });
  return null;
})()}
{post.isEdited && !(
  post.tags?.includes('#出退勤時間') && 
  post.tags?.includes('#チェックイン') && 
  post.tags?.includes('#チェックアウト')
) && (
  <span style={{
    color: '⬜rgba(5, 90, 104, 0.7)',
    fontSize: '0.85rem',
    marginLeft: '0.5rem'
  }}>
    （編集済み）
  </span>
)}
  </div>
)}

{/* メッセージがない場合の編集済み表示 */}
{!post.message && post.isEdited && !(
  post.tags?.includes('#出退勤時間') && 
  post.tags?.includes('#チェックイン') && 
  post.tags?.includes('#チェックアウト')
) && (
  <div style={{
    whiteSpace: 'pre-wrap',
    lineHeight: '1.6',
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: '0.85rem',
    marginBottom: '1.5rem',
    fontStyle: 'italic'
  }}>
    （編集済み）
  </div>
)}
              
              {/* タグ */}
              {post.tags && post.tags.length > 0 && (
                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                  marginBottom: '1.5rem'
                }}>
                  {post.tags.map((tag, index) => (
                    <span
                      key={index}
                      style={{
                        backgroundColor: 'rgba(5, 90, 104, 0.08)',
                        color: '#055A68',
                        padding: '0.3rem 0.7rem',
                        borderRadius: '999px',
                        fontSize: '0.8rem',
                        fontWeight: '600'
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}


 
              
            {/* 画像 */}
              {(() => {
                // post.photoUrls と post.images を統合
                const allImages = [
                  ...(post.photoUrls || []),
                  ...(post.images || [])
                ].filter((url, index, self) => 
                  url && self.indexOf(url) === index // 重複削除
                );
                
                // デバッグ用ログ
                console.log('📸 PostDetail画像統合:', {
                  photoUrls: post.photoUrls?.length || 0,
                  images: post.images?.length || 0,
                  total: allImages.length
                });
                
                // 画像が存在しない場合は何も表示しない
                if (allImages.length === 0) return null;
                
                // 画像を表示
                return (
                  <div style={{
                    marginTop: '1rem',
                    display: 'grid',
                    gridTemplateColumns: allImages.length === 1 ? '1fr' : 
                                        allImages.length === 2 ? '1fr 1fr' : 
                                        'repeat(3, 1fr)',
                    gap: '0.5rem'
                  }}>
                    {allImages.map((url, index) => (
                      <div
                        key={index}
                        style={{
                          aspectRatio: '1 / 1',
                          overflow: 'hidden',
                          borderRadius: '8px',
                          backgroundColor: '#f8f8f8',
                          cursor: 'pointer'
                        }}
                        onClick={() => {
                          if (!allImages || allImages.length === 0) {
                            console.warn('⚠️ 画像データが不完全');
                            return;
                          }
                          
                          const imageIndex = allImages.findIndex(photoUrl => photoUrl === url);
                          setGalleryImages(allImages);
                          setGalleryIndex(imageIndex);
                          setGalleryOpen(true);
                          
                          console.log('✅ 画像ギャラリー起動:', {
                            imageIndex,
                            totalImages: allImages.length
                          });
                        }}
                      >
                        <img
                          src={url}
                          alt={`投稿画像 ${index + 1}`}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover'
                          }}
                        />
                      </div>
                    ))}
                  </div>
                );
              })()}
              
             {/* メモセクション */}
             {memos.length > 0 && (
                <div style={{ marginTop: '3rem' }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    marginBottom: '1rem',
                    gap: '0.5rem'
                  }}>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#055A68"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                    <h4 style={{
                      margin: 0,
                      color: '#055A68',
                      fontSize: '0.9rem',
                      fontWeight: '600'
                    }}>
                      メモ ({memos.length})
                    </h4>
                  </div>
                  
                  {memos.map((memo) => (
                    <MemoDisplay key={memo.id} memo={memo} />
                  ))}
                </div>
              )}

               {/* ステータス表示セクション - 投稿者以外にのみ表示 */}
{!post.isWorkTimePost && post.userId !== localStorage.getItem("daily-report-user-id") && (
  <div style={{ marginTop: '3rem' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  marginBottom: '1rem',
                  gap: '0.5rem'
                }}>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#055A68"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h4 style={{
                    margin: 0,
                    color: '#055A68',
                    fontSize: '0.9rem',
                    fontWeight: '600'
                  }}>
                    ステータス
                  </h4>
                </div>
                
                <div style={{
  padding: '0',
  marginBottom: '0.5rem'
}}>
  <span 
  style={{
    ...getStatusStyle(post?.status || '未確認'),
    cursor: post.userId !== localStorage.getItem("daily-report-user-id") ? 'pointer' : 'default',
    transition: 'opacity 0.2s'
  }}
  onClick={post.userId !== localStorage.getItem("daily-report-user-id") ? () => setIsStatusModalOpen(true) : undefined}
  onMouseEnter={post.userId !== localStorage.getItem("daily-report-user-id") ? (e) => e.currentTarget.style.opacity = '0.8' : undefined}
  onMouseLeave={post.userId !== localStorage.getItem("daily-report-user-id") ? (e) => e.currentTarget.style.opacity = '1' : undefined}
>
  {post?.status || '未確認'}
</span>
</div>


                
                {/* ステータス更新情報 */}
                {post && post.statusUpdatedAt && (
                  <div style={{
                    fontSize: '0.75rem',
                    color: '#666',
                    marginTop: '0.5rem'
                  }}>
                    最終更新: {new Date(post.statusUpdatedAt).toLocaleString('ja-JP')} 
                    {post.statusUpdatedByName && ` by ${post.statusUpdatedByName}`}
                  </div>
                )}
              </div>
               )}


              {/* アクションボタン */}
              <div style={{
                marginTop: '2rem',
                paddingTop: '1rem',
                borderTop: '1px solid #f0f0f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '1rem'
              }}>
               {/* 左側 - メモ機能（全ユーザー利用可能） */}
<div style={{ display: 'flex', gap: '0.8rem' }}>
  <button
  onClick={() => setIsMemoModalOpen(true)}
  style={{
    padding: '0.5rem 1.2rem',
    backgroundColor: 'rgb(0, 102, 114)',
    color: '#F0DB4F',
    border: 'none',
    borderRadius: '20px',
    fontSize: '0.9rem',
    cursor: 'pointer',
    fontWeight: 'bold'
  }}
>
  メモ
</button>
</div>

{/* 右側 - 編集・削除ボタン（簡易版テスト） */}
<div style={{ display: 'flex', gap: '0.8rem' }}>
  {post.userId === localStorage.getItem("daily-report-user-id") && (
    <button
      onClick={() => {
        alert('編集ボタンが押されました');
        handleEditClick(post.id);
      }}
      style={{
        padding: '0.5rem 1.2rem',
        backgroundColor: 'rgb(0, 102, 114)',
        color: '#F0DB4F',
        border: 'none',
        borderRadius: '20px',
        fontSize: '0.9rem',
        cursor: 'pointer',
        fontWeight: 'bold'
      }}
    >
      編集
    </button>
  )}
  
  {post.userId === localStorage.getItem("daily-report-user-id") && (
    <button
      onClick={() => {
        alert('削除ボタンが押されました');
        handleDeleteClick(post.id);
      }}
      style={{
        padding: '0.5rem 1.2rem',
        backgroundColor: 'rgb(0, 102, 114)',
        color: '#F0DB4F',
        border: 'none',
        borderRadius: '20px',
        fontSize: '0.9rem',
        cursor: 'pointer',
        fontWeight: 'bold'
      }}
    >
      削除
    </button>
  )}
</div>
              </div>
              
            </div>
          </div>
        )}
      </div>
      
      {/* 画像ギャラリーモーダル */}
      {galleryOpen && (
  <ImageGalleryModal
    key={`gallery-${post?.id}-${galleryIndex}-${Date.now()}`}
    images={galleryImages}
    initialIndex={galleryIndex}
    isOpen={galleryOpen}
    onClose={() => {
      setGalleryOpen(false);
      setGalleryImages([]); // 追加：状態をクリア
    }}
  />
)}


    {/* メモ追加モーダル */}
<MemoModal
  isOpen={isMemoModalOpen}
  onClose={() => setIsMemoModalOpen(false)}
  onSave={handleSaveMemo}
  postId={postId!}
/>

    {/* ステータス変更モーダル */}
<StatusModal
  isOpen={isStatusModalOpen}
  onClose={() => setIsStatusModalOpen(false)}
  onSelect={handleStatusUpdate}
  currentStatus={post?.status || '未確認'}
/>
    
    </div>
  );
};

export default PostDetailPage;