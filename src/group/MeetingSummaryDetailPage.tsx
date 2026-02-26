import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/firestore';
import Header from '../components/Header';

/**
 * 議事録詳細ページ（閲覧専用）
 * 投稿詳細ページのデザインを完全に流用
 */

interface MeetingAction {
  assignee: string;
  task: string;
  deadline: string;
}

interface MeetingSummary {
  title: string;
  keyPoints: string[];
  decisions: string[];
}

interface MeetingData {
  meetingTitle: string;
  meetingDate: any;
  participants: string[];
  summary: MeetingSummary;
  actions: MeetingAction[];
  status: 'draft' | 'published';
  editedSummaryText?: string;
}

export default function MeetingSummaryDetailPage() {
  const { meetingId, groupId } = useParams<{ meetingId: string; groupId: string }>();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [meetingData, setMeetingData] = useState<MeetingData | null>(null);

  // ユーザー情報
  const [currentUserId, setCurrentUserId] = useState('');
  const [currentUserName, setCurrentUserName] = useState('');
  const [groupName, setGroupName] = useState('');

  // ユーザー情報を取得
  useEffect(() => {
    const uid = localStorage.getItem("daily-report-user-id") || '';
    setCurrentUserId(uid);
    if (uid) {
      getDoc(doc(db, 'users', uid)).then((snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setCurrentUserName(data.displayName || data.username || '');
        }
      });
    }
  }, []);


  // データ取得
  useEffect(() => {
    const fetchMeeting = async () => {
      if (!meetingId) return;
      
      try {
        const docRef = doc(db, 'meeting_summaries', meetingId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data() as any;
          setMeetingData(data);

          // グループ名を取得
if (data.groupId) {
  const groupSnap = await getDoc(doc(db, 'groups', data.groupId));
  if (groupSnap.exists()) {
    setGroupName(groupSnap.data().name || '');
  }
}
        }
      } catch (error) {
        console.error('Error fetching meeting:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchMeeting();
  }, [meetingId]);

  // 要約テキストを生成
  const formatSummary = () => {
    if (!meetingData) return '';
    
    let text = '';
    
    // 会議タイトル
    if (meetingData.meetingTitle) {
      text += `【${meetingData.meetingTitle}】\n\n`;
    }
    
    // 重要ポイント
    if (meetingData.summary.keyPoints && meetingData.summary.keyPoints.length > 0) {
      text += '■ 重要ポイント\n';
      meetingData.summary.keyPoints.forEach(point => {
        text += `・${point}\n`;
      });
      text += '\n';
    }
    
    // 決定事項
    if (meetingData.summary.decisions && meetingData.summary.decisions.length > 0) {
      text += '■ 決定事項\n';
      meetingData.summary.decisions.forEach(decision => {
        text += `・${decision}\n`;
      });
      text += '\n';
    }
    
    // タスク
    if (meetingData.actions && meetingData.actions.length > 0) {
      text += '■ タスク\n';
      meetingData.actions.forEach(action => {
        text += `・${action.assignee}さん\n`;
        text += `  ${action.task}\n`;
        if (action.deadline) {
          const deadlineDate = new Date(action.deadline);
          text += `  期限: ${deadlineDate.toLocaleDateString('ja-JP')}\n`;
        }
        text += '\n';
      });
    }
    
    return text;
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: '#F5F5F5'
      }}>
        <div style={{ fontSize: '18px', color: '#666' }}>読み込み中...</div>
      </div>
    );
  }

  if (!meetingData) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: '#F5F5F5'
      }}>
        <div style={{ fontSize: '18px', color: '#666' }}>データが見つかりません</div>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: '#F5F5F5', minHeight: '100vh' }}>
      {/* ヘッダー - 投稿詳細と完全に同じ */}
     <Header 
  title="議事録"
  subtitle={meetingData.status === 'draft' ? '（下書き）' : undefined}
  showBackButton={true}
  onBackClick={() => navigate('/')}
/>

      {/* コンテンツエリア - 投稿詳細と同じレイアウト */}
      <div style={{ 
        maxWidth: '480px', 
        margin: '0 auto',
        padding: '1rem',
        paddingTop: '70px'
      }}>
        
 {/* 要約カード（参加者・会議日時・要約を統合） */}
