import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import MainFooterNav from '../components/MainFooterNav';
import { getCurrentUser, isAdmin ,canManageGroup, hasAnyManagedGroups, isUserMemberOfGroup } from "../utils/authUtil";
import { getGroups, createGroupWithFirestore, updateGroupWithFirestore } from "../utils/firestoreService";
import Header from '../components/Header';
import { Group, User, UserRole, ReportFrequency } from '../types';
import { canCreateGroup } from "../utils/authUtil";



const GroupListPage: React.FC = () => {
// 状態変数の定義
const [groups, setGroups] = useState<Group[]>([]);
const [loading, setLoading] = useState(true);
const [currentUser, setCurrentUser] = useState<User | null>(null);
const [isUserAdmin, setIsUserAdmin] = useState(false);
const [showCreateForm, setShowCreateForm] = useState(false);

// グループ作成フォーム用の状態を追加
const [newGroupName, setNewGroupName] = useState('');
const [newGroupDescription, setNewGroupDescription] = useState('');
const [newGroupAddress, setNewGroupAddress] = useState(''); // 現場住所
const [reportDeadline, setReportDeadline] = useState('18:00');
const [reportFrequency, setReportFrequency] = useState<'daily' | 'weekly' | 'monthly' | 'custom'>('daily');
const [customDays, setCustomDays] = useState(7); // カスタム設定の場合の日数
const [isSubmitting, setIsSubmitting] = useState(false);
const [formError, setFormError] = useState('');


// 編集モード用の状態変数を追加の下に以下を追加
const [showPermanentDeleteMode, setShowPermanentDeleteMode] = useState(false); // 完全削除モード
const [selectedDeleteGroups, setSelectedDeleteGroups] = useState<Set<string>>(new Set()); // 選択された削除対象グループ


// 編集モード用の状態変数を追加
const [isGroupEditMode, setIsGroupEditMode] = useState(false); // グループ編集モード
const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null); // 選択されたグループ
const [editingGroupId, setEditingGroupId] = useState<string | null>(null); // 編集中のグループ
const [showTrashMode, setShowTrashMode] = useState(false); // ゴミ箱表示モード
const [showFilter, setShowFilter] = useState(false); // フィルター表示モード（追加）

