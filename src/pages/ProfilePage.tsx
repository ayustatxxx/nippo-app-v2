import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import MainFooterNav from '../components/MainFooterNav';
import Header from '../components/Header'; 
import { User, UserRole, ReportFrequency, GroupMember } from '../types';
import { DisplayNameResolver } from '../utils/displayNameResolver';
import { getCurrentUser, updateCurrentUser } from '../utils/authUtil';


const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true); // ★ 追加
  
  // プロフィール写真関連の状態
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [tempProfileImage, setTempProfileImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // 編集用の状態
  const [formData, setFormData] = useState({
    username: '',
    fullName: '',
    company: '',
    position: '',
    phone: '',
    email: '',
    notifications: true,
    reportFrequency: 'daily' as ReportFrequency
  });

  // 📝 修正：ダミーユーザー作成関数を先に定義
  const createDummyUser = (userId: string, username: string): User => {
    return {
      id: userId,
      email: "admin@example.com",
      username: username,
      role: "admin" as UserRole,
      groups: [],
      profileData: {
        fullName: "管理者ユーザー",
        company: "株式会社 Night Train Stars",
        position: "システム管理者",
        phone: "03-1234-5678"
      },
      settings: {
        notifications: true,
        reportFrequency: "daily" as ReportFrequency
      },
      isActive: true,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
  };

  // 選択された画像を処理する関数
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    
    if (file) {
      // 画像ファイルをBase64に変換
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setTempProfileImage(result);
      };
      reader.readAsDataURL(file);
    }
  };

  // プロフィール写真を選択する関数
  const handleImageSelect = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };
  

