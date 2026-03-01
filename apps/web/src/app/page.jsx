'use client';

import Link from 'next/link';

/* ─── Illustrated Icon Components ─── */

/* 問題をつくる — 試験用紙 + 数式ダイアグラム */
function CreateIcon() {
  return (
    <svg className="w-8 h-8" viewBox="0 0 40 40" fill="none">
      {/* ドキュメント本体 */}
      <rect x="6" y="3" width="22" height="30" rx="3" fill="white" stroke="#fc3c44" strokeWidth="1.8"/>
      <rect x="6" y="3" width="22" height="30" rx="3" fill="url(#docGrad)" opacity="0.08"/>
      {/* ライン */}
      <line x1="11" y1="10" x2="23" y2="10" stroke="#fc3c44" strokeWidth="1.2" opacity="0.4" strokeLinecap="round"/>
      <line x1="11" y1="14" x2="20" y2="14" stroke="#fc3c44" strokeWidth="1.2" opacity="0.3" strokeLinecap="round"/>
      <line x1="11" y1="18" x2="22" y2="18" stroke="#fc3c44" strokeWidth="1.2" opacity="0.25" strokeLinecap="round"/>
      {/* 数式ブロック */}
      <rect x="10" y="22" width="14" height="7" rx="2" fill="#fc3c44" opacity="0.08"/>
      <text x="13" y="27.5" fontSize="6" fontWeight="bold" fill="#fc3c44" fontFamily="serif" opacity="0.7">∑ f(x)</text>
      {/* フローティング＋バッジ */}
      <circle cx="30" cy="8" r="7" fill="url(#plusGrad)"/>
      <line x1="27" y1="8" x2="33" y2="8" stroke="white" strokeWidth="2" strokeLinecap="round"/>
      <line x1="30" y1="5" x2="30" y2="11" stroke="white" strokeWidth="2" strokeLinecap="round"/>
      {/* グラフ装飾 */}
      <circle cx="32" cy="28" r="6" fill="#bf5af2" opacity="0.1"/>
      <path d="M29 31 L31 27 L33 29 L35 25" stroke="#bf5af2" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" opacity="0.6"/>
      <defs>
        <linearGradient id="docGrad" x1="6" y1="3" x2="28" y2="33"><stop stopColor="#fc3c44"/><stop offset="1" stopColor="#bf5af2"/></linearGradient>
        <linearGradient id="plusGrad" x1="23" y1="1" x2="37" y2="15"><stop stopColor="#fc3c44"/><stop offset="1" stopColor="#ff375f"/></linearGradient>
      </defs>
    </svg>
  );
}

