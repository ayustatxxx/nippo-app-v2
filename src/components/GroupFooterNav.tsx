// src/components/GroupFooterNav.tsx
// 改良版：スクロール連動 + +ボタン表示機能付き（グループ内用）

import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useFooterVisibility } from '../hooks/useFooterVisibility';
import { transitions, calculateStaggerDelay } from '../utils/animationUtils';

// タブの種類を定義
type TabType = 'post' | 'history' | 'members';

interface GroupFooterNavProps {
  activeTab: TabType;
  onTabChange?: (tab: TabType) => void;
}

const GroupFooterNav: React.FC<GroupFooterNavProps> = ({ 
  activeTab, 
  onTabChange 
}) => {
  const navigate = useNavigate();
  const { groupId } = useParams<{ groupId: string }>();
  
  // 新機能：フッター表示制御
  const { showFooter, showFAB, animationTrigger, toggleFooter } = useFooterVisibility();
  
  // タブ切り替えの処理
  const handleTabChange = (tab: TabType) => {
    if (onTabChange) {
      onTabChange(tab);
    } else {
      // URLパラメータを保持したナビゲーション
      const currentUrl = new URL(window.location.href);
      const searchParams = currentUrl.searchParams;
      
      const params = new URLSearchParams();
      const from = searchParams.get('from');
      const postId = searchParams.get('postId');
      
      if (from) params.set('from', from);
      if (postId) params.set('postId', postId);
      const paramString = params.toString() ? `?${params.toString()}` : '';
      
      switch(tab) {
        case 'post':
          navigate(`/group/${groupId}/post${paramString}`);
          break;
        case 'history':
          navigate(`/group/${groupId}/archive${paramString}`);
          break;
        case 'members':
          navigate(`/group/${groupId}/members${paramString}`);
          break;
      }
    }
  };

  // メニューアイテムの設定
  const menuItems = [
    {
      tab: 'post' as TabType,
      icon: (isActive: boolean) => (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" 
             stroke={isActive ? '#F0DB4F' : '#999'} strokeWidth="2" 
             strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 2l-2 2-7 7-7 7v4h4l7-7 7-7 2-2-4-4z" />
          <path d="M14 6l4 4" />
        </svg>
      ),
      label: "投稿"
    },
    {
      tab: 'history' as TabType,
      icon: (isActive: boolean) => (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" 
             stroke={isActive ? '#F0DB4F' : '#999'} strokeWidth="2" 
             strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
          <line x1="8" y1="7" x2="16" y2="7" />
          <line x1="8" y1="12" x2="16" y2="12" />
          <line x1="8" y1="17" x2="12" y2="17" />
        </svg>
      ),
      label: "履歴"
    },
    {
      tab: 'members' as TabType,
      icon: (isActive: boolean) => (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" 
             stroke={isActive ? '#F0DB4F' : '#999'} strokeWidth="2" 
             strokeLinecap="round" strokeLinejoin="round">
          <circle cx="9" cy="7" r="4" />
          <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          <path d="M21 21v-2a4 4 0 0 0-3-3.85" />
        </svg>
      ),
      label: "メンバー"
    }
  ];

  return (
    <>
      {/* +ボタン（グループ用スタイル）- 新機能 */}
      {showFAB && (
        <div
          style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            backgroundColor: '#252537', // GroupFooterNavの色に合わせる
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            boxShadow: '0 4px 20px rgba(37, 37, 55, 0.4)',
            cursor: 'pointer',
            zIndex: 200,
            // 新機能：スムーズなアニメーション
            transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
            transform: `scale(${showFAB ? 1 : 0.5}) translateY(${showFAB ? 0 : 20}px)`,
            opacity: showFAB ? 1 : 0,
            pointerEvents: showFAB ? 'auto' : 'none',
            animation: showFAB ? 'fabBreath 3s ease-in-out infinite' : 'none',
          }}
          onClick={toggleFooter}
          // 新機能：タップエフェクト
          onTouchStart={(e) => {
            (e.currentTarget as HTMLElement).style.transform = 'scale(0.9)';
            (e.currentTarget as HTMLElement).style.backgroundColor = '#333346';
          }}
          onTouchEnd={(e) => {
            (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
            (e.currentTarget as HTMLElement).style.backgroundColor = '#252537';
          }}
        >
          {/* グループ用のメニューアイコン（3本線） */}
          {/* グループ用のプラスアイコン */}
<svg 
  width="24" 
  height="24" 
  viewBox="0 0 24 24" 
  fill="none" 
  stroke="#F0DB4F"
  strokeWidth="2.5" 
  strokeLinecap="round" 
  strokeLinejoin="round"
>
  <line x1="12" y1="5" x2="12" y2="19" />
  <line x1="5" y1="12" x2="19" y2="12" />
</svg>
        </div>
      )}

      {/* グループフッター */}
      {showFooter && (
        <div
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            width: '100%',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: '#252537',
            height: '64px',
            borderTopLeftRadius: '20px',
            borderTopRightRadius: '20px',
            boxShadow: '0 -2px 10px rgba(0, 0, 0, 0.1)',
            zIndex: 100,
            // 新機能：スライドアニメーション
            transform: showFooter ? 'translateY(0)' : 'translateY(100%)',
            opacity: showFooter ? 1 : 0,
            transition: 'all 0.25s cubic-bezier(0.645, 0.045, 0.355, 1)'
          }}
        >

          {/* アイコンコンテナ */}
<div style={{
  display: 'flex',
  justifyContent: 'space-between',
  width: '60%',  // ← 80%から60%に変更（アイコンが近づく）
  maxWidth: '240px',  // ← 300pxから240pxに変更
}}>

            {menuItems.map((item, index) => (
              <div 
                key={item.tab}
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  backgroundColor: activeTab === item.tab ? '#F0DB4F22' : 'transparent',
                  cursor: 'pointer',
                  transition: transitions.smooth,
                  // 新機能：順番にアニメーション
                  animationDelay: calculateStaggerDelay(index, 40)
                }}
                onClick={() => handleTabChange(item.tab)}
                // 新機能：タップエフェクト
                onTouchStart={(e) => {
                  (e.currentTarget as HTMLElement).style.transform = 'scale(0.9)';
                  (e.currentTarget as HTMLElement).style.backgroundColor = 
                    activeTab === item.tab ? '#F0DB4F33' : 'rgba(240, 219, 79, 0.1)';
                }}
                onTouchEnd={(e) => {
                  (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
                  (e.currentTarget as HTMLElement).style.backgroundColor = 
                    activeTab === item.tab ? '#F0DB4F22' : 'transparent';
                }}
                onMouseDown={(e) => {
                  (e.currentTarget as HTMLElement).style.transform = 'scale(0.9)';
                }}
                onMouseUp={(e) => {
                  (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
                  (e.currentTarget as HTMLElement).style.backgroundColor = 
                    activeTab === item.tab ? '#F0DB4F22' : 'transparent';
                }}
              >
                {item.icon(activeTab === item.tab)}
              </div>
            ))}
          </div>
          
           {/* 新機能：×ボタン（メニューを隠す） */}
           <div
            onClick={toggleFooter}
            style={{
              position: 'absolute',
              right: '20px',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              backgroundColor: 'transparent',
              cursor: 'pointer',
              transition: transitions.smooth,
              animationDelay: calculateStaggerDelay(3, 40)
            }}
            onTouchStart={(e) => {
              (e.currentTarget as HTMLElement).style.transform = 'scale(0.9)';
              (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(240, 219, 79, 0.1)';
            }}
            onTouchEnd={(e) => {
              (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
              (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
            }}
            onMouseDown={(e) => {
              (e.currentTarget as HTMLElement).style.transform = 'scale(0.9)';
            }}
            onMouseUp={(e) => {
              (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
              (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
            }}
          >
            {/* ×アイコン */}
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
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </div>
        </div>
      )}


      




      {/* グローバルスタイル */}
      <style>
        {`
          @keyframes fabBreath {
            0%, 100% { 
              transform: scale(${showFAB ? 1 : 0.5}) translateY(${showFAB ? 0 : 20}px); 
            }
            50% { 
              transform: scale(${showFAB ? 1.05 : 0.5}) translateY(${showFAB ? 0 : 20}px); 
            }
          }
        `}
      </style>
    </>
  );
};

export default GroupFooterNav;