import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import GroupFooterNav from '../components/GroupFooterNav';
import { Group, User } from '../types';
import { getCurrentUser, isAdmin } from '../utils/authUtil';
import { getGroupWithFirestore } from '../utils/dbUtil';
import { UserRole, ReportFrequency, GroupMember } from '../types/index';
import { DisplayNameResolver } from '../utils/displayNameResolver';
import { PermissionManager } from "../utils/permissionManager";
import { getGroupMembersWithLatestProfile } from '../utils/firestoreService';
import { updateMemberRole, removeMemberFromGroup } from '../utils/firestoreService';


const GroupMembersPage: React.FC = () => {
  // メンバー情報を取得・同期する関数を追加
// GroupMembersPage.tsx の syncMemberWithLocalProfile関数を以下に置き換えてください：

const syncMemberWithLocalProfile = (member: User, currentUserId: string): User => {
  // 自分のプロフィールの場合は、ローカルストレージの情報を優先
  if (member.id === currentUserId) {
    const storedUserData = localStorage.getItem("daily-report-user-data");
    const storedProfileImage = localStorage.getItem("daily-report-profile-image");
    
    if (storedUserData) {
      try {
        const localProfile = JSON.parse(storedUserData);
        console.log("🔄 自分のプロフィールをローカルデータで更新:", localProfile.username);
        console.log("📊 ローカルプロフィール詳細:", localProfile);
        
        return {
          ...member,
          username: localProfile.username || member.username || 'ユーザー',
          email: localProfile.email || member.email,
          profileData: {
            ...member.profileData,
            fullName: localProfile.profileData?.fullName || localProfile.username || member.profileData?.fullName || 'ユーザー',
            company: localProfile.profileData?.company || member.profileData?.company,
            position: localProfile.profileData?.position || member.profileData?.position,
            phone: localProfile.profileData?.phone || member.profileData?.phone,
          },
          profileImage: storedProfileImage || member.profileImage
        };
      } catch (error) {
        console.error("ローカルプロフィール解析エラー:", error);
      }
    } else {
      console.log("⚠️ ローカルプロフィールデータが見つかりません");
    }
  }
  
  return member;
};

  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userIsAdmin, setUserIsAdmin] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteLink, setInviteLink] = useState('');
  const [isEditMode, setIsEditMode] = useState(false); // 全体の編集モード
const [selectedMembersForDeletion, setSelectedMembersForDeletion] = useState<Set<string>>(new Set()); // ⭐ 追加