/* 品質を高める — スパークル + 調整ダイヤル */
function TuneIcon() {
  return (
    <svg className="w-8 h-8" viewBox="0 0 40 40" fill="none">
      {/* 中心のダイヤル */}
      <circle cx="18" cy="20" r="10" stroke="#bf5af2" strokeWidth="1.5" opacity="0.25"/>
      <circle cx="18" cy="20" r="6" stroke="#bf5af2" strokeWidth="1.8" opacity="0.5"/>
      <circle cx="18" cy="20" r="2.5" fill="url(#dialGrad)"/>
      {/* 調整目盛り */}
      <line x1="18" y1="8" x2="18" y2="11" stroke="#bf5af2" strokeWidth="1.2" opacity="0.4" strokeLinecap="round"/>
      <line x1="18" y1="29" x2="18" y2="32" stroke="#bf5af2" strokeWidth="1.2" opacity="0.4" strokeLinecap="round"/>
      <line x1="6" y1="20" x2="9" y2="20" stroke="#bf5af2" strokeWidth="1.2" opacity="0.4" strokeLinecap="round"/>
      <line x1="27" y1="20" x2="30" y2="20" stroke="#bf5af2" strokeWidth="1.2" opacity="0.4" strokeLinecap="round"/>
      {/* スパークル群 */}
      <path d="M32 8 L33.2 11.5 L36.5 12 L33.2 12.5 L32 16 L30.8 12.5 L27.5 12 L30.8 11.5Z" fill="url(#sparkGrad1)" opacity="0.9"/>
      <path d="M34 24 L34.8 26.5 L37 27 L34.8 27.5 L34 30 L33.2 27.5 L31 27 L33.2 26.5Z" fill="url(#sparkGrad2)" opacity="0.6" />
      <path d="M8 5 L8.5 6.8 L10.2 7 L8.5 7.2 L8 9 L7.5 7.2 L5.8 7 L7.5 6.8Z" fill="#ff9f0a" opacity="0.5"/>
      {/* 弧 (進捗) */}
      <path d="M18 10 A10 10 0 0 1 28 20" stroke="url(#arcGrad)" strokeWidth="2" strokeLinecap="round" fill="none"/>
      <defs>
        <linearGradient id="dialGrad" x1="15" y1="17" x2="21" y2="23"><stop stopColor="#bf5af2"/><stop offset="1" stopColor="#5e5ce6"/></linearGradient>
        <linearGradient id="sparkGrad1" x1="27" y1="8" x2="37" y2="16"><stop stopColor="#ff9f0a"/><stop offset="1" stopColor="#ff375f"/></linearGradient>
        <linearGradient id="sparkGrad2" x1="31" y1="24" x2="37" y2="30"><stop stopColor="#bf5af2"/><stop offset="1" stopColor="#5e5ce6"/></linearGradient>
        <linearGradient id="arcGrad" x1="18" y1="10" x2="28" y2="20"><stop stopColor="#fc3c44"/><stop offset="1" stopColor="#bf5af2"/></linearGradient>
      </defs>
    </svg>
  );
}

/* 問題を検索 — 虫眼鏡 + ドキュメント */
function SearchIcon() {
  return (
    <svg className="w-7 h-7" viewBox="0 0 36 36" fill="none">
      {/* ドキュメントスタック */}
      <rect x="4" y="6" width="16" height="20" rx="2.5" fill="white" stroke="#ff9f0a" strokeWidth="1.3" opacity="0.5"/>
      <rect x="6" y="4" width="16" height="20" rx="2.5" fill="white" stroke="#ff9f0a" strokeWidth="1.5"/>
      <line x1="10" y1="10" x2="18" y2="10" stroke="#ff9f0a" strokeWidth="1" opacity="0.4" strokeLinecap="round"/>
      <line x1="10" y1="13" x2="16" y2="13" stroke="#ff9f0a" strokeWidth="1" opacity="0.3" strokeLinecap="round"/>
      <line x1="10" y1="16" x2="17" y2="16" stroke="#ff9f0a" strokeWidth="1" opacity="0.25" strokeLinecap="round"/>
      {/* 虫眼鏡 */}
      <circle cx="25" cy="22" r="7" stroke="url(#searchGrad)" strokeWidth="2" fill="white" fillOpacity="0.8"/>
      <line x1="30" y1="27" x2="34" y2="31" stroke="url(#searchGrad)" strokeWidth="2.5" strokeLinecap="round"/>
      {/* ハイライトドット */}
      <circle cx="23" cy="20" r="1" fill="#ff9f0a" opacity="0.4"/>
      <defs>
        <linearGradient id="searchGrad" x1="18" y1="15" x2="34" y2="31"><stop stopColor="#ff9f0a"/><stop offset="1" stopColor="#ff375f"/></linearGradient>
      </defs>
    </svg>
  );
}

