import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  loginWithEmailPassword, 
  signupWithEmailPassword, 
  loginWithGoogle,
  onAuthStateChange 
} from '../firebase/auth';


// 🔒 セキュリティ強化: ログイン試行制限
const useRateLimit = () => {
  const [attempts, setAttempts] = useState(0);
  const [blockedUntil, setBlockedUntil] = useState<number | null>(null);
  const [lastAttemptEmail, setLastAttemptEmail] = useState<string>('');
  
  const checkRateLimit = (email: string): boolean => {
    // メールアドレスが変わったらカウントリセット
    if (email !== lastAttemptEmail) {
      setAttempts(0);
      setBlockedUntil(null);
      setLastAttemptEmail(email);
      return true;
    }
    
    // ブロック時間中かチェック
    if (blockedUntil && Date.now() < blockedUntil) {
      const remainingTime = Math.ceil((blockedUntil - Date.now()) / (1000 * 60));
      return false; // ブロック中
    }
    
    // ブロック時間が過ぎた場合はリセット
    if (blockedUntil && Date.now() >= blockedUntil) {
      setAttempts(0);
      setBlockedUntil(null);
      return true;
    }
    
    // 最大試行回数チェック
    if (attempts >= 5) {
      const blockTime = Date.now() + (15 * 60 * 1000); // 15分
      setBlockedUntil(blockTime);
      return false;
    }
    
    return true;
  };
  
  const recordFailedAttempt = (email: string) => {
    setLastAttemptEmail(email);
    setAttempts(prev => prev + 1);
  };
  
  const resetAttempts = () => {
    setAttempts(0);
    setBlockedUntil(null);
  };
  
  const getRemainingTime = (): number => {
    if (!blockedUntil) return 0;
    return Math.ceil((blockedUntil - Date.now()) / (1000 * 60));
  };
  
  const getWarningMessage = (): string => {
    // ブロック中の場合は最優先で表示
    if (blockedUntil && Date.now() < blockedUntil) {
      const remainingTime = getRemainingTime();
      return `🔒 アカウントがロックされています。${remainingTime}分後に再試行してください。`;
    }
    
    // 警告段階（3回以上失敗）
    if (attempts >= 3 && attempts < 5) {
      const remaining = 5 - attempts;
      return `⚠️ 残り${remaining}回でアカウントがロックされます。パスワードをご確認ください。`;
    }
    
    // 注意段階（2回失敗）
    if (attempts === 2) {
      return `💡 パスワードが2回間違っています。あと3回でロックされます。`;
    }
    
    return '';
  };
  
  return { 
    checkRateLimit, 
    recordFailedAttempt, 
    resetAttempts, 
    getWarningMessage,
    attempts,
    isBlocked: blockedUntil && Date.now() < blockedUntil
  };
};


