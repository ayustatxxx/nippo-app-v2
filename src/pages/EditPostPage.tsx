// EditPostPage.tsx - セキュリティ強化版
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import Header from '../components/Header';
import MainFooterNav from '../components/MainFooterNav';
import { DBUtil, STORES } from "../utils/dbUtil";
import { Post } from '../types';
import { FileValidator, useFileValidation } from '../utils/fileValidation'; // 新しく追加
import UnifiedCoreSystem from "../core/UnifiedCoreSystem";
import { invalidateArchiveCache } from '../group/ArchivePage'; 


const EditPostPage: React.FC = () => {
  const { postId } = useParams<{ postId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'local' | 'online' | 'completed'>('idle');
  
  // 編集用の状態
  const [editedMessage, setEditedMessage] = useState('');
  // 時刻編集用の状態
const [startTime, setStartTime] = useState<string>('');
const [endTime, setEndTime] = useState<string>('');
const [hasCheckOut, setHasCheckOut] = useState(false);
const [workDate, setWorkDate] = useState<string>('');
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
  
  // ユーザーIDを取得
  const userId = localStorage.getItem("daily-report-user-id");
  if (!userId) {
    setError("ユーザー認証が必要です");
    setLoading(false);
    return;
  }

  const dbUtil = DBUtil.getInstance();
  await dbUtil.initDB();
  
  // UnifiedCoreSystemから投稿データを取得（1回のみ）
  const postData = await UnifiedCoreSystem.getPost(postId, userId);
  
  if (postData) {
    try {
      const group = await dbUtil.get(STORES.GROUPS, postData.groupId) as any;
      if (group) {
        postData.groupName = group.name;
      }
    } catch (groupError) {
      console.error('グループ情報の取得に失敗:', groupError);
    }

    // 🔍 デバッグ
  console.log('🔍 [EditPage 初期化] 投稿データ取得:');
  console.log('  - 投稿ID:', postData.id);
  console.log('  - photoUrls:', postData.photoUrls);
  console.log('  - photoUrls枚数:', postData.photoUrls?.length || 0);
    
 // ✅ Firestoreの値をそのまま保持（編集ページを開いただけでは変更しない）
setPost(postData);

// 🆕 メッセージから時刻を抽出
const messageText = postData.message || '';

// 新フォーマット: "開始: 23:31 ー 終了: 23:31"
const newFormatMatch = messageText.match(/開始:\s*(\d{2}:\d{2})\s*ー\s*終了:\s*(\d{2}:\d{2})/);
// 旧フォーマット: "作業開始: 23:31" "作業終了: 23:31"
const oldStartMatch = messageText.match(/作業開始:\s*(\d{2}:\d{2})/);
const oldEndMatch = messageText.match(/作業終了:\s*(\d{2}:\d{2})/);
// チェックインのみ: "開始: 23:31"
const startOnlyMatch = messageText.match(/^開始:\s*(\d{2}:\d{2})/m);

if (newFormatMatch) {
  setStartTime(newFormatMatch[1]);
  setEndTime(newFormatMatch[2]);
  setHasCheckOut(true);
} else if (oldStartMatch) {
  setStartTime(oldStartMatch[1]);
  if (oldEndMatch) {
    setEndTime(oldEndMatch[1]);
    setHasCheckOut(true);
  }
} else if (startOnlyMatch) {
  setStartTime(startOnlyMatch[1]);
}

// 🆕 日付を抽出（新フォーマット: "開始日:" または 旧フォーマット: "日付:"）
const newDateMatch = messageText.match(/開始日:\s*(.+?)(?:\n|$)/);
const oldDateMatch = messageText.match(/日付:\s*(.+?)(?:\n|$)/);
const dateMatch = newDateMatch || oldDateMatch;

if (dateMatch) {
  // "2025 / 11 / 20 (木)" → "2025-11-20" に変換
  const dateStr = dateMatch[1].replace(/ ?\(.+?\)/g, '').replace(/（.+?）/g, '').trim();

  // 🆕 デバッグログを追加
console.log('🔍🔍🔍 [EditPost-日付抽出]');
console.log('- dateMatch[1]:', dateMatch[1]);
console.log('- dateStr:', dateStr);
console.log('- NaNが含まれているか:', dateStr.includes('NaN'));
console.log('- undefinedが含まれているか:', dateStr.includes('undefined'));
  
  // 🆕 NaN チェックを追加
  if (dateStr.includes('NaN') || dateStr.includes('undefined')) {
    // 日付がNaNの場合は今日の日付を設定
    const today = new Date().toISOString().split('T')[0];
    setWorkDate(today);
  } else {
    const normalizedDate = dateStr.replace(/\s*\/\s*/g, '-');
    setWorkDate(normalizedDate);

    // 🆕 デバッグログを追加
console.log('🔍🔍🔍 [EditPost-normalizedDate]');
console.log('- normalizedDate:', normalizedDate);
console.log('- workDate state:', workDate);
  }
} else {
  // 日付がない場合は今日の日付を設定
  const today = new Date().toISOString().split('T')[0];
  setWorkDate(today);
}

// 🆕 メッセージから時刻部分を削除して表示
const messageWithoutTime = messageText
  .replace(/開始:\s*\d{2}:\d{2}\s*ー\s*終了:\s*\d{2}:\d{2}\n?/g, '')
  .replace(/開始:\s*\d{2}:\d{2}\n?/g, '')
  .replace(/作業開始:\s*\d{2}:\d{2}\n?/g, '')
  .replace(/作業終了:\s*\d{2}:\d{2}\n?/g, '')
  .replace(/日付:[^\n]+\n?/g, '')
  .replace(/開始日:[^\n]+\n?/g, '')
  .replace(/■\s*作業時間:[^\n]+\n?/g, '')
  .replace(/─+/g, '')  // ← 追加：区切り線を削除
  .replace(/^\s*作業\s*$/gm, '')  // ← 追加：単独の「作業」を削除
  .trim();

setEditedMessage(messageWithoutTime);
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
}, [editedPhotos]);
  
  // 変更検知
  useEffect(() => {
  if (!post) return;
  
  const messageChanged = editedMessage !== (post.message || '');
  const tagsChanged = JSON.stringify(editedTags) !== JSON.stringify(post.tags || []);
  const photosChanged = newPhotoUrls.length > 0 || deletedPhotoUrls.length > 0;
  
  // 🆕 時刻の変更も検知
  const messageText = post.message || '';
// 新旧フォーマット両方に対応
const newFormatMatch = messageText.match(/開始:\s*(\d{2}:\d{2})\s*ー\s*終了:\s*(\d{2}:\d{2})/);
const originalStartTime = newFormatMatch?.[1] || messageText.match(/作業開始:\s*(\d{2}:\d{2})/)?.[1] || '';
const originalEndTime = newFormatMatch?.[2] || messageText.match(/作業終了:\s*(\d{2}:\d{2})/)?.[1] || '';
const originalDate = messageText.match(/開始日:\s*(.+?)(?:\n|$)/)?.[1] || messageText.match(/日付:\s*(.+?)(?:\n|$)/)?.[1] || '';
const timeChanged = startTime !== originalStartTime || endTime !== originalEndTime || workDate !== originalDate;
  
  setHasChanges(messageChanged || tagsChanged || photosChanged || timeChanged);
}, [editedMessage, editedTags, newPhotoUrls, deletedPhotoUrls, post, startTime, endTime, workDate]);
  
  // 🔒 セキュリティ強化: 入力値サニタイゼーション
  const sanitizeInput = (input: string): string => {
    return input
      .replace(/[<>]/g, '') // HTMLタグを除去
      .replace(/javascript:/gi, '') // JavaScriptスキームを除去
      .replace(/on\\w+=/gi, '') // イベントハンドラを除去
      .trim();
  };

  // 🆕 メッセージから時刻情報を削除する関数
const removeTimeFromMessage = (message: string): string => {
 return message
  .replace(/作業開始:\s*\d{2}:\d{2}\n?/g, '')
  .replace(/作業終了:\s*\d{2}:\d{2}\n?/g, '')
  .replace(/日付:[^\n]+\n?/g, '') // ← この行を追加！
  .trim();
};

// 🆕 作業時間を計算する関数
const calculateWorkDuration = (startTime: string, endTime: string): { duration: string; isValid: boolean; errorMessage?: string } => {
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);
  
  let totalMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);
  
  // 🆕 終了時刻 < 開始時刻 → 日をまたいだと判断
  if (totalMinutes < 0) {
    totalMinutes += 24 * 60; // +24時間
  }
  
  // 🆕 23時間59分（1439分）を超える場合はエラー
  if (totalMinutes >= 24 * 60) { // 1440分以上
    return {
      duration: '',
      isValid: false,
      errorMessage: '⚠️ 作業時間は23時間59分以内で入力してください'
    };
  }
  
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  
  return {
    duration: `${hours}時間${minutes}分`,
    isValid: true
  };
};

