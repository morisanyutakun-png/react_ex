'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useBranding } from '@/contexts/BrandingContext';

export default function LoginPage() {
  const router = useRouter();
  const { login, loginAsGuest } = useAuth();
  const { serviceName, primaryColor } = useBranding();
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
          <p className="text-sm text-slate-500 mt-1">アカウントにログイン</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}
              className="bg-[#111827]/90 backdrop-blur-xl rounded-2xl p-6 shadow-sm border border-[#1e2d4a]">
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
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-6 w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-all
                       disabled:opacity-50 hover:opacity-90"
            style={{ background: primaryColor }}
          >
            {loading ? 'ログイン中...' : 'ログイン'}
          </button>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200" /></div>
            <div className="relative flex justify-center text-xs"><span className="bg-[#111827] px-3 text-slate-400">または</span></div>
          </div>

          <button
            type="button"
            onClick={() => { loginAsGuest(); router.push('/'); }}
            className="w-full py-2.5 rounded-xl text-sm font-medium border border-slate-200
                       text-slate-600 hover:bg-slate-50 transition-colors"
          >
            ゲストとして続ける
          </button>
        </form>

        <p className="text-center text-sm text-slate-500 mt-4">
          アカウントをお持ちでない方は{' '}
          <Link href="/register" className="font-medium hover:underline" style={{ color: primaryColor }}>
            新規登録
          </Link>
        </p>
        <p className="text-center text-xs text-slate-400 mt-2">
          ゲストモードでは全データが閲覧可能です（テナント分離なし）
        </p>
      </div>
    </div>
  );
}