const LoginPage: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const navigate = useNavigate();

  const { 
    checkRateLimit, 
    recordFailedAttempt, 
    resetAttempts, 
    getWarningMessage,
    isBlocked 
  } = useRateLimit();



 /*
useEffect(() => {
  // Firebase認証状態を監視（条件付きリダイレクト）
  const unsubscribe = onAuthStateChange((user) => {
    if (user && window.location.pathname === '/login') {
      // ログイン済み かつ ログインページにいる場合のみリダイレクト
      console.log('認証済みユーザー、ホームページへ移動:', user.email);
      navigate("/", { replace: true });
    }
  });
  
  return () => unsubscribe();
}, []); // navigate を依存配列から削除
*/

  const validateInputs = (): boolean => {
    setErrorMessage("");
    
    // Email validation
    if (!email.trim()) {
      setErrorMessage("メールアドレスを入力してください");
      return false;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setErrorMessage("有効なメールアドレスを入力してください");
      return false;
    }
    
    // Password validation
    if (!password.trim()) {
      setErrorMessage("パスワードを入力してください");
      return false;
    }
    
    if (password.length < 6) {
      setErrorMessage("パスワードは6文字以上で入力してください");
      return false;
    }
    
    // Username validation - only check if in signup mode
    if (!isLogin && !username.trim()) {
      setErrorMessage("ユーザー名を入力してください");
      return false;
    }
    
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateInputs()) {
      return;
    }
    
    // 🔒 レート制限チェック
    if (!checkRateLimit(email)) {
      const warningMsg = getWarningMessage();
      setErrorMessage(warningMsg);
      return;
    }
    
    setIsLoading(true);
    setErrorMessage("");
    
    try {
      let result;
      
      if (isLogin) {
        result = await loginWithEmailPassword(email, password);
      } else {
        result = await signupWithEmailPassword(email, password, username);
      }
      
      if (result.success) {
        // 🔒 成功時はカウントリセット
        resetAttempts();
        
        console.log('認証成功:', result.user);
        
        // 完全なユーザーデータオブジェクトを構築
        const completeUserData = {
          id: result.user.uid,
          email: result.user.email || '',
          username: result.user.displayName || result.user.email?.split('@')[0] || 'ユーザー',
          displayName: result.user.displayName || '',
          role: result.user.email === 'info@ayustat.co.jp' ? 'admin' : 'user',
          profileData: {
            fullName: result.user.displayName || '',
            company: '',
            position: '',
            phone: ''
          },
          settings: {
            notifications: true,
            reportFrequency: 'daily'
          },
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
        
        // トークン取得
        const token = await result.user.getIdToken();
        
        // 統一された保存処理
        localStorage.setItem('daily-report-user-data', JSON.stringify(completeUserData));
        localStorage.setItem('daily-report-user-id', result.user.uid);
        localStorage.setItem('daily-report-user-email', result.user.email || '');
        localStorage.setItem('daily-report-user-token', token);
        
        console.log('✅ 完全なユーザーデータ保存完了');
        
        // 保存されたリダイレクト先URLを確認
        const redirectPath = sessionStorage.getItem('redirectAfterLogin');
        sessionStorage.removeItem('redirectAfterLogin');
      
        console.log('🚀 ナビゲーション開始:', redirectPath || '/');
      
        if (redirectPath && redirectPath !== '/login') {
          navigate(redirectPath);
          console.log('✅ 招待URLにリダイレクト完了:', redirectPath);
        } else {
          navigate("/");
          console.log('✅ ホームページにリダイレクト完了');
        }
      }
      else {
        // 🔒 失敗時は試行回数を記録
        recordFailedAttempt(email);
        
        // 🔧 警告がある場合はエラーメッセージを表示しない
        if (!getWarningMessage()) {
          const errorMsg = getJapaneseErrorMessage(result.error);
          setErrorMessage(errorMsg);
        } else {
          // 警告がある場合はエラーメッセージをクリア
          setErrorMessage("");
        }
      }

    // handleSubmit関数のcatch部分を更新
} catch (error) {
  // 🔒 エラー時も試行回数を記録
  recordFailedAttempt(email);
  
  console.error("認証エラー:", error);
  
  // 🔧 警告がある場合はエラーメッセージを表示しない
  if (!getWarningMessage()) {
    let errorMessage = "認証に失敗しました。もう一度お試しください。";
    
    if (error instanceof Error) {
      errorMessage = getJapaneseErrorMessage(error.message);
    } else if (typeof error === 'string') {
      errorMessage = getJapaneseErrorMessage(error);
    } else if (error && typeof error === 'object' && 'message' in error) {
      errorMessage = getJapaneseErrorMessage(String(error.message));
    }
    
    setErrorMessage(errorMessage);
  } else {
    // 警告がある場合はエラーメッセージをクリア
    setErrorMessage("");
  }
} finally {
  setIsLoading(false);
}
  };


  // Googleログイン処理
