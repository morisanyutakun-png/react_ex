'use client';

import Link from 'next/link';

/* ─── Endroll Data ─── */
const ENDROLL_COLS = [
  ['Calculus', 'Linear Algebra', 'Probability', 'Trigonometry', 'Vector Analysis', 'Matrix Theory', 'Sequences', 'Limits', 'Complex Numbers', 'Statistics', 'Differential Eq.', 'Set Theory', 'Topology', 'Number Theory'],
  ['Mechanics', 'Electromagnetism', 'Wave Theory', 'Optics', 'Thermodynamics', 'Quantum Physics', 'Fluid Dynamics', 'Relativity', 'Atomic Physics', 'Particle Physics', 'Acoustics', 'Conservation Laws', 'Kinematics', 'Rotational Inertia'],
  ['Organic Chemistry', 'Inorganic Chemistry', 'Equilibrium', 'Reaction Kinetics', 'Electrochemistry', 'Polymers', 'Redox Reactions', 'Solution Chemistry', 'Crystal Structures', 'Chemical Bonding', 'Gas Laws', 'Thermochemistry', 'Colloids', 'Analytical Chemistry'],
  ['Reading', 'Grammar', 'Composition', 'Vocabulary', 'Listening', 'Syntax', 'Semantics', 'Phonetics', 'Rhetoric', 'Creative Writing', 'Literature', 'Translation', 'Idioms', 'Etymology'],
  ['Genetics', 'Cell Biology', 'Ecology', 'Evolution', 'Neuroscience', 'Immunology', 'Embryology', 'Molecular Biology', 'Botany', 'Ethology', 'Microbiology', 'Anatomy', 'Physiology', 'Biochemistry'],
  ['Information Theory', 'Algorithms', 'Data Structures', 'Networks', 'Cryptography', 'Machine Learning', 'Operating Systems', 'Databases', 'Compilers', 'Complexity Theory', 'Deep Learning', 'Parallel Computing', 'Signal Processing', 'Robotics'],
];

