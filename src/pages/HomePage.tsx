import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import MainFooterNav from '../components/MainFooterNav';
import Header from '../components/Header';
import { Group, User } from '../types';
import { getGroupPosts, markPostAsRead, getPostReadStatus } from "../utils/firestoreService";
import { Post } from '../types';
import ImageGalleryModal from '../components/ImageGalleryModal';
import { getCurrentUser, isAdmin, getUserRole, getUserDisplayName } from '../utils/authUtil';
import { DisplayNameResolver } from '../utils/displayNameResolver';
import { UnifiedDataManager } from '../utils/unifiedDataManager';
import { getDisplayNameSafe, getDisplayNamesBatch } from '../core/SafeUnifiedDataManager';
import { getUser, getPostImages } from '../firebase/firestore';
import MemoModal from '../components/MemoModal';
import ReadByModal from '../components/ReadByModal';
import { MemoService } from '../utils/memoService'; 
import UnifiedCoreSystem from "../core/UnifiedCoreSystem";
import { linkifyText } from '../utils/urlUtils';

// ⭐ バナーフェードインアニメーション定義 ⭐
if (typeof document !== 'undefined') {
  const styleId = 'banner-fade-in-animation';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      @keyframes fadeIn {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
    `;
    document.head.appendChild(style);
  }
}

// 🔸 新着バナー用：「最後に見た時刻」を保存・読み込みするためのキー
const LAST_VIEWED_KEY_PREFIX = 'homepage-last-viewed-';

const getLastViewedKey = (userId: string) =>
  `${LAST_VIEWED_KEY_PREFIX}${userId}`;

// 「最後に見た時刻」を保存
const saveLastViewedTimestamp = (userId: string, latestMs: number) => {
  if (!Number.isFinite(latestMs) || latestMs <= 0) return;

  const key = getLastViewedKey(userId);
  localStorage.setItem(key, String(latestMs));
  console.log('[新着保存] lastViewedTimestamp を保存しました', {
    key,
    value: latestMs,
  });
};

// 「最後に見た時刻」を読み込み
const loadLastViewedTimestamp = (userId: string): number | null => {
  const key = getLastViewedKey(userId);
  const raw = localStorage.getItem(key);
  if (!raw) return null;

  const ms = Number(raw);
  if (!Number.isFinite(ms) || ms <= 0) {
    console.warn('[新着チェック] Invalid な lastViewed を検出したのでリセットします', {
      key,
      raw,
    });
    localStorage.removeItem(key);
    return null;
  }
  return ms;
};

// 🆕 作業時間を計算する関数
  const calculateWorkDuration = (message: string): string | null => {
    const startTimeMatch = message.match(/作業開始:\s*(\d{2}):(\d{2})/);
    const endTimeMatch = message.match(/作業終了:\s*(\d{2}):(\d{2})/);
    
    if (!startTimeMatch || !endTimeMatch) {
      return null;
    }
    
    const startHour = parseInt(startTimeMatch[1]);
    const startMinute = parseInt(startTimeMatch[2]);
    const endHour = parseInt(endTimeMatch[1]);
    const endMinute = parseInt(endTimeMatch[2]);
    
    const startTotalMinutes = startHour * 60 + startMinute;
    let endTotalMinutes = endHour * 60 + endMinute;
    
    if (endTotalMinutes < startTotalMinutes) {
      endTotalMinutes += 24 * 60;
    }
    
    const durationMinutes = endTotalMinutes - startTotalMinutes;
    const hours = Math.floor(durationMinutes / 60);
    const minutes = durationMinutes % 60;
    
    return `${hours}時間${minutes}分`;
  };

// 🆕 メッセージから時刻情報を削除する関数
const removeTimeInfo = (message: string): string => {
  return message
    .replace(/作業開始:\s*\d{2}:\d{2}\n?/g, '')
    .replace(/作業終了:\s*\d{2}:\d{2}\n?/g, '')
    .replace(/日付:[^\n]+\n?/g, '')
    .trim();
};

// 🆕 時刻情報を抽出する関数
const extractTimeInfo = (message: string) => {
  const startTimeMatch = message.match(/作業開始:\s*(\d{2}:\d{2})/);
  const endTimeMatch = message.match(/作業終了:\s*(\d{2}:\d{2})/);
  const dateMatch = message.match(/日付:\s*(.+?)(?:\n|$)/);
  
  return {
    startTime: startTimeMatch?.[1] || null,
    endTime: endTimeMatch?.[1] || null,
    date: dateMatch?.[1] || null,
  };
};


// ★自分の画像用の設定を追加★
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

// アラート情報の型定義
interface AlertInfo {
  id: string;
  userId: string;
  username: string;
  groupId: string;
  groupName: string;
  deadline: string;
  timestamp: number;
  type: 'alert';
}  

// 議事録要約の型定義
interface MeetingSummary {
  id: string;
  docId: string;
  meetingTitle: string;
  meetingDate: any;
  status: 'draft' | 'published';
  groupId: string;
  groupName?: string;
  participants: string[];
  summary: {
    title: string;
    keyPoints: string[];
    decisions: string[];
  };
  actions: Array<{
    assignee: string;
    task: string;
    deadline: string;
    priority: string;
    exp: number;
  }>;
  createdAt: any;
  visibleTo: string[] | null;
  type: 'meeting_summary';
}

// タイムライン項目の共通型（投稿またはアラート）
type TimelineItem = Post | AlertInfo | MeetingSummary;  


// カードコンポーネント用のプロパティ
interface PostCardProps {
  post: Post;
  onViewDetails: (postId: string, groupId: string) => void;
  onImageClick: (imageUrl: string, allImages: string[], imageIndex: number) => void;  // ← imageIndex を追加
  navigate: (path: string) => void;
  onStatusUpdate: (postId: string, newStatus: string) => void;
  getContainerStatusStyle: (status: string) => any;
  userRole: 'admin' | 'user';
  onMemoClick: (post: Post) => void;
  onPlusButtonClick: (post: Post) => void;
}


// 未投稿アラートカード用のプロパティ
interface AlertCardProps {
  alert: AlertInfo;
  onContact: (groupId: string) => void;
  navigate: (path: string) => void;
}

// 議事録要約カード用のプロパティ
interface MeetingSummaryCardProps {
  summary: {
    id: string;
    docId: string;
    meetingTitle: string;
    meetingDate: any;
    status: 'draft' | 'published';
    groupId: string;
    groupName?: string;
    participants: string[];
    summary: {
      keyPoints: string[];
    };
    actions: Array<{
      assignee: string;
      task: string;
    }>;
  };
  onViewDetails: (summaryId: string) => void;
  navigate: (path: string) => void;
}

// PostCardコンポーネント
const PostCard: React.FC<PostCardProps> = ({ 
  post, 
  onViewDetails, 
  onImageClick, 
  navigate, 
  onStatusUpdate, 
  getContainerStatusStyle,
  userRole,
  onMemoClick,
  onPlusButtonClick  
}) => {
  const [selectedPostForStatus, setSelectedPostForStatus] = useState<string | null>(null); 
  const [authorDisplayName, setAuthorDisplayName] = useState<string>('読み込み中...');

  
  // 表示名を取得するuseEffect
useEffect(() => {
  const loadAuthorName = async () => {
    try {
      // firestoreService.tsで既に解決済みの表示名を優先使用
      if (post.username && post.username !== 'ユーザー' && post.username !== 'undefined') {
        setAuthorDisplayName(post.username);
        return;
      }
      
      const authorId = post.authorId || post.createdBy;
      if (authorId) {
        const name = await getDisplayNameSafe(authorId);
        setAuthorDisplayName(name);
      } else {
        setAuthorDisplayName('ユーザー');
      }
    } catch (error) {
      console.error('表示名取得エラー:', error);
      // フォールバック：firestoreService.tsで解決済みの名前を使用
      setAuthorDisplayName(post.username || 'ユーザー');
    }
  };

  loadAuthorName();
}, [post]);



  return (
    <div
      key={post.id}
      style={{
        backgroundColor: '#E6EDED',
        color: 'rgb(0, 102, 114)',
        borderRadius: '12px',
        padding: '1rem',
        marginBottom: '1rem',
        boxShadow: '0 4px 6px rgba(0, 102, 114, 0.1), 0 1px 3px rgba(0, 102, 114, 0.08)',
        border: '1px solid rgba(0, 102, 114, 0.1)',
        transition: 'box-shadow 0.3s ease',
      }}
    >
      {/* ヘッダー部分: 投稿者アイコン、名前、グループ名と時間 */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'flex-start',
        marginBottom: '0.8rem' 
      }}>
        {/* 投稿者名とアバター - 左側に配置 */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center'
        }}>
          <div style={{ 
            width: '32px', 
            height: '32px', 
            borderRadius: '50%', 
            backgroundColor: 'rgba(0, 102, 114, 0.1)',
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            marginRight: '0.5rem' 
          }}>
            <svg 
              width="18" 
              height="18" 
              viewBox="0 0 24 24" 
              fill="rgb(0, 102, 114)" 
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M12 12C14.21 12 16 10.21 16 8C16 5.79 14.21 4 12 4C9.79 4 8 5.79 8 8C8 10.21 9.79 12 12 12ZM12 14C9.33 14 4 15.34 4 18V20H20V18C20 15.34 14.67 14 12 14Z" />
            </svg>
          </div>
          
          <div style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>
            {authorDisplayName}
            </div>

        </div>
        
        {/* プロジェクト名と時間を縦に配置 - 右側に配置 */}
        <div style={{ 
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: '0.2rem'
        }}>
          {/* グループ名をクリック可能にして、グループTOPページに遷移 */}
          <div 
            style={{ 
              fontSize: '0.85rem', 
              color: '#055A68',
              cursor: 'pointer',
              textDecoration: 'none',
              transition: 'color 0.2s ease',
            }}
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/group/${post.groupId}?from=home&postId=${post.id}`);
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#033E4A';
              e.currentTarget.style.textDecoration = 'underline';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#055A68';
              e.currentTarget.style.textDecoration = 'none';
            }}
          >
            {post.groupName || 'グループ名なし'}
          </div>
          
          <div
            style={{
              fontWeight: '500',
              fontSize: '0.85rem',
              color: '#055A68',
            }}
          >
            {extractTime(post.time)}
          </div>
        </div>
      </div>
      
      {/* 区切り線 */}
      <div 
        style={{
          height: '1px',
          backgroundColor: 'rgba(0, 102, 114, 0.3)',
          marginBottom: '0.8rem',
        }}
      />

      {/* 投稿メッセージ - 120文字制限と「more」ボタン追加 */}
      {post.message && post.message.length > 0 && (
        <div
          style={{
            marginBottom: '0.8rem',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
            overflowWrap: 'break-word',
            lineHeight: '1.5',
            fontSize: '0.95rem',
            color: '#055A68',
          }}
        >
         {/* チェックイン投稿は整形表示、通常投稿は120文字制限 */}
         {post.tags?.includes('#チェックイン') ? (
  (() => {
    const timeInfo = extractTimeInfo(post.message || '');
    const cleanMessage = removeTimeInfo(post.message || '');
    const duration = post.tags?.includes('#チェックアウト') 
      ? calculateWorkDuration(post.message || '') 
      : null;
    
    return (
      <div>
      {(timeInfo.startTime || timeInfo.endTime) && (
  <div style={{ marginBottom: '0.5rem', color: '#055A68' }}>
    {timeInfo.startTime && `開始: ${timeInfo.startTime}`}
    {timeInfo.startTime && timeInfo.endTime && '  ー  '}
    {timeInfo.endTime && `終了: ${timeInfo.endTime}`}
  </div>
)}

{duration && (
  <>
    <div style={{ 
      borderTop: '1px solid rgba(5, 90, 104, 0.3)',
      width: '65%',
      margin: '0.5rem 0'
    }} />
    <div style={{ marginBottom: '0.5rem', color: '#055A68' }}>
     ■ 作業時間: {duration} 
    </div>
    <div style={{ 
      borderTop: '1px solid rgba(5, 90, 104, 0.3)',
      width: '65%',
      margin: '0.5rem 0'
    }} />
  </>
)}

        
        {cleanMessage && cleanMessage.length > 120 ? (
          <>
            {`${cleanMessage.substring(0, 120)}...`}
            {post.isEdited && (
              <span style={{
                color: 'rgba(5, 90, 104, 0.8)',
                fontSize: '0.8rem',
                marginLeft: '0.5rem'
              }}>
                （編集済み）
              </span>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onViewDetails(post.id, post.groupId);
              }}
              style={{
                background: 'none',
                border: 'none',
                color: '#055A68',
                fontWeight: 'bold',
                fontSize: '0.85rem',
                padding: '0.2rem 0',
                cursor: 'pointer',
                textDecoration: 'underline',
                marginTop: '0.3rem',
                display: 'block',
              }}
            >
              more
            </button>
          </>
        ) : cleanMessage ? (
          <>
            {linkifyText(cleanMessage)}
            {post.isEdited && (
              <span style={{
                color: 'rgba(5, 90, 104, 0.8)',
                fontSize: '0.8rem',
                marginLeft: '0.5rem'
              }}>
                （編集済み）
              </span>
            )}
          </>
        ) : null}
      </div>
    );
  })()
) : post.message.length > 120
            ? (
              <div>
             {linkifyText(`${post.message.replace(/^日付:\s*\d{4}\s*\/\s*\d{1,2}\s*\/\s*\d{1,2}\s*\([月火水木金土日]\)\s*/, '').substring(0, 120)}...`)}
                {post.isManuallyEdited && !(
  post.tags?.includes('#出退勤時間') && 
  post.tags?.includes('#チェックイン') && 
  post.tags?.includes('#チェックアウト')
) && (
  <>
    <span style={{
  color: '#e74c3c',
  fontSize: '0.9rem',
  display: 'block',
  marginTop: '0.3rem'
}}>
      （編集済み）
    </span>
    
    {post.updatedAt && (() => {
      const timestamp = post.updatedAt;
      const date = new Date(timestamp);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const day = date.getDate();
      const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
      const weekday = weekdays[date.getDay()];
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      
      return (
        <div style={{ fontSize: '0.9rem', color: '#055A68', marginTop: '0.2rem' }}>
          最終更新: {year} / {month} / {day} ({weekday}) {hours}:{minutes}
        </div>
      );
    })()}
  </>
)}
               
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onViewDetails(post.id, post.groupId);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#055A68',
                    fontWeight: 'bold',
                    fontSize: '0.85rem',
                    padding: '0.2rem 0',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    marginTop: '0.3rem',
                    display: 'block',
                  }}
                >
                  more
                </button>
              </div>
            ) 
            : (
              <div>
             {linkifyText(post.message?.replace(/^日付:\s*\d{4}\s*\/\s*\d{1,2}\s*\/\s*\d{1,2}\s*\([月火水木金土日]\)\s*/, '') || '')}
               {post.isManuallyEdited && !(
  post.tags?.includes('#出退勤時間') && 
  post.tags?.includes('#チェックイン') && 
  post.tags?.includes('#チェックアウト')
) && (
  <>
    <span style={{
  color: '#e74c3c',
  fontSize: '0.9rem',
  display: 'block',
  marginTop: '0.3rem'
}}>
      （編集済み）
    </span>
    
    {post.updatedAt && (() => {
      const timestamp = post.updatedAt;
      const date = new Date(timestamp);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const day = date.getDate();
      const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
      const weekday = weekdays[date.getDay()];
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      
      return (
        <div style={{ fontSize: '0.9rem', color: '#055A68', marginTop: '0.2rem' }}>
          最終更新: {year} / {month} / {day} ({weekday}) {hours}:{minutes}
        </div>
      );
    })()}
  </>
)}
              </div>
            )
          }
        </div>
      )}

      {/* メッセージがない場合の編集済み表示 */}
      {(!post.message || post.message.length === 0) && post.isManuallyEdited && !(
  post.tags?.includes('#出退勤時間') && 
  post.tags?.includes('#チェックイン') && 
  post.tags?.includes('#チェックアウト')
) && (
  <div style={{
          marginBottom: '0.8rem',
          color: 'rgba(5, 90, 104, 0.8)',
          fontSize: '0.8rem',
          fontStyle: 'italic'
        }}>
          （編集済み）
        </div>
      )}

      {/* タグ表示 */}
      {post.tags && post.tags.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.5rem',
            marginBottom: '0.8rem',
          }}
        >
          {post.tags.slice(0, 3).map((tag, index) => (
            <span
              key={index}
              style={{
                backgroundColor: 'rgba(0, 102, 114, 0.1)',
                color: 'rgb(0, 102, 114)',
                padding: '0.25rem 0.7rem',
                borderRadius: '999px',
                fontSize: '0.75rem',
                fontWeight: '800',
              }}
            >
              {tag}
            </span>
          ))}


          {post.tags.length > 3 && (
            <span
              style={{
                backgroundColor: 'rgba(0, 102, 114, 0.05)',
                color: 'rgb(0, 102, 114)',
                padding: '0.25rem 0.7rem',
                borderRadius: '999px',
                fontSize: '0.75rem',
              }}
            >
              +{post.tags.length - 3}
            </span>
          )}
        </div>
      )}

      {/* 写真のサムネイル表示 - 最大2段7枚+「+X」表示に変更 */}
      {((post.photoUrls && post.photoUrls.length > 0) || (post.images && post.images.length > 0)) && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.5rem',
            marginBottom: '0.5rem',
          }}
        >
          {/* 写真サムネイル表示（最大7枚まで表示、8枚以上で+X表示） */}
          {((post.photoUrls && post.photoUrls.length > 0) ? post.photoUrls : (post.images || [])).slice(0, Math.min(7, ((post.photoUrls && post.photoUrls.length > 0) ? post.photoUrls : (post.images || [])).length)).map((url, index) => (
            <div
              key={index}
              style={{
                width: 'calc((100% - 1.5rem) / 4)',
                aspectRatio: '1/1',
                borderRadius: '8px',
                overflow: 'hidden',
                marginTop: index >= 4 ? '0.5rem' : '0',
                cursor: 'pointer',
              }}
            onClick={(e) => {
                e.stopPropagation();
                // 🔍 デバッグ: クリック時の投稿データ確認
  console.log('🔍 [クリック時] 投稿データ:', {
    postId: (post as any).id?.substring(0, 8),
    hasPhotoUrls: !!post.photoUrls,
    photoUrlsLength: post.photoUrls?.length,
    photoUrlsFirstSize: post.photoUrls?.[0]?.length,
    imagesFirstSize: post.images?.[0]?.length,
    hasImages: !!post.images,
    imagesLength: post.images?.length,
    hasDocumentImages: !!(post as any).documentImages,
    documentImagesLength: (post as any).documentImages?.length,
    hasPhotoImages: !!(post as any).photoImages,
    photoImagesLength: (post as any).photoImages?.length,
    thumbnailsKeys: (post as any).thumbnails ? Object.keys((post as any).thumbnails) : [],
// ⭐ 追加: thumbnails の中身のサイズを確認
thumbnailsDocFirstSize: (post as any).thumbnails?.documents?.[0]?.length,
thumbnailsPhotoFirstSize: (post as any).thumbnails?.photos?.[0]?.length
  });
                const imageArray = post.photoUrls || post.images || [];
console.log('🖼️ [PostCard画像クリック]:', {
  clickedUrl: url.substring(0, 50),
  foundIndex: index,
  totalImages: imageArray.length,
  firstImageUrl: imageArray[0]?.substring(0, 50)
});
onImageClick(url, imageArray, index);
              }}
            >
              <img
                src={url}
                alt={`投稿画像 ${index + 1}`}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
                loading="lazy"
              />
            </div>
          ))}
          
          {/* 8枚以上ある場合、最後の枠に+X表示 - こちらも詳細ページに遷移 */}
         {((post.photoUrls && post.photoUrls.length > 0) ? post.photoUrls : (post.images || [])).length > 7 && (
  <div
    style={{
      width: 'calc((100% - 1.5rem) / 4)',
      aspectRatio: '1/1',
      borderRadius: '8px',
      backgroundColor: 'rgba(0, 102, 114, 0.1)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      color: 'rgb(0, 102, 114)',
      fontSize: '1.1rem',
      fontWeight: 'bold',
      marginTop: '0.5rem',
      cursor: 'pointer',
    }}
    onClick={(e) => {
  e.stopPropagation();
  onPlusButtonClick(post);
}}
  >
    +{((post.photoUrls && post.photoUrls.length > 0) ? post.photoUrls : (post.images || [])).length - 7}
  </div>
)}
        </div>
      )}


      {/* ← ここに区切り線を追加 */}
{((post.photoUrls && post.photoUrls.length > 0) || (post.images && post.images.length > 0)) && (
  <div 
    style={{
      height: '1px',
      backgroundColor: 'rgba(0, 102, 114, 0.2)',
      marginTop: '1rem',
      marginBottom: '0.8rem',
    }}
  />
)}




      {/* ステータスと詳細ボタンのコンテナ */}