const handleGoogleLogin = async () => {
  setIsLoading(true);
  setErrorMessage("");
  
  try {
    const result = await loginWithGoogle();
    
    if (result.success) {
      console.log('Googleログイン成功:', result.user);

// 保存されたリダイレクト先URLを確認
const redirectPath = sessionStorage.getItem('redirectAfterLogin');
sessionStorage.removeItem('redirectAfterLogin');

if (redirectPath && redirectPath !== '/login') {
  navigate(redirectPath);
  console.log('✅ Google認証後、招待URLにリダイレクト:', redirectPath);
} else {
  navigate("/");
  console.log('✅ Google認証後、ホームページにリダイレクト');
}
    } else {
      const errorMsg = getJapaneseErrorMessage(result.error);
      setErrorMessage(errorMsg);
    }
  // handleGoogleLogin関数のcatch部分を更新
} catch (error) {
  console.error("Google認証エラー:", error);
  
  let errorMessage = "Google認証に失敗しました。もう一度お試しください。";
  
  if (error instanceof Error) {
    errorMessage = getJapaneseErrorMessage(error.message);
  } else if (typeof error === 'string') {
    errorMessage = getJapaneseErrorMessage(error);
  } else if (error && typeof error === 'object' && 'message' in error) {
    errorMessage = getJapaneseErrorMessage(String(error.message));
  }
  
  setErrorMessage(errorMessage);
} finally {
  setIsLoading(false);
}
};


// エラーメッセージを日本語化（Firebase v9対応版）
const getJapaneseErrorMessage = (error: string) => {
  console.log('🔍 受信したエラー:', error); // デバッグ用
  
  // Firebase v9のエラー形式に対応
  const errorCode = error.toLowerCase();
  
  // 認証情報関連
  if (errorCode.includes('invalid-credential') || 
      errorCode.includes('wrong-password') || 
      errorCode.includes('user-not-found')) {
    return 'メールアドレスまたはパスワードが間違っています。';
  }
  
  // メールアドレス関連
  if (errorCode.includes('invalid-email') || 
      errorCode.includes('badly-formatted')) {
    return '有効なメールアドレスを入力してください。';
  }
  
  // アカウント作成関連
  if (errorCode.includes('email-already-in-use')) {
    return 'このメールアドレスは既に使用されています。';
  }
  
  // パスワード関連
  if (errorCode.includes('weak-password')) {
    return 'パスワードが弱すぎます。6文字以上で入力してください。';
  }
  
  if (errorCode.includes('requires-recent-login')) {
    return 'セキュリティのため、再度ログインしてください。';
  }
  
  // ネットワーク関連
  if (errorCode.includes('network-request-failed') || 
      errorCode.includes('timeout')) {
    return 'ネットワークエラーが発生しました。接続を確認してください。';
  }
  
  // アカウント制限関連
  if (errorCode.includes('too-many-requests')) {
    return 'ログイン試行回数が上限に達しました。しばらく時間をおいてから再試行してください。';
  }
  
  if (errorCode.includes('user-disabled')) {
    return 'このアカウントは無効化されています。管理者にお問い合わせください。';
  }
  
  // Google認証関連
  if (errorCode.includes('popup-closed-by-user')) {
    return 'Googleログインがキャンセルされました。';
  }
  
  if (errorCode.includes('popup-blocked')) {
    return 'ポップアップがブロックされました。ブラウザの設定を確認してください。';
  }
  
  // その他のGoogle認証エラー
  if (errorCode.includes('google') || errorCode.includes('oauth')) {
    return 'Google認証でエラーが発生しました。もう一度お試しください。';
  }
  
  // 開発者向けエラー（本番では非表示にする）
  if (errorCode.includes('api-key') || errorCode.includes('project')) {
    return 'システム設定エラーです。管理者にお問い合わせください。';
  }
  
  // デフォルト（不明なエラー）
  console.warn('⚠️ 未対応のエラー:', error);
  return '認証でエラーが発生しました。もう一度お試しください。';
};




  const toggleAuthMode = () => {
    setIsLogin(!isLogin);
    setErrorMessage("");
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "linear-gradient(to top, rgb(7, 112, 144), rgb(7, 107, 127), rgb(0, 102, 114))",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: "1rem",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "400px",
          backgroundColor: "#1e1e2f",
          borderRadius: "16px",
          boxShadow: "0 4px 30px rgba(0, 0, 0, 0.2)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "2rem",
            textAlign: "center",
            borderBottom: "1px solid #2a2a3d",
          }}
        >
         <img
  src="/myquest-logo.png"
  alt="MYQUEST"
  style={{
    width: "250px",
    height: "auto",
    marginTop: "30px",  
    margin: 0,
  }}