/* データ管理 — データベースシリンダー + 歯車 */
function DbIcon() {
  return (
    <svg className="w-7 h-7" viewBox="0 0 36 36" fill="none">
      {/* シリンダー */}
      <ellipse cx="16" cy="9" rx="10" ry="4" fill="white" stroke="#30d158" strokeWidth="1.5"/>
      <path d="M6 9v16c0 2.2 4.5 4 10 4s10-1.8 10-4V9" stroke="#30d158" strokeWidth="1.5" fill="white"/>
      <ellipse cx="16" cy="9" rx="10" ry="4" fill="url(#dbTopGrad)" opacity="0.12"/>
      <path d="M6 17c0 2.2 4.5 4 10 4s10-1.8 10-4" stroke="#30d158" strokeWidth="1" opacity="0.3"/>
      <path d="M6 22c0 2.2 4.5 4 10 4s10-1.8 10-4" stroke="#30d158" strokeWidth="1" opacity="0.2"/>
      {/* データ行 */}
      <circle cx="12" cy="14" r="1" fill="#30d158" opacity="0.4"/>
      <line x1="15" y1="14" x2="22" y2="14" stroke="#30d158" strokeWidth="0.8" opacity="0.3" strokeLinecap="round"/>
      {/* 歯車 */}
      <circle cx="29" cy="27" r="5" fill="white" stroke="#30d158" strokeWidth="1.3"/>
      <circle cx="29" cy="27" r="2" fill="#30d158" opacity="0.3"/>
      <line x1="29" y1="21" x2="29" y2="23" stroke="#30d158" strokeWidth="1.2" strokeLinecap="round"/>
      <line x1="29" y1="31" x2="29" y2="33" stroke="#30d158" strokeWidth="1.2" strokeLinecap="round"/>
      <line x1="23" y1="27" x2="25" y2="27" stroke="#30d158" strokeWidth="1.2" strokeLinecap="round"/>
      <line x1="33" y1="27" x2="35" y2="27" stroke="#30d158" strokeWidth="1.2" strokeLinecap="round"/>
      <defs>
        <linearGradient id="dbTopGrad" x1="6" y1="5" x2="26" y2="13"><stop stopColor="#30d158"/><stop offset="1" stopColor="#0a84ff"/></linearGradient>
      </defs>
    </svg>
  );
}

/* ─── メイン機能カード (Clean) ─── */
function ActionCard({ href, icon, label, hint, description, accentColor, delay }) {
  return (
    <Link href={href} className="group block stagger-item" style={{ animationDelay: `${delay}ms` }}>
      <div className="relative card-premium p-5 sm:p-6 transition-all duration-300 ease-out hover:shadow-lg active:scale-[0.98] overflow-hidden">
        {/* アイコン */}
        <div className="w-12 h-12 rounded-2xl mb-4 flex items-center justify-center transition-transform duration-300 group-hover:scale-105"
             style={{ background: `${accentColor}0a` }}>
          {icon}
        </div>

        {/* テキスト */}
        <h3 className="text-[17px] font-bold text-[#1d1d1f] mb-1.5 tracking-tight">{label}</h3>
        <p className="text-[13px] text-[#6e6e73] leading-relaxed mb-3">{description}</p>

        {/* ヒント */}
        <div className="flex items-center gap-2 text-[12px] font-semibold transition-opacity duration-300 opacity-50 group-hover:opacity-100"
             style={{ color: accentColor }}>
          <span>{hint}</span>
          <svg className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-1" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </div>
      </div>
    </Link>
  );
}