<div
  style={{
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  }}
>
  {/* 左側 - 既読表示またはステータス表示の分岐 */}
  {/* 左側 - 既読表示またはステータス表示の分岐 */}
<div>
  {(() => {
    const currentUserId = localStorage.getItem("daily-report-user-id") || "";
    const readStatus = getPostReadStatus(post, currentUserId);
    
    if (readStatus.isAuthor) {
  // ⭐ チェックイン投稿の場合は既読を非表示
  if (post.tags?.includes('#出退勤時間')) {
    return null;
  }
      // 投稿者の場合：既読カウント表示（インスタグラム風）
      return (
        <div 
          onClick={() => {
          window.dispatchEvent(new CustomEvent('openReadByModal', { detail: post }));
          }}
          style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          padding: '0.3rem 0.8rem',
          backgroundColor: 'rgba(5, 90, 104, 0.08)',
          borderRadius: '20px',
          fontSize: '0.75rem',
          color: '#055A68',
          fontWeight: '500',
          cursor: 'pointer'
        }}>
          <div
          style={{
            width: '16px',
            height: '16px',
            borderRadius: '50%',
            backgroundColor: readStatus.readCount > 0 ? '#055A68' : 'rgba(5, 90, 104, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.6rem',
            color: 'white',
            fontWeight: '600'
          }}>
            {readStatus.readCount}
          </div>
          <span>既読</span>
        </div>
      );
    } else {
  // ⭐ チェックイン投稿の場合はステータスボタンも非表示
  if (post.tags?.includes('#出退勤時間')) {
    return null;
  }
  

      return (
        <span 
          style={{
            padding: '0.3rem 0.8rem',
            borderRadius: '15px',
            fontSize: '0.75rem',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'opacity 0.2s',
            border: 'none',
            outline: 'none',
            backgroundColor: (post.statusByUser?.[currentUserId] || '未確認') === '確認済み' ? '#1f5b91' : '#ff6b6b',
            color: 'white'
          }}
          onClick={async (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // 重複実行防止のチェック
            const target = e.currentTarget as HTMLElement;
            if (target.dataset.processing === 'true') return;
            
            // 処理中フラグを設定
            target.dataset.processing = 'true';
            
            try {
              // まず既読マークを実行
              if (!readStatus.isRead) {
                try {
                  await markPostAsRead(post.id, currentUserId);
                  console.log('既読マーク完了:', post.id);
                } catch (error) {
                  console.error('既読マークエラー:', error);
                }
              }
              
              // ステータス選択ポップアップを表示
              setSelectedPostForStatus(post.id);
            } finally {
              // 500ms後に処理中フラグを解除
              setTimeout(() => {
                target.dataset.processing = 'false';
              }, 500);
            }
          }}
          onMouseEnter={(e) => e.currentTarget.style.opacity = '0.6'}
          onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
        >
        {post.statusByUser?.[currentUserId] || '未確認'}
        </span>
      );
    }
  })()}
</div>


 {/* 右側 - ボタン群 */}
{/* 右側 - ボタン群（ArchivePageと同じ配置） */}
<div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
  {/* 詳細ボタンのみ */}
  <button
    onClick={(e) => {
      e.stopPropagation();
      onViewDetails(post.id, post.groupId);
    }}
    style={{
      padding: '0.4rem 1rem',
      backgroundColor: 'rgb(0, 102, 114)',
      color: '#F0DB4F',
      border: 'none',
      borderRadius: '20px',
      fontSize: '0.75rem',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: '0.3rem',
    }}
  >
    詳細
  </button>
</div>
</div>

      {/* ★ ステータス選択モーダル ★ */}
      {selectedPostForStatus === post.id && (() => {
  const currentUserId = localStorage.getItem("daily-report-user-id") || "";
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
          onClick={() => setSelectedPostForStatus(null)}
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
                  onClick={() => {
                    onStatusUpdate(post.id, status);
                    setSelectedPostForStatus(null);
                  }}
                  style={{
                    padding: '0.8rem 0.8rem',
                    borderRadius: '15px',
                    fontSize: '0.9rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'opacity 0.2s',
                    border: 'none',
                    outline: 'none',
                    backgroundColor: status === '確認済み' ? '#1f5b91' : '#ff6b6b',
                    color: 'white',
                    textAlign: 'center',
                    width: '100%',
                    opacity: (post.statusByUser?.[currentUserId] || '未確認') === status ? 0.5 : 1
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.opacity = '0.6'}
                  onMouseLeave={(e) => {
                    const currentStatus = post.statusByUser?.[currentUserId] || '未確認';
                    opacity: (post.statusByUser?.[currentUserId] || '未確認') === status ? 0.5 : 1
                  }}
                >
                  {status}
                </button>
              ))}
            </div>
            
            <button
              onClick={() => setSelectedPostForStatus(null)}
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
      )})()}
    </div>
  );
};

