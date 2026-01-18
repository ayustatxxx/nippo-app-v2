import React from 'react';

/**
 * テキスト内のURLを検出してリンクに変換する関数
 * @param text - 変換元のテキスト
 * @returns URLがリンク化されたReact要素の配列
 */
export const linkifyText = (text: string, color: string = '#0088aa'): React.ReactNode[] => {
  // URLを検出する正規表現（http, https, wwwで始まるものを検出）
  const urlRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)/g;
  
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;

  // テキスト内のすべてのURLを検索
  while ((match = urlRegex.exec(text)) !== null) {
    const url = match[0];
    const startIndex = match.index;

    // URLの前のテキストを追加
    if (startIndex > lastIndex) {
      parts.push(text.substring(lastIndex, startIndex));
    }

    // URLをリンクとして追加
    const href = url.startsWith('www.') ? `https://${url}` : url;
    parts.push(
      React.createElement(
        'a',
        {
          key: startIndex,
          href: href,
          target: '_blank',
          rel: 'noopener noreferrer',
          style: {
            color: color,
            textDecoration: 'underline',
            wordBreak: 'break-all' as const,
            overflowWrap: 'break-word' as const
          },
          onClick: (e: React.MouseEvent) => e.stopPropagation()
        },
        url
      )
    );

    lastIndex = urlRegex.lastIndex;
  }

  // 残りのテキストを追加
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
};