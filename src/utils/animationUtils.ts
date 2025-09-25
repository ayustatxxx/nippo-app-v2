// src/utils/animationUtils.ts
// このファイルは：アニメーションの設定をまとめて管理します

// アニメーションのイージング（動きの滑らかさ）を定義
export const easingFunctions = {
  // iPhone風のスムーズな動き
  easeInOutCubic: 'cubic-bezier(0.645, 0.045, 0.355, 1)',
  // バウンスするような動き
  easeOutBack: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
  // 上品な動き
  easeInOutQuart: 'cubic-bezier(0.76, 0, 0.24, 1)',
  // バネのような動き
  spring: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
  // キビキビした動き
  snappy: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)'
};

// アニメーションの長さを定義
export const animationDurations = {
  fast: '0.15s',    // 早い（0.15秒）
  normal: '0.25s',  // 普通（0.25秒）
  slow: '0.35s',    // 遅い（0.35秒）
  smooth: '0.5s'    // なめらか（0.5秒）
};

// よく使うトランジション（動きの組み合わせ）を定義
export const transitions = {
  smooth: `all ${animationDurations.normal} ${easingFunctions.easeInOutCubic}`,
  spring: `all ${animationDurations.slow} ${easingFunctions.spring}`,
  quick: `all ${animationDurations.fast} ${easingFunctions.snappy}`,
  bounce: `all ${animationDurations.slow} ${easingFunctions.easeOutBack}`
};

// カスタムトランジションを作る関数
export const createTransition = (
  property: string,  // 何を動かすか（例：'opacity', 'transform'）
  duration: keyof typeof animationDurations = 'normal',  // 長さ
  easing: keyof typeof easingFunctions = 'easeInOutCubic',  // 動きの種類
  delay: string = '0s'  // 遅延時間
) => {
  return `${property} ${animationDurations[duration]} ${easingFunctions[easing]} ${delay}`;
};

// 複数の要素を順番にアニメーションさせる時の遅延時間を計算
export const calculateStaggerDelay = (index: number, baseDelay: number = 50): string => {
  return `${index * baseDelay}ms`;  // 0番目：0ms、1番目：50ms、2番目：100ms...
};

// よく使うアニメーションパターンを定義

// 拡大縮小アニメーション
export const scaleAnimation = {
  initial: { transform: 'scale(0)', opacity: 0 },      // 最初：見えない、小さい
  animate: { transform: 'scale(1)', opacity: 1 },      // 途中：見える、普通サイズ
  exit: { transform: 'scale(0.8)', opacity: 0 }        // 最後：見えない、少し小さい
};

// スライドアニメーション
export const slideAnimation = {
  up: {
    initial: { transform: 'translateY(100%)', opacity: 0 },  // 下から
    animate: { transform: 'translateY(0)', opacity: 1 },     // 中央へ
    exit: { transform: 'translateY(100%)', opacity: 0 }      // 下へ
  },
  down: {
    initial: { transform: 'translateY(-100%)', opacity: 0 }, // 上から
    animate: { transform: 'translateY(0)', opacity: 1 },     // 中央へ
    exit: { transform: 'translateY(-100%)', opacity: 0 }     // 上へ
  },
  left: {
    initial: { transform: 'translateX(-100%)', opacity: 0 }, // 左から
    animate: { transform: 'translateX(0)', opacity: 1 },     // 中央へ
    exit: { transform: 'translateX(-100%)', opacity: 0 }     // 左へ
  },
  right: {
    initial: { transform: 'translateX(100%)', opacity: 0 },  // 右から
    animate: { transform: 'translateX(0)', opacity: 1 },     // 中央へ
    exit: { transform: 'translateX(100%)', opacity: 0 }      // 右へ
  }
};

// フェードアニメーション
export const fadeAnimation = {
  initial: { opacity: 0 },    // 最初：見えない
  animate: { opacity: 1 },    // 途中：見える
  exit: { opacity: 0 }        // 最後：見えない
};