// 動的な高さを計算
const filterBackgroundHeight = '400px';
const contentPaddingTop = '400px';
  
  
  const navigate = useNavigate();
  
  // コンポーネントがマウントされた時にデータを読み込む
  useEffect(() => {
    // ★ ページロード時にスクロール位置を一番上にリセット ★
    window.scrollTo(0, 0);
    
    const loadData = async () => {
      try {
        console.log("【デバッグ】グループページデータロード開始");
        
        // 強制的に管理者権限を設定（テスト用）
        // console.log("【デバッグ】管理者権限を強制的に設定します");
        // setIsUserAdmin(true); // この行を削除
        
        // ユーザー情報のログ表示
        const storageUserId = localStorage.getItem("daily-report-user-id");
        const storageUsername = localStorage.getItem("daily-report-username");
        console.log("【デバッグ】ストレージ情報:", { 
          userId: storageUserId, 
          username: storageUsername 
        });
        
        // 現在のユーザー情報を取得
try {
  const user = await getCurrentUser();
  console.log("【デバッグ】現在のユーザー:", user);
  
  // ユーザー情報が取得できない場合、ダミーユーザーを設定
  if (!user) {
    console.log("【デバッグ】ユーザー情報がないため、ダミーユーザーを設定");
    const dummyUser = {
      id: localStorage.getItem("daily-report-user-id") || "j94Ngq4aM8aShquxHwhRkiWaIbZ2",
      email: localStorage.getItem("daily-report-user-email") || "info@ayustat.co.jp",
      username: localStorage.getItem("daily-report-username") || "ayustat",
      role: "admin" as const,
      active: true,
      profileImage: '',
      company: '',
      position: '',
      phone: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      settings: {
        notifications: true,
        reportFrequency: 'daily' as ReportFrequency
      }
    };
    setCurrentUser(dummyUser);
    console.log("【デバッグ】ダミーユーザーを設定:", dummyUser);
  } else {
    setCurrentUser(user);
  }
  
  // 管理者かどうかを確認
  const canCreate = await canCreateGroup();
  console.log("【デバッグ】グループ作成権限:", canCreate);
  setIsUserAdmin(canCreate);
} catch (err) {
  console.error("【デバッグ】ユーザー取得エラー:", err);
  
  // エラーの場合もダミーユーザーを設定
  const dummyUser = {
    id: localStorage.getItem("daily-report-user-id") || "j94Ngq4aM8aShquxHwhRkiWaIbZ2",
    email: localStorage.getItem("daily-report-user-email") || "info@ayustat.co.jp",
    username: localStorage.getItem("daily-report-username") || "ayustat",
    role: "user" as const, // "admin"から"user"に変更
    active: true,
    profileImage: '',
    company: '',
    position: '',
    phone: '',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    settings: {
  notifications: true,
  reportFrequency: 'daily' as ReportFrequency,
  theme: 'light' as 'light' | 'dark'
}
  };
  setCurrentUser(dummyUser);
  // setIsUserAdmin(true); // 強制設定を削除
  console.log("【デバッグ】エラー時ダミーユーザーを設定:", dummyUser);
}


// 実際のグループを取得
try {
  const user = currentUser || {
    id: localStorage.getItem("daily-report-user-id") || "j94Ngq4aM8aShquxHwhRkiWaIbZ2",
    role: "admin" as const
  };
  
// 実際の権限状態を確認して適切なroleを渡す
const adminStatus = await isAdmin();
console.log('🔍 管理者判定:', adminStatus, 'ユーザーID:', user.id);
setIsUserAdmin(adminStatus);
const actualRole = adminStatus ? "admin" : "user";
const realGroups = await getGroups(user.id, actualRole);
console.log("【デバッグ】実際のグループを取得:", realGroups.length, "件");

// 🔧 追加：作成日時順でソート（新しい順）
const sortedGroups = realGroups.sort((a, b) => {
  // createdAt がある場合はそれを使用、なければ現在時刻
  const timeA = a.createdAt || Date.now();
  const timeB = b.createdAt || Date.now();
  
  return timeB - timeA; // 新しい順（降順）
});

console.log("【デバッグ】ソート後のグループ順:", sortedGroups.map(g => ({
  name: g.name,
  createdAt: g.createdAt ? new Date(g.createdAt).toLocaleString() : 'なし'
})));

setGroups(sortedGroups);
} catch (error) {
  console.error("【デバッグ】グループ取得エラー:", error);
  // エラーの場合は空のリストを設定
  setGroups([]);
}

        
      } catch (error) {
        console.error('【デバッグ】データロードエラー:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, []);

  
// グループを作成する関数
// Firestore対応版のhandleCreateGroup関数
const handleCreateGroup = async () => {
  console.log(editingGroupId ? "【デバッグ】グループ編集処理を開始します" : "【デバッグ】Firestoreグループ作成処理を開始します");
  
   // 権限チェック追加
   const canCreate = await canCreateGroup();
   if (!canCreate) {
     setFormError('グループを作成する権限がありません');
     return;
   }
   
   console.log("【デバッグ】グループ作成開始");

   
  // 入力バリデーション
  if (!newGroupName.trim()) {
    setFormError('グループ名を入力してください');
    return;
  }
  
  // ユーザー情報の確認（より柔軟に）
  // ユーザー情報の確認（より柔軟に）の部分を以下に置き換え
let user = currentUser;
if (!user || !user.id) {
  console.log("【デバッグ】currentUserがnullまたはIDがないため、ローカルストレージから取得");
  const userId = localStorage.getItem("daily-report-user-id") || "j94Ngq4aM8aShquxHwhRkiWaIbZ2";
  const userEmail = localStorage.getItem("daily-report-user-email") || "info@ayustat.co.jp";
  const userName = localStorage.getItem("daily-report-username") || "ayustat";
  
  user = {
    id: userId,
    email: userEmail,
    username: userName,
    role: "admin" as const,
    active: true,
    profileImage: '',
    company: '',
    position: '',
    phone: '',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    settings: {
      notifications: true,
      reportFrequency: 'daily' as ReportFrequency,
      theme: 'light' as 'light' | 'dark'
    }
  };
  console.log("【デバッグ】構築したユーザー情報:", user);
}
  
  setIsSubmitting(true);
  setFormError('');
  
  try {
    console.log('🔥 Firestoreでグループを作成中...', newGroupName);
    console.log('👤 使用するユーザー情報:', user);
    

// グループデータを準備の部分で、adminIdの設定を修正
const groupData = {
  name: newGroupName.trim(),
  description: newGroupDescription.trim(),
  adminId: user?.id || localStorage.getItem("daily-report-user-id") || "j94Ngq4aM8aShquxHwhRkiWaIbZ2",
  members: [{
  id: user?.id || localStorage.getItem("daily-report-user-id") || "j94Ngq4aM8aShquxHwhRkiWaIbZ2",
  role: 'admin',
  isAdmin: true,
  joinedAt: Date.now(),
  email: user?.email || '',
  username: user?.username || 'Admin'
}],
  inviteCode: `INV_${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
  settings: {
    reportDeadline: reportDeadline,
    reportFrequency: reportFrequency,
    allowMemberInvite: false,
    autoArchive: false,
    location: newGroupAddress.trim() ? {
      address: newGroupAddress.trim(),
      coordinates: { lat: 0, lng: 0 } // 後でGoogleMaps APIで取得可能
    } : undefined
  }
};

console.log("【デバッグ】作成するグループデータ:", groupData);
console.log("【デバッグ】adminId確認:", groupData.adminId);

if (editingGroupId) {
  // 編集モードの場合：既存グループを更新
  console.log('🔄 グループを更新中...', newGroupName);
  
  // データベースに保存するデータを準備
  const updateData = {
    name: newGroupName.trim(),
    description: newGroupDescription.trim(),
    address: newGroupAddress.trim(),
    settings: {
      reportDeadline: reportDeadline,
      reportFrequency: reportFrequency,  // ← この行を追加
      location: newGroupAddress.trim() ? {
        address: newGroupAddress.trim(),
        coordinates: { lat: 0, lng: 0 }
      } : undefined,
      reportSettings: {
        frequency: reportFrequency,
        customDays: customDays
      }
    }
  };
  
  // データベースに保存
  await updateGroupWithFirestore(editingGroupId, updateData);
  
  // 保存成功後にUIを更新
  setGroups(prevGroups => 
    prevGroups.map(group => 
      group.id === editingGroupId 
        ? { ...group, ...updateData }
        : group
    )
  );
  
  alert(`グループ「${newGroupName}」を更新しました！`);
}   
 else {
  // 新規作成モードの場合：新しいグループを作成
  const groupId = await createGroupWithFirestore(groupData);
  
  console.log('✅ Firestoreグループ作成完了:', groupId);
  
  // 成功メッセージを表示
  alert(`グループ「${newGroupName}」を作成しました！`);
}
    
   // フォームをリセット（編集・新規作成共通）
   setNewGroupName('');
   setNewGroupDescription('');
   setNewGroupAddress('');
   setReportDeadline('18:00');
   setReportFrequency('daily');
   setCustomDays(7);
   setShowCreateForm(false);
   setEditingGroupId(null);
   
   // 新規作成の場合のみグループ一覧を再読み込み
   if (!editingGroupId && user && user.id) {
     try {
      const updatedGroups = await getGroups(user.id, user.role);

      // 🔧 追加：ここでもソート
      const sortedUpdatedGroups = updatedGroups.sort((a, b) => {
        const timeA = a.createdAt || Date.now();
        const timeB = b.createdAt || Date.now();
        return timeB - timeA; // 新しい順
      });
      
      setGroups(sortedUpdatedGroups);
      console.log("【デバッグ】グループ一覧を更新しました:", sortedUpdatedGroups.length, "件");
     } catch (error) {
       console.error("【デバッグ】グループ一覧更新エラー:", error);
       window.location.reload();
     }
   }
   
 } catch (error) {
   console.error('❌ グループ処理エラー:', error);
   setFormError(editingGroupId ? 'グループの更新に失敗しました。' : 'グループの作成に失敗しました。もう一度お試しください。');
 } finally {
   setIsSubmitting(false);
 }
};


return (
    <div
      style={{
        minHeight: '100vh',
        background: '#ffffff', // 背景を白に変更,
        padding: '1.5rem',
        boxSizing: 'border-box',
        paddingBottom: '80px', // フッター分の余白
      }}
    >

{/* ヘッダー - ゴミ箱モード時は専用ヘッダー */}
{showTrashMode ? (
  <Header 
  title="ゴミ箱"
    showBackButton={true}
    onBackClick={() => {
      setShowTrashMode(false);
      setShowPermanentDeleteMode(false);
      setSelectedDeleteGroups(new Set());
    }}
  />
) : (
  <Header 
    title="NIPPO" 
    showBackButton={false}
  />
)}

      {/* メインコンテンツを包むdiv - 固定ヘッダーのためのパディングを追加 */}
      <div style={{ 
  maxWidth: '480px', 
  margin: '0 auto',
  paddingTop: showTrashMode ? '70px' : (showFilter ? contentPaddingTop : '70px'),
}}>
        <div
  style={{
    marginTop: '0.2rem',
    marginBottom: '1rem',
    justifyContent: 'space-between',
    alignItems: 'center',
    display: showTrashMode ? 'none' : 'flex'
  }}
>
  <h2 style={{ fontSize: '2rem', letterSpacing: '0.01em', color: '#055A68', margin: 0 }}>
    Group
  </h2>
  
  {/* ゴミ箱アイコン - 管理者の場合のみ表示 */}
  {(isUserAdmin || hasAnyManagedGroups(currentUser?.id || '', groups)) && !showCreateForm && (
  <button
    onClick={() => {
      setShowTrashMode(!showTrashMode);
      setIsGroupEditMode(false);
      setSelectedGroupId(null);
    }}
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '40px',
      height: '40px',
      backgroundColor: 'transparent',
      color: '#6b7280',
      border: 'none',
      borderRadius: '8px',
      cursor: 'pointer',
      padding: '0'
    }}
    title="ゴミ箱を表示"
  >
      <svg 
        width="22" 
        height="22" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor"
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      >
        <polyline points="3,6 5,6 21,6" />
        <path d="M19,6V20a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6M8,6V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2V6" />
        <line x1="10" y1="11" x2="10" y2="17" />
        <line x1="14" y1="11" x2="14" y2="17" />
      </svg>
    </button>
  )}
</div>

        {/* 管理者の場合のみ表示されるグループ作成ボタン */}
       {(isUserAdmin || hasAnyManagedGroups(currentUser?.id || '', groups)) && !showCreateForm && (
  <div style={{ 
    marginBottom: '2rem', 
    display: showTrashMode ? 'none' : 'block' 
  }}>
    <button
      onClick={() => {
        console.log("【デバッグ】グループ作成ボタンがクリックされました");
        setEditingGroupId(null); // ← この行を追加
        setShowCreateForm(true);
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        padding: '0.8rem',
        backgroundColor: '#F0DB4F',
        color: '#1e1e2f',
        border: 'none',
        borderRadius: '10px',
        fontSize: '1rem',
        fontWeight: 'bold',
        cursor: 'pointer',
        gap: '0.5rem',
      }}
    >
      <span style={{ fontSize: '1.2rem' }}>+</span>
      新しいグループを作成
    </button>
  </div>
)}

        {/* グループ作成フォーム */}
       {(isUserAdmin || hasAnyManagedGroups(currentUser?.id || '', groups)) && showCreateForm && (
          <div
            style={{
              backgroundColor: '#1e1e2f',
              borderRadius: '12px',
              padding: '1.5rem',
              marginBottom: '2rem',
            }}
          >
            <h3 style={{ color: '#fff', marginTop: 0 }}>
  {editingGroupId ? 'グループを編集' : '新しいグループを作成'}
</h3>
            
            {/* エラーメッセージ */}
            {formError && (
              <div
                style={{
                  padding: '0.75rem',
                  backgroundColor: '#ff555522',
                  color: '#ff5555',
                  borderRadius: '8px',
                  marginBottom: '1rem',
                  fontSize: '0.9rem',
                }}
              >
                {formError}
              </div>
            )}

            {/* グループ名 */}
            <div style={{ marginBottom: '1.2rem' }}>
              <label
                style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  color: '#ddd',
                  fontSize: '0.9rem',
                }}
              >
                グループ名 <span style={{ color: '#ff5555' }}>*</span>
              </label>
              <input
                type="text"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="例: 北区 〇〇邸"
                style={{
                  width: '100%',
                  padding: '0.8rem',
                  backgroundColor: '#2e2e40',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '1rem',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* グループ説明 */}
            <div style={{ marginBottom: '1.2rem' }}>
              <label
                style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  color: '#ddd',
                  fontSize: '0.9rem',
                }}
              >
                グループ説明
              </label>
              <textarea
                value={newGroupDescription}
                onChange={(e) => setNewGroupDescription(e.target.value)}
                placeholder="グループの説明を入力してください"
                rows={3}
                style={{
                  width: '100%',
                  padding: '0.8rem',
                  backgroundColor: '#2e2e40',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '1rem',
                  boxSizing: 'border-box',
                  resize: 'vertical',
                }}
              />
            </div>

            {/* 現場住所（追加） */}
            <div style={{ marginBottom: '1.2rem' }}>
              <label
                style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  color: '#ddd',
                  fontSize: '0.9rem',
                }}
              >
                現場住所
              </label>
              <input
                type="text"
                value={newGroupAddress}
                onChange={(e) => setNewGroupAddress(e.target.value)}
                placeholder="例: 岡山県岡山市北区問屋町1-2-3"
                style={{
                  width: '100%',
                  padding: '0.8rem',
                  backgroundColor: '#2e2e40',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '1rem',
                  boxSizing: 'border-box',
                }}
              />
              <small style={{ color: '#aaa', fontSize: '0.8rem' }}>
                住所を入力するとグループページからGoogleマップで確認できます
              </small>
            </div>

            {/* 日報締切時間 */}
            <div style={{ marginBottom: '1.2rem' }}>
              <label
                style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  color: '#ddd',
                  fontSize: '0.9rem',
                }}
              >
                日報締切時間
              </label>
              <input
                type="time"
                value={reportDeadline}
                onChange={(e) => setReportDeadline(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.8rem',
                  backgroundColor: '#2e2e40',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '1rem',
                  boxSizing: 'border-box',
                }}
              />
              {/* スタイルを追加してアイコンの色を変更 */}
              <style>
                {`
                  input[type="time"]::-webkit-calendar-picker-indicator {
                    filter: invert(1); /* これによりアイコンが白くなります */
                    opacity: 0.8;
                  }
                `}
              </style>
              <small style={{ color: '#aaa', fontSize: '0.8rem' }}>
                この時間までに投稿がないとアラートが送信されます
              </small>
            </div>

            {/* レポート頻度設定 */}
            <div style={{ marginBottom: '1.2rem' }}>
              <label
                style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  color: '#ddd',
                  fontSize: '0.9rem',
                }}
              >
                レポート自動生成の頻度
              </label>
              <div style={{ position: 'relative' }}>
                {/* 左側に矢印アイコンを絶対位置で配置 */}
                <div style={{
                  position: 'absolute',
                  left: '0.8rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  pointerEvents: 'none', // アイコンがクリックイベントを邪魔しないように
                  zIndex: 2,
                }}>
                  <svg 
                    width="16" 
                    height="16" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="#ffffff"
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
                <select
                  value={reportFrequency}
                  onChange={(e) => setReportFrequency(e.target.value as any)}
                  style={{
                    width: '100%',
                    padding: '0.8rem',
                    paddingLeft: '2.5rem', // 左側のアイコンのスペースを確保
                    backgroundColor: '#2e2e40',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '1rem',
                    boxSizing: 'border-box',
                    appearance: 'none', // ブラウザのデフォルトスタイルを無効化
                    WebkitAppearance: 'none',
                    MozAppearance: 'none',
                  }}
                >
                  <option value="daily">毎日</option>
                  <option value="weekly">毎週</option>
                  <option value="monthly">毎月</option>
                  <option value="custom">カスタム</option>
                </select>
              </div>
            </div>

            {/* カスタム設定（頻度が「カスタム」の場合のみ表示） */}
            {reportFrequency === 'custom' && (
              <div style={{ marginBottom: '1.2rem' }}>
                <label
                  style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    color: '#ddd',
                    fontSize: '0.9rem',
                  }}
                >
                  カスタム日数（何日ごと）
                </label>
                <input
                  type="number"
                  min="1"
                  max="90"
                  value={customDays}
                  onChange={(e) => setCustomDays(parseInt(e.target.value) || 7)}
                  style={{
                    width: '100%',
                    padding: '0.8rem',
                    backgroundColor: '#2e2e40',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '1rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            )}

            {/* ボタン */}
            <div
              style={{
                display: 'flex',
                gap: '1rem',
                marginTop: '1.5rem',
              }}
            >
  <button
  onClick={() => {
    setShowCreateForm(false);
    setEditingGroupId(null);
  }}
  style={{
                  flex: 1,
                  padding: '0.8rem',
                  backgroundColor: '#444',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                }}
                disabled={isSubmitting}
              >
                キャンセル
              </button>
              <button
                onClick={handleCreateGroup}
                disabled={isSubmitting}
                style={{
                  flex: 1,
                  padding: '0.8rem',
                  backgroundColor: '#F0DB4F',
                  color: '#1e1e2f',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '0.9rem',
                  fontWeight: 'bold',
                  cursor: isSubmitting ? 'default' : 'pointer',
                  opacity: isSubmitting ? 0.7 : 1,
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                {isSubmitting ? (
                  <div
                    style={{
                      width: '20px',
                      height: '20px',
                      border: '2px solid rgba(30, 30, 47, 0.3)',
                      borderTop: '2px solid #1e1e2f',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite',
                    }}
                  />
                  ) : (
                    editingGroupId ? '保存する' : '作成する'
                  )}
              </button>
            </div>
          </div>
        )}
        
        {/* ローディング表示 */}
        {loading && (
          <div style={{ textAlign: 'center', color: '#fff', padding: '2rem' }}>
            <div
              style={{
                width: '30px',
                height: '30px',
                border: '3px solid rgba(240, 219, 79, 0.3)',
                borderTop: '3px solid #F0DB4F',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                margin: '0 auto',
                marginBottom: '1rem',
              }}
            ></div>
            <style>
              {`
                @keyframes spin {
                  0% { transform: rotate(0deg); }
                  100% { transform: rotate(360deg); }
                }
              `}
            </style>
            グループを読み込み中...
          </div>
        )}

        {/* グループが見つからない場合 - フォームが表示されていない場合のみ表示 */}
        {!showCreateForm && !loading && groups.length === 0 && (
          <div
            style={{
              backgroundColor: '#ffffff22',
              padding: '2rem',
              borderRadius: '12px',
              textAlign: 'center',
              color: '#fff',
              margin: '2rem 0',
            }}
          >
            <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>👥</div>
            <p style={{ color: '#fff', fontSize: '1.1rem', marginBottom: '1rem' }}>
              参加しているグループはありません
            </p>
            {isUserAdmin && (
              <p style={{ marginTop: '1rem', fontSize: '0.9rem' }}>
                グループを作成してユーザーを招待しましょう
              </p>
            )}
          </div>
        )}




    {/* ゴミ箱モード：削除済みグループ一覧 */}
{!showCreateForm && !loading && showTrashMode && (
  <div style={{ marginBottom: '2rem' }}>
    
    {/* 完全削除ボタンエリア - ゴミ箱に削除済みグループがある場合のみ表示 */}
    {(() => {
  // 削除済みかつ30日以内のグループを取得
  const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
  const deletedGroups = groups.filter(group => 
    group.isDeleted && 
    group.deletedAt > thirtyDaysAgo &&
    !group.permanentlyDeleted // 完全削除されたグループは除外
  );
  
  // 削除済みグループがない場合はボタンエリア全体を非表示
  if (deletedGroups.length === 0) {
    return null;
  }
      
      return (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem',
          marginBottom: '1.5rem',
          paddingTop: '0.2rem'
        }}>
          {/* 左側：すべて選択（完全削除モード時のみ表示） */}
          {showPermanentDeleteMode ? (
            <button
              onClick={() => {
                // 現在表示されている削除済みグループのIDを取得
                const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
                const deletedGroups = groups.filter(group => 
                  group.isDeleted && 
                  group.deletedAt > thirtyDaysAgo &&
                  !group.permanentlyDeleted
                );
                
                const allGroupIds = new Set(deletedGroups.map(group => group.id));
                const isAllSelected = deletedGroups.every(group => 
                  selectedDeleteGroups.has(group.id)
                );
                
                if (isAllSelected) {
                  // 全て選択されている場合は全て解除
                  setSelectedDeleteGroups(new Set());
                } else {
                  // 一部または何も選択されていない場合は全て選択
                  setSelectedDeleteGroups(allGroupIds);
                }
              }}
              style={{
                background: 'none',
                border: 'none',
                color: '#055A68',
                fontSize: '0.9rem',
                cursor: 'pointer',
                fontWeight: 'bold',
                padding: '0.2rem 0',
                outline: 'none',
              }}
            >
              {(() => {
                // 現在表示されている削除済みグループを取得
                const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
                const deletedGroups = groups.filter(group => 
                  group.isDeleted && 
                  group.deletedAt > thirtyDaysAgo &&
                  !group.permanentlyDeleted
                );
                
                const isAllSelected = deletedGroups.length > 0 && 
                  deletedGroups.every(group => selectedDeleteGroups.has(group.id));
                
                return isAllSelected ? 'すべて解除' : 'すべて選択';
              })()}
            </button>
          ) : (
            <div></div>  // 通常モード時は空のdivで左側を埋める
          )}
          
          {/* 右側：完全削除ボタンとキャンセルボタン */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1rem'
          }}>
            {/* 完全削除モード時のみ表示：一括完全削除ボタン */}
            {showPermanentDeleteMode && selectedDeleteGroups.size > 0 && (
              <button
                onClick={async () => {
                  const selectedCount = selectedDeleteGroups.size;
                  if (window.confirm(
                    `選択した${selectedCount}件のグループを完全に削除しますか？\n\n` +
                    `※この操作は取り消すことができません。`
                  )) {
                    try {
                      // 選択されたすべてのグループを削除
                      const deletePromises = Array.from(selectedDeleteGroups).map(groupId =>
                        deleteGroupPermanently(groupId)
                      );
                      
                      await Promise.all(deletePromises);
                      
                      // UIから削除
                      setGroups(prevGroups => 
                        prevGroups.filter(g => !selectedDeleteGroups.has(g.id))
                      );
                      
                      // 選択状態をクリア
                      setSelectedDeleteGroups(new Set());
                      
                      alert(`${selectedCount}件のグループを完全に削除しました。`);
                    } catch (error) {
                      console.error('一括完全削除エラー:', error);
                      alert('完全削除に失敗しました。もう一度お試しください。');
                    }
                  }
                }}
                style={{
                  padding: '0.4rem 0.8rem',
                  backgroundColor: '#ff6b6b',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                完全に削除 ({selectedDeleteGroups.size})
              </button>
            )}
            
            {/* 選択して削除 / キャンセル ボタン */}
            <button
              onClick={() => {
                setShowPermanentDeleteMode(!showPermanentDeleteMode);
                setSelectedDeleteGroups(new Set());
              }}
              style={{
                padding: '0.4rem 0.8rem',
                backgroundColor: 'transparent',
                color: '#055A68',
                border: '1px solid #055A68',
                borderRadius: '6px',
                fontSize: '0.8rem',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              {showPermanentDeleteMode ? 'キャンセル' : '選択して削除'}
            </button>
          </div>
        </div>
      ); 
    })()}
    
    

    
    {(() => {
      // 削除済みかつ30日以内のグループを取得
      const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
      const deletedGroups = groups.filter(group => 
        group.isDeleted && 
        group.deletedAt > thirtyDaysAgo &&
        !group.permanentlyDeleted // 完全削除されたグループは除外
      );
      
      return deletedGroups.length === 0 ? (
        <div style={{ 
          padding: '3rem', 
          textAlign: 'center', 
          backgroundColor: '#f9f9f9',
          borderRadius: '12px',
          color: '#6b7280'
        }}>
          <svg 
            width="48" 
            height="48" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="1"
            style={{ margin: '0 auto 1rem', opacity: 0.5 }}
          >
            <polyline points="3,6 5,6 21,6" />
            <path d="M19,6V20a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6M8,6V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2V6" />
            <line x1="10" y1="11" x2="10" y2="17" />
            <line x1="14" y1="11" x2="14" y2="17" />
          </svg>
          <div>ゴミ箱は空です</div>
          <div style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>
            削除されたグループがここに表示されます
          </div>
        </div>
      ) : (
        deletedGroups.map((group) => {
          const daysLeft = Math.ceil((30 - (Date.now() - group.deletedAt) / (24 * 60 * 60 * 1000)));
          
          return (
            <div
  key={group.id}
  style={{
    backgroundColor: '#E6EDED', // グループリストと同じ背景色
    borderRadius: '12px',
    padding: '1.5rem',
    marginBottom: '1rem',
    cursor: 'default', // クリック不可
  }}
>
  {/* グループ名とメンバー数 */}
  <div style={{
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.5rem'
  }}>
    <h3 style={{ 
      margin: 0, 
      color: '#055A68',
      fontSize: '1.2rem' 
    }}>
      {group.name}
    </h3>
    
    {/* メンバー数表示 */}
    <div style={{
      backgroundColor: '#055A6822',
      color: '#055A68',
      fontSize: '0.75rem',
      padding: '0.3rem 0.6rem',
      borderRadius: '4px',
      display: 'flex',
      alignItems: 'center',
      gap: '4px'
    }}>
      <svg 
        width="14" 
        height="14" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="#055A68"
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      >
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
      {group.members?.length || 1}人
    </div>
  </div>

  {/* グループ説明 */}
  {group.description && (
    <p style={{ 
      color: '#055A68',
      fontSize: '0.9rem', 
      marginTop: '0.5rem',
      marginBottom: '0.5rem' 
    }}>
      {group.description}
    </p>
  )}

  {/* 住所と締切時間 */}
<div style={{ 
  display: 'flex', 
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  marginTop: '1rem',
  fontSize: '0.8rem',
  color: '#055A68'
}}>
  {/* 住所部分 */}
  <div style={{
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
    maxWidth: '75%',
  }}>
    {(group.address || group.settings?.location?.address) ? (
      <>
        <svg 
          width="16" 
          height="16" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="#055A68"
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round"
          style={{
            marginTop: '2px',
            flexShrink: 0
          }}
        >
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
        <span style={{ 
          lineHeight: '1.3',
          wordBreak: 'break-word',
          display: 'block',
          paddingRight: '10px'
        }}>
          {group.address || group.settings?.location?.address}
        </span>
      </>
    ) : (
      <span style={{ color: '#055A6880' }}>住所なし</span>
    )}
  </div>
  
  {/* 締切時間 */}
  <div style={{
    whiteSpace: 'nowrap',
    flexShrink: 0,
    paddingLeft: '10px',
    fontSize: '0.9rem'
  }}>
    締切: {group.settings?.reportDeadline || '18:00'}
  </div>
</div>

  {/* 削除情報 */}
 {/* 削除情報とボタンエリア - 横並び */}
<div style={{
  marginTop: '2rem',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: '1rem'
}}>
  {/* 左側：削除情報 */}
  <div style={{
    fontSize: '0.8rem',
    color: '#055A68'
  }}>
    <div style={{ marginBottom: '0.3rem' }}>
      削除日: {new Date(group.deletedAt).toLocaleDateString()}
    </div>
    <div style={{ color: '#dc2626', fontWeight: 'bold' }}>
      残り{daysLeft}日で完全削除
    </div>
  </div>
  
  {showPermanentDeleteMode ? (
  // 完全削除モード時：チェックボックスのみ
  <div style={{
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'flex-end' ,
    paddingTop: '1.2rem' 
  }}>
    <input
      type="checkbox"
      checked={selectedDeleteGroups.has(group.id)}
      onChange={(e) => {
        const newSelected = new Set(selectedDeleteGroups);
        if (e.target.checked) {
          newSelected.add(group.id);
        } else {
          newSelected.delete(group.id);
        }
        setSelectedDeleteGroups(newSelected);
      }}
      style={{
  width: '18px',
  height: '18px',
  minWidth: '18px',
  minHeight: '18px',
  accentColor: '#055A68',
  cursor: 'pointer',
  border: '2px solid #055A68',
  borderRadius: '4px',
  backgroundColor: 'rgba(255, 255, 255, 0.1)',
  appearance: 'auto',
  WebkitAppearance: 'checkbox',
}}
    />
  </div>
) : (
  // 通常モード時：詳細・復元ボタン
  <div style={{
    display: 'flex',
    gap: '0.5rem'
  }}>
    {/* 詳細ボタン */}
    <button
      onClick={() => {
        navigate(`/group/${group.id}?from=trash`);
      }}
      style={{
        padding: '0.6rem 1.2rem',
        backgroundColor: '#6b7280',
        color: '#ffffff',
        border: 'none',
        borderRadius: '8px',
        fontSize: '0.9rem',
        cursor: 'pointer',
        fontWeight: 'bold'
      }}
    >
      詳細
    </button>
    
    {/* 復元ボタン */}
    <button
      onClick={async () => {
        if (window.confirm(`グループ「${group.name}」を復元しますか？`)) {
          try {
            const restoreData = {
              isDeleted: false,
              deletedAt: null,
              deletedBy: null
            };
            
            await updateGroupWithFirestore(group.id, restoreData);
            
            setGroups(prevGroups => 
              prevGroups.map(g => 
                g.id === group.id 
                  ? { ...g, ...restoreData }
                  : g
              )
            );
            alert(`グループ「${group.name}」を復元しました！`);
          } catch (error) {
            console.error('復元エラー:', error);
            alert('復元に失敗しました。もう一度お試しください。');
          }
        }
      }}
      style={{
        padding: '0.6rem 1.2rem',
        backgroundColor: '#059669',
        color: '#ffffff',
        border: 'none',
        borderRadius: '8px',
        fontSize: '0.9rem',
        cursor: 'pointer',
        fontWeight: 'bold'
      }}
    >
      復元
    </button>
  </div>
)}
</div>
            </div>  
          );
        })
      );
    })()}
  </div>
)}




        {/* グループ一覧 - フォームが表示されていない場合のみ表示 */}
       {!showCreateForm && !loading && !showTrashMode && (
  <div style={{ marginBottom: '2rem' }}>
          
          <div style={{ 
  display: 'flex', 
  justifyContent: 'space-between', 
  alignItems: 'center',
  marginBottom: '2rem', 
  color: '#055A68' 
}}>
<div style={{ 
  marginBottom: '1.5rem', 
  color: '#055A68',
  fontSize: '0.9rem'
}}>
  現在 {groups.filter(group => !group.isDeleted).length}件のグループに参加
</div>
  
  {/* 管理者の場合のみボタン表示 */}
  {hasAnyManagedGroups(currentUser?.id || '', groups) && (
    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
      {/* 編集ボタン */}
      <button
        onClick={() => {
          setIsGroupEditMode(!isGroupEditMode);
          setSelectedGroupId(null);
        }}
        style={{
          padding: '0.4rem 0.8rem',
          backgroundColor: 'transparent',
          color: '#055A68',
          border: '1px solid #055A68',
          borderRadius: '6px',
          fontSize: '0.8rem',
          cursor: 'pointer',
          fontWeight: 'bold'
        }}
      >
        {isGroupEditMode ? 'キャンセル' : '編集する'}
      </button>
      
      
    </div>
  )}
</div>

            
{groups
  .filter(group => !group.isDeleted)
  .filter(group => isUserMemberOfGroup(currentUser?.id || '', group))
  .filter(group => !isGroupEditMode || canManageGroup(currentUser?.id || '', group))
  .map((group) => (
  <div key={group.id}
  style={{
    backgroundColor: '#E6EDED',
    borderRadius: '12px',
    padding: '1.5rem',
    marginBottom: '1rem',
    cursor: isGroupEditMode ? 'default' : 'pointer',  // ← カーソルも変更
  }}
  onClick={isGroupEditMode ? undefined : () => navigate(`/group/${group.id}?from=group-list`)}  // ← 条件付きに変更
>
                <div
  style={{
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  }}
>
  <h3 style={{ 
    margin: 0, 
    color: '#055A68',
    fontSize: '1.2rem' 
  }}>
    {group.name}
  </h3>
  
  {/* メンバー数を右上に配置 */}
  <div style={{
    backgroundColor: '#055A6822',
    color: '#055A68',
    fontSize: '0.75rem',
    padding: '0.3rem 0.6rem',
    borderRadius: '4px',
    display: 'flex',
    alignItems: 'center',
    gap: '4px'
  }}>
    <svg 
      width="14" 
      height="14" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="#055A68"
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
    {group.members.length}人
  </div>
</div>
                
                {group.description && (
                  <p style={{ 
                    color: '#055A68', // 説明文の色を変更
                    fontSize: '0.9rem', 
                    marginTop: '0.5rem',
                    marginBottom: '0.5rem' 
                  }}>
                    {group.description}
                  </p>
                )}
                
                {/* 住所と締切時間を同じ行に配置（第3のファイルのスタイル） */}
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between',
                  alignItems: 'flex-start', // 上部揃え（長い住所の場合）
                  marginTop: '1rem',
                  fontSize: '0.8rem',
                  color: '#055A68'
                }}>
                  {/* 現場住所部分 */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px',
                    maxWidth: '75%', // 幅を制限
                  }}>
                    {(group.address || group.settings?.location?.address) ? (
                      <>
                        <svg 
  width="16" 
  height="16" 
  viewBox="0 0 24 24" 
  fill="none" 
  stroke="#055A68"
  strokeWidth="2" 
  strokeLinecap="round" 
  strokeLinejoin="round"
  style={{
    cursor: isGroupEditMode ? 'default' : 'pointer',  // ← 編集モード時はカーソル変更
    marginTop: '2px',
    flexShrink: 0
  }}
  onClick={(e) => {
    e.stopPropagation(); // 親要素のクリックイベントを停止
    
    // 編集モード時は何もしない
    if (isGroupEditMode) {
      return;
    }
    
    // 住所を取得（group.addressがなければsettings内の住所を使用）
    const address = group.address || group.settings?.location?.address;
    
    // 住所が存在しない場合はメッセージを表示
    if (!address || address.trim() === '') {
      alert('このグループには住所が設定されていません。\nグループ設定で住所を追加してください。');
      return;
    }
    
    // 住所をGoogle MAP用にエンコードして開く
    const encodedAddress = encodeURIComponent(address.trim());
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodedAddress}`, '_blank');
  }}
>
                          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                          <circle cx="12" cy="10" r="3" />
                        </svg>
                        <span 
                          style={{ 
                            lineHeight: '1.3',
                            wordBreak: 'break-word', // 日本語の改行に適した設定
                            display: 'block',
                            paddingRight: '10px' // 右側の余白
                          }}
                        >
                          {group.address || group.settings?.location?.address}
                        </span>
                      </>
                    ) : (
                      <span style={{ color: '#055A6880' }}>住所なし</span>
                    )}
                  </div>
                  
                {/* 締切時間 */}
                <div style={{
                    whiteSpace: 'nowrap', // 改行しない
                    flexShrink: 0, // サイズを固定
                    paddingLeft: '10px', // 左側の余白（長い住所との間のスペース）
                    fontSize: '0.9rem'
                  }}>
                    締切: {group.settings.reportDeadline}
                  </div>
                </div>
                {isGroupEditMode && (
  <div style={{ 
    marginTop: '1rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  }}>
  
   {/* 左側: チェックボックスと編集ボタン */}
<div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
  <input
    type="checkbox"
    checked={selectedGroupId === group.id}
    onClick={(e) => {
      e.stopPropagation();
    }}
    onChange={(e) => {
      e.stopPropagation();
      setSelectedGroupId(selectedGroupId === group.id ? null : group.id);
    }}
    style={{
  width: '18px',
  height: '18px',
  minWidth: '18px',
  minHeight: '18px',
  accentColor: '#055A68',
  cursor: 'pointer',
  border: '2px solid #055A68',
  borderRadius: '4px',
  backgroundColor: 'rgba(255, 255, 255, 0.1)',
  appearance: 'auto',
  WebkitAppearance: 'checkbox',
}}
  />
  
  {/* チェックされた場合のみ編集ボタンを隣に表示 */}
  {selectedGroupId === group.id && (
  <div style={{ display: 'flex', gap: '0.5rem' }}>

    <button
  onClick={(e) => {
    e.stopPropagation();
    
    // ✅ デバッグ情報を追加
    console.log("【デバッグ】編集対象グループの全データ:", group);
    console.log("【デバッグ】group.settings:", group.settings);
    console.log("【デバッグ】group.settings.reportFrequency:", group.settings.reportFrequency);
    console.log("【デバッグ】group.settings.reportSettings:", group.settings.reportSettings);
    
    setEditingGroupId(group.id);
    setNewGroupName(group.name);
    setNewGroupDescription(group.description || '');
    setNewGroupAddress(group.address || group.settings?.location?.address || '');
    setReportDeadline(group.settings.reportDeadline);
    
    // ✅ より詳細な取得ロジック
    let frequency = 'daily'; // デフォルト値
    if (group.settings.reportFrequency) {
      frequency = group.settings.reportFrequency;
    } else if (group.settings.reportSettings?.frequency) {
      frequency = group.settings.reportSettings.frequency;
    }
    
    console.log("【デバッグ】最終的に設定するfrequency:", frequency);
    setReportFrequency(frequency as 'daily' | 'weekly' | 'monthly' | 'custom');
    
    setCustomDays(group.settings.reportSettings?.customDays || 7);
    setShowCreateForm(true);
    setIsGroupEditMode(false);
    setSelectedGroupId(null);
  }}
  style={{
    padding: '0.4rem 1rem',     // ← 0.5rem → 0.4rem に変更
    backgroundColor: '#055A68',
    color: '#ffffff',
    border: 'none',
    borderRadius: '20px',
    fontSize: '0.75rem',        // ← 0.85rem → 0.75rem に変更
    cursor: 'pointer',
    fontWeight: 'bold'
  }}
>
  編集
</button>
    
    {/* 削除ボタン */}
    <button
     onClick={async (e) => {  // ← async を追加
      e.stopPropagation();
      
      if (window.confirm(
        `グループ「${group.name}」を削除しますか？\n\n` +
        `※30日間は復元可能です。\n※30日後に完全削除されます。`
      )) {
        try {
          // データベースに削除を保存
          const deleteData = {
            isDeleted: true,
            deletedAt: Date.now(),
            deletedBy: currentUser?.id || 'unknown'
          };
          
          await updateGroupWithFirestore(group.id, deleteData);
          
          // 保存成功後にUIを更新
          setGroups(prevGroups => 
            prevGroups.map(g => 
              g.id === group.id 
                ? { ...g, ...deleteData }
                : g
            )
          );
          
          setSelectedGroupId(null);
          setIsGroupEditMode(false);
          alert(`グループ「${group.name}」を削除しました。\n30日以内であれば復元可能です。`);
        } catch (error) {
          console.error('削除エラー:', error);
          alert('削除に失敗しました。もう一度お試しください。');
        }
      }
    }}
    style={{
      padding: '0.4rem 1rem',     // ← 0.5rem → 0.4rem に変更
      backgroundColor: '#ff6b6b',
      color: '#ffffff',
      border: 'none',
      borderRadius: '20px',
      fontSize: '0.75rem',        // ← 0.85rem → 0.75rem に変更
      cursor: 'pointer',
      fontWeight: 'bold'
    }}
    >
      削除
    </button>
  </div>
)}
</div>

{/* 右側は空にする */}
<div></div>
  </div>
)}
              </div>
            ))}
          </div>
        )}
      </div>
      
　　{/* フッターナビゲーション - ゴミ箱モード時は非表示 */}
　　{!showTrashMode && <MainFooterNav />}
    </div>
  );
};

// 完全削除関数（より安全な方法）
const deleteGroupPermanently = async (groupId: string) => {
  try {
    // updateGroupWithFirestore を使って完全削除を示すデータで更新
    const deleteData = {
      isDeleted: true,
      deletedAt: Date.now(),
      deletedBy: localStorage.getItem("daily-report-user-id") || 'system',  // ← 修正
      permanentlyDeleted: true, // 完全削除フラグを追加
      permanentDeletedAt: Date.now()
    };
    
    await updateGroupWithFirestore(groupId, deleteData);
    
    console.log('グループを完全削除しました:', groupId);
  } catch (error) {
    console.error('完全削除エラー:', error);
    throw error;
  }
};

export default GroupListPage;