// 未投稿アラートカードコンポーネント
const AlertCard: React.FC<AlertCardProps> = ({ alert, onContact, navigate }) => {
  return (
    <div
    style={{
      backgroundColor: '#F4F1DF',
      color: 'rgb(0, 102, 114)',
      borderRadius: '12px',
      padding: '1rem',
      marginBottom: '1rem',
      cursor: 'default',
      position: 'relative',
      paddingBottom: '3rem',
      boxShadow: '0 4px 6px rgba(0, 102, 114, 0.1), 0 1px 3px rgba(0, 102, 114, 0.08)',
      border: '1px solid rgba(0, 102, 114, 0.1)',
    }}
    >
      {/* ユーザー名とグループ名のヘッダー - 位置を入れ替え */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        marginBottom: '0.5rem',
        fontSize: '0.8rem',
        color: '#055A68'
      }}>
        {/* ユーザー名を左側に配置 */}
        <div>{alert.username}</div>
        {/* グループ名を右側に配置 - クリック可能に */}
        <div 
          style={{ 
            cursor: 'pointer',
            color: '#055A68',
            transition: 'color 0.2s ease',
          }}
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/group/${alert.groupId}?from=home`);
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#033E4A';
            e.currentTarget.style.textDecoration = 'underline';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = '#055A68';
            e.currentTarget.style.textDecoration = 'none';
          }}
        >
          {alert.groupName}
        </div>
      </div>
      
      {/* アラート表示 */}
      <div style={{ 
        color: 'rgb(0, 102, 114)',
        fontWeight: 'bold', 
        marginBottom: '0.5rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.4rem'
      }}>
        <span>⚠️</span>
        未投稿アラート
      </div>
      
      <div style={{ 
        color: 'rgb(0, 102, 114)', 
        fontSize: '0.95rem' 
      }}>
        <span style={{ fontWeight: 'bold' }}>{alert.username}</span>さんが
        <span style={{ fontWeight: 'bold' }}>{alert.groupName}</span>に
        投稿していません
      </div>
      
      <div style={{ 
        color: '#055A68', 
        fontSize: '0.85rem', 
        marginTop: '0.5rem'
      }}>
        締切時間: {alert.deadline}
      </div>
      
      {/* 連絡するボタン */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onContact(alert.groupId);
        }}
        style={{
          backgroundColor: '#F0DB4F',
          color: 'rgb(0, 102, 114)', 
          border: '1px solid rgb(0, 102, 114)',
          borderRadius: '20px',
          padding: '0.4rem 0.8rem',
          fontSize: '0.85rem',
          fontWeight: 'bold',
          cursor: 'pointer',
          position: 'absolute',
          bottom: '1rem',
          right: '1rem',
          transition: 'background-color 0.3s ease',
        }}
      >
        連絡する
      </button>
    </div>
  );
};

// 議事録要約カード
const MeetingSummaryCard: React.FC<MeetingSummaryCardProps> = ({ 
  summary, 
  onViewDetails, 
  navigate 
}) => {
  // 会議日時をフォーマット
  const formatMeetingDate = (date: any) => {
    if (!date) return '';
    const d = date.toDate ? date.toDate() : new Date(date);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  return (
    <div
      style={{
        backgroundColor: summary.status === 'draft' ? '#FFF8DC' : '#E6EDED',
        color: 'rgb(0, 102, 114)',
        borderRadius: '12px',
        padding: '1rem',
        marginBottom: '1rem',
        boxShadow: '0 4px 6px rgba(0, 102, 114, 0.1), 0 1px 3px rgba(0, 102, 114, 0.08)',
        border: summary.status === 'draft' ? '1px solid #F0DB4F' : '1px solid rgba(0, 102, 114, 0.1)',
        cursor: 'pointer',
      }}
      onClick={() => onViewDetails(summary.id)}
    >
      {/* ヘッダー部分 */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'flex-start',
        marginBottom: '0.8rem' 
      }}>
        
        {/* 左側：アイコンと名前（エージェント） */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center'
        }}>
          <div style={{ 
            width: '32px', 
            height: '32px', 
            borderRadius: '50%', 
            backgroundColor: 'rgba(0, 102, 114, 0.1)',
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            marginRight: '0.5rem' 
          }}>
            {/* 人型アイコン（SVG） */}
            <svg 
              width="18" 
              height="18" 
              viewBox="0 0 24 24" 
              fill="rgb(0, 102, 114)" 
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M12 12C14.21 12 16 10.21 16 8C16 5.79 14.21 4 12 4C9.79 4 8 5.79 8 8C8 10.21 9.79 12 12 12ZM12 14C9.33 14 4 15.34 4 18V20H20V18C20 15.34 14.67 14 12 14Z" />
            </svg>
          </div>
          
          <div style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>
            エージェント（AI）
          </div>
        </div>
        
        {/* 右側：グループ名と時間 */}
        <div style={{ 
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: '0.2rem'
        }}>
          <div 
            style={{ 
              fontSize: '0.85rem', 
              color: '#055A68',
              cursor: 'pointer',
            }}
            onClick={(e) => {
  e.stopPropagation();
  navigate(`/group/${summary.groupId}?from=meeting-summary`);
}}
          >
            {summary.groupName || 'グループ名なし'}
          </div>
          
        
        </div>
      </div>
      
      {/* 区切り線 */}
      <div 
        style={{
          height: '1px',
          backgroundColor: 'rgba(0, 102, 114, 0.3)',
          marginBottom: '0.8rem',
        }}
      />

      {/* サマリー形式の本文 */}
      <div style={{
        marginBottom: '0.8rem',
        lineHeight: '1.8',
        fontSize: '0.9rem',
        color: '#055A68',
      }}>
        
        {/* 説明文 */}
<div style={{ 
  marginTop: '1.2rem', 
  marginBottom: '0.8rem',
  color: '#055A68',
  fontSize: '1rem',
  fontWeight: 'bold'
}}>
  Google Meet / 議事録の要約です。
</div>

{/* タイトル */}
<div style={{ marginBottom: '0.5rem', fontSize: '0.9rem' }}>
  タイトル：{summary.meetingTitle}
</div>
        
        {/* 重要ポイントの件数 */}
        {summary.summary?.keyPoints && (
          <div style={{ marginBottom: '0.3rem' }}>
            ・重要ポイント：{summary.summary.keyPoints.length}
          </div>
        )}
        
        {/* 決定事項の件数 */}
        {(summary.summary as any)?.decisions && (
          <div style={{ marginBottom: '0.3rem' }}>
            ・決定事項：{(summary.summary as any).decisions.length}
          </div>
        )}
        
        {/* タスクの件数 */}
        {summary.actions && summary.actions.length > 0 && (
          <div style={{ marginBottom: '0.3rem' }}>
            ・タスク：{summary.actions.length}
          </div>
        )}
      </div>

      {/* ステータスバッジ */}
      {summary.status === 'draft' && (
        <div style={{
          display: 'inline-block',
          backgroundColor: '#F0DB4F',
          color: '#000',
          padding: '0.25rem 0.7rem',
          borderRadius: '999px',
          fontSize: '0.75rem',
          fontWeight: 'bold',
          marginBottom: '0.8rem',
        }}>
          下書き
        </div>
      )}
     {/* 詳細ボタン */}
      <div style={{
        display: 'flex',
        justifyContent: 'flex-end',
        marginTop: '0.8rem',
      }}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onViewDetails(summary.id);
          }}
          style={{
            padding: '0.4rem 1rem',
            backgroundColor: 'rgb(0, 102, 114)',
            color: '#F0DB4F',
            border: 'none',
            borderRadius: '20px',
            fontSize: '0.75rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.3rem',
          }}
        >
          詳細
        </button>
      </div>
    </div>
  );
};

// 時間部分のみを抽出する関数
const extractTime = (dateTimeStr: string | undefined): string => {
  // dateTimeStrが無い場合は空文字を返す
  if (!dateTimeStr || typeof dateTimeStr !== 'string') {
    return '';
  }
  
  const parts = dateTimeStr.split('　');
  if (parts.length > 1) {
    return parts[1];
  }
  return dateTimeStr;
};


// 日本語形式の日付文字列からDateオブジェクトを作成する関数
const parseDateString = (dateTimeStr: string): Date => {
  try {
    const [datePart, timePart] = dateTimeStr.split('　');
    const dateWithoutWeekday = datePart.replace(/（.+）/, '');
    const formattedDate = dateWithoutWeekday
      .replace(/\s+/g, '')
      .replace(/\//g, '-');
    const dateTimeString = `${formattedDate} ${timePart}`;
    return new Date(dateTimeString);
  } catch (e) {
    console.error('日付解析エラー:', dateTimeStr, e);
    return new Date();
  }
};

// 締め切り時間を確認する関数
const isDeadlinePassed = (deadline: string, today: Date): boolean => {
  try {
    const [hours, minutes] = deadline.split(':').map(Number);
    const deadlineDate = new Date(today);
    deadlineDate.setHours(hours, minutes, 0, 0);
    return new Date() > deadlineDate;
  } catch (e) {
    console.error('締め切り時間の解析エラー:', deadline, e);
    return false;
  }
};

// 日付のフォーマット関数
const formatDate = (date: Date) => {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
  const w = weekdays[date.getDay()];
  
  return `${y} / ${m} / ${d}（${w}）`;
};

// 時間のフォーマット関数
const formatTime = (date: Date) => {
  const h = date.getHours().toString().padStart(2, '0');
  const min = date.getMinutes().toString().padStart(2, '0');
  return `${h}:${min}`;
};

// 未投稿アラートを取得する関数
const getMissingPostAlerts = async (groups: Group[]): Promise<AlertInfo[]> => {
  try {
    if (groups.length === 0) {
      return [];
    }
    
    const now = Date.now();
    const alerts: AlertInfo[] = [];
    
    return alerts;
    
  } catch (error) {
    console.error('アラート取得エラー:', error);
    return [];
  }
};

// 検索スコア計算関数（AND検索対応版 - HomePage用）
const calculateSearchScoreForHome = (item: TimelineItem, keywords: string[]): number => {
  let totalScore = 0;
  let matchedKeywords = 0;
  const currentUserId = localStorage.getItem("daily-report-user-id") || "";  // 🆕 この行を追加
  
  keywords.forEach(keyword => {
    let score = 0;
    
    // アラートの場合の処理
    if ('type' in item && item.type === 'alert') {
      const alert = item as AlertInfo;
      
      if (alert.username.toLowerCase().includes(keyword)) score += 2;
      if (alert.groupName.toLowerCase().includes(keyword)) score += 3;
      if ('未投稿'.includes(keyword)) score += 3;
      if ('アラート'.includes(keyword)) score += 3;
      
      if (score > 0) matchedKeywords++;
      totalScore += score;
      return;
    }
    
    // 投稿の場合の処理
    const post = item as Post;
    const message = post.message.toLowerCase();
    const username = (post.username || '').toLowerCase();
    const status = (post.statusByUser?.[currentUserId] || '未確認').toLowerCase();
    const groupName = (post.groupName || '').toLowerCase();
    
    // 1. タグ完全一致（5点）
    if (post.tags?.some(tag => 
      tag.replace(/^#/, '').toLowerCase() === keyword
    )) {
      score += 5;
    }
    
    // 2. グループ名（現場名）完全一致（4点）
    if (groupName === keyword) {
      score += 4;
    }
    
    // 3. タグ部分一致（3点）
    if (post.tags?.some(tag => 
      tag.replace(/^#/, '').toLowerCase().includes(keyword) &&
      tag.replace(/^#/, '').toLowerCase() !== keyword
    )) {
      score += 3;
    }
    
    // 4. グループ名（現場名）部分一致（3点）
    if (groupName.includes(keyword) && groupName !== keyword) {
      score += 3;
    }
    
    // 5. ユーザー名完全一致（4点）
    if (username === keyword) {
      score += 4;
    }
    
    // 6. ユーザー名部分一致（2点）
    if (username.includes(keyword) && username !== keyword) {
      score += 2;
    }
    
    // 7. メッセージ完全一致（4点）
    if (message === keyword) {
      score += 4;
    }
    
    // 8. メッセージ冒頭一致（3点）
    if (message.startsWith(keyword) && message !== keyword) {
      score += 3;
    }
    
    // 9. メッセージ部分一致（1点）
    if (message.includes(keyword) && !message.startsWith(keyword) && message !== keyword) {
      score += 1;
    }
    
    // 10. ステータス一致（1点）
    if (status.includes(keyword)) {
      score += 1;
    }

    // 11. メモ内容一致（2点） ← ここから追加
    if (post.memos && post.memos.length > 0) {
     const memoTexts = post.memos
  .map(memo => {
    const content = memo.content.toLowerCase();
    const tags = (memo.tags || []).join(' ').toLowerCase();
    return `${content} ${tags}`;
  })
  .join(' ');
      
      console.log('🔍 [検索デバッグ] メモ検索:', {
        postId: post.id,
        keyword: keyword,
        memosCount: post.memos.length,
        memoTexts: memoTexts,
        includes: memoTexts.includes(keyword)
      });
      
      if (memoTexts.includes(keyword)) {
        score += 2;
      }
    }
    
    if (score > 0) {
      matchedKeywords++;
    }
    
    totalScore += score;
  });
  
  if (matchedKeywords === keywords.length) {
    return totalScore;
  } else {
    return 0;
  }
};



// 5. メインのHomePageコンポーネント
const HomePage: React.FC = () => {
  
  // 権限管理用の状態を追加
  const [userRole, setUserRole] = useState<'admin' | 'user'>('user');

  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [alerts, setAlerts] = useState<AlertInfo[]>([]);
  const [meetingSummaries, setMeetingSummaries] = useState<MeetingSummary[]>([]);
  const [timelineItems, setTimelineItems] = useState<TimelineItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // メモ機能用の状態を追加
const [memoModalOpen, setMemoModalOpen] = useState(false);
const [selectedPostForMemo, setSelectedPostForMemo] = useState<Post | null>(null);
const [readByModalOpen, setReadByModalOpen] = useState(false);
const [selectedPostForReadBy, setSelectedPostForReadBy] = useState<Post | null>(null);
  
  // 画像モーダル用の状態を追加
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [galleryIndex, setGalleryIndex] = useState(0);
  
  // フィルタリング用の状態
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');  
  const [isSearchActive, setIsSearchActive] = useState(false);
const [searchResultCount, setSearchResultCount] = useState<number | null>(null);  // ← 追加
const [isCountingResults, setIsCountingResults] = useState(false);  // ← 追加
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  

  // 既存の state 変数の後に追加
const [selectedPostForDetail, setSelectedPostForDetail] = useState<Post | null>(null);
const [displayLimit, setDisplayLimit] = useState(10);
const [hasMore, setHasMore] = useState(true);         // まだデータがあるか
const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
const [displayedPostsCount, setDisplayedPostsCount] = useState(5);
const POSTS_PER_LOAD = 5;
const displayedPostsCountRef = useRef(5);
const [isLoadingMore, setIsLoadingMore] = useState(false);  // 追加読み込み中か
const isLoadingMoreRef = useRef(false);
const [currentPage, setCurrentPage] = useState(1);         // 現在のページ番号  
const [lastVisibleDoc, setLastVisibleDoc] = useState<any>(null);  // ⭐ 栞を保存

// ⭐ 新着チェック用のState ⭐
const [hasNewPosts, setHasNewPosts] = useState(false);
const [bannerType, setBannerType] = useState<'reload' | 'newPost'>('reload'); 
const [isInitialLoad, setIsInitialLoad] = useState(() => {
  // セッション中に一度でも読み込んでいればfalse
  return sessionStorage.getItem('homepage-loaded') !== 'true';
});
const [justDeleted, setJustDeleted] = useState(false);
const [latestPostTime, setLatestPostTime] = useState<number>(() => {
  // しおりを読む処理
  const userId = localStorage.getItem('daily-report-user-id');
  if (!userId) return 0;
  
  const saved = loadLastViewedTimestamp(userId);
  return saved || 0;
});

const latestPostTimeRef = useRef(latestPostTime);

// コンポーネントマウント時に初回ロードフラグを制御
  useEffect(() => {
    console.log('🔄 [HomePage] コンポーネントマウント - 初回ロードフラグON');
    
    // 3秒後にフラグOFF（データ読み込み完了を待つ）
    const timer = setTimeout(() => {
  setIsInitialLoad(false);
  sessionStorage.setItem('homepage-loaded', 'true');
  console.log('✅ [HomePage] 初回ロード完了 - 新着チェック開始可能');
}, 2000);  // 5000から2000に変更
    
    return () => {
      clearTimeout(timer);
    };
  }, []); // 空の依存配列 = マウント時のみ実行

// latestPostTime が更新されたら ref も同期
useEffect(() => {
  console.log('🔄 [HomePage] latestPostTimeRef 更新:', {
    更新前: latestPostTimeRef.current,
    更新後: latestPostTime,
    差分ms: latestPostTime - latestPostTimeRef.current
  });
  latestPostTimeRef.current = latestPostTime;
}, [latestPostTime]);


// PostDetailModal コンポーネント
const PostDetailModal: React.FC<{
  post: Post;
  onClose: () => void;
  navigate: (path: string) => void;
  onMemoClick: (post: Post) => void;
}> = ({ post, onClose, navigate, onMemoClick }) => {
  const [displayPost, setDisplayPost] = useState<Post>(post);

  // ユーザー情報を取得して表示名・会社名・役職を補完
  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        const userInfo = await getUser(displayPost.userId);
        if (userInfo) {
          setDisplayPost(prevPost => ({
            ...prevPost,
            username: userInfo.displayName || userInfo.username || prevPost.username,
            company: userInfo.company || '会社名なし',
            position: userInfo.position || '役職なし'
          }));
        }
      } catch (error) {
        console.error('ユーザー情報取得エラー:', error);
      }
    };

    fetchUserInfo();
  }, [displayPost.userId]);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: '#f5f5f5',
        zIndex: 1000,
        overflowY: 'auto',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <Header 
        title="投稿詳細"
        showBackButton={true}
        onBackClick={onClose}
      />
      
      <div style={{ 
        maxWidth: '480px', 
        margin: '0 auto',
        padding: '1rem',
        paddingTop: '70px',
      }}>
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
            alignItems: 'flex-start',
            gap: '1rem'
          }}>
            {/* アバター部分 */}
            <div style={{
              width: '50px',
              height: '50px',
              borderRadius: '50%',
              backgroundColor: 'rgba(5, 90, 104, 0.1)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center'
            }}>
              <svg 
                width="30"
                height="30"
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
                marginBottom: '0.2rem'
              }}>
                {displayPost.username || 'ユーザー'}
              </div>
              <div style={{ 
                color: '#666', 
                fontSize: '0.85rem' 
              }}>
                {displayPost.position || '役職なし'} • {displayPost.company || '会社名なし'}
              </div>
            </div>

            
            
            {/* 日時表示 */}
            <div style={{ 
              padding: '0.4rem 0.8rem',
              borderRadius: '8px',
              color: '#055A68',
              fontSize: '0.85rem',
              fontWeight: '500',
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'flex-end',
              gap: '0.0rem'
            }}>
              <div>{extractTime(displayPost.time)}</div>
            </div>
          </div>
          
         
          {/* グループ情報 */}
<div 
  style={{
    padding: '0.6rem 1rem',
    backgroundColor: 'rgba(5, 90, 104, 0.05)',
    color: '#055A68',
    fontSize: '0.9rem',
    fontWeight: '500',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottom: '1px solid #f0f0f0'
  }}
  onClick={() => navigate(`/group/${displayPost.groupId}?from=home-detail&postId=${displayPost.id}`)}
>
  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
    <span>{displayPost.groupName || 'グループ'}</span>
    {/* ⭐ 時間表示を追加 ⭐ */}
    <span style={{ 
      fontSize: '0.75rem', 
      color: '#666',
      fontWeight: '400'
    }}>
      {extractTime(displayPost.time)}
    </span>
  </div>
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
    <polyline points="9,18 15,12 9,6"></polyline>
  </svg>
</div>

          {/* 投稿内容 */}
          <div style={{ padding: '1.2rem' }}>
            
            {/* メッセージ */}
            {displayPost.message && (
              <div style={{
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
                overflowWrap: 'break-word',
                lineHeight: '1.6',
                color: '#333',
                fontSize: '1rem',
                marginBottom: '1.5rem'
              }}>
                {/* チェックイン投稿は整形表示、通常投稿はそのまま表示 */}
{displayPost.tags?.includes('#チェックイン') ? (
  (() => {
    const timeInfo = extractTimeInfo(displayPost.message || '');
    const cleanMessage = removeTimeInfo(displayPost.message || '');
    const duration = displayPost.tags?.includes('#チェックアウト') 
      ? calculateWorkDuration(displayPost.message || '') 
      : null;
    
    return (
      <div>
        {(timeInfo.startTime || timeInfo.endTime) && (
          <div style={{ marginBottom: '0.5rem', color: '#333' }}>
            {timeInfo.startTime && `開始: ${timeInfo.startTime}`}
            {timeInfo.startTime && timeInfo.endTime && '  ー  '}
            {timeInfo.endTime && `終了: ${timeInfo.endTime}`}
          </div>
        )}

        {duration && (
          <>
            <div style={{ 
              borderTop: '1px solid rgba(5, 90, 104, 0.3)',
              width: '65%',
              margin: '0.5rem 0'
            }} />
            <div style={{ marginBottom: '0.5rem', color: '#333' }}>
              ■ 作業時間: {duration} 
            </div>
            <div style={{ 
              borderTop: '1px solid rgba(5, 90, 104, 0.3)',
              width: '65%',
              margin: '0.5rem 0'
            }} />
          </>
        )}

        {timeInfo.date && (
          <div style={{ marginBottom: '0.5rem', color: '#333' }}>
            日付: {timeInfo.date}
          </div>
        )}
        
        {cleanMessage && (
          <div style={{ marginTop: '0.8rem' }}>
            {linkifyText(cleanMessage)}
            {displayPost.isManuallyEdited && !(
              displayPost.tags?.includes('#出退勤時間') && 
              displayPost.tags?.includes('#チェックイン') && 
              displayPost.tags?.includes('#チェックアウト')
            ) && (
              <span style={{
                color: 'rgba(5, 90, 104, 0.7)',
                fontSize: '0.85rem',
                marginLeft: '0.5rem'
              }}>
                （編集済み）
              </span>
            )}
          </div>
        )}
      </div>
    );
  })()
) : (
 <div>
  {linkifyText(displayPost.message?.replace(/^日付:\s*\d{4}\s*\/\s*\d{1,2}\s*\/\s*\d{1,2}\s*\([月火水木金土日]\)\s*/, '') || '')}
  {displayPost.isManuallyEdited && !(
    displayPost.tags?.includes('#出退勤時間') && 
    displayPost.tags?.includes('#チェックイン') && 
    displayPost.tags?.includes('#チェックアウト')
  ) && (
    <>
      <span style={{
        color: '#e74c3c',
        fontSize: '0.9rem',
        display: 'block',
        marginTop: '0.5rem'
      }}>
        （編集済み）
      </span>
      
      {displayPost.updatedAt && (() => {
        const timestamp = displayPost.updatedAt;
        const date = new Date(timestamp);
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const day = date.getDate();
        const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
        const weekday = weekdays[date.getDay()];
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        
        return (
          <div style={{ fontSize: '0.85rem', color: '#055A68', marginTop: '0.3rem' }}>
            最終更新: {year} / {month} / {day} ({weekday}) {hours}:{minutes}
          </div>
        );
      })()}
    </>
  )}
</div>
)}
                
              </div>
            )}

           
            
            {/* タグ */}
            {displayPost.tags && displayPost.tags.length > 0 && (
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.5rem',
                marginBottom: '1.5rem'
              }}>
                {displayPost.tags.map((tag, index) => (
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
            {displayPost.photoUrls && displayPost.photoUrls.length > 0 && (
              <div style={{
                marginTop: '1rem',
                display: 'grid',
                gridTemplateColumns: displayPost.photoUrls.length === 1 ? '1fr' : 
                                    displayPost.photoUrls.length === 2 ? '1fr 1fr' : 
                                    'repeat(3, 1fr)',
                gap: '0.5rem'
              }}>
                {displayPost.photoUrls.map((url, index) => (
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
                       // ⭐ ここに追加！（1465行目）
  console.log('🖼️ [画像クリック] 投稿データ確認:', {
    postId: displayPost.id,
    photoUrls: displayPost.photoUrls,
    photoUrlsLength: displayPost.photoUrls?.length,
    thumbnails: (displayPost as any).thumbnails,
    images: (displayPost as any).images
  });
  
  if (!displayPost?.photoUrls || displayPost.photoUrls.length === 0) {
    console.warn('⚠️ 画像データが不完全');
    return;
  }
  
const imageIndex = displayPost.photoUrls.findIndex(photoUrl => photoUrl === url);
setGalleryImages(displayPost.photoUrls);
setGalleryIndex(imageIndex);
setGalleryOpen(true);
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
            )}

            {/* メモ表示エリア */}
            {(() => {
              // PostWithMemosとして型変換
              const postWithMemos = displayPost as any;
const memos = postWithMemos.memos || [];

// ★ この2行を追加！
const sortedMemos = [...memos].sort((a: any, b: any) => 
  (b.createdAt || 0) - (a.createdAt || 0)
);

console.log('🔍 [PostDetailModal] メモ表示確認:', {
  postId: displayPost.id,
  memosCount: memos.length,
  memos: memos
});

if (memos.length === 0) {
  return null;
}
              
              return (
                <div style={{
                  marginTop: '1.5rem',
                  paddingTop: '1rem',
                  borderTop: '1px solid #f0f0f0'
                }}>
                  <div style={{
                    fontSize: '0.9rem',
                    color: '#055A68',
                    marginBottom: '0.8rem',
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#055A68"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="12" y1="18" x2="12" y2="12" />
                      <line x1="9" y1="15" x2="15" y2="15" />
                    </svg>
                    メモ ({memos.length}件)
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                    {sortedMemos.map((memo: any) => (
                      <div key={memo.id} style={{
                        backgroundColor: '#f8f9fa',
                        padding: '0.8rem',
                        borderRadius: '8px',
                        border: '1px solid #e9ecef'
                      }}>
                        {/* メモ内容 */}
                        <div style={{
                          color: '#333',
                          fontSize: '0.9rem',
                          marginBottom: '0.5rem',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-all',
                          overflowWrap: 'break-word',
                          lineHeight: '1.5'
                        }}>
                          {linkifyText(memo.content)}
                        </div>
                        
                        {/* メモ画像 */}
                        {memo.imageUrls && memo.imageUrls.length > 0 && (
                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
                            gap: '0.5rem',
                            marginTop: '0.5rem'
                          }}>
                            {memo.imageUrls.map((url: string, idx: number) => (
                              <div
                                key={idx}
                                style={{
                                  aspectRatio: '1/1',
                                  borderRadius: '6px',
                                  overflow: 'hidden',
                                  cursor: 'pointer'
                                }}
                                onClick={() => {
                                  setGalleryImages(memo.imageUrls);
                                  setGalleryIndex(idx);
                                  setGalleryOpen(true);
                                }}
                              >
                                <img
                                  src={url}
                                  alt={`メモ画像 ${idx + 1}`}
                                  style={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'cover'
                                  }}
                                />
                              </div>
                            ))}
                          </div>
                        )}
                        

                        {/* ⭐ ここにタグ表示を追加 ⭐ */}
{memo.tags && memo.tags.length > 0 && (
  <div style={{
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.4rem',
    marginTop: '0.5rem'
  }}>
    {memo.tags.map((tag: string, tagIndex: number) => (
      <span
        key={tagIndex}
        style={{
          backgroundColor: '#E6EDED',
          color: '#055A68',
          padding: '0.2rem 0.6rem',
          borderRadius: '999px',
          fontSize: '0.75rem',
          fontWeight: '500',
        }}
      >
        {tag}
      </span>
    ))}
  </div>
)}


                        {/* メモメタ情報 */}
                        <div style={{
                          marginTop: '0.5rem',
                          paddingTop: '0.5rem',
                          borderTop: '1px solid #e9ecef',
                          fontSize: '0.75rem',
                          color: '#6c757d',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <span>{memo.createdByName || 'ユーザー'}</span>
                          <span>{new Date(memo.createdAt).toLocaleString('ja-JP')}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

         {/* アクションボタン - Home専用軽量版 */}
<div style={{
  marginTop: '2rem',
  paddingTop: '1rem',
  borderTop: '1px solid #f0f0f0',
  display: 'flex',
  justifyContent: 'flex-start',
  alignItems: 'center'
}}>
  {/* メモボタンのみ */}
  <button
    onClick={() => onMemoClick(displayPost)}
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
          </div>
        </div>
      </div>
    </div>
  );
};



  // 読み込んだ日付のリスト
  const [availableDates, setAvailableDates] = useState<string[]>([]);

  // フィルター表示の状態
  const [showFilter, setShowFilter] = useState(false);
  
  // ★ 修正: StrictMode対応改善版 - デバウンス付き ★
  const initializationRef = useRef(false);
  const retryCountRef = useRef(0);
  const MAX_RETRIES = 3;
  
  // 検索アイコンクリック時のフィルター表示切り替え
  const toggleFilter = () => {
    setShowFilter(prev => !prev);
  };
  
  // 画像をモーダルで表示する関数
  const handleImageClick = (imageUrl: string, allImages: string[], imageIndex: number) => {
  setGalleryImages(allImages);
  setGalleryIndex(imageIndex);
  setGalleryOpen(true);
};

  // 投稿の詳細ページをモーダルに
// 投稿の詳細ページをモーダルに（メモ取得機能付き）
const handleViewPostDetails = async (postId: string, groupId: string) => {
  console.log('🔍 [HomePage] 投稿詳細を開く:', postId);
  
  let targetPost = posts.find(post => post.id === postId);

// 🌟 postsになければFirestoreから直接取得
if (!targetPost) {
  console.log('📥 [HomePage] postsにないため、Firestoreから取得します:', postId);
  try {
    const userId = localStorage.getItem('daily-report-user-id') || '';
      targetPost = await UnifiedCoreSystem.getPost(postId, userId);
    if (!targetPost) {
      console.error('❌ [HomePage] Firestoreにも投稿が見つかりません:', postId);
      return;
    }
    console.log('✅ [HomePage] Firestoreから投稿を取得しました:', targetPost.id);
    // ⭐ グループ名を補完（groupNameがない場合のみ）⭐
  // ⭐ グループ名を補完（groupNameがない場合のみ）⭐
  if (targetPost && targetPost.groupId && !targetPost.groupName) {
    // まず、groups配列から探す
    let group = groups.find(g => g.id === targetPost.groupId);
    
    // 見つからなければFirestoreから直接取得
    if (!group) {
      console.log('📥 [HomePage] groupsに見つからないため、Firestoreから取得:', targetPost.groupId);
      try {
        const { doc, getDoc, getFirestore } = await import('firebase/firestore');
        const db = getFirestore();
        const groupDoc = await getDoc(doc(db, 'groups', targetPost.groupId));
        if (groupDoc.exists()) {
          group = { id: groupDoc.id, ...groupDoc.data() } as any;
          console.log('✅ [HomePage] Firestoreからグループ取得:', group.name);
        }
      } catch (error) {
        console.error('❌ [HomePage] グループ取得エラー:', error);
      }
    }
    
    // グループ名を設定
    if (group) {
      targetPost = {
        ...targetPost,
        groupName: group.name || 'グループ名なし'
      };
      console.log('✅ [HomePage] グループ名を補完:', group.name);
    } else {
      console.warn('⚠️ [HomePage] グループが見つかりません:', targetPost.groupId);
      targetPost = {
        ...targetPost,
        groupName: 'グループ名なし'
      };
    }
  }
  } catch (error) {
    console.error('❌ [HomePage] Firestore取得エラー:', error);
    return;
  }
}

// ⭐ ユーザー名も補完（userName → username）⭐
  if (targetPost && targetPost.userName && !targetPost.username) {
    targetPost = {
      ...targetPost,
      username: targetPost.userName
    };
    console.log('✅ [HomePage] ユーザー名を補完:', targetPost.userName);
  }
  
  // 🌟 メモをまだ取得していない、または空の場合のみ取得
  const needsFetchMemos = !targetPost.memos || targetPost.memos.length === 0;
  
  if (needsFetchMemos) {
    console.log('📝 [HomePage] この投稿のメモを取得中...');
    
    try {
      const userId = localStorage.getItem("daily-report-user-id") || "";
      
      // 🌟 メモだけを取得（MemoServiceを使用）
      const memosData = await MemoService.getPostMemosForUser(postId, userId);
      
      // 投稿にメモを追加
      const postWithMemos = {
        ...targetPost,
        memos: memosData
      };
      
      console.log(`✅ [HomePage] メモ取得完了: ${memosData.length}件`);
      
      // モーダルに表示
      setSelectedPostForDetail(postWithMemos);
      
      // 🌟 postsステートも更新（次回は取得不要）
      setPosts(prevPosts => 
        prevPosts.map(p => 
          p.id === postId ? postWithMemos : p
        )
      );
      setTimelineItems(prevItems => 
        prevItems.map(item => 
          'id' in item && item.id === postId ? postWithMemos : item
        )
      );
      setFilteredItems(prevItems => 
        prevItems.map(item => 
          'id' in item && item.id === postId ? postWithMemos : item
        )
      );
      
    } catch (error) {
      console.error('❌ [HomePage] メモ取得エラー:', error);
      // エラーでもモーダルは開く（メモなしで）
      setSelectedPostForDetail(targetPost);
    }
  } else {
    console.log('✅ [HomePage] メモは既に取得済み:', targetPost.memos?.length, '件');
    setSelectedPostForDetail(targetPost);
  }
};


  
  // 連絡するボタンを押した時の処理
  const handleContact = (groupId: string) => {
    navigate(`/group/${groupId}/post?from=home`);
  };

  const handleMemoClick = (post: Post) => {
  console.log('📝 [HomePage] メモ追加ボタンクリック:', post.id);
  
  // すぐにメモモーダルを開く（遅延なし）
  setSelectedPostForMemo(post);
  setMemoModalOpen(true);
};

// ⭐ 無限スクロール：本格版（ページネーション対応） ⭐
const loadMorePosts = useCallback(async () => {
  console.log('📥 [無限スクロール] 次の20件を取得開始');
  
  if (isLoadingMore || !hasMore) {
    console.log('⏸️ 読み込みスキップ:', { isLoadingMore, hasMore });
    return;
  }
  
  setIsLoadingMore(true);
isLoadingMoreRef.current = true;

  try {
    const userId = localStorage.getItem('daily-report-user-id');
    if (!userId) {
      console.log('❌ [無限スクロール] ユーザーIDなし');
      setIsLoadingMore(false);
      return;
    }

    const nextPage = currentPage + 1;
    console.log(`📄 [無限スクロール] ページ ${nextPage} を取得中`);

    // ユーザーのグループを取得
    const userGroups = await UnifiedCoreSystem.getUserGroups(userId);
    const groupIds = userGroups.map(g => g.id);

    console.log(`🔍 [無限スクロール] ${groupIds.length}グループから取得`);

    // ⭐ 新機能を使用：続きから取得！ ⭐
    const result = await UnifiedCoreSystem.getLatestPostsFromMultipleGroupsPaginated(
      groupIds,
      20,
      lastVisibleDoc  // ← 前回の栞を渡す
    );

    console.log(`✅ [無限スクロール] ${result.posts.length}件取得`);
    console.log(`📊 [無限スクロール] 続きあり: ${result.hasMore}`);

    // result.hasMoreを信頼する
setHasMore(result.hasMore);
if (!result.hasMore) {
  console.log('🏁 [無限スクロール] これ以上データなし');
}
   
   // 取得した投稿が1件以上あれば処理を続ける
   if (result.posts.length > 0) {
      console.log(`➕ [無限スクロール] ${result.posts.length}件を追加表示`);
      
       // ⭐ グループ名マッピングを追加 ⭐
      const postsWithGroupName = result.posts.map(post => {
        const group = userGroups.find(g => g.id === post.groupId);
        return {
          ...post,
          groupName: group?.name || 'グループ名なし',
          memos: post.memos || []
        };
      });
      console.log('✅ [無限スクロール] グループ名マッピング完了');
      

   // ⭐ 重複チェック付きで既存データに追加 ⭐
setPosts(prevPosts => {
  // 既存の投稿IDを取得
  const existingIds = new Set(prevPosts.map(p => p.id));
  
  // 新しい投稿のみをフィルター
  const newPosts = postsWithGroupName.filter(post => !existingIds.has(post.id));
  actualNewPostsCount = newPosts.length;
  console.log(`🔍 [重複チェック] 既存: ${prevPosts.length}件, 新規: ${newPosts.length}件, 重複除外: ${result.posts.length - newPosts.length}件`);
  return [...prevPosts, ...newPosts];
});
// ⭐ 新しい配列を先に計算 ⭐


setTimelineItems(prevItems => {
  const existingIds = new Set(prevItems.map(item => 'id' in item ? item.id : ''));
  const newItems = postsWithGroupName.filter(post => !existingIds.has(post.id));
  const updated = [...prevItems, ...newItems];
  
  setTimeout(() => {
    applyFilters(updated);
  }, 0);
  return updated;
});


console.log('📥 現在のフィルター条件:', { startDate, endDate, searchQuery });

let actualNewPostsCount = 0;
      
      // ⭐ 栞を更新（次回のために）⭐
      setLastVisibleDoc(result.lastVisible);
      
      // ⭐ 新規データがなければ終了 ⭐
// result.hasMoreだけを信頼する（重複は無視）
setHasMore(result.hasMore);
      
      // ページ番号を更新
      setCurrentPage(nextPage);
      
      // displayLimitも増やす
      setDisplayLimit(prev => prev + result.posts.length);

      // Phase A4: displayedPostsCountも増やす
      setDisplayedPostsCount(prev => prev + result.posts.length);
      
     
      
      console.log(`📊 [無限スクロール] 合計 ${posts.length + result.posts.length} 件表示中`);
      console.log(`📊 [表示制限] displayLimitを更新しました`);
    }

} catch (error) {
  console.error('❌ [無限スクロール] 読み込みエラー:', error);
  
  // ⭐ エラーの種類を判定 ⭐
  let errorMessage = 'データの読み込みに失敗しました';
  
  if (error instanceof Error) {
    if (error.message.includes('network')) {
      errorMessage = 'ネットワークエラー：インターネット接続を確認してください';
    } else if (error.message.includes('permission')) {
      errorMessage = '権限エラー：アクセス権限がありません';
    } else if (error.message.includes('quota')) {
      errorMessage = '制限エラー：データ取得の上限に達しました';
    }
  }
  
  console.log('📢 [エラー通知]', errorMessage);
  
  // ⭐ ユーザーに通知（オプション：アラート表示） ⭐
  // alert(errorMessage); // ← コメントアウト：必要なら有効化
  
  // ⭐ リトライ可能にする ⭐
  // エラーでもhasMoreをfalseにしない（再試行可能）
  // setHasMore(false); // ← コメントアウト
  
  console.log('🔄 [リトライ] 再度スクロールすると再試行できます');
} finally {
  setIsLoadingMore(false);
isLoadingMoreRef.current = false;
}

}, [currentPage, posts.length, isLoadingMore, hasMore, displayLimit, lastVisibleDoc, setPosts, setTimelineItems, setFilteredItems, setHasMore, setIsLoadingMore, setCurrentPage, setDisplayLimit, setLastVisibleDoc]);

  // ★ 修正版：確実な初期化とリトライ機能付きデータロード ★
  // ✅ 既存のuseEffectを以下に置き換え（894行目付近）
useEffect(() => {
  let isMounted = true;
  let isInitializing = false;

    // 即座にスクロール位置を復元
  const immediateRestore = sessionStorage.getItem('restoreScrollImmediately');
  if (immediateRestore) {
    console.log('即座にスクロール位置を復元:', immediateRestore);
    window.scrollTo(0, parseInt(immediateRestore));
    sessionStorage.removeItem('restoreScrollImmediately');
    sessionStorage.removeItem('homeScrollPosition');
    
    // データ読み込み中もスクロール位置を固定
    const targetPosition = parseInt(immediateRestore);
    const intervalId = setInterval(() => {
      if (window.pageYOffset !== targetPosition) {
        window.scrollTo(0, targetPosition);
      }
    }, 50);
    
    // データ読み込み完了後にインターバルを停止
    setTimeout(() => clearInterval(intervalId), 1000);
  }
  
  const loadDataFast = async () => {
  console.log('🔍 loadDataFast関数開始'); // 追加
  
  // ★ ここにスクロール位置復帰処理を追加 ★
  const savedPosition = sessionStorage.getItem('homeScrollPosition');
  if (savedPosition) {
    console.log('📍 スクロール位置復帰:', savedPosition);
    setTimeout(() => {
      window.scrollTo(0, parseInt(savedPosition));
      sessionStorage.removeItem('homeScrollPosition');
    }, 500); // データ読み込み後に実行
  }
  
  // 復帰モードの判定を追加
  const returnToDetail = sessionStorage.getItem('returnToDetail');
  const isReturnMode = !!returnToDetail;
  console.log('🔍 復帰モード:', isReturnMode); // 追加
  
  if (isInitializing || initializationRef.current) {
    console.log('⏳ 重複実行スキップ');
    return;
  }

  isInitializing = true;
  console.log('🔍 初期化開始'); // 追加
  
  try {
    console.log('🚀 HomePage 高速データロード開始');
    if (isReturnMode) {
      console.log('📋 復帰モード: 軽量データロードを実行');
    }
    const startTime = performance.now();
    
    setLoading(true);
    console.log('🔍 ローディング状態をtrueに設定'); // 追加
   
   // ✅ キャッシュチェックを強化
// ✅ キャッシュチェックを強化・統合版
const CACHE_DURATION = isReturnMode ? 60000 : 30000;
console.log('🔍 [HomePage] キャッシュチェック開始');

// 🌟 Step 1: 強制リフレッシュフラグを統合チェック
const forceRefresh = localStorage.getItem('posts-need-refresh');
const forceRefreshHome = localStorage.getItem('force-refresh-home');
const lastUpdate = localStorage.getItem('daily-report-posts-updated');

// デバッグ情報を出力
console.log('🔍 [フラグ状態] posts-need-refresh:', forceRefresh);
console.log('🔍 [フラグ状態] force-refresh-home:', forceRefreshHome);
console.log('🔍 [フラグ状態] daily-report-posts-updated:', lastUpdate);

// 🌟 Step 2: 強制リフレッシュが必要かチェック
if (forceRefresh || forceRefreshHome) {
  console.log('🔄 [HomePage] 強制リフレッシュフラグ検出：投稿キャッシュをクリア');
  
  localStorage.removeItem('posts-need-refresh');
  localStorage.removeItem('force-refresh-home');
  localStorage.removeItem('daily-report-posts-updated');
  
  postsCache = null;  // 投稿キャッシュのみクリア
  postsCacheTime = 0;
  
  console.log('✅ [HomePage] 投稿キャッシュクリア完了（ユーザー名キャッシュは保持）');
}

// 🌟 Step 3: 5秒ルールチェック
else if (lastUpdate) {
  const lastUpdateTime = parseInt(lastUpdate);
  const timeSinceUpdate = Date.now() - lastUpdateTime;
  
  console.log(`⏱️ [5秒ルール] 最終更新からの経過: ${timeSinceUpdate}ms`);
  
  if (timeSinceUpdate < 5000) {
    console.log('🔄 [HomePage] 5秒以内の更新：キャッシュクリア');
    
    postsCache = null;
    postsCacheTime = 0;
    
    console.log('✅ [HomePage] キャッシュクリア完了（5秒ルール）');
  }
}

// 🌟 Step 4: キャッシュ使用チェック
if (postsCache && postsCache.length > 0 && Date.now() - postsCacheTime < CACHE_DURATION) {
  console.log('💾 [HomePage] キャッシュデータを使用:', postsCache.length, '件');
  console.log(`⏰ [キャッシュ有効期限] あと${Math.round((CACHE_DURATION - (Date.now() - postsCacheTime)) / 1000)}秒`);

  if (isMounted) {
  setTimelineItems(postsCache);
  
  // ✅ キャッシュデータでフィルター適用
  applyFilters(postsCache);
  
  setLoading(false);
  setIsAuthenticated(true);
}

  
  console.log('✅ キャッシュから高速ロード完了');
  const endTime = performance.now();
  console.log(`⚡ 高速データロード完了: ${Math.round(endTime - startTime)}ms`);
  return;
}

console.log('🔍 キャッシュなし、通常処理を続行');
    
    // 認証確認
    const token = localStorage.getItem('daily-report-user-token');
    console.log('🔍 トークン確認:', !!token); // 追加
    if (!token) {
      console.log('❌ トークンなし'); // 追加
      setIsAuthenticated(false);
      return;
    }
    
    
    console.log('🔍 認証OK、データ取得処理に進む'); // 追加
    
    setIsAuthenticated(true);

    setIsAuthenticated(true);

// ユーザーIDの安全な取得
const userId = localStorage.getItem("daily-report-user-id");

if (!userId) {
  console.error('ユーザーIDが取得できません。ログインが必要です。');
  setIsAuthenticated(false);
  setLoading(false);
  return;
}

console.log('取得されたユーザーID:', userId);

const user = {
  id: userId,
  email: localStorage.getItem("daily-report-user-email") || "admin@example.com",
  username: localStorage.getItem("daily-report-username") || "ユーザー",
  role: 'user' as const,
  settings: {
    notifications: true,
    reportFrequency: 'daily' as const,
    theme: 'light' as const
  },
  createdAt: Date.now(),
  updatedAt: Date.now()
};

if (isMounted) {
  setCurrentUser(user);
  
  // 環境変数ベースの権限チェックに変更
  const adminStatus = await isAdmin();
  setUserRole(adminStatus ? 'admin' : 'user');
}

// セキュリティ修正: 参加権限チェック強化
const allGroups = await UnifiedCoreSystem.getUserGroups(userId).catch(() => []);

// 参加権限の二重チェック
const userGroups = allGroups.filter(group => {
  const isCreator = group.createdBy === userId || group.adminId === userId;
  const isMember = group.members?.some(member => {
    const memberId = typeof member === 'string' ? member : member.id;
    return memberId === userId;
  });
  return isCreator || isMember;
});

console.log('🔒 セキュリティチェック: 参加グループ', userGroups.length, '/', allGroups.length);

let allPosts: Post[] = [];
try {
  console.log('🔍 [Home] 参加確認済みグループの投稿のみ取得中...');
  

// ⭐ 新しい効率的な取得方法 ⭐
const groupIds = userGroups.map(g => g.id);
console.log(`📊 [効率的ロード] ${groupIds.length}グループから最新10件を一括取得`);
const postFetchStart = performance.now();
allPosts = await UnifiedCoreSystem.getLatestPostsFromMultipleGroups(
  groupIds,
  10  // 初回10件取得（5件ずつ段階表示）
);
const postFetchEnd = performance.now();
console.log(`⏱️ [計測] 投稿取得: ${Math.round(postFetchEnd - postFetchStart)}ms`);

// ⭐ デバッグ1: Firestoreから取得した投稿の最初の3件を確認
console.log('🔍 [DEBUG-loadDataFast] Firestoreから取得した投稿数:', allPosts.length);
console.log('🔍 [DEBUG-loadDataFast] Firestoreから取得した最初の3件:', 
  allPosts.slice(0, 3).map(p => ({
    id: p.id?.substring(0, 8),
    timestamp: p.timestamp,
    createdAt: p.createdAt,
    timestampType: typeof p.timestamp,
    createdAtType: typeof p.createdAt
  }))
);

// グループ名を各投稿に追加
allPosts = allPosts.map(post => {
  const group = userGroups.find(g => g.id === post.groupId);
  return {
    ...post,
    groupName: group?.name || 'グループ名なし',
    memos: []  // 空配列で初期化
  };
});

console.log(`✅ [Home] 効率的ロード完了: ${allPosts.length}件の投稿を取得`);
  
} catch (error) {
  console.error('❌ [Home] 投稿取得エラー:', error);
  allPosts = [];
}

// 投稿データをセット
if (isMounted) {
 
console.log('🔍 [Home] 取得した投稿の画像データ構造確認:');
allPosts.slice(0, 1).forEach(post => {
  console.log('投稿ID:', post.id);
  console.log('  post.photoUrls:', post.photoUrls);
  console.log('  post.images:', post.images);
  console.log('  post.thumbnails:', (post as any).thumbnails);
  console.log('  post全体:', post);
  console.log('  post.thumbnails.documents:', (post as any).thumbnails?.documents);
  console.log('  post.thumbnails.photos:', (post as any).thumbnails?.photos);
});

 // ⭐ Step 2: ユーザー名と写真を追加マージ（バッチ版で高速化）
  
  // 全投稿からユーザーIDを抽出
const userIds = allPosts
  .map(post => post.authorId || post.userId || post.userID)
  .filter((id): id is string => !!id);
  
  console.log('🚀 バッチでユーザー名取得開始:', userIds.length, '人');
  const userFetchStart = performance.now();
  // バッチで一括取得
  const userNamesMap = await getDisplayNamesBatch(userIds);
  const userFetchEnd = performance.now();
console.log(`⏱️ [計測] ユーザー名取得: ${Math.round(userFetchEnd - userFetchStart)}ms`);
  console.log('✅ バッチ取得完了:', userNamesMap.size, '件');
  
  // ユーザー名と画像を追加
  const enrichedPosts = allPosts.map(post => {
    const userId = post.authorId || post.userId || post.userID;
    const username = userId && userNamesMap.has(userId) 
      ? userNamesMap.get(userId)! 
      : post.username || 'ユーザー';
    
    const photos = post.photoUrls || [];
    
    return {
      ...post,
      username,
      photoUrls: photos,
      images: photos
    };
  });
  
  console.log('✅ [Home] ユーザー名・写真マージ完了:', enrichedPosts.length, '件');

// ⭐ timestampが存在しない場合、createdAtから変換
let postsWithTimestamp = enrichedPosts.map(post => {
  // timestampが既に存在する場合はそのまま返す
  if (post.timestamp && typeof post.timestamp === 'number' && post.timestamp > 0) {
    return post;
  }
  
  // createdAtが存在しない場合もそのまま返す
  if (!post.createdAt) {
    console.log('⚠️ [timestamp変換] createdAtなし:', post.id);
    return post;
  }
  
  const createdAt = post.createdAt;
  let convertedTimestamp: number | null = null;
  
  // createdAtが数値の場合
  if (typeof createdAt === 'number') {
    convertedTimestamp = createdAt;
    console.log('✅ [timestamp変換] 数値から変換:', post.id?.substring(0, 8), convertedTimestamp);
    return { ...post, timestamp: convertedTimestamp };
  }
  
  // createdAtがFirestore Timestampオブジェクトの場合
  if (typeof createdAt === 'object' && createdAt !== null) {
    // ⭐ 最適化: secondsを最初に試す（高速パス）
    if ('seconds' in createdAt) {
      const seconds = (createdAt as any).seconds;
      if (typeof seconds === 'number') {
        convertedTimestamp = seconds * 1000;
        console.log('✅ [timestamp変換] secondsから変換:', post.id?.substring(0, 8), convertedTimestamp);
        return { ...post, timestamp: convertedTimestamp };
      }
    }
    
    // _secondsプロパティも試す
    if ('_seconds' in createdAt) {
      const seconds = (createdAt as any)._seconds;
      if (typeof seconds === 'number') {
        convertedTimestamp = seconds * 1000;
        console.log('✅ [timestamp変換] _secondsから変換:', post.id?.substring(0, 8), convertedTimestamp);
        return { ...post, timestamp: convertedTimestamp };
      }
    }
    
    // toMillisメソッドを試す（フォールバック）
    if ('toMillis' in createdAt) {
      try {
        const toMillisFn = (createdAt as any).toMillis;
        if (typeof toMillisFn === 'function') {
          convertedTimestamp = toMillisFn();
          console.log('✅ [timestamp変換] toMillisから変換:', post.id?.substring(0, 8), convertedTimestamp);
          return { ...post, timestamp: convertedTimestamp };
        }
      } catch (error) {
        // toMillis実行エラー（無視して次の処理へ）
      }
    }
  }
  
  // どの方法でも変換できなかった場合
  console.warn('⚠️ [timestamp変換] 変換失敗:', post.id, typeof createdAt, createdAt);
  return post;
});

console.log('🔄 [HomePage] timestamp変換完了');
console.log('🔍 [変換結果サマリー] 変換成功:', postsWithTimestamp.filter(p => p.timestamp).length, '/', postsWithTimestamp.length);

// ⭐ デバッグ3: enrichedPosts（ソート前）の最初の3件
console.log('🔍 [DEBUG-loadDataFast] enrichedPosts（ソート前）の最初の3件:', 
  postsWithTimestamp.slice(0, 3).map(p => ({
    id: p.id?.substring(0, 8),
    timestamp: p.timestamp,
    timestampType: typeof p.timestamp,
    sortKey: p.timestamp || 0
  }))
);

// ⭐ enrichedPostsを新しい順にソート
postsWithTimestamp.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
console.log('🔄 [HomePage-loadDataFast] 投稿を時系列でソート完了');

// ⭐ デバッグ4: ソート後の最初の3件を確認
console.log('🔍 [DEBUG-loadDataFast] enrichedPosts（ソート後）の最初の3件:', 
  postsWithTimestamp.slice(0, 3).map(p => ({
    id: p.id?.substring(0, 8),
    timestamp: p.timestamp,
    timestampType: typeof p.timestamp,
    sortKey: p.timestamp || 0
  }))
);

setPosts(postsWithTimestamp);


   // ⭐ 新着チェック用：最新投稿時刻を記録 ⭐
 if (postsWithTimestamp.length > 0) {
  const post = postsWithTimestamp[0];
    let latestTime = 0;
    
    if (post.timestamp) {
      latestTime = post.timestamp;
    } else if (post.createdAt) {
      if (typeof post.createdAt === 'number') {
        latestTime = post.createdAt;
      } else if (typeof post.createdAt === 'object' && post.createdAt !== null && 'toMillis' in post.createdAt) {
        latestTime = (post.createdAt as any).toMillis();
      }
    }
    
    if (latestTime > 0) {
      setLatestPostTime(latestTime);
      console.log('📊 [HomePage] 最新投稿時刻を記録:', new Date(latestTime).toLocaleString('ja-JP'));
    // ⭐⭐⭐ ここを追加 ⭐⭐⭐
        const userId = localStorage.getItem('daily-report-user-id');
        if (userId) {
          saveLastViewedTimestamp(userId, latestTime + 100);
          console.log('💾 [HomePage] 初回読み込み - lastViewed保存:', new Date(latestTime + 100).toLocaleString('ja-JP'));
        }
      }
  }

  // 🔥 議事録要約データを取得
console.log('📋 [Home] 議事録要約データ取得開始');
let allSummaries: MeetingSummary[] = [];
try {
  const { collection, query, where, getDocs, orderBy, limit } = await import('firebase/firestore');
  const { getFirestore } = await import('firebase/firestore');
  const db = getFirestore();
  
  // ユーザーが参加しているグループの議事録要約を取得
  const groupIds = userGroups.map(g => g.id);

  // groupId=nullの下書き議事録も取得（管理者用）
  const draftRef = collection(db, 'meeting_summaries');
  const draftQ = query(
    draftRef,
    where('groupId', '==', null),
    where('status', '==', 'draft'),
    orderBy('createdAt', 'desc'),
    limit(10)
  );
  const draftSnapshot = await getDocs(draftQ);
  const draftSummaries = draftSnapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      docId: data.docId || '',
      meetingTitle: data.meetingTitle || '無題の会議',
      meetingDate: data.meetingDate,
      status: data.status || 'draft',
      groupId: null,
      groupName: 'グループ未設定',
      participants: data.participants || [],
      summary: data.summary || { title: '', keyPoints: [], decisions: [] },
      actions: data.actions || [],
      createdAt: data.createdAt,
      visibleTo: data.visibleTo || null,
      type: 'meeting_summary' as const
    } as MeetingSummary;
  });
  allSummaries = [...allSummaries, ...draftSummaries];
  
  // グループごとに議事録要約を取得（最新10件）
  for (const groupId of groupIds) {
    const summariesRef = collection(db, 'meeting_summaries');
    const q = query(
      summariesRef,
      where('groupId', '==', groupId),
      orderBy('createdAt', 'desc'),
      limit(10)
    );
    
    const snapshot = await getDocs(q);
    const summaries = snapshot.docs.map(doc => {
      const data = doc.data();
      const group = userGroups.find(g => g.id === groupId);
      
      return {
        id: doc.id,
        docId: data.docId || '',
        meetingTitle: data.meetingTitle || '無題の会議',
        meetingDate: data.meetingDate,
        status: data.status || 'draft',
        groupId: groupId,
        groupName: group?.name || 'グループ名なし',
        participants: data.participants || [],
        summary: data.summary || { title: '', keyPoints: [], decisions: [] },
        actions: data.actions || [],
        createdAt: data.createdAt,
        visibleTo: data.visibleTo || null,
        type: 'meeting_summary' as const
      } as MeetingSummary;
    });
    
    allSummaries = [...allSummaries, ...summaries];
  }
  
  console.log('✅ [Home] 議事録要約取得完了:', allSummaries.length, '件');
  
 // visibleToフィルタリング（draft=管理者のみ、published=全員）
const filteredSummaries = allSummaries.filter(s => {
  const data = s as any;
  if (!data.visibleTo) return true; // publishedまたはvisibleTo未設定は全員に表示
  return data.visibleTo.includes(localStorage.getItem("daily-report-user-id")); // draftは管理者のみ
});

if (isMounted) {
  setMeetingSummaries(filteredSummaries);
}
} catch (error) {
  console.error('❌ [Home] 議事録要約取得エラー:', error);
}


 setGroups(allGroups);

// 🔥 投稿と議事録要約を統合してタイムラインに設定
const combinedTimeline = [...enrichedPosts, ...allSummaries].sort((a, b) => {
  // 投稿の場合は timestamp、議事録要約の場合は createdAt を使用
  const timeA = ('timestamp' in a ? a.timestamp : (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : a.createdAt)) || 0;
  const timeB = ('timestamp' in b ? b.timestamp : (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : b.createdAt)) || 0;
  return timeB - timeA; // 降順（新しい順）
});

console.log('📊 [Home] タイムライン統合:', {
  投稿: enrichedPosts.length,
  議事録要約: allSummaries.length,
  合計: combinedTimeline.length
});
setTimelineItems(combinedTimeline);
  
  // ✅ 取得したデータでフィルター適用
  applyFilters(combinedTimeline);
  
  initializationRef.current = true;
}
const endTime = performance.now();
console.log(`✅ 高速データロード完了: ${Math.round(endTime - startTime)}ms`);



    } catch (error) {
      console.error('❌ データロードエラー:', error);
    } finally {
      isInitializing = false;
      if (isMounted) setLoading(false);
    }
  };
  
  loadDataFast();
  
  return () => {
    isMounted = false;
  };
}, []); // 空の依存配列で1回のみ実行


// ✅ Step 4: PostPage.tsxからの更新イベント監視システム
useEffect(() => {
  console.log('🎧 [HomePage] 投稿更新イベント監視を開始');
  
  // グローバル関数の定義
  window.refreshHomePage = () => {
    console.log('🔄 [HomePage] 手動リフレッシュ実行');
    // データ再取得処理
    // データ再取得処理（セキュリティ修正）
const refreshData = async () => {
  try {
    const userId = localStorage.getItem("daily-report-user-id");
    if (!userId) return;
    
    const allGroups = await UnifiedCoreSystem.getUserGroups(userId).catch(() => []);

    // セキュリティ修正: 参加権限チェック強化
    const userGroups = allGroups.filter(group => {
      const isCreator = group.createdBy === userId || group.adminId === userId;
      const isMember = group.members?.some(member => {
        const memberId = typeof member === 'string' ? member : member.id;
        return memberId === userId;
      });
      return isCreator || isMember;
    });

    console.log('🔒 セキュリティチェック (リフレッシュ): 参加グループ', userGroups.length, '/', allGroups.length);

    // 投稿データの取得 - 参加確認済みグループのみ
    let allPosts: any[] = [];
    try {
      console.log('🔍 [Home] 参加確認済みグループの投稿のみ取得中...');
      

      // ⭐ リフレッシュも効率的な取得方法を使用 ⭐
const groupIds = userGroups.map(g => g.id);
console.log(`📊 [リフレッシュロード] ${groupIds.length}グループから最新10件を一括取得`);

allPosts = await UnifiedCoreSystem.getLatestPostsFromMultipleGroups(
  groupIds,
  30  // 初回表示する30件
);

// ⭐ デバッグ2: refreshHomePage - Firestore取得直後
console.log('🔍 [DEBUG-refreshHomePage] Firestoreから取得した投稿数:', allPosts.length);
console.log('🔍 [DEBUG-refreshHomePage] Firestoreから取得した最初の3件:', 
  allPosts.slice(0, 3).map(p => ({
    id: p.id?.substring(0, 8),
    timestamp: p.timestamp,
    createdAt: p.createdAt,
    timestampType: typeof p.timestamp,
    createdAtType: typeof p.createdAt
  }))
);

// グループ名を各投稿に追加
allPosts = allPosts.map(post => {
  const group = userGroups.find(g => g.id === post.groupId);
  return {
    ...post,
    groupName: group?.name || 'グループ名なし',
    memos: []
  };
});

console.log(`✅ [Home] リフレッシュ完了: ${allPosts.length}件の投稿を取得`);

      
      // 時系列でソート（新しい順）
      allPosts.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      
      console.log('✅ [Home] セキュアリフレッシュ完了:', allPosts.length, '件');
      
    } catch (error) {
      console.error('❌ [Home] 投稿取得エラー:', error);
      allPosts = [];
    }

    
        
     // 全投稿からユーザーIDを抽出
const userIds = allPosts
  .map(post => post.authorId || post.userId || post.userID)
  .filter((id): id is string => !!id);

console.log('🚀 [refreshHomePage] バッチでユーザー名取得開始:', userIds.length, '人');

// バッチで一括取得
const userNamesMap = await getDisplayNamesBatch(userIds);

console.log('✅ [refreshHomePage] バッチ取得完了:', userNamesMap.size, '件');

// ユーザー名と画像を追加
const enrichedPosts = allPosts.map(post => {
  const userId = post.authorId || post.userId || post.userID;
  const username = userId && userNamesMap.has(userId) 
    ? userNamesMap.get(userId)! 
    : post.username || 'ユーザー';
  
  // 画像取得
  const photos = post.photoUrls || [];
  
  return {
    ...post,
    username,
    photoUrls: photos,
    images: photos
  };
});
   

console.log('✅ [Home] ユーザー名・写真マージ完了（リフレッシュ）:', enrichedPosts.length, '件');

// ⭐ デバッグ5: refreshHomePage - enrichedPosts（ソート前）
console.log('🔍 [DEBUG-refreshHomePage] enrichedPosts（ソート前）の最初の3件:', 
  enrichedPosts.slice(0, 3).map(p => ({
    id: p.id?.substring(0, 8),
    timestamp: p.timestamp,
    timestampType: typeof p.timestamp,
    sortKey: p.timestamp || 0
  }))
);


// ⭐ enrichedPostsを新しい順にソート
enrichedPosts.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
console.log('🔄 [HomePage] 投稿を時系列でソート完了');

// ⭐ デバッグ6: refreshHomePage - ソート後
console.log('🔍 [DEBUG-refreshHomePage] enrichedPosts（ソート後）の最初の3件:', 
  enrichedPosts.slice(0, 3).map(p => ({
    id: p.id?.substring(0, 8),
    timestamp: p.timestamp,
    timestampType: typeof p.timestamp,
    sortKey: p.timestamp || 0
  }))
);

setPosts(enrichedPosts);
setTimelineItems(enrichedPosts);

// 新しいデータでフィルター適用
applyFilters(enrichedPosts);

console.log('✅ [HomePage] データリフレッシュ完了:', enrichedPosts.length, '件');

// ★ 最新投稿時刻を更新（新着チェック用）
// ⚠️ この処理は削除（バナークリック時の設定を上書きしてしまうため）
// enrichedPostsはフィルター済みデータなので、真の最新投稿ではない可能性がある
// 最新投稿時刻の更新は、バナークリック時のFirestore直接取得のみで行う
/*
if (enrichedPosts.length > 0) {
  const latestTime = enrichedPosts[0].timestamp || enrichedPosts[0].createdAt?.toMillis?.() || 0;
  if (latestTime > 0) {
    setLatestPostTime(latestTime);
    console.log('🕐 [HomePage] 最新投稿時刻を更新:', new Date(latestTime).toLocaleString('ja-JP'));
    
    // ★ リフレッシュ時も「見た」記録を保存
    const userId = localStorage.getItem('daily-report-user-id');
    if (userId) {
      saveLastViewedTimestamp(userId, latestTime + 100);
      console.log('💾 [HomePage] リフレッシュ時 - lastViewed保存:', new Date(latestTime + 100).toLocaleString('ja-JP'));
    }
  }
}
*/

} catch (error) {
  console.error('❌ [HomePage] データリフレッシュエラー:', error);
      } finally {
        // ✅ ローディング終了
        setLoading(false);
      }
    };
    
    refreshData();
  };
  
  // PostPage.tsxからの更新イベント監視
  const handlePostsUpdate = (event: any) => {
    console.log('📢 [HomePage] 投稿更新イベントを受信:', event.detail);
    
    // 即座にデータ再取得
    if (window.refreshHomePage) {
      window.refreshHomePage();
    }
  };
  
  
  // イベントリスナーの設定
  window.addEventListener('postsUpdated', handlePostsUpdate);
  window.addEventListener('refreshPosts', handlePostsUpdate);
  
 // ⭐ 初回データ取得はloadDataFastで実行済み
  // window.refreshHomePage()は手動リフレッシュ用のみ使用
  
  
  // クリーンアップ
  return () => {
    console.log('🔌 [HomePage] 更新イベント監視を終了');
    window.removeEventListener('postsUpdated', handlePostsUpdate);
    window.removeEventListener('refreshPosts', handlePostsUpdate);
    
    // グローバル関数のクリーンアップ
    if (window.refreshHomePage) {
      delete window.refreshHomePage;

    }
  };
}, []); // 空の依存配列で1回のみ実行

// 🔵 既読ユーザー表示モーダルのイベントリスナー
useEffect(() => {
  const handleOpenReadByModal = (event: CustomEvent) => {
    const post = event.detail;
    
    
    setSelectedPostForReadBy(post);
    setReadByModalOpen(true);
  };

  window.addEventListener('openReadByModal', handleOpenReadByModal as EventListener);

  return () => {
    window.removeEventListener('openReadByModal', handleOpenReadByModal as EventListener);
  };
}, []);

// ⭐ 新着チェックタイマー（60秒ごと）⭐
useEffect(() => {
  // 初回ロードが完了していない場合はスキップ
  if (posts.length === 0) {
    console.log('⏭️ [HomePage] 投稿データなし、新着チェックタイマーをスキップ');
    return;
  }
  console.log('⏰ [HomePage] 新着チェックタイマー開始');
  
  // 新着チェック関数
  const checkForNewPosts = async (currentPosts: Post[] = posts) => {
  if (justDeleted) {
    console.log('⏭️ [新着チェック] 削除直後のためスキップ');
    return;
  }
  
  
  try {
    console.log('🔍 [HomePage] 新着チェック開始');
    const currentTime = latestPostTimeRef.current;
    console.log('📊 [HomePage] 現在の最新投稿時刻:', {
  'state値': latestPostTime > 0 ? new Date(latestPostTime).toLocaleString('ja-JP') : '未設定',
  'ref値': currentTime > 0 ? new Date(currentTime).toLocaleString('ja-JP') : '未設定',
  '一致': latestPostTime === currentTime
});
    
    const userId = localStorage.getItem('daily-report-user-id');
    if (!userId) return;
      
      // Firestoreから最新の投稿1件を取得（参加グループのみ）✅
const { collection, query, orderBy, limit, getDocs, where } = await import('firebase/firestore');
const { getFirestore } = await import('firebase/firestore');
const db = getFirestore();



// 🔍 デバッグ：currentPostsの中身を確認
console.log('🔍 [DEBUG] currentPosts:', currentPosts);
console.log('🔍 [DEBUG] currentPosts.length:', currentPosts.length);
if (currentPosts.length > 0) {
  console.log('🔍 [DEBUG] 最初の投稿:', currentPosts[0]);
  console.log('🔍 [DEBUG] 最初の投稿のgroupId:', currentPosts[0].groupId);
}

// 🔧 参加グループのIDリストを取得（currentPostsから判定）
const myGroupIds = Array.from(new Set(currentPosts.map(post => post.groupId))).filter(Boolean);

console.log('🔍 [HomePage] 取得したグループID:', myGroupIds);

// グループIDが0件の場合は新着チェックをスキップ
if (myGroupIds.length === 0) {
  console.log('⏭️ [HomePage] 参加グループIDなし、新着チェックをスキップ');
  return;
}

const postsRef = collection(db, 'posts');
const q = query(
  postsRef,
  where('groupId', 'in', myGroupIds), // ✅ 参加グループのみフィルター
  orderBy('createdAt', 'desc'),
  limit(1)
);
      
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        const latestPost = snapshot.docs[0].data();
        const latestTime = latestPost.createdAt?.toDate 
  ? latestPost.createdAt.toDate().getTime() 
  : (typeof latestPost.createdAt === 'number' ? latestPost.createdAt : 0);

        
       // ⭐ ログ出力（デバッグ用）
console.log('🔍 [新着チェック] 最新投稿時刻:', {
  latest: latestTime > 0 ? new Date(latestTime).toLocaleString('ja-JP') : 'Invalid',
  current: currentTime > 0 ? new Date(currentTime).toLocaleString('ja-JP') : '未設定',
  差分: latestTime - currentTime,
  新着あり: (latestTime - currentTime) > 1000
});
        
        // 新着投稿があるかチェック
        const TOLERANCE_MS = 1000; // 1秒
if (latestTime > 0 && currentTime > 0 && (latestTime - currentTime) > TOLERANCE_MS) {
          const latestPostAuthorId = latestPost.authorId || latestPost.userId || latestPost.createdBy;

          // 🔍 デバッグログを追加
console.log('🔍 [新着チェック] ユーザーID比較:', {
  latestPostAuthorId,
  currentUserId: userId,
  authorIdExists: !!latestPost.authorId,
  userIdExists: !!latestPost.userId,
  createdByExists: !!latestPost.createdBy,
  match: latestPostAuthorId === userId
});
          
          // 自分の投稿は除外
          if (latestPostAuthorId === userId) {
  console.log('⏭️ [HomePage] 自分の投稿のため新着バナー非表示');
  setLatestPostTime(latestTime + 100);
  
  // localStorage も更新
  if (userId) {
    saveLastViewedTimestamp(userId, latestTime + 100);
  }
  console.log('✅ [HomePage] 最新投稿時刻を更新:', new Date(latestTime).toLocaleString('ja-JP'));
} else {
  console.log('🆕 [HomePage] メンバーの新着投稿を検知！バナー表示ON');
setBannerType('newPost'); // ← この行を追加
setHasNewPosts(true);
  
  // 最新投稿時刻を更新
  setLatestPostTime(latestTime + 100);
  
  // localStorage も更新
  if (userId) {
    saveLastViewedTimestamp(userId, latestTime + 100);
  }
}
        } else {
          console.log('ℹ️ [HomePage] 新着投稿なし');
        }
      }
    } catch (error) {
      console.error('❌ [HomePage] 新着チェック失敗:', error);
    }
  };
  
 
  

  // 60秒ごとに新着チェックを実行
  const newPostCheckInterval = setInterval(() => checkForNewPosts(posts), 60000);
  
  return () => {
    console.log('🛑 [HomePage] 新着チェックタイマー停止');
    clearInterval(newPostCheckInterval);
  };
}, [justDeleted, posts.length]);


useEffect(() => {
  const handleScroll = () => {
    const scrollPosition = window.innerHeight + window.scrollY;
    const bottomThreshold = document.body.offsetHeight - 800;
    
    // 🌟 デバッグログ追加
    console.log('📏 スクロール位置:', scrollPosition, 'しきい値:', bottomThreshold);
    
    if (scrollPosition >= bottomThreshold) {
      // 検索中かどうかをチェック
      const isSearching = searchQuery.trim() !== '' || startDate !== '' || endDate !== '';
      
      // まず最初にRefでガード（最優先）
      if (isLoadingMoreRef.current) {
        console.log('⏸️ 既にローディング中（Ref）のためスキップ');
        return;
      }
  if (!isLoadingMore && hasMore && !loading && !isSearching) {
  console.log('🔄 スクロール検知: 次のデータを自動読み込み');
  
  // Phase A3: まずメモリ内のデータを表示（超高速！）
 console.log('🔍 [Phase判定] displayedPostsCount:', displayedPostsCountRef.current, 'filteredItems.length:', filteredItems.length);
  
  // displayedPostsCountが filteredItems.length を超えている場合は修正
  if (displayedPostsCountRef.current > filteredItems.length) {
    console.log('⚠️ displayedPostsCountを修正:', displayedPostsCountRef.current, '→', filteredItems.length);
    displayedPostsCountRef.current = filteredItems.length;
    setDisplayedPostsCount(filteredItems.length);
  }
  
  if (displayedPostsCountRef.current < filteredItems.length && filteredItems.length > 0) {
    console.log('📦 [Phase A3] メモリから追加表示:', displayedPostsCountRef.current, '→', displayedPostsCountRef.current + POSTS_PER_LOAD);
    setDisplayedPostsCount(prev => prev + POSTS_PER_LOAD);
    displayedPostsCountRef.current += POSTS_PER_LOAD;
    return; // Firestoreアクセスなし！即座に表示！
  }
  
  // Phase A4: メモリ内を全部表示したら、Firestoreから追加取得
  console.log('🔄 [Phase A4] Firestoreから追加取得開始');
  
  // デバウンス処理 - 既に pending のタイマーがあればキャンセル
 if (scrollTimeoutRef.current) {
  clearTimeout(scrollTimeoutRef.current);
}
  
  // 既にローディング中なら何もしない
  if (isLoadingMoreRef.current) {
    console.log('⏸️ 既にローディング中のためスキップ');
    return;
  }
  
 scrollTimeoutRef.current = setTimeout(() => {
  loadMorePosts();
}, 500);
      }  
    }
};
  window.addEventListener('scroll', handleScroll);
  return () => window.removeEventListener('scroll', handleScroll);
}, [isLoadingMore, hasMore, loading, loadMorePosts, posts, searchQuery, startDate, endDate]);


  // ★ 認証されていない場合のリダイレクト（別のuseEffect） ★
useEffect(() => {
  // 🌟 初期化中はチェックしない
  if (!initializationRef.current) {
    return;
  }
  
  const returnToDetail = sessionStorage.getItem('returnToDetail');
  
  // 🌟 トークンの存在も確認
  const token = localStorage.getItem('daily-report-user-token');
  
  if (!loading && !isAuthenticated && !returnToDetail && !token) {
    console.log('⚠️ 認証なし、3秒後にログインページへ');
    
    const authCheckDelay = setTimeout(() => {
      const stillReturning = sessionStorage.getItem('returnToDetail');
      const currentToken = localStorage.getItem('daily-report-user-token');
      
      if (!stillReturning && !isAuthenticated && !loading && !currentToken) {
        console.log('🔄 ログインページにリダイレクト');
        navigate('/login');
      } else {
        console.log('✅ 認証確認OK、リダイレクトキャンセル');
      }
    }, 3000);  // 🌟 2秒 → 3秒に延長
    
    return () => clearTimeout(authCheckDelay);
  }
}, [loading, isAuthenticated, navigate]);

 // グループTOPからの復帰処理
useEffect(() => {
  const returnToDetail = sessionStorage.getItem('returnToDetail');
  
  if (returnToDetail && posts.length > 0) {
    console.log('🔄 詳細モーダル復帰:', returnToDetail);
    
    // AuthGuardの干渉を防ぐため、認証状態を一時的に確実にする
    setIsAuthenticated(true);
    
    const targetPost = posts.find(post => post.id === returnToDetail);
    if (targetPost) {
      setSelectedPostForDetail(targetPost);
    }
    sessionStorage.removeItem('returnToDetail');
    setLoading(false);
  }
}, [posts]);

// キャッシュ管理用のuseEffect（新規追加）
useEffect(() => {
  if (posts.length > 0 && !loading) {
    postsCache = timelineItems;
    postsCacheTime = Date.now();
    console.log('💾 タイムラインキャッシュを更新:', timelineItems.length, '件');
console.log('🔍 [デバッグ] この時点のfilteredItems.length:', filteredItems.length);
  }
}, [posts, loading]);


  // 1. ステータスバッジのスタイルを取得（コンテナ用）
  // ステータスバッジのスタイルを取得（コンテナ用）
const getContainerStatusStyle = (status: string) => {
  const baseStyle = {
    padding: '0.3rem 0.8rem',    // 小さいサイズ
    borderRadius: '15px',
    fontSize: '0.75rem',         // 小さい文字
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



// ArchivePageのステータス更新処理修正版
// ステータス更新処理の修正版（デバッグログ強化）
 const handleStatusUpdate = async (postId: string, newStatus: string) => {
  try {
    const currentUserId = localStorage.getItem("daily-report-user-id") || "";
    
    console.log('🔄 [HomePage] ステータス更新開始:', postId, newStatus);
    
    // 1. Firestoreドキュメントを直接更新
    try {
      console.log('🔥 [HomePage] Firestore更新処理開始');
      
      const { doc, updateDoc, getFirestore } = await import('firebase/firestore');
      const { getApps } = await import('firebase/app');
      
      let db;
      if (getApps().length === 0) {
        console.error('❌ [HomePage] Firebase app not initialized');
        throw new Error('Firebase app not initialized');
      } else {
        db = getFirestore();
        console.log('✅ [HomePage] Firestore接続取得成功');
      }
      
      const postRef = doc(db, 'posts', postId);
      await updateDoc(postRef, {
        [`statusByUser.${currentUserId}`]: newStatus,  // 🔄 ユーザーごとに保存
        statusUpdatedAt: Date.now(),
        statusUpdatedBy: currentUserId
      });
      
      console.log('✅ [HomePage] Firestore更新完了:', postId, newStatus);

      // ✅ キャッシュクリア
postsCache = null;
postsCacheTime = 0;
console.log('🔄 [HomePage] ステータス更新 - キャッシュクリア');

      
    } catch (firestoreError) {
      console.error('❌ [HomePage] Firestore更新失敗:', firestoreError);
      alert('データベースの更新に失敗しました');
      return;
    }
    
    // 2. ローカル状態を更新
    console.log('🔄 [HomePage] ローカル状態更新開始');
    
   const updatedPosts = posts.map(post => 
      post.id === postId ? { 
        ...post, 
        statusByUser: {
          ...post.statusByUser,
          [currentUserId]: newStatus
        },
        statusUpdatedAt: Date.now(),
        statusUpdatedBy: currentUserId
      } : post
    );
    
    // ⭐ ArchivePageと同じ方式で更新
    setPosts(updatedPosts);
    setTimelineItems(updatedPosts);
    
    // ⭐ filteredItemsも同じパターンで更新（ArchivePageのsetFilteredPostsと同じ）
    setFilteredItems(prevItems => prevItems.map(item => {
      // アラートの場合はそのまま返す
      if ('type' in item && item.type === 'alert') {
        return item;
      }
      
      // 投稿の場合のみ更新
      const post = item as Post;
      if (post.id === postId) {
        return {
          ...post,
          statusByUser: {
            ...post.statusByUser,
            [currentUserId]: newStatus
          },
          statusUpdatedAt: Date.now(),
          statusUpdatedBy: currentUserId
        };
      }
      return post;
    }));
    
    console.log('✅ [HomePage] ステータス更新完了:', newStatus);
    console.log('✅ [HomePage] filteredItemsも更新完了（ArchivePageスタイル）');
    
  } catch (error) {
    console.error('❌ [HomePage] ステータス更新エラー:', error);
    alert('ステータスの更新に失敗しました');
  }
};

  // フィルター関数群
const filterByDate = (date: string | null) => {
  setSelectedDate(date);
};

const filterByGroup = (groupId: string | null) => {
  console.log('🔍 [HomePage] グループ選択:', groupId);
  setSelectedGroup(groupId);
};

const applyFilters = useCallback((items?: TimelineItem[]) => {
  const executionId = Date.now();
  console.log('🚀 [applyFilters] 実行開始 - ID:', executionId);
  
  // itemsが渡されない場合は現在のtimelineItemsを使用
  const targetItems = items || timelineItems;
  
  // ⭐ targetItemsが空の場合はスキップ
  if (targetItems.length === 0) {
    console.log('⚠️ [applyFilters] targetItemsが空なのでスキップ');
    return;
  }
  console.log('🚀 [applyFilters] 実行理由:', {
    startDate,
    endDate,
    searchQuery,
    selectedDate,
    selectedGroup
  });
  console.log('📊 [applyFilters] targetItems:', targetItems.length, '件');
  console.log('📊 [applyFilters] 最初の3件:', targetItems.slice(0, 3).map(item => ({
    id: 'id' in item ? (item as Post).id : 'alert',
    type: 'type' in item ? item.type : 'post'
  })));
  
  let filtered = [...targetItems];

  console.log('📊 [applyFilters] filtered初期化:', filtered.length, '件');

  // 検索クエリでフィルター
  if (searchQuery.trim()) {
    const keywords = searchQuery
      .toLowerCase()
      .split(/[\s,]+/)
      .filter(Boolean);

    const tagKeywords = keywords.filter((keyword) => keyword.startsWith('#'));
    const textKeywords = keywords.filter((keyword) => !keyword.startsWith('#'));
    
    const allKeywords = [...textKeywords, ...tagKeywords.map(tag => tag.substring(1))];
    
    const scoredItems = filtered.map(item => ({
      item: item,
      score: calculateSearchScoreForHome(item, allKeywords)
    }));
    
    filtered = scoredItems
      .filter(scored => scored.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(scored => scored.item);
  }
  

// ⭐ 日付範囲フィルター（開始日・終了日）- 根本的な修正版
console.log('🔍 [日付フィルター] 開始:', { 
  startDate, 
  endDate, 
  投稿数: filtered.length,
  投稿内容: filtered.slice(0, 3).map(item => ({
    id: 'id' in item ? item.id : 'alert',
    type: 'type' in item ? item.type : 'post',
    timestamp: 'timestamp' in item ? item.timestamp : 'なし'
  }))
});


// ⭐ 日付フィルターの条件を厳格化
const hasStartDate = startDate && startDate.trim() !== '';
const hasEndDate = endDate && endDate.trim() !== '';

console.log('🔍 [日付フィルター] 条件チェック:', {
  startDate,
  endDate,
  hasStartDate,
  hasEndDate,
  条件成立: hasStartDate || hasEndDate
});

if (hasStartDate || hasEndDate) {
  console.log('✅ 日付フィルター条件に入りました');
  console.log('📊 フィルター前の投稿数:', filtered.length);
  
  const beforeFilter = filtered.length;
  
  filtered = filtered.filter(item => {
    // アラートは除外
    if ('type' in item && item.type === 'alert') {
      console.log('⏭️ アラートをスキップ:', item);
      return true;
    }
    
    try {
      const post = item as Post;
      
      console.log('🔍 投稿をチェック:', {
        id: post.id,
        timestamp: post.timestamp,
        time: post.time,
        timestampの型: typeof post.timestamp
      });
      
      // timestampが存在しない場合はスキップ
      if (!post.timestamp) {
        console.log('⚠️ timestampなし、スキップ:', post.id);
        return true;
      }
      
      // ⭐ 投稿日時を取得
      const postDateTime = new Date(post.timestamp);
      console.log('📅 postDateTime:', postDateTime.toLocaleString('ja-JP'));
      
      // ⭐ 投稿日付のみ抽出（時刻を0時0分0秒にリセット）
      const postDateOnly = new Date(
        postDateTime.getFullYear(),
        postDateTime.getMonth(),
        postDateTime.getDate()
      );
      console.log('📅 postDateOnly:', postDateOnly.toLocaleDateString('ja-JP'));
      console.log('📅 postDateOnly.getTime():', postDateOnly.getTime());
      
      // ⭐ 開始日チェック
console.log('🔍 開始日チェック開始');
if (hasStartDate) {
        console.log('📅 startDate:', startDate);
        const startDateOnly = new Date(startDate);
        startDateOnly.setHours(0, 0, 0, 0);
        console.log('📅 startDateOnly:', startDateOnly.toLocaleDateString('ja-JP'));
        console.log('📅 startDateOnly.getTime():', startDateOnly.getTime());
        
        console.log('🔍 比較:', postDateOnly.getTime(), '<', startDateOnly.getTime(), '?');
        
        // .getTime()でミリ秒値として比較
        if (postDateOnly.getTime() < startDateOnly.getTime()) {
          console.log('❌ 開始日より前:', post.id);
          return false;
        }
        console.log('✅ 開始日チェック通過');
      }
      
      // ⭐ 終了日チェック
console.log('🔍 終了日チェック開始');
if (hasEndDate) {
        console.log('📅 endDate:', endDate);
        const endDateOnly = new Date(endDate);
        endDateOnly.setHours(0, 0, 0, 0);
        console.log('📅 endDateOnly:', endDateOnly.toLocaleDateString('ja-JP'));
        console.log('📅 endDateOnly.getTime():', endDateOnly.getTime());
        
        console.log('🔍 比較:', postDateOnly.getTime(), '>', endDateOnly.getTime(), '?');
        
        // .getTime()でミリ秒値として比較
        if (postDateOnly.getTime() > endDateOnly.getTime()) {
          console.log('❌ 終了日より後:', post.id);
          return false;
        }
        console.log('✅ 終了日チェック通過');
      }
      
      console.log('✅ 範囲内:', post.id, postDateOnly.toLocaleDateString());
      return true;
      
    } catch (error) {
      console.error('❌ 日付フィルターエラー:', error);
      return true;
    }
    });
  
  const afterFilter = filtered.length;
  console.log('📊 フィルター後の投稿数:', afterFilter);
  console.log('📊 除外された投稿数:', beforeFilter - afterFilter);
}

console.log('✅ [日付フィルター] 完了:', { 
  残り投稿数: filtered.length,
  最初の3件: filtered.slice(0, 3).map(item => ({
    id: 'id' in item ? item.id : 'alert',
    date: 'time' in item ? (item as Post).time?.split('　')[0] : '今日'
  }))
});

  // 特定日付でフィルター（カレンダー選択）
  if (selectedDate) {
    filtered = filtered.filter(item => {
      if ('type' in item && item.type === 'alert') {
        const today = formatDate(new Date());
        return today === selectedDate;
      } else {
        return (item as Post).time.includes(selectedDate);
      }
    });
  }
  
  // グループでフィルター
  if (selectedGroup) {
    filtered = filtered.filter(item => {
      if ('type' in item && item.type === 'alert') {
        return (item as AlertInfo).groupId === selectedGroup;
      } else {
        return (item as Post).groupId === selectedGroup;
      }
    });
  }
  

  // ⭐ フィルター結果が変わっていない場合はスキップ
  if (filtered.length === filteredItems.length) {
    const sameIds = filtered.every((item, index) => {
      const itemId = 'id' in item ? item.id : '';
      const currentId = 'id' in filteredItems[index] ? filteredItems[index].id : '';
      return itemId === currentId;
    });
    
    if (sameIds) {
      console.log('⏭️ [applyFilters] 結果が同じなのでスキップ');
      return;
    }
  }

  console.log('🎯 [applyFilters] setFilteredItems実行直前');
console.log('🎯 [applyFilters] filteredの長さ:', filtered.length);
console.log('🎯 [applyFilters] filteredの内容:', filtered.slice(0, 3).map(item => ({
  id: 'id' in item ? item.id : 'alert',
  date: 'time' in item ? (item as Post).time?.split('　')[0] : '今日'
})));

setFilteredItems(filtered);

// ⭐ 検索・フィルター中はこれ以上データがない
const isSearching = searchQuery.trim() !== '' || startDate !== '' || endDate !== '' || selectedGroup !== null;
   if (isSearching) {
     setHasMore(false);
   }

console.log('✅ [applyFilters] 完了！ - ID:', executionId);
console.log('✅ [applyFilters] 設定した件数:', filtered.length);
}, [searchQuery, startDate, endDate, selectedDate, selectedGroup]);

// 🔍 検索・フィルタリング処理
  useEffect(() => {
    console.log('🔥 [HomePage検索useEffect] 実行 - 条件:', {
      searchQuery,
      startDate,
      endDate,
      selectedGroup,
      postsLength: posts.length
    });
    (async () => {
      // ⭐ 初期化時（全て空 & posts未ロード）はスキップ
      if (!searchQuery && !startDate && !endDate && !selectedGroup && posts.length === 0) {
        console.log('⏭️ [HomePage検索] 初期化時のためスキップ');
        return;
      }
      
      console.log('🔍 [HomePage検索デバッグ] 検索開始:', searchQuery);
 
  
  // 🆕 検索条件がある場合、Firestoreから全件取得して検索
  if (searchQuery || startDate || endDate || selectedGroup) {
    setIsCountingResults(true);
    setIsSearchActive(true);
    
    // 非同期処理で全件取得
    (async () => {
      try {
        // 1. Firestoreから全投稿を取得
        const userId = localStorage.getItem('daily-report-user-id') || '';
        console.log('📥 [HomePage検索] Firestoreから全件取得開始...');
        
        const allGroups = await UnifiedCoreSystem.getUserGroups(userId).catch(() => []);
        const userGroups = allGroups.filter(group => {
          const isCreator = group.createdBy === userId || group.adminId === userId;
          const isMember = group.members?.some(member => {
            const memberId = typeof member === 'string' ? member : member.id;
            return memberId === userId;
          });
          return isCreator || isMember;
        });
        
        const groupIds = userGroups.map(g => g.id);
        
        const result = await UnifiedCoreSystem.getLatestPostsFromMultipleGroups(
          groupIds,
          999  // 大きな数値で全件取得
        );
        
        const allPosts = result;
        console.log('📥 [HomePage検索] Firestoreから全件取得完了:', allPosts.length, '件');
        
        // 🌟 全投稿のメモを取得
        console.log('📝 [HomePage検索] メモを取得中...');
        const postsWithMemos = await Promise.all(
          allPosts.map(async (post) => {
            try {
              const memos = await MemoService.getPostMemosForUser(post.id, userId);
              return {
                ...post,
                memos: memos
              };
            } catch (error) {
              console.error('メモ取得エラー:', post.id, error);
              return post;
            }
          })
        );
        console.log('✅ [HomePage検索] メモ取得完了');
        
        
        // ⭐ キーワード分割（ArchivePageと同じ）
        const keywords = searchQuery
          .toLowerCase()
          .split(/[\s,]+/)
          .filter(Boolean);
        
        const textKeywords = keywords.filter(k => !k.startsWith('#'));
        const tagKeywords = keywords.filter(k => k.startsWith('#')).map(k => k.substring(1));
        
        console.log('🔍 [HomePage検索デバッグ] テキストキーワード:', textKeywords);
        console.log('🔍 [HomePage検索デバッグ] タグキーワード:', tagKeywords);
        
        // ⭐ キーワード検索なしの場合（日付のみ）
        if (keywords.length === 0) {
          const filtered = postsWithMemos.filter(post => {
            try {
              let postDate: Date | null = null;
              
              if (post.timestamp) {
                if (typeof post.timestamp === 'number') {
                  postDate = new Date(post.timestamp);
                } else if (typeof (post.timestamp as any).toDate === 'function') {
                  postDate = (post.timestamp as any).toDate();
                } else if ((post.timestamp as any).seconds) {
                  postDate = new Date((post.timestamp as any).seconds * 1000);
                }
              } else if (post.createdAt) {
                if (typeof post.createdAt === 'number') {
                  postDate = new Date(post.createdAt);
                } else if (typeof (post.createdAt as any).toDate === 'function') {
                  postDate = (post.createdAt as any).toDate();
                } else if ((post.createdAt as any).seconds) {
                  postDate = new Date((post.createdAt as any).seconds * 1000);
                }
              }
              
              if (!postDate || isNaN(postDate.getTime())) {
                return true;
              }
              
              const postDateOnly = new Date(
                postDate.getFullYear(),
                postDate.getMonth(),
                postDate.getDate()
              );
              
              if (startDate) {
                const start = new Date(startDate);
                const startDateOnly = new Date(
                  start.getFullYear(),
                  start.getMonth(),
                  start.getDate()
                );
                if (postDateOnly < startDateOnly) return false;
              }
              
              if (endDate) {
                const end = new Date(endDate);
                const endDateOnly = new Date(
                  end.getFullYear(),
                  end.getMonth(),
                  end.getDate(),
                  23, 59, 59, 999
                );
                if (postDateOnly > endDateOnly) return false;
              }
              
              return true;
            } catch (error) {
              console.error('❌ 日付フィルターエラー:', error);
              return true;
            }
          });
          
          // ⭐ ユーザー名・グループ名を追加（enrichment）
          const enrichedFiltered = await Promise.all(
            filtered.map(async (post) => {
              try {
                // ユーザー名を取得
               const username = DisplayNameResolver.resolve(post);
                
                // グループ名を取得
                let groupName = post.groupName || '';
                if (post.groupId && !groupName) {
                  try {
                    const { doc, getDoc, getFirestore } = await import('firebase/firestore');
                    const db = getFirestore();
                    const groupDoc = await getDoc(doc(db, 'groups', post.groupId));
                    if (groupDoc.exists()) {
                      groupName = groupDoc.data()?.name || '';
                    }
                  } catch (error) {
                    console.error('グループ名取得エラー:', error);
                  }
                }
                
                return {
                  ...post,
                  username,
                  groupName
                };
              } catch (error) {
                console.error('ユーザー名取得エラー:', error);
                return post;
              }
            })
          );
          
          // ⭐ グループフィルターを適用
          let finalFiltered = enrichedFiltered;
          if (selectedGroup) {
            finalFiltered = enrichedFiltered.filter(post => post.groupId === selectedGroup);
            console.log('🔍 [HomePage検索] グループフィルター適用:', {
              元の件数: enrichedFiltered.length,
              絞り込み後: finalFiltered.length,
              グループID: selectedGroup
            });
          }
          
          setFilteredItems(finalFiltered);
setSearchResultCount(finalFiltered.length);
setDisplayLimit(finalFiltered.length);
setDisplayedPostsCount(finalFiltered.length);
setHasMore(false);  // ← 追加!
setIsCountingResults(false);
console.log('📊 [HomePage検索結果・日付のみ] 総件数:', finalFiltered.length);
return;
        }
        
        // ⭐ テキスト検索を開始（ArchivePageと同じ）
        console.log('🔍 [HomePage検索デバッグ] テキスト検索を開始します');
        
        // ⭐ Promise.allを使って非同期処理を実行
const resultsWithNames = await Promise.all(
  postsWithMemos.map(async (post) => {
    const displayName = await getDisplayNameSafe(post.userId);
    return { post, displayName };
  })
);

let results = resultsWithNames
  .map(({ post, displayName }) => {
    // ユーザー名を投稿に追加
    const postWithUsername = {
      ...post,
      username: displayName
    };
    
    // スコアを計算（メモ検索も含む）
    const score = calculateSearchScoreForHome(postWithUsername, keywords);
    
    return { post: postWithUsername, score };
  })
  .filter(({ score }) => score > 0)  // スコアが0より大きいものだけ
  .sort((a, b) => b.score - a.score)  // スコア順にソート
  .map(({ post }) => post);  // postだけを取り出す
        
        console.log('🔍 [HomePage検索デバッグ] テキスト検索後の結果数:', results.length);
        
        // ⭐ 日付フィルター（ArchivePageと同じ）
        if (startDate || endDate) {
          console.log('📅 [HomePage日付フィルター] 開始:', {
            startDate,
            endDate,
            投稿数: results.length
          });
          
          results = results.filter(post => {
            try {
              let postDate: Date | null = null;
              
              if (post.timestamp) {
                if (typeof post.timestamp === 'number') {
                  postDate = new Date(post.timestamp);
                } else if (post.timestamp && typeof (post.timestamp as any).toDate === 'function') {
                  postDate = (post.timestamp as any).toDate();
                } else {
                  postDate = new Date(post.timestamp);
                }
              } else if (post.createdAt) {
                if (typeof post.createdAt === 'number') {
                  postDate = new Date(post.createdAt);
                } else if (post.createdAt && typeof (post.createdAt as any).toDate === 'function') {
                  postDate = (post.createdAt as any).toDate();
                } else {
                  postDate = new Date();
                }
              }
              
              if (!postDate || isNaN(postDate.getTime())) {
                return true;
              }
              
              const postDateOnly = new Date(
                postDate.getFullYear(),
                postDate.getMonth(),
                postDate.getDate()
              );
              
              if (startDate) {
                const startDateOnly = new Date(
                  new Date(startDate).getFullYear(),
                  new Date(startDate).getMonth(),
                  new Date(startDate).getDate()
                );
                if (postDateOnly < startDateOnly) {
                  return false;
                }
              }
              
              if (endDate) {
                const endDateOnly = new Date(
                  new Date(endDate).getFullYear(),
                  new Date(endDate).getMonth(),
                  new Date(endDate).getDate()
                );
                if (postDateOnly > endDateOnly) {
                  return false;
                }
              }
              
              return true;
            } catch (error) {
              console.error('❌ 日付フィルターエラー:', error);
              return true;
            }
          });
          
          console.log('✅ [HomePage日付フィルター] 完了:', { 残り投稿数: results.length });
        }
        console.log('🚀 [HomePage検索] enrichment処理開始 - 対象投稿数:', results.length);

const enrichedTextResults = await Promise.all(
  results.map(async (post) => {
    try {
      // ユーザー名を取得
      const username = DisplayNameResolver.resolve(post);
      
      // グループ名を取得
      let groupName = post.groupName || '';
      if (post.groupId && !groupName) {
  try {
    const { doc, getDoc, getFirestore } = await import('firebase/firestore');
    const db = getFirestore();
    const groupDoc = await getDoc(doc(db, 'groups', post.groupId));
    if (groupDoc.exists()) {
      groupName = groupDoc.data()?.name || '';
    }
  } catch (error) {
    console.error('グループ名取得エラー:', error);
  }
}
      
      return {
        ...post,
        username,
        groupName
      };
            } catch (error) {
              console.error('ユーザー名取得エラー:', error);
              return post;
            }
          })
        );

        // ⭐ グループフィルターを適用
        let finalResults = enrichedTextResults;
        if (selectedGroup) {
          finalResults = enrichedTextResults.filter(post => post.groupId === selectedGroup);
          console.log('🔍 [HomePage検索] グループフィルター適用:', {
            元の件数: enrichedTextResults.length,
            絞り込み後: finalResults.length,
            グループID: selectedGroup
          });
        }
        
        // ⭐ 検索結果を設定
        setFilteredItems(finalResults);
setSearchResultCount(finalResults.length);
setDisplayLimit(finalResults.length);
setDisplayedPostsCount(finalResults.length);
setHasMore(false);  // ← 追加!
setIsCountingResults(false);
        console.log('📊 [HomePage検索結果] 総件数:', finalResults.length);
        
      } catch (error) {
        console.error('❌ [HomePage検索] 全件取得失敗:', error);
        setIsCountingResults(false);
      }
    })();
  } 
  
  // ⭐ 検索・フィルター実行時は表示件数をリセット
  if (searchQuery || startDate || endDate || selectedGroup) {
    setDisplayLimit(999);
  } else {
    setDisplayLimit(10);
    setHasMore(true);
  }
})();  // ← 追加: async即時実行関数の終了
  }, [searchQuery, startDate, endDate, selectedGroup]);

const resetFilters = () => {
  setSearchQuery('');
  setSearchInput('');  // ⭐ 追加：input要素の値もクリア
  setStartDate('');
  setEndDate('');
  setSelectedDate(null);
  setSelectedGroup(null);
  
  // ⭐ 検索結果をクリアして元のデータに戻す
  setFilteredItems(posts);
  setSearchResultCount(null);
  setIsSearchActive(false);
  
  // ⭐ 表示件数を初期値に戻す
  setDisplayLimit(10);
  setHasMore(true);
  
  console.log('🔄 [HomePage] フィルターをクリア - 全投稿を表示:', posts.length);
};

  const hasFilterConditions = selectedDate || selectedGroup || searchQuery || startDate || endDate;
  const filterBackgroundHeight = hasFilterConditions ? '520px' : '450px';
  const contentPaddingTop = hasFilterConditions ? '520px' : '450px';

  if (!loading && !isAuthenticated) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>認証確認中...</div>;
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#ffffff',
        padding: '1.5rem',
        boxSizing: 'border-box',
        paddingBottom: '80px',
      }}
    >
      <Header 
        title="NIPPO" 
        showSearchIcon={true} 
        onSearchClick={toggleFilter} 
        isSearchActive={showFilter}
      />

      {/* ⭐ 新着通知バナー（画面上部固定表示） ⭐ */}
      {hasNewPosts && (
        <div
          style={{
            position: 'fixed',
            top: '100px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000,
            backgroundColor: '#8B1C1C', 
            color: '#FFFFFF',
            padding: '15px 25px',  
            borderRadius: '10px',
            
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'row', 
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.9rem',
            fontWeight: '500',
            maxWidth: '90%',
            whiteSpace: 'nowrap',
          }}
          onClick={async () => {
  // バナーを非表示
  setHasNewPosts(false);
  
  // bannerTypeに応じて処理を分岐
  if (bannerType === 'reload') {
    // リロード時バナー: バナーを消すだけ
    console.log('✅ [HomePage] リロード時バナーを閉じました');
    return;
  }
  
  // 新着検知バナー: データ再取得
  console.log('🔄 [HomePage] 新着バナーをクリック - 再取得開始');
  
  const userId = localStorage.getItem('daily-report-user-id');
  if (userId) {
    // Firestoreから直接最新の投稿時刻を取得
    const fetchLatestPostTime = async () => {
      try {
        const { collection, query, orderBy, limit, getDocs } = await import('firebase/firestore');
        const { getFirestore } = await import('firebase/firestore');
        const db = getFirestore();
        
        const postsRef = collection(db, 'posts');
        const q = query(postsRef, orderBy('createdAt', 'desc'), limit(1));
        const snapshot = await getDocs(q);
        
        if (!snapshot.empty) {
          const latestPost = snapshot.docs[0].data();
          const latestTime = latestPost.createdAt?.toDate
            ? latestPost.createdAt.toDate().getTime()
            : (typeof latestPost.createdAt === 'number' ? latestPost.createdAt : 0);
          
          if (latestTime > 0) {
            console.log('👉 [HomePage] バナークリック時に最新時刻を更新:', new Date(latestTime).toLocaleString('ja-JP'));
            setLatestPostTime(latestTime);
            saveLastViewedTimestamp(userId, latestTime);
            console.log('🔍 [デバッグ] setLatestPostTime実行後:', {
              '設定した値': latestTime,
              '現在のstate値': latestPostTime,
              '現在のref値': latestPostTimeRef.current
            });
          }
        }
      } catch (error) {
        console.error('❌ [HomePage] 最新投稿時刻の取得エラー:', error);
      }
    };
    
    fetchLatestPostTime();
  }
  
  // データを再取得
  setLoading(true);
  if (window.refreshHomePage) {
    window.refreshHomePage();
  }
}}
        >
          <span>
  {bannerType === 'newPost' ? '新着投稿があります' : '投稿を読み込みました'}
</span>
{bannerType === 'newPost' && <span>更新</span>}
        </div>
      )}
        
      <style>
        {`
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-10px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}
      </style>

      <div style={{ 
        maxWidth: '480px', 
        margin: '0 auto',
        paddingTop: showFilter ? contentPaddingTop : '70px',
        transition: 'padding-top 0.3s ease',
      }}>
       
        {showFilter && (
          <>
            <div 
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 70,
                backgroundColor: 'transparent',
              }}
              onClick={() => setShowFilter(false)}
            />

            <div 
              id="filter-background-layer"
              style={{
                position: 'fixed', 
                top: 0,
                left: 0,
                width: '100%',
                height: filterBackgroundHeight,
                backgroundColor: '#055A68',
                zIndex: 80,
                backdropFilter: 'blur(4px)',
                animation: 'fadeIn 0.3s ease',
                transition: 'height 0.3s ease',
              }}
              onClick={() => setShowFilter(false)}
            />
            
            {/* ✕ 閉じるボタン - グリーン領域の右上 */}
            <button
              onClick={() => setShowFilter(false)}
              style={{
                position: 'fixed',
                top: '75px',
                right: '1.5rem',
                zIndex: 100,
                width: '40px',
                height: '40px',
                padding: '0',
                borderRadius: '0',
                aspectRatio: '1',
                backgroundColor: 'transparent',
border: 'none',
                color: '#FFFFFF',
                fontSize: '24px',
                fontWeight: 'bold',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backdropFilter: 'blur(4px)',
                transition: 'all 0.2s ease',
                animation: 'fadeIn 0.3s ease',
              }}
            >
              ✕
            </button>

            <div
              style={{
                position: 'fixed',
                top: '130px',
                left: 0,
                width: '100%',
                zIndex: 90,
                padding: '0 1.5rem',
                boxSizing: 'border-box',
                animation: 'fadeIn 0.3s ease',
              }}
            >
              <div 
                style={{
                  backgroundColor: '#E6EDED',
                  borderRadius: '12px',
                  padding: '1rem',
                  boxShadow: '0 4px 10px rgba(0, 102, 114, 0.2)',
                  border: '1px solid rgba(0, 102, 114, 0.1)',
                  maxWidth: '480px',
                  marginTop: '0',
marginLeft: 'auto',
marginRight: 'auto',
marginBottom: '-20px',
                  position: 'relative',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                
                <div style={{ 
                  margin: '1rem 1rem 1rem 1rem'  
                }}>
                  <div style={{ position: 'relative' }}>
                    <div style={{
                      position: 'absolute',
                      left: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="rgba(0, 102, 114, 0.6)"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <circle cx="11" cy="11" r="8" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                      </svg>
                    </div>
                    <input
  type="text"
  value={searchInput}
  onChange={(e) => {
    setSearchInput(e.target.value);
  }}
  onKeyDown={(e) => {
  if (e.key === 'Enter') {
    setSearchQuery(searchInput);
    setIsSearchActive(true);
  }
}}
onBlur={() => {
  // スマホの「完了」ボタン対応：フォーカスが外れたときに検索実行
  if (searchInput !== searchQuery) {
    setSearchQuery(searchInput);
    setIsSearchActive(true);
  }
}}
placeholder="キーワード・#タグで検索"
  style={{
    width: '100%',
    padding: '0.75rem',
    paddingLeft: '2.5rem',
    paddingRight: searchQuery ? '2.5rem' : '0.75rem',
    backgroundColor: 'rgba(0, 102, 114, 0.05)',
    color: 'rgb(0, 102, 114)',
    border: '1px solid rgba(0, 102, 114, 0.2)',
    borderRadius: '25px',
    fontSize: '1rem',
    outline: 'none',
    boxSizing: 'border-box',
  }}
/>
                    {searchQuery && (
  <button
    onClick={() => {
      setSearchQuery('');
      setSearchInput('');
      setStartDate(null);
      setEndDate(null);
    }}
                        style={{
                          position: 'absolute',
                          right: '10px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          color: 'rgba(0, 102, 114, 0.6)',
                          cursor: 'pointer',
                          fontSize: '1rem',
                          padding: '0',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '20px',
                          height: '20px',
                          borderRadius: '50%',
                          backgroundColor: 'rgba(0, 102, 114, 0.1)',
                        }}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>

                <div style={{ 
                  display: 'flex', 
                  gap: '1rem', 
                  marginBottom: '1rem',
                  marginLeft: '1rem',       
                  marginRight: '1rem'       
                }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ 
                      display: 'block', 
                      color: '#055A68', 
                      fontSize: '0.85rem', 
                      marginLeft: '1rem',
                      marginBottom: '0.3rem' 
                    }}>
                      開始日
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        backgroundColor: 'rgba(0, 102, 114, 0.05)',
                        color: 'rgb(0, 102, 114)',
                        border: '1px solid rgba(0, 102, 114, 0.2)',
                        borderRadius: '8px',
                        fontSize: '1rem',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                  
                  <div style={{ flex: 1 }}>
                    <label style={{ 
                      display: 'block', 
                      color: '#055A68', 
                      fontSize: '0.85rem', 
                      marginBottom: '0.3rem' 
                    }}>
                      終了日
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        backgroundColor: 'rgba(0, 102, 114, 0.05)',
                        color: 'rgb(0, 102, 114)',
                        border: '1px solid rgba(0, 102, 114, 0.2)',
                        borderRadius: '8px',
                        fontSize: '1rem',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                </div>
                
                <div style={{ 
                  marginBottom: '1rem',
                  marginLeft: '1rem',       
                  marginRight: '1rem'       
                }}>
                  <label style={{ 
                    display: 'block', 
                    color: 'rgba(0, 102, 114, 0.8)', 
                    fontSize: '0.85rem', 
                    marginBottom: '0.3rem', 
                    marginLeft: '0rem'
                  }}>
                    グループ
                  </label>
                  <select
                    value={selectedGroup || ''}
                    onChange={(e) => filterByGroup(e.target.value || null)}
                    style={{
                      width: '100%',
                      padding: '0.8rem',
                      backgroundColor: 'rgba(0, 102, 114, 0.05)',
                      color: '#055A68',
                      border: '1px solid rgba(0, 102, 114, 0.2)',
                      borderRadius: '8px',
                      fontSize: '0.9rem',
                      appearance: 'none',
                      WebkitAppearance: 'none',
                      MozAppearance: 'none',
                      backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='rgb(0, 102, 114)' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`,
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'right 0.5rem center',
                      backgroundSize: '1em',
                      paddingRight: '2rem',
                    }}
                  >
                    <option value="">すべてのグループ</option>
                    {groups.map(group => (
                      <option key={group.id} value={group.id}>{group.name}</option>
                    ))}
                  </select>
                </div>
                
                {(selectedDate || selectedGroup || searchQuery || startDate || endDate) && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                    <button
                      onClick={resetFilters}
                      style={{
                        padding: '0.5rem 1rem',
                        backgroundColor: 'rgb(0, 102, 114)',
                        border: 'none',
                        color: '#F0DB4F',
                        borderRadius: '25px',
                        fontSize: '0.85rem',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        marginTop: '1rem',
                        marginBottom: '1rem',
                        marginRight: '1rem'
                      }}
                    >
                      フィルタをクリア
                    </button>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
        
        {loading && (
          <div style={{ textAlign: 'center', color: '#055A68', padding: '2rem' }}>
            <div
              style={{
                width: '30px',
                height: '30px',
                border: '3px solid rgba(5, 90, 104, 0.3)',
                borderTop: '3px solid #055A68',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                margin: '0 auto',
                marginBottom: '1rem',
              }}
            ></div>
            <style>
              {`
                @keyframes spin {
                  0% { transform: rotate(0deg); }
                  100% { transform: rotate(360deg); }
                }
              `}
            </style>
            データを読み込み中...
          </div>
        )}

        {!loading && (
          <div>
            <div
              style={{
                marginTop: '2px',
                marginBottom: '0.5rem',
              }}
            >
              <h3 style={{ 
                color: '#055A68', 
                fontSize: selectedDate || selectedGroup || searchQuery || startDate || endDate ? '1.5rem' : '2rem',
                letterSpacing: 'normal',
                margin: 0
              }}>
                {selectedDate || selectedGroup || searchQuery || startDate || endDate ? (
  isCountingResults ? '検索中...' : 'フィルター適用中'
) : 'New Posts'}
{(selectedDate || selectedGroup || searchQuery || startDate || endDate) && !isCountingResults && filteredItems.length > 0 && (
  <span style={{ fontSize: '0.9rem', color: '#055A68', marginLeft: '0.5rem' }}>
    ({filteredItems.length}件)
  </span>
)}
              </h3>
            </div>
                    
            {filteredItems.length === 0 ? (
              <div
                style={{
                  backgroundColor: '#E6EDED',
                  padding: '2rem',
                  borderRadius: '12px',
                  textAlign: 'center',
                  color: '#055A68',
                  margin: '2rem 0',
                }}
              >
                {timelineItems.length === 0 ? '投稿はまだありません' : '検索条件に一致する投稿はありません'}
              </div>
            ) : (
              groupItemsByDate(filteredItems, displayedPostsCount)
            )}


          
{!hasMore && !isLoadingMore && filteredItems.length > 0 && posts.length >= 20 && currentPage > 1 && (
  <div style={{
    textAlign: 'center',
    padding: '1.5rem',
    margin: '1rem 0',
    backgroundColor: '#E6EDED',
    borderRadius: '12px',
    boxShadow: '0 2px 8px rgba(0, 102, 114, 0.1)',
    opacity: 0,
    animation: 'fadeIn 0.5s ease-in 0.5s forwards'
  }}>

    <div style={{
      fontSize: '2rem',
      marginBottom: '0.5rem'
    }}>
      🦊
    </div>
    <div style={{
      color: '#055A68',
      fontSize: '1rem',
      fontWeight: '600',
      marginBottom: '0.5rem'
    }}>
      全ての投稿を表示しました
    </div>
    <div style={{
      color: '#066878',
      fontSize: '0.85rem'
    }}>
    </div>
  </div>
)}
          
       {/* 控えめなスピナー */}
{isLoadingMore && (
  <div style={{
    display: 'flex',
    justifyContent: 'center',
    gap: '8px',
    padding: '1rem 0'
  }}>
    <div style={{
      width: '8px',
      height: '8px',
      backgroundColor: '#9CA3AF',
      borderRadius: '50%',
      animation: 'bounce 1.4s infinite ease-in-out both',
      animationDelay: '0s'
    }}></div>
    <div style={{
      width: '8px',
      height: '8px',
      backgroundColor: '#9CA3AF',
      borderRadius: '50%',
      animation: 'bounce 1.4s infinite ease-in-out both',
      animationDelay: '0.16s'
    }}></div>
    <div style={{
      width: '8px',
      height: '8px',
      backgroundColor: '#9CA3AF',
      borderRadius: '50%',
      animation: 'bounce 1.4s infinite ease-in-out both',
      animationDelay: '0.32s'
    }}></div>
  </div>
)}

<style>{`
  @keyframes bounce {
    0%, 80%, 100% { transform: scale(0); }
    40% { transform: scale(1); }
  }
`}</style>

      </div>
    )}
  </div>
  
  <ImageGalleryModal
    images={galleryImages}
    initialIndex={galleryIndex}
    isOpen={galleryOpen}
    onClose={() => setGalleryOpen(false)}
  />

  {/* 投稿詳細モーダル */}
  {selectedPostForDetail && (
    <PostDetailModal
      post={selectedPostForDetail}
      onClose={() => setSelectedPostForDetail(null)}
      navigate={navigate}
      onMemoClick={handleMemoClick}
    />
  )}

  {/* メモモーダル */}
  {memoModalOpen && selectedPostForMemo && (
    <MemoModal
      isOpen={memoModalOpen}
      onClose={() => {
        console.log('❌ [HomePage] メモ追加をキャンセル');
        setMemoModalOpen(false);
        setSelectedPostForMemo(null);
        console.log('✅ [HomePage] キャンセル処理完了');
      }}
      postId={selectedPostForMemo?.id || ''}
      onSave={async (memoData) => {
        console.log('💾 [HomePage] メモ保存開始');
        console.log('📝 [HomePage] メモデータ:', memoData);
        
        try {
          const userId = localStorage.getItem("daily-report-user-id") || "";
          const currentUser = await getUser(userId);
          const displayName = currentUser ? DisplayNameResolver.resolve(currentUser) : "ユーザー";
          
          // メモデータを完全な形で作成
          const newMemo = {
            ...memoData,
            id: `memo_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            postId: selectedPostForMemo.id,
            createdAt: Date.now(),
            createdBy: userId,
            createdByName: displayName
          };
          
          console.log('📤 [HomePage] Firestoreに保存するメモ:', newMemo);
          
          // ✅ 1. posts ステートを更新
          setPosts(prevPosts => prevPosts.map(p => 
            p.id === selectedPostForMemo.id ? { ...p, memos: [...(p.memos || []), newMemo] } : p
          ));
          
          // ✅ 2. timelineItems ステートを更新
          setTimelineItems(prevItems => prevItems.map(item => 
            'id' in item && item.id === selectedPostForMemo.id 
              ? { ...item, memos: [...((item as any).memos || []), newMemo] } 
              : item
          ));
          
          // ✅ 3. filteredItems ステートを更新
          setFilteredItems(prevItems => prevItems.map(item => 
            'id' in item && item.id === selectedPostForMemo.id 
              ? { ...item, memos: [...((item as any).memos || []), newMemo] } 
              : item
          ));
          
          // ✅ 4. 詳細モーダルを更新（既存のコード）
          const currentPost = selectedPostForDetail;
          if (currentPost) {
            const updatedPost = {
              ...currentPost,
              memos: [...(currentPost.memos || []), newMemo]
            };
            setSelectedPostForDetail(updatedPost);
            console.log('⚡ [HomePage] 画面を即座に更新（超高速）');
          }
          
          // ✅ 5. メモモーダルを即座に閉じる（既存のコード）
          setMemoModalOpen(false);
          setSelectedPostForMemo(null);
          
          console.log('🎉 [HomePage] 画面更新完了（待ち時間なし）');
          
          // ✅ 6. Firestore保存はバックグラウンドで実行 + 他ページへの通知
          MemoService.saveMemo(newMemo).then(() => {
            console.log('✅ [HomePage] Firestore保存完了（バックグラウンド）');
            
            // ⭐ 他のページへの通知（ArchivePageなど）
            const updateFlag = `memo_saved_${Date.now()}`;
            localStorage.setItem('daily-report-posts-updated', updateFlag);
            localStorage.setItem('posts-need-refresh', updateFlag);
            
            // HomePageに通知
            window.dispatchEvent(new CustomEvent('refreshPosts'));
            
            console.log('📢 [HomePage] ArchivePageにメモ保存通知を送信');
          }).catch(error => {
            console.error('❌ [HomePage] Firestore保存エラー:', error);
            // エラーが起きても画面は既に更新されている
          });
          
        } catch (error) {
          console.error('❌ [HomePage] メモ保存エラー:', error);
          alert('メモの保存に失敗しました');
          
          // エラー時もモーダルを閉じる
          setMemoModalOpen(false);
          setSelectedPostForMemo(null);
        }
      }}
    />
  )}

   {/* 既読ユーザー表示モーダル */}
  {readByModalOpen && selectedPostForReadBy && (
    <ReadByModal
      isOpen={readByModalOpen}
      onClose={() => {
        setReadByModalOpen(false);
        setSelectedPostForReadBy(null);
      }}
      readBy={selectedPostForReadBy.readBy || {}}
    />
  )}

      <MainFooterNav />
    </div>
  );

  // タイムラインアイテムを日付ごとにグループ化して表示するヘルパー関数
