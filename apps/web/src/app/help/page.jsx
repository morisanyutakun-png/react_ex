'use client';

import Link from 'next/link';

/* ═══════════════════════════════════════════════════════
   アプリ内アイコン再現（ホーム画面と同一）
   ═══════════════════════════════════════════════════════ */

function CreateIconLg() {
  return (
    <svg className="w-10 h-10" viewBox="0 0 40 40" fill="none">
      <rect x="6" y="3" width="22" height="30" rx="3" fill="white" stroke="#fc3c44" strokeWidth="1.8"/>
      <rect x="6" y="3" width="22" height="30" rx="3" fill="url(#hDocGrad)" opacity="0.08"/>
      <line x1="11" y1="10" x2="23" y2="10" stroke="#fc3c44" strokeWidth="1.2" opacity="0.4" strokeLinecap="round"/>
      <line x1="11" y1="14" x2="20" y2="14" stroke="#fc3c44" strokeWidth="1.2" opacity="0.3" strokeLinecap="round"/>
      <line x1="11" y1="18" x2="22" y2="18" stroke="#fc3c44" strokeWidth="1.2" opacity="0.25" strokeLinecap="round"/>
      <rect x="10" y="22" width="14" height="7" rx="2" fill="#fc3c44" opacity="0.08"/>
      <text x="13" y="27.5" fontSize="6" fontWeight="bold" fill="#fc3c44" fontFamily="serif" opacity="0.7">∑ f(x)</text>
      <circle cx="30" cy="8" r="7" fill="url(#hPlusGrad)"/>
      <line x1="27" y1="8" x2="33" y2="8" stroke="white" strokeWidth="2" strokeLinecap="round"/>
      <line x1="30" y1="5" x2="30" y2="11" stroke="white" strokeWidth="2" strokeLinecap="round"/>
      <circle cx="32" cy="28" r="6" fill="#bf5af2" opacity="0.1"/>
      <path d="M29 31 L31 27 L33 29 L35 25" stroke="#bf5af2" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" opacity="0.6"/>
      <defs>
        <linearGradient id="hDocGrad" x1="6" y1="3" x2="28" y2="33"><stop stopColor="#fc3c44"/><stop offset="1" stopColor="#bf5af2"/></linearGradient>
        <linearGradient id="hPlusGrad" x1="23" y1="1" x2="37" y2="15"><stop stopColor="#fc3c44"/><stop offset="1" stopColor="#ff375f"/></linearGradient>
      </defs>
    </svg>
  );
}

function TuneIconLg() {
  return (
    <svg className="w-10 h-10" viewBox="0 0 40 40" fill="none">
      <circle cx="18" cy="20" r="10" stroke="#bf5af2" strokeWidth="1.5" opacity="0.25"/>
      <circle cx="18" cy="20" r="6" stroke="#bf5af2" strokeWidth="1.8" opacity="0.5"/>
      <circle cx="18" cy="20" r="2.5" fill="url(#hDialGrad)"/>
      <line x1="18" y1="8" x2="18" y2="11" stroke="#bf5af2" strokeWidth="1.2" opacity="0.4" strokeLinecap="round"/>
      <line x1="18" y1="29" x2="18" y2="32" stroke="#bf5af2" strokeWidth="1.2" opacity="0.4" strokeLinecap="round"/>
      <line x1="6" y1="20" x2="9" y2="20" stroke="#bf5af2" strokeWidth="1.2" opacity="0.4" strokeLinecap="round"/>
      <line x1="27" y1="20" x2="30" y2="20" stroke="#bf5af2" strokeWidth="1.2" opacity="0.4" strokeLinecap="round"/>
      <path d="M32 8 L33.2 11.5 L36.5 12 L33.2 12.5 L32 16 L30.8 12.5 L27.5 12 L30.8 11.5Z" fill="url(#hSparkGrad)" opacity="0.9"/>
      <path d="M34 24 L34.8 26.5 L37 27 L34.8 27.5 L34 30 L33.2 27.5 L31 27 L33.2 26.5Z" fill="#bf5af2" opacity="0.6"/>
      <path d="M18 10 A10 10 0 0 1 28 20" stroke="url(#hArcGrad)" strokeWidth="2" strokeLinecap="round" fill="none"/>
      <defs>
        <linearGradient id="hDialGrad" x1="15" y1="17" x2="21" y2="23"><stop stopColor="#bf5af2"/><stop offset="1" stopColor="#5e5ce6"/></linearGradient>
        <linearGradient id="hSparkGrad" x1="27" y1="8" x2="37" y2="16"><stop stopColor="#ff9f0a"/><stop offset="1" stopColor="#ff375f"/></linearGradient>
        <linearGradient id="hArcGrad" x1="18" y1="10" x2="28" y2="20"><stop stopColor="#fc3c44"/><stop offset="1" stopColor="#bf5af2"/></linearGradient>
      </defs>
    </svg>
  );
}