useEffect(() => {
  const loadProfile = async () => {
    console.log('📱 ProfilePage: データ読み込み開始');
    setIsLoading(true); // ★ 1つ目：ここに追加！
    
    try {
      // 新しいauthUtil.tsのgetCurrentUser関数を使用
      const currentUser = await getCurrentUser();
      
      if (currentUser) {
        setUser(currentUser);

        // ProfilePage.tsx 48行目付近に追加
        console.log('🔍 currentUser全体:', currentUser);
        console.log('🔍 currentUser.profileData:', currentUser.profileData);
        console.log('🔍 currentUser.username:', currentUser.username);
        console.log('🔍 currentUser.fullName:', currentUser.fullName);
        console.log('🔍 currentUser.displayName:', currentUser.displayName);

        // ⭐ 修正：フォームデータを正しく設定
        const newFormData = {
          username: currentUser.username || '',
          fullName: currentUser.fullName || '', // ⭐ fullNameのみを使用
          email: currentUser.email || '',
          company: currentUser.company || '',
          position: currentUser.position || '',
          phone: currentUser.phone || '',
          notifications: currentUser.settings?.notifications ?? true,
          reportFrequency: currentUser.settings?.reportFrequency || 'daily'
        };

        console.log('🎯 【初期化】formDataの設定値:', {
          username: newFormData.username,
          fullName: newFormData.fullName,
          displayName: currentUser.displayName
        });

        setFormData(newFormData);
 
        // プロフィール画像の設定
        if (currentUser.profileImage) {
          setProfileImage(currentUser.profileImage);
        }
        
        console.log('✅ 同期されたユーザーデータを読み込み完了');
        
        // この下に追加
        console.log('🔍 読み込まれたユーザーデータ詳細:', {
          user_id: currentUser?.id,
          user_email: currentUser?.email,
          user_displayName: currentUser?.displayName,
          user_fullName: currentUser?.fullName,
          user_company: currentUser?.company,
          user_position: currentUser?.position,
          user_phone: currentUser?.phone,
          profileData: currentUser?.profileData,
          settings: currentUser?.settings,
          全体のcurrentUser: currentUser
        });

        console.log('🔍 Firestoreの生データ確認:', JSON.stringify(currentUser, null, 2));

        console.log('🔍 フォームデータの設定内容:', {
          formData_fullName: currentUser.displayName || currentUser.fullName || '',
          formData_company: currentUser.company || '',
          formData_position: currentUser.position || '',
          formData_phone: currentUser.phone || ''
        });
      } else {
        console.log('⚠️ ユーザーデータが取得できませんでした');
      }
    } catch (error) {
      console.error('❌ プロフィールロードエラー:', error);
    } finally {  // ★ 2つ目：finally を追加！
      setIsLoading(false);  // ★ 3つ目：ここに追加！
    }
  };

  loadProfile();
}, []);
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target as HTMLInputElement;
    
    // チェックボックスの場合は checked 値を使用
    const inputValue = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
    
    setFormData({
      ...formData,
      [name]: inputValue
    });
  };
  
  // 📝 修正：saveProfile関数
  // ProfilePage.tsx のsaveProfile関数を以下に置き換えてください：

  const saveProfile = async () => {
  console.log('💾 saveProfile関数が呼ばれました');
  
  // ⭐ 保存前のデータを確認
  console.log('💾 【保存前】formData:', {
    username: formData.username,
    fullName: formData.fullName,
    company: formData.company,
    position: formData.position,
    phone: formData.phone
  });

  console.log('💾 【保存前】現在のuser:', {
    username: user?.username,
    fullName: user?.fullName,
    displayName: user?.displayName
  });
  
  // 重複実行防止
  if (saving) {
    console.log('⚠️ 既に保存処理中です');
    return;
  }
    
  if (!user) return;
  
  try {
    setSaving(true);
    
    // ⭐ 送信するデータを準備
    const updateData = {
      username: formData.username.trim(),
      displayName: formData.username.trim(),
      fullName: formData.fullName.trim(),
      company: formData.company.trim(),
      position: formData.position.trim(),
      phone: formData.phone.trim(),
      email: formData.email.trim(),
      profileImage: tempProfileImage || profileImage || '',
      settings: {
        notifications: formData.notifications,
        reportFrequency: formData.reportFrequency,
        theme: user.settings?.theme || 'light'
      }
    };

    console.log('📤 【送信データ】updateData:', updateData);
    
    // 新しいauthUtil.tsのupdateCurrentUser関数を使用
    const updatedUser = await updateCurrentUser(updateData);
    
   console.log('✅ 【保存後】updatedUser:', {
  username: updatedUser?.username,
  fullName: updatedUser?.fullName,
  displayName: updatedUser?.displayName,
  company: updatedUser?.company
});

console.log('🎯 【保存後】fullNameの値:', updatedUser?.fullName);
console.log('🎯 【保存後】usernameの値:', updatedUser?.username);
console.log('🎯 【保存後】displayNameの値:', updatedUser?.displayName);
    
    if (updatedUser) {
      // UI状態を更新
      setUser(updatedUser);
      setEditMode(false);
      setTempProfileImage(null);
      
      // プロフィール画像の保存
      if (tempProfileImage) {
        setProfileImage(tempProfileImage);
      }
      
      console.log('✅ プロフィール情報を保存しました:', updatedUser.displayName);
      
      // 成功メッセージ表示
      alert('プロフィールを保存しました');
    } else {
      throw new Error('プロフィール更新に失敗しました');
    }
    
  } catch (error) {
    console.error('❌ プロフィール更新エラー:', error);
    alert('プロフィールの保存に失敗しました。再度お試しください。');
  } finally {
    setSaving(false);
  }
};
  
const toggleEditMode = () => {
  console.log('📄 toggleEditMode関数が呼ばれました');
  console.log('📄 編集モード切り替え前:', editMode);
  
  if (editMode) {
    // ⭐ 修正：キャンセル時に元の値に戻す（より確実に）
    if (user) {
      setFormData({
        username: user.username || '',
        // ⭐ displayName → fullName → username の順で取得
        fullName: user.displayName || user.fullName || user.username || '',
        email: user.email || '',
        // ⭐ user直下とprofileDataの両方をチェック
        company: user.company || user.profileData?.company || '',
        position: user.position || user.profileData?.position || '',
        phone: user.phone || user.profileData?.phone || '',
        notifications: user.settings?.notifications ?? true,
        reportFrequency: user.settings?.reportFrequency || 'daily'
      });
      
      console.log('🔄 キャンセル時のデータ復元:', {
        fullName: user.displayName || user.fullName || user.username || '',
        company: user.company || user.profileData?.company || '',
        position: user.position || user.profileData?.position || '',
        phone: user.phone || user.profileData?.phone || ''
      });
    }
    // 一時プロフィール画像もリセット
    setTempProfileImage(null);
  }
  setEditMode(!editMode);
  console.log('📄 編集モード切り替え後:', !editMode); 
};

