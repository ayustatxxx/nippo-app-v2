// components/MemoModal.tsx - セキュリティ強化版
import React, { useState, useEffect } from 'react';
import { FileValidator, useFileValidation } from '../utils/fileValidation';

// メモの型定義（シンプル版）
interface Memo {
  id: string;
  content: string;
  createdAt: number;
  createdBy: string;
  createdByName: string;
  postId: string;
  imageUrls?: string[];
  tags?: string[];
}

// メモ追加モーダルのプロパティ
interface MemoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (memo: Omit<Memo, 'id' | 'createdAt' | 'createdBy' | 'createdByName' | 'postId'>) => void;
  postId: string;
}

// 🔒 セキュリティ強化: メモ追加モーダルコンポーネント
const MemoModal: React.FC<MemoModalProps> = ({ isOpen, onClose, onSave, postId }) => {
  const [content, setContent] = useState('');
  const [images, setImages] = useState<FileList | null>(null);
  const [imagePreviewUrls, setImagePreviewUrls] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 🔒 セキュリティ強化: ファイル検証フック
  const { validateAndProcess, isValidating, validationErrors, clearErrors } = useFileValidation();

  // 🔒 セキュリティ強化: 画像プレビューURLの安全な生成
  useEffect(() => {
    const processImages = async () => {
      if (images && images.length > 0) {
        const result = await validateAndProcess(images);
        
        if (result.validFiles.length > 0) {
          try {
            const urls: string[] = [];
            result.validFiles.forEach(file => {
              const url = URL.createObjectURL(file);
              urls.push(url);
            });
            setImagePreviewUrls(urls);
            
            return () => {
              urls.forEach(url => URL.revokeObjectURL(url));
            };
          } catch (error) {
            console.error('プレビュー生成エラー:', error);
            FileValidator.logSecurityEvent('memo_preview_failed', { error, postId });
          }
        } else {
          setImagePreviewUrls([]);
        }
      } else {
        setImagePreviewUrls([]);
      }
    };
    
    processImages();
 }, [images, postId]); // validateAndProcessを除去

  // 🔒 セキュリティ強化: 入力値サニタイゼーション
  const sanitizeInput = (input: string): string => {
    return input
      .replace(/[<>]/g, '') // HTMLタグを除去
      .replace(/javascript:/gi, '') // JavaScriptスキームを除去
      .replace(/on\w+=/gi, '') // イベントハンドラを除去
      .trim();
  };

  // 🔒 セキュリティ強化: コンテンツ入力処理
  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const sanitized = sanitizeInput(e.target.value);
    setContent(sanitized);
  };

  // 🔒 セキュリティ強化: タグ入力処理
  const handleTagInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const sanitized = sanitizeInput(e.target.value);
  setTagInput(sanitized);
};

  // タグの処理
  const parseTags = (input: string): string[] => {
    const sanitized = sanitizeInput(input);
    return sanitized
      .split(',')
      .map(tag => tag.trim())
      .filter(tag => tag !== '')
      .filter(tag => tag.length <= 50) // 🔒 タグ長制限
      .slice(0, 10) // 🔒 最大10個まで
      .map(tag => tag.startsWith('#') ? tag : `#${tag}`);
  };

  const handleSave = async () => {
  const sanitizedContent = sanitizeInput(content);
  
  if (!sanitizedContent.trim()) {
    alert('メモの内容を入力してください');
    return;
  }

  if (validationErrors.length > 0) {
    alert('ファイルエラーを解決してから保存してください。');
    return;
  }

  setIsSubmitting(true);

  try {
    let imageUrls: string[] = [];
    if (images && images.length > 0) {
      const result = await validateAndProcess(images);
      
      if (result.errors.length > 0) {
        alert(`ファイルエラー:\n${result.errors.join('\n')}`);
        setIsSubmitting(false);
        return;
      }

      if (result.validFiles.length > 0) {
        try {
          imageUrls = await Promise.all(
            result.validFiles.map(file => FileValidator.convertToBase64(file))
          );
          
          FileValidator.logSecurityEvent('memo_images_uploaded', {
            fileCount: result.validFiles.length,
            totalSize: result.totalSize,
            postId: postId
          });
        } catch (conversionError) {
          console.error('Base64変換エラー:', conversionError);
          alert('画像の処理中にエラーが発生しました');
          setIsSubmitting(false);
          return;
        }
      }
    }

    const memoData = {
      content: sanitizedContent.substring(0, 2000),
      imageUrls,
      tags: parseTags(tagInput)
    };

    // ★ 変更点1: onSaveを呼ぶ（親コンポーネントで処理）
    await onSave(memoData);
    
    // ★ 変更点2: フォームリセット（onClose()は削除）
    setContent('');
    setImages(null);
    setImagePreviewUrls([]);
    setTagInput('');
    clearErrors();
    
    // ★ 変更点3: onClose()を削除（親コンポーネントで閉じる）
    
  } catch (error) {
    console.error('メモの保存に失敗:', error);
    FileValidator.logSecurityEvent('memo_save_failed', { error, postId });
    alert('メモの保存に失敗しました');
  } finally {
    setIsSubmitting(false);
  }
};

  const handleCancel = () => {
    setContent('');
    setImages(null);
    setImagePreviewUrls([]);
    setTagInput('');
    clearErrors();
    onClose();
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
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
        padding: '1rem',
      }}
      onClick={handleCancel}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '20px',
          width: '100%',
          maxWidth: '440px',
          maxHeight: '90vh',
          overflow: 'hidden',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div
          style={{
            padding: '1.5rem 1.5rem 1rem 1.5rem',
            borderBottom: '1px solid #f0f0f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <button
            onClick={handleCancel}
            disabled={isSubmitting || isValidating}
            style={{
              background: 'none',
              border: 'none',
              color: '#666',
              fontSize: '1rem',
              cursor: (isSubmitting || isValidating) ? 'not-allowed' : 'pointer',
              padding: '0.5rem',
              borderRadius: '8px',
              transition: 'background-color 0.2s',
              opacity: (isSubmitting || isValidating) ? 0.6 : 1
            }}
            onMouseEnter={(e) => {
              if (!isSubmitting && !isValidating) {
                e.currentTarget.style.backgroundColor = '#f5f5f5';
              }
            }}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            キャンセル
          </button>
          
          <h3
            style={{
              margin: 0,
              color: '#055A68',
              fontSize: '1.2rem',
              fontWeight: '600',
            }}
          >
            メモを追加
          </h3>
          
          <button
            onClick={handleSave}
            disabled={isSubmitting || isValidating || !content.trim() || validationErrors.length > 0}
            style={{
              backgroundColor: (content.trim() && !isValidating && validationErrors.length === 0) ? '#055A68' : '#ccc',
              color: 'white',
              border: 'none',
              borderRadius: '20px',
              padding: '0.5rem 1.2rem',
              fontSize: '0.9rem',
              fontWeight: '600',
              cursor: (content.trim() && !isValidating && validationErrors.length === 0) ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            {isSubmitting ? (
              <>
                <div style={{
                  width: '12px',
                  height: '12px',
                  border: '2px solid rgba(255, 255, 255, 0.3)',
                  borderTop: '2px solid white',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }}></div>
                保存中...
              </>
            ) : isValidating ? (
              <>
                <div style={{
                  width: '12px',
                  height: '12px',
                  border: '2px solid rgba(255, 255, 255, 0.3)',
                  borderTop: '2px solid white',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }}></div>
                検証中...
              </>
            ) : validationErrors.length > 0 ? (
              '⚠️ エラー'
            ) : (
              '保存'
            )}
          </button>
        </div>

        {/* コンテンツエリア */}
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            padding: '0 1.5rem 1.5rem 1.5rem',
          }}
        >
          {/* 🔒 セキュリティエラー表示 */}
          {validationErrors.length > 0 && (
            <div style={{
              backgroundColor: '#ffeeee',
              color: '#d32f2f',
              padding: '0.75rem',
              borderRadius: '8px',
              marginBottom: '1rem',
              border: '1px solid #ffcdd2'
            }}>
              <div style={{ fontWeight: 'bold', marginBottom: '0.25rem', fontSize: '0.9rem' }}>
                ⚠️ ファイルエラー
              </div>
              {validationErrors.map((error, index) => (
                <div key={index} style={{ fontSize: '0.8rem', marginBottom: '0.1rem' }}>
                  • {error}
                </div>
              ))}
            </div>
          )}

          {/* メモ内容入力 */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label
              style={{
                display: 'block',
                marginBottom: '0.5rem',
                color: '#055A68',
                fontSize: '0.9rem',
                fontWeight: '600',
              }}
            >
              メモ内容
            </label>
            <textarea
              value={content}
              onChange={handleContentChange} // 🔒 セキュリティ強化済み
              maxLength={2000} // 🔒 文字数制限
              placeholder="メモの内容を入力してください..."
              rows={6}
              style={{
                width: '100%',
                padding: '1rem',
                border: '2px solid #f0f0f0',
                borderRadius: '12px',
                fontSize: '1rem',
                lineHeight: '1.5',
                resize: 'vertical',
                boxSizing: 'border-box',
                fontFamily: 'inherit',
                color: '#333',
                backgroundColor: '#fafafa',
                transition: 'border-color 0.2s',
              }}
              onFocus={(e) => e.target.style.borderColor = '#055A68'}
              onBlur={(e) => e.target.style.borderColor = '#f0f0f0'}
            />
            <div style={{
              fontSize: '0.8rem',
              color: '#666',
              textAlign: 'right',
              marginTop: '0.25rem'
            }}>
              {content.length}/2000文字
            </div>
          </div>

          {/* 🔒 セキュリティ強化: 画像アップロード */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label
              style={{
                display: 'block',
                marginBottom: '0.5rem',
                color: '#055A68',
                fontSize: '0.9rem',
                fontWeight: '600',
              }}
            >
              画像（最大5枚）
            </label>
            <input
              type="file"
              multiple
              accept="image/jpeg,image/jpg,image/png,image/gif,image/webp" // 🔒 許可形式を明示
              onChange={(e) => setImages(e.target.files)}
              disabled={isValidating || isSubmitting} // 🔒 検証中・送信中は無効化
              style={{
                width: '100%',
                padding: '0.8rem',
                border: '2px dashed #E6EDED',
                borderRadius: '12px',
                backgroundColor: (isValidating || isSubmitting) ? '#f5f5f5' : '#fafafa',
                cursor: (isValidating || isSubmitting) ? 'not-allowed' : 'pointer',
                fontSize: '0.9rem',
                color: (isValidating || isSubmitting) ? '#999' : '#666',
              }}
            />
            
            {isValidating && (
              <div style={{
                marginTop: '0.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                color: '#055A68',
                fontSize: '0.9rem'
              }}>
                <div style={{
                  width: '16px',
                  height: '16px',
                  border: '2px solid rgba(5, 90, 104, 0.3)',
                  borderTop: '2px solid #055A68',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }}></div>
                ファイル検証中...
              </div>
            )}
            
            
            
            {/* 画像プレビュー */}
            {imagePreviewUrls.length > 0 && (
              <div
                style={{
                  marginTop: '1rem',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
                  gap: '0.5rem',
                }}
              >
                {imagePreviewUrls.map((url, index) => (
                  <div
                    key={index}
                    style={{
                      aspectRatio: '1',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      position: 'relative',
                      border: '2px solid #055A68'
                    }}
                  >
                    <img
                      src={url}
                      alt={`プレビュー ${index + 1}`}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                      }}
                    />
                    <div style={{
                      position: 'absolute',
                      top: '0.25rem',
                      left: '0.25rem',
                      backgroundColor: '#055A68',
                      color: 'white',
                      borderRadius: '4px',
                      padding: '0.1rem 0.3rem',
                      fontSize: '0.6rem',
                      fontWeight: 'bold'
                    }}>
                      NEW
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 🔒 セキュリティ強化: タグ入力 */}
          <div>
            <label
              style={{
                display: 'block',
                marginBottom: '0.5rem',
                color: '#055A68',
                fontSize: '0.9rem',
                fontWeight: '600',
              }}
            >
              タグ（最大10）
            </label>
            <input
              type="text"
              value={tagInput}
              onChange={handleTagInputChange} // 🔒 セキュリティ強化済み
              maxLength={200} // 🔒 入力長制限
              placeholder="タグをカンマ区切りで入力"
              style={{
                width: '100%',
                padding: '0.8rem',
                border: '2px solid #f0f0f0',
                borderRadius: '12px',
                fontSize: '0.9rem',
                boxSizing: 'border-box',
                backgroundColor: '#fafafa',
                transition: 'border-color 0.2s',
              }}
              onFocus={(e) => e.target.style.borderColor = '#055A68'}
              onBlur={(e) => e.target.style.borderColor = '#f0f0f0'}
            />
            
            {/* タグプレビュー */}
            {tagInput.trim() && (
              <div
                style={{
                  marginTop: '0.5rem',
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                }}
              >
                {parseTags(tagInput).map((tag, index) => (
                  <span
                    key={index}
                    style={{
                      backgroundColor: '#E6EDED',
                      color: '#055A68',
                      padding: '0.3rem 0.7rem',
                      borderRadius: '999px',
                      fontSize: '0.8rem',
                      fontWeight: '500',
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
            
           
          </div>
        </div>
        
        {/* 🔒 CSSアニメーション */}
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  );
};

// 🔒 セキュリティ強化: メモ表示コンポーネント
export const MemoDisplay: React.FC<{ memo: Memo }> = ({ memo }) => {
  const [modalImage, setModalImage] = useState<string | null>(null);

  // 🔒 セキュリティ強化: コンテンツのサニタイゼーション表示
  const sanitizeDisplayText = (text: string): string => {
    return text
      .replace(/[<>]/g, '') // HTMLタグを除去
      .replace(/javascript:/gi, '') // JavaScriptスキームを除去
      .trim();
  };

  return (
    <>
      <div
        style={{
          backgroundColor: '#f8f9fa',
          border: '1px solid #e9ecef',
          borderRadius: '12px',
          padding: '1rem',
          marginBottom: '0.75rem',
          position: 'relative',
        }}
      >
        {/* メモヘッダー */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: '0.75rem',
            gap: '0.5rem',
          }}
        >
          <div
            style={{
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              backgroundColor: '#055A68',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          </div>
          <div>
            <div
              style={{
                fontSize: '0.85rem',
                fontWeight: '600',
                color: '#055A68',
              }}
            >
              {sanitizeDisplayText(memo.createdByName)} {/* 🔒 サニタイズ済み表示 */}
            </div>
            <div
              style={{
                fontSize: '0.75rem',
                color: '#666',
              }}
            >
              {new Date(memo.createdAt).toLocaleString('ja-JP')}
            </div>
          </div>
        </div>

        {/* 🔒 セキュリティ強化: メモ内容 */}
        <div
          style={{
            marginBottom: (memo.imageUrls && memo.imageUrls.length > 0) || (memo.tags && memo.tags.length > 0) ? '0.75rem' : '0',
            color: '#333',
            lineHeight: '1.5',
            fontSize: '0.9rem',
            whiteSpace: 'pre-wrap',
          }}
        >
          {sanitizeDisplayText(memo.content)} {/* 🔒 サニタイズ済み表示 */}
        </div>

        {/* メモ画像 */}
        {memo.imageUrls && memo.imageUrls.length > 0 && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
              gap: '0.5rem',
              marginBottom: memo.tags && memo.tags.length > 0 ? '0.75rem' : '0',
            }}
          >
            {memo.imageUrls.map((url, index) => (
              <div
                key={index}
                style={{
                  aspectRatio: '1',
                  borderRadius: '6px',
                  overflow: 'hidden',
                  cursor: 'pointer',
                }}
                onClick={() => setModalImage(url)}
              >
                <img
                  src={url}
                  alt={`メモ画像 ${index + 1}`}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                />
              </div>
            ))}
          </div>
        )}

        {/* 🔒 セキュリティ強化: メモタグ */}
        {memo.tags && memo.tags.length > 0 && (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.4rem',
            }}
          >
            {memo.tags.map((tag, index) => (
              <span
                key={index}
                style={{
                  backgroundColor: '#E6EDED',
                  color: '#055A68',
                  padding: '0.2rem 0.6rem',
                  borderRadius: '999px',
                  fontSize: '0.75rem',
                  fontWeight: '500',
                }}
              >
                {sanitizeDisplayText(tag)} {/* 🔒 サニタイズ済み表示 */}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 画像モーダル */}
      {modalImage && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1500,
            padding: '1rem',
          }}
          onClick={() => setModalImage(null)}
        >
          <img
            src={modalImage}
            alt="拡大画像"
            style={{
              maxWidth: '100%',
              maxHeight: '90vh',
              objectFit: 'contain',
              borderRadius: '8px',
            }}
          />
          <button
            style={{
              position: 'absolute',
              top: '1rem',
              right: '1rem',
              background: 'none',
              border: 'none',
              color: '#fff',
              fontSize: '1.5rem',
              cursor: 'pointer',
            }}
            onClick={(e) => {
              e.stopPropagation();
              setModalImage(null);
            }}
          >
            ✕
          </button>
        </div>
      )}
    </>
  );
};

export default MemoModal;