'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useBranding } from '@/contexts/BrandingContext';

export default function LoginPage() {
  const router = useRouter();
  const { login, loginAsGuest } = useAuth();
  const { serviceName } = useBranding();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      router.push('/');
    } catch (err) {
      setError(err.message || 'ログインに失敗しました。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-stage">
      <div className="auth-bg-veil auth-bg-veil-1" aria-hidden="true" />
      <div className="auth-bg-veil auth-bg-veil-2" aria-hidden="true" />

      <div className="auth-shell">
        {/* Brand lockup */}
        <div className="auth-brand">
          <span className="brand-mark brand-mark-lg">
            <span className="brand-mark-dot" />
          </span>
          <h1 className="auth-brand-name">{serviceName || 'REM'}</h1>
          <p className="auth-brand-sub">教師のための、AI物理問題ジェネレーター</p>
        </div>

        {/* Form card */}
        <form onSubmit={handleSubmit} className="auth-card" noValidate>
          <div className="auth-card-header">
            <h2 className="auth-card-title">ログイン</h2>
            <span className="auth-card-meta">アカウントを使用</span>
          </div>

          {error && (
            <div role="alert" className="auth-error">
              <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3m0 4h.01M5.07 19h13.86a2 2 0 001.74-3L13.74 4a2 2 0 00-3.48 0L3.33 16a2 2 0 001.74 3z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <div className="auth-field">
            <label className="auth-label" htmlFor="email">メールアドレス</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              autoComplete="email"
              className="auth-input"
              placeholder="you@school.jp"
            />
          </div>

          <div className="auth-field">
            <div className="flex items-center justify-between mb-[6px]">
              <label className="auth-label !mb-0" htmlFor="password">パスワード</label>
              <button type="button" className="auth-text-link text-[11px]" tabIndex={-1}>
                忘れた場合
              </button>
            </div>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="current-password"
              className="auth-input"
              placeholder="6文字以上"
            />
          </div>

          <button type="submit" disabled={loading} className="auth-primary-btn">
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="auth-spinner" />
                ログイン中
              </span>
            ) : 'ログイン'}
          </button>

          <div className="auth-divider">
            <span>または</span>
          </div>

          <button
            type="button"
            onClick={() => { loginAsGuest(); router.push('/'); }}
            className="auth-secondary-btn"
          >
            ゲストとして続ける
          </button>
        </form>

        <p className="auth-foot">
          アカウント未登録の方は{' '}
          <Link href="/register" className="auth-text-link">新規登録</Link>
        </p>
        <p className="auth-foot-fine">
          ゲスト利用では全データが閲覧可能です（テナント分離なし）
        </p>
      </div>
    </div>
  );
}
