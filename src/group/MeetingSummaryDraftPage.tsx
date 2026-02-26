import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, serverTimestamp, collection, getDocs, addDoc } from 'firebase/firestore';
import { db } from '../firebase/firestore';
import Header from '../components/Header';

/**
 * 議事録編集ページ - シンプル版
 * 
 * 要約を1つのテキストエリアで編集
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
}

export default function MeetingSummaryDraftPage() {
  const { meetingId, groupId } = useParams<{ meetingId: string; groupId: string }>();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [meetingData, setMeetingData] = useState<MeetingData | null>(null);
  
  // 編集中のデータ
  const [editedTitle, setEditedTitle] = useState('');
  const [editedSummary, setEditedSummary] = useState('');

  // 修正前の元データ（フィードバック学習用）
const [originalTitle, setOriginalTitle] = useState('');
const [originalSummary, setOriginalSummary] = useState('');

  // ユーザー情報
  const [currentUserId, setCurrentUserId] = useState('');
  const [currentUserName, setCurrentUserName] = useState('');
  
  // グループ選択（groupIdがnullの場合）
  const [groups, setGroups] = useState<{id: string; name: string}[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [meetingGroupId, setMeetingGroupId] = useState<string | null>(null);

  // データ取得
  // ユーザー情報とグループ一覧を取得
  useEffect(() => {
    const uid = localStorage.getItem("daily-report-user-id") || '';
    setCurrentUserId(uid);
    
    // ユーザー名をFirestoreから取得
    if (uid) {
      getDoc(doc(db, 'users', uid)).then((snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setCurrentUserName(data.displayName || data.username || '');
        }
      });
    }

    // グループ一覧を取得
    getDocs(collection(db, 'groups')).then((snap) => {
      const list = snap.docs.map(d => ({ id: d.id, name: d.data().name || d.data().groupName || '' }));
      setGroups(list);
    });
  }, []);

  useEffect(() => {
    const fetchMeeting = async () => {
      if (!meetingId) return;
      
      try {
        const docRef = doc(db, 'meeting_summaries', meetingId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data() as any;
          setMeetingData(data);
          setMeetingGroupId(data.groupId || null);
          
          // 編集用データを初期化
          setEditedTitle(data.meetingTitle || '');
          setOriginalTitle(data.meetingTitle || '');
          
          // 編集済みテキストがあればそちらを優先
          if (data.editedSummaryText) {
            setEditedSummary(data.editedSummaryText);
            setOriginalSummary(data.editedSummaryText);
            return;
          }
          
          // 要約テキストを生成
          let summaryText = '';
          if (data.summary.keyPoints && data.summary.keyPoints.length > 0) {



            summaryText += '■ 重要ポイント\n';
            data.summary.keyPoints.forEach((point: string) => {
              summaryText += `・${point}\n`;
            });
            summaryText += '\n';
          }
          
          if (data.summary.decisions && data.summary.decisions.length > 0) {
            summaryText += '■ 決定事項\n';
            data.summary.decisions.forEach((decision: string) => {
              summaryText += `・${decision}\n`;
            });
            summaryText += '\n';
          }
          
          if (data.actions && data.actions.length > 0) {
            summaryText += '■ タスク\n';
            data.actions.forEach((action: MeetingAction) => {
              summaryText += `・${action.assignee}さん\n`;
              summaryText += `  ${action.task}\n`;
              if (action.deadline) {
                const deadlineDate = new Date(action.deadline);
                summaryText += `  期限: ${deadlineDate.toLocaleDateString('ja-JP')}\n`;
              }
              summaryText += '\n';
            });
          }
          
          setEditedSummary(summaryText);
          setOriginalSummary(summaryText);
        }
      } catch (error) {
        console.error('Error fetching meeting:', error);
        alert('データの取得に失敗しました');
      } finally {
        setLoading(false);
      }
    };
    
    fetchMeeting();
  }, [meetingId]);

  // 下書き保存
const handleSave = async () => {
  if (!meetingId) return;
  
  setSaving(true);
  try {
    // 修正差分をFirestoreに記録（フィードバック学習用）
const effectiveGroupId = meetingGroupId || selectedGroupId;
if (effectiveGroupId) {
  const corrections: {field: string; before: string; after: string}[] = [];
  
  if (originalSummary !== editedSummary) {
    corrections.push({ field: 'summary', before: originalSummary, after: editedSummary });
  }
  
  if (corrections.length > 0) {
    const logsRef = collection(db, 'correction_logs', effectiveGroupId, 'logs');
    for (const correction of corrections) {
      await addDoc(logsRef, {
        ...correction,
        meetingId,
        correctedBy: currentUserId,
        correctedAt: new Date(),
      });
    }
  }
}
    const docRef = doc(db, 'meeting_summaries', meetingId);
    await updateDoc(docRef, {
      meetingTitle: editedTitle,
      // 要約テキストはそのまま保存（後で構造化が必要な場合は追加）
      editedSummaryText: editedSummary,
      updatedAt: serverTimestamp(),
    });
    
    alert('下書きを保存しました');
    // 詳細ページに遷移
    navigate(`/group/${groupId}/meeting-summary/${meetingId}`);
  } catch (error) {
    console.error('Error saving:', error);
    alert('保存に失敗しました');
  } finally {
    setSaving(false);
  }
};

  // 共有（公開）
  const handlePublish = async () => {
    if (!meetingId) return;
    
    const confirmed = window.confirm('この内容でグループに共有しますか？');
    if (!confirmed) return;
    
    setSaving(true);
    try {
      const docRef = doc(db, 'meeting_summaries', meetingId);
     await updateDoc(docRef, {
        meetingTitle: editedTitle,
        editedSummaryText: editedSummary,
        status: 'published',
        visibleTo: null,
        publishedAt: serverTimestamp(),
        publishedBy: currentUserId,
        publishedByName: currentUserName,
        groupId: selectedGroupId || meetingGroupId || null,
      });
      
      alert('共有しました！');
      window.location.href = '/';
    } catch (error) {
      console.error('Error publishing:', error);
      alert('共有に失敗しました');
    } finally {
      setSaving(false);
    }
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
    <div style={{ backgroundColor: '#F5F5F5', minHeight: '100vh', paddingBottom: '160px' }}>
      {/* ヘッダー（戻るボタンなし） */}
      <Header 
        title="議事録を編集"
        showBackButton={false}
      />

      {/* コンテンツエリア */}
      <div style={{ 
        maxWidth: '480px', 
        margin: '0 auto',
        padding: '1rem',
        paddingTop: '70px'
      }}>
        
        {/* 参加者と会議日時（1つにまとめる） */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '16px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{ marginBottom: '12px' }}>
            <div style={{ 
              fontSize: '13px', 
              color: '#666',
              marginBottom: '4px' 
            }}>
              参加者
            </div>
            <div style={{ fontSize: '15px', color: '#333' }}>
              {meetingData.participants.join('、')}
            </div>
          </div>
          
          {meetingData.meetingDate && (
            <div>
              <div style={{ 
                fontSize: '13px', 
                color: '#666',
                marginBottom: '4px' 
              }}>
                会議日時
              </div>
              <div style={{ fontSize: '15px', color: '#333' }}>
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
        </div>

        {/* グループ選択（groupIdが未設定の場合のみ表示） */}
        {!meetingGroupId && (
          <div style={{
            backgroundColor: '#FFF8E1',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '16px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
            border: '1px solid #FFE082'
          }}>
            <div style={{ fontSize: '13px', color: '#F57F17', marginBottom: '8px', fontWeight: '600' }}>
              ⚠️ グループを選択してください
            </div>
            <select
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              style={{
                width: '100%',
                border: '1px solid #ddd',
                borderRadius: '8px',
                padding: '12px',
                fontSize: '15px',
                boxSizing: 'border-box' as const,
                backgroundColor: 'white'
              }}
            >
              <option value="">グループを選択...</option>
              {groups.map(g => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* 会議タイトル（編集可能） */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '16px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{ 
            fontSize: '13px', 
            color: '#666',
            marginBottom: '8px' 
          }}>
            会議タイトル
          </div>
          <input
            type="text"
            value={editedTitle}
            onChange={(e) => setEditedTitle(e.target.value)}
            style={{
              width: '100%',
              border: '1px solid #ddd',
              borderRadius: '8px',
              padding: '12px',
              fontSize: '15px',
              boxSizing: 'border-box'
            }}
            placeholder="会議タイトルを入力"
          />
        </div>

        {/* 要約（編集可能） */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '16px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{ 
            fontSize: '13px', 
            color: '#666',
            marginBottom: '8px' 
          }}>
            要約
          </div>
          <textarea
            value={editedSummary}
            onChange={(e) => setEditedSummary(e.target.value)}
            style={{
              width: '100%',
              minHeight: '400px',
              border: '1px solid #ddd',
              borderRadius: '8px',
              padding: '12px',
              fontSize: '15px',
              lineHeight: '1.8',
              boxSizing: 'border-box',
              fontFamily: 'inherit',
              resize: 'vertical'
            }}
            placeholder="要約を入力してください"
          />
        </div>
      </div>

  {/* 固定ボタン */}
      <div style={{
        position: 'fixed',
        bottom: '0',
        left: '0',
        right: '0',
        backgroundColor: 'white',
        padding: '30px 16px 48px 16px',
        borderTop: '1px solid #e0e0e0',
        boxShadow: '0 -2px 10px rgba(0,0,0,0.05)',
        maxWidth: '480px',
        margin: '0 auto'
      }}>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={() => navigate(`/group/${groupId}/meeting-summary/${meetingId}`)}
            style={{
              flex: 1,
              backgroundColor: '#E0E0E0',
              color: '#333',
              padding: '14px',
              borderRadius: '8px',
              border: 'none',
              fontSize: '16px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            キャンセル
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              flex: 1,
              backgroundColor: '#055A68',
              color: 'white',
              padding: '14px',
              borderRadius: '8px',
              border: 'none',
              fontSize: '16px',
              fontWeight: '600',
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.6 : 1
            }}
          >
            {saving ? '保存中...' : '下書きを保存'}
          </button>
        </div>
      </div>
    </div>
  );
}