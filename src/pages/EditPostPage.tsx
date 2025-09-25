// EditPostPage.tsx - セキュリティ強化版
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import Header from '../components/Header';
import MainFooterNav from '../components/MainFooterNav';
import { DBUtil, STORES } from "../utils/dbUtil";
import { Post } from '../types';
import { FileValidator, useFileValidation } from '../utils/fileValidation'; // 新しく追加

const EditPostPage: React.FC = () => {
  const { postId } = useParams<{ postId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  
  // 編集用の状態
  const [editedMessage, setEditedMessage] = useState('');
  const [editedTags, setEditedTags] = useState<string[]>([]);
  const [editedPhotos, setEditedPhotos] = useState<FileList | null>(null);
  const [newPhotoUrls, setNewPhotoUrls] = useState<string[]>([]);
  const [deletedPhotoUrls, setDeletedPhotoUrls] = useState<string[]>([]);
  
  // UI状態
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [isEdited, setIsEdited] = useState(false);
  
  // 🔒 セキュリティ強化: ファイル検証フック
  const { validateAndProcess, isValidating, validationErrors, clearErrors } = useFileValidation();
  
  // 投稿データの取得
  useEffect(() => {
    const fetchPost = async () => {
      if (!postId) {
        setError('投稿IDが見つかりません');
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        const dbUtil = DBUtil.getInstance();
        await dbUtil.initDB();
        
        const postData = await dbUtil.get<Post>(STORES.POSTS, postId);
        
        if (postData) {
          try {
            const group = await dbUtil.get(STORES.GROUPS, postData.groupId) as any;
            if (group) {
              postData.groupName = group.name;
            }
          } catch (groupError) {
            console.error('グループ情報の取得に失敗:', groupError);
          }
          
          setPost(postData);
          setEditedMessage(postData.message || '');
          setEditedTags(postData.tags || []);
        } else {
          // 投稿が見つからない場合
          setError('指定された投稿が見つかりません');
        }
        } catch (error) {
          console.error('投稿詳細の取得に失敗:', error);
          setError('投稿の読み込みに失敗しました');
        } finally {
          setLoading(false);
        }
    };
    
    fetchPost();
  }, [postId]);
  
  // 🔒 セキュリティ強化: 新しい写真が選択された時の安全な処理
  // 修正版（最も推奨）
useEffect(() => {
  let isMounted = true;
  
  const processPhotos = async () => {
    if (!editedPhotos || editedPhotos.length === 0) {
      if (isMounted) {
        setNewPhotoUrls([]);
      }
      return;
    }
    
    try {
      clearErrors();
      const result = await validateAndProcess(editedPhotos);
      
      if (!isMounted) return; // コンポーネントがアンマウントされていたら中断
      
      if (result.validFiles.length > 0) {
        const urls: string[] = [];
        for (const file of result.validFiles) {
          const url = URL.createObjectURL(file);
          urls.push(url);
        }
        
        setNewPhotoUrls(urls);
        setHasChanges(true);
      } else {
        setNewPhotoUrls([]);
      }
    } catch (error) {
      console.error('プレビュー生成エラー:', error);
      if (isMounted) {
        setNewPhotoUrls([]);
      }
    }
  };
  
  processPhotos();
  
  return () => {
    isMounted = false;
  };
}, [editedPhotos]); // editedPhotosのみに依存
  
  // 変更検知
  useEffect(() => {
    if (!post) return;
    
    const messageChanged = editedMessage !== (post.message || '');
    const tagsChanged = JSON.stringify(editedTags) !== JSON.stringify(post.tags || []);
    const photosChanged = newPhotoUrls.length > 0 || deletedPhotoUrls.length > 0;
    
    setHasChanges(messageChanged || tagsChanged || photosChanged);
  }, [editedMessage, editedTags, newPhotoUrls, deletedPhotoUrls, post]);
  
  // 🔒 セキュリティ強化: 入力値サニタイゼーション
  const sanitizeInput = (input: string): string => {
    return input
      .replace(/[<>]/g, '') // HTMLタグを除去
      .replace(/javascript:/gi, '') // JavaScriptスキームを除去
      .replace(/on\\w+=/gi, '') // イベントハンドラを除去
      .trim();
  };
  
  // 🔒 セキュリティ強化: メッセージ入力処理
  const handleMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const sanitized = sanitizeInput(e.target.value);
    setEditedMessage(sanitized);
  };
  
  // 写真削除
  const handleDeletePhoto = (photoUrl: string) => {
    setDeletedPhotoUrls(prev => [...prev, photoUrl]);
    setHasChanges(true);
  };
  
  // 写真削除の取り消し
  const handleUndoDeletePhoto = (photoUrl: string) => {
    setDeletedPhotoUrls(prev => prev.filter(url => url !== photoUrl));
  };
  
  // 🔒 セキュリティ強化: タグ追加（サニタイゼーション付き）
  const handleAddTag = (tagText: string) => {
    const sanitized = sanitizeInput(tagText);
    const tag = sanitized.startsWith('#') ? sanitized : `#${sanitized}`;
    if (tag.length > 1 && tag.length <= 50 && !editedTags.includes(tag)) {
      setEditedTags(prev => [...prev, tag]);
    }
  };

  // 複数タグ追加処理（カンマ区切り対応）
  const handleAddMultipleTags = (input: string) => {
    const sanitized = sanitizeInput(input);
    const tags = sanitized.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
    
    tags.forEach(tagText => {
      const tag = tagText.startsWith('#') ? tagText : `#${tagText}`;
      if (tag.length > 1 && tag.length <= 50 && !editedTags.includes(tag)) {
        setEditedTags(prev => [...prev, tag]);
      }
    });
  };
  
  // タグ削除
  const handleRemoveTag = (tagToRemove: string) => {
    setEditedTags(prev => prev.filter(tag => tag !== tagToRemove));
  };

  // 🔒 セキュリティ強化: 安全な保存処理
  const handleSave = async () => {
    if (!post) return;
    
    try {
      setSaving(true);
      clearErrors();
      
      // 新しい写真をBase64に変換（安全な処理）
      let additionalPhotoUrls: string[] = [];
      if (editedPhotos && editedPhotos.length > 0) {
        const result = await validateAndProcess(editedPhotos);
        
        if (result.errors.length > 0) {
          alert(`ファイルエラー:\\n${result.errors.join('\\n')}`);
          return;
        }
        
        if (result.validFiles.length > 0) {
          try {
            additionalPhotoUrls = await Promise.all(
              result.validFiles.map(file => FileValidator.convertToBase64(file))
            );
            
            // セキュリティログ
            FileValidator.logSecurityEvent('files_uploaded', {
              fileCount: result.validFiles.length,
              totalSize: result.totalSize,
              postId: post.id
            });
          } catch (conversionError) {
            console.error('Base64変換エラー:', conversionError);
            alert('画像の処理中にエラーが発生しました');
            return;
          }
        }
      }
      
      // 既存の写真から削除されたものを除外
      const remainingPhotos = post.photoUrls.filter(url => !deletedPhotoUrls.includes(url));
      
      // 🔒 セキュリティ強化: 入力値の最終検証
      const sanitizedMessage = sanitizeInput(editedMessage).substring(0, 5000); // 最大5000文字
      const validTags = editedTags.filter(tag => tag.length <= 50); // タグ長制限
      
      // 更新された投稿データ
      const updatedPost: Post = {
        ...post,
        message: sanitizedMessage,
        tags: validTags,
        photoUrls: [...remainingPhotos, ...additionalPhotoUrls],
        updatedAt: Date.now(),
        isEdited: true
      };
      
      // データベースに保存
      const dbUtil = DBUtil.getInstance();
      await dbUtil.initDB();
      await dbUtil.save(STORES.POSTS, updatedPost);
      
      alert('✅ 投稿を更新しました！');
      
      // 元のページに戻る
      const from = searchParams.get('from');
      const groupId = searchParams.get('groupId');
      
      if (from === 'archive' && groupId) {
        navigate(`/group/${groupId}/archive`);
      } else {
        const params = new URLSearchParams();
        if (from) params.set('from', from);
        if (groupId) params.set('groupId', groupId);
        const paramString = params.toString() ? `?${params.toString()}` : '';
        
        navigate(`/post/${postId}${paramString}`);
      }

    } catch (error) {
      console.error('投稿の更新に失敗:', error);
      FileValidator.logSecurityEvent('save_failed', { error, postId: post.id });
      alert('投稿の更新に失敗しました');
    } finally {
      setSaving(false);
    }
  };
  
  // 削除処理
  const handleDelete = async () => {
    if (!post) return;
    
    try {
      const dbUtil = DBUtil.getInstance();
      await dbUtil.initDB();
      await dbUtil.delete(STORES.POSTS, post.id);
      
      alert('✅ 投稿を削除しました');
      
      const from = searchParams.get('from');
      const groupId = searchParams.get('groupId');
      
      if (from === 'archive' && groupId) {
        navigate(`/group/${groupId}/archive`);
      } else {
        navigate('/');
      }
      
    } catch (error) {
      console.error('投稿の削除に失敗:', error);
      alert('投稿の削除に失敗しました');
    }
  };
  
  // 戻るボタンの処理
  const handleBack = () => {
    if (hasChanges) {
      if (window.confirm('変更が保存されていません。本当に戻りますか？')) {
        const from = searchParams.get('from');
        const groupId = searchParams.get('groupId');
        
        const params = new URLSearchParams();
        if (from) params.set('from', from);
        if (groupId) params.set('groupId', groupId);
        const paramString = params.toString() ? `?${params.toString()}` : '';
        
        navigate(`/post/${postId}${paramString}`, { replace: true });
      }
    } else {
      const from = searchParams.get('from');
      const groupId = searchParams.get('groupId');
      
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (groupId) params.set('groupId', groupId);
      const paramString = params.toString() ? `?${params.toString()}` : '';
      
      navigate(`/post/${postId}${paramString}`, { replace: true });
    }
  };
  
  if (loading) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        backgroundColor: '#f5f5f5',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '3px solid rgba(5, 90, 104, 0.1)',
          borderTopColor: '#055A68',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }}></div>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }
  
  if (error || !post) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
        <Header 
          title="エラー" 
          showBackButton={true}
          onBackClick={() => navigate(-1)}
        />
        <div style={{
          maxWidth: '480px',
          margin: '0 auto',
          padding: '1rem',
          paddingTop: '80px'
        }}>
          <div style={{
            backgroundColor: '#ffeeee',
            color: '#d32f2f',
            padding: '1rem',
            borderRadius: '8px',
            textAlign: 'center'
          }}>
            {error || '投稿が見つかりません'}
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: '#f5f5f5',
      paddingBottom: '80px'
    }}>
      <Header 
        title="投稿を編集" 
        showBackButton={false}
      />
      
      <div style={{ 
        maxWidth: '480px', 
        margin: '0 auto',
        padding: '1rem',
        paddingTop: '70px'
      }}>
        {/* 🔒 セキュリティエラー表示 */}
        {validationErrors.length > 0 && (
          <div style={{
            backgroundColor: '#ffeeee',
            color: '#d32f2f',
            padding: '1rem',
            borderRadius: '8px',
            marginBottom: '1rem',
            border: '1px solid #ffcdd2'
          }}>
            <div style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>
              ⚠️ ファイルセキュリティエラー
            </div>
            {validationErrors.map((error, index) => (
              <div key={index} style={{ fontSize: '0.9rem', marginBottom: '0.25rem' }}>
                • {error}
              </div>
            ))}
            <button
              onClick={clearErrors}
              style={{
                marginTop: '0.5rem',
                padding: '0.3rem 0.6rem',
                backgroundColor: '#d32f2f',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '0.8rem',
                cursor: 'pointer'
              }}
            >
              エラーを閉じる
            </button>
          </div>
        )}

        {/* 投稿者情報 */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '1rem',
          marginBottom: '1rem',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: '0.5rem'
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              backgroundColor: 'rgba(5, 90, 104, 0.1)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              marginRight: '0.75rem'
            }}>
              <svg 
                width="24" 
                height="24" 
                viewBox="0 0 24 24" 
                fill="#055A68" 
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M12 12C14.21 12 16 10.21 16 8C16 5.79 14.21 4 12 4C9.79 4 8 5.79 8 8C8 10.21 9.79 12 12 12ZM12 14C9.33 14 4 15.34 4 18V20H20V18C20 15.34 14.67 14 12 14Z" />
              </svg>
            </div>
            <div>
              <div style={{ 
                fontWeight: 'bold', 
                color: '#055A68', 
                fontSize: '1rem'
              }}>
                {post.username || 'ユーザー'}
              </div>
              <div style={{ 
                color: '#666', 
                fontSize: '0.8rem' 
              }}>
                {post.groupName} • {post.time}
              </div>
            </div>
          </div>
        </div>
        
        {/* メッセージ編集 */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '1.5rem',
          marginBottom: '1rem',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
        }}>
          <label style={{
            display: 'block',
            marginBottom: '0.5rem',
            color: '#055A68',
            fontSize: '0.9rem',
            fontWeight: '600'
          }}>
            メッセージ
          </label>
          <textarea
            value={editedMessage}
            onChange={handleMessageChange} // 🔒 セキュリティ強化済み
            placeholder="投稿内容を入力..."
            rows={6}
            maxLength={5000} // 🔒 最大文字数制限
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '2px solid #E6EDED',
              borderRadius: '8px',
              fontSize: '1rem',
              lineHeight: '1.5',
              resize: 'vertical',
              boxSizing: 'border-box',
              fontFamily: 'inherit',
              color: '#333',
              backgroundColor: '#fafafa'
            }}
            onFocus={(e) => e.target.style.borderColor = '#055A68'}
            onBlur={(e) => e.target.style.borderColor = '#E6EDED'}
          />
          <div style={{
            fontSize: '0.8rem',
            color: '#666',
            textAlign: 'right',
            marginTop: '0.25rem'
          }}>
            {editedMessage.length}/5000文字
          </div>
        </div>
        
        {/* タグ編集 */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '1.5rem',
          marginBottom: '1rem',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
        }}>
          <label style={{
            display: 'block',
            marginBottom: '0.5rem',
            color: '#055A68',
            fontSize: '0.9rem',
            fontWeight: '600'
          }}>
            タグ (最大10個)
          </label>
          
          {/* 既存タグ表示 */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.5rem',
            marginBottom: '1rem'
          }}>
            {editedTags.map((tag, index) => (
              <div
                key={index}
                style={{
                  backgroundColor: '#E6EDED',
                  color: '#055A68',
                  padding: '0.4rem 0.8rem',
                  borderRadius: '20px',
                  fontSize: '0.85rem',
                  fontWeight: '500',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                {tag}
                <button
                  onClick={() => handleRemoveTag(tag)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#055A68',
                    cursor: 'pointer',
                    fontSize: '1.2rem',
                    lineHeight: '1',
                    padding: '0'
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          
          {/* タグ追加入力 */}
          <input
            type="text"
            placeholder="新しいタグを追加（Enterまたはカンマ区切りで追加）"
            maxLength={200} // 🔒 入力長制限
            disabled={editedTags.length >= 10} // 🔒 タグ数制限
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '2px solid #E6EDED',
              borderRadius: '8px',
              fontSize: '0.9rem',
              boxSizing: 'border-box',
              backgroundColor: editedTags.length >= 10 ? '#f5f5f5' : '#fafafa',
              color: editedTags.length >= 10 ? '#999' : '#333'
            }}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && editedTags.length < 10) {
                const input = e.target as HTMLInputElement;
                if (input.value.trim()) {
                  handleAddMultipleTags(input.value.trim());
                  input.value = '';
                }
              }
            }}
            onBlur={(e) => {
              if (editedTags.length < 10) {
                const input = e.target as HTMLInputElement;
                if (input.value.trim()) {
                  handleAddMultipleTags(input.value.trim());
                  input.value = '';
                }
              }
              e.target.style.borderColor = '#E6EDED';
            }}
            onFocus={(e) => e.target.style.borderColor = '#055A68'}
          />
          {editedTags.length >= 10 && (
            <div style={{
              fontSize: '0.8rem',
              color: '#ff6b6b',
              marginTop: '0.25rem'
            }}>
              タグの上限に達しました（10個）
            </div>
          )}
        </div>
        
        {/* 既存写真表示・削除 */}
        {post.photoUrls && post.photoUrls.length > 0 && (
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '1.5rem',
            marginBottom: '1rem',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
          }}>
            <label style={{
              display: 'block',
              marginBottom: '1rem',
              color: '#055A68',
              fontSize: '0.9rem',
              fontWeight: '600'
            }}>
              現在の写真 ({post.photoUrls.length}枚)
            </label>
            
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
              gap: '0.75rem'
            }}>
              {post.photoUrls.map((url, index) => (
                <div
                  key={index}
                  style={{
                    position: 'relative',
                    aspectRatio: '1',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    opacity: deletedPhotoUrls.includes(url) ? 0.3 : 1,
                    transition: 'opacity 0.3s ease'
                  }}
                >
                  <img
                    src={url}
                    alt={`写真 ${index + 1}`}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover'
                    }}
                  />
                  
                  {deletedPhotoUrls.includes(url) ? (
                    <button
                      onClick={() => handleUndoDeletePhoto(url)}
                      style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        backgroundColor: '#055A68',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '0.3rem 0.6rem',
                        fontSize: '0.7rem',
                        cursor: 'pointer'
                      }}
                    >
                      復元
                    </button>
                  ) : (
                    <button
                      onClick={() => handleDeletePhoto(url)}
                      style={{
                        position: 'absolute',
                        top: '0.5rem',
                        right: '0.5rem',
                        backgroundColor: 'rgba(0, 0, 0, 0.7)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '50%',
                        width: '24px',
                        height: '24px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.8rem'
                      }}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* 🔒 セキュリティ強化: 新しい写真追加 */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '1.5rem',
          marginBottom: '1rem',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
        }}>
          <label style={{
            display: 'block',
            marginBottom: '1rem',
            color: '#055A68',
            fontSize: '0.9rem',
            fontWeight: '600'
          }}>
            新しい写真を追加 (最大10枚、各5MB以下)
          </label>
          
          <input
            type="file"
            multiple
            accept="image/jpeg,image/jpg,image/png,image/gif,image/webp" // 🔒 許可形式を明示
            onChange={(e) => setEditedPhotos(e.target.files)}
            disabled={isValidating} // 🔒 検証中は無効化
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '2px dashed #E6EDED',
              borderRadius: '8px',
              backgroundColor: isValidating ? '#f5f5f5' : '#fafafa',
              cursor: isValidating ? 'not-allowed' : 'pointer',
              color: isValidating ? '#999' : '#333'
            }}
          />
          
          {isValidating && (
            <div style={{
              marginTop: '0.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              color: '#666',
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
          
          <div style={{
            marginTop: '0.5rem',
            fontSize: '0.8rem',
            color: '#666'
          }}>
            対応形式: JPEG, PNG, GIF, WebP | 各ファイル最大5MB | 全体最大20MB
          </div>
          
          {/* 新しい写真のプレビュー */}
          {newPhotoUrls.length > 0 && (
            <div style={{
              marginTop: '1rem',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
              gap: '0.75rem'
            }}>
              {newPhotoUrls.map((url, index) => (
                <div
                  key={index}
                  style={{
                    aspectRatio: '1',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    border: '2px solid #F0DB4F',
                    position: 'relative'
                  }}
                >
                  <img
                    src={url}
                    alt={`新しい写真 ${index + 1}`}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover'
                    }}
                  />
                  <div style={{
                    position: 'absolute',
                    top: '0.25rem',
                    left: '0.25rem',
                    backgroundColor: '#F0DB4F',
                    color: '#000',
                    borderRadius: '4px',
                    padding: '0.1rem 0.3rem',
                    fontSize: '0.7rem',
                    fontWeight: 'bold'
                  }}>
                    NEW
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* アクションボタン */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          marginBottom: '2rem'
        }}>
          {/* 上段：保存と削除ボタン */}
          <div style={{
            display: 'flex',
            gap: '1rem'
          }}>
            {/* 保存ボタン */}
            <button
              onClick={handleSave}
              disabled={saving || !hasChanges || isValidating || validationErrors.length > 0}
              style={{
                flex: '2',
                padding: '1rem',
                backgroundColor: (hasChanges && !isValidating && validationErrors.length === 0) ? '#055A68' : '#999',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                fontSize: '1rem',
                fontWeight: '600',
                cursor: (hasChanges && !isValidating && validationErrors.length === 0) ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                transition: 'all 0.3s ease'
              }}
            >
              {saving ? (
                <>
                  <div style={{
                    width: '20px',
                    height: '20px',
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
                    width: '20px',
                    height: '20px',
                    border: '2px solid rgba(255, 255, 255, 0.3)',
                    borderTop: '2px solid white',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }}></div>
                  検証中...
                </>
              ) : validationErrors.length > 0 ? (
                '⚠️ エラーを修正'
              ) : (
                '✓ 変更を保存'
              )}
            </button>
            
            {/* 削除ボタン */}
            <button
              onClick={() => setShowDeleteConfirm(true)}
              disabled={saving || isValidating}
              style={{
                flex: '1',
                padding: '1rem',
                backgroundColor: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                fontSize: '1rem',
                fontWeight: '600',
                cursor: (saving || isValidating) ? 'not-allowed' : 'pointer',
                opacity: (saving || isValidating) ? 0.6 : 1
              }}
            >
              削除
            </button>
          </div>
          
          {/* 下段：キャンセルボタン */}
          <button
            onClick={handleBack}
            disabled={saving || isValidating}
            style={{
              width: '100%',
              padding: '1rem',
              backgroundColor: '#ccc',
              color: '#666',
              border: 'none',
              borderRadius: '12px',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: (saving || isValidating) ? 'not-allowed' : 'pointer',
              opacity: (saving || isValidating) ? 0.6 : 1
            }}
          >
            キャンセル
          </button>
        </div>
        
        {/* 削除確認モーダル */}
        {showDeleteConfirm && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem'
          }}>
            <div style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '1.5rem',
              maxWidth: '400px',
              width: '100%'
            }}>
              <h3 style={{
                margin: '0 0 1rem 0',
                color: '#055A68',
                fontSize: '1.2rem'
              }}>
                投稿を削除
              </h3>
              <p style={{
                margin: '0 0 1.5rem 0',
                color: '#666',
                lineHeight: '1.5'
              }}>
                この投稿を完全に削除します。この操作は取り消せません。
              </p>
              <div style={{
                display: 'flex',
                gap: '0.75rem'
              }}>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  style={{
                    flex: '1',
                    padding: '0.75rem',
                    backgroundColor: '#f5f5f5',
                    color: '#666',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer'
                  }}
                >
                  キャンセル
                </button>
                <button
                  onClick={handleDelete}
                  style={{
                    flex: '1',
                    padding: '0.75rem',
                    backgroundColor: '#dc3545',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: '600'
                  }}
                >
                  削除する
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EditPostPage;