function SearchIconLg() {
  return (
    <svg className="w-9 h-9" viewBox="0 0 36 36" fill="none">
      <rect x="4" y="6" width="16" height="20" rx="2.5" fill="white" stroke="#ff9f0a" strokeWidth="1.3" opacity="0.5"/>
      <rect x="6" y="4" width="16" height="20" rx="2.5" fill="white" stroke="#ff9f0a" strokeWidth="1.5"/>
      <line x1="10" y1="10" x2="18" y2="10" stroke="#ff9f0a" strokeWidth="1" opacity="0.4" strokeLinecap="round"/>
      <line x1="10" y1="13" x2="16" y2="13" stroke="#ff9f0a" strokeWidth="1" opacity="0.3" strokeLinecap="round"/>
      <line x1="10" y1="16" x2="17" y2="16" stroke="#ff9f0a" strokeWidth="1" opacity="0.25" strokeLinecap="round"/>
      <circle cx="25" cy="22" r="7" stroke="url(#hSearchGrad)" strokeWidth="2" fill="white" fillOpacity="0.8"/>
      <line x1="30" y1="27" x2="34" y2="31" stroke="url(#hSearchGrad)" strokeWidth="2.5" strokeLinecap="round"/>
      <circle cx="23" cy="20" r="1" fill="#ff9f0a" opacity="0.4"/>
      <defs>
        <linearGradient id="hSearchGrad" x1="18" y1="15" x2="34" y2="31"><stop stopColor="#ff9f0a"/><stop offset="1" stopColor="#ff375f"/></linearGradient>
      </defs>
    </svg>
  );
}

