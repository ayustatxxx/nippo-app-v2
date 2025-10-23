// src/components/AuthGuard.tsx
import React, { useState, useEffect, ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getCurrentUser } from '../firebase/auth';
import { DisplayNameResolver } from '../utils/displayNameResolver';

interface AuthGuardProps {
  children: ReactNode;
}

const AuthGuard: React.FC<AuthGuardProps> = ({ children }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // プロフィール完了チェック関数
  const checkProfileCompletion = (user: any): boolean => {
    if (!user) return false;
    
    const displayName = DisplayNameResolver.resolve(user);
    
    // 必須項目チェック - company要件を削除
const hasRequiredFields = !!(
  displayName && 
  displayName.trim() !== '' &&
  displayName !== 'ユーザー' &&
  displayName !== 'User' &&
  user?.email
);
    
    console.log('📋 プロフィール完了チェック:', {
      displayName,
      email: user?.email,
      company: user?.profileData?.company,
      isComplete: hasRequiredFields
    });
    
    return hasRequiredFields;
  };

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Firebase認証チェック
       const user = await getCurrentUser();
        
        if (user) {
          console.log('✅ 認証済みユーザー:', user.email);
          
          // ローカルストレージからユーザー詳細情報を取得
          const userDataStr = localStorage.getItem('daily-report-user-data');
          let userData = null;
          
          if (userDataStr) {
            try {
              userData = JSON.parse(userDataStr);
              console.log('📱 ローカルユーザーデータ取得成功');
            } catch (error) {
              console.warn('⚠️ ローカルユーザーデータ解析エラー:', error);
            }
          }
          
          // プロフィール完了チェック
          const targetUser = userData || user;
          const isProfileComplete = checkProfileCompletion(targetUser);
          
          // プロフィール未完了の場合の処理
          if (!isProfileComplete && location.pathname !== '/profile') {
            console.log('🔄 プロフィール未完了 - Profileページにリダイレクト');
            
            // 現在のパスを保存（プロフィール完了後に戻るため）
            sessionStorage.setItem('redirectAfterProfile', location.pathname + location.search);
            
            // プロフィールページにリダイレクト（required=trueパラメータ付き）
            navigate('/profile?required=true', { replace: true });
            setIsLoading(false);
            return;
          }
          
          setIsAuthenticated(true);
          console.log('🎉 認証・プロフィール確認完了');
          
        } else {
          console.log('❌ 未認証 - ログインページへ');
          setIsAuthenticated(false);
          
          // 現在のURLを保存
          const currentPath = location.pathname + location.search;
          sessionStorage.setItem('redirectAfterLogin', currentPath);
          
          navigate('/login', { replace: true });
        }
        
      } catch (error) {
        console.error('🚨 認証チェックエラー:', error);
        setIsAuthenticated(false);
        navigate('/login', { replace: true });
      }
      
      setIsLoading(false);
    };

    // 短い遅延を設けて初期化を待つ
    const timer = setTimeout(checkAuth, 100);
    
    return () => clearTimeout(timer);
  }, [navigate, location]);

  // ローディング画面
  if (isLoading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "linear-gradient(to top, rgb(7, 112, 144), rgb(7, 107, 127), rgb(0, 102, 114))",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <div style={{ color: "#fff", textAlign: "center" }}>
          <div
            style={{
              width: "40px",
              height: "40px",
              border: "4px solid rgba(240, 219, 79, 0.3)",
              borderTop: "4px solid #F0DB4F",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
              margin: "0 auto 1rem",
            }}
          />
          <p>認証確認中...</p>
          <style>
            {`
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            `}
          </style>
        </div>
      </div>
    );
  }

  return isAuthenticated ? <>{children}</> : null;
};

export default AuthGuard;