import React, { useState, useEffect, useRef } from 'react';

interface ImageGalleryModalProps {
  images: string[];
  initialIndex: number;
  isOpen: boolean;
  onClose: () => void;
}

const ImageGalleryModal: React.FC<ImageGalleryModalProps> = ({
  images,
  initialIndex,
  isOpen,
  onClose
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isZoomed, setIsZoomed] = useState(false);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // モーダルが開かれたときに初期インデックスを設定
  useEffect(() => {
  console.log('🔍 [ImageGallery] useEffect実行:', {
    isOpen,
    initialIndex,
    imagesLength: images.length,
    firstImage: images[0]?.substring(0, 50) + '...',
    // ★ この行を追加 ★
    allImagesPreview: images.map((img, i) => `${i}: ${img.substring(0, 30)}...`)
  });
  
  if (isOpen) {
    console.log('✅ [ImageGallery] モーダル初期化:', {
      settingIndex: initialIndex,
      currentImages: images.length,
      // ★ この行を追加 ★
      receivedImages: images.map(img => img.substring(0, 50) + '...')
    });
    setCurrentIndex(initialIndex);
    // ... 以下略
  }
}, [isOpen, images, initialIndex]);  // ← 依存配列を追加


  // キーボードナビゲーション
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowLeft':
          handlePrevious();
          break;
        case 'ArrowRight':
          handleNext();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentIndex]);

  const handlePrevious = () => {
    if (images.length <= 1) return;
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
    resetZoom();
  };

  const handleNext = () => {
    if (images.length <= 1) return;
    setCurrentIndex((prev) => (prev + 1) % images.length);
    resetZoom();
  };

  const resetZoom = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
    setIsZoomed(false);
  };

  const handleDoubleClick = () => {
    if (isZoomed) {
      resetZoom();
    } else {
      setScale(2);
      setIsZoomed(true);
    }
  };

  // タッチ・マウスイベント処理
  const handleTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isZoomed) return;
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    setIsDragging(true);
    setDragStart({ x: clientX - position.x, y: clientY - position.y });
  };

  const handleTouchMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isDragging || !isZoomed) return;
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    setPosition({
      x: clientX - dragStart.x,
      y: clientY - dragStart.y
    });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  // スワイプ処理
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null);

  const handleSwipeStart = (e: React.TouchEvent) => {
    if (isZoomed) return;
    setTouchEnd(null);
    setTouchStart({
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY
    });
  };

  const handleSwipeMove = (e: React.TouchEvent) => {
    if (isZoomed) return;
    setTouchEnd({
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY
    });
  };

  const handleSwipeEnd = () => {
    if (!touchStart || !touchEnd || isZoomed) return;
    
    const distanceX = touchStart.x - touchEnd.x;
    const distanceY = touchStart.y - touchEnd.y;
    const isLeftSwipe = distanceX > 50;
    const isRightSwipe = distanceX < -50;
    const isVerticalSwipe = Math.abs(distanceY) > Math.abs(distanceX);

    if (isVerticalSwipe) return; // 縦スワイプは無視

    if (isLeftSwipe && images.length > 1) {
      handleNext();
    }
    if (isRightSwipe && images.length > 1) {
      handlePrevious();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.95)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 2000,
        padding: '1rem',
        userSelect: 'none',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* ヘッダー */}
<div
  style={{
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'center',
    padding: '1rem',
    background: 'linear-gradient(to bottom, rgba(0,0,0,0.7), transparent)',
    zIndex: 10,
  }}
>
<button
  onClick={onClose}
  style={{
    background: 'none',
    border: 'none',
    color: 'white',
    fontSize: '2rem',
    cursor: 'pointer',
    padding: '0.5rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    outline: 'none',
    WebkitTapHighlightColor: 'transparent',
    WebkitAppearance: 'none',
    MozAppearance: 'none',
    appearance: 'none',
    transition: 'opacity 0.3s',
  }}
  onFocus={(e) => e.currentTarget.style.outline = 'none'}
  onMouseEnter={(e) => e.currentTarget.style.opacity = '0.7'}
  onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
>
  ✕
</button>
</div>

      {/* メイン画像エリア */}
      <div
        ref={containerRef}
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          overflow: 'hidden',
          position: 'relative',
        }}
        onTouchStart={handleSwipeStart}
        onTouchMove={handleSwipeMove}
        onTouchEnd={handleSwipeEnd}
      >
       {/* 前へボタン */}
{images.length > 1 && (
  <button
    onClick={handlePrevious}
    style={{
      position: 'absolute',
      left: '120px',
      top: '0.1rem',
      transform: 'none',
      background: 'rgba(0, 0, 0, 0.5)',
      border: 'none',
      color: 'white',
      fontSize: '1.5rem',
      cursor: 'pointer',
      borderRadius: '50%',
      width: '60px',
      height: '60px',
      minWidth: '60px',
      minHeight: '60px',
      maxWidth: '60px',
      maxHeight: '60px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10,
      transition: 'opacity 0.3s',
      outline: 'none',
      WebkitTapHighlightColor: 'transparent',
      flexShrink: 0,
    }}
    onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
    onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
    onFocus={(e) => e.currentTarget.style.outline = 'none'}
  >
    ◀
  </button>
        )}

        {/* 画像番号表示 - 中央 */}
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '0.7rem',
            transform: 'translateX(-50%)',
            color: 'white',
            fontSize: '1.1rem',
            fontWeight: 'bold',
            zIndex: 10,
            background: 'rgba(0, 0, 0, 0.3)',
            padding: '0.5rem 1rem',
            borderRadius: '20px',
            userSelect: 'none',
          }}
        >
          {currentIndex + 1} / {images.length}
        </div>

        {/* 画像 */}
        <img
          ref={imageRef}
          src={images[currentIndex]}
          alt={`画像 ${currentIndex + 1}`}
          style={{
            maxWidth: isZoomed ? 'none' : '100%',
            maxHeight: isZoomed ? 'none' : '80vh',
            objectFit: 'contain',
            cursor: isZoomed ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in',
            transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
            transition: isDragging ? 'none' : 'transform 0.3s ease',
          }}
          onDoubleClick={handleDoubleClick}
          onMouseDown={handleTouchStart}
          onMouseMove={handleTouchMove}
          onMouseUp={handleTouchEnd}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          draggable={false}
        />

       {/* 次へボタン */}
{images.length > 1 && (
  <button
    onClick={handleNext}
    style={{
      position: 'absolute',
      right: '120px',
      top: '0.1rem',
      transform: 'none',
      background: 'rgba(0, 0, 0, 0.5)',
      border: 'none',
      color: 'white',
      fontSize: '1.5rem',
      cursor: 'pointer',
      borderRadius: '50%',
      width: '60px',
      height: '60px',
      minWidth: '60px',
      minHeight: '60px',
      maxWidth: '60px',
      maxHeight: '60px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10,
      transition: 'opacity 0.3s',
      outline: 'none',
      WebkitTapHighlightColor: 'transparent',
      flexShrink: 0,
    }}
    onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
    onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
    onFocus={(e) => e.currentTarget.style.outline = 'none'}
  >
    ▶
  </button>
        )}
      </div>

      {/* フッター - 操作ヒント */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '2.5rem',
          background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)',
          textAlign: 'center',
          color: 'rgba(255, 255, 255, 0.8)',
          fontSize: '0.9rem',
        }}
      >
        {images.length > 1 && '◀︎ ▶︎ で切り替え • '}
        ダブルタップでズーム
        {isZoomed && ' • ドラッグで移動'}
      </div>
    </div>
  );
};

export default ImageGalleryModal;