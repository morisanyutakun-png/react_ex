'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useBranding } from '@/contexts/BrandingContext';

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();
  const { serviceName } = useBranding();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [orgName, setOrgName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(email, password, orgName, displayName);
      router.push('/');
    } catch (err) {
      setError(err.message || '登録に失敗しました。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-stage">
      <div className="auth-bg-veil auth-bg-veil-1" aria-hidden="true" />
      <div className="auth-bg-veil auth-bg-veil-2" aria-hidden="true" />

      <div className="auth-shell">
        <div className="auth-brand">
          <span className="brand-mark brand-mark-lg">
            <span className="brand-mark-dot" />
          </span>
          <h1 className="auth-brand-name">{serviceName || 'REM'}</h1>
          <p className="auth-brand-sub">アカウントを作成して、教材作成を始める</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-card" noValidate>
          <div className="auth-card-header">
            <h2 className="auth-card-title">新規登録</h2>
            <span className="auth-card-meta">60秒で完了</span>
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
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              required autoFocus autoComplete="email" className="auth-input" placeholder="you@school.jp" />
          </div>

          <div className="auth-field">
            <label className="auth-label" htmlFor="password">パスワード</label>
            <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              required minLength={6} autoComplete="new-password" className="auth-input" placeholder="6文字以上" />
            <p className="auth-help">6文字以上、英数字を組み合わせると安全です</p>
          </div>

          <div className="auth-field-row">
            <div className="auth-field flex-1">
              <label className="auth-label" htmlFor="org">
                組織名 <span className="auth-label-optional">任意</span>
              </label>
              <input id="org" type="text" value={orgName} onChange={(e) => setOrgName(e.target.value)}
                className="auth-input" placeholder="○○高校" />
            </div>
            <div className="auth-field flex-1">
              <label className="auth-label" htmlFor="name">
                表示名 <span className="auth-label-optional">任意</span>
              </label>
              <input id="name" type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)}
                className="auth-input" placeholder="あなたの名前" />
            </div>
          </div>

          <button type="submit" disabled={loading} className="auth-primary-btn">
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="auth-spinner" />
                作成中
              </span>
            ) : 'アカウントを作成'}
          </button>

          <p className="auth-tos">
            登録すると <a href="#" className="auth-text-link">利用規約</a> と <a href="#" className="auth-text-link">プライバシーポリシー</a> に同意したことになります。
          </p>
        </form>

        <p className="auth-foot">
          既にアカウントをお持ちの方は{' '}
          <Link href="/login" className="auth-text-link">ログイン</Link>
        </p>
      </div>
    </div>
  );
}