function DbIconLg() {
  return (
    <svg className="w-9 h-9" viewBox="0 0 36 36" fill="none">
      <ellipse cx="16" cy="9" rx="10" ry="4" fill="white" stroke="#30d158" strokeWidth="1.5"/>
      <path d="M6 9v16c0 2.2 4.5 4 10 4s10-1.8 10-4V9" stroke="#30d158" strokeWidth="1.5" fill="white"/>
      <ellipse cx="16" cy="9" rx="10" ry="4" fill="url(#hDbGrad)" opacity="0.12"/>
      <path d="M6 17c0 2.2 4.5 4 10 4s10-1.8 10-4" stroke="#30d158" strokeWidth="1" opacity="0.3"/>
      <path d="M6 22c0 2.2 4.5 4 10 4s10-1.8 10-4" stroke="#30d158" strokeWidth="1" opacity="0.2"/>
      <circle cx="12" cy="14" r="1" fill="#30d158" opacity="0.4"/>
      <line x1="15" y1="14" x2="22" y2="14" stroke="#30d158" strokeWidth="0.8" opacity="0.3" strokeLinecap="round"/>
      <circle cx="29" cy="27" r="5" fill="white" stroke="#30d158" strokeWidth="1.3"/>
      <circle cx="29" cy="27" r="2" fill="#30d158" opacity="0.3"/>
      <defs>
        <linearGradient id="hDbGrad" x1="6" y1="5" x2="26" y2="13"><stop stopColor="#30d158"/><stop offset="1" stopColor="#0a84ff"/></linearGradient>
      </defs>
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════
   フローダイアグラム用SVG
   ═══════════════════════════════════════════════════════ */

function WorkflowDiagram() {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-white/70 backdrop-blur-xl border border-black/[0.04] shadow-lg p-6 sm:p-8">
      <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#fc3c44] via-[#bf5af2] to-[#0a84ff] opacity-70" />

      <div className="text-[10px] font-bold text-[#aeaeb2] uppercase tracking-widest mb-5">ワークフロー全体図</div>

      {/* デスクトップ: 横フロー */}
      <div className="hidden sm:flex items-center justify-between gap-2">
        {[
          { icon: '📝', label: 'テンプレート選択', color: '#fc3c44', sub: 'Step 1' },
          { icon: '→', isArrow: true },
          { icon: '🤖', label: 'RAG + AI生成', color: '#bf5af2', sub: 'Step 2' },
          { icon: '→', isArrow: true },
          { icon: '📄', label: 'PDF出力', color: '#ff9f0a', sub: 'Step 3' },
          { icon: '→', isArrow: true },
          { icon: '✅', label: '品質評価', color: '#30d158', sub: 'Step 4' },
          { icon: '→', isArrow: true },
          { icon: '🗄️', label: 'DB保存', color: '#0a84ff', sub: 'Step 5' },
        ].map((item, i) =>
          item.isArrow ? (
            <div key={i} className="flex-shrink-0 text-[#c7c7cc]">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </div>
          ) : (
            <div key={i} className="flex flex-col items-center gap-2 flex-1">
              <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-white shadow-md border border-black/[0.04] text-2xl"
                   style={{ boxShadow: `0 4px 16px ${item.color}15` }}>
                {item.icon}
              </div>
              <div className="text-center">
                <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: item.color }}>{item.sub}</div>
                <div className="text-[11px] font-bold text-[#1d1d1f] mt-0.5">{item.label}</div>
              </div>
            </div>
          )
        )}
      </div>

      {/* モバイル: 縦フロー */}
      <div className="sm:hidden space-y-3">
        {[
          { icon: '📝', label: 'テンプレート選択', color: '#fc3c44', sub: 'Step 1', desc: 'テンプレートを選んで条件設定' },
          { icon: '🤖', label: 'RAG + AI生成', color: '#bf5af2', sub: 'Step 2', desc: '過去問を参照してAIが問題生成' },
          { icon: '📄', label: 'PDF出力', color: '#ff9f0a', sub: 'Step 3', desc: 'LaTeX形式でPDF試験問題を出力' },
          { icon: '✅', label: '品質評価', color: '#30d158', sub: 'Step 4', desc: '生成された問題の品質を評価' },
          { icon: '🗄️', label: 'DB保存', color: '#0a84ff', sub: 'Step 5', desc: '問題と評価データをDBに永続保存' },
        ].map((item, i, arr) => (
          <div key={i}>
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-white shadow-sm border border-black/[0.04] text-xl flex-shrink-0"
                   style={{ boxShadow: `0 2px 8px ${item.color}15` }}>
                {item.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: item.color }}>{item.sub}</div>
                <div className="text-[13px] font-bold text-[#1d1d1f]">{item.label}</div>
                <div className="text-[11px] text-[#86868b] mt-0.5">{item.desc}</div>
              </div>
            </div>
            {i < arr.length - 1 && (
              <div className="flex justify-center py-1">
                <svg className="w-4 h-4 text-[#c7c7cc]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   機能解説カード
   ═══════════════════════════════════════════════════════ */

function FeatureGuideCard({ icon, title, color, href, steps, tips }) {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-white/70 backdrop-blur-xl border border-black/[0.04] shadow-lg shadow-black/[0.03] transition-all duration-300 hover:shadow-xl">
      <div className="absolute top-0 left-0 right-0 h-[3px]"
           style={{ background: `linear-gradient(90deg, ${color}, ${color}88)` }} />
      <div className="p-6">
        {/* ヘッダー */}
        <div className="flex items-center gap-3.5 mb-5">
          <div className="flex items-center justify-center w-12 h-12 rounded-2xl shadow-lg flex-shrink-0"
               style={{ background: `linear-gradient(135deg, ${color}18, ${color}08)`, boxShadow: `0 4px 16px ${color}20` }}>
            {icon}
          </div>
          <div className="flex-1">
            <h3 className="text-[16px] font-bold text-[#1d1d1f] tracking-tight">{title}</h3>
            <Link href={href} className="text-[11px] font-bold uppercase tracking-wider hover:opacity-70 transition-opacity"
                  style={{ color }}>
              ページを開く →
            </Link>
          </div>
        </div>

        {/* ステップ */}
        <div className="space-y-3 mb-5">
          {steps.map((step, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="flex items-center justify-center w-7 h-7 rounded-lg text-white text-[11px] font-bold flex-shrink-0 mt-0.5"
                   style={{ background: `linear-gradient(135deg, ${color}, ${color}cc)` }}>
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-bold text-[#1d1d1f]">{step.title}</div>
                <div className="text-[12px] text-[#86868b] mt-0.5 leading-relaxed">{step.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Tips */}
        {tips && tips.length > 0 && (
          <div className="p-3 rounded-xl border border-black/[0.04]"
               style={{ background: `${color}06` }}>
            <div className="flex items-center gap-1.5 mb-2">
              <svg className="w-3.5 h-3.5" style={{ color }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
              </svg>
              <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color }}>ヒント</span>
            </div>
            <ul className="space-y-1">
              {tips.map((tip, i) => (
                <li key={i} className="text-[11px] text-[#86868b] flex items-start gap-2 leading-relaxed">
                  <span className="mt-0.5 flex-shrink-0 w-1 h-1 rounded-full" style={{ background: color }} />
                  {tip}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   用語集カード
   ═══════════════════════════════════════════════════════ */

function GlossaryItem({ term, definition, color }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl bg-white/50 border border-black/[0.04] hover:bg-white/80 hover:shadow-sm transition-all">
      <div className="flex items-center justify-center w-8 h-8 rounded-lg text-white text-[12px] font-bold flex-shrink-0"
           style={{ background: `linear-gradient(135deg, ${color}, ${color}cc)` }}>
        {term.charAt(0)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-bold text-[#1d1d1f]">{term}</div>
        <div className="text-[11px] text-[#86868b] mt-0.5 leading-relaxed">{definition}</div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   メインヘルプページ
   ═══════════════════════════════════════════════════════ */

export default function HelpPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-14 pb-28 sm:pb-14 space-y-8">

      {/* ── ヒーロー ── */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-[72px] h-[72px] rounded-[22px] bg-gradient-to-br from-[#0a84ff] via-[#5856d6] to-[#bf5af2] text-white mb-5 shadow-xl shadow-[#5856d6]/25">
          <svg className="w-9 h-9" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
          </svg>
        </div>
        <h1 className="text-[36px] sm:text-[44px] font-black tracking-tight text-[#1d1d1f] mb-2 leading-tight">
          はじめてガイド
        </h1>
        <p className="text-[15px] text-[#86868b] max-w-md mx-auto leading-relaxed">
          REM (Rapid Exam Maker) の使い方を<br className="sm:hidden" />
          ステップごとにご案内します。
        </p>

        {/* ホームに戻る */}
        <Link href="/" className="inline-flex items-center gap-2 mt-5 px-4 py-2 rounded-full bg-white/60 backdrop-blur-lg border border-black/[0.04] shadow-sm text-[12px] font-bold text-[#86868b] hover:text-[#fc3c44] hover:border-[#fc3c44]/20 transition-all">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          ホームに戻る
        </Link>
      </div>

      {/* ── 概要 ── */}
      <div className="relative overflow-hidden rounded-3xl bg-white/70 backdrop-blur-xl border border-black/[0.04] shadow-lg p-6 sm:p-8">
        <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#fc3c44] via-[#ff375f] to-[#fc3c44] opacity-70" />
        <div className="flex items-start gap-4">
          <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-[#fc3c44] to-[#e0323a] text-white shadow-lg shadow-[#fc3c44]/20 flex-shrink-0">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <div className="flex-1">
            <h2 className="text-[18px] font-bold text-[#1d1d1f] tracking-tight mb-2">REM とは？</h2>
            <p className="text-[13px] text-[#86868b] leading-relaxed">
              <strong className="text-[#1d1d1f]">Rapid Exam Maker</strong> は、過去問データベースとAIの力を組み合わせて、
              高品質な試験問題を効率的に生成するプラットフォームです。
              テンプレートを選んでワンクリックで問題を生成し、PDF形式で出力できます。
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              {['AI 問題生成', 'RAG 検索', 'LaTeX / PDF', '品質評価', 'DB 永続保存'].map((tag) => (
                <span key={tag} className="px-2.5 py-1 bg-[#fc3c44]/[0.06] text-[#fc3c44] rounded-full text-[10px] font-bold border border-[#fc3c44]/10">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── ホーム画面のナビゲーション説明 ── */}
      <div className="relative overflow-hidden rounded-3xl bg-white/70 backdrop-blur-xl border border-black/[0.04] shadow-lg p-6 sm:p-8">
        <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#ff9f0a] via-[#ff375f] to-[#bf5af2] opacity-70" />
        <div className="mb-5">
          <div className="text-[10px] font-bold text-[#aeaeb2] uppercase tracking-widest mb-2">ホーム画面ガイド</div>
          <h2 className="text-[18px] font-bold text-[#1d1d1f] tracking-tight">アイコンの見方</h2>
          <p className="text-[12px] text-[#86868b] mt-1">ホーム画面のアイコンからすべての機能にアクセスできます</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            {
              icon: <CreateIconLg />,
              label: '問題をつくる',
              desc: 'テンプレートから試験問題を自動生成。5ステップの簡単ウィザード。',
              href: '/user',
              color: '#fc3c44',
              gradient: 'from-[#fc3c44] to-[#ff375f]',
            },
            {
              icon: <TuneIconLg />,
              label: '品質を高める',
              desc: 'RAGとプロンプトを調整して出力品質を改善する開発ツール。',
              href: '/dev',
              color: '#bf5af2',
              gradient: 'from-[#bf5af2] to-[#5e5ce6]',
            },
            {
              icon: <SearchIconLg />,
              label: '問題を検索',
              desc: 'キーワード・科目で過去の問題をスマート検索。',
              href: '/search',
              color: '#ff9f0a',
              gradient: 'from-[#ff9f0a] to-[#ff375f]',
            },
            {
              icon: <DbIconLg />,
              label: 'DB編集',
              desc: '問題データを直接編集・管理できるエディター。',
              href: '/db-editor',
              color: '#30d158',
              gradient: 'from-[#30d158] to-[#0a84ff]',
            },
          ].map((item) => (
            <Link key={item.href} href={item.href}
              className="group flex items-center gap-3.5 p-4 rounded-2xl bg-white/60 border border-black/[0.04] shadow-sm
                         hover:shadow-md hover:bg-white/80 transition-all duration-300 active:scale-[0.98]"
            >
              <div className="flex items-center justify-center w-14 h-14 rounded-2xl flex-shrink-0 transition-transform duration-300 group-hover:scale-110"
                   style={{ background: `linear-gradient(135deg, ${item.color}15, ${item.color}05)` }}>
                {item.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-bold text-[#1d1d1f] flex items-center gap-2">
                  {item.label}
                  <svg className="w-3.5 h-3.5 text-[#c7c7cc] group-hover:text-current transition-all duration-300 group-hover:translate-x-0.5"
                       style={{ color: item.color }} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </div>
                <div className="text-[11px] text-[#86868b] mt-0.5 leading-relaxed">{item.desc}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* ── 全体フロー図 ── */}
      <WorkflowDiagram />

      {/* ── セクション: 各機能の詳しい使い方 ── */}
      <div>
        <div className="flex items-center gap-3 mb-5 px-1">
          <div className="w-1.5 h-1.5 rounded-full bg-[#fc3c44]" />
          <h2 className="text-[12px] font-bold text-[#6e6e73] uppercase tracking-[0.2em]">機能ガイド</h2>
          <div className="flex-1 h-px bg-gradient-to-r from-black/[0.06] to-transparent" />
        </div>

        <div className="space-y-5">
          {/* 問題をつくる */}
          <FeatureGuideCard
            icon={<CreateIconLg />}
            title="問題をつくる（作るモード）"
            color="#fc3c44"
            href="/user"
            steps={[
              {
                title: 'テンプレートを選択',
                desc: '教科・分野・難易度が設定されたテンプレートを選びます。科目ごとにアイコンが色分けされています。新規テンプレートも作成可能です。',
              },
              {
                title: '参考問題を選択（任意）',
                desc: 'テンプレートに合致する過去問がDBから自動表示されます。選択すると、その問題をベースに類似問題が生成されます。',
              },
              {
                title: '出題形式を選ぶ',
                desc: '標準・穴埋め・選択肢・○×の4形式から選べます。それぞれのアイコンで直感的に選択できます。',
              },
              {
                title: 'AIで問題を生成',
                desc: '「生成する」ボタンを押すと、RAGで過去問を参照しながらAIが問題を生成します。',
              },
              {
                title: 'PDFをダウンロード',
                desc: '生成された問題はLaTeX形式でPDFに出力されます。すぐに試験で使えるフォーマットです。',
              },
            ]}
            tips={[
              '参考問題を選ぶと、より出題意図に沿った問題が生成されます',
              'テンプレートは何度でも再利用できます — 設定を保存しておきましょう',
              '図表が必要な場合は TikZ / CircuiTikZ パッケージを選択してください',
            ]}
          />

          {/* 品質を高める */}
          <FeatureGuideCard
            icon={<TuneIconLg />}
            title="品質を高める（高めるモード）"
            color="#bf5af2"
            href="/dev"
            steps={[
              {
                title: 'テンプレートを選択',
                desc: 'Apple風カードからテンプレートを選択。科目別のグラデーションアイコンでひと目でわかります。',
              },
              {
                title: 'RAG ミキサーを調整',
                desc: '類似度・難易度・ひっかけの3軸バランスを調整。プリセット（バランス/類似重視/難易度重視/ひっかけ強化）でワンタップ設定も可能。',
              },
              {
                title: 'プロンプトを生成 → LLMで実行',
                desc: '調整内容を反映したプロンプトが自動生成されます。ChatGPT / Claude / Gemini にコピー&ペーストして実行してください。',
              },
              {
                title: '出力を貼り付け → パース',
                desc: 'LLMの出力を貼り付けると、JSONとして自動パースされ、内容を確認できます。',
              },
              {
                title: '品質を評価 → DBに記録',
                desc: '5段階の絵文字レーティングで品質を評価。評価データはDBに永続保存され、次回の生成に自動で反映されます。',
              },
            ]}
            tips={[
              'RAG ミキサーのプリセット「バランス」が最初は推奨です',
              '円グラフで各軸の割合が視覚的に確認できます',
              '評価を繰り返すほど、AIの出力品質が向上します（フィードバックループ）',
              '評価履歴パネルで過去のスコア推移やトレンドが確認できます',
            ]}
          />

          {/* 問題を検索 */}
          <FeatureGuideCard
            icon={<SearchIconLg />}
            title="問題を検索"
            color="#ff9f0a"
            href="/search"
            steps={[
              {
                title: 'キーワードを入力',
                desc: '検索バーにキーワードを入力すると、問題文・科目・分野を横断してスマート検索します。',
              },
              {
                title: 'フィルターで絞り込み',
                desc: '科目・難易度などのフィルターを組み合わせて、目的の問題を素早く見つけられます。',
              },
              {
                title: '結果を確認',
                desc: '検索結果カードをクリックすると、問題文の全文とメタデータが展開表示されます。',
              },
            ]}
            tips={[
              'キーワードなしで科目だけでフィルターすることも可能',
              'LaTeX 数式もそのまま表示されます',
            ]}
          />

          {/* DB編集 */}
          <FeatureGuideCard
            icon={<DbIconLg />}
            title="DB編集"
            color="#30d158"
            href="/db-editor"
            steps={[
              {
                title: 'テーブルを選択',
                desc: 'problems（問題）テーブルや tuning_logs（評価ログ）テーブルなど、編集対象を選びます。',
              },
              {
                title: 'データを閲覧・編集',
                desc: '各行のデータをインラインで編集できます。フィールドの型に応じた入力フォームが表示されます。',
              },
              {
                title: '新規行の追加・削除',
                desc: '表上部のボタンから新しい行を追加したり、不要なデータを削除できます。',
              },
            ]}
            tips={[
              '問題データの修正（誤字修正・難易度の変更など）はここから直接行えます',
              'スマート作成を使えば、難易度が自動推定されます',
            ]}
          />
        </div>
      </div>

      {/* ── 用語集 ── */}
      <div>
        <div className="flex items-center gap-3 mb-5 px-1">
          <div className="w-1.5 h-1.5 rounded-full bg-[#5856d6]" />
          <h2 className="text-[12px] font-bold text-[#6e6e73] uppercase tracking-[0.2em]">用語集</h2>
          <div className="flex-1 h-px bg-gradient-to-r from-black/[0.06] to-transparent" />
        </div>

        <div className="relative overflow-hidden rounded-3xl bg-white/70 backdrop-blur-xl border border-black/[0.04] shadow-lg p-5 sm:p-6">
          <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#5856d6] via-[#0a84ff] to-[#5856d6] opacity-50" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <GlossaryItem term="RAG" definition="Retrieval-Augmented Generation — 過去問DBを検索して、AIの生成に参考情報として注入する技術" color="#bf5af2" />
            <GlossaryItem term="テンプレート" definition="科目・分野・難易度・出題パターンが定義された問題生成の設計図" color="#fc3c44" />
            <GlossaryItem term="Top-K" definition="RAG検索で参照する過去問の件数。大きいほど多く参照するが、プロンプトが長くなる" color="#0a84ff" />
            <GlossaryItem term="LaTeX" definition="数式や文書を美しく組版する言語。生成された問題はこの形式でPDFに変換される" color="#ff9f0a" />
            <GlossaryItem term="チューニング" definition="RAGのバランスやプロンプトを調整して、AI出力の品質を改善するプロセス" color="#30d158" />
            <GlossaryItem term="フィードバック" definition="生成した問題の品質評価。DBに保存され、次回のプロンプトに自動反映される" color="#5856d6" />
          </div>
        </div>
      </div>

      {/* ── FAQ ── */}
      <div>
        <div className="flex items-center gap-3 mb-5 px-1">
          <div className="w-1.5 h-1.5 rounded-full bg-[#ff9f0a]" />
          <h2 className="text-[12px] font-bold text-[#6e6e73] uppercase tracking-[0.2em]">よくある質問</h2>
          <div className="flex-1 h-px bg-gradient-to-r from-black/[0.06] to-transparent" />
        </div>

        <div className="space-y-3">
          {[
            {
              q: 'テンプレートがないときはどうすればいい？',
              a: '「問題をつくる」ページの下部にある「+ 新規作成」ボタンから、科目・分野・難易度を設定してテンプレートを作成できます。',
              color: '#fc3c44',
            },
            {
              q: 'RAG がエラーになる場合は？',
              a: 'バックエンドの起動に時間がかかる場合があります。「RAGをスキップ」ボタンでスキップするか、数秒待ってから再試行してください。',
              color: '#ff9f0a',
            },
            {
              q: '品質評価はどこに保存される？',
              a: '評価データは tuning_logs テーブルに永続保存されます。ブラウザを閉じても消えません。次回生成時に自動で活用されます。',
              color: '#30d158',
            },
            {
              q: 'PDF生成でエラーが出る場合は？',
              a: 'LaTeXエンジンがバックエンドにインストールされていない可能性があります。エラーメッセージを確認し、必要に応じて管理者に連絡してください。',
              color: '#bf5af2',
            },
            {
              q: '対応している教科は？',
              a: '数学・物理・化学・英語・生物・情報の6教科に対応。テンプレートで自由にカスタマイズも可能です。',
              color: '#0a84ff',
            },
          ].map((faq, i) => (
            <details key={i} className="group relative overflow-hidden rounded-2xl bg-white/60 border border-black/[0.04] shadow-sm hover:shadow-md transition-all">
              <summary className="cursor-pointer px-5 py-4 text-[14px] font-bold text-[#1d1d1f] select-none flex items-center gap-3 transition-all hover:bg-white/80">
                <div className="flex items-center justify-center w-7 h-7 rounded-lg text-white text-[13px] font-bold flex-shrink-0"
                     style={{ background: `linear-gradient(135deg, ${faq.color}, ${faq.color}cc)` }}>
                  ?
                </div>
                <span className="flex-1">{faq.q}</span>
                <svg className="w-4 h-4 text-[#c7c7cc] transition-transform duration-200 group-open:rotate-180 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </summary>
              <div className="px-5 pb-4 pl-[3.75rem]">
                <p className="text-[13px] text-[#86868b] leading-relaxed">{faq.a}</p>
              </div>
            </details>
          ))}
        </div>
      </div>

      {/* ── フッター ── */}
      <div className="text-center pt-6 pb-4">
        <Link href="/" className="inline-flex items-center gap-2.5 px-5 py-3 rounded-2xl bg-gradient-to-r from-[#fc3c44] to-[#e0323a] text-white text-[14px] font-bold shadow-lg shadow-[#fc3c44]/20 hover:shadow-xl hover:shadow-[#fc3c44]/30 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          ホームに戻って始める
        </Link>
        <p className="text-[11px] text-[#c7c7cc] mt-4">
          REM — Rapid Exam Maker
        </p>
      </div>
    </div>
  );
}