<div style={{
  backgroundColor: 'white',
  borderRadius: '12px',
  marginBottom: '5rem',
  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
  overflow: 'hidden'
}}>
        
       {/* ヘッダー部分: エージェント（AI） */}
      <div style={{ 
        padding: '1rem',
        borderBottom: '1px solid #f0f0f0',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '1rem'
      }}>
        {/* アバター部分 */}
        <div style={{ 
          width: '50px', 
          height: '50px', 
          borderRadius: '50%', 
          backgroundColor: 'rgba(5, 90, 104, 0.1)',
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center'
        }}>
          <svg 
            width="30" 
            height="30" 
            viewBox="0 0 24 24" 
            fill="#055A68" 
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M12 12C14.21 12 16 10.21 16 8C16 5.79 14.21 4 12 4C9.79 4 8 5.79 8 8C8 10.21 9.79 12 12 12ZM12 14C9.33 14 4 15.34 4 18V20H20V18C20 15.34 14.67 14 12 14Z" />
          </svg>
        </div>
        
        {/* ユーザー情報（名前、グループ名・会社名） */}
        <div style={{ flex: 1 }}>
          <div style={{ 
            fontWeight: 'bold', 
            color: '#055A68', 
            fontSize: '1.1rem',
            marginBottom: '0.2rem'
          }}>
            エージェント（AI）
          </div>
        </div>
        
        {/* 日時表示（右上） */}
        {meetingData.meetingDate && (
          <div style={{ 
            fontSize: '0.85rem', 
            color: '#055A68',
            fontWeight: '500'
          }}>
            {new Date(meetingData.meetingDate.seconds * 1000).toLocaleString('ja-JP', {
              hour: '2-digit',
              minute: '2-digit'
            })}
          </div>
        )}
      </div>
      
     {/* グループ情報の帯 */}
<div
  onClick={() => groupId && navigate(`/group/${groupId}?from=meeting-summary`)}
  style={{
    padding: '0.6rem 1rem',
    backgroundColor: 'rgba(5, 90, 104, 0.05)',
    color: '#055A68',
    fontSize: '0.9rem',
    fontWeight: '500',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottom: '1px solid #f0f0f0',
    cursor: groupId ? 'pointer' : 'default'
  }}
>

  {groupName || 'グループ未設定'}
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#055A68"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="9,18 15,12 9,6"></polyline>
  </svg>
</div>
      
      {/* 投稿内容 */}
      <div style={{ padding: '1.2rem' }}>

        {/* AIからの一言 */}
<div style={{ 
  marginTop: '1.2rem',
  marginBottom: '0.5rem',
  color: '#666',
  fontSize: '0.9rem',
  lineHeight: '1.5'
}}>
  AIエージェントです。「{meetingData.meetingTitle}」の打ち合わせ内容をまとめました。
</div>
        
{/* 説明文 */}
<div style={{ 
  marginTop: '1.2rem', 
  marginBottom: '1rem',  // ← 0.8rem から 1rem に変更
  color: '#055A68',
  fontSize: '1rem',
  fontWeight: 'bold'
}}>
  Google Meet / 議事録の要約です。
