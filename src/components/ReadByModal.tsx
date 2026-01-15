import React from 'react';
import { getDisplayNameSafe } from '../core/SafeUnifiedDataManager';

// 🎯 このモーダルが受け取る情報（プロップス）
interface ReadByModalProps {
  isOpen: boolean;
  onClose: () => void;
  readBy: { [userId: string]: number };
}

// 📦 ReadByModalコンポーネント
const ReadByModal: React.FC<ReadByModalProps> = ({ isOpen, onClose, readBy }) => {
  
  // モーダルが閉じている時は何も表示しない
  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',  // 半透明の黒背景
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 10000,
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '24px',
        maxWidth: '400px',
        width: '90%',
        maxHeight: '80vh',
        overflow: 'auto',
      }}>
        {/* ヘッダー部分 */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
        }}>
          <h3 style={{ margin: 0, fontSize: '18px', color: '#055A68' }}>
            既読したユーザー
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#666',
            }}
          >
            ×
          </button>
        </div>

       {/* 既読ユーザーのリスト */}
        <div>
          {Object.entries(readBy || {}).length === 0 ? (
            // 既読ユーザーがいない場合
            <p style={{ color: '#999', textAlign: 'center', padding: '20px' }}>
              まだ誰も既読していません
            </p>
          ) : (
        // 既読ユーザーがいる場合、一人ずつ表示
        <ReadByUserList readBy={readBy} />
            
          )}
        </div>
      </div>
    </div>
  );
};

// 📦 既読ユーザーリストを表示するサブコンポーネント
const ReadByUserList: React.FC<{ readBy: { [userId: string]: number } }> = ({ readBy }) => {
  const [userNames, setUserNames] = React.useState<{ [userId: string]: string }>({});
  const [isLoading, setIsLoading] = React.useState(true);

  // ユーザー名を非同期で取得
  React.useEffect(() => {
    
    setIsLoading(true);
    const fetchUserNames = async () => {
      const names: { [userId: string]: string } = {};
      
      for (const [userId] of Object.entries(readBy || {})) {
        const displayName = await getDisplayNameSafe(userId);
        names[userId] = displayName || 'ユーザー';
      }
      
      setUserNames(names);
      setIsLoading(false);
    };

    fetchUserNames();
  }, [readBy]);

  return (
    <>
      {Object.entries(readBy || {}).map(([userId, timestamp]) => {
        const userName = userNames[userId] || '読み込み中...';
        
        // タイムスタンプを日時に変換
        const readDate = new Date(timestamp);
        const formattedDate = `${readDate.getFullYear()}/${String(readDate.getMonth() + 1).padStart(2, '0')}/${String(readDate.getDate()).padStart(2, '0')} ${String(readDate.getHours()).padStart(2, '0')}:${String(readDate.getMinutes()).padStart(2, '0')}`;

        return (
          <div
            key={userId}
            style={{
              padding: '12px',
              borderBottom: '1px solid #eee',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}
          >
           <div style={{ 
  width: '40px',
  height: '40px',
  borderRadius: '50%',
  backgroundColor: '#E8EEF0',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
}}>
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 12C14.21 12 16 10.21 16 8C16 5.79 14.21 4 12 4C9.79 4 8 5.79 8 8C8 10.21 9.79 12 12 12ZM12 14C9.33 14 4 15.34 4 18V20H20V18C20 15.34 14.67 14 12 14Z" fill="#055A68"/>
  </svg>
</div>
            <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 'bold', marginBottom: '4px', color: '#055A68' }}>
  {userName}
</div>
              <div style={{ fontSize: '13px', color: '#666' }}>
                {formattedDate}
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
};
export default ReadByModal;