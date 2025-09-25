// src/hooks/useFooterVisibility.ts
// このファイルは：スクロール方向に応じてフッターと+ボタンの表示を制御します

import { useState, useEffect } from 'react';
import { useScrollDirection } from './useScrollDirection';

// フッターの表示状態を表す型
interface FooterVisibilityState {
  showFooter: boolean;    // フッターを表示するかどうか
  showFAB: boolean;       // +ボタン（FAB）を表示するかどうか
  animationTrigger: 'scroll-up' | 'scroll-down' | 'fab-tap' | 'initial';  // どんな操作で変わったか
}

export const useFooterVisibility = (): FooterVisibilityState & {
  toggleFooter: () => void;  // +ボタンをタップした時の関数
} => {
  
  // スクロール方向を監視
  const { direction, isScrolling } = useScrollDirection(15);
  
  // フッターの表示状態を管理
  const [state, setState] = useState<FooterVisibilityState>({
    showFooter: false,              // 最初はフッターを隠す
    showFAB: true,                  // 最初は+ボタンを表示
    animationTrigger: 'initial'     // 初期状態
  });

  // スクロール方向に基づいて表示を制御
  useEffect(() => {
    // スクロールしていない時は何もしない
    if (!isScrolling) return;

    if (direction === 'down') {
      // 下スクロール：URLバーが隠れるのでフッターを表示、+ボタンは隠す
      setState({
        showFooter: true,
        showFAB: false,
        animationTrigger: 'scroll-down'
      });
    } else if (direction === 'up') {
      // 上スクロール：URLバーが表示されるのでフッターを隠す、+ボタンを表示
      setState({
        showFooter: false,
        showFAB: true,
        animationTrigger: 'scroll-up'
      });
    }
  }, [direction, isScrolling]);

  // +ボタンをタップした時の手動制御
  const toggleFooter = () => {
    setState(prev => ({
      showFooter: !prev.showFooter,                    // フッターの表示を切り替え
      showFAB: !prev.showFooter ? false : true,        // フッター表示時は+ボタンを隠す
      animationTrigger: 'fab-tap'                      // タップによる操作と記録
    }));
  };

  return { ...state, toggleFooter };
};