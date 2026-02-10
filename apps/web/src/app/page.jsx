'use client';

import Link from 'next/link';
import { Icons } from '@/components/ui';

const FEATURES = [
  {
    href: '/user',
    icon: <Icons.User />,
    title: 'ユーザモード',
    desc: 'テンプレートから LLM 用プロンプトを生成し、RAG で関連情報を自動注入。出力を貼り付ければ PDF 化も可能です。',
    color: 'from-indigo-500 to-blue-500',
    bgGlow: 'bg-indigo-500/10',
  },
  {
    href: '/dev',
    icon: <Icons.Dev />,
    title: '開発モード',
    desc: 'プロンプトのチューニングからDB保存、RAG注入まで。対話的なワークフローで問題品質を高めます。',
    color: 'from-purple-500 to-pink-500',
    bgGlow: 'bg-purple-500/10',
  },
  {
    href: '/data',
    icon: <Icons.Data />,
    title: 'データ管理',
    desc: 'テキスト・LaTeX・JSONデータをチャンクしてDBに投入。RAGの情報源を構築・管理します。',
    color: 'from-emerald-500 to-teal-500',
    bgGlow: 'bg-emerald-500/10',
  },
  {
    href: '/search',
    icon: <Icons.Search />,
    title: '問題検索',
    desc: 'DB に保存された問題を科目・難易度・キーワードで検索し、内容を閲覧できます。',
    color: 'from-amber-500 to-orange-500',
    bgGlow: 'bg-amber-500/10',
  },
];

export default function HomePage() {
  return (
    <div className="min-h-[90vh] flex items-center justify-center px-6 py-20">
      <div className="max-w-5xl w-full mx-auto">
        {/* Hero Section */}
        <div className="text-center mb-20">
          <div className="inline-flex items-center gap-2.5 px-4 py-2 bg-indigo-50/50 text-indigo-600 rounded-2xl text-[13px] font-bold mb-8 border border-indigo-100/50 backdrop-blur-sm shadow-sm ring-4 ring-indigo-50/30">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
            </span>
            RAG-Powered Exam Generator
          </div>
          <h1 className="text-6xl font-black text-slate-800 mb-6 tracking-tight">
            <span className="gradient-text">ExamGen</span>
            <span className="text-slate-200 font-light ml-3">v2</span>
          </h1>
          <p className="text-[17px] text-slate-500 max-w-2xl mx-auto leading-relaxed font-medium">
            LLM と RAG (検索拡張生成) を組み合わせた次世代の試験問題作成プラットフォーム。<br className="hidden md:block"/>
            過去問の文脈を活かし、高品質な問題を瞬時に生成・調整します。
          </p>
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-16">
          {FEATURES.map(({ href, icon, title, desc, color, bgGlow }) => (
            <Link key={href} href={href} className="group block">
              <div className="relative bg-white/70 backdrop-blur-xl rounded-[2rem] border border-slate-200/60 p-8 shadow-card hover-lift overflow-hidden h-full group-hover:border-indigo-300/30 transition-all duration-500">
                {/* Background glow */}
                <div
                  className={`absolute -top-16 -right-16 w-36 h-36 rounded-full ${bgGlow} blur-[60px] opacity-0 group-hover:opacity-100 transition-opacity duration-700`}
                />

                <div className="relative">
                  <div
                    className={`inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br ${color} text-white mb-6 shadow-lg shadow-indigo-200/20 group-hover:scale-110 transition-transform duration-500`}
                  >
                    {icon}
                  </div>
                  <h2 className="text-xl font-bold text-slate-800 mb-3 tracking-tight">
                    {title}
                  </h2>
                  <p className="text-[14px] text-slate-500 leading-relaxed mb-6 font-medium opacity-80">
                    {desc}
                  </p>
                  <div className="flex items-center gap-2 text-sm font-bold text-indigo-500 group-hover:text-indigo-600 transition-colors">
                    探索を始める
                    <svg
                      className="w-4.5 h-4.5 group-hover:translate-x-1 transition-transform"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2.5}
                        d="M13 7l5 5m0 0l-5 5m5-5H6"
                      />
                    </svg>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Footer info or stats could go here */}
        <div className="text-center opacity-30 text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
          Professional Tool for Educators & Developers
        </div>
      </div>
    </div>
  );
}
