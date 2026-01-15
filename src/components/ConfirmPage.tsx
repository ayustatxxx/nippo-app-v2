import React, { useState } from "react";

interface ConfirmationProps {
  message: string;
  photos: FileList | null;
  photoPreviewUrls: string[];
  tags: string[]; // タグ配列を追加
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmationPage: React.FC<ConfirmationProps> = ({
  message,
  photos,
  photoPreviewUrls,
  tags,
  onConfirm,
  onCancel
}) => {
  // 拡大表示する画像のURL状態を追加
  const [modalImage, setModalImage] = useState<string | null>(null);
  
  return (
    <div style={{ width: "100%", maxWidth: "480px", padding: "24px 0", margin: "0 auto" }}>
      <h2 style={{ fontSize: "1.8rem", marginBottom: "1.5rem", color: "#F0DB4F", textAlign: "center" }}>投稿確認</h2>
      
      {/* プレビューコンテンツ - 背景を透明に変更 */}
      <div style={{ 
        color: "#fff", 
        padding: "1rem", 
        borderRadius: "12px", 
        marginBottom: "1rem", 
        fontSize: "1.05rem", 
        boxSizing: "border-box"
      }}>
        {message && message.trim().length > 0 && (
          <div style={{ marginBottom: "0.5rem", whiteSpace: "pre-wrap" }}>{message}</div>
        )}
        
        {/* タグ表示を追加 */}
        {tags && tags.length > 0 && (
          <div style={{ 
            display: "flex", 
            flexWrap: "wrap", 
            gap: "0.5rem", 
            marginTop: "1rem", 
            marginBottom: "1rem" 
          }}>
            {tags.map((tag, index) => (
              <span 
                key={index} 
                style={{ 
                  backgroundColor: "#F0DB4F22", 
                  color: "#F0DB4F", 
                  padding: "0.3rem 0.7rem", 
                  borderRadius: "999px", 
                  fontSize: "0.85rem",
                  display: "inline-block"
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}
        
        {photoPreviewUrls && photoPreviewUrls.length > 0 && (
          <div style={{ 
            display: "flex", 
            flexWrap: "wrap", 
            gap: "0.75rem", 
            marginTop: message && message.trim().length > 0 ? "2rem" : "0.5rem" 
          }}>
            {photoPreviewUrls.map((url, i) => (
              <img 
                key={i} 
                src={url} 
                alt={`preview-${i}`} 
                style={{ 
                  width: "calc((100% - (0.75rem * 3)) / 4)", 
                  aspectRatio: "1 / 1", 
                  objectFit: "cover", 
                  borderRadius: "8px",
                  cursor: "pointer" // ポインターカーソルを追加
                }} 
                onClick={() => setModalImage(url)} // クリックイベントを追加
              />
            ))}
          </div>
        )}
      </div>
      
      {/* テキスト幅に合わせたボタン配置 (横並び) */}
      <div style={{ 
        display: "flex", 
        flexDirection: "row",
        justifyContent: "space-between",
        gap: "0.5rem", 
        marginTop: "1.5rem",
        padding: "0 1rem", 
        boxSizing: "border-box",
        width: "100%", 
        maxWidth: "100%" 
      }}>
        <button
          onClick={onCancel}
          style={{
  flex: "1 1 0",
  padding: "0.75rem 0",
  backgroundColor: "transparent",
  color: "#fff",
  border: "2px solid #ffffff66",
  borderRadius: "12px",
  fontSize: "0.95rem",
  cursor: "pointer",
  transition: "0.3s",
  minWidth: "0"
}}
        
        >
          編集に戻る
        </button>

        <button
          onClick={onConfirm}
          style={{ 
            flex: "1 1 0",
            padding: "0.75rem 0", 
            backgroundColor: "#F0DB4F", 
            color: "#000", 
            border: "none", 
            borderRadius: "12px", 
            fontSize: "1rem", 
            fontWeight: "bold", 
            cursor: "pointer", 
            transition: "0.3s",
            minWidth: "0" 
          }}
          onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "#ffe95d")}
          onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "#F0DB4F")}
        >
          投稿する
        </button>
      </div>

      {/* 画像モーダル（アーカイブページと同様の実装） */}
      {modalImage && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.9)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000,
            padding: "1rem",
          }}
          onClick={() => setModalImage(null)} // 背景をクリックで閉じる
        >
          <img
            src={modalImage}
            alt="拡大画像"
            style={{
              maxWidth: "100%",
              maxHeight: "90vh",
              objectFit: "contain",
              borderRadius: "8px",
            }}
          />
          <button
            style={{
              position: "absolute",
              top: "1rem",
              right: "1rem",
              background: "none",
              border: "none",
              color: "#fff",
              fontSize: "1.5rem",
              cursor: "pointer",
            }}
            onClick={(e) => {
              e.stopPropagation(); // イベントの伝播を止める
              setModalImage(null);
            }}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
};

export default ConfirmationPage;