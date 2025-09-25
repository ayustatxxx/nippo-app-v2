// src/hooks/useScrollDirection.ts
// このファイルは：画面をスクロールした方向（上/下）を検知します

import { useState, useEffect, useCallback } from 'react';

// スクロールの方向を表す型
type ScrollDirection = 'up' | 'down' | 'idle';  // 上、下、止まっている

// スクロールの状態を表す型
interface ScrollState {
  direction: ScrollDirection;  // スクロール方向
  isScrolling: boolean;        // 今スクロール中かどうか
  scrollY: number;            // 現在のスクロール位置
  deltaY: number;             // 前回からどのくらい動いたか
}

export const useScrollDirection = (threshold: number = 10): ScrollState => {
  // スクロールの状態を管理
  const [scrollState, setScrollState] = useState<ScrollState>({
    direction: 'idle',    // 最初は止まっている
    isScrolling: false,   // 最初はスクロールしていない
    scrollY: 0,          // 最初は一番上
    deltaY: 0            // 最初は動いていない
  });

  // 前回のスクロール位置を覚えておく
  const [lastScrollY, setLastScrollY] = useState(0);
  
  // スクロール終了を検知するためのタイマー
  const [scrollTimeout, setScrollTimeout] = useState<NodeJS.Timeout | null>(null);

  // スクロールが発生した時の処理
  const handleScroll = useCallback(() => {
    const currentScrollY = window.scrollY;  // 現在のスクロール位置
    const deltaY = currentScrollY - lastScrollY;  // 前回からの変化量

    // スクロール方向を判定（小さな動きは無視）
    let direction: ScrollDirection = 'idle';
    if (Math.abs(deltaY) > threshold) {  // しきい値(10px)以上動いた場合のみ
      direction = deltaY > 0 ? 'down' : 'up';  // プラスなら下、マイナスなら上
    }

    // 状態を更新
    setScrollState({
      direction,
      isScrolling: true,
      scrollY: currentScrollY,
      deltaY
    });

    // 前回の位置を更新
    setLastScrollY(currentScrollY);

    // 既存のタイマーがあればキャンセル
    if (scrollTimeout) {
      clearTimeout(scrollTimeout);
    }

    // 150ms後にスクロール終了とみなす
    const newTimeout = setTimeout(() => {
      setScrollState(prev => ({
        ...prev,
        direction: 'idle',     // 方向をリセット
        isScrolling: false     // スクロール終了
      }));
    }, 150);

    setScrollTimeout(newTimeout);
  }, [lastScrollY, threshold, scrollTimeout]);

  // ページが読み込まれた時にスクロール監視を開始
  useEffect(() => {
    // スクロールイベントを監視（{ passive: true }で性能向上）
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    // ページから離れる時にクリーンアップ
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }
    };
  }, [handleScroll, scrollTimeout]);

  return scrollState;
};