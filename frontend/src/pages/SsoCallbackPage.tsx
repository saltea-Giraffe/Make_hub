import { useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

/**
 * SSO コールバック画面
 *
 * バックエンドは認証成功後 `/sso/callback#token=...` にリダイレクトしてくる。
 * トークンをクエリではなくフラグメントで受け取るのは、フラグメントが
 * サーバーに送信されずアクセスログや Referer に残らないため。
 */
export default function SsoCallbackPage() {
  const { applyToken } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  // React 18 の StrictMode では effect が2回走るため、処理を1回に抑える
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const token = params.get('token');

    if (!token) {
      setError('認証情報を受け取れませんでした。もう一度ログインしてください。');
      return;
    }

    // URL からトークンを消してから検証する（履歴・共有時の漏えい防止）
    window.history.replaceState(null, '', window.location.pathname);

    applyToken(token)
      .then(() => navigate('/', { replace: true }))
      .catch(() => setError('ログインに失敗しました。もう一度お試しください。'));
  }, [applyToken, navigate]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4 px-safe">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg border border-gray-200 p-6 text-center">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
          <p className="text-sm text-gray-700">{error}</p>
          <Link
            to="/login"
            className="inline-block mt-5 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            ログイン画面へ戻る
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-gray-500 text-sm flex items-center gap-2">
        <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
        ログイン処理中...
      </div>
    </div>
  );
}