</div>
          
         {/* 参加者 */}
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ 
              fontSize: '0.9rem', 
              color: '#055A68',
              fontWeight: 'bold',
              marginBottom: '0.5rem',
              display: 'flex',
              alignItems: 'center'
            }}>
              ■ 参加者
            </div>
            <div style={{ fontSize: '0.9rem', color: '#333', paddingLeft: '1rem' }}>
              {meetingData.participants.join('、')}
            </div>
          </div>

          {/* 会議日時 */}
          {meetingData.meetingDate && (
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ 
                fontSize: '0.9rem', 
                color: '#055A68',
                fontWeight: 'bold',
                marginBottom: '0.5rem',
                display: 'flex',
                alignItems: 'center'
              }}>
                ■ 会議日時
              </div>
              <div style={{ fontSize: '0.9rem', color: '#333', paddingLeft: '1rem' }}>
                {new Date(meetingData.meetingDate.seconds * 1000).toLocaleString('ja-JP', {
                  year: 'numeric',
                  month: '2-digit',
                  day: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </div>
            </div>
          )}

          {/* 区切り線 */}
          <div 
            style={{
              height: '1px',
              backgroundColor: 'rgba(0, 102, 114, 0.3)',
              margin: '1rem 0',
            }}
          />

         

{/* タイトル */}
<div style={{ marginBottom: '1.5rem', fontSize: '0.9rem', color: '#333' }}>
  タイトル：{meetingData.meetingTitle}
</div>


{/* 編集済みテキスト優先表示 */}
          {meetingData.editedSummaryText ? (
            <div style={{ marginBottom: '1.5rem', fontSize: '0.9rem', color: '#333', lineHeight: '1.8', whiteSpace: 'pre-wrap' }}>
              {meetingData.editedSummaryText}
            </div>
          ) : (
            <>


          {/* 重要ポイント */}
          {meetingData.summary?.keyPoints && meetingData.summary.keyPoints.length > 0 && (
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ 
                fontSize: '0.9rem', 
                color: '#055A68',
                fontWeight: 'bold',
                marginBottom: '0.5rem',
                display: 'flex',
                alignItems: 'center'
              }}>
                ■ 重要ポイント
              </div>
              <div style={{ paddingLeft: '1rem' }}>
                {meetingData.summary.keyPoints.map((point, index) => (
                  <div key={index} style={{ 
                    fontSize: '0.9rem', 
                    color: '#333',
                    marginBottom: '0.3rem',
                    lineHeight: '1.6'
                  }}>
                    ・{point}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 決定事項 */}
          {meetingData.summary?.decisions && meetingData.summary.decisions.length > 0 && (
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ 
                fontSize: '0.9rem', 
                color: '#055A68',
                fontWeight: 'bold',
                marginBottom: '0.5rem',
                display: 'flex',
                alignItems: 'center'
              }}>
                ■ 決定事項
              </div>
              <div style={{ paddingLeft: '1rem' }}>
                {meetingData.summary.decisions.map((decision, index) => (
                  <div key={index} style={{ 
                    fontSize: '0.9rem', 
                    color: '#333',
                    marginBottom: '0.3rem',
                    lineHeight: '1.6'
                  }}>
                    ・{decision}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* タスク */}
          {meetingData.actions && meetingData.actions.length > 0 && (
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ 
                fontSize: '0.9rem', 
                color: '#055A68',
                fontWeight: 'bold',
                marginBottom: '0.5rem',
                display: 'flex',
                alignItems: 'center'
              }}>
                ■ タスク
              </div>
              <div style={{ paddingLeft: '1rem' }}>
                {meetingData.actions.map((action, index) => (
                  <div key={index} style={{ 
                    marginBottom: '1rem',
                    paddingBottom: '1rem',
                    borderBottom: index < meetingData.actions.length - 1 ? '1px solid rgba(0, 102, 114, 0.1)' : 'none'
                  }}>
                    <div style={{ fontSize: '0.9rem', color: '#333', marginBottom: '0.3rem' }}>
                      ・<span style={{ fontWeight: '500' }}>{action.assignee}</span>さん
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#555', paddingLeft: '1rem', marginBottom: '0.2rem' }}>
                      {action.task}
                    </div>
                    {action.deadline && (
                      <div style={{ fontSize: '0.8rem', color: '#666', paddingLeft: '1rem' }}>
                        期限: {new Date(action.deadline).toLocaleDateString('ja-JP')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          </>
          )}
          </div>
      </div>

 {/* 編集・共有ボタン（下書きの場合のみ） */}
      {meetingData.status === 'draft' && (
      <div style={{
          position: 'fixed',
          bottom: '0',
          left: '0',
          right: '0',
          backgroundColor: 'white',
          padding: '16px 16px 48px 16px',
          borderTop: '1px solid #e0e0e0',
          boxShadow: '0 -2px 10px rgba(0,0,0,0.05)',
          maxWidth: '480px',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <button
            onClick={async () => {
              if (window.confirm('この内容でグループに共有しますか？')) {
                try {
                  const docRef = doc(db, 'meeting_summaries', meetingId!);
                  await updateDoc(docRef, {
                    status: 'published',
                    publishedAt: serverTimestamp(),
                    publishedBy: currentUserId,
                    publishedByName: currentUserName,
                  });
                  alert('共有しました！');
                  navigate(-1);
                } catch (error) {
                  console.error('Error publishing:', error);
                  alert('共有に失敗しました');
                }
              }
            }}
            style={{
              width: '60%',
              backgroundColor: '#055A68',
              color: 'white',
              padding: '14px',
              borderRadius: '8px',
              border: 'none',
              fontSize: '16px',
              fontWeight: '600',
              marginTop: '15px',
              cursor: 'pointer'
              
            }}
          >
            共有する
          </button>
          <button
            onClick={() => navigate(`/group/${groupId}/meeting-summary-draft/${meetingId}`)}
            style={{
              position: 'absolute',
              right: '16px',
              backgroundColor: 'rgb(0, 102, 114)',
              color: '#F0DB4F',
              padding: '0.5rem 1.2rem',
              borderRadius: '20px',
              border: 'none',
              fontSize: '0.9rem',
              fontWeight: 'bold',
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            編集
          </button>
        </div>
      )}
      </div>
    </div>
  );
}