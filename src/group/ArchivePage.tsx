import { useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import GroupFooterNav from '../components/GroupFooterNav';
import React, { useEffect, useState, useRef } from 'react';
import * as html2pdflib from 'html2pdf.js';
import { Post, Memo } from '../types';
import MemoModal, { MemoDisplay } from '../components/MemoModal';
import ImageGalleryModal from '../components/ImageGalleryModal';
import { getGroupPosts, markPostAsRead, removePostAsRead, getPostReadStatus } from "../utils/firestoreService";
import UnifiedCoreSystem from "../core/UnifiedCoreSystem";
import { DisplayNameResolver } from '../utils/displayNameResolver';  
import { getUser } from '../firebase/firestore';
import { MemoService } from '../utils/memoService';
import Header from '../components/Header';
import { deleteDoc, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

// 🔸 新着バナー用：「最後に見た時刻」を保存・読み込みするためのキー
const LAST_VIEWED_KEY_PREFIX = 'archive-last-viewed-';

const getLastViewedKey = (groupId: string) =>
  `${LAST_VIEWED_KEY_PREFIX}${groupId}`;

// 「最後に見た時刻」を保存
const saveLastViewedTimestamp = (groupId: string, latestMs: number) => {
  if (!Number.isFinite(latestMs) || latestMs <= 0) return;

  const key = getLastViewedKey(groupId);
  localStorage.setItem(key, String(latestMs));
  console.log('[新着保存] lastViewedTimestamp を保存しました', {
    key,
    value: latestMs,
  });
};

// 「最後に見た時刻」を読み込み
const loadLastViewedTimestamp = (groupId: string): number | null => {
  const key = getLastViewedKey(groupId);
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


// 🔥 キャッシュ設定
const CACHE_DURATION = 30000; // 30秒（30,000ミリ秒）-
const PRIORITY_LOAD_COUNT = 10; // 優先的に画像を読み込む投稿数


// ⭐ メモリキャッシュ変数を追加 ⭐
let archivePostsCache: { [groupId: string]: Post[] } = {};
let archivePostsCacheTime: { [groupId: string]: number } = {};


// グローバル関数の型定義
declare global {
  interface Window {
    forceRefreshPosts?: () => void;
    refreshArchivePage?: () => void;
  }
}


// 投稿データにメモ情報を追加するための型拡張
interface PostWithMemos extends Post {
  memos?: Array<{
    id: string;
    content: string;
    status: string;
    createdByName: string;
    createdAt: number;
    createdBy: string;
    postId: string;
  }>;
}

const html2pdf = html2pdflib.default;


const MAX_MESSAGE_LENGTH = 250; // 表示する最大文字数を250に設定

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

// IDからタイムスタンプ部分を抽出する関数
const getTimestampFromId = (id: string): number => {
  // IDは "タイムスタンプ + ランダム文字列" の形式
  const timestampStr = id.split(/[a-z]/)[0]; // 最初の英字の前までを取得
  return parseInt(timestampStr) || 0; // 数値に変換、失敗したら0を返す
};

// 作業時間投稿用のカードコンポーネント
const WorkTimePostCard: React.FC<{
  post: Post;
  onDelete: (id: string) => void;
  selectedPostIds: Set<string>;
  togglePostSelection: (id: string) => void;
  currentUserId: string;
  hasOthersRead: (post: Post) => boolean;
  handleEditPost: (postId: string) => void;
  shouldShowSelection: () => boolean;
  setSelectedPostForStatus: (postId: string | null) => void;
  getContainerStatusStyle: (status: string) => any;
  handleAddMemo: (postId: string) => void;
  setPosts: React.Dispatch<React.SetStateAction<Post[]>>;
  setFilteredPosts: React.Dispatch<React.SetStateAction<Post[]>>;
  from?: 'archive' | 'home';  
}> = ({
  post,
  onDelete,
  selectedPostIds,
  togglePostSelection,
  currentUserId,
  hasOthersRead,
  handleEditPost,
  shouldShowSelection,
  setSelectedPostForStatus,
  getContainerStatusStyle,
  handleAddMemo, 
  setPosts,
  setFilteredPosts,
  from = 'archive',  
}) => {

  return (
    <div
      style={{
        backgroundColor: '#ffffff22', // 通常投稿と同じ背景色
        backdropFilter: 'blur(4px)', // ぼかし効果を追加（透明度があるため）
        color: '#fff', // テキスト色を通常投稿と同じ白色に戻す
        padding: '1rem',
        borderRadius: '12px',
        marginBottom: '1rem',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
      }}
    >
      {/* ユーザー名と時間を表示するヘッダー - 通常投稿と同じレイアウト */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '0.8rem',
        }}
      >
        {/* 投稿者名とアバター */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              backgroundColor: '#F0DB4F22',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              marginRight: '0.5rem',
            }}
          >
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
  {DisplayNameResolver.resolve(post)}
</div>
        </div>

        {/* 投稿時間 */}
        <div style={{ fontSize: '0.85rem', color: '#ddd' }}>
          {post.time.split('　')[1]}
        </div>
      </div>

      {/* 作業時間メッセージ */}
      {post.message && post.message.length > 0 && (
        <div
          style={{
            marginBottom: '0.8rem',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
            overflowWrap: 'break-word',
            lineHeight: '1.5',
            fontSize: '0.95rem',
          }}
        >
         {post.message.length > MAX_MESSAGE_LENGTH ? (
            <div>
              {`${post.message.substring(0, MAX_MESSAGE_LENGTH)}...`}
              {post.isManuallyEdited && (
  <div style={{ marginTop: '0.5rem' }}>
    <span
      style={{
        color: '#F0DB4F',
        fontSize: '0.8rem',
      }}
    >
      (編集済み)
    </span>
  </div>
)}
          
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleEditPost(post.id);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#F0DB4F',
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
          ) : (

            
            
           // 🆕 チェックイン投稿の場合は新フォーマット
post.tags?.includes('#チェックイン') ? (() => {
  const timeInfo = extractTimeInfo(post.message || '');
  const cleanMessage = removeTimeInfo(post.message || '');
  const duration = post.tags?.includes('#チェックアウト') 
    ? calculateWorkDuration(post.message || '') 
    : null;
  
  return (
    <div>
      {/* 作業開始・終了を1行に */}
      {(timeInfo.startTime || timeInfo.endTime) && (
        <div style={{ marginBottom: '0.5rem', color: '#FFFFFF' }}>
          {timeInfo.startTime && `開始: ${timeInfo.startTime}`}
          {timeInfo.startTime && timeInfo.endTime && '  ー  '}
          {timeInfo.endTime && `終了: ${timeInfo.endTime}`}
        </div>
      )}
      
      {/* 区切り線 + 作業時間 + 区切り線 */}
      {duration && (
        <>
          <div style={{ 
            borderTop: '1px solid rgba(255, 255, 255, 0.3)',
            width: '65%',
            margin: '0.5rem 0'
          }} />
          <div style={{ marginBottom: '0.5rem', color: '#FFFFFF' }}>
           ■ 作業時間: {duration}
          </div>
          <div style={{ 
            borderTop: '1px solid rgba(255, 255, 255, 0.3)',
            width: '65%',
            margin: '0.5rem 0'
          }} />
        </>
      )}
      
     {/* 日付 */}
{timeInfo.date && (
  <div style={{ marginBottom: '0.5rem', color: '#FFFFFF' }}>
    日付: {timeInfo.date}
  </div>
)}

{/* クリーンなメッセージ + 編集済み */}
{cleanMessage && (
  <div style={{ marginTop: '0.5rem' }}>
    <span style={{ color: '#FFFFFF' }}>{cleanMessage}</span>
{post.isManuallyEdited && (
  <div style={{ marginTop: '0.5rem' }}>
    <span style={{
      color: '#F0DB4F',
      fontSize: '0.8rem',
    }}>
      （編集済み）
    </span>
  </div>
)}
  </div>
)}

{/* メッセージがない場合の編集済み表示 */}
{!cleanMessage && post.isManuallyEdited && (
  <div style={{ marginTop: '0.5rem' }}>
    <span style={{
      color: '#F0DB4F',
      fontSize: '0.8rem',
    }}>
      （編集済み）
    </span>
  </div>
)}
    </div>
  );
})() : (
  // 通常投稿の場合はそのまま表示
  <div>
    {post.message}
    {(() => {
      const shouldHideEdited = post.tags?.includes('#出退勤時間') && 
                              post.tags?.includes('#チェックイン') && 
                              post.tags?.includes('#チェックアウト');
      
      console.log('🔍 [編集済み判定]', {
        postId: post.id,
        isEdited: post.isEdited,
        tags: post.tags,
        shouldHideEdited: shouldHideEdited,
        willShow: post.isEdited && !shouldHideEdited
      });
      
      return null;
    })()}
   {post.isManuallyEdited && !(
      post.tags?.includes('#出退勤時間') && 
      post.tags?.includes('#チェックイン') && 
      post.tags?.includes('#チェックアウト')
    ) && (
      <span
        style={{
          color: '#F0DB4F',
          fontSize: '0.8rem',
          marginLeft: '0.5rem',
        }}
      >
        （編集済み）
      </span>
    )}
  </div>
)
          )}
        </div>
      )}

      {/* メッセージがない場合の編集済み表示 */}
     {(!post.message || post.message.length === 0) && post.isManuallyEdited && (
        <div
          style={{
            marginBottom: '0.8rem',
            color: 'rgba(255, 255, 255, 0.8)',
            fontSize: '0.8rem',
            fontStyle: 'italic',
          }}
        >
          （編集済み）
        </div>
      )}

      {/* タグ表示（#出退勤時間） */}
      {post.tags && post.tags.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.5rem',
            marginBottom: '0.8rem',
            marginTop: '0.8rem',
          }}
        >
          {post.tags.map((tag, index) => (
            <span
              key={index}
              style={{
                backgroundColor: '#C0C0C095', // シルバー（通常投稿と同じ）
                color: 'rgb(0, 102, 114)', // 濃いグリーン
                padding: '0.25rem 0.7rem',
                borderRadius: '999px',
                fontSize: '0.75rem',
                fontWeight: '800',
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

     {/* 投稿の下部セクション - 選択、ステータス、ボタンのコンテナ */}
<div
  style={{
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginTop: '1rem',
    paddingTop: '0.5rem',
    borderTop: '1px solid #ffffff22',
    gap: '10px',
  }}
>
  {/* 左側 - 選択とステータスのグループ */}
  <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
    {/* 選択チェックボックス（条件付き表示） */}
    {shouldShowSelection() && (
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <input
          type="checkbox"
          id={`select-post-${post.id}`}
          checked={selectedPostIds.has(post.id)}
          onChange={() => togglePostSelection(post.id)}
          style={{
            width: '18px',
            height: '18px',
            accentColor: '#F0DB4F',
            cursor: 'pointer',
            marginRight: '8px',
            boxShadow: 'none',
            appearance: 'auto',
          }}
        />
        <label
          htmlFor={`select-post-${post.id}`}
          style={{
            fontSize: '0.8rem',
            color: '#ddd',
            cursor: 'pointer',
          }}
        >
          選択
        </label>
      </div>
    )}

<div style={{ display: 'flex', alignItems: 'center' }}>
  {(() => {
    const currentUserId = localStorage.getItem("daily-report-user-id") || "";
    const readStatus = getPostReadStatus(post, currentUserId);

// 🆕 チェックイン・チェックアウト投稿では既読を非表示
if (post.tags?.includes('#出退勤時間')) {
  return null;
}

if (readStatus.isAuthor) {
      // 投稿者の場合：背景に適応した既読カウント表示
      return (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          padding: '0.3rem 0.8rem',
          backgroundColor: 'rgba(5, 90, 104, 0.15)', // 薄いグリーン背景
          borderRadius: '20px',
          fontSize: '0.75rem',
          color: '#ffffff', // 白文字でコントラスト確保
          fontWeight: '500',
          backdropFilter: 'blur(4px)' // 背景ぼかしで可読性向上
        }}>
          <div style={{
            width: '16px',
            height: '16px',
            borderRadius: '50%',
            backgroundColor: readStatus.readCount > 0 ? '#ffffff' : 'rgba(255, 255, 255, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.6rem',
            color: '#055A68', // カウント数字は濃い緑色
            fontWeight: '600'
          }}>
            {readStatus.readCount}
          </div>
          <span>既読</span>
        </div>
      );
    } 
    
    else {
      // 投稿者以外の場合：既存のステータスデザインを維持
      const displayStatus = readStatus.isRead ? '確認済み' : '未確認';
      return (
        <span 
          style={getContainerStatusStyle(displayStatus)} 
          onClick={async (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // 重複実行防止
            const target = e.currentTarget as HTMLElement;
            if (target.dataset.processing === 'true') return;
            
            // 処理中フラグを設定
            target.dataset.processing = 'true';
            
            try {
              
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
          {displayStatus}
        </span>
      );
    }
  })()}
</div>
</div>
  

  {/* 右側 - ボタン群 */}
  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>

  {/* 詳細ボタン */}
  <button
    onClick={() => handleEditPost(post.id)}
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

 {/* 削除ボタン（投稿者のみ表示 & Archiveのみ） */}
{from === 'archive' && (() => {  // ⭐ from === 'archive' && を追加
  const currentUserId = localStorage.getItem('daily-report-user-id') || '';
  const isAuthor = post.userId === currentUserId ||
                   post.createdBy === currentUserId ||
                   post.authorId === currentUserId;
  
  return isAuthor ? (
      <button
        onClick={() => onDelete(post.id)}
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
        削除
      </button>
    ) : null;
  })()}
</div>
</div>
    </div>
  );
};

const useClickOutside = (
  ref: React.RefObject<HTMLDivElement>,
  handler: () => void
) => {
  useEffect(() => {
    // クリックを検出するための内部関数
    const listener = (event: MouseEvent) => {
      // クリックした場所が参照要素の内部の場合は何もしない
      if (!ref.current || ref.current.contains(event.target as Node)) {
        return;
      }

      // 参照要素の外側をクリックした場合はhandlerを実行
      handler();
    };

    // マウス押下イベントをドキュメント全体に追加
    document.addEventListener('mousedown', listener);

    // コンポーネントがアンマウントされたときに、イベントリスナーを削除
    return () => {
      document.removeEventListener('mousedown', listener);
    };
  }, [ref, handler]);
};


// 検索スコア計算関数（優先度付き検索）
// 検索スコア計算関数（AND検索対応版）
const calculateSearchScore = (post: PostWithMemos, keywords: string[]): number => {
  let totalScore = 0;
  let matchedKeywords = 0; // ★ 追加：マッチしたキーワード数をカウント
  
  keywords.forEach(keyword => {
    let score = 0;
    const message = post.message.toLowerCase();
    const username = (post.username || '').toLowerCase();
    const status = (post.status || '未確認').toLowerCase();
    
    // メモの処理
    const memoTexts: string[] = [];
    const memoTags: string[] = [];
    
    if (post.memos) {
      post.memos.forEach(memo => {
        const memoContent = memo.content || '';
        const hashTags = memoContent.match(/#[\w\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]+/g) || [];
        memoTags.push(...hashTags);
        const textWithoutTags = memoContent.replace(/#[\w\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]+/g, '').trim();
        if (textWithoutTags) {
          memoTexts.push(textWithoutTags);
        }
      });
    }
    
    const memoTextContent = memoTexts.join(' ').toLowerCase();
    
    // 1. 投稿タグ完全一致（5点）
    if (post.tags?.some(tag => 
      tag.replace(/^#/, '').toLowerCase() === keyword
    )) {
      score += 5;
    }
    
    // 2. メモタグ完全一致（5点）
    if (memoTags.some(tag => 
      tag.replace(/^#/, '').toLowerCase() === keyword
    )) {
      score += 5;
    }
    
    // 3. 投稿タグ部分一致（3点）
    if (post.tags?.some(tag => 
      tag.replace(/^#/, '').toLowerCase().includes(keyword) &&
      tag.replace(/^#/, '').toLowerCase() !== keyword
    )) {
      score += 3;
    }
    
    // 4. メモタグ部分一致（3点）
    if (memoTags.some(tag => 
      tag.replace(/^#/, '').toLowerCase().includes(keyword) &&
      tag.replace(/^#/, '').toLowerCase() !== keyword
    )) {
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
    
    // 11. メモテキスト一致（1点）
    if (memoTextContent.includes(keyword)) {
      score += 1;
    }
    
    // ★ このキーワードがマッチしたかをチェック
    if (score > 0) {
      matchedKeywords++;
    }
    
    totalScore += score;
  });
  
  // ★ AND検索：すべてのキーワードがマッチした場合のみスコアを返す
  if (matchedKeywords === keywords.length) {
    return totalScore;
  } else {
    return 0; // 一つでもマッチしなかった場合は0を返す（表示されない）
  }
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
  
  // 分単位に変換
  const startTotalMinutes = startHour * 60 + startMinute;
  let endTotalMinutes = endHour * 60 + endMinute;
  
  // 日付をまたぐ場合の対応
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

// ★ 追加: 削除直後フラグ（グローバル変数）
let isJustDeleted = false;

const ArchivePage: React.FC = () => {
 
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams(); 
  const location = useLocation();

  const [posts, setPosts] = useState<Post[]>([]);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  // Phase A4: ユーザー情報取得
  const [user, setUser] = useState<{ uid: string } | null>(null);

  // ユーザー情報を取得
  useEffect(() => {
    const initUser = async () => {
      const userId = localStorage.getItem('daily-report-user-id') || '';
const fetchedUser = await getUser(userId);
      if (fetchedUser) {
        setUser({ uid: fetchedUser.id });
      }
    };
    initUser();
  }, []);


// ⭐ 新着チェック用のState ⭐
const [hasNewPosts, setHasNewPosts] = useState(false);
const [justDeleted, setJustDeleted] = useState(false); // ← 追加
const [latestPostTime, setLatestPostTime] = useState<number>(() => {
  const saved = localStorage.getItem(`latestPostTime_${groupId}`);
  console.log('🔄 [ArchivePage] latestPostTime初期化:', {
    groupId,
    saved,
    復元値: saved ? parseInt(saved) : 0
  });
  return saved ? parseInt(saved) : 0;
});

// ⭐ Phase A3: 段階的読み込み用のState
const [displayedPostsCount, setDisplayedPostsCount] = useState(10); // 初回は10件
// Phase A4: ページネーション用のState
 const [lastVisibleDoc, setLastVisibleDoc] = useState<any>(() => {
  // ページ遷移から戻ってきた時にlastVisibleDocIdを復元
  const savedDocId = localStorage.getItem(`lastVisibleDocId_${groupId}`);
  console.log('🔄 [Phase A4] lastVisibleDoc初期化:', savedDocId || 'なし');
  return null; // 実際のDocオブジェクトはFirestore取得後に設定
});
  const [hasMorePosts, setHasMorePosts] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
const POSTS_PER_LOAD = 10; // スクロール時に読み込む件数（初回は5件固定）


  // 検索関連のステート
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredPosts, setFilteredPosts] = useState<Post[]>([]);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);

  // 🆕 検索結果の総件数
const [searchResultCount, setSearchResultCount] = useState<number | null>(null);
const [isCountingResults, setIsCountingResults] = useState(false);

const [isSearchActive, setIsSearchActive] = useState(false);
const [searchInput, setSearchInput] = useState('');

  // 初期表示を「false」に変更
  const [showFilter, setShowFilter] = useState(false);

  const filterContainerRef = React.useRef<HTMLDivElement>(null);
  const [filterHeight, setFilterHeight] = useState<number>(330);

  // 選択関連のステート
  const [selectedPostIds, setSelectedPostIds] = useState<Set<string>>(
    new Set()
  );
  // 詳細モーダル用のstate変数を追加
  const [selectedPostForDetail, setSelectedPostForDetail] = useState<Post | null>(null);
  
  const [selectAll, setSelectAll] = useState(false);
  const [downloadLink, setDownloadLink] = useState<string | null>(null);
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [htmlContent, setHtmlContent] = useState<string>('');

  // 現在のユーザー情報を取得するための状態を追加
const [currentUserId, setCurrentUserId] = useState<string>('');

  // エクスポート用の状態管理を追加
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  // ステータス選択用の状態
  const [selectedPostForStatus, setSelectedPostForStatus] = useState<string | null>(null);



  // データ分析機能用の状態を追加
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);


  // 質問応答システム用の状態を追加
  const [userQuestion, setUserQuestion] = useState('');
  const [aiAnswer, setAiAnswer] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // メモ機能用の状態を追加
const [selectedPostForMemo, setSelectedPostForMemo] = useState<string | null>(null);
const [memoModalOpen, setMemoModalOpen] = useState(false);
const [memoContent, setMemoContent] = useState('');


  // データ分析ボタンのハンドラー
const handleDataAnalysis = async () => {
  try {
    setLoading(true);
    
    // 1. データを収集
    const analysisData = await collectAnalysisData();
    
    // 2. 簡単な統計を生成
    const statistics = generateBasicStatistics(analysisData);
    
    // 3. 分析結果を表示
    setAnalysisResult(statistics);
    setShowAnalysisModal(true);
    
  } catch (error) {
    console.error('データ分析エラー:', error);
    alert('データ分析中にエラーが発生しました');
  } finally {
    setLoading(false);
  }
};

// データ収集関数
const collectAnalysisData = async () => {
  const analysisData = {
    totalPosts: posts.length,
    totalWorkDays: 0,
    averageWorkHours: 0,
    mostUsedTags: [],
    workEfficiency: 0,
  };
  
  // 作業時間投稿をカウント
  const workTimePosts = posts.filter(post => post.isWorkTimePost);
  analysisData.totalWorkDays = Math.floor(workTimePosts.length / 2);
  
  // タグの使用頻度を分析
  const tagFrequency: Record<string, number> = {};
  posts.forEach(post => {
    if (post.tags) {
      post.tags.forEach(tag => {
        tagFrequency[tag] = (tagFrequency[tag] || 0) + 1;
      });
    }
  });
  
  analysisData.mostUsedTags = Object.entries(tagFrequency)
    .sort(([,a], [,b]) => (b as number) - (a as number))
    .slice(0, 5)
    .map(([tag, count]) => ({ tag, count }));
  
  return analysisData;
};

// 基本統計の生成
const generateBasicStatistics = (data: any) => {
  return {
    summary: `${data.totalPosts}件の投稿から分析`,
    workDays: `作業日数: ${data.totalWorkDays}日`,
    topTags: data.mostUsedTags,
    recommendations: [
      "投稿頻度が高い時間帯: 9-10時",
      "よく使用されるタグ: " + data.mostUsedTags.slice(0, 3).map((t: any) => t.tag).join(', '),
      "作業効率改善のポイント: 写真付き投稿の増加"
    ]
  };
};

// デモ用AI応答生成関数
const generateAIResponse = (question: string, posts: Post[]) => {
  const questionLower = question.toLowerCase();
  
  // 投稿数と基本情報
  const totalPosts = posts.length;
  const workTimePosts = posts.filter(post => post.isWorkTimePost);
  const regularPosts = posts.filter(post => !post.isWorkTimePost);
  
  // タグ分析
  const allTags = posts.flatMap(post => post.tags || []);
  const tagCounts = allTags.reduce((acc, tag) => {
    acc[tag] = (acc[tag] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  // 最新投稿の情報
  const latestPost = posts[0];
  
  // 質問パターンに応じた回答生成
  if (questionLower.includes('作業時間') || questionLower.includes('勤務') || questionLower.includes('時間')) {
    return `📊 **作業時間分析結果**
    
現在のデータ${totalPosts}件を分析した結果：
- 出退勤記録：${workTimePosts.length}件
- 作業報告：${regularPosts.length}件
- 推定稼働日数：${Math.floor(workTimePosts.length / 2)}日

**AIの分析コメント：**
${latestPost ? `最新の記録（${latestPost.time.split('　')[0]}）では、効率的な作業進行が確認できます。` : ''}作業時間の記録が継続されており、労働時間管理が適切に行われています。`;
  }
  
  if (questionLower.includes('効率') || questionLower.includes('生産性') || questionLower.includes('改善')) {
    const topTag = Object.entries(tagCounts).sort(([,a], [,b]) => b - a)[0];
    return `⚡ **作業効率分析結果**
    
データ分析による効率性評価：
- 最も頻繁な作業：${topTag ? `#${topTag[0]} (${topTag[1]}回)` : '出退勤管理'}
- 記録の継続性：${totalPosts > 5 ? '優秀' : '改善の余地あり'}
- データ品質：${posts.filter(p => p.message && p.message.length > 10).length}件の詳細記録

**AI推奨改善策：**
1. 写真付き報告の増加（現状${posts.filter(p => p.photoUrls && p.photoUrls.length > 0).length}件）
2. タグの活用による分類強化
3. 定期的な進捗レビューの実施`;
  }
  
  if (questionLower.includes('コスト') || questionLower.includes('費用') || questionLower.includes('削減')) {
    return `💰 **コスト分析結果**
    
日報データに基づくコスト最適化提案：
- 記録されたデータ量：${totalPosts}件
- 管理工数削減効果：月間約12時間
- 予想年間削減額：約240万円

**具体的な削減ポイント：**
1. デジタル化による事務工数削減：月間8時間
2. リアルタイム進捗把握による手戻り防止：月間4時間
3. データ分析による最適化：継続的な改善効果

${latestPost ? `最新の投稿内容「${latestPost.message.substring(0, 50)}...」からも、効率的な作業進行が確認できます。` : ''}`;
  }
  
  if (questionLower.includes('問題') || questionLower.includes('課題') || questionLower.includes('トラブル')) {
    return `⚠️ **課題・問題分析結果**
    
投稿データから検出された注意点：
- 未確認投稿：${posts.filter(p => p.status === '未確認').length}件
- 編集された投稿：${posts.filter(p => p.isEdited).length}件
- 写真なし投稿：${posts.filter(p => !p.photoUrls || p.photoUrls.length === 0).length}件

**AIが検出した改善機会：**
1. 投稿確認プロセスの迅速化
2. 現場写真添付率の向上
3. リアルタイム状況共有の強化

継続的なデータ蓄積により、より精密な問題予測が可能になります。`;
  }
  
  if (questionLower.includes('進捗') || questionLower.includes('状況') || questionLower.includes('現状')) {
    const recentPosts = posts.slice(0, 3);
    return `📈 **プロジェクト進捗分析**
    
現在の状況サマリー：
- 総投稿数：${totalPosts}件
- 直近の活動：${recentPosts.length}件の報告
- アクティブ度：${totalPosts > 10 ? '高' : totalPosts > 5 ? '中' : '低'}

**最新の動き：**
${recentPosts.map((post, i) => 
  `${i + 1}. ${post.time.split('　')[0]}：${post.message.substring(0, 40)}...`
).join('\n')}

**AIの総合評価：**
プロジェクトは${totalPosts > 10 ? '順調に' : '着実に'}進行中。継続的な記録により、品質管理と進捗把握が効果的に行われています。`;
  }
  
  // デフォルト回答
  return `**AI分析レポート**
  
ご質問「${question}」について、現在のデータ${totalPosts}件を分析しました。

**データサマリー：**
- 投稿総数：${totalPosts}件
- 作業記録：${workTimePosts.length}件
- 報告投稿：${regularPosts.length}件
- 使用タグ：${Object.keys(tagCounts).length}種類

**AI判断：**
データが継続的に蓄積されており、デジタル化による業務効率向上が実現されています。より具体的な質問（作業時間、効率、コスト、問題など）をいただければ、詳細な分析をご提供できます。

**推奨する次の質問例：**
- 「作業効率はどうですか？」
- 「コスト削減効果を教えて」
- 「現在の問題点は？」`;
};

// 質問応答処理関数
const handleAskQuestion = async () => {
  if (!userQuestion.trim()) return;
  
  setIsAnalyzing(true);
  
  try {
    // 2秒の待機でAI処理をシミュレート
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const response = generateAIResponse(userQuestion, posts);
    setAiAnswer(response);
  } catch (error) {
    setAiAnswer('申し訳ございません。分析中にエラーが発生しました。再度お試しください。');
  } finally {
    setIsAnalyzing(false);
  }
};

// メモ追加ハンドラー（PostDetailPageと同じ実装）
const handleAddMemo = (postId: string) => {
  console.log('📝 [ArchivePage] メモ追加ボタンクリック:', postId);
  
  // ⭐ 修正：モーダル状態を同時に更新（一瞬の表示を防ぐ）
  // 1. メモモーダルの状態を先に設定
  setSelectedPostForMemo(postId);
  setMemoContent('');
  
  // 2. メモモーダルを開く（詳細モーダルより先に）
  setMemoModalOpen(true);
  
  // 3. 詳細モーダルを閉じる（メモモーダルが開いた後）
  setSelectedPostForDetail(null);
  
  console.log('✅ [ArchivePage] メモモーダルを開く');
};

const handleSaveMemo = async (memoData: Omit<Memo, 'id' | 'createdAt' | 'createdBy' | 'createdByName' | 'postId'>) => {
  if (!selectedPostForMemo) {
    alert('投稿IDが見つかりません');
    return;
  }

  console.log('💾 [ArchivePage] メモ保存開始');
  console.log('📝 [ArchivePage] メモデータ:', memoData);
  
  try {
    const currentUserId = localStorage.getItem("daily-report-user-id") || "admin_user";
    const currentUser = await getUser(currentUserId);
    const currentUsername = currentUser ? DisplayNameResolver.resolve(currentUser) : "ユーザー";

    const newMemo = {
      ...memoData,
      id: `memo_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      postId: selectedPostForMemo,
      createdAt: Date.now(),
      createdBy: currentUserId,
      createdByName: currentUsername
    };

    console.log('📤 [ArchivePage] Firestoreに保存するメモ:', newMemo);
    
    const currentPost = posts.find(p => p.id === selectedPostForMemo);
    if (!currentPost) {
      console.error('投稿が見つかりません');
      return;
    }
    
    const updatedPost = {
      ...currentPost,
      memos: [...(currentPost.memos || []), newMemo]
    };
    
    console.log('⚡ [ArchivePage] 更新後の投稿:', {
      postId: updatedPost.id,
      memosCount: updatedPost.memos?.length || 0
    });
    
    // ⭐ 修正1: 先に投稿リストを更新（同期的に）
    setPosts(prevPosts => prevPosts.map(p => 
      p.id === selectedPostForMemo ? updatedPost : p
    ));
    setFilteredPosts(prevPosts => prevPosts.map(p => 
      p.id === selectedPostForMemo ? updatedPost : p
    ));
    
    // ⭐ 修正2: メモモーダルを閉じる
    setMemoModalOpen(false);
    setMemoContent('');
    setSelectedPostForMemo(null);
    
    // ⭐ 修正3: 詳細モーダルを開く（更新済みのリストから取得）
    setSelectedPostForDetail(updatedPost);
    
    console.log('🎉 [ArchivePage] メモモーダルを閉じて詳細モーダルを再表示');
    
   // ⭐ 修正4: Firestore保存はバックグラウンドで（投稿リスト更新なし）
MemoService.saveMemo(newMemo).then(() => {
  console.log('✅ [ArchivePage] Firestore保存完了（バックグラウンド）');
  // ⭐ ここから追加：HomePageに通知 ⭐
  const updateFlag = `memo_saved_${Date.now()}`;
  localStorage.setItem('daily-report-posts-updated', updateFlag);
  localStorage.setItem('posts-need-refresh', updateFlag);
  
  // HomePageに通知
  window.dispatchEvent(new CustomEvent('refreshPosts'));
  
  // HomePageにメモ保存通知を送信
  console.log('📢 [ArchivePage] HomePageにメモ保存通知を送信');
}).catch(error => {
  console.error('❌ [ArchivePage] Firestore保存エラー:', error);
});

    
  } catch (error) {
    console.error('❌ [ArchivePage] メモ保存エラー:', error);
    alert('メモの保存に失敗しました');
    
    setMemoModalOpen(false);
    setMemoContent('');
    setSelectedPostForMemo(null);
  }
};

  // ★ URLパラメータから検索状態を復元 ★
  useEffect(() => {
  const urlSearchParams = new URLSearchParams(window.location.search);
  const savedSearchQuery = urlSearchParams.get('searchQuery');
  const savedStartDate = urlSearchParams.get('startDate');
  const savedEndDate = urlSearchParams.get('endDate');
  
  
  if (savedSearchQuery) {
    setSearchQuery(savedSearchQuery);
  }
  if (savedStartDate) {
    setStartDate(new Date(savedStartDate));
  }
  if (savedEndDate) {
    setEndDate(new Date(savedEndDate));
  }
}, []); // コンポーネントマウント時に1回だけ実行


useEffect(() => {
  // ユーザー情報を取得
  const userId = localStorage.getItem('daily-report-user-id') || 'admin_user';
  setCurrentUserId(userId);
  
}, []);

  // 他のユーザーが既読したかチェック（現在は仮の実装）
  const hasOthersRead = (post: Post): boolean => {
    // 暫定的に、投稿から3時間経過したら編集不可とする
    const postTime = new Date(post.timestamp || getTimestampFromId(post.id));
    const now = new Date();
    const hoursDiff = (now.getTime() - postTime.getTime()) / (1000 * 60 * 60);
    return hoursDiff > 3; // 3時間を超えたら編集不可
  };

  // 選択UIを表示するかどうかの判定
const shouldShowSelection = () => {
  return searchQuery.trim() !== '' ||  // 検索中
         startDate !== null ||         // 開始日設定
         endDate !== null ||           // 終了日設定
         isSelectionMode;              // 手動選択モード
};

// エクスポートボタンを表示するかどうかの判定
const shouldShowExportButton = () => {
  return !shouldShowSelection() &&     // 選択モードでない時
         filteredPosts.length > 0;     // 投稿がある時
};


// ⭐ 投稿詳細を開く関数（メモ取得機能付き）
const handleViewPostDetails = async (postId: string) => {
  console.log('🔍 [ArchivePage] 投稿詳細を開く:', postId);
  
  const targetPost = posts.find(post => post.id === postId);
  
  // 🆕 ここに追加！
  console.log('🔍 [ArchivePage-handleViewPostDetails] 見つかった投稿:', {
    id: targetPost?.id,
    isEdited: targetPost?.isEdited,
    isManuallyEdited: targetPost?.isManuallyEdited,
    editedAt: targetPost?.editedAt
  });
  
  if (!targetPost) {
    console.warn('⚠️ 投稿が見つかりません:', postId);
    return;
  }
  
  // 🌟 メモをまだ取得していない、または空の場合のみ取得
  const needsFetchMemos = !targetPost.memos || targetPost.memos.length === 0;
  
  if (needsFetchMemos) {
    console.log('📝 [ArchivePage] この投稿のメモを取得中...');
    
    try {
      const userId = localStorage.getItem("daily-report-user-id") || "";
      
      // MemoServiceを使ってメモを取得
      const memosData = await MemoService.getPostMemosForUser(postId, userId);
      
      // 投稿にメモを追加
      const postWithMemos = {
        ...targetPost,
        memos: memosData
      };
      
      console.log(`✅ [ArchivePage] メモ取得完了: ${memosData.length}件`);
      
      // モーダルに表示
      setSelectedPostForDetail(postWithMemos);
      
      // postsステートも更新（次回は取得不要）
      setPosts(prevPosts => 
        prevPosts.map(p => 
          p.id === postId ? postWithMemos : p
        )
      );
      setFilteredPosts(prevPosts => 
        prevPosts.map(p => 
          p.id === postId ? postWithMemos : p
        )
      );
      
    } catch (error) {
      console.error('❌ [ArchivePage] メモ取得エラー:', error);
      // エラーでもモーダルは開く（メモなしで）
      setSelectedPostForDetail(targetPost);
    }
  } else {
    console.log('✅ [ArchivePage] メモは既に取得済み:', targetPost.memos?.length, '件');
    setSelectedPostForDetail(targetPost);
  }
};


// 詳細ボタンのハンドラー
const handleEditPost = (postId: string) => {
  handleViewPostDetails(postId);  // ⭐ 新しい関数を呼ぶだけ！
};



useEffect(() => {
  const fetchPosts = async () => {
    try {
      setLoading(true);

      setLoading(true);
      
      
      // ⭐ メモリキャッシュから読み込み（HomePageと同じ方式）⭐
const cacheData = archivePostsCache[groupId];
const cacheTime = archivePostsCacheTime[groupId];

if (cacheData && cacheData.length > 0 && Date.now() - cacheTime < CACHE_DURATION) {
  const cacheAge = Date.now() - cacheTime;
  
  console.log('💾 [ArchivePage] メモリキャッシュから読み込み（画像付き）:', {
    groupId,
    cacheAge: `${Math.floor(cacheAge / 1000)}秒前`,
    postsCount: cacheData.length,
    remainingTime: `あと${Math.floor((CACHE_DURATION - cacheAge) / 1000)}秒有効`
  });
  
  setPosts(cacheData);
  setFilteredPosts(cacheData);
  setLoading(false);

  // Phase A4: lastVisibleDocを復元
      const savedDocId = localStorage.getItem(`lastVisibleDocId_${groupId}`);
      if (savedDocId) {
        console.log('🔄 [Phase A4] キャッシュ復元時にlastVisibleDoc復元開始:', savedDocId);
        const restoredDoc = await restoreLastVisibleDoc(savedDocId);
        if (restoredDoc) {
          setLastVisibleDoc(restoredDoc);
          console.log('✅ [Phase A4] キャッシュ復元時にlastVisibleDoc復元完了');
        }
      }

  
  console.log('⚡ [ArchivePage] 画像付き高速表示完了: 0ms');
  return;
}

// Phase A4: キャッシュから復元できた場合は初回取得をスキップ
if (posts.length > 0) {
  console.log('✅ [Phase A4] キャッシュから復元済み、Firestore初回取得スキップ');
  return;
}

console.log('🔍 [ArchivePage] キャッシュなし、Firestoreから取得開始');
      
      
      // 🔥 キャッシュなし or 期限切れ → Firestoreから取得
      console.log('🔄 [ArchivePage] Firestoreから取得中...', { groupId });
      
      // ← ここから既存のコードが続く
      
      // localStorageフラグをチェック
      const updateFlag = localStorage.getItem('daily-report-posts-updated');
      console.log('🔍 [Archive] 投稿データ取得開始');

      
      if (!groupId) {
        console.error('groupIdが見つかりません');
        setLoading(false);
        return;
      }
      
      // ✅ ユーザーIDを取得
      const userId = localStorage.getItem('daily-report-user-id') || '';
    
      // Phase A4: 段階的取得（初回10件のみ）
     console.log('🔄 [Archive] Firestore段階的取得開始...');
console.log('📦 [Archive] UnifiedCoreSystem.getGroupPostsPaginated使用');

// ⏱️ パフォーマンス計測開始
const startTime = performance.now();

// Phase A4: 段階的取得（初回10件のみ）
const result = await UnifiedCoreSystem.getGroupPostsPaginated(
  groupId,
  userId,
  10  // 初回10件のみ取得
);


setLastVisibleDoc(result.lastDoc);

// Phase A4: lastVisibleDocId を localStorage に保存
if (result.lastDoc?.id) {
  localStorage.setItem(`lastVisibleDocId_${groupId}`, result.lastDoc.id);
  console.log('💾 [Phase A4] 初回取得後 lastVisibleDocId保存:', result.lastDoc.id);
}

setHasMorePosts(result.hasMore);

// ⏱️ パフォーマンス計測終了
const endTime = performance.now();
const duration = endTime - startTime;

console.log('✅ [Archive] 初回取得完了:', result.posts.length, '件');
console.log('📊 [Archive] 続きあり:', result.hasMore);
console.log('⏱️ [性能計測] ArchivePage初回表示:', {
  合計時間: `${duration.toFixed(0)}ms`,
  投稿数: result.posts.length,
  平均_1件: `${(duration / result.posts.length).toFixed(0)}ms`,
  画像込み: 'YES'
});
      
      const fetchedPosts = result.posts;
      setLastVisibleDoc(result.lastDoc);
      setHasMorePosts(result.hasMore);
      
      console.log('✅ [Archive] 初回取得完了:', result.posts.length, '件');
      console.log('📊 [Archive] 続きあり:', result.hasMore);

      fetchedPosts.forEach(post => {
       if (post.id === 'C3ZW1j0GDORx5XKi7vLw') { 
          console.log('📝 [Archive投稿チェック] テスト投稿発見!');
          console.log('  - isEdited:', post.isEdited);
          console.log('  - isManuallyEdited:', post.isManuallyEdited);
          console.log('  - editedAt:', post.editedAt);
        }
      });

      setPosts(fetchedPosts);
      setFilteredPosts(fetchedPosts);
      
// ⭐ 追加: データ更新時に最新投稿時刻を更新（バナー消去判定用）
if (fetchedPosts.length > 0) {
  const validTimestamps = fetchedPosts
    .map(p => p.createdAt)
    .filter(t => t !== null && t !== undefined && typeof t === 'object' && t && 'seconds' in t)
.map(t => (t as any).seconds * 1000);
  
  if (validTimestamps.length > 0) {
   const latestTimestamp = Math.max(...validTimestamps);
setLatestPostTime(prev => Math.max(prev, latestTimestamp));
    localStorage.setItem(
      `archive-latest-post-${groupId}`,
      JSON.stringify({
        timestamp: latestTimestamp,
        date: new Date(latestTimestamp).toLocaleString('ja-JP')
      })
    );
    console.log('📌 [ArchivePage] 最新投稿時刻を記録:', {
      timestamp: latestTimestamp,
      date: new Date(latestTimestamp).toLocaleString('ja-JP'),
      postsCount: fetchedPosts.length,
      validTimestamps: validTimestamps.length
    });
  }
}
  
     // ⭐ メモリキャッシュに保存（画像も含めて全部保存）⭐
archivePostsCache[groupId] = fetchedPosts;
archivePostsCacheTime[groupId] = Date.now();

console.log('✅ [ArchivePage] メモリキャッシュ保存完了（画像付き）:', {
  groupId,
  postsCount: fetchedPosts.length,
  validUntil: new Date(Date.now() + CACHE_DURATION).toLocaleTimeString('ja-JP')
});
      
    } catch (error) {
      console.error('❌ [Archive] 投稿データのロード中にエラーが発生しました', error);
      setPosts([]);
      setFilteredPosts([]);
    } finally {
      setLoading(false);
    }
  };

  fetchPosts();
  
 // localStorage更新フラグを監視
const handleStorageChange = () => {
  fetchPosts();
};

window.addEventListener('storage', handleStorageChange);

/* ❌ 定期的な更新チェックを無効化（30秒の新着チェックで十分）
const interval = setInterval(() => {
  const currentFlag = localStorage.getItem('daily-report-posts-updated');
  if (currentFlag && currentFlag !== localStorage.getItem('last-archive-update')) {
    localStorage.setItem('last-archive-update', currentFlag);
    
    fetchPosts();
  }
}, 5000);
*/

return () => {
  window.removeEventListener('storage', handleStorageChange);
};
}, [groupId]);

// ⭐ 新着チェックタイマー（60秒ごと）⭐
useEffect(() => {
  if (!groupId) return;

  // 検索中は自動更新をスキップ
  if (isSearchActive) {
    console.log('🔍 検索中のため自動更新を停止');
    return;
  }

    console.log('⏰ [ArchivePage] 新着チェックタイマー開始');

    // 60秒ごとに新着チェックを実行
    const checkInterval = setInterval(() => {
      checkForNewPosts();
    }, 60000);// 60秒 = 60,000ミリ秒

    // クリーンアップ
    return () => {
      console.log('🛑 [ArchivePage] 新着チェックタイマー停止');
      clearInterval(checkInterval);
    };
  }, [latestPostTime, isSearchActive]);  // isSearchActiveを追加


// ★ Phase A3 + A4: スクロール検知（2段階読み込み）
  useEffect(() => {
    const handleScroll = async () => {
       // 検索中はスクロール追加読み込みをスキップ
    if (isSearchActive) {
      console.log('🔍 検索中のためスクロール追加読み込みをスキップ');
      return;
    }
      const scrollPosition = window.innerHeight + window.scrollY;
      const pageHeight = document.documentElement.scrollHeight;
      
      // 下から300px以内に到達したら追加読み込み
      if (pageHeight - scrollPosition < 300) {
        
        // Phase A3: まずメモリ内のデータを表示
        if (displayedPostsCount < filteredPosts.length) {
          setDisplayedPostsCount(prev => {
            const newCount = Math.min(prev + POSTS_PER_LOAD, filteredPosts.length);
            console.log('📜 [ArchivePage-A3] メモリ内追加:', prev, '→', newCount, '/', filteredPosts.length);
            return newCount;
          });
        }
        // Phase A4: メモリ内のデータを全部表示したら、Firestoreから追加取得
        else if (!isLoadingMore && hasMorePosts && groupId && user?.uid) {
          setIsLoadingMore(true);
          
          try {
            console.log('📦 [ArchivePage-A4] Firestore追加取得開始...');

           // ← ここに以下を追加
console.log('🔍 [ArchivePage-A4] 現在の状態:', {
  lastVisibleDocId: lastVisibleDoc?.id || 'なし',
  isLoadingMore,
  hasMorePosts,
  displayedPostsCount,
  filteredPostsLength: filteredPosts.length
}); 

// ⏱️ パフォーマンス計測開始
const scrollStartTime = performance.now();
const result = await UnifiedCoreSystem.getGroupPostsPaginated(
  groupId,
  user.uid,
  10,
  lastVisibleDoc
);

// ⏱️ パフォーマンス計測終了
const scrollEndTime = performance.now();
const scrollDuration = scrollEndTime - scrollStartTime;

console.log('✅ [ArchivePage-A4] 追加取得完了:', result.posts.length, '件');
console.log('📊 [ArchivePage-A4] 続きあり:', result.hasMore);
console.log('⏱️ [性能計測] スクロール追加読み込み:', {
  合計時間: `${scrollDuration.toFixed(0)}ms`,
  投稿数: result.posts.length,
  平均_1件: `${(scrollDuration / result.posts.length).toFixed(0)}ms`
});
            
            console.log('✅ [ArchivePage-A4] 追加取得完了:', result.posts.length, '件');
            console.log('📊 [ArchivePage-A4] 続きあり:', result.hasMore);
            
            // 既存の投稿に追加
setPosts(prev => {
  const existingIds = new Set(prev.map(p => p.id));
  const newPosts = result.posts.filter(p => !existingIds.has(p.id));
  return [...prev, ...newPosts];
});
setFilteredPosts(prev => {
  const existingIds = new Set(prev.map(p => p.id));
  const newPosts = result.posts.filter(p => !existingIds.has(p.id));
  return [...prev, ...newPosts];
});
            setLastVisibleDoc(result.lastDoc);

            // Phase A4: lastVisibleDocId を localStorage に保存
if (result.lastDoc?.id) {
  localStorage.setItem(`lastVisibleDocId_${groupId}`, result.lastDoc.id);
  console.log('💾 [Phase A4] スクロール追加後 lastVisibleDocId保存:', result.lastDoc.id);
}

            setHasMorePosts(result.hasMore);
            
            // 表示件数も増やす
            setDisplayedPostsCount(prev => prev + result.posts.length);
            
          } catch (error) {
            console.error('❌ [ArchivePage-A4] 追加取得エラー:', error);
          } finally {
            setIsLoadingMore(false);
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [displayedPostsCount, filteredPosts.length, isLoadingMore, hasMorePosts, lastVisibleDoc, groupId, user?.uid, POSTS_PER_LOAD]);


    // 📦 Phase A4: lastVisibleDocIdからDocumentSnapshotを復元
  const restoreLastVisibleDoc = async (docId: string): Promise<any> => {
    try {
      console.log('🔄 [Phase A4] DocumentSnapshot復元開始:', docId);
      const docRef = doc(db, 'posts', docId);
      const docSnapshot = await getDoc(docRef);
      
      if (docSnapshot.exists()) {
        console.log('✅ [Phase A4] DocumentSnapshot復元成功:', docId);
        return docSnapshot;
      } else {
        console.warn('⚠️ [Phase A4] ドキュメントが存在しません:', docId);
        return null;
      }
    } catch (error) {
      console.error('❌ [Phase A4] DocumentSnapshot復元エラー:', error);
      return null;
    }
  };

  // ⭐ 投稿取得時に最新タイムスタンプを記録 ⭐
useEffect(() => {
  if (posts.length > 0) {
    const timestamps = posts
      .map(p => {
        const createdAt = p.createdAt;
        if (createdAt !== null && createdAt !== undefined && typeof createdAt === 'object' && typeof (createdAt as any).toMillis === 'function') {
          return (createdAt as any).toMillis();
        }
        return createdAt || 0;
      })
      .filter(t => t > 0);
    
    if (timestamps.length > 0) {
    const latest = Math.max(...timestamps);
// 現在の値より新しい場合のみ更新
setLatestPostTime(prev => Math.max(prev, latest));
localStorage.setItem(`latestPostTime_${groupId}`, latest.toString());
console.log('✅ [ArchivePage] latestPostTime を設定しました:', {
  設定値: latest,
  日時: new Date(latest).toLocaleString('ja-JP'),
  localStorage保存: 'OK'
});
console.log('📌 [ArchivePage] 最新投稿時刻を記録:', {

        timestamp: latest,
        date: new Date(latest).toLocaleString('ja-JP'),
        postsCount: posts.length,
        validTimestamps: timestamps.length
      });
    }
  }
}, [posts]);

// ★ モーダル自動表示用のuseEffect（EditPageから戻ってきた時） ★
useEffect(() => {
  const locationState = location.state;
  
  if (locationState?.openPostDetail && posts.length > 0) {
    const postId = locationState.openPostDetail;
    
    console.log('🔍 [ArchivePage] モーダル自動表示:', postId);
    
    // モーダルを開く
    handleViewPostDetails(postId);
    
    // stateをクリア（再表示を防ぐ）
    navigate(location.pathname + location.search, { replace: true, state: {} });
  }
}, [posts, location.state]);


// ✅ Step 4: PostPage.tsxからの更新イベント監視システム
useEffect(() => {
  console.log('🎧 [ArchivePage] 投稿更新イベント監視を開始');
  
// グローバル関数の定義
window.refreshArchivePage = () => {
  console.log('🔄 [ArchivePage] 手動リフレッシュ実行');
  // データ再取得処理
  const refreshData = async () => {
    if (!groupId) return;
    try {
      setLoading(true);

            // キャッシュをクリア（手動リフレッシュ時は常に最新データを取得）
delete archivePostsCache[groupId];
delete archivePostsCacheTime[groupId];
console.log('🗑️ [ArchivePage] ステータス更新 - メモリキャッシュクリア');
        
        // 実際のFirestoreからデータを取得する処理をここに実装
        // 現在は空配列で初期化されているため、実際のAPI呼び出しに置き換える必要がある
        
        // 暫定的な処理（将来的にFirestore APIに置き換え）
        // Firestoreから実際のデータを取得
       const refreshedPosts = await getGroupPosts(groupId);

if (refreshedPosts && refreshedPosts.length > 0) {
  setPosts(refreshedPosts);
  setFilteredPosts(refreshedPosts);
  console.log('✅ [ArchivePage] データリフレッシュ完了:', refreshedPosts.length, '件');
} else {
  console.log('ℹ️ [ArchivePage] 既存データを維持 - 空配列は設定しません');
}
        
        console.log('✅ [ArchivePage] データリフレッシュ完了:', refreshedPosts.length, '件');
      } catch (error) {
        console.error('❌ [ArchivePage] データリフレッシュエラー:', error);
      } finally {
        setLoading(false);
      }
    };
    
    refreshData();
  };
  

// PostPage.tsxからの更新イベント監視
const handlePostsUpdate = (event: any) => {
  console.log('📢 [ArchivePage] 投稿更新イベントを受信:', event.detail);
  
  // 該当するグループの投稿かチェック
  if (event.detail && event.detail.newPost && event.detail.newPost.groupId === groupId) {
    console.log('✅ [ArchivePage] 該当グループの投稿更新:', event.detail.newPost.groupId);
    
    // ⭐ Phase A2b: 新着バナーを表示（メモ保存以外） ⭐
// localStorage をチェックしてメモ保存でないことを確認
const lastUpdate = localStorage.getItem('daily-report-posts-updated') || '';
const timeDiff = Date.now() - parseInt(lastUpdate.replace('memo_saved_', ''));

if (!lastUpdate.startsWith('memo_saved_') || timeDiff >= 70000) {
  setHasNewPosts(true);
  console.log('🆕 [ArchivePage] 投稿イベント受信 → 新着バナー表示ON');
} else {
  console.log('📝 [ArchivePage] メモ保存イベントのため新着バナー非表示');
}
    
    // データ再取得
    if (window.refreshArchivePage) {
      window.refreshArchivePage();
    }
 } else if (!event.detail) {
  // 詳細情報がない場合は安全のため更新
  console.log('⚠️ [ArchivePage] 詳細不明のため安全のため更新');
  
  // ★ 修正: 削除直後はバナーを表示しない
// ⭐ 修正: 削除直後とメモ保存直後はバナーを表示しない
const lastUpdate = localStorage.getItem('daily-report-posts-updated') || '';
const timeDiff = Date.now() - parseInt(lastUpdate.replace('memo_saved_', ''));

if (isJustDeleted) {
  console.log('⏭️ [ArchivePage] 削除直後のため新着バナー表示をスキップ');
} else if (lastUpdate.startsWith('memo_saved_') && timeDiff < 70000) {
  console.log('📝 [ArchivePage] メモ保存後70秒以内のため新着バナー表示をスキップ');
} else {
  setHasNewPosts(true);
  console.log('📩 [ArchivePage] 詳細不明イベント → 新着バナー表示ON');
}
  
  // ★ localStorageをチェックしてメモ保存かどうか確認 ★
    if (lastUpdate.startsWith('memo_saved')) {
      console.log('🔄 [ArchivePage] メモ保存と判定：500ms後にリフレッシュ');
      setTimeout(() => {
        if (window.refreshArchivePage) {
          window.refreshArchivePage();
        }
      }, 500);
    } else {
      // メモ以外はすぐにリフレッシュ
      if (window.refreshArchivePage) {
        window.refreshArchivePage();
      }
    }
  }
};
  
// localStorageフラグ監視（ポーリング方式）
let lastUpdateFlag = localStorage.getItem('daily-report-posts-updated') || '';
const checkForUpdates = () => {
  const currentFlag = localStorage.getItem('daily-report-posts-updated') || '';
  if (currentFlag !== lastUpdateFlag && currentFlag !== '') {
    console.log('📱 [ArchivePage] localStorageフラグ変更を検知:', currentFlag);
    lastUpdateFlag = currentFlag;
    
    // グループIDチェック（localStorageに保存されている場合）
    const storedGroupId = localStorage.getItem('last-updated-group-id');
    if (!storedGroupId || storedGroupId === groupId) {
      
      // ⭐ メモ保存の場合は少し待ってからリフレッシュ ⭐
      if (currentFlag.startsWith('memo_saved')) {
        console.log('🔄 [ArchivePage] メモ反映のため500ms後にリフレッシュ');
        setTimeout(() => {
          if (window.refreshArchivePage) {
            window.refreshArchivePage();
          }
        }, 500);
      } else {
        // メモ以外はすぐにリフレッシュ
        if (window.refreshArchivePage) {
          window.refreshArchivePage();
        }
      }
      
    }
  }
};
  
  // イベントリスナーの設定
  window.addEventListener('postsUpdated', handlePostsUpdate);
  window.addEventListener('refreshPosts', handlePostsUpdate);
  
  // ポーリング開始（1秒間隔）
  const pollingInterval = setInterval(checkForUpdates, 1000);

  // 詳細モーダルからの削除イベントを監視
const handleArchiveDelete = (event: CustomEvent) => {
  const { postId } = event.detail;
  console.log('🗑️ [ArchivePage] 詳細モーダルから削除イベント受信:', postId);
  handleDelete(postId);
};

window.addEventListener('archiveDelete', handleArchiveDelete as EventListener);

  
  // クリーンアップ
  return () => {
    console.log('🔌 [ArchivePage] 更新イベント監視を終了');
    window.removeEventListener('postsUpdated', handlePostsUpdate);
    window.removeEventListener('refreshPosts', handlePostsUpdate);
    clearInterval(pollingInterval);

    window.removeEventListener('archiveDelete', handleArchiveDelete as EventListener);
    
    // グローバル関数のクリーンアップ
    if (window.refreshArchivePage) {
      delete window.refreshArchivePage;
    }
  };
}, [groupId]); // groupIdが変更されたら再実行


  // コンテナの高さを測定するためのuseEffect
  useEffect(() => {
    // コンテナの高さを測定する関数
    const updateFilterHeight = () => {
      if (filterContainerRef.current) {
        const height = filterContainerRef.current.offsetHeight;
        setFilterHeight(height);
      }
    };

    // 初回レンダリング時と選択状態変更時に高さを更新
    updateFilterHeight();

    // リサイズイベントでも高さを更新
    window.addEventListener('resize', updateFilterHeight);

    // コンテナの内容に影響する状態変更時にも高さを更新
    const observer = new MutationObserver(updateFilterHeight);

    if (filterContainerRef.current) {
      observer.observe(filterContainerRef.current, {
        childList: true,
        subtree: true,
        attributes: true,
      });
    }

    return () => {
      window.removeEventListener('resize', updateFilterHeight);
      observer.disconnect();
    };
  }, [showFilter, selectedPostIds.size, startDate, endDate, searchQuery]); // 依存配列を追加

  

// 🆕 Firestoreで検索条件に合う投稿数をカウント
const countSearchResults = async (
  groupId: string,
  searchQuery: string,
  startDate: Date | null,
  endDate: Date | null
): Promise<number> => {
  try {
    console.log('📊 [検索カウント] 開始:', { searchQuery, startDate, endDate });
    
    const { collection, query, where, getDocs, getFirestore } = await import('firebase/firestore');
    const db = getFirestore();
    
    const postsRef = collection(db, 'posts');
    let q = query(postsRef, where('groupId', '==', groupId));
    
    // 日付フィルターを追加
    if (startDate) {
      const startTimestamp = startDate.getTime();
      q = query(q, where('timestamp', '>=', startTimestamp));
    }
    if (endDate) {
      const endTimestamp = new Date(endDate).setHours(23, 59, 59, 999);
      q = query(q, where('timestamp', '<=', endTimestamp));
    }
    
    const snapshot = await getDocs(q);
    const allPosts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Post));
    
    console.log('📊 [検索カウント] Firestoreから取得:', allPosts.length, '件');
    
    // キーワード検索を適用
    if (!searchQuery) {
      return allPosts.length;
    }
    
    const keywords = searchQuery.toLowerCase().split(/[\s,]+/).filter(Boolean);
    const textKeywords = keywords.filter(k => !k.startsWith('#'));
    const tagKeywords = keywords.filter(k => k.startsWith('#')).map(k => k.substring(1));
    
    const matchedPosts = allPosts.filter(post => {
      // タグ検索
      if (tagKeywords.length > 0) {
        const hasAllTags = tagKeywords.every(keyword =>
          post.tags?.some(tag => tag.toLowerCase().includes(keyword))
        );
        if (!hasAllTags) return false;
      }
      
      // テキスト検索
      if (textKeywords.length > 0) {
        const message = (post.message || '').toLowerCase();
        const username = (post.username || '').toLowerCase();
        const status = (post.status || '未確認').toLowerCase();
        const memoContent = (post as any).memos 
          ? (post as any).memos.map((memo: any) => memo.content).join(' ').toLowerCase()
          : '';
        
        const tags = (post.tags || []).join(' ').toLowerCase();
        
        const hasAllKeywords = textKeywords.every(keyword =>
          message.includes(keyword) || 
          username.includes(keyword) ||
          status.includes(keyword) ||
          memoContent.includes(keyword) ||
          tags.includes(keyword)
        );
        if (!hasAllKeywords) return false;
      }
      
      return true;
    });
    
    console.log('✅ [検索カウント] マッチ:', matchedPosts.length, '件');
    return matchedPosts.length;
    
  } catch (error) {
    console.error('❌ [検索カウント] エラー:', error);
    return 0;
  }
};


  useEffect(() => {
  console.log('🔍 [検索デバッグ] 検索開始:', searchQuery);
  
 // 🆕 検索条件がある場合、Firestoreから全件取得して検索
  if (searchQuery || startDate || endDate) {
    setIsCountingResults(true);
    setIsSearchActive(true);
    
    
    // 非同期処理で全件取得
    (async () => {
      try {
        // 1. Firestoreから全投稿を取得
        const userId = localStorage.getItem('daily-report-user-id') || '';
        console.log('📥 [検索] Firestoreから全件取得開始...');
        
        const result = await UnifiedCoreSystem.getGroupPostsPaginated(
          groupId || '',
          userId,
          999  // 大きな数値で全件取得
        );
        
        const allPosts = result.posts;
        console.log('📥 [検索] Firestoreから全件取得完了:', allPosts.length, '件');
        
        // 2. postsを更新（これでクライアント検索が全件を対象にできる）
        setPosts(allPosts);
        
         // 3. カウント取得（クライアント検索の結果を使用）
        // countSearchResults は username を持っていないため使用しない
        // const count = await countSearchResults(groupId || '', searchQuery, startDate, endDate);
        // setSearchResultCount(count);
        // setIsCountingResults(false);
        
       // console.log('📊 [検索結果] 総件数:', count);
        // console.log('📊 [検索結果] posts更新完了:', allPosts.length, '件');
        
        // 🆕 クライアント検索を実行（allPostsを直接使う）
        const keywords = searchQuery
          .toLowerCase()
          .split(/[\s,]+/)
          .filter(Boolean);
        
        const tagKeywords = keywords.filter((keyword) => keyword.startsWith('#'));
        const textKeywords = keywords.filter((keyword) => !keyword.startsWith('#'));
        
        console.log('🔍 [検索デバッグ] テキストキーワード:', textKeywords);
        console.log('🔍 [検索デバッグ] タグキーワード:', tagKeywords);
        
        if (keywords.length === 0) {
  // 検索クエリが空の場合、すべての投稿を表示
  const filtered = allPosts.filter(post => {
    try {
      let postDate: Date | null = null;
      
      // ⭐ timestampまたはcreatedAtから日付を取得
      if (post.timestamp) {
        postDate = new Date(post.timestamp);
      } else if (post.createdAt) {
        if (typeof post.createdAt === 'number') {
          postDate = new Date(post.createdAt);
        } else if (post.createdAt && typeof (post.createdAt as any).toDate === 'function') {
          postDate = (post.createdAt as any).toDate();
        }
      }
      
      if (!postDate || isNaN(postDate.getTime())) {
        return true; // 日付が取得できない場合は表示する
      }
      
      // ⭐ 日付のみで比較（時刻を除外）
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
          end.getDate()
        );
        if (postDateOnly > endDateOnly) return false;
      }
      
      return true;
    } catch (error) {
      console.error('❌ 日付フィルターエラー:', error);
      return true;
    }
  });
  setFilteredPosts(filtered);
  return;
}
        
        console.log('🔍 [検索デバッグ] テキスト検索を開始します');
        
        let textFiltered = allPosts.filter((post) => {
          console.log('🔍 [検索デバッグ] 投稿', post.id + ':');
          
          const message = post.message.toLowerCase();
          const username = (post.username || '').toLowerCase();
          
          const status = (post.status || '未確認').toLowerCase();
          console.log('🔍 [検索デバッグ] ステータス:', post.status);
          
          const memoContent = (post as PostWithMemos).memos 
            ? (post as PostWithMemos).memos!.map(memo => `${memo.content}`).join(' ').toLowerCase()
            : '';
          console.log('🔍 [検索デバッグ] メモ内容:', memoContent);
          
          const tags = (post.tags || []).join(' ').toLowerCase();
          console.log('🔍 [検索デバッグ] タグ:', tags);
          
          const matchesText = textKeywords.every(
            (keyword) => 
              message.includes(keyword) || 
              username.includes(keyword) ||
              status.includes(keyword) ||
              memoContent.includes(keyword) ||
              tags.includes(keyword)
          );
          
          console.log('🔍 [検索デバッグ] テキストマッチ結果:', matchesText);
          
          if (matchesText) {
            console.log('✅ [検索デバッグ] 投稿', post.id, 'がマッチしました');
          }
          
          return matchesText;
        });
        
        console.log('🔍 [検索デバッグ] テキスト検索後の結果数:', textFiltered.length);
        
        // 日付フィルター
        if (startDate || endDate) {
          console.log('📅 [日付フィルター] 開始:', {
            startDate,
            endDate,
            投稿数: textFiltered.length
          });
          
  textFiltered = textFiltered.filter(post => {
  try {
    let postDate: Date | null = null;
    
    // timestampまたはcreatedAtから日付を取得
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
    
    // 日付取得失敗時はフィルターをスキップ
    if (!postDate || isNaN(postDate.getTime())) {
      return true;
    }
    
    // 日付のみで比較（時刻除外）
    const postDateOnly = new Date(
      postDate.getFullYear(),
      postDate.getMonth(),
      postDate.getDate()
    );
    
    // 開始日チェック
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
    
    // 終了日チェック
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

console.log('✅ [日付フィルター] 完了:', { 残り投稿数: textFiltered.length });
        }
        
        setFilteredPosts(textFiltered);

        // 🆕 検索結果のカウント更新（クライアント検索の結果を使用）
        setSearchResultCount(textFiltered.length);
        setIsCountingResults(false);
        console.log('📊 [検索結果] 総件数:', textFiltered.length);
        
      } catch (error) {
        console.error('❌ [検索] 全件取得失敗:', error);
        setIsCountingResults(false);
      }
    })();
  } else {
    setSearchResultCount(null);
    setIsSearchActive(false);
    
    // 🆕 検索クリア時は初期表示（10件）に戻す
    (async () => {
      try {
        setLoading(true);  // ← 修正
        const userId = localStorage.getItem('daily-report-user-id') || '';
        console.log('🔄 [検索クリア] 初期表示（10件）に戻します');
        
        const result = await UnifiedCoreSystem.getGroupPostsPaginated(groupId || '', userId, 10);
        setPosts(result.posts);
        setFilteredPosts(result.posts);
        setLoading(false);  // ← 修正
        
        console.log('✅ [検索クリア] 初期表示に戻りました:', result.posts.length, '件');
      } catch (error) {
        console.error('❌ [検索クリア] 初期表示の取得失敗:', error);
        setLoading(false);  // ← 修正
      }
    })();
  }
  

// ⭐ Phase A3: 検索・フィルター実行時は表示件数をリセット
// 検索時は全件表示、通常時は10件表示
if (searchQuery || startDate || endDate) {
  // 検索時は大きな数値で全件表示
  setDisplayedPostsCount(999);
} else {
  setDisplayedPostsCount(10);
}
}, [searchQuery, startDate, endDate]);
    

  const groupedPosts = React.useMemo(() => {
  // ⭐ Phase A3: 表示件数制限を適用
  const displayedFilteredPosts = filteredPosts.slice(0, displayedPostsCount);
  
  const groups = displayedFilteredPosts.reduce((acc: Record<string, Post[]>, post) => {
  // timeフィールドが存在しない場合の安全な処理
  if (!post.time) {
    console.warn('⚠️ [ArchivePage] timeフィールドがありません:', post.id);
    return acc;  // この投稿をスキップ
  }
  
  const dateTimeParts = post.time.split('　');
  const dateKey = dateTimeParts[0];

  if (!acc[dateKey]) acc[dateKey] = [];
  acc[dateKey].push(post);
  return acc;
}, {});

    // 各日付内でのさらなるソート
    Object.keys(groups).forEach((date) => {
      groups[date].sort((a, b) => {
        const timeA = a.time.split('　')[1];
        const timeB = b.time.split('　')[1];

        if (timeA === timeB) {
          // 同じ時刻の場合は、timestamp（投稿時の正確なミリ秒タイムスタンプ）で比較
          const timestampA = a.timestamp || getTimestampFromId(a.id);
          const timestampB = b.timestamp || getTimestampFromId(b.id);

          // 新しい投稿（大きいタイムスタンプ値）が先に来るようにする
          return timestampB - timestampA;
        }

        return (
          parseDateString(b.time).getTime() - parseDateString(a.time).getTime()
        );
      });
    });

    return Object.fromEntries(
      Object.entries(groups).sort(([dateA], [dateB]) => {
        const dateAStr = `${dateA}　00:00`;
        const dateBStr = `${dateB}　00:00`;
        return (
          parseDateString(dateBStr).getTime() -
          parseDateString(dateAStr).getTime()
        );
      })
    );
  }, [filteredPosts, displayedPostsCount]);

  const clearSearch = () => {
  console.log('🧹 [clearSearch] クリア開始');
  console.log('🧹 [clearSearch] クリア前 searchInput:', searchInput);
  console.log('🧹 [clearSearch] クリア前 searchQuery:', searchQuery);
  
  setSearchQuery('');
  setSearchInput('');  // 👈 追加1：入力中の文字もクリア
  setStartDate(null);
  setEndDate(null);
  setIsSearchActive(false);  // 👈 追加2：検索モード終了
  
  console.log('🧹 [clearSearch] setSearchInput(\'\') 実行完了');
};

  
  const handleDelete = async (postId: string) => {
  console.log('🗑️ [削除デバッグ] handleDelete開始:', postId);
  
  const currentUserId = localStorage.getItem('daily-report-user-id') || '';
  
  if (!window.confirm('この投稿を削除してもよろしいですか?')) {
    console.log('🗑️ [削除デバッグ] ユーザーがキャンセル');
    return;
  }

  try {
    console.log('🗑️ [削除デバッグ] Firestore削除開始');
    console.log('🗑️ [削除デバッグ] 削除パス: posts/' + postId);
    
    // Firestoreから削除
    await deleteDoc(doc(db, 'posts', postId));
   
    // キャッシュをクリア
delete archivePostsCache[groupId];
delete archivePostsCacheTime[groupId];
console.log('🗑️ [ArchivePage] 投稿削除 - メモリキャッシュクリア');
    console.log('✅ [Archive] Firestore削除完了:', postId);

// ★ 追加: 削除時は新着バナーを非表示
console.log('🚫 [削除デバッグ] 新着バナーを非表示にします');
setHasNewPosts(false);
setJustDeleted(true);
isJustDeleted = true;  // ← 追加: グローバル変数も更新
console.log('✅ [削除デバッグ] setHasNewPosts(false)実行完了');

// 5秒後に削除フラグをクリア
setTimeout(() => {
  setJustDeleted(false);
  isJustDeleted = false;  // ← 追加: グローバル変数もクリア
  console.log('🔄 [削除デバッグ] 削除フラグをクリア');
}, 5000);

   

    // ⭐ 修正1: HomePageのキャッシュを無効化
if (window.forceRefreshPosts) {
  window.forceRefreshPosts();
  console.log('🔄 [Archive] HomePage.forceRefreshPosts()を実行');
}

// ⭐ 修正2: HomePageのリフレッシュ関数を直接呼び出す
if (window.refreshHomePage) {
  window.refreshHomePage();
  console.log('🔄 [Archive] window.refreshHomePage()を実行');
}

// ⭐ 修正3: localStorageフラグ更新（数値のみ） ⭐
const updateFlag = Date.now().toString();  // ← ✅ 数値のみ！
localStorage.setItem('daily-report-posts-updated', updateFlag);
localStorage.setItem('posts-need-refresh', 'true');  // ← ✅ 追加
console.log('🔍 [デバッグ] localStorageに保存:', updateFlag);

// ⭐ 修正4: CustomEventを発火
window.dispatchEvent(new CustomEvent('refreshPosts', {
  detail: { action: 'delete', postId }
}));
console.log('📢 [Archive] HomePageに削除通知を送信完了');

// ⭐ さらに追加：念のため再通知 ⭐
setTimeout(() => {
  window.dispatchEvent(new CustomEvent('postsUpdated'));
  window.dispatchEvent(new Event('storage'));
  console.log('🔁 200ms後に再通知完了');
}, 200);


    // ローカル状態を更新
    setPosts(prev => prev.filter(post => post.id !== postId));
    setFilteredPosts(prev => prev.filter(post => post.id !== postId));

    alert('✅ 投稿を削除しました');
  } catch (error) {
    console.error('❌ [Archive] 削除エラー:', error);
    alert('削除に失敗しました');
  }
};

// ⭐ バックグラウンド更新関数（ローディング表示なし）⭐
const backgroundRefresh = async () => {
  if (!groupId) return;
  
  try {
    console.log('🔄 [ArchivePage] バックグラウンド更新開始（既読反映用）');
    
    const userId = localStorage.getItem('daily-report-user-id') || '';
    const result = await UnifiedCoreSystem.getGroupPostsPaginated(groupId, userId, 10);
    const freshPosts = result.posts;
    
    // ローディング表示なしでデータ更新
    setPosts(freshPosts);
// 検索中の場合は filteredPosts を更新しない
if (!searchQuery && !startDate && !endDate) {
  setFilteredPosts(freshPosts);
}
    
    // 最新タイムスタンプ更新
    if (freshPosts.length > 0) {
      const timestamps = freshPosts
        .map(p => {
          const createdAt = p.createdAt;
          if (createdAt !== null && createdAt !== undefined && typeof createdAt === 'object' && typeof (createdAt as any).toMillis === 'function') {
            return (createdAt as any).toMillis();
          }
          return p.createdAt || 0;
        })
        .filter(t => t > 0);
      
      if (timestamps.length > 0) {
        const latest = Math.max(...timestamps);
        setLatestPostTime(prev => Math.max(prev, latest));
      }
    }
    
    console.log('✅ [ArchivePage] バックグラウンド更新完了:', freshPosts.length, '件');
  } catch (error) {
    console.error('❌ [ArchivePage] バックグラウンド更新エラー:', error);
  }
};
  
// ⭐ 新着チェック関数 ⭐
const checkForNewPosts = async () => {
   // ★ 追加: 削除直後はチェックをスキップ
  if (isJustDeleted) {  // ← justDeleted → isJustDeleted に変更
  console.log('⏭️ [新着チェック] 削除直後のためスキップ');
  return;
}

  if (!groupId) return;
  
  try {
    console.log('🔍 [ArchivePage] 新着チェック開始');
    console.log('📊 [ArchivePage] 現在の最新投稿時刻:', new Date(latestPostTime).toLocaleString('ja-JP'));
    
    // Firestoreから最新の投稿のタイムスタンプのみ取得
    const { collection, query, where, orderBy, limit, getDocs } = await import('firebase/firestore');
    const { getFirestore } = await import('firebase/firestore');
    const db = getFirestore();
    
    const postsRef = collection(db, 'posts');
    const q = query(
      postsRef,
      where('groupId', '==', groupId),
      orderBy('createdAt', 'desc'),
      limit(1)
    );
    
    const snapshot = await getDocs(q);
    
    if (!snapshot.empty) {
  const latestPost = snapshot.docs[0].data();
  // Timestamp型を数値に変換
const latestTime = latestPost.createdAt?.toMillis 
  ? latestPost.createdAt.toMillis() 
  : (typeof latestPost.createdAt === 'number' ? latestPost.createdAt : 0);
  
  console.log('🔍 [新着チェック] Firestoreから取得したデータ:', {
    latestPostId: snapshot.docs[0].id,
    createdAt: latestPost.createdAt,
    createdAtType: typeof latestPost.createdAt,
    latestTime: latestTime,
    latestDate: latestTime > 0 ? new Date(latestTime).toLocaleString('ja-JP') : 'Invalid'
  });
  
  console.log('🔍 [新着チェック] 最新投稿時刻:', {
    latest: latestTime > 0 ? new Date(latestTime).toLocaleString('ja-JP') : 'Invalid',
    current: latestPostTime > 0 ? new Date(latestPostTime).toLocaleString('ja-JP') : 'Invalid',
    差分: latestTime - latestPostTime,
    新着あり: latestTime > latestPostTime
  });

    // 現在表示中の最新投稿より新しい投稿があれば通知
  if (latestTime > 0 && latestPostTime > 0 && latestTime > latestPostTime) {
  const latestPostAuthorId = latestPost.authorId || latestPost.userId || latestPost.createdBy;
  const currentUserId = localStorage.getItem('daily-report-user-id') || '';



    // ⭐ ここにデバッグログを追加 ⭐
  console.log('🔍🔍🔍 [新着チェック詳細]', {
    latestPostTime,
    latestTime,
    差分: latestTime - latestPostTime,
    latestPostTimeの日時: new Date(latestPostTime).toLocaleString('ja-JP'),
    latestTimeの日時: new Date(latestTime).toLocaleString('ja-JP')
  });
  
  const lastUpdate = localStorage.getItem('daily-report-posts-updated') || '';
  console.log('🔍🔍🔍 [localStorage確認]', {
    lastUpdate,
    isMemoSaved: lastUpdate.startsWith('memo_saved_'),
    生のlastUpdate: lastUpdate
  });
  const timeDiff = Date.now() - parseInt(lastUpdate.replace('memo_saved_', ''));

  // ⭐ ここから追加 ⭐
console.log('⏱️⏱️⏱️ [timeDiff計算詳細]', {
  現在時刻: Date.now(),
  lastUpdate,
  lastUpdateから抽出したタイムスタンプ: parseInt(lastUpdate.replace('memo_saved_', '')),
  timeDiff,
  判定結果: lastUpdate.startsWith('memo_saved_') && timeDiff < 70000
});
  
  if (lastUpdate.startsWith('memo_saved_') && timeDiff < 70000) {
  console.log('📝 [ArchivePage] メモ保存後70秒以内のため、新着バナーは表示しません');
  console.log('⏱️ [ArchivePage] メモ保存からの経過時間:', timeDiff, 'ms');
} else if (latestPostAuthorId === currentUserId) {
  // ⭐ 自分の投稿の場合は新着バナーを表示しない
  console.log('⏭️ [ArchivePage] 自分の投稿のため新着バナー非表示');
} else {
  // ⭐ 他人の投稿の場合のみ新着バナーを表示
console.log('🆕 [ArchivePage] メンバーの新着投稿を検知！バナー表示ON');
setHasNewPosts(true);
setLatestPostTime(latestTime);  // ← この1行を追加
console.log('✅ [ArchivePage] 最新投稿時刻を更新:', new Date(latestTime).toLocaleString('ja-JP'));
}
} else {
  console.log('ℹ️ [ArchivePage] 新着投稿なし');
  
  // ⭐ キャッシュ期限切れならバックグラウンド更新（既読反映用） ⭐
  const now = Date.now();
  const lastCacheTime = archivePostsCacheTime[groupId || ''] || 0;
  const cacheAge = now - lastCacheTime;
  
  if (cacheAge > CACHE_DURATION) {
    console.log('🔄 [ArchivePage] キャッシュ期限切れ（' + Math.floor(cacheAge/1000) + '秒経過）、バックグラウンド更新実行');
    await backgroundRefresh();
  } else {
    console.log('✅ [ArchivePage] キャッシュ有効（残り' + Math.floor((CACHE_DURATION - cacheAge)/1000) + '秒）、更新不要');
  }
}
    } else {
      console.log('⚠️ [ArchivePage] 投稿が見つかりませんでした');
    }
  } catch (error) {
    console.error('❌ [ArchivePage] 新着チェック失敗:', error);
  }
};

// ステータス更新処理の修正版（デバッグログ強化 + Firestore直接更新）
const handleStatusUpdate = async (postId: string, newStatus: string) => {
  try {
    const currentUserId = localStorage.getItem("daily-report-user-id") || "";
    
    console.log('🔄 [ArchivePage] ステータス更新開始:', postId, newStatus);
    
    // 1. Firestoreドキュメントを直接更新
    try {
      console.log('🔥 [ArchivePage] Firestore更新処理開始');
      
      const { doc, updateDoc, getFirestore } = await import('firebase/firestore');
      const { getApps } = await import('firebase/app');
      
      let db;
      if (getApps().length === 0) {
        console.error('❌ [ArchivePage] Firebase app not initialized');
        throw new Error('Firebase app not initialized');
      } else {
        db = getFirestore();
        console.log('✅ [ArchivePage] Firestore接続取得成功');
      }
      
      const postRef = doc(db, 'posts', postId);
      await updateDoc(postRef, {
        status: newStatus,
        statusUpdatedAt: Date.now(),
        statusUpdatedBy: currentUserId
      });
      
      console.log('✅ [ArchivePage] Firestore更新完了:', postId, newStatus);

      // ⭐ ステータスに応じて既読を操作 ⭐
if (newStatus === '確認済み') {
  // 確認済みにした場合は既読をつける
  await markPostAsRead(postId, currentUserId);
  console.log('✅ [ArchivePage] 既読マーク追加:', postId);
} else if (newStatus === '未確認') {
  // 未確認に戻した場合は既読を削除
  await removePostAsRead(postId, currentUserId);
  console.log('✅ [ArchivePage] 既読マーク削除:', postId);
}


      // キャッシュをクリア
delete archivePostsCache[groupId];
delete archivePostsCacheTime[groupId];
console.log('🔄 [ArchivePage] ステータス更新 - メモリキャッシュクリア');

      
    } catch (firestoreError) {
      console.error('❌ [ArchivePage] Firestore更新失敗:', firestoreError);
      alert('データベースの更新に失敗しました');
      return;
    }
    
    // 2. ローカル状態を更新
    console.log('🔄 [ArchivePage] ローカル状態更新開始');
    
    const updatedPosts = posts.map(post => {
  if (post.id !== postId) return post;
  
  // ステータス更新と既読情報の同期
  const updatedPost = {
    ...post,
    status: newStatus as '未確認' | '確認済み',
    statusUpdatedAt: Date.now(),
    statusUpdatedBy: currentUserId
  };
  
  // 既読情報も更新
  if (newStatus === '確認済み') {
    // 既読追加
    updatedPost.readBy = { ...(post.readBy || {}), [currentUserId]: Date.now() };
  } else if (newStatus === '未確認' && post.readBy?.[currentUserId]) {
    // 既読削除
    const { [currentUserId]: removed, ...remainingReadBy } = post.readBy;
    updatedPost.readBy = remainingReadBy;
  }
  
  return updatedPost;
});
    
    setPosts(updatedPosts);
   setFilteredPosts(filteredPosts.map(post => {
  if (post.id !== postId) return post;
  
  // updatedPostsと同じロジックで更新
  const updatedPost = {
    ...post,
    status: newStatus as '未確認' | '確認済み',
    statusUpdatedAt: Date.now(),
    statusUpdatedBy: currentUserId
  };
  
  // 既読情報も更新
  if (newStatus === '確認済み') {
    updatedPost.readBy = { ...(post.readBy || {}), [currentUserId]: Date.now() };
  } else if (newStatus === '未確認' && post.readBy?.[currentUserId]) {
    const { [currentUserId]: removed, ...remainingReadBy } = post.readBy;
    updatedPost.readBy = remainingReadBy;
  }
  
  return updatedPost;
}));
  
    
    setSelectedPostForStatus(null);
    
    console.log('✅ [ArchivePage] ステータス更新完了:', newStatus);
    
  } catch (error) {
    console.error('❌ [ArchivePage] ステータス更新エラー:', error);
    alert('ステータスの更新に失敗しました');
  }
};

// ステータスバッジのスタイルを取得
// コンテナ上のステータスバッジ用（小さいサイズ）
const getContainerStatusStyle = (status: string) => {
  const baseStyle = {
    padding: '0.3rem 0.8rem',    // ← 小さいサイズ
    borderRadius: '15px',
    fontSize: '0.75rem',         // ← 小さい文字
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

  const togglePostSelection = (postId: string) => {
    const newSelectedIds = new Set(selectedPostIds);

    if (newSelectedIds.has(postId)) {
      newSelectedIds.delete(postId);
    } else {
      newSelectedIds.add(postId);
    }

    setSelectedPostIds(newSelectedIds);

    if (newSelectedIds.size === filteredPosts.length) {
      setSelectAll(true);
    } else {
      setSelectAll(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedPostIds(new Set());
      setSelectAll(false);
    } else {
      const newSelectedIds = new Set<string>();
      filteredPosts.forEach((post) => newSelectedIds.add(post.id));
      setSelectedPostIds(newSelectedIds);
      setSelectAll(true);
    }
  };

  const generateDownloadLink = () => {
    if (selectedPostIds.size === 0) {
      alert('エクスポートする投稿を選択してください');
      return;
    }

    setIsGeneratingLink(true);

    try {
      const selectedPosts = posts.filter((post) =>
        selectedPostIds.has(post.id)
      );

      selectedPosts.sort((a, b) => {
        return (
          parseDateString(a.time).getTime() - parseDateString(b.time).getTime()
        );
      });

      let htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Daily Report Export</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .post { margin-bottom: 30px; padding: 15px; border: 1px solid #ddd; border-radius: 8px; }
        .post-time { color: #666; font-size: 0.9em; margin-bottom: 10px; }
        .post-message { white-space: pre-wrap; margin-bottom: 15px; }
        .tags { display: flex; flex-wrap: wrap; gap: 8px; margin: 10px 0; }
        .tag { background-color: #f0f0f0; padding: 4px 10px; border-radius: 20px; font-size: 0.8em; }
        .post-images { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 15px; }
        .post-image { max-width: 200px; max-height: 200px; object-fit: contain; }
        h1 { color: #333; }
        .export-info { margin-bottom: 30px; color: #666; }
        @media print {
          .post { page-break-inside: avoid; }
          .post-images { page-break-inside: avoid; }
        }
      </style>
    </head>
    <body>
      <h1>Daily Report</h1>
      <div class="export-info">
        <p>出力日時: ${new Date().toLocaleString('ja-JP')}</p>
        <p>選択された投稿数: ${selectedPosts.length}件</p>
      </div>
    `;

      selectedPosts.forEach((post) => {
        htmlContent += `
      <div class="post">
        <div class="post-time">${post.time}</div>
        ${post.message ? `<div class="post-message">${post.message}</div>` : ''}
        
        ${
          post.tags && post.tags.length > 0
            ? `
          <div class="tags">
            ${post.tags
              .map((tag) => `<span class="tag">${tag}</span>`)
              .join('')}
          </div>
        `
            : ''
        }
        
        ${
          post.photoUrls && post.photoUrls.length > 0
            ? `
          <div class="post-images">
            ${post.photoUrls
              .map(
                (url) => `<img class="post-image" src="${url}" alt="投稿画像">`
              )
              .join('')}
          </div>
        `
            : ''
        }
      </div>
      `;
      });

      htmlContent += `
    </body>
    </html>
    `;

      const blob = new Blob([htmlContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);

      setDownloadLink(url);
    } catch (error) {
      console.error('エクスポート中にエラーが発生しました', error);
      alert('エクスポート中にエラーが発生しました');
    } finally {
      setIsGeneratingLink(false);
    }
  };

  const generatePDF = async () => {
    if (selectedPostIds.size === 0) {
      alert('エクスポートする投稿を選択してください');
      return;
    }

    setIsGeneratingPdf(true);

    try {
      const selectedPosts = posts
        .filter((post) => selectedPostIds.has(post.id))
        .sort(
          (a, b) =>
            parseDateString(a.time).getTime() -
            parseDateString(b.time).getTime()
        );

      const content = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Daily Report Export</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    .post { margin-bottom: 30px; padding: 15px; border: 1px solid #ddd; border-radius: 8px; }
    .post-time { color: #333; font-size: 1em; margin-bottom: 10px; font-weight: bold; }
    .post-message { white-space: pre-wrap; margin-bottom: 15px; }
    .tags { display: flex; flex-wrap: wrap; gap: 8px; margin: 10px 0; }
    .tag { background-color: #f0f0f0; padding: 4px 10px; border-radius: 20px; font-size: 0.8em; }
    .post-images { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 15px; }
    .post-image { max-width: 200px; max-height: 200px; object-fit: contain; }
    h1 { color: #333; }
    .export-info { margin-bottom: 30px; color: #666; }
  </style>
</head>
<body>
  <h1>Daily Report</h1>
  <div class="export-info">
    <p>出力日時: ${new Date().toLocaleString('ja-JP')}</p>
    <p>選択された投稿数: ${selectedPosts.length}件</p>
  </div>
${selectedPosts
  .map(
    (post) => `
  <div class="post">
    <div class="post-time">${post.time}</div>
    ${post.message ? `<div class="post-message">${post.message}</div>` : ''}
    
    ${
      post.tags && post.tags.length > 0
        ? `
      <div class="tags">
        ${post.tags.map((tag) => `<span class="tag">${tag}</span>`).join('')}
      </div>
    `
        : ''
    }
    
    ${
      post.photoUrls && post.photoUrls.length > 0
        ? `
      <div class="post-images">
        ${post.photoUrls
          .map((url) => `<img class="post-image" src="${url}" alt="投稿画像">`)
          .join('')}
      </div>
    `
        : ''
    }
  </div>
`
  )
  .join('')}
</body>
</html>
`;

      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = content;
      document.body.appendChild(tempDiv);

      const imgElements = tempDiv.querySelectorAll('img');
      const imgPromises = Array.from(imgElements).map((img) => {
        return new Promise((resolve, reject) => {
          if (img.complete) {
            resolve(null);
          } else {
            img.onload = () => resolve(null);
            img.onerror = () => {
              console.warn('画像の読み込みに失敗しました:', img.src);
              resolve(null);
            };
          }
        });
      });

      await Promise.all(imgPromises);

      const options = {
        margin: 10,
        filename: `daily-report-export-${new Date()
          .toISOString()
          .slice(0, 10)}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      };

      await html2pdf().from(tempDiv).set(options).save();

      document.body.removeChild(tempDiv);
    } catch (error) {
      console.error('PDF生成中にエラーが発生しました', error);
      alert('PDFの生成に失敗しました');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // 時間抽出ヘルパー関数
const extractTime = (timeString: string): string => {
  const timePart = timeString.split('　')[1];
  return timePart || timeString;
};

  
    // PostDetailModal コンポーネント
const PostDetailModal: React.FC<{
  post: Post;
  onClose: () => void;
  navigate: (path: string) => void;
  onMemoClick: (post: Post) => void;
  from?: 'archive' | 'home';  // ⭐ この行を追加
}> = ({ post, onClose, navigate, onMemoClick, from = 'archive' }) => {  
  

  // 🆕 デバッグログを追加
  console.log('🔍 [PostDetailModal] 受け取った投稿:', {
    id: post.id,
    isEdited: post.isEdited,
    isManuallyEdited: post.isManuallyEdited,
    editedAt: post.editedAt
  });
  
  const [displayPost, setDisplayPost] = useState<Post>(post);

    // 🆕 デバッグログを追加
  console.log('🔍 [PostDetailModal] displayPost初期化:', {
    id: displayPost.id,
    isEdited: displayPost.isEdited,
    isManuallyEdited: displayPost.isManuallyEdited,
    editedAt: displayPost.editedAt
  });
  
  // 現在ログインしているユーザーのIDを取得
  const currentUserId = localStorage.getItem("daily-report-user-id") || "";
  
  // この投稿の作成者かどうかを判定
  const isAuthor = displayPost.userId === currentUserId || 
                   displayPost.createdBy === currentUserId ||
                   displayPost.authorId === currentUserId;


  // ユーザー情報を取得して表示名・会社名・役職を補完
useEffect(() => {
  const fetchUserInfo = async () => {
    try {
      const userInfo = await getUser(displayPost.userId);
      if (userInfo) {
        console.log('🔍 [PostDetailModal-useEffect] setDisplayPost実行前:', {
          displayPost_isManuallyEdited: displayPost.isManuallyEdited
        });
        
        setDisplayPost(prevPost => {
          console.log('🔍 [PostDetailModal-useEffect] prevPost:', {
            id: prevPost.id,
            isEdited: prevPost.isEdited,
            isManuallyEdited: prevPost.isManuallyEdited
          });
          
          return {
            ...prevPost,
            username: userInfo.displayName || userInfo.username || prevPost.username,
            company: userInfo.company || '会社名なし',
            position: userInfo.position || '役職なし'
          };
        });
      }
    } catch (error) {
      console.error('ユーザー情報取得エラー:', error);
    }
  };
  
  fetchUserInfo();
}, [displayPost.userId]);

  // 🔧 親から渡されるpostが更新されたらdisplayPostも更新
  useEffect(() => {
       console.log('🔄 [PostDetailModal] post propsが更新されました:', {
      post_id: post.id,
      post_isManuallyEdited: post.isManuallyEdited,
      post_isEdited: post.isEdited,
      displayPost_isManuallyEdited: displayPost.isManuallyEdited,
      displayPost_isEdited: displayPost.isEdited
    });
    
    // propsのpostが変わったらdisplayPostを更新
    if (post.id === displayPost.id) {
      setDisplayPost(prev => ({
        ...prev,
        isEdited: post.isEdited,
        isManuallyEdited: post.isManuallyEdited,
        editedAt: post.editedAt
      }));
    }
  }, [post.isEdited, post.isManuallyEdited, post.editedAt]);
    
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
  color: '■#055A68',
  fontSize: '0.85rem',
  fontWeight: '500',
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'flex-end',
  gap: '0.0rem'
}}>
  <div>{extractTime(displayPost.time)}</div>
  {/* 🌟 修正済みバッジを追加 */}
{(() => {
  console.log('🔍 [バッジ判定] isEdited:', displayPost.isEdited);
console.log('🔍 [バッジ判定] isManuallyEdited:', displayPost.isManuallyEdited);
console.log('🔍 [バッジ判定] 両方true:', displayPost.isEdited && displayPost.isManuallyEdited);
console.log('🔍 [バッジ判定] tags:', displayPost.tags);
  return null;
})()}
{displayPost.isEdited && displayPost.isManuallyEdited && (
    <span style={{
      marginLeft: '0.5rem',
      fontSize: '0.75rem',
      color: '■#d97706',
      fontWeight: '500'
    }}>
      (修正済み)
    </span>
  )}
</div>
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
            {cleanMessage}
          </div>
        )}
      </div>
    );
  })()
) : (
  <div>
    {displayPost.message}
  </div>
)}
{displayPost.isManuallyEdited && (
  <span style={{
    color: '#d97706',
    fontSize: '0.85rem',
    marginLeft: '0.5rem',
    fontWeight: '500'
  }}>
    （修正済み）
  </span>
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
  console.log('🔥🔥🔥 ArchivePage画像onClick実行！');
  
  if (!displayPost?.photoUrls || displayPost.photoUrls.length === 0) {
        console.warn('⚠️ 画像データが不完全');
        return;
      }
      
      // サムネイルと画像データを取得
const thumbnailPhotos = [
  ...(displayPost.thumbnails?.highQuality || []),
  ...(displayPost.thumbnails?.standard || [])
];
const photoUrls = displayPost.photoUrls || [];

// インデックスを取得
let imageIndex = photoUrls.findIndex(photoUrl => photoUrl === url);
if (imageIndex === -1) {
  imageIndex = 0;
}

// フルサイズ画像を使用
const fullSizeImages = displayPost.images && displayPost.images.length > 0 
  ? displayPost.images 
  : photoUrls;

console.log('🎨 [ArchivePage画像クリック]:', {
  thumbnailUrl: url.substring(0, 50),
  thumbnailUrlLength: url.length,
  thumbnailIndex: imageIndex,
  hasPostImages: displayPost.images && displayPost.images.length > 0,
  postImagesLength: displayPost.images?.length,
  postImagesDataLength: displayPost.images?.[0]?.length,
  photoUrlsLength: photoUrls.length,
  photoUrlsDataLength: photoUrls[0]?.length,
  fullSizeImagesCount: fullSizeImages?.length,
  fullSizeImageDataLength: fullSizeImages[0]?.length,
  usingFullSize: displayPost.images && displayPost.images.length > 0
});

setGalleryImages(fullSizeImages);
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



{/* メモ表示エリア - MemoDisplayコンポーネントを使用 */}
{/* メモ表示エリア - MemoDisplayコンポーネントを使用 */}
{(displayPost as PostWithMemos).memos && (displayPost as PostWithMemos).memos!.length > 0 && (
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
      メモ ({(displayPost as PostWithMemos).memos!.length}件)
    </div>
    
    {/* ★ ここを変更：新しい順にソート ★ */}
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
      {[...(displayPost as PostWithMemos).memos!]
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
        .map((memo) => (
          <MemoDisplay key={memo.id} memo={memo} />
        ))}
    </div>
  </div>
)}

    
          {/* アクションボタン - 権限制御付き */}
<div style={{
  marginTop: '2rem',
  paddingTop: '1rem',
  borderTop: '1px solid #f0f0f0',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center'
}}>
  {/* メモボタン（全員に表示） */}
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

  {/* 編集・削除ボタン（投稿者のみ表示） */}
  {isAuthor && (
    <div style={{ display: 'flex', gap: '0.5rem' }}>
      <button
        onClick={() => {
          onClose();
          const params = new URLSearchParams();
          params.set('from', 'archive');
          params.set('groupId', displayPost.groupId);
          navigate(`/edit-post/${displayPost.id}?${params.toString()}`);
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

      <button
  onClick={async () => {
    // 確認ダイアログを削除（handleDeleteで確認する）
    try {
      console.log('🗑️ [DetailModal] 削除開始:', displayPost.id);
      
      // モーダルを閉じる
      onClose();
      
      // 削除イベントを発火（handleDeleteが確認ダイアログを出す）
      const deleteEvent = new CustomEvent('archiveDelete', { 
        detail: { postId: displayPost.id } 
      });
      window.dispatchEvent(deleteEvent);
      
    } catch (error) {
      console.error('❌ [DetailModal] 削除エラー:', error);
      alert('削除に失敗しました');
    }
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
    </div>
  )}
</div>
              </div>
            </div>
          </div>
        </div>
      );
    };
  

  return (
   <div
  style={{
    minHeight: '100vh',
    background:
      'linear-gradient(to top, rgb(7, 112, 144), rgb(7, 107, 127), rgb(0, 102, 114))',
    padding: '1.5rem',
    boxSizing: 'border-box',
    paddingTop: '6.5rem',
    paddingBottom: '80px',
  }}
>
      <div
        style={{
          maxWidth: '480px',
          margin: '0 auto',
          paddingTop: showFilter
            ? `calc(6rem + ${filterHeight - 30}px)`
            : '0rem',
        }}
      >
        <style>
          {`
            @keyframes fadeIn {
              from { opacity: 0; transform: translateY(-10px); }
              to { opacity: 1; transform: translateY(0); }
            }
          `}
        </style>
        {/* ヘッダー部分 - 固定表示 */}
       <div
  style={{
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: '60px',
    zIndex: 100,
    background:
      'linear-gradient(to right, rgb(0, 102, 114), rgb(7, 107, 127))',
    display: 'flex',
    alignItems: 'center',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
    boxSizing: 'border-box',
  }}
>
          <div
  style={{
    maxWidth: '480px',
    margin: '0 auto',
    width: '100%',
    padding: '0 1.5rem',
    boxSizing: 'border-box',
  }}
>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              {/* 戻るボタン */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  cursor: 'pointer',
                  marginBottom: '0.2rem', // この行を追加
                }}
                onClick={() => {
  // ⭐ Homeページに戻る時、強制リフレッシュを指示 ⭐
  localStorage.setItem('force-refresh-home', Date.now().toString());
  console.log('🔄 [ArchivePage] Homeページの強制リフレッシュフラグを設定');
  
  // URLパラメータを保持したまま戻る
  const from = searchParams.get('from');
  const postId = searchParams.get('postId');
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (postId) params.set('postId', postId);
  const paramString = params.toString()
    ? `?${params.toString()}`
    : '';
  navigate(`/group/${groupId}${paramString}`);
}}
              >
                <svg
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="#F0DB4F"
  strokeWidth="2"
  strokeLinecap="round"
  strokeLinejoin="round"
>
  <path d="M15 18l-6-6 6-6" />
</svg>

           
              </div>

              {/* 検索アイコン - アクティブ状態を視覚的に表示 */}
              {/* 右側のボタン群 */}
<div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
  
  
  {/* 新しく追加：データ分析ボタン _ se 2で一時削除（Phase 3後に復活予定） */}
  {/* 
  <div
    onClick={() => {
      // URLパラメータを保持したまま遷移
      const from = searchParams.get('from');
      const postId = searchParams.get('postId');
    
      const params = new URLSearchParams();
      params.set('from', 'archive');
      if (from) params.set('originalFrom', from);
      if (postId) params.set('postId', postId);
      const paramString = params.toString() ? `?${params.toString()}` : '';
    
      navigate(`/group/${groupId}/ai-analysis${paramString}`);
    }}
    style={{
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '40px',
      height: '40px',
      borderRadius: '50%',
      backgroundColor: 'rgba(240, 219, 79, 0.1)',
      transition: 'background-color 0.3s',
    }}
  >
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#F0DB4F"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  </div>
*/}

  {/* 検索アイコン - アクティブ状態を視覚的に表示 */}
  <div
    onClick={() => setShowFilter((prev) => !prev)}
    style={{
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '40px',
      height: '40px',
      borderRadius: '50%',
      backgroundColor: showFilter
        ? 'rgba(240, 219, 79, 0.2)'
        : 'rgba(255, 255, 255, 0.1)',
      transition: 'background-color 0.3s',
    }}
  >
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke={showFilter ? '#F0DB4F' : '#ffffff'}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  </div>
</div>
            </div>
          </div>
        </div>
        {/* 検索機能 - 表示/非表示を制御 */}
        {showFilter && (
          <>
            {/* 透明な全画面オーバーレイ - クリックイベント検知用 */}
            <div
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 70, // フィルターより下、ヘッダーより上
                backgroundColor: 'transparent', // 完全透明
              }}
              onClick={() => setShowFilter(false)} // どこでもクリックしたらフィルターを閉じる
            />

            {/* 視覚的な背景レイヤー - クリックイベントなし */}
            <div
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100%',
                height: `calc(125px + ${filterHeight}px + 28px)`,
                backgroundColor: '#055A68',
                zIndex: 65, // 透明オーバーレイより下
                animation: 'fadeIn 0.3s ease',
                transition: 'height 0.3s ease',
              }}
            />

            {/* フィルターコンテナ - 固定表示 */}
            <div
              style={{
                position: 'fixed',
                top: '125px',
                left: 0,
                width: '100%',
                zIndex: 90,
                padding: '0 1.5rem',
                boxSizing: 'border-box',
                animation: 'fadeIn 0.3s ease',
              }}
            >
              <div
                ref={filterContainerRef}
                style={{
                  backgroundColor: '#ffffff22',
                  borderRadius: '15px',
                  padding: '1.5rem',
                  boxShadow: '0 2px 6px rgba(0, 0, 0, 0.1)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  maxWidth: '480px',
                  margin: '0 auto',
                  position: 'relative',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* キーワード検索 UI */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    position: 'relative',
                    marginBottom: '1rem',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      left: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#F0DB4F"
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
  value={searchInput}  // ← searchQueryではなくsearchInput
  onChange={(e) => {
    setSearchInput(e.target.value);  // 入力中の値を更新
  }}
  onKeyDown={(e) => {
    if (e.key === 'Enter') {
      setSearchQuery(searchInput);  // Enterキーで検索実行
      setIsSearchActive(true);
    }
  }}
  placeholder="キーワード・#タグで検索"
  className="search-input"
  style={{
    flex: 1,
    border: 'none',
    backgroundColor: '#ffffff12',
    padding: '0.7rem',
    paddingLeft: '2rem',
    color: '#fff',
    fontSize: '0.95rem',
    borderRadius: '40px',
    outline: 'none',
  }}
/>
                  {searchQuery && (
                    <button
                  onClick={() => {
  setSearchQuery('');
  setSearchInput('');
  setStartDate(null);  // ← 追加
  setEndDate(null);    // ← 追加
}}
                      style={{
                        position: 'absolute',
                        right: '10px',
                        background: 'none',
                        border: 'none',
                        color: '#ddd',
                        cursor: 'pointer',
                        fontSize: '1rem',
                        padding: '0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        backgroundColor: '#ffffff22',
                      }}
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* 日付検索 UI */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '1rem',
                      marginBottom: '1rem',
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <label
                        style={{
                          fontSize: '0.75rem',
                          display: 'block',
                          marginBottom: '0.3rem',
                          color: '#ddd',
                          paddingLeft: '0.2rem',
                        }}
                      >
                        開始日
                      </label>
                      <input
                        type="date"
                        value={
                          startDate ? startDate.toISOString().split('T')[0] : ''
                        }
                        onChange={(e) => {
                          const date = e.target.value
                            ? new Date(e.target.value)
                            : null;
                          setStartDate(date);
                        }}
                        style={{
                          width: '100%',
                          backgroundColor: '#ffffff12',
                          border: 'none',
                          padding: '0.6rem',
                          borderRadius: '8px',
                          color: '#fff',
                          fontSize: '0.9rem',
                          boxSizing: 'border-box',
                          colorScheme: 'dark',
                        }}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label
                        style={{
                          fontSize: '0.75rem',
                          display: 'block',
                          marginBottom: '0.3rem',
                          color: '#ddd',
                          paddingLeft: '0.2rem',
                        }}
                      >
                        終了日
                      </label>
                      <input
                        type="date"
                        value={
                          endDate ? endDate.toISOString().split('T')[0] : ''
                        }
                        onChange={(e) => {
                          const date = e.target.value
                            ? new Date(e.target.value)
                            : null;
                          setEndDate(date);
                        }}
                        style={{
                          width: '100%',
                          backgroundColor: '#ffffff12',
                          border: 'none',
                          padding: '0.6rem',
                          borderRadius: '8px',
                          color: '#fff',
                          fontSize: '0.9rem',
                          boxSizing: 'border-box',
                          colorScheme: 'dark',
                        }}
                      />
                    </div>
                  </div>

                  {/* 全選択チェックボックスと検索条件クリアボタン */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      marginBottom: '0.5rem',
                    }}
                  >
                    {/* 全選択チェックボックス */}
                    {/* 全選択チェックボックス（条件付き表示） */}
{shouldShowSelection() && (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      marginLeft: '0.2rem',
    }}
  >
    <input
      type="checkbox"
      id="select-all"
      checked={selectAll}
      onChange={toggleSelectAll}
      style={{
        width: '18px',
        height: '18px',
        accentColor: '#F0DB4F',
        cursor: 'pointer',
      }}
    />
    <label
      htmlFor="select-all"
      style={{
        fontSize: '0.85rem',
        color: '#fff',
        cursor: 'pointer',
      }}
    >
      ALL
    </label>
  </div>
)}

                    {/* 検索条件クリアボタン */}
                    {(startDate || endDate || searchQuery) && (
                      <button
                    onClick={() => {
  setSearchQuery('');
  setSearchInput('');
  setStartDate(null);  // ← 追加
  setEndDate(null);    // ← 追加
}}
                        style={{
                          padding: '0.5rem 1rem',
                          backgroundColor: '#ffffff12',
                          border: 'none',
                          color: '#F0DB4F',
                          borderRadius: '25px',
                          fontSize: '0.85rem',
                          fontWeight: 'bold',
                          cursor: 'pointer',
                          marginLeft: 'auto',
                        }}
                      >
                        フィルタをクリア
                      </button>
                    )}
                  </div>

                  {/* ダウンロードリンク生成ボタン */}
                  {selectedPostIds.size > 0 && (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginTop: '1rem',
                      }}
                    >
                      {/* 選択件数の表示 */}
                      <div
                        style={{
                          color: '#F0DB4F',
                          fontSize: '0.9rem',
                          marginBottom: '0.8rem',
                          fontWeight: 'bold',
                        }}
                      >
                        選択した{selectedPostIds.size}件の投稿
                      </div>

                      {/* ボタン部分 */}
                      <button
                        onClick={generateDownloadLink}
                        style={{
                          padding: '0.6rem 1rem',
                          backgroundColor: '#F0DB4F',
                          color: '#1e1e2f',
                          border: 'none',
                          borderRadius: '40px',
                          fontSize: '0.9rem',
                          fontWeight: 'bold',
                          cursor: 'pointer',
                          width: '90%',
                          display: 'flex',
                          justifyContent: 'center',
                          alignItems: 'center',
                          gap: '0.5rem',
                        }}
                      >
                        <span>ダウンロードリンクを生成</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
        {/* ローディング表示 */}
        {loading && (
          <div style={{ textAlign: 'center', color: '#fff', padding: '2rem' }}>
            <div
              style={{
                width: '30px',
                height: '30px',
                border: '3px solid rgba(240, 219, 79, 0.3)',
                borderTop: '3px solid #F0DB4F',
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
            投稿を読み込み中...
          </div>
        )}

        
        {/* ⭐ 新着通知バナー（画面上部固定表示） ⭐ */}
{hasNewPosts && (
  <div
    style={{
      position: 'fixed',
      top: '100px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 1000,
      backgroundColor: '#FFFFFF',
      color: '#055A68',
      padding: '15px 25px',  
      borderRadius: '10px',
      boxShadow: '0 0 12px rgba(0,0,0,0.3)',
      cursor: 'pointer',
      display: 'flex',
      flexDirection: 'row', 
      alignItems: 'center',
      gap: '8px',
      fontSize: '0.9rem',
      fontWeight: '500',
      maxWidth: 'calc(100% - 32px)',
    }}
    onClick={async () => {
      console.log('🔄 [ArchivePage] 新着バナーをクリック - 再取得開始');
      setHasNewPosts(false);
      setLoading(true);
      
      // キャッシュクリア
      delete archivePostsCache[groupId || ''];
      delete archivePostsCacheTime[groupId || ''];
      
      // 最新データ取得
      const userId = localStorage.getItem('daily-report-user-id') || '';
     const result = await UnifiedCoreSystem.getGroupPostsPaginated(groupId || '', userId, 10);
const freshPosts = result.posts;  // ← 投稿データだけを取り出す

setPosts(freshPosts);
setFilteredPosts(freshPosts);

      // ⭐ 最新タイムスタンプを更新（バナー再表示を防ぐ） ⭐
  if (freshPosts.length > 0) {
    const timestamps = freshPosts
  .map(p => {
    // Firestoreから取得した直後なので、Timestamp型の可能性がある
    const createdAt = p.createdAt;
if (createdAt !== null && createdAt !== undefined && typeof createdAt === 'object' && typeof (createdAt as any).toMillis === 'function') {
  return (createdAt as any).toMillis();
}
    return p.createdAt || 0;
  })
  .filter(t => t > 0);
    if (timestamps.length > 0) {
      const latest = Math.max(...timestamps);
      setLatestPostTime(latest);
      console.log('✅ [ArchivePage] バナークリック後、最新時刻を更新:', new Date(latest).toLocaleString('ja-JP'));
    }
  }

      setLoading(false);
      
      console.log('✅ [ArchivePage] 最新データ取得完了:', freshPosts.length, '件');
    }}
  >
<span style={{ whiteSpace: 'nowrap' }}>新しい投稿があります。</span>
<span style={{ whiteSpace: 'nowrap' }}>
<span style={{ textDecoration: 'underline' }}>  更新</span>
</span>
  </div>
)}



        {/* 投稿がない場合 */}
        {!loading && filteredPosts.length === 0 && (
          <div
          style={{
            backgroundColor: '#ffffff22',
            padding: '2rem',
            borderRadius: '12px',
            textAlign: 'center',
            color: '#fff',
            maxWidth: '480px',
            width: '100%',
            margin: '0 auto',
            boxSizing: 'border-box',
            marginBottom: '1.5rem',
          }}
        >
          {posts.length === 0 ? (
            <>
              {/* アイコン行を削除 */}
              投稿はまだありません
            </>
          ) : (
            <>
              {/* アイコン行を削除 */}
              検索条件に一致する投稿はありません
            </>
          )}
        </div>
       )}
       
        {/* ページタイトル - GroupListPageと同じスタイル */}
        {!loading && (
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            marginBottom: '1.5rem',
            maxWidth: '480px',
            width: '100%',
            margin: '0 auto 1.5rem auto',
          }}>
            <h2 style={{ 
              fontSize: '2rem', 
              letterSpacing: '0.01em', 
              color: '#F0DB4F', 
              margin: 0 
            }}>
              Archive
            </h2>
          </div>
        )}

{/* 投稿リスト */}
{!loading && (
  <>
    {/* フィルター適用中のタイトル表示 - フィルター適用時のみ表示 */}
    {(searchQuery || startDate || endDate) && filteredPosts.length > 0 && (
      <div
        style={{
          marginTop: '2px',
          marginBottom: '1.5rem',
          maxWidth: '480px',
          width: '100%',
          marginLeft: 'auto',
          marginRight: 'auto',
        }}
      >
        <h3 style={{ 
            color: '#97c9c2', 
            fontSize: '1.5rem',
            letterSpacing: 'normal',
            margin: 0,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            フィルター適用中
            {isCountingResults ? (
              <div style={{
                width: '16px',
                height: '16px',
                border: '2px solid rgba(151, 201, 194, 0.3)',
                borderTop: '2px solid #97c9c2',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
            ) : searchResultCount !== null ? (
              <span style={{ fontSize: '0.9rem', color: '#F0DB4F', fontWeight: 'bold' }}>
                (全{searchResultCount}件)
              </span>
            ) : (
              <span style={{ fontSize: '0.9rem', color: '#97c9c2' }}>
                ({filteredPosts.length}件)
              </span>
            )}
          </h3>
      </div>
    )}

    {Object.entries(groupedPosts).map(([date, postsForDate]) => (
      <div
        key={date}
        data-timeline-content="true"
        style={{
          marginBottom: '2rem',
          maxWidth: '480px',
          width: '100%',
          margin: '0 auto',
        }}
      >
        <h3
          style={{
            color: '#F0DB4F',
            marginBottom: '1rem',
            fontSize: '1rem',
            backgroundColor: '#00000022',
            display: 'inline-block',
            padding: '0.4rem 1rem',
            borderRadius: '20px',
          }}
        >
          {date}
        </h3>

        {postsForDate.map((post) => {
  // デバッグ: isWorkTimePostの値を確認
  if (post.tags?.includes('#出退勤時間')) {
    console.log('🔍 [ArchivePage レンダリング判定]', {
      postId: post.id,
      isWorkTimePost: post.isWorkTimePost,
      isEdited: post.isEdited,
      tags: post.tags,
      message: post.message?.substring(0, 50)
    });
  }
  
  return post.isWorkTimePost ? (
            // 作業時間投稿の専用カードを表示
            <WorkTimePostCard
  key={post.id}
  post={post}
  onDelete={handleDelete}
  selectedPostIds={selectedPostIds}
  togglePostSelection={togglePostSelection}
  currentUserId={currentUserId}
  hasOthersRead={hasOthersRead}
  handleEditPost={handleEditPost}
  shouldShowSelection={shouldShowSelection} 
  setSelectedPostForStatus={setSelectedPostForStatus}
  getContainerStatusStyle={getContainerStatusStyle}
  handleAddMemo={handleAddMemo} 
  setPosts={setPosts}
  setFilteredPosts={setFilteredPosts}
  from="archive"  // ⭐ この行を追加!
/>
          ) : (
            // 通常の投稿カード
            <div
              key={post.id}
              style={{
                backgroundColor: '#ffffff22',
                backdropFilter: 'blur(4px)',
                color: '#fff',
                padding: '1rem',
                borderRadius: '12px',
                marginBottom: '1rem',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
              }}
            >
              {/* ユーザー名と時間を表示するヘッダー */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '0.8rem',
                }}
              >
                {/* 投稿者名とアバター */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      backgroundColor: '#F0DB4F22',
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      marginRight: '0.5rem',
                    }}
                  >
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
  {DisplayNameResolver.resolve(post)}
</div>
                </div>

                {/* 投稿時間 */}
                <div style={{ fontSize: '0.85rem', color: '#ddd' }}>
                  {post.time.split('　')[1]}
                </div>
              </div>

              {post.message && post.message.length > 0 && (
                <div
                  style={{
                    marginBottom: '0.8rem',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                    overflowWrap: 'break-word',
                    lineHeight: '1.5',
                    fontSize: '0.95rem',
                  }}
                >
                 {post.message.length > MAX_MESSAGE_LENGTH ? (
                    <div>
                      {`${post.message.substring(
                        0,
                        MAX_MESSAGE_LENGTH
                      )}...`}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditPost(post.id);
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#F0DB4F',
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
                  ) : (
  // 🆕 チェックイン投稿の場合は新フォーマット
post.tags?.includes('#チェックイン') ? (() => {
  const timeInfo = extractTimeInfo(post.message || '');
  const cleanMessage = removeTimeInfo(post.message || '');
  const duration = post.tags?.includes('#チェックアウト') 
    ? calculateWorkDuration(post.message || '') 
    : null;
  
  return (
       
        <div>
          

      {/* 作業開始・終了を1行に */}
      {(timeInfo.startTime || timeInfo.endTime) && (
        <div style={{ marginBottom: '0.5rem', color: '#FFFFFF' }}>
          {timeInfo.startTime && `開始: ${timeInfo.startTime}`}
          {timeInfo.startTime && timeInfo.endTime && '  ー  '}
          {timeInfo.endTime && `終了: ${timeInfo.endTime}`}
        </div>
      )}
      
      {/* 区切り線 + 作業時間 + 区切り線 */}
      {duration && (
        <>
          <div style={{ 
            borderTop: '1px solid rgba(255, 255, 255, 0.3)',
            width: '65%',
            margin: '0.5rem 0'
          }} />
          <div style={{ marginBottom: '0.5rem', color: '#FFFFFF' }}>
           ■ 作業時間: {duration}
          </div>
          <div style={{ 
            borderTop: '1px solid rgba(255, 255, 255, 0.3)',
            width: '65%',
            margin: '0.5rem 0'
          }} />
        </>
      )}
      
      {/* 日付 */}
      {timeInfo.date && (
        <div style={{ marginBottom: '0.5rem', color: '#FFFFFF' }}>
          日付: {timeInfo.date}
        </div>
      )}
      
      {/* クリーンなメッセージ */}
      {cleanMessage && (
        <div style={{ marginTop: '0.5rem', color: '#FFFFFF' }}>
          {cleanMessage}
        </div>
      )}
      
      {/* 編集済み表示 */}
      {post.isManuallyEdited && (
  <span style={{
    color: '#F0DB4F',
    fontSize: '0.8rem',
  }}>
          （編集済み）
        </span>
      )}
    </div>
  );
})() : (
  // 通常投稿の場合はそのまま表示
  <div>
    {post.message}
    {post.isManuallyEdited && (
  <span style={{
    color: '#F0DB4F',
    fontSize: '0.8rem',
  }}>
    （編集済み）
      </span>
    )}
  </div>
)
)}
                </div>
              )}
              {post.tags && post.tags.length > 0 && (
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '0.5rem',
                    marginBottom: '0.8rem',
                    marginTop: '0.8rem',
                  }}
                >
                  {post.tags.map((tag, index) => (
                    <span
                      key={index}
                      style={{
                        backgroundColor: '#C0C0C095',
                        color: 'rgb(0, 102, 114)',
                        padding: '0.25rem 0.7rem',
                        borderRadius: '999px',
                        fontSize: '0.75rem',
                        fontWeight: '800',
                        cursor: 'pointer',
                      }}
                      onClick={() => setSearchQuery(tag)} 
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

            

              {post.photoUrls && post.photoUrls.length > 0 && (
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '0.5rem',
                    marginTop: '1.5rem',
                  }}
                >
                  {post.photoUrls
                    .slice(0, Math.min(7, post.photoUrls.length))
                    .map((url, index) => (
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
                        onClick={() => {
  const imageIndex = post.photoUrls.findIndex(photoUrl => photoUrl === url);
  
  // フルサイズ画像を使用
  const fullSizeImages = post.images && post.images.length > 0 
    ? post.images 
    : post.photoUrls;
  
  console.log('🎨 [ArchivePage 3742行目] 画像クリック:', {
    photoUrlsLength: post.photoUrls?.length,
    photoUrlsDataLength: post.photoUrls?.[0]?.length,
    postImagesLength: post.images?.length,
    postImagesDataLength: post.images?.[0]?.length,
    fullSizeImagesLength: fullSizeImages.length,
    fullSizeImageDataLength: fullSizeImages[0]?.length,
    usingFullSize: post.images && post.images.length > 0
  });
  
  setGalleryImages(fullSizeImages);
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
                            objectFit: 'cover',
                          }}
                          loading="lazy"
                        />
                      </div>
                    ))}

                  {post.photoUrls.length > 7 && (
                    <div
                      style={{
                        width: 'calc((100% - 1.5rem) / 4)',
                        aspectRatio: '1/1',
                        borderRadius: '8px',
                        backgroundColor: 'rgba(100, 152, 164, 0.5)',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        color: '#F0DB4F',
                        fontSize: '1.1rem',
                        fontWeight: 'bold',
                        marginTop: '0.5rem',
                        cursor: 'pointer',
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditPost(post.id);
                      }}
                    >
                      +{post.photoUrls.length - 7}
                    </div>
                  )}
                </div>
              )}

              {/* 投稿の下部セクション */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginTop: '1rem',
                  paddingTop: '0.5rem',
                  borderTop: '1px solid #ffffff22',
                  gap: '10px',
                }}
              >
                {/* 左側 - 選択とステータスのグループ */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                  {/* 選択チェックボックス（条件付き表示） */}
                  {shouldShowSelection() && (
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <input
                        type="checkbox"
                        id={`select-post-${post.id}`}
                        checked={selectedPostIds.has(post.id)}
                        onChange={() => togglePostSelection(post.id)}
                        style={{
                          width: '18px',
                          height: '18px',
                          accentColor: '#F0DB4F',
                          cursor: 'pointer',
                          marginRight: '8px',
                          boxShadow: 'none',
                          appearance: 'auto',
                        }}
                      />
                      <label
                        htmlFor={`select-post-${post.id}`}
                        style={{
                          fontSize: '0.8rem',
                          color: '#ddd',
                          cursor: 'pointer',
                        }}
                      >
                        選択
                      </label>
                    </div>
                  )}

                  {/* ステータス表示 */}
                  <div style={{ display: 'flex', alignItems: 'center' }}>
  {(() => {
    const currentUserId = localStorage.getItem("daily-report-user-id") || "";
    const readStatus = getPostReadStatus(post, currentUserId);

// 🆕 チェックイン・チェックアウト投稿では既読を非表示
if (post.tags?.includes('#出退勤時間')) {
  return null;
}

if (readStatus.isAuthor) {
      // 投稿者の場合：既読カウント表示
      return (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          padding: '0.3rem 0.8rem',
          backgroundColor: 'rgba(5, 90, 104, 0.15)', // 薄いグリーン背景
          borderRadius: '20px',
          fontSize: '0.75rem',
          color: 'white',
          fontWeight: '500'
        }}>
          <div style={{
  width: '16px',
  height: '16px',
  borderRadius: '50%',
  backgroundColor: Object.keys(post.readBy || {}).length > 0 ? 'white' : 'rgba(255, 255, 255, 0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '0.6rem',
  color: '#1f5b91',
  fontWeight: '600'
}}>
  {(() => {
    const readCount = Object.keys(post.readBy || {}).length;
    console.log('📊 [既読数デバッグ] 投稿ID:', post.id);
console.log('📊 [既読数デバッグ] readBy:', post.readBy);
console.log('📊 [既読数デバッグ] readCount:', readCount);
console.log('📊 [既読数デバッグ] 現在のユーザー:', currentUserId);
console.log('📊 [既読数デバッグ] 投稿者:', post.authorId);
    return readCount;
  })()}
</div>
          <span>既読</span>
        </div>
      );
    } else {
      // 投稿者以外の場合：従来のステータスポップアップを復活
      return (
        <span 
          style={getContainerStatusStyle(post.status || '未確認')} onClick={async (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // 重複実行防止
            const target = e.currentTarget as HTMLElement;
            if (target.dataset.processing === 'true') return;
            target.dataset.processing = 'true';
            
            try {
              
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
                </div>

                {/* 右側 - ボタン群 */}
<div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
  {/* 詳細ボタン */}
  <button
    onClick={() => handleEditPost(post.id)}
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

  {/* 削除ボタン（投稿者のみ表示） */}
  {(() => {
    const currentUserId = localStorage.getItem('daily-report-user-id') || '';
    const isAuthor = post.userId === currentUserId || 
                     post.createdBy === currentUserId ||
                     post.authorId === currentUserId;
    return isAuthor ? (
      <button
        onClick={() => handleDelete(post.id)}
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
        削除
      </button>
    ) : null;
  })()}
</div>
              </div>
            </div>
          );
        })}
      </div>
    ))}
  </>
)}
        
        {/* 画像ギャラリーモーダル */}
<ImageGalleryModal
  images={galleryImages}
  initialIndex={galleryIndex}
  isOpen={galleryOpen}
  onClose={() => setGalleryOpen(false)}
/>


        {/* ダウンロードリンクモーダル */}
        {downloadLink && (
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
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setDownloadLink(null);
              }
            }}
          >
            <div
              style={{
                backgroundColor: '#1e1e2f',
                padding: '1.5rem',
                borderRadius: '12px',
                width: '85%',
                maxWidth: '400px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3
                style={{ color: '#F0DB4F', marginTop: 0, textAlign: 'center' }}
              >
                エクスポート形式を選択
              </h3>

              <p
                style={{
                  textAlign: 'center',
                  color: '#fff',
                  marginBottom: '1rem',
                }}
              >
                選択した{selectedPostIds.size}件の投稿をダウンロードできます
              </p>

              {/* リンク表示エリア */}
              <div
                style={{
                  backgroundColor: '#2a2a3a',
                  padding: '0.75rem',
                  borderRadius: '6px',
                  width: '100%',
                  marginBottom: '1.5rem',
                  wordBreak: 'break-all',
                  fontSize: '0.8rem',
                  maxHeight: '80px',
                  overflowY: 'auto',
                  color: '#ddd',
                }}
              >
                {downloadLink}
              </div>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                  width: '100%',
                }}
              >
                {/* HTMLダウンロードボタン */}
                <button
                  onClick={() => {
                    const a = document.createElement('a');
                    a.href = downloadLink;
                    a.download = `daily-report-export-${new Date()
                      .toISOString()
                      .slice(0, 10)}.html`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                  }}
                  style={{
                    padding: '0.75rem',
                    backgroundColor: '#F0DB4F',
                    color: '#1e1e2f',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '0.9rem',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                  }}
                >
                  HTMLでダウンロード
                </button>

                {/* PDFダウンロードボタン */}
                <button
                  onClick={generatePDF}
                  disabled={isGeneratingPdf}
                  style={{
                    padding: '0.75rem',
                    backgroundColor: isGeneratingPdf ? '#555' : '#F0DB4F',
                    color: '#1e1e2f',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '0.9rem',
                    fontWeight: 'bold',
                    cursor: isGeneratingPdf ? 'default' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                  }}
                >
                  {isGeneratingPdf ? 'PDF生成中...' : 'PDFでダウンロード'}
                </button>

                <button
                  onClick={() => setDownloadLink(null)}
                  style={{
                    padding: '0.75rem',
                    backgroundColor: '#333',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                  }}
                >
                  閉じる
                </button>
              </div>
            </div>
          </div>
        )}
        {/* ローディングインジケーター（リンク生成中の表示） */}
        {isGeneratingLink && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              zIndex: 1000,
            }}
          >
            <div
              style={{
                backgroundColor: '#1e1e2f',
                padding: '2rem',
                borderRadius: '12px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
            >
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  border: '4px solid rgba(240, 219, 79, 0.3)',
                  borderTop: '4px solid #F0DB4F',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                  marginBottom: '1rem',
                }}
              ></div>
              <p style={{ color: '#fff', margin: 0 }}>
                ダウンロードリンクを生成中...
              </p>
            </div>
          </div>
        )}
        {/* PDF生成中のローディングインジケーター */}
        {isGeneratingPdf && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              zIndex: 1100,
            }}
          >
            <div
              style={{
                backgroundColor: '#1e1e2f',
                padding: '2rem',
                borderRadius: '12px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
            >
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  border: '4px solid rgba(240, 219, 79, 0.3)',
                  borderTop: '4px solid #F0DB4F',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                  marginBottom: '1rem',
                }}
              ></div>
              <p style={{ color: '#fff', margin: 0 }}>PDFを生成中...</p>
            </div>
          </div>
        )}
      </div>

      {/* ステータス選択モーダル */}
{selectedPostForStatus && (
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
            onClick={() => handleStatusUpdate(selectedPostForStatus, status)}
            style={{
              ...getModalStatusStyle(status), 
              cursor: 'pointer',
              textAlign: 'center',
              transition: 'all 0.2s',
              width: '100%',
      // ★ この行を追加 ★
      opacity: (posts.find(p => p.id === selectedPostForStatus)?.status || '未確認') === status ? 0.5 : 1
    }}
    onMouseEnter={(e) => e.currentTarget.style.opacity = '0.6'}
    onMouseLeave={(e) => {
      // ★ この部分を修正 ★
      const currentStatus = posts.find(p => p.id === selectedPostForStatus)?.status || '未確認';
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

{/* AI質問応答モーダル */}
{showAnalysisModal && (
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
    onClick={() => setShowAnalysisModal(false)}
  >
    <div
      style={{
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        width: '100%',
        maxWidth: '500px',
        maxHeight: '80vh',
        padding: '3.5rem 1.5rem', 
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
        overflowY: 'auto',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <h3 style={{ color: '#055A68', margin: '0 0 1rem 0' }}>
        AI作業分析アシスタント
      </h3>
      
      {!aiAnswer ? (
        /* 質問入力フェーズ */
        <div>
          <p style={{ color: '#666', marginBottom: '1rem' }}>
            このグループの投稿データ（{posts.length}件）について、なんでも質問してください。
          </p>
          
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ 
              display: 'block', 
              color: '#055A68', 
              fontSize: '0.9rem', 
              marginBottom: '0.5rem',
              fontWeight: 'bold'
            }}>
              質問を入力してください：
            </label>
            <textarea
              value={userQuestion}
              onChange={(e) => setUserQuestion(e.target.value)}
              placeholder="例：先月の作業で最も時間がかかった工程は何ですか？&#10;例：作業効率はどうですか？&#10;例：コスト削減効果を教えて"
              style={{
                width: '100%',
                height: '120px',
                padding: '0.75rem',
                border: '2px solid #ddd',
                borderRadius: '8px',
                fontSize: '0.9rem',
                resize: 'vertical',
                boxSizing: 'border-box',
                fontFamily: 'inherit',
                outline: 'none',
                transition: 'border-color 0.3s',
              }}
              onFocus={(e) => e.target.style.borderColor = '#F0DB4F'}
              onBlur={(e) => e.target.style.borderColor = '#ddd'}
            />
          </div>
          
          <div style={{ marginBottom: '1rem' }}>
            <p style={{ color: '#888', fontSize: '0.8rem', margin: '0' }}>
              💡 質問例：「作業効率」「コスト削減」「問題点」「進捗状況」など
            </p>
          </div>
          
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={handleAskQuestion}
              disabled={!userQuestion.trim() || isAnalyzing}
              style={{
                flex: 1,
                padding: '0.75rem',
                backgroundColor: userQuestion.trim() && !isAnalyzing ? '#F0DB4F' : '#ccc',
                color: '#055A68',
                border: 'none',
                borderRadius: '8px',
                fontSize: '0.9rem',
                fontWeight: 'bold',
                cursor: userQuestion.trim() && !isAnalyzing ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
              }}
            >
              {isAnalyzing ? (
                <>
                  <div style={{
                    width: '16px',
                    height: '16px',
                    border: '2px solid rgba(5, 90, 104, 0.3)',
                    borderTop: '2px solid #055A68',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }} />
                  AI分析中...
                </>
              ) : (
                'AIに質問する'
              )}
            </button>
            
            <button
              onClick={() => setShowAnalysisModal(false)}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: '#fff',
                color: '#666',
                border: '1px solid #ddd',
                borderRadius: '8px',
                fontSize: '0.9rem',
                cursor: 'pointer',
              }}
            >
              閉じる
            </button>
          </div>
        </div>
      ) : (
        /* AI回答表示フェーズ */
        <div>
          <div style={{ 
            backgroundColor: '#f8f9fa', 
            padding: '1rem', 
            borderRadius: '8px',
            marginBottom: '1rem',
            borderLeft: '4px solid #F0DB4F'
          }}>
            <strong style={{ color: '#055A68' }}>あなたの質問:</strong>
            <p style={{ margin: '0.5rem 0 0 0', color: '#666' }}>{userQuestion}</p>
          </div>
          
          <div style={{ 
            backgroundColor: '#e8f5e8', 
            padding: '1rem', 
            borderRadius: '8px',
            marginBottom: '1rem',
            borderLeft: '4px solid #4CAF50'
          }}>
            <strong style={{ color: '#055A68' }}>AI回答:</strong>
            <div style={{ 
              margin: '0.5rem 0 0 0', 
              color: '#666', 
              lineHeight: '1.6',
              whiteSpace: 'pre-line'
            }}>
              {aiAnswer}
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => {
                setAiAnswer('');
                setUserQuestion('');
              }}
              style={{
                flex: 1,
                padding: '0.75rem',
                backgroundColor: '#F0DB4F',
                color: '#055A68',
                border: 'none',
                borderRadius: '8px',
                fontSize: '0.9rem',
                fontWeight: 'bold',
                cursor: 'pointer',
              }}
            >
              新しい質問をする
            </button>
            
            <button
              onClick={() => setShowAnalysisModal(false)}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: '#fff',
                color: '#666',
                border: '1px solid #ddd',
                borderRadius: '8px',
                fontSize: '0.9rem',
                cursor: 'pointer',
              }}
            >
              閉じる
            </button>
          </div>
        </div>
      )}
    </div>
  </div>
)}

<style>
  {`
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `}
</style>

{/* メモ作成モーダル（PostDetailPageと同じ実装） */}
<MemoModal
  isOpen={memoModalOpen}
  onClose={() => {
    console.log('❌ [ArchivePage] メモモーダルをキャンセル');
    
    // ⭐ 修正：元の投稿を取得して詳細モーダルを再表示
    const targetPostId = selectedPostForMemo;
    
    // メモモーダルを閉じる
    setMemoModalOpen(false);
    setMemoContent('');
    setSelectedPostForMemo(null);
    
    // 詳細モーダルを開く（元の投稿で）
    if (targetPostId) {
      const targetPost = posts.find(p => p.id === targetPostId);
      if (targetPost) {
        setSelectedPostForDetail(targetPost);
        console.log('✅ [ArchivePage] 詳細モーダルに戻る');
      }
    }
  }}
  postId={selectedPostForMemo || ''}
  onSave={handleSaveMemo}
/>




{/* 投稿詳細モーダル */}
{selectedPostForDetail && (
  <PostDetailModal
    post={selectedPostForDetail}
    onClose={() => setSelectedPostForDetail(null)}
    navigate={navigate}
    onMemoClick={(post) => handleAddMemo(post.id)}
    from="archive" 
  />
)}
      {/* グループフッターナビゲーション */}
      <GroupFooterNav activeTab="history" />
    </div>
  );
};


// キャッシュ無効化関数（PostPageなどから呼び出し可能）
export const invalidateArchiveCache = (groupId?: string) => {
  if (groupId) {
    delete archivePostsCache[groupId];
    delete archivePostsCacheTime[groupId];
    console.log('🗑️ [ArchivePage] キャッシュを無効化:', groupId);
  } else {
    archivePostsCache = {};
    archivePostsCacheTime = {};
    console.log('🗑️ [ArchivePage] 全キャッシュを無効化');
  }
};
export default ArchivePage;
