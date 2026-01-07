// PostPage.tsx - グループ名表示修正版（完全版）- コンテナスタイル適用
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import GroupFooterNav from '../components/GroupFooterNav';
import { useNavigate } from "react-router-dom";
import ConfirmPage from '../components/ConfirmPage';
import { DBUtil, STORES, DB_NAME, getGroupWithFirestore } from "../utils/dbUtil";
import { createPost } from '../firebase/firestore';
import { getCurrentUser, isAdmin } from '../utils/authUtil';
import { forceRefreshPosts } from '../pages/HomePage';
import { FileValidator } from '../utils/fileValidation';
import { DEFAULT_IMAGE_CONFIG } from '../types';


// ✅ ArchivePageとHomePageへの直接リフレッシュ関数を定義
declare global {
  interface Window {
    refreshArchivePage?: () => void;
    refreshHomePage?: () => void;
  }
}


// 投稿の型定義
interface Post {
  id: string;
  message: string;
  time: string;
  photoUrls: string[];
  tags: string[];
  userId: string;
  username: string;
  groupId: string;
  timestamp: number;
}

interface Group {
  id: string;
  name: string;
  [key: string]: any;
}

function PostPage() {
  const { groupId } = useParams<{ groupId: string }>(); 
  const [message, setMessage] = useState("");
  const [photos, setPhotos] = useState<FileList | null>(null);
  const [dbInitialized, setDbInitialized] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [isConfirmationMode, setIsConfirmationMode] = useState(false);
  const [photoPreviewUrls, setPhotoPreviewUrls] = useState<string[]>([]);
  const [groupName, setGroupName] = useState<string>(""); // 初期値を空文字に変更
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [currentGroup, setCurrentGroup] = useState<Group | null>(null);
  const [groupLoading, setGroupLoading] = useState(true); // グループ読み込み状態を追加
  
  // ===== 2モード設計：新しいstate =====
  const [selectionStep, setSelectionStep] = useState<'select' | 'highQuality' | 'confirm'>('select');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [highQualityIndices, setHighQualityIndices] = useState<number[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState({ current: 0, total: 0 });
  const [isUploading, setIsUploading] = useState(false);
const [uploadProgress, setUploadProgress] = useState(0);
const [uploadStatus, setUploadStatus] = useState('');


  const navigate = useNavigate();
  const [searchParams] = useSearchParams(); 
  
  // 🔒 セキュリティ強化: 入力値サニタイゼーション
  const sanitizeInput = useCallback((input: string): string => {
  return input
    .replace(/[<>]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '');
    // .trim() を削除して改行を保持
}, []);
  
  // 🔒 セキュリティ強化: タグの処理関数
  const parseTags = useCallback((input: string): string[] => {
    const sanitized = sanitizeInput(input);
    return sanitized
      .split(',')
      .map(tag => tag.trim())
      .filter(tag => tag !== '')
      .filter(tag => tag.length <= 50)
      .slice(0, 10)
      .map(tag => tag.startsWith('#') ? tag : `#${tag}`);
  }, [sanitizeInput]);

  // タグプレビューをメモ化
  const tagPreview = useMemo(() => parseTags(tagInput), [tagInput, parseTags]);
  
  // IndexedDBを初期化
  useEffect(() => {
    const initDB = async () => {
      try {
        const dbUtil = DBUtil.getInstance();
        await dbUtil.initDB();
        setDbInitialized(true);
        console.log("✅ データベース初期化成功");
      } catch (error) {
        console.error("❌ データベース初期化エラー:", error);
        alert("データベースの初期化に失敗しました。ブラウザを更新してください。");
      }
    };
    
    initDB();
  }, []);
  
  // 🔧 修正：正しい関数呼び出し方法を使用
  useEffect(() => {
    let isMounted = true;
    
    const fetchGroupInfo = async () => {
      if (!groupId || !dbInitialized) {
        console.log("⏳ グループ情報取得待機中 - groupId:", groupId, "dbInitialized:", dbInitialized);
        return;
      }
      
      console.log("🔍 グループ情報取得開始 - groupId:", groupId);
      setGroupLoading(true);
      
      try {
        // 方法1: GroupTOPやMembersページと同じgetGroupWithFirestoreを直接呼び出し
        console.log("☁️ getGroupWithFirestoreで取得中...", groupId);
        try {
          const firestoreGroup = await getGroupWithFirestore(groupId) as any;
          if (firestoreGroup && isMounted) {
            setCurrentGroup(firestoreGroup);
            setGroupName(firestoreGroup.name);
            setGroupLoading(false);
            console.log("✅ getGroupWithFirestoreでグループが見つかりました:", firestoreGroup.name);
            return;
          }
        } catch (firestoreError) {
          console.warn("⚠️ getGroupWithFirestore取得でエラー:", firestoreError);
        }
        
        // 方法2: IndexedDBから直接取得（フォールバック）
        console.log("📱 IndexedDBから直接取得を試行");
        try {
          const dbUtil = DBUtil.getInstance();
          const directGroup = await dbUtil.get(STORES.GROUPS, groupId) as any;
          if (directGroup && !directGroup.isDeleted && isMounted) {
            setCurrentGroup(directGroup);
            setGroupName(directGroup.name);
            setGroupLoading(false);
            console.log("✅ IndexedDBでグループが見つかりました:", directGroup.name);
            return;
          }
        } catch (directError) {
          console.warn("⚠️ 直接ID取得でエラー:", directError);
        }
        
        // 方法3: IndexedDBから全グループを取得して検索（最終手段）
        console.log("📱 IndexedDBから全グループを取得して検索");
        try {
          const dbUtil = DBUtil.getInstance();
          const allLocalGroups = await dbUtil.getAll(STORES.GROUPS) as any;
          console.log("📱 IndexedDBから取得したグループ数:", allLocalGroups.length);
          
          if (allLocalGroups.length > 0) {
            // アクティブなグループのみをフィルタリング
            const activeLocalGroups = allLocalGroups.filter(group => !group.isDeleted);
            console.log("📱 アクティブなグループ数:", activeLocalGroups.length);
            
            const groupIdStr = String(groupId).trim();
            console.log("🔍 検索対象のgroupId:", `"${groupIdStr}"`);
            
            const localGroup = activeLocalGroups.find((group: any) => {
              const ids = [
                String(group.id || '').trim(),
                String(group.groupId || '').trim(),
                String(group.firebaseId || '').trim(),
                String(group._id || '').trim(),
              ].filter(id => id !== '');
              
              console.log("🔍 IndexedDBグループ照合:", {
                groupName: group.name,
                searchIds: ids,
                targetGroupId: groupIdStr,
                matches: ids.includes(groupIdStr)
              });
              
              return ids.includes(groupIdStr);
            });
            
            if (localGroup && isMounted) {
              setCurrentGroup(localGroup);
              setGroupName(localGroup.name);
              setGroupLoading(false);
              console.log("✅ IndexedDBでグループが見つかりました:", localGroup.name);
              return;
            }
          }
        } catch (searchError) {
          console.warn("⚠️ IndexedDB検索でエラー:", searchError);
        }
        
        // すべての方法で見つからない場合
        if (isMounted) {
          console.log("❌ 全ての方法でグループが見つかりませんでした");
          console.log("🔍 検索対象のgroupId:", `"${groupId}"`, "型:", typeof groupId);
          setGroupName("指定されたグループが見つかりません");
          setGroupLoading(false);
        }
        
      } catch (error) {
        console.error("❌ グループ情報の取得に失敗:", error);
        if (isMounted) {
          setGroupName("グループ取得エラー");
          setGroupLoading(false);
        }
      }
    };
    
    fetchGroupInfo();
    
    return () => {
      isMounted = false;
    };
  }, [groupId, dbInitialized]);
  
  // 写真の検証とプレビュー生成
  useEffect(() => {
    let isMounted = true;
    
    const processPhotos = async () => {
      if (!photos || photos.length === 0) {
        if (isMounted) {
          setPhotoPreviewUrls([]);
          setValidationErrors([]);
        }
        return;
      }
      
      setIsValidating(true);
      
      try {
        const result = await FileValidator.validateFiles(photos);
        
        if (isMounted) {
          if (result.errors.length > 0) {
            setValidationErrors(result.errors);
            setPhotoPreviewUrls([]);
            FileValidator.logSecurityEvent('validation_failed', { errors: result.errors });
          } else {
            setValidationErrors([]);
            const urls = result.validFiles.map(file => URL.createObjectURL(file));
            setPhotoPreviewUrls(urls);
            
            FileValidator.logSecurityEvent('files_validated', { 
              fileCount: result.validFiles.length,
              totalSize: result.validFiles.reduce((sum, file) => sum + file.size, 0)
            });
            
            return () => {
              urls.forEach(url => URL.revokeObjectURL(url));
            };
          }
        }
      } catch (error) {
        console.error('ファイル処理エラー:', error);
        if (isMounted) {
          setValidationErrors(['ファイル処理中にエラーが発生しました']);
          setPhotoPreviewUrls([]);
        }
        FileValidator.logSecurityEvent('processing_error', { error });
      } finally {
        if (isMounted) {
          setIsValidating(false);
        }
      }
    };
    
    processPhotos();
    
    return () => {
      isMounted = false;
    };
  }, [photos]);
  
  // メッセージ入力処理
  const handleMessageChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const sanitized = sanitizeInput(e.target.value);
    setMessage(sanitized);
  }, [sanitizeInput]);
  
  // タグ入力処理
  const handleTagInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const sanitized = sanitizeInput(e.target.value);
    setTagInput(sanitized);
  }, [sanitizeInput]);
  
  // エラークリア
  const clearErrors = useCallback(() => {
    setValidationErrors([]);
  }, []);

  // 確認ページを表示する処理
  const handleConfirmation = useCallback(() => {
    if (validationErrors.length > 0) {
      alert('ファイルエラーを解決してから確認画面に進んでください。');
      return;
    }
    
    if (!message.trim() && (!photos || photos.length === 0)) {
      alert("メッセージまたは画像を入力してください");
      return;
    }
    
    setIsConfirmationMode(true);
  }, [validationErrors, message, photos]);
  
  // 編集に戻る処理
  const handleCancelConfirmation = useCallback(() => {
    setIsConfirmationMode(false);
  }, []);

  // 安全な投稿保存処理
  const handleSubmit = useCallback(async () => {
  try {
    if (!groupId) {
      alert("グループIDが取得できませんでした。グループページから再度お試しください。");
      return;
    }
    
    // 🔥 プログレスバー開始
    setIsUploading(true);
    setUploadProgress(0);
    setUploadStatus('準備中...');
    
    // ユーザー情報を取得
    const user = await getCurrentUser();
    if (!user) {
      alert('ユーザー情報を取得できませんでした');
      setIsUploading(false);
      return;
    }
    
    // 🔥 ローカルストレージから最新のプロフィール情報で上書き
    try {
      const localUserData = localStorage.getItem("daily-report-user-data");
      if (localUserData) {
        const parsedData = JSON.parse(localUserData);
        if (parsedData.id === user.id && parsedData.profileData?.fullName) {
          console.log('🔄 投稿作成時にdisplayNameを上書き:', parsedData.profileData.fullName);
          user.displayName = parsedData.profileData.fullName;
        }
      }
    } catch (error) {
      console.warn('⚠️ ローカルデータ上書きエラー:', error);
    }

    // ===== 2モード設計：画像処理 =====
    let photoUrls: string[] = [];
    let processedData: {
      documentImages: string[];
      photoImages: string[];
      thumbnails: { documents: string[]; photos: string[] };
    } | null = null;

    if (selectedFiles.length > 0) {
      const result = await FileValidator.validateFiles(selectedFiles);
      
      if (result.errors.length > 0) {
        alert(`ファイルエラー:\n${result.errors.join('\n')}`);
        setIsUploading(false);
        return;
      }

      if (result.validFiles.length > 0) {
        try {
          console.log(`📸 2モード画像処理開始: ${result.validFiles.length}枚（高画質${highQualityIndices.length}枚）`);
          
          // 🔥 プログレスバー更新: 画像処理開始
          setUploadStatus(`画像を処理中... (${result.validFiles.length}枚)`);
          setUploadProgress(10);

          setIsProcessing(true);
          setProcessingProgress({ current: 0, total: result.validFiles.length });

          // 2モード処理を実行
          processedData = await FileValidator.processImagesWithTwoModes(
            result.validFiles,
            highQualityIndices
          );

          // 🔥 画像処理完了
          setUploadProgress(70);
          setUploadStatus('画像処理完了');

          // サイズチェック
          const sizeCheck = FileValidator.checkTwoModeTotalSize(
            processedData.documentImages,
            processedData.photoImages
          );

          if (!sizeCheck.isValid) {
            alert(sizeCheck.error);
            setIsUploading(false);
            setIsProcessing(false);
            return;
          }

          // 後方互換性のため、全画像を1つの配列にも保存
          photoUrls = [...processedData.documentImages, ...processedData.photoImages];

          console.log(`✅ 2モード画像処理完了: 図面${processedData.documentImages.length}枚, 写真${processedData.photoImages.length}枚`);
          console.log(`📊 合計サイズ: ${sizeCheck.totalSizeMB}MB`);

          FileValidator.logSecurityEvent('two_mode_upload', {
            totalFiles: result.validFiles.length,
            documentCount: processedData.documentImages.length,
            photoCount: processedData.photoImages.length,
            totalSizeMB: sizeCheck.totalSizeMB,
            groupId: groupId
          });

          setIsProcessing(false);

        } catch (conversionError) {
          console.error('画像処理エラー:', conversionError);
          alert('画像の処理中にエラーが発生しました。画像サイズを確認して再度お試しください。');
          setIsUploading(false);
          setIsProcessing(false);
          return;
        }
      }
    } else {
      // 画像なしの場合は進捗を70%に
      setUploadProgress(70);
    }
    
    // 🔥 Firestore保存開始
    setUploadStatus('データを保存中...');
    setUploadProgress(75);
    
    const sanitizedMessage = sanitizeInput(message).substring(0, 5000);
    const tags = parseTags(tagInput);
    const timestamp = Date.now();
    
    // Firestore用の投稿データ（2モード設計対応）
    const newPost = {
      userId: user.id,
      userName: user.displayName || localStorage.getItem("daily-report-displayname") || user.username,
      groupId: groupId,
      message: sanitizedMessage || "",
      tags: tags,
      status: '未確認' as const,
      isWorkTimePost: false,
      isEdited: false,
      
      // 後方互換性：従来の画像配列
      images: photoUrls,
      
      // 2モード設計：新しい画像データ構造
      thumbnails: processedData ? processedData.thumbnails : { documents: [], photos: [] },
      highQualityCount: processedData ? processedData.documentImages.length : 0,
      standardCount: processedData ? processedData.photoImages.length : 0,
      totalImageCount: photoUrls.length,
      
      // 会社情報（ハイブリッド方式）
      companyName: user.profileData?.company || user.company || null,
      companyId: null,  // 将来用
      
      // AI準備フィールド（将来用）
      aiTags: null,
      aiSummary: null,
      extractedText: null,
      scheduleId: null,
    };
    
    // 🔥 Firestoreに保存
    setUploadProgress(85);
    const postId = await createPost(newPost);
    
    // 🔥 IndexedDB保存
    setUploadStatus('ローカルに保存中...');
    setUploadProgress(90);
    
    // IndexedDB用の投稿データ（後方互換性のため）
    const now = new Date();
    const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
    const weekday = weekdays[now.getDay()];
    const date = `${now.getFullYear()} / ${now.getMonth() + 1} / ${now.getDate()}（${weekday}）`;
    const time = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    const legacyPost = {
      id: postId,
      message: sanitizedMessage || "",
      time: `${date}　${time}`,
      photoUrls,
      tags,
      userId: user.id,
      username: user.displayName || localStorage.getItem("daily-report-displayname") || user.username,
      groupId: groupId,
      timestamp: timestamp,
      status: '未確認' as const,
      
      // 2モード設計データ
      thumbnails: processedData ? processedData.thumbnails : { documents: [], photos: [] },
      highQualityCount: processedData ? processedData.documentImages.length : 0,
      standardCount: processedData ? processedData.photoImages.length : 0,
      totalImageCount: photoUrls.length,
      
      // 会社情報
      companyName: user.profileData?.company || user.company || null,
    };

    // IndexedDBにも保存（後方互換性のため）
    const dbUtil = DBUtil.getInstance();
    await dbUtil.save(STORES.POSTS, legacyPost);
    console.log('投稿をデータベースに保存完了:', postId);
    
    // 🔥 更新通知
    setUploadStatus('更新を通知中...');
    setUploadProgress(95);
    
    // 更新通知システム
    console.log('🚀 投稿完了 - 強化された更新通知システム開始');
    
    // 1. localStorageフラグを複数設定（確実な検知のため）
    const updateFlag = Date.now().toString();
    localStorage.setItem('daily-report-posts-updated', updateFlag);
    localStorage.setItem('last-updated-group-id', groupId);
    localStorage.setItem('posts-need-refresh', updateFlag);
    localStorage.setItem('archive-posts-updated', updateFlag);
    console.log('📱 localStorageフラグを設定:', updateFlag);

    // 2. 複数の更新イベントを即座発火
    const updateEvent = new CustomEvent('postsUpdated', { 
      detail: { 
        newPost: legacyPost,
        timestamp: timestamp,
        source: 'PostPage',
        action: 'create'
      } 
    });

    const storageEvent = new CustomEvent('storage', {
      detail: { key: 'daily-report-posts-updated', newValue: updateFlag }
    });

    window.dispatchEvent(updateEvent);
    window.dispatchEvent(storageEvent);
    window.dispatchEvent(new CustomEvent('refreshPosts'));
    console.log('📢 即座更新イベントを発火完了');

    // 3. 段階的な追加通知（確実性を高める）
    const notificationSchedule = [100, 300, 500, 1000];
    notificationSchedule.forEach((delay, index) => {
      setTimeout(() => {
        console.log(`📢 段階的更新通知 ${index + 1}/${notificationSchedule.length} (${delay}ms後)`);
        
        // フラグを更新
        const delayedFlag = (Date.now()).toString();
        localStorage.setItem('daily-report-posts-updated', delayedFlag);
        
        // イベントを再発火
        window.dispatchEvent(new CustomEvent('postsUpdated', { 
          detail: { 
            newPost: legacyPost,
            timestamp: Date.now(),
            source: 'PostPage-delayed',
            delay: delay
          } 
        }));
        
        // リフレッシュは投稿イベント監視に任せる (重複防止)
        // 投稿イベントは ArchivePage と HomePage の監視システムが自動処理
        console.log('📢 投稿イベントは監視システムが処理します');
        
      }, delay);
    });

    // 4. forceRefreshPostsの呼び出し（既存機能との互換性）
    try {
      forceRefreshPosts();
      console.log('✅ forceRefreshPosts実行完了');
    } catch (error) {
      console.warn('⚠️ forceRefreshPosts実行エラー:', error);
    }

    console.log('🎯 強化された更新通知システム完了 - 投稿ID:', postId);
    
    // 🔥 完了!
    setUploadProgress(100);
    setUploadStatus('完了!');
    
    // フォーム状態をクリア
    setMessage("");
    setPhotos(null);
    setPhotoPreviewUrls([]);
    setTagInput("");
    setIsConfirmationMode(false);
    clearErrors();

    // 2モード設計：追加のリセット
    setSelectedFiles([]);
    setHighQualityIndices([]);
    setSelectionStep('select');
    
    // プログレスバーを少し表示してから消す
    setTimeout(() => {
      setIsUploading(false);
      alert("✅ 投稿が保存されました！");
      
      setTimeout(() => {
        console.log('遷移前の最終更新イベント発火');
        window.dispatchEvent(new CustomEvent('postsUpdated'));
        console.log('🔐 認証状態確認:', {
          hasToken: !!localStorage.getItem('daily-report-user-token'),
          hasUserId: !!localStorage.getItem('daily-report-user-id'),
          timestamp: Date.now()
        });
        navigate(`/group/${groupId}/archive`);

// ⭐ 遷移後にもイベントを発火（ArchivePageのマウント後に確実に届く）
setTimeout(() => {
  console.log('🚀 遷移後の追加イベント発火');
  const postNavigateEvent = new CustomEvent('postsUpdated', { 
    detail: { 
      timestamp: Date.now(),
      source: 'PostPage-after-navigate'
    } 
  });
  window.dispatchEvent(postNavigateEvent);
  
  // 直接リフレッシュも試行
  if (window.refreshArchivePage) {
    window.refreshArchivePage();
  }
}, 100);
      }, 300);
    }, 500);
    
  } catch (error: any) {
    console.error("投稿の保存中にエラーが発生しました", error);
    FileValidator.logSecurityEvent('post_save_failed', { error, groupId });
    
    setIsUploading(false);
    
    // エラーの種類を判定
    let errorMessage = "投稿の保存中にエラーが発生しました";
    
    if (error?.message?.includes('exceeds the maximum allowed size')) {
      // Firestoreサイズ制限エラー
      const match = error.message.match(/(\d+,?\d*)\s*bytes.*maximum.*?(\d+,?\d*)\s*bytes/);
      if (match) {
        const actualSize = parseInt(match[1].replace(/,/g, ''));
        const maxSize = parseInt(match[2].replace(/,/g, ''));
        const actualMB = (actualSize / (1024 * 1024)).toFixed(2);
        const maxMB = (maxSize / (1024 * 1024)).toFixed(2);
        const overageMB = (parseFloat(actualMB) - parseFloat(maxMB)).toFixed(2);
        
        // 選択された画像の情報を取得
        const totalFiles = selectedFiles?.length || 0;
        const highQualityCount = highQualityIndices?.length || 0;
        const normalCount = totalFiles - highQualityCount;
        
        // 圧縮前のファイルサイズを計算
        let originalSizeMB = "0.00";
        if (selectedFiles) {
          const totalBytes = Array.from(selectedFiles).reduce((sum, file) => sum + file.size, 0);
          originalSizeMB = (totalBytes / (1024 * 1024)).toFixed(2);
        }
        
        errorMessage = 
          `⚠️ 画像が多すぎます\n\n` +
          `選択した画像: ${totalFiles}枚\n` +
          `（高画質: ${highQualityCount}枚、通常: ${normalCount}枚）\n\n` +
          `💡 解決方法:\n` +
          `• 高画質を${Math.max(0, highQualityCount - 3)}枚減らす\n` +
          `• または` +
          `• 画像を${Math.ceil(totalFiles / 2)}枚ずつ、2回に分けて投稿`;
      }
    } else if (error?.code === 'permission-denied') {
      errorMessage = "⚠️ 権限エラー\n\n投稿する権限がありません。";
    } else if (error?.code === 'network-request-failed') {
      errorMessage = "⚠️ ネットワークエラー\n\nインターネット接続を確認してください。";
    } else if (error?.message) {
      errorMessage = `⚠️ エラーが発生しました\n\n${error.message}`;
    }
    
    alert(errorMessage);
  }
}, [groupId, selectedFiles, highQualityIndices, message, tagInput, sanitizeInput, parseTags, clearErrors, navigate]);

  // データベースが初期化されるまで読み込み表示
  if (!dbInitialized) {
    return (
      <div style={{
        minHeight: "100vh",
        background: "linear-gradient(to top, rgb(7, 112, 144), rgb(7, 107, 127), rgb(0, 102, 114))",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        color: "#fff"
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '30px',
            height: '30px',
            border: '3px solid rgba(240, 219, 79, 0.3)',
            borderTop: '3px solid #F0DB4F',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto',
            marginBottom: '1rem',
          }}></div>
          データベース初期化中...
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(to top, rgb(7, 112, 144), rgb(7, 107, 127), rgb(0, 102, 114))",
        padding: 0,
        boxSizing: "border-box",
        paddingBottom: "80px",
        display: "flex",
        flexDirection: "column",
      }}
    >

      {/* 🔥 投稿処理中プログレスバー */}
    {isUploading && (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        backdropFilter: 'blur(4px)'
      }}>
        <div style={{
          backgroundColor: '#055A68',
          padding: '2rem',
          borderRadius: '20px',
          width: '85%',
          maxWidth: '400px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
        }}>
          {/* タイトル */}
          <div style={{
            color: 'white',
            fontSize: '1.2rem',
            fontWeight: 'bold',
            marginBottom: '0.5rem',
            textAlign: 'center'
          }}>
            投稿を処理中...
          </div>
          
          {/* 現在の処理内容 */}
          <div style={{
            color: '#F0DB4F',
            fontSize: '0.9rem',
            marginBottom: '1.5rem',
            textAlign: 'center',
            minHeight: '1.5rem'
          }}>
            {uploadStatus}
          </div>
          
          {/* プログレスバー */}
          <div style={{
            width: '100%',
            height: '14px',
            backgroundColor: 'rgba(255, 255, 255, 0.15)',
            borderRadius: '7px',
            overflow: 'hidden',
            marginBottom: '1rem',
            boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.2)'
          }}>
            <div style={{
              width: `${uploadProgress}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #F0DB4F 0%, #FFE95D 100%)',
              transition: 'width 0.3s ease',
              borderRadius: '7px',
              boxShadow: '0 2px 4px rgba(240, 219, 79, 0.4)'
            }} />
          </div>
          
          {/* パーセンテージ */}
          <div style={{
            color: 'white',
            fontSize: '1.5rem',
            fontWeight: 'bold',
            textAlign: 'center',
            marginBottom: '1rem'
          }}>
            {uploadProgress}%
          </div>
          
          {/* ヒント */}
          <div style={{
            color: 'rgba(255, 255, 255, 0.6)',
            fontSize: '0.8rem',
            textAlign: 'center',
            lineHeight: '1.4'
          }}>
            処理が完了するまでお待ちください<br />
            画面を閉じないでください
          </div>
        </div>
      </div>
    )}


      {/* 入力画面のみヘッダーを表示 */}
      {!isConfirmationMode && (
       <div
  style={{
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: '60px',  // ← 追加
    zIndex: 100,
    background: 'linear-gradient(to right, rgb(0, 102, 114), rgb(7, 107, 127))',
    display: 'flex',  // ← 追加
    alignItems: 'center',  // ← 追加
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',  // ← 追加
    boxSizing: 'border-box',
  }}
>
         <div style={{ 
  maxWidth: '480px', 
  margin: '0 auto',
  width: '100%',
  padding: '0 1.5rem',
  boxSizing: 'border-box',
}}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-start',
                alignItems: 'center',
              }}
            >
              {/* 戻るボタン */}
              <div 
                style={{ 
                  display: 'flex',
                  alignItems: 'center',
                  cursor: 'pointer',
                  marginBottom: '0.2rem',
                }}
                onClick={() => {
                  const from = searchParams.get('from');
                  const postId = searchParams.get('postId');
                  
                  if (from === 'home') {
                    navigate('/');
                  } else {
                    const params = new URLSearchParams();
                    if (from) params.set('from', from);
                    if (postId) params.set('postId', postId);
                    const paramString = params.toString() ? `?${params.toString()}` : '';
                    
                    navigate(`/group/${groupId}${paramString}`);
                  }
                }}
              >
                <svg 
                  width="24" 
                  height="24" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="#F0DB4F"
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                  style={{ marginRight: '0.5rem' }}
                >
                  <path d="M15 18l-6-6 6-6" />
                </svg>
                
               
              </div>
            </div>
          </div>
        </div>
      )}

      {/* スクロール可能なコンテンツエリア */}
      <div
  style={{
    flex: 1,
    overflowY: 'auto',
    padding: '1.5rem',
    paddingTop: isConfirmationMode ? '1.5rem' : '6.5rem',
    boxSizing: 'border-box',
    paddingBottom: '5rem',
  }}
>
        <div style={{ maxWidth: '480px', margin: '0 auto' }}>
          {isConfirmationMode ? (
            // 確認画面
            <ConfirmPage
              message={message}
              photos={photos}
              photoPreviewUrls={photoPreviewUrls}
              tags={tagPreview}
              onConfirm={handleSubmit}
              onCancel={handleCancelConfirmation}
            />
          ) : (
           // 入力画面 - コンテナスタイルを適用
<div style={{ width: "100%" }}>
  {/* ページタイトル - GroupListPageと同じスタイル */}
  <div style={{ 
    display: 'flex', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: '1.5rem' 
  }}>
    <h2 style={{ 
      fontSize: '2rem', 
      letterSpacing: '0.01em', 
      color: '#F0DB4F', 
      margin: 0 
    }}>
      Daily Post
    </h2>
  </div>



              {/* メイン投稿フォーム - コンテナスタイルを適用 */}
              <div style={{ 
                backgroundColor: "#ffffff22", 
                color: "#fff", 
                padding: "1.5rem", 
                borderRadius: "12px", 
                marginBottom: "1.5rem",
                boxSizing: "border-box" 
              }}>
                
                {/* ヘッダー部分 - グループ読み込み状態を考慮 */}
                <div style={{ 
                  display: "flex", 
                  justifyContent: "space-between", 
                  alignItems: "center", 
                  marginBottom: "1.5rem" 
                }}>
                  <h3 style={{ 
                    fontSize: "1.2rem", 
                    color: "#F0DB4F", 
                    margin: 0,
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    minHeight: "1.8rem" // 最小高さを設定してレイアウトを安定化
                  }}>
                    {groupLoading ? (
                      <>
                        <div style={{
                          width: '16px',
                          height: '16px',
                          border: '2px solid rgba(240, 219, 79, 0.3)',
                          borderTop: '2px solid #F0DB4F',
                          borderRadius: '50%',
                          animation: 'spin 1s linear infinite'
                        }}></div>
                        読み込み中...
                      </>
                    ) : groupName ? (
                      groupName
                    ) : (
                      <span style={{ opacity: 0.5 }}>グループ名を取得中...</span>
                    )}
                  </h3>
                </div>

                {/* メッセージ入力 */}
                <div style={{ marginBottom: "1rem" }}>
                  <label style={{ 
                    display: "block", 
                    marginBottom: "0.5rem", 
                    fontWeight: "bold", 
                    color: "#fff"
                  }}>
                    Message
                  </label>
                  <textarea
                    value={message}
                    onChange={handleMessageChange}
                    rows={7}
                    maxLength={5000}
                    placeholder="今日のレポートを書く..."
                    style={{ 
                      width: "100%", 
                      padding: "0.8rem", 
                      borderRadius: "10px", 
                      border: "1px solid #ffffff22", 
                      backgroundColor: "#ffffff12", 
                      color: "#fff", 
                      fontSize: "16px", 
                      resize: "none", 
                      boxSizing: "border-box",
                      outline: "none",
                      lineHeight: "1.6"
                    }}
                  />
                  <div style={{
                    fontSize: "0.8rem",
                    color: "#ddd",
                    textAlign: "right",
                    marginTop: "0.25rem"
                  }}>
                    {message.length}/5000文字
                  </div>
                </div>
                
                {/* タグ入力欄 */}
                <div style={{ marginBottom: "1.2rem" }}>
                  <label style={{ 
                    display: "block", 
                    marginBottom: "0.5rem", 
                    fontWeight: "bold", 
                    color: "#fff"
                  }}>
                    Tags
                  </label>
                  <input
                    type="text"
                    value={tagInput}
                    onChange={handleTagInputChange}
                    maxLength={200}
                    placeholder="例：トラブル, クレーム"
                    style={{ 
                      width: "100%", 
                      padding: "0.8rem", 
                      borderRadius: "10px", 
                      border: "1px solid #ffffff22", 
                      backgroundColor: "#ffffff12", 
                      color: "#fff", 
                      fontSize: "16px", 
                      boxSizing: "border-box",
                      outline: "none"
                    }}
                  />
                  <small style={{ 
                    display: "block", 
                    marginTop: "0.4rem", 
                    color: "#ddd", 
                    fontSize: "0.8rem" 
                  }}>
                    カンマ区切りで入力 ( 最大10個 )
                  </small>
                  
                  {/* タグプレビュー */}
                  {tagInput.trim() && (
                    <div style={{
                      marginTop: "0.5rem",
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "0.5rem"
                    }}>
                      {tagPreview.map((tag, index) => (
                        <span
                          key={index}
                          style={{
                            backgroundColor: "#F0DB4F22",
                            color: "#F0DB4F",
                            padding: "0.3rem 0.7rem",
                            borderRadius: "999px",
                            fontSize: "0.8rem",
                            fontWeight: "500"
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                
                  


                {/* ===== 2モード設計：画像アップロードセクション ===== */}
                <div style={{ marginBottom: "2rem" }}>
                  <label style={{ 
                    display: "block", 
                    marginBottom: "0.5rem", 
                    fontWeight: "bold", 
                    color: "#fff"
                  }}>
                    Photos
                  </label>
                  
                 

                  {/* 画像選択ステップ */}
                  {selectionStep === 'select' && (
                    <>
                      <div style={{ position: 'relative' }}>
                        <input
                          type="file"
                          multiple
                          accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                          onChange={(e) => {
  if (e.target.files && e.target.files.length > 0) {
    const filesArray = Array.from(e.target.files);
    if (filesArray.length > DEFAULT_IMAGE_CONFIG.maxTotal) {
      alert(`最大${DEFAULT_IMAGE_CONFIG.maxTotal}枚まで選択できます`);
      return;
    }
    setSelectedFiles(filesArray);
    setPhotos(e.target.files);
    // プレビュー生成
    const urls = filesArray.map(file => URL.createObjectURL(file));
    setPhotoPreviewUrls(urls);
    // 直接高画質選択画面へ遷移
    setSelectionStep('highQuality');
  }
}}
                          disabled={isValidating}
                          style={{
                            position: 'absolute',
                            width: '100%',
                            height: '100%',
                            opacity: 0,
                            cursor: isValidating ? "not-allowed" : "pointer",
                          }}
                        />
                        <div
                          style={{
  width: "100%", 
  padding: "3rem 1rem",  // ← 上下のpaddingを増やして中央配置
  borderRadius: "12px", 
  backgroundColor: "#ffffff12", 
  color: "#fff", 
　border: "1.5px dashed #ffffff40", 
  boxSizing: "border-box",
  cursor: isValidating ? "not-allowed" : "pointer",
  textAlign: "center",
  transition: "all 0.2s ease",
  display: "flex",  // ← 追加
  flexDirection: "column",  // ← 追加
  justifyContent: "center",  // ← 追加
  minHeight: "140px"  // ← 追加（最小の高さを確保）
}}
                        >
                          <div style={{ fontSize: "0.95rem", fontWeight: "500", marginBottom: "0.5rem" }}>
                            タップして画像を選択
                          </div>
                        </div>
                      </div>

                      <small style={{ 
                        display: "block", 
                        marginTop: "0.5rem", 
                        color: "#ddd", 
                        fontSize: "0.8rem" 
                      }}>
                        JPEG, PNG, GIF, WebP（最大{DEFAULT_IMAGE_CONFIG.maxTotal}枚）
                      </small>
                    </>
                  )}

                  {/* 高画質選択ステップ */}
                  {selectionStep === 'highQuality' && (
  <div>
    {/* エラーがある場合はエラー表示のみ、ない場合は高画質選択UI */}
    {validationErrors.length > 0 ? (
  <div style={{
    backgroundColor: "rgba(229, 115, 115, 0.6)",
    color: "#ffffff",      
    padding: "1rem",
    borderRadius: "12px",
    marginBottom: "1rem",
  }}>
    <div style={{ fontWeight: "bold", marginBottom: "0.5rem" }}>
      ⚠️ ファイルセキュリティエラー
    </div>
    {validationErrors.map((error, index) => (
      <div key={index} style={{ fontSize: "0.9rem", marginBottom: "0.25rem" }}>
        • {error}
      </div>
    ))}
  </div>
    ) : (
      /* 高画質選択UI */
      <>
        <div style={{
          backgroundColor: "rgba(240, 219, 79, 0.1)",
          padding: "1rem",
          borderRadius: "10px",
          marginBottom: "1rem"
        }}>
          <div style={{ color: "#F0DB4F", fontWeight: "bold", marginBottom: "0.5rem" }}>
            高画質を選択
          </div>
          <div style={{ color: "#ffff", fontSize: "0.85rem" }}>
            図面・書類など細かい文字が読めるよう高画質をキープしたい場合は、最大{DEFAULT_IMAGE_CONFIG.maxHighQuality}枚まで選べます。
          </div>
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "0.75rem"
        }}>
          {photoPreviewUrls.map((url, index) => {
            const isSelected = highQualityIndices.includes(index);
            const canSelect = highQualityIndices.length < DEFAULT_IMAGE_CONFIG.maxHighQuality || isSelected;
            
            return (
              <div
                key={index}
                onClick={() => {
                  if (isSelected) {
                    setHighQualityIndices(prev => prev.filter(i => i !== index));
                  } else if (canSelect) {
                    setHighQualityIndices(prev => [...prev, index]);
                  }
                }}
                style={{
                  position: "relative",
                  aspectRatio: "1",
                  borderRadius: "10px",
                  overflow: "hidden",
                  cursor: canSelect ? "pointer" : "not-allowed",
                  opacity: canSelect ? 1 : 0.5,
                  border: isSelected ? "3px solid #F0DB4F" : "3px solid transparent",
                  transition: "all 0.2s ease"
                }}
              >
                <img
                  src={url}
                  alt={`画像 ${index + 1}`}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover"
                  }}
                />
                
                {/* 選択インジケーター - 選択時のみ表示 */}
                {isSelected && (
                  <div style={{
                    position: "absolute",
                    top: "6px",
                    right: "6px",
                    width: "24px",
                    height: "24px",
                    borderRadius: "50%",
                    backgroundColor: "#F0DB4F",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "14px",
                    fontWeight: "bold",
                    color: "#000",
                    border: "2px solid #fff",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.3)"
                  }}>
                    {highQualityIndices.indexOf(index) + 1}
                  </div>
                )}

                {/* 高画質バッジ */}
                {isSelected && (
                  <div style={{
                    position: "absolute",
                    bottom: "6px",
                    left: "6px",
                    backgroundColor: "#F0DB4F",
                    color: "#000",
                    padding: "2px 6px",
                    borderRadius: "4px",
                    fontSize: "0.65rem",
                    fontWeight: "bold"
                  }}>
                    高画質
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </>
    )}

    {/* ボタン群 */}
    <div style={{ 
      display: "flex", 
      gap: "0.75rem", 
      marginTop: "3rem" 
    }}>
      <button
        onClick={() => {
          setSelectionStep('select');
          setHighQualityIndices([]);
        }}
        style={{
          flex: 1,
          padding: "0.75rem",
          backgroundColor: "transparent",
          color: "#fff",
          border: "2px solid #ffffff66",
          borderRadius: "10px",
          fontSize: "0.95rem",
          cursor: "pointer"
        }}
      >
        画像選択に戻る
      </button>
      <button
        onClick={handleConfirmation}
        disabled={isValidating || validationErrors.length > 0 || groupLoading}
        style={{
          flex: 1,
          padding: "0.75rem",
          backgroundColor: isValidating || validationErrors.length > 0 || groupLoading ? "#666" : "#F0DB4F",
          color: isValidating || validationErrors.length > 0 || groupLoading ? "#ccc" : "#000",
          border: "none",
          borderRadius: "10px",
          fontSize: "0.95rem",
          fontWeight: "bold",
          cursor: isValidating || validationErrors.length > 0 || groupLoading ? "not-allowed" : "pointer"
        }}
      >
        確認する
      </button>
    </div>
  </div>
)}
                  
                  {isValidating && (
                    <div style={{
                      marginTop: "0.5rem",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      color: "#F0DB4F",
                      fontSize: "0.9rem"
                    }}>
                      <div style={{
                        width: "16px",
                        height: "16px",
                        border: "2px solid rgba(240, 219, 79, 0.3)",
                        borderTop: "2px solid #F0DB4F",
                        borderRadius: "50%",
                        animation: "spin 1s linear infinite"
                      }}></div>
                      ファイル検証中...
                    </div>
                  )}
                </div>



                
                {/* 確認ボタン */}
                {selectionStep === 'select' && (
  <button
    onClick={handleConfirmation}
    disabled={isValidating || validationErrors.length > 0 || groupLoading}
                  style={{ 
                    width: "100%", 
                    padding: "0.75rem", 
                    backgroundColor: (isValidating || validationErrors.length > 0 || groupLoading) ? "#666" : "#F0DB4F", 
                    color: (isValidating || validationErrors.length > 0 || groupLoading) ? "#ccc" : "#000", 
                    border: "none", 
                    borderRadius: "12px", 
                    fontSize: "1rem", 
                    fontWeight: "bold", 
                    cursor: (isValidating || validationErrors.length > 0 || groupLoading) ? "not-allowed" : "pointer", 
                    transition: "0.3s",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.5rem"
                  }}
                  onMouseOver={(e) => {
                    if (!isValidating && validationErrors.length === 0 && !groupLoading) {
                      e.currentTarget.style.backgroundColor = "#ffe95d";
                    }
                  }}
                  onMouseOut={(e) => {
                    if (!isValidating && validationErrors.length === 0 && !groupLoading) {
                      e.currentTarget.style.backgroundColor = "#F0DB4F";
                    }
                  }}
                >
                  {isValidating ? (
                    <>
                      <div style={{
                        width: "16px",
                        height: "16px",
                        border: "2px solid rgba(204, 204, 204, 0.3)",
                        borderTop: "2px solid #ccc",
                        borderRadius: "50%",
                        animation: "spin 1s linear infinite"
                      }}></div>
                      検証中...
                    </>
                  ) : groupLoading ? (
                    <>
                      <div style={{
                        width: "16px",
                        height: "16px",
                        border: "2px solid rgba(204, 204, 204, 0.3)",
                        borderTop: "2px solid #ccc",
                        borderRadius: "50%",
                        animation: "spin 1s linear infinite"
                      }}></div>
                      読み込み中...
                    </>
                  ) : validationErrors.length > 0 ? (
                    "⚠️ 画像を選び直す"
                  ) : (
                    "確認する"
                  )}
                </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* グループのフッターナビゲーション */}
      <GroupFooterNav activeTab="post" />
      
      {/* CSSアニメーション */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        
        /* プレースホルダーテキストの色を白に設定 */
        ::-webkit-input-placeholder {
          color: #ffffff88 !important;
        }
        ::-moz-placeholder {
          color: #ffffff88 !important;
        }
        :-ms-input-placeholder {
          color: #ffffff88 !important;
        }
        ::placeholder {
          color: #ffffff88 !important;
        }
      `}</style>
    </div>
  );
}

export default PostPage;