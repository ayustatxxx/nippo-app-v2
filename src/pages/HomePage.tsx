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
import { getDisplayNameSafe } from '../core/SafeUnifiedDataManager';
import { getUser } from '../firebase/firestore';
import MemoModal from '../components/MemoModal';
import { MemoService } from '../utils/memoService'; 
import UnifiedCoreSystem from "../core/UnifiedCoreSystem";



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

// タイムライン項目の共通型（投稿またはアラート）
type TimelineItem = Post | AlertInfo;

// カードコンポーネント用のプロパティ
interface PostCardProps {
  post: Post;
  onViewDetails: (postId: string, groupId: string) => void;
  onImageClick: (imageUrl: string, allImages: string[]) => void;
  navigate: (path: string) => void;
  onStatusUpdate: (postId: string, newStatus: string) => void;
  getContainerStatusStyle: (status: string) => any;
  userRole: 'admin' | 'user';
  onMemoClick: (post: Post) => void; // この行を追加
  onPlusButtonClick: (post: Post) => void;
}


// 未投稿アラートカード用のプロパティ
interface AlertCardProps {
  alert: AlertInfo;
  onContact: (groupId: string) => void;
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
            lineHeight: '1.5',
            fontSize: '0.95rem',
            color: '#055A68',
          }}
        >
          {/* メッセージが120文字より長い場合は省略表示 */}
          {post.message.length > 120 
            ? (
              <div>
                {`${post.message.substring(0, 120)}...`}
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
              </div>
            ) 
            : (
              <div>
                {post.message}
                {post.isEdited && (
                  <span style={{
                    color: 'rgba(5, 90, 104, 0.8)',
                    fontSize: '0.8rem',
                    marginLeft: '0.5rem'
                  }}>
                    （編集済み）
                  </span>
                )}
              </div>
            )
          }
        </div>
      )}

      {/* メッセージがない場合の編集済み表示 */}
      {(!post.message || post.message.length === 0) && post.isEdited && (
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
                onImageClick(url, (post.photoUrls && post.photoUrls.length > 0) ? post.photoUrls : (post.images || []));
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
      // 投稿者の場合：既読カウント表示（インスタグラム風）
      return (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          padding: '0.3rem 0.8rem',
          backgroundColor: 'rgba(5, 90, 104, 0.08)',
          borderRadius: '20px',
          fontSize: '0.75rem',
          color: '#055A68',
          fontWeight: '500'
        }}>
          <div style={{
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
      // 投稿者以外の場合：ステータス切り替えボタン表示（アーカイブと同じ）
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
            backgroundColor: (post.status || '未確認') === '確認済み' ? '#1f5b91' : '#ff6b6b',  // ← ここを条件分岐に変更
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
          {post.status || '未確認'}
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
      {selectedPostForStatus === post.id && (
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
                    opacity: (post.status || '未確認') === status ? 0.5 : 1
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.opacity = '0.6'}
                  onMouseLeave={(e) => {
                    const currentStatus = post.status || '未確認';
                    e.currentTarget.style.opacity = currentStatus === status ? '0.5' : '1';
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
      )}
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
    const status = (post.status || '未確認').toLowerCase();
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
  const [timelineItems, setTimelineItems] = useState<TimelineItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // メモ機能用の状態を追加
const [memoModalOpen, setMemoModalOpen] = useState(false);
const [selectedPostForMemo, setSelectedPostForMemo] = useState<Post | null>(null);
  
  // 画像モーダル用の状態を追加
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [galleryIndex, setGalleryIndex] = useState(0);
  
  // フィルタリング用の状態
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  

  // 既存の state 変数の後に追加
const [selectedPostForDetail, setSelectedPostForDetail] = useState<Post | null>(null);
const [displayLimit, setDisplayLimit] = useState(10);
const [hasMore, setHasMore] = useState(true);         // まだデータがあるか
const [isLoadingMore, setIsLoadingMore] = useState(false);  // 追加読み込み中か
const [currentPage, setCurrentPage] = useState(1);         // 現在のページ番号  
const [lastVisibleDoc, setLastVisibleDoc] = useState<any>(null);  // ⭐ 栞を保存

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
                lineHeight: '1.6',
                color: '#333',
                fontSize: '1rem',
                marginBottom: '1.5rem'
              }}>
                {displayPost.message}
                {displayPost.isEdited && (
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

            {/* メッセージがない場合の編集済み表示 */}
            {!displayPost.message && displayPost.isEdited && (
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
  if (!displayPost?.photoUrls || displayPost.photoUrls.length === 0) {
    console.warn('⚠️ 画像データが不完全');
    return;
  }
  
 const imageIndex = (displayPost.photoUrls && displayPost.photoUrls.length > 0 ? displayPost.photoUrls : displayPost.images).findIndex(photoUrl => photoUrl === url);
setGalleryImages(displayPost.photoUrls && displayPost.photoUrls.length > 0 ? displayPost.photoUrls : displayPost.images);
setGalleryIndex(imageIndex);
  setGalleryOpen(true);
  
  console.log('✅ モーダル画像設定完了:', {
    imageIndex,
    totalImages: displayPost.photoUrls.length
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
                          lineHeight: '1.5'
                        }}>
                          {memo.content}
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
  const handleImageClick = (imageUrl: string, allImages: string[]) => {
    const imageIndex = allImages.findIndex(url => url === imageUrl);
    setGalleryImages(allImages);
    setGalleryIndex(imageIndex);
    setGalleryOpen(true);
  };

  // 投稿の詳細ページをモーダルに
// 投稿の詳細ページをモーダルに（メモ取得機能付き）
const handleViewPostDetails = async (postId: string, groupId: string) => {
  console.log('🔍 [HomePage] 投稿詳細を開く:', postId);
  
  const targetPost = posts.find(post => post.id === postId);
  if (!targetPost) {
    console.error('❌ [HomePage] 投稿が見つかりません:', postId);
    return;
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

    if (result.posts.length === 0) {
      console.log('🏁 [無限スクロール] これ以上データなし');
      setHasMore(false);
    } else {
      console.log(`➕ [無限スクロール] ${result.posts.length}件を追加表示`);
      

   // ⭐ 重複チェック付きで既存データに追加 ⭐
setPosts(prevPosts => {
  // 既存の投稿IDを取得
  const existingIds = new Set(prevPosts.map(p => p.id));
  
  // 新しい投稿のみをフィルター
  const newPosts = result.posts.filter(post => !existingIds.has(post.id));
  
  console.log(`🔍 [重複チェック] 既存: ${prevPosts.length}件, 新規: ${newPosts.length}件, 重複除外: ${result.posts.length - newPosts.length}件`);
  
  return [...prevPosts, ...newPosts];
});

setTimelineItems(prevItems => {
  const existingIds = new Set(prevItems.map(item => 'id' in item ? item.id : ''));
  const newItems = result.posts.filter(post => !existingIds.has(post.id));
  return [...prevItems, ...newItems];
});

console.log('📥 [無限スクロール] timelineItems更新完了');
console.log('📥 現在のフィルター条件:', { startDate, endDate, searchQuery });

      
      // ⭐ 栞を更新（次回のために）⭐
      setLastVisibleDoc(result.lastVisible);
      
      // まだデータがあるかを更新
      setHasMore(result.hasMore);
      
      // ページ番号を更新
      setCurrentPage(nextPage);
      
      // displayLimitも増やす
      setDisplayLimit(prev => prev + result.posts.length);
      
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
  console.log('🔄 [HomePage] 強制リフレッシュフラグ検出：キャッシュクリア');
  
  // 全てのフラグをクリア
  localStorage.removeItem('posts-need-refresh');
  localStorage.removeItem('force-refresh-home');
  localStorage.removeItem('daily-report-posts-updated');
  
  postsCache = null;
  postsCacheTime = 0;
  
  console.log('✅ [HomePage] キャッシュクリア完了（フラグベース）');
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
    setPosts(postsCache);
    setTimelineItems(postsCache);
// setFilteredItems(postsCache); // ← コメントアウト
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
console.log(`📊 [効率的ロード] ${groupIds.length}グループから最新20件を一括取得`);

allPosts = await UnifiedCoreSystem.getLatestPostsFromMultipleGroups(
  groupIds,
  20  // 表示する10件 + 予備10件
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
  // ⭐ Step 1: グループ名をマージ
  const postsWithGroupNames = allPosts.map(post => {
    const group = allGroups.find(g => g.id === post.groupId);
    return {
      ...post,
      groupName: group?.name || '不明なグループ'
    };
  });
  
  console.log('✅ [Home] グループ名マージ完了:', postsWithGroupNames.length, '件');
  
  // ⭐ Step 2: ユーザー名と写真を追加マージ
  const enrichedPosts = await Promise.all(
    postsWithGroupNames.map(async (post) => {
      try {
        // ユーザー名を取得
        let username = post.username || 'ユーザー';
        if (post.authorId || post.userId || post.userID) {
          const userId = post.authorId || post.userId || post.userID;
          const displayName = await getDisplayNameSafe(userId);
          if (displayName && displayName !== 'ユーザー') {
            username = displayName;
          }
        }
        
        // 写真URLを確保（複数の可能性のあるフィールド名に対応）
const photos = (post.photoUrls && post.photoUrls.length > 0)
        ? post.photoUrls
        : (post.images || []);
        
        return {
          ...post,
          username,
          photoUrls: photos,  // ⭐ photoUrls に統一
          images: photos      // ⭐ images も設定（互換性のため）
        };
      } catch (error) {
        console.error('投稿データ補完エラー:', error);
        return {
          ...post,
          username: post.username || 'ユーザー',
          photoUrls: post.photoUrls || post.images || [],
          images: post.photoUrls || post.images || []
        };
      }
    })
  );
  
  console.log('✅ [Home] ユーザー名・写真マージ完了:', enrichedPosts.length, '件');

  // ⭐ 以下を追加 ⭐
console.log('🔍 [デバッグ] 最初の投稿データ:', enrichedPosts[0]);
console.log('🔍 [デバッグ] photoUrls:', enrichedPosts[0]?.photoUrls);
console.log('🔍 [デバッグ] images:', enrichedPosts[0]?.images);
  
  setPosts(enrichedPosts);
  setGroups(allGroups);
  setTimelineItems(enrichedPosts);
// setFilteredItems(enrichedPosts); // ← この行を削除またはコメントアウト
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
console.log(`📊 [リフレッシュロード] ${groupIds.length}グループから最新20件を一括取得`);

allPosts = await UnifiedCoreSystem.getLatestPostsFromMultipleGroups(
  groupIds,
  20
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
        
        const processedPosts = allPosts.map(post => {
          const groupName = allGroups.find(g => g.id === (post as any).groupId)?.name || 'グループ名なし';
          return { ...(post as any), groupName };
        }).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        
        setPosts(processedPosts);
        setTimelineItems(processedPosts);
// setFilteredItems(processedPosts); // ← コメントアウト
        
        console.log('✅ [HomePage] データリフレッシュ完了:', processedPosts.length, '件');
      } catch (error) {
        console.error('❌ [HomePage] データリフレッシュエラー:', error);
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
  
  // localStorageフラグ監視（ポーリング方式）
  let lastUpdateFlag = localStorage.getItem('daily-report-posts-updated') || '';
  const checkForUpdates = () => {
    const currentFlag = localStorage.getItem('daily-report-posts-updated') || '';
    if (currentFlag !== lastUpdateFlag && currentFlag !== '') {
      console.log('📱 [HomePage] localStorageフラグ変更を検知:', currentFlag);
      lastUpdateFlag = currentFlag;
      
      if (window.refreshHomePage) {
        window.refreshHomePage();
      }
    }
  };
  
  // イベントリスナーの設定
  window.addEventListener('postsUpdated', handlePostsUpdate);
  window.addEventListener('refreshPosts', handlePostsUpdate);
  
  // ポーリング開始（1秒間隔）
  const pollingInterval = setInterval(checkForUpdates, 1000);
  
  // クリーンアップ
  return () => {
    console.log('🔌 [HomePage] 更新イベント監視を終了');
    window.removeEventListener('postsUpdated', handlePostsUpdate);
    window.removeEventListener('refreshPosts', handlePostsUpdate);
    clearInterval(pollingInterval);
    
    // グローバル関数のクリーンアップ
    if (window.refreshHomePage) {
      delete window.refreshHomePage;
    }
  };
}, []); // 空の依存配列で1回のみ実行


useEffect(() => {
  const handleScroll = () => {
    const scrollPosition = window.innerHeight + window.scrollY;
    const bottomThreshold = document.body.offsetHeight - 500;
    
    // 🌟 デバッグログ追加
    console.log('📏 スクロール位置:', scrollPosition, 'しきい値:', bottomThreshold);
    
    if (scrollPosition >= bottomThreshold) {
      if (!isLoadingMore && hasMore && !loading) {
        console.log('🔄 スクロール検知: 次のデータを自動読み込み');
        loadMorePosts();
      } else {
        console.log('⏸️ 読み込みスキップ:', { isLoadingMore, hasMore, loading });
      }
    }
  };
  
  window.addEventListener('scroll', handleScroll);
  return () => window.removeEventListener('scroll', handleScroll);
}, [isLoadingMore, hasMore, loading, loadMorePosts, posts]);  // ← 依存配列に追加


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
    postsCache = posts;
    postsCacheTime = Date.now();
    console.log('💾 投稿キャッシュを更新:', posts.length, '件');
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
        status: newStatus,
        statusUpdatedAt: Date.now(),
        statusUpdatedBy: currentUserId
      });
      
      console.log('✅ [HomePage] Firestore更新完了:', postId, newStatus);
      
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
        status: newStatus as '未確認' | '確認済み',
        statusUpdatedAt: Date.now(),
        statusUpdatedBy: currentUserId
      } : post
    );
    
    // ⭐ ArchivePageと同じ方式で更新
    setPosts(updatedPosts);
    setTimelineItems(updatedPosts);
    
    // ⭐ filteredItemsも同じパターンで更新（ArchivePageのsetFilteredPostsと同じ）
    setFilteredItems(filteredItems.map(item => {
      // アラートの場合はそのまま返す
      if ('type' in item && item.type === 'alert') {
        return item;
      }
      
      // 投稿の場合のみ更新
      const post = item as Post;
      if (post.id === postId) {
        return {
          ...post,
          status: newStatus as '未確認' | '確認済み',
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
  setSelectedGroup(groupId);
};

const applyFilters = useCallback(() => {
  const executionId = Date.now();
  console.log('🚀 [applyFilters] 実行開始 - ID:', executionId);
  // ⭐ timelineItemsが空の場合はスキップ
  if (timelineItems.length === 0) {
    console.log('⚠️ [applyFilters] timelineItemsが空なのでスキップ');
    return;
  }
  console.log('🚀 [applyFilters] 実行理由:', {
    startDate,
    endDate,
    searchQuery,
    selectedDate,
    selectedGroup
  });
  console.log('📊 [applyFilters] timelineItems:', timelineItems.length, '件');
  console.log('📊 [applyFilters] 最初の3件:', timelineItems.slice(0, 3).map(item => ({
    id: 'id' in item ? (item as Post).id : 'alert',
    type: 'type' in item ? item.type : 'post'
  })));
  
  let filtered = [...timelineItems];
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

console.log('✅ [applyFilters] 完了！ - ID:', executionId);
console.log('✅ [applyFilters] 設定した件数:', filtered.length);

// ⭐ 次のレンダリングで確認用
setTimeout(() => {
  console.log('⏰ [applyFilters] 1秒後の確認 - filteredItems.length:', filteredItems.length);
}, 1000);
}, [timelineItems, searchQuery, startDate, endDate, selectedDate, selectedGroup]);

// applyFiltersを自動実行
useEffect(() => {
  applyFilters();
}, [applyFilters]);

const resetFilters = () => {
  setSearchQuery('');
  setStartDate('');
  setEndDate('');
  setSelectedDate(null);
  setSelectedGroup(null);
};

  const hasFilterConditions = selectedDate || selectedGroup || searchQuery || startDate || endDate;
  const filterBackgroundHeight = hasFilterConditions ? '470px' : '400px';
  const contentPaddingTop = hasFilterConditions ? '470px' : '400px';

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

            <div
              style={{
                position: 'fixed',
                top: '90px',
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
                  marginBottom: '1.5rem',
                  boxShadow: '0 4px 10px rgba(0, 102, 114, 0.2)',
                  border: '1px solid rgba(0, 102, 114, 0.1)',
                  maxWidth: '480px',
                  margin: '0 auto',
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
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
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
                        onClick={() => setSearchQuery('')}
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
                {selectedDate || selectedGroup || searchQuery || startDate || endDate ? 'フィルター適用中' : 'New Posts'}
                {(selectedDate || selectedGroup || searchQuery || startDate || endDate) && filteredItems.length > 0 && (
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
              groupItemsByDate()
            )}
          
        {/* 🌟 追加読み込み中の表示 */}
        {/* ⭐ 改善版：追加読み込み中の表示 ⭐ */}
{isLoadingMore && (
  <div style={{
    textAlign: 'center',
    padding: '2rem',
    color: '#055A68',
    backgroundColor: '#E6EDED',
    borderRadius: '12px',
    margin: '1rem 0',
    boxShadow: '0 2px 8px rgba(0, 102, 114, 0.1)'
  }}>
    <div style={{
      width: '40px',
      height: '40px',
      border: '4px solid rgba(5, 90, 104, 0.2)',
      borderTop: '4px solid #055A68',
      borderRadius: '50%',
      animation: 'spin 0.8s linear infinite',
      margin: '0 auto'
    }}></div>
    <p style={{ 
      marginTop: '1rem',
      fontSize: '0.95rem',
      fontWeight: '500',
      color: '#055A68'
    }}>
      📥 続きを読み込んでいます...
    </p>
    <p style={{
      marginTop: '0.5rem',
      fontSize: '0.8rem',
      color: '#066878',
      opacity: 0.8
    }}>
      現在 {posts.length} 件を表示中
    </p>
  </div>
)}

        {/* ⭐ 改善版：全て読み込み完了の表示 ⭐ */}
{!hasMore && filteredItems.length > 0 && !isLoadingMore && (
  <div style={{
    textAlign: 'center',
    padding: '1.5rem',
    margin: '1rem 0',
    backgroundColor: '#E6EDED',
    borderRadius: '12px',
    boxShadow: '0 2px 8px rgba(0, 102, 114, 0.1)'
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
      合計 {posts.length} 件の投稿
    </div>
  </div>
)}
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
          
          // ★ 変更点1: ローカルで即座にメモを追加（超高速！）
          const currentPost = selectedPostForDetail;
          if (currentPost) {
            const updatedPost = {
              ...currentPost,
              memos: [...(currentPost.memos || []), newMemo]
            };
            
            // 即座に画面更新
            setSelectedPostForDetail(updatedPost);
            console.log('⚡ [HomePage] 画面を即座に更新（超高速）');
          }
          
          // ★ 変更点2: メモモーダルを即座に閉じる
          setMemoModalOpen(false);
          setSelectedPostForMemo(null);
          
          console.log('🎉 [HomePage] 画面更新完了（待ち時間なし）');
          
          // ★ 変更点3: Firestore保存はバックグラウンドで実行
          MemoService.saveMemo(newMemo).then(() => {
            console.log('✅ [HomePage] Firestore保存完了（バックグラウンド）');
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

      <MainFooterNav />
    </div>
  );

  // タイムラインアイテムを日付ごとにグループ化して表示するヘルパー関数
function groupItemsByDate() {
  // 🌟 ここで全体の表示件数を制限（重要！）
  const limitedItems = filteredItems.slice(0, displayLimit);
  console.log(`📊 表示制限適用: ${displayLimit}件 / 全${filteredItems.length}件`);
  console.log(`🔍 [デバッグ] displayLimitの値: ${displayLimit}`);  // ← この行を追加
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
  const post = item as Post;
  if (post.time && typeof post.time === 'string') {
    date = post.time.split('　')[0];
  } else {
    // timeフィールドがない場合はcreatedAtから生成
    const postDate = post.createdAt 
      ? (typeof post.createdAt === 'number' 
          ? new Date(post.createdAt) 
          : (post.createdAt as any).toDate?.() || new Date())
      : new Date();
    date = formatDate(postDate);
  }
}
      
      if (!groupedByDate[date]) {
        groupedByDate[date] = [];
      }
      groupedByDate[date].push(item);
    });
    
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
          {itemsForDate.map(item => (  // ← .slice(0, displayLimit) を削除
            'type' in item && item.type === 'alert' ? (
              // アラートカード
              <AlertCard
                key={item.id}
                alert={item as AlertInfo}
                onContact={handleContact}
                navigate={navigate}
              />
            ) : (
              // 投稿カード - 画像クリックハンドラーを追加
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
let postsCache: Post[] | null = null;
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

export default HomePage;