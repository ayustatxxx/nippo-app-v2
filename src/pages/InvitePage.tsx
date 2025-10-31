import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getGroupWithFirestore } from '../utils/dbUtil';
import { getCurrentUser } from '../utils/authUtil';
import { Group, User } from '../types';
import { addUserToGroup } from '../utils/dbUtil';

const InvitePage: React.FC = () => {
  const { groupId, inviteToken } = useParams<{ groupId: string; inviteToken: string }>();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [group, setGroup] = useState<Group | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    const loadInviteData = async () => {
      try {
        setLoading(true);
        
        if (!groupId) {
          setError('無効な招待リンクです');
          return;
        }

        // ユーザー情報を取得
        const user = await getCurrentUser();
        setCurrentUser(user);

        // グループ情報を取得
        const groupData = await getGroupWithFirestore(groupId);
        if (!groupData) {
          setError('指定されたグループが見つかりません');
          return;
        }

        setGroup(groupData);


// ✅ displayNameが設定済みのユーザーのみ自動入力
if (user && user.displayName) {
  setDisplayName(user.displayName);
}

        // 既にメンバーかどうかチェック
        if (user && groupData.members) {
          const isAlreadyMember = groupData.members.some(
            member => typeof member === 'string' ? member === user.id : member.id === user.id
          );
          
          if (isAlreadyMember) {
            setError('あなたは既にこのグループのメンバーです');
            return;
          }
        }

      } catch (err) {
        console.error('招待データの読み込みエラー:', err);
        setError('招待情報の読み込みに失敗しました');
      } finally {
        setLoading(false);
      }
    };

    loadInviteData();
  }, [groupId, inviteToken]);

  // グループに参加する処理
  const handleJoinGroup = async () => {
  if (!currentUser || !group || !groupId) return;

  // 表示名の入力チェックを追加
  if (!displayName.trim()) {
    alert('ユーザー名を入力してください');
    return;
  }

  try {
    setJoining(true);

    console.log('🚀 グループ参加処理開始:', {
      userId: currentUser.id,
      groupId: groupId,
      groupName: group.name,
      displayName: displayName.trim()
    });

    // ⭐ 修正1: displayNameを保存する処理を追加
    console.log('💾 ユーザー表示名を保存:', displayName.trim());
    
    // Firestoreのユーザー情報を更新
    const { doc, updateDoc } = await import('firebase/firestore');
    const { db } = await import('../firebase/firestore');
    
    const userRef = doc(db, 'users', currentUser.id);
    await updateDoc(userRef, {
      displayName: displayName.trim(),
      username: displayName.trim(), // usernameにも保存
      updatedAt: Date.now()
    });
    
    console.log('✅ ユーザー表示名の保存完了');
    
    // ⭐ 修正2: ローカルストレージにも保存
    localStorage.setItem('daily-report-profile-name', displayName.trim());
    localStorage.setItem('daily-report-username', displayName.trim());

    // addUserToGroup 関数を呼び出し
    const success = await addUserToGroup(groupId, currentUser.id);

      if (success) {
        // 成功メッセージを表示後、グループページに遷移
        alert(`✅ ${group.name}に参加しました！`);
        navigate(`/group/${groupId}`);
      } else {
        alert('❌ グループへの参加に失敗しました。もう一度お試しください。');
      }

    } catch (error) {
      console.error('❌ グループ参加エラー:', error);
      alert('❌ グループへの参加に失敗しました。しばらく後でもう一度お試しください。');
    } finally {
      setJoining(false);
    }
  };

  // ログインが必要な場合
  if (!loading && !currentUser) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(to top, rgb(7, 112, 144), rgb(7, 107, 127), rgb(0, 102, 114))',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '1.5rem'
      }}>
        <div style={{
          backgroundColor: '#ffffff22',
          borderRadius: '12px',
          padding: '2rem',
          textAlign: 'center',
          maxWidth: '400px',
          width: '100%'
        }}>
          <h2 style={{ color: '#F0DB4F', marginBottom: '1rem' }}>
            グループに参加
          </h2>
          <p style={{ color: '#fff', marginBottom: '2rem' }}>
            グループに参加するにはログインが必要です
          </p>
          <button
            onClick={() => navigate('/login')}
            style={{
              backgroundColor: '#F0DB4F',
              color: '#1e1e2f',
              border: 'none',
              borderRadius: '8px',
              padding: '1rem 2rem',
              fontSize: '1rem',
              fontWeight: 'bold',
              cursor: 'pointer',
              width: '100%'
            }}
          >
            ログインページへ
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(to top, rgb(7, 112, 144), rgb(7, 107, 127), rgb(0, 102, 114))',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '1.5rem'
    }}>
      <div style={{
        backgroundColor: '#ffffff22',
        borderRadius: '12px',
        padding: '2rem',
        textAlign: 'center',
        maxWidth: '400px',
        width: '100%'
      }}>
        {loading && (
          <>
            <div style={{
              width: '30px',
              height: '30px',
              border: '3px solid rgba(240, 219, 79, 0.3)',
              borderTop: '3px solid #F0DB4F',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 1rem'
            }}></div>
            <style>
  {`
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    input::placeholder { color: #666666 !important; }
  `}
</style>
            <p style={{ color: '#fff' }}>招待情報を確認中...</p>
          </>
        )}

        {error && (
          <>
            <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>❌</div>
            <h2 style={{ color: '#F0DB4F', marginBottom: '1rem' }}>
              招待リンクエラー
            </h2>
            <p style={{ color: '#fff', marginBottom: '2rem' }}>
              {error}
            </p>
            <button
              onClick={() => navigate('/')}
              style={{
                backgroundColor: '#F0DB4F',
                color: '#1e1e2f',
                border: 'none',
                borderRadius: '8px',
                padding: '1rem 2rem',
                fontSize: '1rem',
                fontWeight: 'bold',
                cursor: 'pointer',
                width: '100%'
              }}
            >
              ホームに戻る
            </button>
          </>
        )}

        {!loading && !error && group && currentUser && (
          <>
            <h2 style={{ color: '#F0DB4F', marginBottom: '3rem' }}>
              グループ招待
              </h2>
            
            <div style={{ textAlign: 'left', marginBottom: '2rem', paddingLeft: '1rem' }}>
  <h3 style={{ 
    color: '#fff', 
    marginBottom: '0.5rem',
    fontSize: '1.2rem',
    fontWeight: 'bold'
  }}>
    {group.name}
  </h3>
  <p style={{ 
    color: '#ddd', 
    fontSize: '0.9rem',
    marginBottom: '0'
  }}>
    {group.description || 'このグループに参加しませんか？'}
  </p>
</div>
            
            {/* グループ詳細情報 */}
            <div style={{
              backgroundColor: '#ffffff11',
              borderRadius: '8px',
              padding: '1rem',
              marginBottom: '2rem',
              textAlign: 'left'
            }}>
              
              {/* ここにグループ名と説明を追加 */}
  
  <div style={{ color: '#fff', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
  <strong>現場住所:</strong> {group.address || group.settings?.location?.address || '未設定'}
</div>
<div style={{ color: '#fff', fontSize: '0.9rem' }}>
  <strong>メンバー数:</strong> {group.members?.length || 0}人
</div>
</div>

            {/* ユーザー名入力フィールド - 修正版 */}
            {/* ユーザー名入力フィールド - 修正版 */}
<div style={{ marginBottom: '2rem' }}>
  <label style={{
    display: 'block',
    color: '#F0DB4F',
    fontSize: '0.9rem',
    fontWeight: '600',
    marginBottom: '0.5rem',
    textAlign: 'left'
  }}>
    ユーザー名
  </label>
  
  {currentUser?.displayName ? (
    // 既にユーザー名がある場合：表示のみ
    <div style={{
      width: '100%',
      padding: '0.8rem',
      backgroundColor: '#ffffff88',
      border: '1px solid #ffffff44',
      borderRadius: '8px',
      color: '#000',
      fontSize: '1rem',
      boxSizing: 'border-box',
      fontWeight: 'bold'
    }}>
      {displayName}
    </div>
  ) : (
    // ユーザー名がない場合：入力欄を表示
    <input
      type="text"
      value={displayName}
      onChange={(e) => setDisplayName(e.target.value)}
      placeholder="アプリ内で表示する名前"
      style={{
        width: '100%',
        padding: '0.8rem',
        backgroundColor: '#ffffff88',
        border: '1px solid #ffffff44',
        borderRadius: '8px',
        color: '#000',
        fontSize: '1rem',
        boxSizing: 'border-box'
      }}
    />
  )}
</div>

            {/* ボタン */}
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                onClick={() => navigate('/')}
                style={{
                  flex: 1,
                  backgroundColor: 'transparent',
                  color: '#fff',
                  border: '2px solid #fff',
                  borderRadius: '8px',
                  padding: '1rem',
                  fontSize: '1rem',
                  cursor: 'pointer'
                }}
              >
                キャンセル
              </button>
              

              
              <button
                onClick={handleJoinGroup}
                disabled={joining || !displayName.trim()}
                style={{
                  flex: 1,
                  backgroundColor: (joining || !displayName.trim()) ? '#999' : '#F0DB4F',
                  color: '#1e1e2f',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '1rem',
                  fontSize: '1rem',
                  fontWeight: 'bold',
                  cursor: (joining || !displayName.trim()) ? 'not-allowed' : 'pointer',
                  opacity: (joining || !displayName.trim()) ? 0.7 : 1
                }}
              >
                {joining ? '参加中...' : '参加する'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default InvitePage;