// ここに以下のuseEffectを追加してください
useEffect(() => {
  console.log('🔍 editModeが変更されました:', editMode);
  console.log('🔍 この変更でsaveProfileが呼ばれるべきではありません');
}, [editMode]);

  
const handleLogout = () => {
  console.log('🔓 ログアウト処理開始');
  
  // 1. 現在のプロフィールデータを一時保存
  const currentUserData = localStorage.getItem("daily-report-user-data");
  const currentProfileImage = localStorage.getItem("daily-report-profile-image");
  
  console.log('💾 保護するデータ:', {
    userData: currentUserData ? 'あり' : 'なし',
    profileImage: currentProfileImage ? 'あり' : 'なし'
  });
  
  // 2. 認証関連のみクリア（プロフィールデータは保持）
  localStorage.removeItem("daily-report-user-token");
  sessionStorage.removeItem("daily-report-user-token");
  sessionStorage.removeItem("daily-report-user-email");
  sessionStorage.removeItem("daily-report-username");
  sessionStorage.removeItem("daily-report-user-id");
  
  console.log('🔓 ログアウト処理完了 - プロフィールデータは保持されました');
  navigate("/login");
};

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#ffffff',
        padding: '1.5rem',
        boxSizing: 'border-box',
        paddingBottom: '80px',
      }}
    >
      <style>
        {`
          /* スピンアニメーション */
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          
          /* 入力フィールドのフォーカススタイル */
          .profile-input:focus {
            border-color: #055A68;
            box-shadow: 0 0 0 2px rgba(5, 90, 104, 0.2);
            outline: none;
          }
          
          /* スイッチトグル */
          .toggle-switch {
            position: relative;
            display: inline-block;
            width: 50px;
            height: 24px;
          }
          
          .toggle-switch input {
            opacity: 0;
            width: 0;
            height: 0;
          }
          
          .slider {
            position: absolute;
            cursor: pointer;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: #ccc;
            transition: .4s;
            border-radius: 24px;
          }
          
          .slider:before {
            position: absolute;
            content: "";
            height: 16px;
            width: 16px;
            left: 4px;
            bottom: 4px;
            background-color: white;
            transition: .4s;
            border-radius: 50%;
          }
          
          input:checked + .slider {
            background-color: #055A68;
          }
          
          input:checked + .slider:before {
            transform: translateX(26px);
          }
          
          /* ボタンのホバー効果 */
          .btn {
            transition: all 0.3s ease;
          }
          
          .btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
          }
          
          /* カード効果 */
          .profile-card {
            transition: all 0.3s ease;
          }
          
          .profile-card:hover {
            box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1);
          }
          
          /* 画像アップロードボタン */
          .upload-overlay {
            position: absolute;
            bottom: 0;
            right: 0;
            background-color: rgba(0, 0, 0, 0.5);
            width: 32px;
            height: 32px;
            border-radius: 50%;
            display: flex;
            justify-content: center;
            align-items: center;
            cursor: pointer;
            opacity: 0;
            transition: opacity 0.3s ease;
          }
          
          .profile-image-container:hover .upload-overlay {
            opacity: 1;
          }
        `}
      </style>
      <Header 
        title="NIPPO" 
        showBackButton={false}
      />
      <div style={{ 
        maxWidth: '480px', 
        margin: '0 auto',
        paddingTop: '70px',
      }}>
        {/* ヘッダー部分 */}
        <div
          style={{
            marginTop: '0.2rem',
            marginBottom: '1rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <h2 style={{ 
            fontSize: '2rem', 
            letterSpacing: '0.01em', 
            color: '#055A68', 
            margin: 0
          }}>
            Profile
          </h2>
        </div>

        {/* プロフィール情報 */}
        {user && (
          <>
            {/* プロフィールカード */}
            <div
              className="profile-card"
              style={{
                backgroundColor: 'white',
                borderRadius: '16px',
                padding: 0,
                marginBottom: '1.5rem',
                color: '#055A68',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
                overflow: 'hidden',
              }}
            >
              {/* ユーザー情報ヘッダー部分 - 背景色付き */}
              <div style={{
                backgroundColor: '#E6EDED',
                padding: '2rem',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                borderBottom: '1px solid rgba(5, 90, 104, 0.1)'
              }}>
                {/* 非表示のファイル入力 */}
                <input 
                  type="file"
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  accept="image/*"
                  onChange={handleImageChange}
                />
                
                {/* ここはコメントアウト  アバター表示 - 編集モードでは変更可能に */}
                <div 
                  className="profile-image-container"
                  style={{
                    width: '100px',
                    height: '100px',
                    borderRadius: '50%',
                    backgroundColor: '#ffffff',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    overflow: 'hidden',
                    marginBottom: '1rem',
                    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
                    border: '4px solid white',
                    position: 'relative'
                  }}
                >
                  {(editMode ? tempProfileImage || profileImage : profileImage) ? (
                    <img 
                      src={editMode ? tempProfileImage || profileImage : profileImage} 
                      alt="プロフィール写真"
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover'
                      }}
                    />
                  ) : (
                    <svg 
                      width="60"
                      height="60"
                      viewBox="0 0 24 24" 
                      fill="#055A68" 
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path d="M12 12C14.21 12 16 10.21 16 8C16 5.79 14.21 4 12 4C9.79 4 8 5.79 8 8C8 10.21 9.79 12 12 12ZM12 14C9.33 14 4 15.34 4 18V20H20V18C20 15.34 14.67 14 12 14Z" />
                    </svg>
                  )}
                  
                  {/* 編集モードの場合、画像アップロードボタンを表示 
                  {editMode && (
                    <div 
                      className="upload-overlay"
                      onClick={handleImageSelect}
                    >
                      <svg 
                        width="18" 
                        height="18" 
                        viewBox="0 0 24 24" 
                        fill="none" 
                        stroke="white"
                        strokeWidth="2" 
                        strokeLinecap="round" 
                        strokeLinejoin="round"
                      >
                        <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                        <circle cx="8.5" cy="7" r="4" />
                        <line x1="20" y1="8" x2="20" y2="14" />
                        <line x1="23" y1="11" x2="17" y2="11" />
                      </svg>
                    </div>
                  )}*/}
                </div>

       

            
             {/* ⭐ 修正：画面上部の表示名（usernameを表示・編集） */}
{editMode && (
  <div style={{ marginBottom: '1rem' }}>
    <input
      type="text"
      value={formData.username}
      onChange={(e) => setFormData({...formData, username: e.target.value})}
      placeholder="表示名を入力"
      style={{
        textAlign: 'center',
        padding: '0.5rem',
        fontSize: '1.6rem',
        fontWeight: '600',
        color: '#055A68',
        background: 'rgba(255, 255, 255, 0.5)',
        border: '1px solid #ddd',
        borderRadius: '8px',
        width: '100%',
        maxWidth: '250px'
      }}
    />
  </div>
)}

                {!editMode && (
<h3 style={{ 
    margin: 0, 
    fontSize: '1.6rem', 
    color: '#055A68',
    fontWeight: '600',
    marginBottom: '0.5rem',
    textAlign: 'center'
  }}>
   {/* ⭐ 修正：画面上部はusernameを表示 */}
   {formData.username || user.username || "未設定"}
  </h3>
)}
                
                <div
                  style={{
                    backgroundColor: user.role === 'admin' ? '#055A6822' : '#ffffff33', 
                    color: '#055A68', 
                    display: 'inline-block',
                    padding: '0.3rem 0.8rem',
                    borderRadius: '20px',
                    fontSize: '0.8rem',
                    fontWeight: '500',
                    marginBottom: '0.5rem'
                  }}
                >
                  {user.role === 'admin' ? '管理者' : 'メンバー'}
                </div>
                
                {/* 最終更新日時 */}
                <div style={{ 
                  fontSize: '0.8rem', 
                  color: '#055A68', 
                  opacity: 0.7,
                  marginTop: '0.5rem'
                }}>
                  最終更新：{new Date(user.updatedAt).toLocaleDateString('ja-JP')}
                </div>
              </div>

              {/* フォーム（表示モード or 編集モード） */}
              <div style={{ padding: '1.5rem' }}>
                {editMode ? (
                  // 編集モード
                  <div>
                    {/* プロフィール編集見出し */}
                    <h4 style={{ 
                      fontSize: '1.1rem', 
                      color: '#055A68', 
                      marginTop: 0,
                      marginBottom: '1.5rem',
                      fontWeight: '600'
                    }}>
                      プロフィール情報を編集
                    </h4>

                    {/* 氏名 */}
                    <div style={{ marginBottom: '1.5rem' }}>
                      <label
                        style={{
                          display: 'block',
                          marginBottom: '0.5rem',
                          color: '#055A68',
                          fontSize: '0.9rem',
                          fontWeight: '500'
                        }}
                      >
                        氏名
                      </label>
                      <input
                        type="text"
                        name="fullName"
                        value={formData.fullName}
                        onChange={handleInputChange}
                        className="profile-input"
                        style={{
                          width: '100%',
                          padding: '0.8rem',
                          backgroundColor: '#f5f5f5',
                          border: '1px solid #ddd',
                          borderRadius: '8px',
                          color: '#055A68',
                          fontSize: '1rem',
                          boxSizing: 'border-box',
                          transition: 'all 0.3s ease'
                        }}
                        placeholder="氏名を入力"
                      />
                    </div>

                    {/* メールアドレス */}
                    <div style={{ marginBottom: '1.5rem' }}>
                      <label
                        style={{
                          display: 'block',
                          marginBottom: '0.5rem',
                          color: '#055A68',
                          fontSize: '0.9rem',
                          fontWeight: '500'
                        }}
                      >
                        メールアドレス
                      </label>
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        className="profile-input"
                        style={{
                          width: '100%',
                          padding: '0.8rem',
                          backgroundColor: '#f5f5f5',
                          border: '1px solid #ddd',
                          borderRadius: '8px',
                          color: '#055A68',
                          fontSize: '1rem',
                          boxSizing: 'border-box',
                          transition: 'all 0.3s ease'
                        }}
                        placeholder="メールアドレスを入力"
                      />
                    </div>

                    {/* 会社名 */}
                    <div style={{ marginBottom: '1.5rem' }}>
                      <label
                        style={{
                          display: 'block',
                          marginBottom: '0.5rem',
                          color: '#055A68',
                          fontSize: '0.9rem',
                          fontWeight: '500'
                        }}
                      >
                        会社名
                      </label>
                      <input
                        type="text"
                        name="company"
                        value={formData.company}
                        onChange={handleInputChange}
                        className="profile-input"
                        style={{
                          width: '100%',
                          padding: '0.8rem',
                          backgroundColor: '#f5f5f5',
                          border: '1px solid #ddd',
                          borderRadius: '8px',
                          color: '#055A68',
                          fontSize: '1rem',
                          boxSizing: 'border-box',
                          transition: 'all 0.3s ease'
                        }}
                        placeholder="会社名を入力"
                      />
                    </div>

                    {/* 役職 */}
                    <div style={{ marginBottom: '1.5rem' }}>
                      <label
                        style={{
                          display: 'block',
                          marginBottom: '0.5rem',
                          color: '#055A68',
                          fontSize: '0.9rem',
                          fontWeight: '500'
                        }}
                      >
                        役職
                      </label>
                      <input
                        type="text"
                        name="position"
                        value={formData.position}
                        onChange={handleInputChange}
                        className="profile-input"
                        style={{
                          width: '100%',
                          padding: '0.8rem',
                          backgroundColor: '#f5f5f5',
                          border: '1px solid #ddd',
                          borderRadius: '8px',
                          color: '#055A68',
                          fontSize: '1rem',
                          boxSizing: 'border-box',
                          transition: 'all 0.3s ease'
                        }}
                        placeholder="役職を入力"
                      />
                    </div>

                    {/* 電話番号 */}
                    <div style={{ marginBottom: '2rem' }}>
                      <label
                        style={{
                          display: 'block',
                          marginBottom: '0.5rem',
                          color: '#055A68',
                          fontSize: '0.9rem',
                          fontWeight: '500'
                        }}
                      >
                        電話番号
                      </label>
                      <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleInputChange}
                        className="profile-input"
                        style={{
                          width: '100%',
                          padding: '0.8rem',
                          backgroundColor: '#f5f5f5',
                          border: '1px solid #ddd',
                          borderRadius: '8px',
                          color: '#055A68',
                          fontSize: '1rem',
                          boxSizing: 'border-box',
                          transition: 'all 0.3s ease'
                        }}
                        placeholder="電話番号を入力"
                      />
                    </div>

                    {/* 設定見出し */}
                    <h4 style={{ 
                      fontSize: '1.1rem', 
                      color: '#055A68', 
                      marginTop: '2rem',
                      marginBottom: '1.5rem',
                      fontWeight: '600'
                    }}>
                      アプリ設定
                    </h4>

                    {/* 通知設定 */}
                    <div style={{ 
                      marginBottom: '1.5rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      backgroundColor: '#f5f5f5',
                      padding: '1rem',
                      borderRadius: '8px'
                    }}>
                      <div>
                        <label
                          style={{
                            color: '#055A68',
                            fontSize: '1rem',
                            fontWeight: '500',
                            marginBottom: '0.2rem',
                            display: 'block'
                          }}
                        >
                          通知
                        </label>
                        <div style={{ 
                          color: '#055A68', 
                          opacity: 0.7, 
                          fontSize: '0.8rem' 
                        }}>
                          アプリからの通知を受け取る
                        </div>
                      </div>

                      <label className="toggle-switch">
                        <input
                          type="checkbox"
                          name="notifications"
                          checked={formData.notifications}
                          onChange={handleInputChange}
                        />
                        <span className="slider"></span>
                      </label>
                    </div>

                    {/* レポート頻度 */}
                    <div style={{ marginBottom: '2rem' }}>
                      <label
                        style={{
                          display: 'block',
                          marginBottom: '0.5rem',
                          color: '#055A68',
                          fontSize: '0.9rem',
                          fontWeight: '500'
                        }}
                      >
                        レポート頻度
                      </label>
                      <select
                        name="reportFrequency"
                        value={formData.reportFrequency}
                        onChange={handleInputChange}
                        className="profile-input"
                        style={{
                          width: '100%',
                          padding: '0.8rem',
                          backgroundColor: '#f5f5f5',
                          border: '1px solid #ddd',
                          borderRadius: '8px',
                          color: '#055A68',
                          fontSize: '1rem',
                          boxSizing: 'border-box',
                          appearance: 'none',
                          backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%23055A68\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3e%3cpolyline points=\'6 9 12 15 18 9\'%3e%3c/polyline%3e%3c/svg%3e")',
                          backgroundRepeat: 'no-repeat',
                          backgroundPosition: 'right 1rem center',
                          backgroundSize: '1em',
                          transition: 'all 0.3s ease'
                        }}
                      >
                        <option value="daily">毎日</option>
                        <option value="weekly">毎週</option>
                        <option value="monthly">毎月</option>
                      </select>
                    </div>

                    {/* ボタン並べて表示 */}
                    <div style={{ 
                      display: 'flex', 
                      gap: '1rem', 
                      marginTop: '2rem'
                    }}>
                      {/* キャンセルボタン */}
                      <button
                        onClick={toggleEditMode}
                        className="btn"
                        style={{
                          flex: '1',
                          padding: '0.8rem',
                          backgroundColor: '#f5f5f5',
                          color: '#055A68',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '1rem',
                          cursor: 'pointer',
                          fontWeight: '500'
                        }}
                      >
                        キャンセル
                      </button>
                      
                      {/* 保存ボタン */}
                      <button
  onClick={(e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('💾 保存ボタンがクリックされました');
    saveProfile();
  }}
  disabled={saving}
  className="btn"
  style={{
    flex: '1',
    padding: '0.8rem',
    backgroundColor: '#055A68',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '1rem',
    fontWeight: '600',
    cursor: saving ? 'default' : 'pointer',
    opacity: saving ? 0.7 : 1,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  }}
>
                        {saving ? (
                          <div
                            style={{
                              width: '20px',
                              height: '20px',
                              border: '2px solid rgba(255, 255, 255, 0.3)',
                              borderTop: '2px solid white',
                              borderRadius: '50%',
                              animation: 'spin 1s linear infinite',
                            }}
                          />
                        ) : (
                          '変更を保存'
                        )}
                      </button>
                    </div>
                  </div>
                ) : (
                  // 表示モード
                  <div>
                    {/* プロフィール情報見出し */}
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '1.5rem',
                      paddingBottom: '0.5rem',
                      borderBottom: '1px solid rgba(5, 90, 104, 0.1)'
                    }}>
                      <h4 style={{ 
                        fontSize: '1.1rem', 
                        color: '#055A68', 
                        margin: 0,
                        fontWeight: '600'
                      }}>
                        プロフィール情報
                      </h4>

                      {/* 編集ボタン */}