// 🆕 日付を日本語形式に変換する関数
const formatDateToJapanese = (dateStr: string): string => {
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
  const weekday = weekdays[date.getDay()];
  
  return `${year} / ${month} / ${day} (${weekday})`;
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
      
  // 🔍 デバッグ
  console.log('🔍 [EditPage handleSave開始] post state確認:');
console.log('  - post:', post);
console.log('  - post.photoUrls:', post.photoUrls);
console.log('  - post.photoUrls枚数:', post.photoUrls?.length || 0);
console.log('  - post.isEdited:', post.isEdited);  // ← 追加
console.log('  - post.isManuallyEdited:', post.isManuallyEdited);  // ← 追加

    console.log('💾 [EditPostPage] 保存開始:', {
  postId: post.id,
  tags: editedTags,
  hasチェックイン: editedTags?.includes('#チェックイン'),
  hasチェックアウト: editedTags?.includes('#チェックアウト'),
  現在時刻: new Date().toISOString()
});
    
  try {
  setSaving(true);
  setSyncStatus('local'); // この行を追加
  clearErrors();

      
      // 新しい写真をBase64に変換（安全な処理）
let additionalPhotoUrls: string[] = [];
if (editedPhotos && editedPhotos.length > 0) {
  console.log('🔍 [EditPage] 新規画像処理開始:', editedPhotos.length, '枚');
  
  const result = await validateAndProcess(editedPhotos);
  
  if (result.errors.length > 0) {
    alert(`ファイルエラー:\n${result.errors.join('\n')}`);
    return;
  }
  
  if (result.validFiles.length > 0) {
    try {
      additionalPhotoUrls = await Promise.all(
        result.validFiles.map(file => FileValidator.convertToBase64(file))
      );
      
      // ✨ 既存写真と新規写真を合わせた合計サイズチェック
      const remainingPhotos = post.photoUrls.filter(url => !deletedPhotoUrls.includes(url));

      // 🔍 デバッグ
console.log('🔍 [EditPage 保存直前] 画像状態確認:');
console.log('  - post.photoUrls:', post.photoUrls);
console.log('  - post.photoUrls枚数:', post.photoUrls?.length || 0);
console.log('  - deletedPhotoUrls:', deletedPhotoUrls);
console.log('  - remainingPhotos:', remainingPhotos);
console.log('  - remainingPhotos枚数:', remainingPhotos.length);
console.log('  - additionalPhotoUrls枚数:', additionalPhotoUrls.length);

      const allPhotos = [...remainingPhotos, ...additionalPhotoUrls];
      
      const sizeCheck = FileValidator.checkCompressedTotalSize(allPhotos, result.validFiles);
      if (!sizeCheck.isValid) {
        alert(sizeCheck.error);
        console.error('❌ [EditPage] 圧縮後のサイズチェックエラー:', sizeCheck.totalSizeMB, 'MB');
        return;
      }
      
      console.log('✅ [EditPage] Base64変換完了:', additionalPhotoUrls.length, '枚');
      console.log(`✅ 合計サイズ: ${sizeCheck.totalSizeMB}MB（既存${remainingPhotos.length}枚 + 新規${additionalPhotoUrls.length}枚）`);
      
      // セキュリティログ
      FileValidator.logSecurityEvent('files_uploaded', {
        fileCount: result.validFiles.length,
        totalSize: result.totalSize,
        totalCompressedSize: sizeCheck.totalSizeMB * 1024 * 1024,
        totalCompressedSizeMB: sizeCheck.totalSizeMB,
        existingPhotos: remainingPhotos.length,
        newPhotos: additionalPhotoUrls.length,
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

console.log('📊 [EditPage] 画像枚数デバッグ:');
console.log('  - 元の画像:', post.photoUrls.length, '枚');
console.log('  - 削除した画像:', deletedPhotoUrls.length, '枚');
console.log('  - 残りの画像:', remainingPhotos.length, '枚');
console.log('  - 新規画像(Base64):', additionalPhotoUrls.length, '枚');
console.log('  - 新規画像(File):', editedPhotos ? editedPhotos.length : 0, '枚');


// 🆕 時刻入力欄の値でメッセージを再構築
let timePrefix = '';

// チェックイン・チェックアウト情報
if (startTime && hasCheckOut && endTime) {
  timePrefix += `開始: ${startTime} ー 終了: ${endTime}\n`;
} else if (startTime) {
  timePrefix += `開始: ${startTime}\n`;
}

// 🆕 作業時間を計算して追加（チェックアウト済みの場合のみ）
if (hasCheckOut && startTime && endTime) {
  const result = calculateWorkDuration(startTime, endTime);
  
  if (!result.isValid) {
    // エラーがある場合は保存前にアラート表示
    alert(result.errorMessage);
    return; // ここでreturnして保存を中止
  }
  
  timePrefix += `─────────────────\n■ 作業時間: ${result.duration}\n─────────────────\n`;
}

// 📆 開始日を追加
// 🔧 FIX: useState は非同期なので、直接計算した値を使う
let formattedDate: string;

// メッセージから日付を再抽出
const newDateMatch = editedMessage.match(/開始日:\s*(.+?)(?:\n|$)/);
const oldDateMatch = editedMessage.match(/日付:\s*(.+?)(?:\n|$)/);
const currentDateMatch = newDateMatch || oldDateMatch;

if (currentDateMatch) {
  // 日付文字列から曜日を削除して正規化
  const dateStrClean = currentDateMatch[1].replace(/ ?\(.+?\)/g, '').replace(/（.+?）/g, '').trim();
  const finalWorkDate = dateStrClean.replace(/\s*\/\s*/g, '-');
  formattedDate = formatDateToJapanese(finalWorkDate);
  
  // 🆕 デバッグログを追加
  console.log('🔍🔍🔍 [EditPost-formatDateToJapanese]');
  console.log('- finalWorkDate:', finalWorkDate);
  console.log('- formattedDate結果:', formattedDate);
} else {
  // 日付がない場合は今日の日付を使用
  const today = new Date().toISOString().split('T')[0];
  formattedDate = formatDateToJapanese(today);
}

timePrefix += `日付: ${formattedDate}\n`;
console.log('🔍🔍🔍 [EditPost] timePrefix:', timePrefix);
console.log('🔍 formattedDate:', formattedDate);

// メッセージから既存の時刻情報を削除
const cleanMessage = editedMessage
  .replace(/開始:\s*\d{2}:\d{2}\s*ー\s*終了:\s*\d{2}:\d{2}\n?/g, '')
  .replace(/開始:\s*\d{2}:\d{2}\n?/g, '')
  .replace(/作業開始:\s*\d{2}:\d{2}\n?/g, '')
  .replace(/作業終了:\s*\d{2}:\d{2}\n?/g, '')
  .replace(/日付:[^\n]+\n?/g, '')
  .replace(/開始日:[^\n]+\n?/g, '')
  .replace(/■\s*作業時間:[^\n]+\n?/g, '')
  .replace(/─+/g, '')  // ← 追加：区切り線を削除
  .replace(/^\s*作業\s*$/gm, '')  // ← 追加：単独の「作業」を削除
  .trim();

// 時刻 + 作業時間 + 開始日 + メッセージの順で結合
const reconstructedMessage = timePrefix + (cleanMessage ? `\n${cleanMessage}` : '');
console.log('🔍🔍🔍 [EditPost] reconstructedMessage:');
console.log(reconstructedMessage);
console.log('🔍 日付が含まれているか:', reconstructedMessage.includes('日付:'));

const sanitizedMessage = sanitizeInput(reconstructedMessage).substring(0, 5000);
const validTags = editedTags.filter(tag => tag.length <= 50);

// 更新されたデータ
const updatedPost: Post = {
  ...post,
  message: sanitizedMessage,
  tags: validTags,
  photoUrls: [...remainingPhotos, ...additionalPhotoUrls],  // ← 既存+新規
  updatedAt: Date.now(),
  isEdited: true,
  isManuallyEdited: true
};

console.log('🔍 [EditPage] updatedPost作成完了:');
console.log('  - isEdited:', updatedPost.isEdited);
console.log('  - isManuallyEdited:', updatedPost.isManuallyEdited);
console.log('  - photoUrls枚数:', updatedPost.photoUrls.length);
console.log('📦 [EditPage] IndexedDB保存データ:');
console.log('  - photoUrls枚数:', updatedPost.photoUrls.length);
console.log('  - photoUrls:', updatedPost.photoUrls);

// データベースに保存
const dbUtil = DBUtil.getInstance();
await dbUtil.initDB();
await dbUtil.save(STORES.POSTS, updatedPost);

console.log('✅ [EditPage] IndexedDB保存完了');

// ハイブリッド同期に状態表示を追加
setSyncStatus('online');
try {
  const updateData = {
  message: sanitizedMessage,
  tags: validTags,
  photoUrls: [...remainingPhotos, ...additionalPhotoUrls],  
  isManuallyEdited: true,
  updatedAt: Date.now()  // ← この行を追加
};

  console.log('🔍 [EditPage] updateData作成完了:');
  console.log('  - isManuallyEdited:', updateData.isManuallyEdited);
  console.log('  - photoUrls枚数:', updateData.photoUrls.length);
  console.log('📡 [EditPage] UnifiedCoreSystem.updatePost呼び出し:');
  console.log('  - photoUrls枚数:', updateData.photoUrls.length);
  
  await UnifiedCoreSystem.updatePost(post.id, updateData);
  
  console.log('✅ EditPage: 投稿更新完了');
  setSyncStatus('completed');

  // キャッシュをクリアして最新データを表示
  if (post.groupId) {  // ✅ post.groupIdを使う
    invalidateArchiveCache(post.groupId);
    console.log('🗑️ [EditPage] ArchivePageのキャッシュをクリア');
  }

const userId = localStorage.getItem("daily-report-user-id");
if (userId) {
  console.log('🔍 [EditPage] 最新データ取得開始...');
  const updatedPostData = await UnifiedCoreSystem.getPost(post.id, userId);
  if (updatedPostData) {
    console.log('🔄 [EditPage] 最新データを取得:', updatedPostData.photoUrls.length, '枚');
    console.log('🔍 [EditPage] 取得した画像URL:');
    updatedPostData.photoUrls.forEach((url, index) => {
      console.log(`  ${index + 1}. ${url.substring(0, 50)}...`);
    });
    
    // ⭐ 修正：isManuallyEdited を保持
setPost({
  ...updatedPostData,
  isManuallyEdited: true  // ← 「編集済み」スタンプを必ず付ける！
});
    setEditedMessage(updatedPostData.message || '');
    setEditedTags(updatedPostData.tags || []);
    setDeletedPhotoUrls([]);
    setEditedPhotos(null);
  } else {
    console.error('❌ [EditPage] 最新データの取得に失敗');
  }
}
} catch (syncError) {
  console.warn('⚠️ EditPage: 投稿更新失敗（ローカル保存は完了）:', syncError);
  setSyncStatus('completed');
}

// UnifiedCoreSystemの更新通知を追加
try {
  const updateFlag = Date.now().toString();
  localStorage.setItem('daily-report-posts-updated', updateFlag);
  window.dispatchEvent(new CustomEvent('postsUpdated', {
  detail: {
    updatedPost: updatedPost,
    timestamp: Date.now(),
    source: 'EditPostPage',
    action: 'update',
    isManuallyEdited: true  // ← この1行を追加!
  }
}));
  console.log('✅ EditPage: 統合システムに更新通知完了');
} catch (error) {
  console.error('❌ EditPage: 更新通知エラー:', error);
}

alert('✅ 投稿を更新しました!');


// 常に詳細ページに戻る
const from = searchParams.get('from');
const groupId = searchParams.get('groupId');

const params = new URLSearchParams();
if (from) params.set('from', from);
if (groupId) params.set('groupId', groupId);
const paramString = params.toString() ? `?${params.toString()}` : '';

console.log('💾 [EditPostPage] 保存完了・ナビゲーション開始:', {
  postId: post.id,
  保存後のtags: updatedPost.tags,
  hasチェックイン: updatedPost.tags?.includes('#チェックイン'),
  hasチェックアウト: updatedPost.tags?.includes('#チェックアウト'),
  戻り先: from || 'post詳細',
  現在時刻: new Date().toISOString()
});

// メモリキャッシュをクリアして最新データを表示
sessionStorage.removeItem('archive_posts_cache');
sessionStorage.removeItem('archive_last_updated');
console.log('🗑️ [EditPage] メモリキャッシュをクリア（最新データを表示するため）');

// 保存完了後、元のページに戻りモーダルを開く
if (from === 'archive' && groupId) {
  navigate(`/group/${groupId}/archive${paramString}`, {
    state: { openPostDetail: postId }
  });
} else {
  // Homeから来た場合
  navigate('/', {
    state: { openPostDetail: postId }
  });
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

      // UnifiedCoreSystemの削除通知を追加
try {
  const updateFlag = Date.now().toString();
  localStorage.setItem('daily-report-posts-updated', updateFlag);
  window.dispatchEvent(new CustomEvent('postsUpdated', {
    detail: {
      deletedPostId: post.id, 
      timestamp: Date.now(),
      source: 'EditPostPage',
      action: 'delete'
    }
  }));
  console.log('✅ EditPage: 削除通知完了');
} catch (error) {
  console.error('❌ EditPage: 削除通知エラー:', error);
}
      
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
        
        // 保存完了後、元のページに戻りモーダルを開く
if (from === 'archive' && groupId) {
  navigate(`/group/${groupId}/archive${paramString}`, {
    state: { openPostDetail: postId },
    replace: true
  });
} else {
  // Homeから来た場合
  navigate('/', {
    state: { openPostDetail: postId },
    replace: true
  });
}
      }
    } else {
      const from = searchParams.get('from');
      const groupId = searchParams.get('groupId');
      
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (groupId) params.set('groupId', groupId);
      const paramString = params.toString() ? `?${params.toString()}` : '';
      
      // 保存完了後、元のページに戻りモーダルを開く
if (from === 'archive' && groupId) {
  navigate(`/group/${groupId}/archive${paramString}`, {
    state: { openPostDetail: postId },
    replace: true
  });
} else {
  // Homeから来た場合
  navigate('/', {
    state: { openPostDetail: postId },
    replace: true
  });
}
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



         {/* 🆕 時刻編集 */}
{editedTags.includes('#出退勤時間') && (
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
      fontWeight: '600',
      fontSize: '0.95rem'
    }}>
      ■ 時刻の編集
    </label>
    
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '0.75rem'
    }}>
      {/* 開始時刻 */}
      <div>
        <label style={{
          display: 'block',
          marginBottom: '0.25rem',
          color: '#666',
          fontSize: '0.9rem'
        }}>
          開始時刻
        </label>
        <input
          type="time"
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
          style={{
            width: '100%',
            padding: '0.75rem',
            border: '2px solid #E6EDED',
            borderRadius: '8px',
            fontSize: '1rem',
            fontFamily: 'inherit',
            boxSizing: 'border-box'
          }}
        />
      </div>
      
      {/* 終了時刻（チェックアウト済みの場合のみ） */}
      {hasCheckOut && (
        <div>
          <label style={{
            display: 'block',
            marginBottom: '0.25rem',
            color: '#666',
            fontSize: '0.9rem'
          }}>
            終了時刻
          </label>
          <input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '2px solid #E6EDED',
              borderRadius: '8px',
              fontSize: '1rem',
              fontFamily: 'inherit',
              boxSizing: 'border-box'
            }}
          />
          
        </div>
      )}
    </div>
  </div>
)}

        {/* 🆕 日付編集 */}
{editedTags.includes('#出退勤時間') && (
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
      fontWeight: '600',
      fontSize: '0.95rem'
    }}>
      ■ 開始日（変更不可）
    </label>
    
    <div>
      <label style={{
        display: 'block',
        marginBottom: '0.25rem',
        color: '#666',
        fontSize: '0.9rem'
      }}>
        開始日
      </label>
      <input
  type="date"
  value={workDate}
  disabled
  style={{
    width: '100%',
    padding: '0.75rem',
    border: '2px solid #E6EDED',
    borderRadius: '8px',
    fontSize: '1rem',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
    backgroundColor: '#f5f5f5',
    color: '#666',
    cursor: 'not-allowed'
  }}
/>
      <div style={{
          fontSize: '0.8rem',
          color: '#999',
          marginTop: '0.5rem',
          lineHeight: '1.4'
        }}>
          ℹ️ 開始日はチェックイン時に自動記録され、変更できません。
        </div>
    </div>
  </div>
)}
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
            新しい写真を追加 (最大10枚、各7MB以下)
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
            対応形式: JPEG, PNG, GIF, WebP 
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
                   {syncStatus === 'local' && 'ローカル保存中...'}
    {syncStatus === 'online' && 'クラウド同期中...'}
    {syncStatus === 'completed' && '保存完了!'}
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