function groupItemsByDate(filteredItems: any[], displayedPostsCount: number) {
  // 🌟 ここで全体の表示件数を制限（重要！）
  const limitedItems = filteredItems.slice(0, displayedPostsCount);
  console.log(`📊 表示制限適用: ${displayedPostsCount}件 / 全${filteredItems.length}件`);
  console.log('📋 表示中のアイテム種別:', limitedItems.map(i => ('type' in i ? i.type : 'post') + ':' + ('timestamp' in i ? new Date(i.timestamp).toLocaleDateString() : '')));

  // 日付ごとにグループ化
  const groupedByDate: Record<string, TimelineItem[]> = {};
  limitedItems.forEach(item => { // ← filteredItems から limitedItems に変更
    
      // 日付部分を取得
let date;
if ('type' in item && item.type === 'alert') {
  // アラートの場合は今日の日付を使用
  date = formatDate(new Date());
} else {
  // 投稿の場合は投稿日時から日付を取得
  if ('type' in item && item.type === 'meeting_summary') {
    const summary = item as MeetingSummary;
    const summaryDate = summary.createdAt
      ? ((summary.createdAt as any).seconds
          ? new Date((summary.createdAt as any).seconds * 1000)
          : new Date(summary.createdAt as any))
      : new Date();
    date = formatDate(summaryDate);
  } else {
    const post = item as Post;
    if (post.time && typeof post.time === 'string') {
      date = post.time.split('　')[0];
    } else {
      const postDate = post.createdAt 
        ? (typeof post.createdAt === 'number' 
            ? new Date(post.createdAt) 
            : (post.createdAt as any).toDate?.() || new Date())
        : new Date();
      date = formatDate(postDate);
    }
  }
}
      
      if (!groupedByDate[date]) {
        groupedByDate[date] = [];
      }
      groupedByDate[date].push(item);
    });
    console.log('📅 グループ化後の日付キー:', Object.keys(groupedByDate));
    
    // 日付ごとに表示
    return Object.entries(groupedByDate)
      .sort(([dateA], [dateB]) => {
        // 日付の比較（新しい順）
        const dateObjA = parseDateString(`${dateA}　00:00`);
        const dateObjB = parseDateString(`${dateB}　00:00`);
        return dateObjB.getTime() - dateObjA.getTime();
      })
      .map(([date, itemsForDate]) => (
        <div key={date} style={{ marginBottom: '2rem' }}>
          <h4 style={{ 
            color: '#F0DB4F', 
            fontSize: '1rem', 
            marginBottom: '1rem',
            backgroundColor: '#066878',
            display: 'inline-block',
            padding: '0.4rem 1rem',
            borderRadius: '20px',
          }}>
            {date}
          </h4>
          
          {/* その日のタイムラインアイテムを表示 */}
         {itemsForDate.map(item => (
  'type' in item && item.type === 'alert' ? (
    // アラートカード
    <AlertCard
      key={item.id}
      alert={item as AlertInfo}
      onContact={handleContact}
      navigate={navigate}
    />
  ) : 'type' in item && item.type === 'meeting_summary' ? (
    // 議事録要約カード
    <MeetingSummaryCard
      key={item.id}
      summary={item as MeetingSummary}
      onViewDetails={(summaryId) => {
        const gId = (item as MeetingSummary).groupId || 'admin';
navigate(`/group/${gId}/meeting-summary/${summaryId}`);
      }}
      navigate={navigate}
    />
  ) : (
    // 投稿カード
    <PostCard
      key={item.id}
      post={item as Post}
      onViewDetails={handleViewPostDetails}
      onImageClick={handleImageClick}
      navigate={navigate}
      onStatusUpdate={handleStatusUpdate}
      getContainerStatusStyle={getContainerStatusStyle}
      userRole={userRole}  
      onMemoClick={handleMemoClick} 
      onPlusButtonClick={(post) => setSelectedPostForDetail(post)}
    />
  )
))}
        </div>
      ));
  }
};

