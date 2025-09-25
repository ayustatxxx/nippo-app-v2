// src/components/FloatingActionButton.tsx
// このファイルは：画面右下に表示される+ボタンのコンポーネントです

import React, { useState } from 'react';

// +ボタンに渡す情報の型
interface FloatingActionButtonProps {
  visible: boolean;    // 表示するかどうか
  onClick: () => void; // タップした時に実行する関数
  animationTrigger: 'scroll-up' | 'scroll-down' | 'fab-tap' | 'initial';  // 何で表示が変わったか
}

const FloatingActionButton: React.FC<FloatingActionButtonProps> = ({
  visible,
  onClick,
  animationTrigger
}) => {
  // ボタンが押されているかどうかの状態
  const [isPressed, setIsPressed] = useState(false);

  // タッチ開始時の処理（指で触れた時）
  const handleTouchStart = () => {
    setIsPressed(true);   // 押されている状態に
  };

  // タッチ終了時の処理（指を離した時）
  const handleTouchEnd = () => {
    setIsPressed(false);  // 押されていない状態に
    onClick();            // 親コンポーネントの関数を実行
  };

  // マウスクリック時の処理（パソコンの場合）
  const handleClick = () => {
    onClick();
  };

  return (
    <div
      style={{
        // 位置とサイズの設定
        position: 'fixed',       // 画面に固定
        bottom: '20px',          // 下から20px
        right: '20px',           // 右から20px
        width: '56px',           // 幅56px
        height: '56px',          // 高さ56px
        borderRadius: '50%',     // 完全な円形
        
        // 見た目の設定
        backgroundColor: '#055A68',  // アプリのメインカラー
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        boxShadow: '0 4px 20px rgba(5, 90, 104, 0.4)',  // 影をつける
        cursor: 'pointer',       // マウスを乗せるとポインターに
        
        // 重なり順とアニメーション
        zIndex: 200,            // フッターより上に表示
        transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',  // スムーズな動き
        
        // 表示/非表示のアニメーション
        transform: `
          scale(${visible ? (isPressed ? 0.9 : 1) : 0.5}) 
          translateY(${visible ? 0 : 20}px)
        `,
        opacity: visible ? 1 : 0,                      // 透明度
        pointerEvents: visible ? 'auto' : 'none',      // タップの有効/無効
        
        // 呼吸するようなアニメーション（3秒周期）
        animation: visible ? 'fabBreath 3s ease-in-out infinite' : 'none',
      }}
      // イベントハンドラー（タッチ、マウス両対応）
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleTouchStart}
      onMouseUp={handleTouchEnd}
      onMouseLeave={() => setIsPressed(false)}  // マウスが離れたら押されていない状態に
    >
      {/* +マークのアイコン */}
      <svg 
        width="24" 
        height="24" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="white"           // 白色
        strokeWidth="2.5"        // 線の太さ
        strokeLinecap="round"    // 線の端を丸く
        strokeLinejoin="round"
        style={{
          transition: 'transform 0.2s ease',  // スムーズな回転
          // 押されている時は45度回転（+が×になる）
          transform: isPressed ? 'rotate(45deg)' : 'rotate(0deg)'
        }}
      >
        {/* 縦線 */}
        <line x1="12" y1="5" x2="12" y2="19" />
        {/* 横線 */}
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>

      {/* タップした時の波紋エフェクト */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: '100%',
          height: '100%',
          borderRadius: '50%',
          backgroundColor: 'rgba(255, 255, 255, 0.3)',  // 半透明の白
          transform: 'translate(-50%, -50%) scale(0)',   // 最初は見えない
          animation: isPressed ? 'ripple 0.6s ease-out' : 'none',  // 押された時だけ波紋
          pointerEvents: 'none'  // タップを無効にする
        }}
      />

      {/* CSSアニメーションの定義 */}
      <style>
        {`
          @keyframes fabBreath {
            0%, 100% { 
              transform: scale(${visible ? 1 : 0.5}) translateY(${visible ? 0 : 20}px); 
            }
            50% { 
              transform: scale(${visible ? 1.05 : 0.5}) translateY(${visible ? 0 : 20}px); 
            }
          }
          
          @keyframes ripple {
            to {
              transform: translate(-50%, -50%) scale(2);
              opacity: 0;
            }
          }
        `}
      </style>
    </div>
  );
};

export default FloatingActionButton;