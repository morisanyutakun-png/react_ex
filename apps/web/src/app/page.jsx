'use client';

import Link from 'next/link';

/* ─── Apple-style Feature Icons (SF Symbols aesthetic) ─── */

function CreateIcon() {
  return (
    <svg className="w-7 h-7" viewBox="0 0 28 28" fill="none">
      <rect x="3" y="2" width="16" height="21" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.5"/>
      <line x1="7" y1="7" x2="15" y2="7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.5"/>
      <line x1="7" y1="10.5" x2="13" y2="10.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.35"/>
      <line x1="7" y1="14" x2="14" y2="14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.25"/>
      <circle cx="20.5" cy="7.5" r="5" fill="currentColor" opacity="0.12"/>
      <line x1="18" y1="7.5" x2="23" y2="7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="20.5" y1="5" x2="20.5" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function TuneIcon() {
  return (
    <svg className="w-7 h-7" viewBox="0 0 28 28" fill="none">
      <circle cx="14" cy="14" r="8" stroke="currentColor" strokeWidth="1.5" opacity="0.3"/>
      <circle cx="14" cy="14" r="4.5" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="14" cy="14" r="1.8" fill="currentColor"/>
      <line x1="14" y1="2" x2="14" y2="6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.4"/>
      <line x1="14" y1="22" x2="14" y2="26" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.4"/>
      <line x1="2" y1="14" x2="6" y2="14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.4"/>
      <line x1="22" y1="14" x2="26" y2="14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.4"/>
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
      <circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="1.5"/>
      <line x1="15.5" y1="15.5" x2="21" y2="21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function DbIcon() {
  return (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
      <ellipse cx="12" cy="6.5" rx="8" ry="3" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M4 6.5v11c0 1.66 3.58 3 8 3s8-1.34 8-3v-11" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M4 12.5c0 1.66 3.58 3 8 3s8-1.34 8-3" stroke="currentColor" strokeWidth="1.2" opacity="0.35"/>
    </svg>
  );
}

/* ─── メイン機能カード ─── */
function ActionCard({ href, icon, label, description, delay }) {
  return (
    <Link href={href} className="group block stagger-item" style={{ animationDelay: `${delay}ms` }}>
      <div className="card-premium p-6 transition-all duration-300 active:scale-[0.98]">
        <div className="w-11 h-11 rounded-[13px] bg-[#f5f5f7] flex items-center justify-center mb-4 text-[#1d1d1f] transition-colors duration-300 group-hover:bg-[#e8e8ed]">
          {icon}
        </div>
        <h3 className="text-[17px] font-semibold text-[#1d1d1f] mb-1 tracking-tight">{label}</h3>
        <p className="text-[13px] text-[#86868b] leading-relaxed">{description}</p>
      </div>
    </Link>
  );
}

/* ─── ツールカード ─── */
function ToolCard({ href, icon, label, description, delay }) {
  return (
    <Link href={href} className="group block stagger-item" style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-center gap-4 card-premium px-5 py-4 transition-all duration-300 active:scale-[0.98]">
        <div className="flex-shrink-0 w-9 h-9 rounded-[11px] bg-[#f5f5f7] flex items-center justify-center text-[#1d1d1f] transition-colors duration-300 group-hover:bg-[#e8e8ed]">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-medium text-[#1d1d1f]">{label}</div>
          <div className="text-[12px] text-[#86868b] mt-0.5">{description}</div>
        </div>
        <svg className="flex-shrink-0 w-4 h-4 text-[#d2d2d7] transition-all duration-300 group-hover:text-[#86868b] group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
      </div>
    </Link>
  );
}

/* ─── ページ本体 ─── */
export default function HomePage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-5 py-12 sm:px-6 sm:py-24 pb-28 sm:pb-24">

      <div className="max-w-[480px] w-full mx-auto">

        {/* ── ヒーロー ── */}
        <div className="text-center mb-16 stagger-item" style={{ animationDelay: '0ms' }}>
          <div className="inline-flex items-center justify-center w-[68px] h-[68px] rounded-[18px] bg-[#1d1d1f] text-white mb-6">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>

          <h1 className="text-[48px] sm:text-[56px] font-bold tracking-tight text-[#1d1d1f] mb-2 leading-none">
            REM
          </h1>
          <p className="text-[17px] text-[#6e6e73] mb-4 font-medium">
            Rapid Exam Maker
          </p>
          <p className="text-[15px] text-[#86868b] leading-relaxed max-w-[280px] mx-auto">
            過去問データとAIで、<br />試験問題を賢くつくる。
          </p>
        </div>

        {/* ── メイン機能 ── */}
        <div className="mb-10">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <ActionCard
              href="/user"
              icon={<CreateIcon />}
              label="問題をつくる"
              description="パターンを選んでAIが自動生成"
              delay={100}
            />
            <ActionCard
              href="/dev"
              icon={<TuneIcon />}
              label="品質を磨く"
              description="出題の精度をさらに向上させる"
              delay={160}
            />
          </div>
        </div>

        {/* ── ツール ── */}
        <div className="mb-12 space-y-2.5">
          <ToolCard
            href="/search"
            icon={<SearchIcon />}
            label="問題をさがす"
            description="キーワードや科目で検索"
            delay={220}
          />
          <ToolCard
            href="/db-editor"
            icon={<DbIcon />}
            label="データ管理"
            description="過去問データを確認・編集"
            delay={280}
          />
          <ToolCard
            href="/help"
            icon={<svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" /></svg>}
            label="はじめてガイド"
            description="使い方・ワークフロー・用語集"
            delay={340}
          />
        </div>

        {/* ── ステータス ── */}
        <div className="text-center stagger-item" style={{ animationDelay: '400ms' }}>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#f5f5f7]">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#30d158] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#30d158]"></span>
            </span>
            <span className="text-[11px] font-medium text-[#86868b]">AI Ready</span>
          </div>
        </div>
      </div>
    </div>
  );
}