/* ─── Endroll Column Component ─── */
function EndrollColumn({ items, speed, direction = 'up', opacity = 0.08 }) {
  const doubled = [...items, ...items];
  return (
    <div className="endroll-col flex-1 overflow-hidden relative" style={{ opacity }}>
      <div
        className={direction === 'up' ? 'endroll-scroll-up' : 'endroll-scroll-down'}
        style={{ animationDuration: `${speed}s` }}
      >
        {doubled.map((text, i) => (
          <div key={i} className="py-[14px] sm:py-[18px] text-center">
            <span className="text-[10px] sm:text-[11px] font-medium tracking-[0.08em] text-[#1d1d1f]/80 whitespace-nowrap uppercase"
                  style={{ fontFamily: '"SF Pro Text", -apple-system, "Helvetica Neue", sans-serif', letterSpacing: '0.1em' }}>
              {text}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Feature Icons (SF Symbols precision) ─── */

function CreateIcon() {
  return (
    <svg className="w-[26px] h-[26px]" viewBox="0 0 28 28" fill="none">
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
    <svg className="w-[26px] h-[26px]" viewBox="0 0 28 28" fill="none">
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
    <svg className="w-[22px] h-[22px]" viewBox="0 0 24 24" fill="none">
      <circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="1.5"/>
      <line x1="15.5" y1="15.5" x2="21" y2="21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function DbIcon() {
  return (
    <svg className="w-[22px] h-[22px]" viewBox="0 0 24 24" fill="none">
      <ellipse cx="12" cy="6.5" rx="8" ry="3" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M4 6.5v11c0 1.66 3.58 3 8 3s8-1.34 8-3v-11" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M4 12.5c0 1.66 3.58 3 8 3s8-1.34 8-3" stroke="currentColor" strokeWidth="1.2" opacity="0.35"/>
    </svg>
  );
}

/* ─── メインActionCard (light premium) ─── */
function ActionCard({ href, icon, label, description, gradientFrom, gradientTo, delay }) {
  return (
    <Link href={href} className="group block stagger-item" style={{ animationDelay: `${delay}ms` }}>
      <div className="relative overflow-hidden rounded-[20px] bg-white border border-black/[0.04] p-6 sm:p-7 transition-all duration-400 active:scale-[0.97] hover:shadow-[0_4px_24px_rgba(0,0,0,0.06)] hover:border-black/[0.05]"
           style={{ boxShadow: '0 0.5px 1px rgba(0,0,0,0.02), 0 2px 6px rgba(0,0,0,0.025)' }}>
        {/* Accent glow on hover */}
        <div className={`absolute -top-24 -right-24 w-48 h-48 rounded-full opacity-0 group-hover:opacity-[0.06] transition-opacity duration-600 blur-3xl bg-gradient-to-br ${gradientFrom} ${gradientTo}`} />

        <div className="relative z-10">
          <div className={`w-11 h-11 rounded-[13px] flex items-center justify-center mb-4 transition-all duration-400 group-hover:scale-[1.04] bg-gradient-to-br ${gradientFrom} ${gradientTo} text-white`}
               style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.06)' }}>
            {icon}
          </div>
          <h3 className="text-[17px] font-bold text-[#1d1d1f] mb-1 tracking-tight">{label}</h3>
          <p className="text-[13px] text-[#86868b] leading-[1.55]">{description}</p>

          {/* Hover CTA */}
          <div className="mt-3.5 flex items-center gap-1.5 text-[12px] font-semibold text-[#0071e3] opacity-0 translate-y-1 transition-all duration-300 group-hover:opacity-100 group-hover:translate-y-0">
            <span>はじめる</span>
            <svg className="w-3 h-3 transition-transform duration-300 group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </div>
        </div>
      </div>
    </Link>
  );
}

/* ─── ツールカード (light premium) ─── */
function ToolCard({ href, icon, label, description, delay }) {
  return (
    <Link href={href} className="group block stagger-item" style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-center gap-4 rounded-[16px] border border-black/[0.04] bg-white px-5 py-4 transition-all duration-400 active:scale-[0.98] hover:shadow-[0_4px_16px_rgba(0,0,0,0.05)] hover:border-black/[0.05]"
           style={{ boxShadow: '0 0.5px 1px rgba(0,0,0,0.02), 0 2px 4px rgba(0,0,0,0.02)' }}>
        <div className="flex-shrink-0 w-9 h-9 rounded-[10px] bg-[#f5f5f7] flex items-center justify-center text-[#86868b] transition-all duration-300 group-hover:bg-[#ececee] group-hover:text-[#1d1d1f] group-hover:scale-[1.04]">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[14px] font-semibold text-[#1d1d1f] tracking-tight">{label}</div>
          <div className="text-[12px] text-[#aeaeb2] mt-0.5">{description}</div>
        </div>
        <svg className="flex-shrink-0 w-3.5 h-3.5 text-[#d2d2d7] transition-all duration-300 group-hover:text-[#86868b] group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
      </div>
    </Link>
  );
}

/* ─── ページ本体 ─── */
export default function HomePage() {
  return (
    <div className="relative min-h-screen overflow-hidden">

      {/* ── Clean light background with subtle ambient color ── */}
      <div className="absolute inset-0 bg-[#fbfbfd]">
        <div className="absolute inset-0"
          style={{
            background: `
              radial-gradient(ellipse 80% 45% at 50% -5%, rgba(0,113,227,0.04) 0%, transparent 50%),
              radial-gradient(ellipse 50% 35% at 85% 15%, rgba(88,86,214,0.025) 0%, transparent 40%),
              radial-gradient(ellipse 60% 35% at 10% 85%, rgba(175,82,222,0.02) 0%, transparent 45%)
            `
          }}
        />
      </div>

      {/* ── Endroll background (flowing columns) ── */}
      <div className="absolute inset-0 flex pointer-events-none select-none" aria-hidden="true">
        <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-[#fbfbfd] via-[#fbfbfd]/80 to-transparent z-10" />
        <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#fbfbfd] via-[#fbfbfd]/80 to-transparent z-10" />

        {ENDROLL_COLS.map((items, i) => (
          <EndrollColumn
            key={i}
            items={items}
            speed={32 + i * 7}
            direction={i % 2 === 0 ? 'up' : 'down'}
            opacity={0.06 + (i % 3) * 0.012}
          />
        ))}
      </div>

      {/* ── Content layer ── */}
      <div className="relative z-20 flex items-center justify-center px-5 py-12 sm:px-6 sm:py-20 pb-28 sm:pb-20 min-h-screen">
        <div className="max-w-[500px] w-full mx-auto">

          {/* ── ヒーロー ── */}
          <div className="text-center mb-14 sm:mb-18 stagger-item" style={{ animationDelay: '0ms' }}>
            {/* ロゴマーク */}
            <div className="relative inline-flex items-center justify-center w-[64px] h-[64px] sm:w-[72px] sm:h-[72px] rounded-[18px] sm:rounded-[20px] mb-6 sm:mb-7"
              style={{
                background: '#ffffff',
                border: '0.5px solid rgba(0,0,0,0.05)',
                boxShadow: '0 2px 12px rgba(0,0,0,0.04), 0 0.5px 1px rgba(0,0,0,0.03)',
              }}>
              <svg className="w-8 h-8 sm:w-9 sm:h-9 text-[#0071e3]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>

            <h1 className="text-[56px] sm:text-[72px] font-black tracking-[-0.04em] leading-none mb-2 text-[#1d1d1f]">
              REM
            </h1>
            <p className="text-[16px] sm:text-[18px] text-[#86868b] font-semibold mb-4 tracking-tight">
              Rapid Exam Maker
            </p>
            <p className="text-[14px] text-[#aeaeb2] leading-[1.65] max-w-[280px] mx-auto">
              過去問データとAIで、<br className="sm:hidden" />試験問題を賢くつくる。
            </p>
          </div>

          {/* ── メイン機能 ── */}
          <div className="mb-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <ActionCard
                href="/user"
                icon={<CreateIcon />}
                label="問題をつくる"
                description="出題パターンを選んで、AIが試験問題を自動生成"
                gradientFrom="from-[#0071e3]"
                gradientTo="to-[#5856d6]"
                delay={100}
              />
              <ActionCard
                href="/dev"
                icon={<TuneIcon />}
                label="品質を磨く"
                description="出題の精度を分析し、さらに向上させる"
                gradientFrom="from-[#af52de]"
                gradientTo="to-[#5856d6]"
                delay={160}
              />
            </div>
          </div>

          {/* ── ツール ── */}
          <div className="mb-12 space-y-2">
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
              delay={270}
            />
            <ToolCard
              href="/help"
              icon={<svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" /></svg>}
              label="はじめてガイド"
              description="使い方・ワークフロー・用語集"
              delay={320}
            />
          </div>

          {/* ── ステータス ── */}
          <div className="text-center stagger-item" style={{ animationDelay: '380ms' }}>
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-black/[0.04] bg-white"
                 style={{ boxShadow: '0 0.5px 1px rgba(0,0,0,0.02)' }}>
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#34c759] opacity-50"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#34c759]"></span>
              </span>
              <span className="text-[11px] font-medium text-[#aeaeb2] tracking-wide">AI Ready</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