/>
          <p
            style={{
              color: "#ffffff99",
              marginTop: "1.5rem",
              marginBottom: "-1.0rem",
            }}
          >
            {isLogin
              ? "アカウントにログインして始めましょう"
              : "新しいアカウントを作成しましょう"}
          </p>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          style={{
            padding: "2rem",
          }}
        >
        


        {/* 🔒 改善版: 警告メッセージ */}
{getWarningMessage() && (
  <div
    style={{
      padding: "0.75rem",
      backgroundColor: "#ffa50022",
      color: "#ff8c00",
      borderRadius: "8px",
      marginBottom: "1.5rem",
      fontSize: "0.9rem",
      border: "1px solid #ffa50044",
      // 🔧 追加: アニメーション効果
      animation: "fadeInWarning 0.5s ease-in-out",
    }}
  >
    {getWarningMessage()}
  </div>
)}

{/* Error message - 警告メッセージの後に表示 */}
{errorMessage && !getWarningMessage() && (
  <div
    style={{
      padding: "0.75rem",
      backgroundColor: "#ff555522",
      color: "#ff5555",
      borderRadius: "8px",
      marginBottom: "1.5rem",
      fontSize: "0.9rem",
    }}
  >
    {errorMessage}
  </div>
)}


          {/* Username field (only for signup) */}
          {!isLogin && (
            <div style={{ marginBottom: "1.5rem" }}>
              <label
                htmlFor="username"
                style={{
                  display: "block",
                  marginBottom: "0.5rem",
                  color: "#fff",
                  fontSize: "0.9rem",
                  fontWeight: "500",
                }}
              >
                ユーザーID（英数字 8〜20文字）
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="例：tanaka2024, kensetu001"
                style={{
                  width: "100%",
                  padding: "0.8rem 1rem",
                  backgroundColor: "#2e2e40",
                  border: "none",
                  borderRadius: "10px",
                  color: "#fff",
                  fontSize: "1rem",
                  boxSizing: "border-box",
                }}
              />
            </div>
          )}

          {/* Email field */}
          <div style={{ marginBottom: "1.5rem" }}>
            <label
              htmlFor="email"
              style={{
                display: "block",
                marginBottom: "0.5rem",
                color: "#fff",
                fontSize: "0.9rem",
                fontWeight: "500",
              }}
            >
              メールアドレス
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="例：yamada@company.co.jp"
              style={{
                width: "100%",
                padding: "0.8rem 1rem",
                backgroundColor: "#2e2e40",
                border: "none",
                borderRadius: "10px",
                color: "#fff",
                fontSize: "1rem",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Password field */}
          <div style={{ marginBottom: "1.5rem" }}>
            <label
              htmlFor="password"
              style={{
                display: "block",
                marginBottom: "0.5rem",
                color: "#fff",
                fontSize: "0.9rem",
                fontWeight: "500",
              }}
            >
              パスワード
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="8文字以上の英数字"
              style={{
                width: "100%",
                padding: "0.8rem 1rem",
                backgroundColor: "#2e2e40",
                border: "none",
                borderRadius: "10px",
                color: "#fff",
                fontSize: "1rem",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Remember me checkbox */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              marginBottom: "2rem",
            }}
          >
            <input
              id="remember"
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              style={{
                width: "18px",
                height: "18px",
                accentColor: "#F0DB4F",
                marginRight: "0.5rem",
                cursor: "pointer",
              }}
            />
            <label
              htmlFor="remember"
              style={{
                color: "#ddd",
                fontSize: "0.9rem",
                cursor: "pointer",
              }}
            >
              ログイン状態を保存する
            </label>
          </div>

          {/* Submit button */}
<button
  type="submit"
  disabled={isLoading || isBlocked} // 🔒 ブロック中は無効化
  style={{
    width: "100%",
    padding: "0.9rem",
    backgroundColor: (isLoading || isBlocked) ? "#666" : "#F0DB4F", // 🔒 色も変更
    color: "#1e1e2f",
    border: "none",
    borderRadius: "10px",
    fontSize: "1rem",
    fontWeight: "bold",
    cursor: (isLoading || isBlocked) ? "not-allowed" : "pointer", // 🔒 カーソル変更
    transition: "0.3s",
    marginBottom: "1.5rem",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    opacity: (isLoading || isBlocked) ? 0.6 : 1 // 🔒 透明度変更
  }}
>
  {isLoading ? (
    <div style={{ /* 既存のローディングスタイル */ }} />
  ) : isBlocked ? ( // 🔒 ブロック中の表示
    "アカウントロック中"
  ) : (
    isLogin ? "ログイン" : "サインアップ"
  )}
</button>

          


          {/* Google Login Button */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={isLoading}
            style={{
              width: "100%",
              padding: "0.9rem",
              backgroundColor: "#ffffff",
              color: "#1e1e2f",
              border: "1px solid #ddd",
              borderRadius: "10px",
              fontSize: "1rem",
              fontWeight: "500",
              cursor: isLoading ? "default" : "pointer",
              transition: "0.3s",
              marginBottom: "1.5rem",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            {/* Google Icon (SVG) */}
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            {isLogin ? "Googleでログイン" : "Googleでサインアップ"}
          </button>

          {/* Divider */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              marginBottom: "1.5rem",
            }}
          >
            <div
              style={{
                flex: 1,
                height: "1px",
                backgroundColor: "#2a2a3d",
              }}
            />
            <span
              style={{
                padding: "0 1rem",
                color: "#999",
                fontSize: "0.8rem",
              }}
            >
              または
            </span>
            <div
              style={{
                flex: 1,
                height: "1px",
                backgroundColor: "#2a2a3d",
              }}
            />
          </div>




          {/* Toggle auth mode */}
          <div
            style={{
              textAlign: "center",
              color: "#ddd",
              fontSize: "0.9rem",
            }}
          >
            {isLogin ? "アカウントをお持ちでない場合は" : "すでにアカウントをお持ちの場合は"}
            <button
  type="button"
  onClick={toggleAuthMode}
  style={{
    background: "none",
    border: "none",
    color: "#F0DB4F",
    fontSize: "0.9rem",
    fontWeight: "bold",
    cursor: "pointer",
    padding: "0 0.3rem",
    outline: "none", // ← 追加
  }}
  onFocus={(e) => {
    e.target.style.textDecoration = "underline";
  }}
  onBlur={(e) => {
    e.target.style.textDecoration = "none";
  }}
>
  {isLogin ? "サインアップ" : "ログイン"}
</button>
          </div>
          <style>
          {`
            @keyframes fadeInWarning {
              0% { 
                opacity: 0; 
                transform: translateY(-10px); 
                background-color: #ff555522;
              }
              50% { 
                opacity: 0.7; 
                transform: translateY(-5px); 
              }
              100% { 
                opacity: 1; 
                transform: translateY(0); 
                background-color: #ffa50022;
              }
            }
            
            @keyframes pulse {
              0%, 100% { opacity: 1; }
              50% { opacity: 0.7; }
            }
          `}
          </style>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;