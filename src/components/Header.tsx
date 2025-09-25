// components/Header.tsx
import React from 'react';

interface HeaderProps {
  title: string;
  showBackButton?: boolean;
  onBackClick?: () => void;
  onSearchClick?: () => void;
  showSearchIcon?: boolean;
  isSearchActive?: boolean;
}

const Header: React.FC<HeaderProps> = ({
  title,
  showBackButton = false,
  onBackClick,
  onSearchClick,
  showSearchIcon = false,
  isSearchActive = false, // この行を追加（デフォルト値はfalse）
}) => {
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '60px',
        backgroundColor: '#055A68', // MainFooterNavと合わせた色
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '480px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 1.5rem',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {showBackButton && (
            <div
              onClick={onBackClick}
              style={{
                marginRight: '1rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#ffffff"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </div>
          )}
          <h1
            style={{
              color: '#F0DB4F',
              fontSize: '1.5rem',
              margin: 0,
              fontWeight: 'bold',
              letterSpacing: '0.05em',
            }}
          >
            {title}
          </h1>
        </div>

        {/* 右側に検索アイコンを配置 */}
        {showSearchIcon && (
          <div
            onClick={onSearchClick}
            style={{
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              backgroundColor: isSearchActive // isSearchActiveプロパティを使用
                ? 'rgba(240, 219, 79, 0.2)' // アクティブ時は薄い黄色
                : 'rgba(255, 255, 255, 0.1)', // 通常時は薄い白色
              transition: 'background-color 0.3s',
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke={isSearchActive ? '#F0DB4F' : '#ffffff'} // isSearchActiveプロパティを使用
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
        )}
      </div>
    </div>
  );
};

export default Header;