// realMembers構築部分の完全書き換え（約115行目から）
const realMembers: GroupMember[] = useMemo(() => {
  console.log('🔄 realMembers useMemo実行:', {
    hasGroup: !!group,
    hasMembers: !!group?.members,
    membersLength: group?.members?.length || 0,
    hasCurrentUser: !!currentUser,
    currentUserId: currentUser?.id
  });
  if (!group?.members || !currentUser) { 
    console.log('⚠️ メンバーデータまたは現在のユーザーが不足');
    return [];
  }
  
  console.log('🔧 メンバーリスト構築開始 - DisplayNameResolverを使用');
  
  // Step 1: 重複排除用のMap
  const uniqueMembers = new Map<string, GroupMember>();
  
  group.members.forEach((memberData: any, index) => {
   
    // memberDataが文字列の場合は、そのままIDとして使用
const memberId = typeof memberData === 'string' ? memberData : DisplayNameResolver.extractMemberId(memberData) || `member-${index}`;
    
    // 既に処理済みの場合はスキップ（重複排除）
    if (uniqueMembers.has(memberId)) {
      console.log(`⚠️ 重複メンバーをスキップ: ${memberId}`);
      return;
    }
    
    console.log(`🔍 メンバー${index + 1}処理中:`, {
      id: memberId,
      type: typeof memberData,
      hasProfileData: !!memberData?.profileData
    });
    

   // メンバーデータをデバッグ出力
console.log(`🔍 処理中のメンバーデータ詳細:`);
console.log('memberData:', memberData);
console.log('memberDataKeys:', Object.keys(memberData || {}));
console.log('id:', DisplayNameResolver.extractMemberId(memberData));
console.log('hasProfileData:', !!memberData?.profileData);
console.log('profileDataKeys:', memberData?.profileData ? Object.keys(memberData.profileData) : []);
console.log('role:', memberData?.role);
console.log('isAdmin:', memberData?.isAdmin);
console.log('rawMemberData:', JSON.stringify(memberData, null, 2));


// memberDataが文字列の場合は、オブジェクト形式に変換
const memberObject = typeof memberData === 'string' 
  ? { 
      id: memberData,
      isAdmin: memberData === currentUser.id,
      role: memberData === currentUser.id ? 'admin' : 'user'
    } 
  : memberData;

const resolved = DisplayNameResolver.resolveForMemberList(memberObject, currentUser.id);

console.log(`🔍 解決結果:`, {
  displayName: resolved.displayName,
  isAdmin: resolved.isAdmin,
  isCurrentUser: resolved.isCurrentUser
});


    // 正規化されたメンバーオブジェクト作成
    const normalizedMember: GroupMember = {
      id: memberId,
      username: resolved.displayName,  // 統一された表示名を使用
      email: memberData?.email || '',
      role: resolved.isAdmin ? 'admin' : 'user',
      isAdmin: resolved.isAdmin,
      active: memberData?.active !== false,  // デフォルトはtrue
      joinedAt: memberData?.joinedAt || Date.now(),
      profileData: {
        fullName: resolved.displayName,  // 表示名で統一
        company: memberData?.profileData?.company || '',
        position: memberData?.profileData?.position || '',
        phone: memberData?.profileData?.phone || ''
      }
    };
    
    // 自分の場合はローカルストレージから最新情報を取得
    if (resolved.isCurrentUser) {
      try {
        const localUserData = localStorage.getItem("daily-report-user-data");
        if (localUserData) {
          const parsedLocalData = JSON.parse(localUserData);
          if (parsedLocalData.profileData?.fullName) {
            const localDisplayName = DisplayNameResolver.resolve(parsedLocalData);
            normalizedMember.username = localDisplayName;
            normalizedMember.profileData.fullName = localDisplayName;
            console.log(`🔄 ローカルデータで更新: ${localDisplayName}`);
          }
        }
      } catch (localError) {
        console.warn('⚠️ ローカルデータ取得エラー:', localError);
      }
    }
    
    uniqueMembers.set(memberId, normalizedMember);
    
    console.log(`✅ メンバー正規化完了: ${normalizedMember.username} (Admin: ${normalizedMember.isAdmin})`);
  });
  
  // Step 2: ソート（管理者優先、その後アルファベット順）
  const sortedMembers = Array.from(uniqueMembers.values()).sort((a, b) => {
    // 管理者を最上位に
    if (a.isAdmin && !b.isAdmin) return -1;
    if (!a.isAdmin && b.isAdmin) return 1;
    
    // 同じ権限の場合は名前順
    return a.username.localeCompare(b.username, 'ja');
  });
  
  console.log(`🎯 最終メンバーリスト構築完了: ${sortedMembers.length}人`);
  sortedMembers.forEach((member, i) => {
    console.log(`  ${i + 1}. ${member.username} (${member.isAdmin ? '管理者' : 'メンバー'})`);
  });
  
  return sortedMembers;
}, [group?.members, currentUser, group]);

// realMembersが変更されたらmembersステートを更新
React.useEffect(() => {
  console.log('🔥 realMembersが変更されました:', realMembers.length, '人');
  setMembers(realMembers);
}, [realMembers]);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);

        if (!groupId) {
          console.error('グループIDが見つかりません');
          return;
        }

        // 実際のユーザー情報を取得
const currentUser = await getCurrentUser();
if (!currentUser) {
  console.error('ユーザー情報が取得できません');
  navigate('/login');
  return;
}

