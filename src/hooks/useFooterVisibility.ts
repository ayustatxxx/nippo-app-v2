import { useState, useEffect } from 'react';
import { useScrollDirection } from './useScrollDirection';

// フッターの表示状態を表す型
interface FooterVisibilityState {
  showFooter: boolean;    // フッターを表示するかどうか
  showFAB: boolean;       // +ボタン（FAB）を表示するかどうか
  animationTrigger: 'scroll-up' | 'scroll-down' | 'fab-tap' | 'initial';  // どんな操作で変わったか
}

// localStorage のキー
const FOOTER_STATE_KEY = 'footer-visibility-state';

export const useFooterVisibility = (): FooterVisibilityState & {
  toggleFooter: () => void;  // +ボタンをタップした時の関数
} => {
  
  // スクロール方向を監視
  const { direction, isScrolling } = useScrollDirection(15);
  
  // localStorageから前回の状態を復元
  const getSavedState = (): FooterVisibilityState => {
    try {
      const saved = localStorage.getItem(FOOTER_STATE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        console.log('📥 フッター状態を復元:', parsed);
        return parsed;
      }
    } catch (error) {
      console.error('フッター状態の復元に失敗:', error);
    }
    // デフォルト値
    return {
      showFooter: false,
      showFAB: true,
      animationTrigger: 'initial'
    };
  };
  
  // フッターの表示状態を管理（localStorageから復元）
  const [state, setState] = useState<FooterVisibilityState>(getSavedState);

  // 状態が変更されたらlocalStorageに保存
  useEffect(() => {
    try {
      localStorage.setItem(FOOTER_STATE_KEY, JSON.stringify(state));
    } catch (error) {
      console.error('フッター状態の保存に失敗:', error);
    }
  }, [state]);

  // 🆕 storageイベントを監視（他のコンポーネントからの変更を検知）
  useEffect(() => {
    const handleStorageChange = (e: Event) => {
      const newState = getSavedState();
      console.log('📨 storage イベント検知:', newState);
      setState(newState);
    };

    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // スクロール方向に基づいて表示を制御
  useEffect(() => {
    // スクロールしていない時は何もしない
    if (!isScrolling) return;

    if (direction === 'up') {
      // 上スクロール：コンテンツを見返す時にフッターを表示、+ボタンは隠す
      setState({
        showFooter: true,
        showFAB: false,
        animationTrigger: 'scroll-up'
      });
    } else if (direction === 'down') {
      // 下スクロール：新しいコンテンツを見る時にフッターを隠す、+ボタンを表示
      setState({
        showFooter: false,
        showFAB: true,
        animationTrigger: 'scroll-down'
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