import React, { useState } from 'react';
import Icons from './Icons';
import useLocalStorage from '../hooks/useLocalStorage';

interface AiSidebarProps {
  showSidebar: boolean;
  toggleSidebar: () => void;
  applyPrompt: (prompt: string) => void;
}

interface HistoryItem {
  date: string;
  query: string;
}

const AiSidebar: React.FC<AiSidebarProps> = ({
  showSidebar,
  toggleSidebar,
  applyPrompt,
}) => {
  const [promptsCollapsed, setPromptsCollapsed] = useState(false);
  const [history, setHistory] = useLocalStorage<HistoryItem[]>(
    'aiAnalysisHistory',
    []
  );

  const togglePrompts = () => {
    setPromptsCollapsed(!promptsCollapsed);
  };

  const promptSuggestions = [
    '作業効率はどうですか？',
    'コスト削減効果を教えて',
    '現在の問題点は？',
    '進捗状況を分析して',
    '安全性について分析して',
    'チーム連携の状況は？',
  ];

  return (
    <aside
      style={{
        position: 'fixed',
        top: '60px', // ヘッダー分
        left: showSidebar ? '0' : '-300px',
        width: '280px',
        height: 'calc(100vh - 60px - 80px)', // ヘッダーとフッター分を除く
        backgroundColor: 'white',
        borderRight: '1px solid #e0e0e0',
        transition: 'left 0.3s ease',
        zIndex: 999,
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
      }}
    >
      {/* 閉じるボタン */}
      <button
        onClick={toggleSidebar}
        style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: '#666',
          padding: '5px',
        }}
      >
        <Icons.X />
      </button>

      {/* ヘッダー */}
      <div
        style={{
          padding: '20px 15px 15px 15px',
          borderBottom: '1px solid #f0f0f0',
        }}
      >
        <h3
          style={{
            margin: '0',
            color: '#055A68',
            fontSize: '1.1rem',
            fontWeight: 'bold',
          }}
        >
          AI分析アシスタント
        </h3>
      </div>

      {/* コンテンツ */}
      <div style={{ flex: 1, padding: '15px' }}>
        {/* 分析項目セクション */}
        <div style={{ marginBottom: '25px' }}>
          <div
            onClick={togglePrompts}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              cursor: 'pointer',
              marginBottom: '10px',
              padding: '5px 0',
            }}
          >
            <h4
              style={{
                margin: '0',
                color: '#333',
                fontSize: '0.9rem',
                fontWeight: '600',
              }}
            >
              分析項目
            </h4>
            <span style={{ color: '#666', fontSize: '0.8rem' }}>
              {promptsCollapsed ? '▼' : '▲'}
            </span>
          </div>

          {!promptsCollapsed && (
            <ul
              style={{
                listStyle: 'none',
                padding: '0',
                margin: '0',
              }}
            >
              {promptSuggestions.map((prompt, index) => (
                <li
                  key={index}
                  onClick={() => applyPrompt(prompt)}
                  style={{
                    padding: '8px 12px',
                    marginBottom: '5px',
                    backgroundColor: '#f8f9fa',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    color: '#333',
                    border: '1px solid transparent',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#e9ecef';
                    e.currentTarget.style.borderColor = '#055A68';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#f8f9fa';
                    e.currentTarget.style.borderColor = 'transparent';
                  }}
                >
                  {prompt}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* 履歴セクション */}
        {history.length > 0 && (
          <div>
            <h4
              style={{
                margin: '0 0 10px 0',
                color: '#333',
                fontSize: '0.9rem',
                fontWeight: '600',
              }}
            >
              最近の質問
            </h4>
            <ul
              style={{
                listStyle: 'none',
                padding: '0',
                margin: '0',
              }}
            >
              {history.slice(0, 5).map((item, index) => (
                <li
                  key={index}
                  onClick={() => applyPrompt(item.query)}
                  style={{
                    padding: '8px 12px',
                    marginBottom: '5px',
                    backgroundColor: '#f1f3f4',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                    border: '1px solid transparent',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#e8f0fe';
                    e.currentTarget.style.borderColor = '#055A68';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#f1f3f4';
                    e.currentTarget.style.borderColor = 'transparent';
                  }}
                >
                  <div
                    style={{
                      color: '#666',
                      fontSize: '0.7rem',
                      marginBottom: '2px',
                    }}
                  >
                    {item.date}
                  </div>
                  <div style={{ color: '#333' }}>
                    {item.query.length > 30
                      ? item.query.substring(0, 30) + '...'
                      : item.query}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* フッター */}
      <div
        style={{
          padding: '15px',
          borderTop: '1px solid #f0f0f0',
          fontSize: '0.75rem',
          color: '#999',
          textAlign: 'center',
        }}
      >
        © 2025 PULUPPER
      </div>
    </aside>
  );
};

export default AiSidebar;