// ★ 修正: 削除されていたエクスポート関数を復活 ★
// キャッシュ管理関数（他のコンポーネントから使用される）
let postsCache: TimelineItem[] | null = null;
let postsCacheTime = 0;
let groupsCache: Group[] | null = null;
let groupsCacheTime = 0;

export const invalidatePostsCache = () => {
  console.log('🗑️ 投稿キャッシュを無効化');
  postsCache = null;
  postsCacheTime = 0;
  
  // ⭐ 追加：localStorageも強制クリア ⭐
  localStorage.removeItem('home-posts-cache');
  localStorage.removeItem('home-cache-time');
};

export const invalidateGroupsCache = () => {
  console.log('🗑️ グループキャッシュを無効化');
  groupsCache = null;
  groupsCacheTime = 0;
};

export const forceRefreshPosts = () => {
  invalidatePostsCache();
  
  // ⭐ 追加：複数の通知を送信 ⭐
  window.dispatchEvent(new CustomEvent('postsUpdated'));
  window.dispatchEvent(new Event('storage'));
  
  console.log('🔄 強制リフレッシュ実行');
};



<MainFooterNav />

{/* bounce アニメーション */}
<style>{`
  @keyframes bounce {
    0%, 80%, 100% { 
      transform: scale(0);
      opacity: 0.5;
    }
    40% { 
      transform: scale(1);
      opacity: 1;
    }
  }
`}</style>

export default HomePage;