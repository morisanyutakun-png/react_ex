'use client';

import Link from 'next/link';

/* ─── Endroll Data (背景に流れるコンテンツ) ─── */
const ENDROLL_COLS = [
  ['微分法', '積分法', '確率分布', '三角関数', 'ベクトル解析', '行列演算', '数列', '極限', '複素数', '統計学', '線形代数', '微分方程式', '集合論', '位相幾何'],
  ['力学', '電磁気学', '波動', '光学', '熱力学', '量子力学', '流体力学', '相対性理論', '原子物理', '素粒子物理', '音響学', 'エネルギー保存', '運動方程式', '慣性モーメント'],
  ['有機化学', '無機化学', '化学平衡', '反応速度', '電気化学', '高分子化合物', '酸化還元', '溶液化学', '結晶構造', '化学結合', '気体の法則', '熱化学', 'コロイド', '分析化学'],
  ['Reading', 'Grammar', 'Writing', 'Vocabulary', 'Listening', 'Syntax', 'Semantics', 'Phonetics', 'Rhetoric', 'Composition', 'Literature', 'Translation', 'Idioms', 'Etymology'],
  ['遺伝学', '細胞生物学', '生態学', '進化論', '神経科学', '免疫学', '発生学', '分子生物学', '植物学', '動物行動学', '微生物学', '解剖学', '生理学', '生化学'],
  ['情報理論', 'アルゴリズム', 'データ構造', 'ネットワーク', '暗号理論', '機械学習', 'OS', 'データベース', 'コンパイラ', '計算量理論', 'AI', '並列計算', '信号処理', 'ロボティクス'],
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
          <div key={i} className="py-3 sm:py-4 text-center">
            <span className="text-[11px] sm:text-[13px] font-medium tracking-[0.04em] text-white/90 whitespace-nowrap">
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

/* ─── メインActionCard (dark theme) ─── */
function ActionCard({ href, icon, label, description, gradientFrom, gradientTo, delay }) {
  return (
    <Link href={href} className="group block stagger-item" style={{ animationDelay: `${delay}ms` }}>
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-xl p-6 sm:p-7 transition-all duration-500 active:scale-[0.97] hover:bg-white/[0.07] hover:border-white/[0.14] hover:shadow-[0_8px_40px_rgba(0,0,0,0.3)]">
        {/* Top edge highlight */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

        {/* Accent glow on hover */}
        <div className={`absolute -top-20 -right-20 w-40 h-40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700 blur-3xl bg-gradient-to-br ${gradientFrom} ${gradientTo}`} />

        <div className="relative z-10">
          <div className={`w-12 h-12 rounded-[14px] flex items-center justify-center mb-5 transition-all duration-500 group-hover:scale-105 bg-gradient-to-br ${gradientFrom} ${gradientTo} text-white shadow-lg`}
               style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.15)' }}>
            {icon}
          </div>
          <h3 className="text-[18px] font-bold text-white mb-1.5 tracking-tight">{label}</h3>
          <p className="text-[13px] text-white/50 leading-[1.6]">{description}</p>

          {/* Hover CTA */}
          <div className="mt-4 flex items-center gap-1.5 text-[12px] font-semibold text-[#0071e3] opacity-0 translate-y-1 transition-all duration-400 group-hover:opacity-100 group-hover:translate-y-0">
            <span>はじめる</span>
            <svg className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </div>
        </div>
      </div>
    </Link>
  );
}

/* ─── ツールカード (dark theme) ─── */
function ToolCard({ href, icon, label, description, delay }) {
  return (
    <Link href={href} className="group block stagger-item" style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-center gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-xl px-5 py-[18px] transition-all duration-500 active:scale-[0.98] hover:bg-white/[0.06] hover:border-white/[0.12]">
        <div className="flex-shrink-0 w-10 h-10 rounded-[12px] bg-white/[0.06] flex items-center justify-center text-white/60 transition-all duration-500 group-hover:bg-white/[0.10] group-hover:text-white/80 group-hover:scale-105">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-semibold text-white/90 tracking-tight">{label}</div>
          <div className="text-[12px] text-white/35 mt-0.5">{description}</div>
        </div>
        <svg className="flex-shrink-0 w-4 h-4 text-white/20 transition-all duration-400 group-hover:text-white/40 group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
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

      {/* ── Dark gradient background (Stripe-inspired) ── */}
      <div className="absolute inset-0 bg-[#0a0a0f]">
        {/* Primary mesh gradient */}
        <div className="absolute inset-0"
          style={{
            background: `
              radial-gradient(ellipse 80% 60% at 50% 0%, rgba(0,113,227,0.12) 0%, transparent 60%),
              radial-gradient(ellipse 60% 50% at 80% 20%, rgba(94,92,230,0.08) 0%, transparent 50%),
              radial-gradient(ellipse 70% 40% at 20% 80%, rgba(191,90,242,0.06) 0%, transparent 50%),
              radial-gradient(ellipse 50% 50% at 70% 90%, rgba(0,113,227,0.05) 0%, transparent 40%)
            `
          }}
        />
        {/* Subtle noise texture overlay */}
        <div className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'repeat',
          }}
        />
      </div>

      {/* ── Endroll background (flowing columns) ── */}
      <div className="absolute inset-0 flex pointer-events-none select-none" aria-hidden="true">
        {/* Fade masks — top & bottom */}
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-[#0a0a0f] to-transparent z-10" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#0a0a0f] to-transparent z-10" />

        {ENDROLL_COLS.map((items, i) => (
          <EndrollColumn
            key={i}
            items={items}
            speed={30 + i * 8}
            direction={i % 2 === 0 ? 'up' : 'down'}
            opacity={0.04 + (i % 3) * 0.01}
          />
        ))}
      </div>

      {/* ── Content layer ── */}
      <div className="relative z-20 flex items-center justify-center px-5 py-12 sm:px-6 sm:py-20 pb-28 sm:pb-20 min-h-screen">
        <div className="max-w-[520px] w-full mx-auto">

          {/* ── ヒーロー ── */}
          <div className="text-center mb-16 sm:mb-20 stagger-item" style={{ animationDelay: '0ms' }}>
            {/* ロゴマーク — glowing on dark */}
            <div className="relative inline-flex items-center justify-center w-[72px] h-[72px] sm:w-[80px] sm:h-[80px] rounded-[22px] sm:rounded-[24px] mb-7 sm:mb-8 group"
              style={{
                background: 'linear-gradient(145deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.04) 100%)',
                border: '0.5px solid rgba(255,255,255,0.12)',
                boxShadow: '0 2px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.08)',
              }}>
              <svg className="w-9 h-9 sm:w-10 sm:h-10 text-white" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              {/* Ambient glow */}
              <div className="absolute -inset-4 rounded-[30px] bg-[#0071e3]/[0.10] blur-2xl -z-10" />
            </div>

            <h1 className="text-[64px] sm:text-[80px] font-black tracking-[-0.04em] leading-none mb-3 bg-clip-text text-transparent"
              style={{ backgroundImage: 'linear-gradient(180deg, #ffffff 0%, rgba(255,255,255,0.70) 100%)' }}>
              REM
            </h1>
            <p className="text-[17px] sm:text-[19px] text-white/40 font-semibold mb-5 tracking-tight">
              Rapid Exam Maker
            </p>
            <p className="text-[15px] text-white/30 leading-[1.7] max-w-[300px] mx-auto">
              過去問データとAIで、<br className="sm:hidden" />試験問題を賢くつくる。
            </p>
          </div>

          {/* ── メイン機能 ── */}
          <div className="mb-10">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <ActionCard
                href="/user"
                icon={<CreateIcon />}
                label="問題をつくる"
                description="出題パターンを選んで、AIが試験問題を自動生成"
                gradientFrom="from-[#0071e3]"
                gradientTo="to-[#5e5ce6]"
                delay={100}
              />
              <ActionCard
                href="/dev"
                icon={<TuneIcon />}
                label="品質を磨く"
                description="出題の精度を分析し、さらに向上させる"
                gradientFrom="from-[#bf5af2]"
                gradientTo="to-[#5e5ce6]"
                delay={180}
              />
            </div>
          </div>

          {/* ── ツール ── */}
          <div className="mb-14 space-y-2.5">
            <ToolCard
              href="/search"
              icon={<SearchIcon />}
              label="問題をさがす"
              description="キーワードや科目で検索"
              delay={260}
            />
            <ToolCard
              href="/db-editor"
              icon={<DbIcon />}
              label="データ管理"
              description="過去問データを確認・編集"
              delay={320}
            />
            <ToolCard
              href="/help"
              icon={<svg className="w-[20px] h-[20px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" /></svg>}
              label="はじめてガイド"
              description="使い方・ワークフロー・用語集"
              delay={380}
            />
          </div>

          {/* ── ステータス ── */}
          <div className="text-center stagger-item" style={{ animationDelay: '440ms' }}>
            <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full border border-white/[0.06] bg-white/[0.03] backdrop-blur-xl">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#30d158] opacity-60"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#30d158]" style={{ boxShadow: '0 0 8px rgba(48,209,88,0.50)' }}></span>
              </span>
              <span className="text-[11px] font-semibold text-white/40 tracking-wide">AI Ready</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