<button
  onClick={() => {
  console.log('🔄 編集ボタンがクリックされました');
  toggleEditMode(); // 編集モードに入るだけ
}}
  className="btn"
  style={{
    background: 'none',
    border: 'none',
    fontSize: '0.9rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    color: '#055A68',
    fontWeight: '500'
  }}
>
                        <svg 
                          width="16" 
                          height="16" 
                          viewBox="0 0 24 24" 
                          fill="none" 
                          stroke="currentColor"
                          strokeWidth="2" 
                          strokeLinecap="round" 
                          strokeLinejoin="round"
                          style={{ marginRight: '0.4rem' }}
                        >
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                        編集する
                      </button>
                    </div>

                    {/* プロフィール情報表示 - カード形式 */}
<div style={{
  backgroundColor: '#f9f9f9',
  padding: '1.5rem',
  borderRadius: '12px',
  marginBottom: '2rem'
}}>
  {/* 各情報の表示 */}
  <div style={{ marginBottom: '1.5rem' }}>
    <div style={{ 
      fontSize: '0.85rem', 
      color: '#055A68', 
      opacity: 0.8,
      marginBottom: '0.4rem' 
    }}>
      氏名
    </div>
    <div style={{ 
      fontSize: '1.1rem',
      fontWeight: '500' 
    }}>
      {/* ⭐ 修正：fullNameのみを表示 */}
      {formData?.fullName || user?.fullName || '未設定'}
    </div>
  </div>

                      <div style={{ marginBottom: '1.5rem' }}>
                        <div style={{ 
                          fontSize: '0.85rem', 
                          color: '#055A68', 
                          opacity: 0.8,
                          marginBottom: '0.4rem' 
                        }}>
                          メールアドレス
                        </div>
                        <div style={{ 
                          fontSize: '1.1rem',
                          fontWeight: '500' 
                        }}>
                          {user.email}
                        </div>
                      </div>

                      <div style={{ marginBottom: '1.5rem' }}>
                        <div style={{ 
                          fontSize: '0.85rem', 
                          color: '#055A68', 
                          opacity: 0.8,
                          marginBottom: '0.4rem' 
                        }}>
                          会社名
                        </div>
                        <div style={{ 
                          fontSize: '1.1rem',
                          fontWeight: '500' 
                        }}>
                           {user?.company || user?.profileData?.company || formData?.company || '未設定'}
                        </div>
                      </div>

                      <div style={{ marginBottom: '1.5rem' }}>
                        <div style={{ 
                          fontSize: '0.85rem', 
                          color: '#055A68', 
                          opacity: 0.8,
                          marginBottom: '0.4rem' 
                        }}>
                          役職
                        </div>
                        <div style={{ 
                          fontSize: '1.1rem',
                          fontWeight: '500' 
                        }}>
                         {user?.position || user?.profileData?.position || formData?.position || '未設定'}
                        </div>
                      </div>

                      <div style={{ marginBottom: '0' }}>
                        <div style={{ 
                          fontSize: '0.85rem', 
                          color: '#055A68', 
                          opacity: 0.8,
                          marginBottom: '0.4rem' 
                        }}>
                          電話番号
                        </div>
                        <div style={{ 
                          fontSize: '1.1rem',
                          fontWeight: '500' 
                        }}>
                         {user?.phone || user?.profileData?.phone || formData?.phone || '未設定'}
                        </div>
                      </div>
                    </div>

                    {/* アプリ設定見出し */}
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '1.5rem',
                      paddingBottom: '0.5rem',
                      borderBottom: '1px solid rgba(5, 90, 104, 0.1)'
                    }}>
                      <h4 style={{ 
                        fontSize: '1.1rem', 
                        color: '#055A68', 
                        margin: 0,
                        fontWeight: '600'
                      }}>
                        アプリ設定
                      </h4>
                    </div>

                    {/* 設定情報表示 - カード形式 */}
                    <div style={{
                      backgroundColor: '#f9f9f9',
                      padding: '1.5rem',
                      borderRadius: '12px',
                    }}>
                      {/* 通知設定 */}
                      <div style={{ marginBottom: '1.5rem' }}>
                        <div style={{ 
                          fontSize: '0.85rem', 
                          color: '#055A68', 
                          opacity: 0.8,
                          marginBottom: '0.4rem' 
                        }}>
                          通知
                        </div>
                        <div style={{ 
                          display: 'flex',
                          alignItems: 'center'
                        }}>
                          <div style={{
                            width: '10px',
                            height: '10px',
                            borderRadius: '50%',
                            backgroundColor: user.settings.notifications ? '#4CAF50' : '#ccc',
                            marginRight: '8px'
                          }} />
                          <div style={{ fontSize: '1rem' }}>
                          {user?.settings?.notifications ? '有効' : '無効'}
                          </div>
                        </div>
                      </div>

                      {/* レポート頻度 */}
                      <div>
                        <div style={{ 
                          fontSize: '0.85rem', 
                          color: '#055A68', 
                          opacity: 0.8,
                          marginBottom: '0.4rem' 
                        }}>
                          レポート頻度
                        </div>
                        <div style={{ 
                          fontSize: '1.1rem',
                          fontWeight: '500',
                          display: 'flex',
                          alignItems: 'center'
                        }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '0.3rem 0.8rem',
                            backgroundColor: '#055A6822',
                            borderRadius: '16px',
                            fontSize: '0.9rem',
                            color: '#055A68',
                            fontWeight: '500'
                          }}>
                            {user.settings.reportFrequency === 'daily'
                              ? '毎日'
                              : user.settings.reportFrequency === 'weekly'
                              ? '毎週'
                              : '毎月'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ログアウトボタン - 表示モードの場合のみ表示 */}
            {!editMode && (
              <button
                onClick={handleLogout}
                className="btn"
                style={{
                  width: '100%',
                  padding: '1rem',
                  backgroundColor: '#f0f0f0',
                  color: '#d32f2f',
                  border: '1px solid #d32f2f',
                  borderRadius: '12px',
                  fontSize: '1rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  marginBottom: '2rem',
                  transition: 'all 0.3s ease',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                <svg 
                  width="18" 
                  height="18" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor"
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                >
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                ログアウト
              </button>
            )}
          </>
        )}
      </div>

      {/* フッターナビゲーション */}
      <MainFooterNav />
    </div>
  );
};

export default ProfilePage;