setCurrentUser(currentUser);

// PermissionManagerを使用した統一権限チェック
const groupAdminStatus = await PermissionManager.canManageMembers(groupId);
console.log("【PermissionManager】グループ管理者権限:", groupAdminStatus);
console.log("【PermissionManager】現在のユーザー:", currentUser?.email);
console.log("【PermissionManager】グループID:", groupId);
setUserIsAdmin(groupAdminStatus);

console.log('権限確認結果:', {
  userEmail: currentUser.email,
  isAdmin: groupAdminStatus
});

        // Firestoreから実際のグループデータを取得
        try {
          console.log(
            '📊 [Members] Firestoreからグループデータを取得中...',
            groupId
          );

          const firestoreGroup = await getGroupWithFirestore(groupId);
          if (firestoreGroup) {
            console.log(
              '✅ [Members] Firestoreからグループを取得:',
              firestoreGroup.name
            );
            setGroup(firestoreGroup);

            
// メンバー情報をFirestoreから取得
try {
  // ✅ 新機能：最新メンバー情報を動的取得
  console.log('👥 [Members] 最新メンバー情報を取得中...');
  
  const latestMembers = await getGroupMembersWithLatestProfile(groupId);
  
  if (latestMembers.length > 0) {
    console.log('✅ [Members] 最新メンバー情報取得完了:', latestMembers.length, '人');
    
    // GroupMember型に変換
    const formattedMembers = latestMembers.map(member => ({
      ...member,
      active: member.active !== false, // デフォルトはtrue
      joinedAt: member.joinedAt || Date.now()
    }));
    
    setMembers(formattedMembers);
  } else {
    console.log('⚠️ [Members] メンバーが見つかりません');
    setMembers([]);
  }
  
} catch (memberError) {
  console.error('❌ [Members] 最新メンバー情報取得エラー:', memberError);
  setMembers([]);
}
          } else {
            // Firestoreグループが見つからない場合のエラー処理
            console.log(
              '❌ [Members] グループが見つかりません、ダミーデータを使用:',
              groupId
            );
            setMembers([]);
          }
        } catch (error) {
          console.error('❌ [Members] グループデータ取得エラー:', error);
          setMembers([]);
        }
      } catch (error) {
        console.error('データロードエラー:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [groupId]);

  // メンバー招待モーダルを開く
const handleInvite = () => {
  // 現在のドメインを取得（デプロイ先に対応）
  const currentDomain = window.location.origin;
  
  // 招待トークンを生成（セキュリティ向上のため）
  const inviteToken = Date.now().toString(36) + Math.random().toString(36).substr(2);
  
  // 実際のアプリのURLで招待リンクを生成
  const generatedInviteLink = `${currentDomain}/invite/${groupId}/${inviteToken}`;
  
  console.log('生成された招待リンク:', generatedInviteLink);
  
  setInviteLink(generatedInviteLink);
  setIsInviteModalOpen(true);
};

  // メンバーの有効/無効を切り替える
  // ✅ 追加（新しい関数）
const toggleMemberForDeletion = (memberId: string) => {
  setSelectedMembersForDeletion(prev => {
    const newSet = new Set(prev);
    if (newSet.has(memberId)) {
      newSet.delete(memberId);
    } else {
      newSet.add(memberId);
    }
    return newSet;
  });
};

  // メンバーを管理者に昇格/降格させる
  // ✅ 修正後
const toggleAdminStatus = async (memberId: string) => {
  if (!userIsAdmin || !groupId) return;

  const targetMember = members.find((m) => m.id === memberId);
  if (!targetMember) return;
  
  const newStatus = !targetMember.isAdmin;

  try {
    // Firestoreに保存
    await updateMemberRole(groupId, memberId, newStatus);
    
    // ローカル状態更新
    setMembers((prevMembers) =>
      prevMembers.map((member) =>
        member.id === memberId
          ? { ...member, isAdmin: newStatus, role: newStatus ? 'admin' : 'user' }
          : member
      )
    );
    
    alert(
      `✅ ${targetMember.username}さんを${
        newStatus ? '管理者に昇格' : '一般メンバーに変更'
      }しました`
    );
    
  } catch (error) {
    console.error('❌ 権限更新エラー:', error);
    alert('権限の更新に失敗しました');
  }
};

  // 招待リンクをコピー
  const copyInviteLink = () => {
    navigator.clipboard
      .writeText(inviteLink)
      .then(() => {
        alert('招待リンクをクリップボードにコピーしました');
      })
      .catch((err) => {
        console.error('クリップボードへのコピーに失敗しました', err);
        alert('リンクのコピーに失敗しました。手動でコピーしてください。');
      });
  };


  // 編集モードの切り替え
  const toggleEditMode = () => {
  setIsEditMode(!isEditMode);
  // 編集モードを終了する時は選択をクリア
  if (isEditMode) {
    setSelectedMembersForDeletion(new Set());
  }
};

const handleUpdate = () => {
  setIsEditMode(false);
  setSelectedMembersForDeletion(new Set());
  alert('✅ 変更を保存しました');
};

// ✅ 修正後（複数選択削除に対応）
const deleteSelectedMembers = async () => {
  if (selectedMembersForDeletion.size === 0) {
    alert('削除するメンバーを選択してください');
    return;
  }

  if (!groupId) return;
  
  const memberNames = Array.from(selectedMembersForDeletion)
    .map(id => members.find(m => m.id === id)?.username)
    .filter(Boolean)
    .join('、');

  if (window.confirm(`以下のメンバーをグループから削除してもよろしいですか?\n\n${memberNames}`)) {
    try {
      // 選択された全メンバーを削除
      for (const memberId of selectedMembersForDeletion) {
        await removeMemberFromGroup(groupId, memberId);
      }
      
      // ローカル状態を更新
      setMembers((prevMembers) => 
        prevMembers.filter((m) => !selectedMembersForDeletion.has(m.id))
      );
      
      // 選択をクリア
      setSelectedMembersForDeletion(new Set());
      
      alert('✅ メンバーを削除しました');
      
    } catch (error) {
      console.error('❌ メンバー削除エラー:', error);
      alert('メンバーの削除に失敗しました');
    }
  }
};


  return (
    <div
      style={{
        minHeight: '100vh',
        background:
          'linear-gradient(to top, rgb(7, 112, 144), rgb(7, 107, 127), rgb(0, 102, 114))',
        padding: 1.5, // パディングを削除
        boxSizing: 'border-box',
        paddingBottom: '80px', // フッター分の余白
        display: 'flex',
        flexDirection: 'column', // フレックスボックスとして設定
      }}
    >
      {/* ヘッダー部分 - 固定表示 */}
      <div
        style={{
          position: 'fixed', // 'sticky'から'fixed'に変更
          top: 0,
          left: 0,
          width: '100%',
          zIndex: 100,
          background:
            'linear-gradient(to right, rgb(0, 102, 114), rgb(7, 107, 127))', // ヘッダー背景
          padding: '0.65rem',
          boxSizing: 'border-box',
          //borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        <div
          style={{
            maxWidth: '480px',
            margin: '0 auto',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
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
                // URLパラメータを保持したまま戻る
                const from = searchParams.get('from');
                const postId = searchParams.get('postId');

                const params = new URLSearchParams();
                if (from) params.set('from', from);
                if (postId) params.set('postId', postId);
                const paramString = params.toString()
                  ? `?${params.toString()}`
                  : '';

                navigate(`/group/${groupId}${paramString}`);
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

              <h2
                style={{
                  fontSize: '2rem',
                  letterSpacing: '0.03em',
                  color: '#F0DB4F',
                  margin: 0,
                }}
              >
                Members
              </h2>
            </div>

            {/* 管理者の場合のみ表示するメンバー招待ボタン */}
            {userIsAdmin && (
              <button
                onClick={handleInvite}
                style={{
                  backgroundColor: '#F0DB4F',
                  color: '#1e1e2f',
                  border: 'none',
                  borderRadius: '20px',
                  padding: '0.4rem 1.5rem',
                  marginRight: '0.2rem',
                  fontSize: '0.9rem',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  marginTop: '0px', 
                }}
              >
                <span style={{ fontSize: '1.2rem' }}>+</span>
                招待
              </button>
            )}
          </div>
        </div>
      </div>

      {/* スクロール可能なコンテンツエリア */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '1.5rem',
          paddingTop: '6rem', // ヘッダーの高さ分のパディングを追加
          boxSizing: 'border-box',
          paddingBottom: '5rem', // フッターの高さよりも大きくする
        }}
      >
        <div style={{ maxWidth: '480px', margin: '0 auto' }}>
          {/* ローディング表示 */}
          {loading && (
            <div
              style={{ textAlign: 'center', color: '#fff', padding: '2rem' }}
            >
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
              メンバー情報を読み込み中...
            </div>
          )}

          {/* グループ情報 */}
          {!loading && group && (
            <div
              style={{
                backgroundColor: '#ffffff22',
                borderRadius: '12px',
                padding: '1.5rem',
                marginTop: '0.2rem',
                marginBottom: '1.5rem',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '0.5rem',
                }}
              >
                <h3 style={{ color: '#F0DB4F', margin: 0 }}>{group.name}</h3>

                {/* メンバー数を右上に配置 */}
                <div
                  style={{
                    backgroundColor: '#F0DB4F33',
                    color: '#F0DB4F',
                    fontSize: '0.75rem',
                    padding: '0.3rem 0.6rem',
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#F0DB4F"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                  {members.length}人
                </div>
              </div>
              <p
                style={{
                  color: '#fff',
                  margin: '0 0 0.5rem 0',
                  fontSize: '0.9rem',
                }}
              >
                {group.description || 'グループの説明はありません'}
              </p>

              {/* 住所と締切時間を横並びに配置 - GroupListPageと同様のレイアウト */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginTop: '1rem',
                  fontSize: '0.8rem',
                  color: '#ddd',
                }}
              >
               

               {/* 現場住所部分 */}
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
        stroke="#F0DB4F"
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round"
        style={{
          cursor: 'pointer',
          marginTop: '2px',
          flexShrink: 0
        }}
        onClick={(e) => {
          e.stopPropagation();
          
          const address = group.address || group.settings?.location?.address;
          
          if (!address || address.trim() === '') {
            alert('このグループには住所が設定されていません。\nグループ設定で住所を追加してください。');
            return;
          }
          
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
    wordBreak: 'break-word',
    display: 'block',
    paddingRight: '10px',
    cursor: 'pointer',  // ← カーソル追加
  }}
  onClick={(e) => {  // ← クリックイベント追加
    e.stopPropagation();
    
    // 住所を取得
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
  {group.address || group.settings?.location?.address}
</span>
    </>
  ) : (
    <span style={{ color: '#ddd' }}>住所なし</span>
  )}
</div>

                {/* 締切時間 */}
                <div
                  style={{
                    whiteSpace: 'nowrap', // 改行しない
                    flexShrink: 0, // サイズを固定
                    paddingLeft: '10px', // 左側の余白（長い住所との間のスペース）
                    fontSize: '0.9rem',
                  }}
                >
                  締切: {group.settings.reportDeadline}
                </div>
              </div>
            </div>
          )}

          {/* メンバーリスト */}
          {!loading && members.length > 0 && (
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '0.8rem',
                  marginTop: '2rem',
                }}
              >
                <h3 style={{ color: '#fff', margin: 0, fontSize: '1.2rem' }}>
                  メンバー
                </h3>

                {userIsAdmin && (
  <div style={{
    display: 'flex',
    gap: '1.5rem', 
    alignItems: 'center'
  }}>
    {isEditMode && (
      <button
  onClick={handleUpdate}
  style={{
    background: 'none',
    border: 'none',
    fontSize: '0.9rem',
    cursor: 'pointer',
    color: '#F0DB4F',
    padding: '0.6rem 0',
    fontWeight: 'bold',
    outline: 'none'  // ← 追加
  }}
>
  更新
</button>
    )}
    <button
  onClick={toggleEditMode}
  style={{
    background: 'none',
    border: 'none',
    fontSize: '0.9rem',
    cursor: 'pointer',
    color: '#F0DB4F',
    padding: '0.6rem 0',
    fontWeight: 'bold',
    marginRight: '0.2rem',
    outline: 'none'  // ← 追加
  }}
>
  {isEditMode ? 'キャンセル' : '編集する'}
</button>
  </div>
)}
              </div>

              {/* メンバーリスト - 各メンバー表示 */}
              {members.map((member) => (
                <div
                  key={member.id}
                  style={{
                    backgroundColor: '#ffffff22',
                    borderRadius: '12px',
                    padding: '1rem',
                    marginBottom: '1rem',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      marginBottom: '0.5rem',
                      marginTop: '0.5rem',
                    }}
                  >
                    {/* アバター表示 */}
                    <div
                      style={{
                        width: '50px',
                        height: '50px',
                        borderRadius: '50%',
                        backgroundColor: '#F0DB4F22',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        marginRight: '1rem',
                      }}
                    >
                      <svg
                        width="30"
                        height="30"
                        viewBox="0 0 24 24"
                        fill="rgb(0, 102, 114)"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path d="M12 12C14.21 12 16 10.21 16 8C16 5.79 14.21 4 12 4C9.79 4 8 5.79 8 8C8 10.21 9.79 12 12 12ZM12 14C9.33 14 4 15.34 4 18V20H20V18C20 15.34 14.67 14 12 14Z" />
                      </svg>
                    </div>

                    {/* ユーザー情報 */}
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                        }}
                      >
                        <h4
                          style={{
                            color: '#fff',
                            margin: 0,
                            fontSize: '1.1rem',
                          }}
                        >
                          {member.username}
                        </h4>

                        {member.isAdmin && (
                          <span
                            style={{
                              backgroundColor: '#F0DB4F33',
                              color: '#F0DB4F',
                              fontSize: '0.7rem',
                              padding: '0.2rem 0.5rem',
                              borderRadius: '4px',
                            }}
                          >
                            管理者
                          </span>
                        )}
                      </div>

                      <div
                        style={{
                          color: '#ddd',
                          fontSize: '0.8rem',
                          marginTop: '0.2rem',
                        }}
                      >
                        {member.profileData.position || '役職なし'} •{' '}
                        {member.profileData.company || '会社名なし'}
                      </div>
                    </div>
                  </div>

                  {/* 編集モードでのみ表示する管理オプション */}
{isEditMode &&
  userIsAdmin &&
  member.id !== currentUser?.id && (
    <div
      style={{
        marginTop: '1rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderTop: '1px solid #ffffff22',
        paddingTop: '0.75rem',
      }}
    >
      {/* 左側: チェックボックスと削除ボタン */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '0.5rem' 
      }}>
        {/* チェックボックス */}
        <input
          type="checkbox"
          checked={selectedMembersForDeletion.has(member.id)}
          onClick={(e) => {
            e.stopPropagation();
          }}
          onChange={(e) => {
            e.stopPropagation();
            toggleMemberForDeletion(member.id);
          }}
          style={{
  width: '18px',
  height: '18px',
  minWidth: '18px',
  minHeight: '18px',
  accentColor: '#F0DB4F',
  cursor: 'pointer',
  border: '2px solid #F0DB4F',
  borderRadius: '4px',
  backgroundColor: 'rgba(255, 255, 255, 0.1)',
  appearance: 'auto',
  WebkitAppearance: 'checkbox',
}}
        />
        
        {/* チェックされた場合のみ削除ボタンを表示 */}
        {selectedMembersForDeletion.has(member.id) && (
          <button
            onClick={async (e) => {
              e.stopPropagation();
              
              const memberName = member.username;
              if (window.confirm(`${memberName}さんをグループから削除してもよろしいですか?`)) {
                try {
                  console.log('🗑️ 削除処理開始:', member.id);
                  
                  if (!groupId) {
                    console.error('❌ groupIdが存在しません');
                    return;
                  }
                  
                  await removeMemberFromGroup(groupId, member.id);
                  
                  // ローカル状態を更新
                  setMembers((prevMembers) => 
                    prevMembers.filter((m) => m.id !== member.id)
                  );
                  
                  // 選択を解除
                  setSelectedMembersForDeletion(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(member.id);
                    return newSet;
                  });
                  
                  alert(`✅ ${memberName}さんを削除しました`);
                  console.log('✅ 削除処理完了');
                  
                } catch (error) {
                  console.error('❌ メンバー削除エラー:', error);
                  alert('メンバーの削除に失敗しました');
                }
              }
            }}
            style={{
              padding: '0.4rem 1rem',
              backgroundColor: '#ff6b6b',
              color: '#ffffff',
              border: 'none',
              borderRadius: '20px',
              fontSize: '0.75rem',
              cursor: 'pointer',
              fontWeight: 'bold',
            }}
          >
            削除
          </button>
        )}
      </div>

      {/* 右側: 管理者昇格/降格ボタン */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          toggleAdminStatus(member.id);
        }}
        style={{
          padding: '0.4rem 1rem',
          backgroundColor: 'rgb(0, 102, 114)',
          color: '#F0DB4F',
          border: 'none',
          borderRadius: '20px',
          fontSize: '0.75rem',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          fontWeight: 'bold',
        }}
      >
        {member.isAdmin ? '管理者から外す' : '管理者にする'}
      </button>
    </div>
  )}
                </div>
              ))}
            </div>
          )}

          

          {/* メンバーが見つからない場合 */}
          {!loading && members.length === 0 && (
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
              メンバーはまだいません
              {userIsAdmin && (
                <p style={{ marginTop: '1rem', fontSize: '0.9rem' }}>
                  「招待」ボタンからメンバーを招待しましょう
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 招待モーダル */}
      {isInviteModalOpen && (
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
          onClick={() => setIsInviteModalOpen(false)}
        >
          <div
            style={{
              backgroundColor: '#1e1e2f',
              padding: '1.5rem',
              borderRadius: '12px',
              width: '85%',
              maxWidth: '400px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ color: '#F0DB4F', marginTop: 0, textAlign: 'center' }}>
              メンバーを招待
            </h3>

            <p style={{ color: '#fff', textAlign: 'center' }}>
              以下のリンクをコピーして招待したいメンバーに送信してください。
            </p>

            <div
              style={{
                backgroundColor: '#2a2a3a',
                padding: '0.75rem',
                borderRadius: '6px',
                marginBottom: '1.5rem',
                wordBreak: 'break-all',
                fontSize: '0.8rem',
                maxHeight: '80px',
                overflowY: 'auto',
                color: '#ddd',
              }}
            >
              {inviteLink}
            </div>

            <div
              style={{
                display: 'flex',
                gap: '1rem',
              }}
            >
              <button
                onClick={() => setIsInviteModalOpen(false)}
                style={{
                  flex: '1',
                  padding: '0.75rem',
                  backgroundColor: '#444',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                }}
              >
                閉じる
              </button>

              <button
                onClick={copyInviteLink}
                style={{
                  flex: '1',
                  padding: '0.75rem',
                  backgroundColor: '#F0DB4F',
                  color: '#1e1e2f',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '0.9rem',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                }}
              >
                リンクをコピー
              </button>
            </div>
          </div>
        </div>
      )}

      {/* グループ内フッターナビゲーション */}
      <GroupFooterNav activeTab="members" />
    </div>
  );
};

export default GroupMembersPage;
