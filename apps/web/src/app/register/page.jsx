'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useBranding } from '@/contexts/BrandingContext';

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();
  const { serviceName, primaryColor } = useBranding();
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
    <div className="min-h-screen flex items-center justify-center px-4"
         style={{ background: 'linear-gradient(135deg, #f8faff 0%, #eef2ff 50%, #f1f5f9 100%)' }}>
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl text-white text-xl font-bold mb-3"
               style={{ background: primaryColor }}>
            {(serviceName || 'R')[0]}
          </div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: primaryColor }}>
            {serviceName}
          </h1>
          <p className="text-sm text-slate-500 mt-1">新規アカウント作成</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}
              className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 shadow-sm border border-slate-200/60">
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 text-red-600 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">メールアドレス</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm
                           focus:outline-none focus:ring-2 focus:border-transparent transition-shadow"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">パスワード</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm
                           focus:outline-none focus:ring-2 focus:border-transparent transition-shadow"
                placeholder="6文字以上"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">組織名（任意）</label>
              <input
                type="text"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm
                           focus:outline-none focus:ring-2 focus:border-transparent transition-shadow"
                placeholder="学校名・企業名など"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">表示名（任意）</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm
                           focus:outline-none focus:ring-2 focus:border-transparent transition-shadow"
                placeholder="あなたの名前"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-6 w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-all
                       disabled:opacity-50 hover:opacity-90"
            style={{ background: primaryColor }}
          >
            {loading ? '登録中...' : 'アカウント作成'}
          </button>
        </form>

        <p className="text-center text-sm text-slate-500 mt-4">
          既にアカウントをお持ちの方は{' '}
          <Link href="/login" className="font-medium hover:underline" style={{ color: primaryColor }}>
            ログイン
          </Link>
        </p>
      </div>
    </div>
  );
}