/* ─── ツールカード (Clean) ─── */
function ToolCard({ href, icon, label, description, accentColor, delay }) {
  return (
    <Link href={href} className="group block stagger-item" style={{ animationDelay: `${delay}ms` }}>
      <div className="relative flex items-center gap-4 card-premium px-5 py-4 transition-all duration-300 hover:shadow-lg active:scale-[0.98]">
        <div className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-105"
             style={{ background: `${accentColor}0a` }}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-semibold text-[#1d1d1f]">{label}</div>
          <div className="text-[12px] text-[#6e6e73] mt-0.5">{description}</div>
        </div>
        <svg className="flex-shrink-0 w-4 h-4 text-[#c7c7cc] transition-all duration-300 group-hover:text-[#6e6e73] group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
      </div>
    </Link>
  );
}

/* ─── ページ本体 ─── */
export default function HomePage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 sm:px-6 sm:py-20 pb-28 sm:pb-20">

      <div className="max-w-[540px] w-full mx-auto">

        {/* ── ヒーロー ── */}
        <div className="text-center mb-14 stagger-item" style={{ animationDelay: '0ms' }}>
          {/* ロゴマーク */}
          <div className="inline-flex items-center justify-center w-16 h-16 sm:w-[72px] sm:h-[72px] rounded-[20px] sm:rounded-[22px] bg-[#1d1d1f] text-white mb-5 sm:mb-6 shadow-lg">
            <svg className="w-8 h-8 sm:w-9 sm:h-9" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>

          <h1 className="text-[42px] sm:text-[56px] font-black tracking-tight text-[#1d1d1f] mb-2 leading-none">
            REM
          </h1>
          <p className="text-[16px] sm:text-[18px] font-bold text-[#6e6e73] mb-3">
            Rapid Exam Maker
          </p>
          <p className="text-[14px] sm:text-[15px] text-[#86868b] leading-relaxed max-w-[300px] mx-auto">
            過去問データとAIで、試験問題を賢くつくる。
          </p>
        </div>

        {/* ── メイン機能 ── */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4 px-1 stagger-item" style={{ animationDelay: '80ms' }}>
            <h2 className="text-[11px] font-bold text-[#86868b] uppercase tracking-[0.2em]">はじめる</h2>
            <div className="flex-1 h-px bg-black/[0.06]" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <ActionCard
              href="/user"
              icon={<CreateIcon />}
              label="問題をつくる"
              description="出題パターンを選んで、AIが試験問題を自動生成"
              hint="パターン選択 → 生成 → PDF"
              accentColor="#fc3c44"
              delay={120}
            />
            <ActionCard
              href="/dev"
              icon={<TuneIcon />}
              label="品質を磨く"
              description="過去問の傾向や指示文を参考に、出題の精度をさらに向上"
              hint="調整 → テスト → 評価"
              accentColor="#bf5af2"
              delay={200}
            />
          </div>
        </div>

        {/* ── ツール ── */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-4 px-1 stagger-item" style={{ animationDelay: '260ms' }}>
            <h2 className="text-[11px] font-bold text-[#86868b] uppercase tracking-[0.2em]">ツール</h2>
            <div className="flex-1 h-px bg-black/[0.06]" />
          </div>
          <div className="space-y-3">
            <ToolCard
              href="/search"
              icon={<SearchIcon />}
              label="問題をさがす"
              description="キーワードや科目でかんたん検索"
              accentColor="#ff9f0a"
              delay={300}
            />
            <ToolCard
              href="/db-editor"
              icon={<DbIcon />}
              label="データ管理"
              description="過去問データを確認・編集"
              accentColor="#30d158"
              delay={360}
            />
          </div>
        </div>

        {/* ── ヘルプ ── */}
        <div className="mb-10 stagger-item" style={{ animationDelay: '380ms' }}>
          <Link href="/help" className="group block">
            <div className="flex items-center gap-4 card-premium px-5 py-4 transition-all duration-300 hover:shadow-lg active:scale-[0.98]">
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-[#5856d6]/[0.06] flex items-center justify-center transition-transform duration-300 group-hover:scale-105">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="#5856d6" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[15px] font-semibold text-[#1d1d1f]">はじめてガイド</div>
                <div className="text-[12px] text-[#6e6e73] mt-0.5">使い方・ワークフロー・用語集</div>
              </div>
              <svg className="flex-shrink-0 w-4 h-4 text-[#c7c7cc] transition-all duration-300 group-hover:text-[#6e6e73] group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </div>
          </Link>
        </div>

        {/* ── ステータス ── */}
        <div className="text-center stagger-item" style={{ animationDelay: '440ms' }}>
          <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-white/70 backdrop-blur border border-black/[0.04]">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#30d158] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#30d158]"></span>
            </span>
            <span className="text-[11px] font-semibold text-[#86868b] tracking-wider">AI Ready</span>
          </div>
        </div>
      </div>
    </div>
  );
}
