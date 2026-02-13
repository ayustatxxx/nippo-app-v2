import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/firestore';
import { auth } from '../firebase/config';
import { onAuthStateChanged } from 'firebase/auth';

/**
 * 会議サマリー下書き編集ページ
 * 
 * Phase 1 Week 2 - Day 6-7
 * 管理者が会議の要約とタスクを確認・編集してから共有する
 */

interface MeetingAction {
  assignee: string;
  task: string;
  deadline: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  exp: number;
}

interface MeetingSummary {
  title: string;
  overview: string;
  keyPoints: string[];
  decisions: string[];
}

interface MeetingData {
  docId: string;
  docUrl: string;
  meetingTitle: string;
  meetingDate: Date;
  participants: string[];
  original: {
    summary: MeetingSummary;
    actions: MeetingAction[];
  };
  edited?: {
    summary: MeetingSummary;
    actions: MeetingAction[];
  };
  status: 'draft' | 'published';
  createdAt: Date;
  updatedAt: Date;
}

export default function MeetingSummaryDraftPage() {
  const { meetingId } = useParams<{ meetingId: string }>();
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<any>(null);

// 認証状態の監視
useEffect(() => {
  const unsubscribe = onAuthStateChanged(auth, (user) => {
    setCurrentUser(user);
  });
  return unsubscribe;
}, []);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [meetingData, setMeetingData] = useState<MeetingData | null>(null);
  
  // 編集中のデータ
  const [editedSummary, setEditedSummary] = useState<MeetingSummary | null>(null);
  const [editedActions, setEditedActions] = useState<MeetingAction[]>([]);

  // データ取得
  useEffect(() => {
  console.log('🔍 useEffect実行開始');       
  console.log('🔍 meetingId:', meetingId);   

    const fetchMeeting = async () => {
    if (!meetingId) {
      console.log('❌ meetingIdがありません:', meetingId);  
      return;
    }
    
    console.log('🔍 Firestoreからデータ取得開始:', meetingId);  
      
      try {
        const docRef = doc(db, 'meeting_summaries', meetingId);
        console.log('🔍 docRef作成完了');

        const docSnap = await getDoc(docRef);
        console.log('🔍 getDoc完了, exists:', docSnap.exists());
        
        if (docSnap.exists()) {
          console.log('📊 Firestoreからデータ取得成功:', docSnap.data()); 
          const data = docSnap.data() as MeetingData;
          console.log('📊 型変換後のdata:', data); 
          setMeetingData(data);
          
          // 編集データがあればそれを、なければ直接のデータを使用
const summaryToEdit = data.edited?.summary || data.original?.summary || (data as any).summary;
const actionsToEdit = data.edited?.actions || data.original?.actions || (data as any).actions;

console.log('📊 summaryToEdit:', summaryToEdit);  
console.log('📊 actionsToEdit:', actionsToEdit); 
          
          setEditedSummary(summaryToEdit);
          setEditedActions(actionsToEdit);
        }
      } catch (error) {
        console.error('Error fetching meeting:', error);
        alert('会議データの取得に失敗しました');
      } finally {
        setLoading(false);
      }
    };
    
    fetchMeeting();
  }, [meetingId]);

  // 下書き保存
  const handleSave = async () => {
    if (!meetingId || !editedSummary) return;
    
    setSaving(true);
    try {
      const docRef = doc(db, 'meeting_summaries', meetingId);
      await updateDoc(docRef, {
        edited: {
          summary: editedSummary,
          actions: editedActions,
        },
        updatedAt: serverTimestamp(),
      });
      
      alert('下書きを保存しました');
    } catch (error) {
      console.error('Error saving draft:', error);
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
        edited: {
          summary: editedSummary,
          actions: editedActions,
        },
        status: 'published',
        publishedAt: serverTimestamp(),
        publishedBy: currentUser?.uid,
      });
      
      alert('共有しました！');
      navigate('/group'); // グループページに戻る
    } catch (error) {
      console.error('Error publishing:', error);
      alert('共有に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  // タスクの編集
  const handleActionChange = (index: number, field: keyof MeetingAction, value: any) => {
    const newActions = [...editedActions];
    newActions[index] = {
      ...newActions[index],
      [field]: value,
    };
    setEditedActions(newActions);
  };

  // タスクの削除
  const handleDeleteAction = (index: number) => {
    const confirmed = window.confirm('このタスクを削除しますか？');
    if (!confirmed) return;
    
    const newActions = editedActions.filter((_, i) => i !== index);
    setEditedActions(newActions);
  };

  // タスクの追加
  const handleAddAction = () => {
    const newAction: MeetingAction = {
      assignee: '',
      task: '',
      deadline: new Date().toISOString(),
      priority: 'medium',
      exp: 50,
    };
    setEditedActions([...editedActions, newAction]);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">読み込み中...</div>
      </div>
    );
  }

  if (!meetingData || !editedSummary) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">会議データが見つかりません</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* ヘッダー */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">
          📋 {meetingData.meetingTitle}（下書き）
        </h1>
        <div className="text-sm text-gray-600">
          参加者: {meetingData.participants.join(', ')}
        </div>
      </div>

      {/* 要約セクション */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-bold mb-4">要約</h2>
        
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">会議タイトル</label>
          <input
            type="text"
            value={editedSummary.title}
            onChange={(e) => setEditedSummary({
              ...editedSummary,
              title: e.target.value,
            })}
            className="w-full border rounded p-2"
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">概要</label>
          <textarea
            value={editedSummary.overview}
            onChange={(e) => setEditedSummary({
              ...editedSummary,
              overview: e.target.value,
            })}
            rows={5}
            className="w-full border rounded p-2"
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">重要ポイント</label>
          {editedSummary.keyPoints.map((point, index) => (
            <div key={index} className="mb-2">
              <input
                type="text"
                value={point}
                onChange={(e) => {
                  const newPoints = [...editedSummary.keyPoints];
                  newPoints[index] = e.target.value;
                  setEditedSummary({
                    ...editedSummary,
                    keyPoints: newPoints,
                  });
                }}
                className="w-full border rounded p-2"
                placeholder={`重要ポイント ${index + 1}`}
              />
            </div>
          ))}
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">決定事項</label>
          {editedSummary.decisions.map((decision, index) => (
            <div key={index} className="mb-2">
              <input
                type="text"
                value={decision}
                onChange={(e) => {
                  const newDecisions = [...editedSummary.decisions];
                  newDecisions[index] = e.target.value;
                  setEditedSummary({
                    ...editedSummary,
                    decisions: newDecisions,
                  });
                }}
                className="w-full border rounded p-2"
                placeholder={`決定事項 ${index + 1}`}
              />
            </div>
          ))}
        </div>
      </div>

      {/* タスク一覧セクション */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-bold mb-4">タスク一覧</h2>
        
        {editedActions.length === 0 ? (
          <div className="text-gray-500 text-center py-8">
            タスクがありません
          </div>
        ) : (
          editedActions.map((action, index) => (
            <div key={index} className="border rounded p-4 mb-4">
              <div className="grid grid-cols-2 gap-4 mb-3">
                <div>
                  <label className="block text-sm font-medium mb-1">担当者</label>
                  <input
                    type="text"
                    value={action.assignee}
                    onChange={(e) => handleActionChange(index, 'assignee', e.target.value)}
                    className="w-full border rounded p-2"
                    placeholder="担当者名"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">優先度</label>
                  <select
                    value={action.priority}
                    onChange={(e) => handleActionChange(index, 'priority', e.target.value)}
                    className="w-full border rounded p-2"
                  >
                    <option value="urgent">🔴 urgent</option>
                    <option value="high">🟠 high</option>
                    <option value="medium">🟡 medium</option>
                    <option value="low">🟢 low</option>
                  </select>
                </div>
              </div>

              <div className="mb-3">
                <label className="block text-sm font-medium mb-1">タスク内容</label>
                <input
                  type="text"
                  value={action.task}
                  onChange={(e) => handleActionChange(index, 'task', e.target.value)}
                  className="w-full border rounded p-2"
                  placeholder="タスク内容"
                />
              </div>

              <div className="grid grid-cols-2 gap-4 mb-3">
                <div>
                  <label className="block text-sm font-medium mb-1">期限</label>
                  <input
                    type="datetime-local"
                    value={action.deadline.slice(0, 16)}
                    onChange={(e) => handleActionChange(index, 'deadline', e.target.value + ':00Z')}
                    className="w-full border rounded p-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">EXP</label>
                  <input
                    type="number"
                    value={action.exp}
                    onChange={(e) => handleActionChange(index, 'exp', parseInt(e.target.value))}
                    className="w-full border rounded p-2"
                    min="10"
                    max="100"
                  />
                </div>
              </div>

              <button
                onClick={() => handleDeleteAction(index)}
                className="text-red-600 text-sm hover:underline"
              >
                🗑️ このタスクを削除
              </button>
            </div>
          ))
        )}

        <button
          onClick={handleAddAction}
          className="w-full border-2 border-dashed border-gray-300 rounded p-3 text-gray-600 hover:border-gray-400 hover:text-gray-800"
        >
          + タスクを追加
        </button>
      </div>

      {/* アクションボタン */}
      <div className="flex gap-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 bg-gray-200 text-gray-800 py-3 rounded-lg font-medium hover:bg-gray-300 disabled:opacity-50"
        >
          {saving ? '保存中...' : '下書きを保存'}
        </button>
        <button
          onClick={handlePublish}
          disabled={saving}
          className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? '共有中...' : '共有する'}
        </button>
      </div>
    </div>
  );
}