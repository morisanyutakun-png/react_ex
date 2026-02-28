'use client';

import Link from 'next/link';

/* ─── SF Symbol 風アイコン（Apple HIG スタイル） ─── */
const IconCreate = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
  </svg>
);
const IconWand = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
  </svg>
);
const IconDatabase = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
    <ellipse cx="12" cy="5.5" rx="8" ry="3" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 5.5v13c0 1.657 3.582 3 8 3s8-1.343 8-3v-13" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 12c0 1.657 3.582 3 8 3s8-1.343 8-3" opacity={0.4} />
  </svg>
);
const IconSearch = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
    <circle cx="11" cy="11" r="7" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
  </svg>
);

/* ─── ダークテーマカラー ─── */
const themes = {
  red:     { bg: 'bg-[#ff375f]/[0.10]', text: 'text-[#ff6b81]', glow: 'shadow-[#ff375f]/8', border: 'border-[#ff375f]/10' },
  violet:  { bg: 'bg-[#af52de]/[0.10]', text: 'text-[#c77dff]', glow: 'shadow-[#af52de]/8', border: 'border-[#af52de]/10' },
  emerald: { bg: 'bg-[#30d158]/[0.10]', text: 'text-[#30d158]', glow: 'shadow-[#30d158]/8', border: 'border-[#30d158]/10' },
  amber:   { bg: 'bg-[#ffd60a]/[0.10]', text: 'text-[#ffd60a]', glow: 'shadow-[#ffd60a]/8', border: 'border-[#ffd60a]/10' },
  sky:     { bg: 'bg-[#64d2ff]/[0.10]', text: 'text-[#64d2ff]', glow: 'shadow-[#64d2ff]/8', border: 'border-[#64d2ff]/10' },
};

/* ─── メイン機能 ─── */
const MAIN_ACTIONS = [
  {
    href: '/user',
    icon: <IconCreate />,
    label: '問題をつくる',
    description: 'テンプレートから試験問題を\nAIで自動生成',
    theme: 'red',
    badge: 'メイン',
  },
  {
    href: '/dev',
    icon: <IconWand />,
    label: '品質を高める',
    description: 'RAGとプロンプトを調整して\n出力品質を改善',
    theme: 'violet',
    badge: 'チューニング',
  },
];

const SUB_ACTIONS = [
  { href: '/search',    icon: <IconSearch />,   label: '問題を検索',  description: '保存済み問題を検索・閲覧', theme: 'amber' },
  { href: '/db-editor', icon: <IconDatabase />, label: 'DB編集',     description: '問題データを直接編集・管理', theme: 'emerald' },
];

/* ─── メインカード (Apple Music Featured スタイル — Dark) ─── */
function FeatureCard({ href, icon, label, description, theme, badge }) {
  const t = themes[theme];
  return (
    <Link href={href} className="group block">
      <div className={`relative card-premium p-6 transition-all duration-500 ease-out hover:shadow-xl ${t.glow} active:scale-[0.97]`}>
        {/* アイコン + バッジ行 */}
        <div className="flex items-start justify-between mb-5">
          <div className={`w-12 h-12 rounded-2xl ${t.bg} ${t.text} flex items-center justify-center transition-transform duration-500 ease-out group-hover:scale-110`}>
            {icon}
          </div>
          {badge && (
            <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${t.bg} ${t.text}`}>
              {badge}
            </span>
          )}
        </div>
        {/* テキスト */}
        <h3 className="text-[17px] font-bold text-[#f5f5f7] mb-1.5 tracking-tight">{label}</h3>
        <p className="text-[13px] text-[#6c6c70] leading-[1.6] whitespace-pre-line">{description}</p>
        {/* 矢印 */}
        <div className={`absolute right-5 bottom-5 ${t.text} opacity-0 group-hover:opacity-60 transition-all duration-500 translate-x-0 group-hover:translate-x-0.5`}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </div>
      </div>
    </Link>
  );
}

/* ─── サブカード (コンパクト — Dark) ─── */
function CompactCard({ href, icon, label, description, theme }) {
  const t = themes[theme];
  return (
    <Link href={href} className="group block">
      <div className={`flex items-center gap-4 card-premium px-4 py-3.5 transition-all duration-500 ease-out hover:shadow-lg ${t.glow} active:scale-[0.97]`}>
        <div className={`flex-shrink-0 w-10 h-10 rounded-xl ${t.bg} ${t.text} flex items-center justify-center transition-transform duration-500 ease-out group-hover:scale-110`}>
          <div className="scale-90">{icon}</div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-semibold text-[#f5f5f7]">{label}</div>
          <div className="text-[12px] text-[#6c6c70] mt-0.5">{description}</div>
        </div>
        <div className={`flex-shrink-0 ${t.text} opacity-0 group-hover:opacity-40 transition-all duration-500`}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </div>
      </div>
    </Link>
  );
}

/* ─── ページ本体 ─── */
export default function HomePage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-5 py-10 sm:px-6 sm:py-20 pb-28 sm:pb-20">
      <div className="max-w-[480px] w-full mx-auto">

        {/* ── ヒーロー ── */}
        <div className="text-center mb-12 sm:mb-14">
          {/* ロゴマーク */}
          <div className="inline-flex items-center justify-center w-[72px] h-[72px] rounded-[22px] bg-gradient-to-br from-[#ff375f] to-[#d42040] text-white mb-6 shadow-lg shadow-[#ff375f]/20">
            <svg className="w-9 h-9" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          {/* タイトル */}
          <h1 className="text-[44px] sm:text-[56px] font-bold tracking-tight text-[#f5f5f7] mb-3 leading-none">
            REM
          </h1>
          <p className="text-[17px] gradient-text font-semibold">
            Rapid Exam Maker
          </p>
          <p className="text-[15px] text-[#6c6c70] mt-2 leading-relaxed">
            AIと過去問データで、試験問題を賢くつくる
          </p>
        </div>

        {/* ── メイン機能 ── */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-3.5 px-0.5">
            <h2 className="text-[13px] font-semibold text-[#6c6c70] uppercase tracking-wider">はじめる</h2>
            <div className="flex-1 h-px bg-white/[0.08]" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {MAIN_ACTIONS.map((a) => (
              <FeatureCard key={a.href} {...a} />
            ))}
          </div>
        </div>

        {/* ── ツール ── */}
        <div>
          <div className="flex items-center gap-3 mb-3.5 px-0.5">
            <h2 className="text-[13px] font-semibold text-[#6c6c70] uppercase tracking-wider">ツール</h2>
            <div className="flex-1 h-px bg-white/[0.08]" />
          </div>
          <div className="space-y-2.5">
            {SUB_ACTIONS.map((a) => (
              <CompactCard key={a.href} {...a} />
            ))}
          </div>
        </div>

        {/* ── フッター ── */}
        <div className="text-center mt-12 sm:mt-16">
          <div className="inline-flex items-center gap-2 text-[11px] text-[#545456]">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#30d158] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#30d158]"></span>
            </span>
            <span className="font-medium tracking-wider">RAG-Powered</span>
          </div>
        </div>
      </div>
    </div>
  );
}
