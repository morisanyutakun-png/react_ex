'use client';

import Link from 'next/link';

/* ─── アイコンコンポーネント（大きめ・直感的） ─── */
const IconCreate = () => (
  <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 2h6M9 22h6" opacity={0.4} />
  </svg>
);
const IconWand = () => (
  <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.042 21.672L13.684 16.6m0 0l-2.51 2.225.569-9.47 5.227 7.917-3.286-.672zM12 2.25V4.5m5.834.166l-1.591 1.591M20.25 10.5H18M7.757 14.743l-1.59 1.59M6 10.5H3.75m4.007-4.243l-1.59-1.59" />
  </svg>
);
const IconDatabase = () => (
  <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
    <ellipse cx="12" cy="5.5" rx="8" ry="3" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 5.5v13c0 1.657 3.582 3 8 3s8-1.343 8-3v-13" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 12c0 1.657 3.582 3 8 3s8-1.343 8-3" opacity={0.5} />
  </svg>
);
const IconSearch = () => (
  <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
    <circle cx="11" cy="11" r="7" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
  </svg>
);

/* ─── メイン機能の定義 ─── */
const MAIN_ACTIONS = [
  {
    href: '/user',
    icon: <IconCreate />,
    label: '問題をつくる',
    hint: 'テンプレートから試験問題を自動生成',
    accent: 'indigo',
    tag: 'かんたん',
  },
  {
    href: '/dev',
    icon: <IconWand />,
    label: '品質を高める',
    hint: 'RAGとプロンプトを調整して出力を改善',
    accent: 'violet',
    tag: 'チューニング',
  },
];

const SUB_ACTIONS = [
  {
    href: '/db-editor',
    icon: <IconDatabase />,
    label: 'DB編集',
    hint: '問題データを直接編集',
    accent: 'emerald',
  },
  {
    href: '/search',
    icon: <IconSearch />,
    label: '問題を検索',
    hint: '保存済み問題を探す',
    accent: 'amber',
  },
];

/* ─── アクセントカラー定義 ─── */
const accentStyles = {
  indigo: {
    card: 'hover:border-indigo-300 hover:shadow-indigo-100/50',
    icon: 'bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100',
    tag: 'bg-indigo-100 text-indigo-600',
    arrow: 'text-indigo-400 group-hover:text-indigo-600',
  },
  violet: {
    card: 'hover:border-violet-300 hover:shadow-violet-100/50',
    icon: 'bg-violet-50 text-violet-600 group-hover:bg-violet-100',
    tag: 'bg-violet-100 text-violet-600',
    arrow: 'text-violet-400 group-hover:text-violet-600',
  },
  emerald: {
    card: 'hover:border-emerald-300 hover:shadow-emerald-100/50',
    icon: 'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100',
    tag: 'bg-emerald-50 text-emerald-600',
    arrow: 'text-emerald-400 group-hover:text-emerald-600',
  },
  amber: {
    card: 'hover:border-amber-300 hover:shadow-amber-100/50',
    icon: 'bg-amber-50 text-amber-600 group-hover:bg-amber-100',
    tag: 'bg-amber-50 text-amber-600',
    arrow: 'text-amber-400 group-hover:text-amber-600',
  },
};

/* ─── メインカード ─── */
function MainCard({ href, icon, label, hint, accent, tag }) {
  const s = accentStyles[accent];
  return (
    <Link href={href} className="group block">
      <div
        className={`relative flex items-center gap-4 sm:gap-5 bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-200/70 px-4 sm:px-6 py-4 sm:py-5 shadow-sm cursor-pointer transition-all duration-300 ${s.card} hover:shadow-lg active:scale-[0.98]`}
      >
        {/* アイコン */}
        <div className={`flex-shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center transition-colors duration-300 ${s.icon}`}>
          {icon}
        </div>

        {/* テキスト */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 mb-1">
            <span className="text-[17px] font-bold text-slate-800 tracking-tight">{label}</span>
            {tag && (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${s.tag}`}>
                {tag}
              </span>
            )}
          </div>
          <span className="text-[13px] text-slate-400 font-medium">{hint}</span>
        </div>

        {/* 矢印 */}
        <div className={`flex-shrink-0 transition-all duration-300 group-hover:translate-x-1 ${s.arrow}`}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </div>
      </div>
    </Link>
  );
}

/* ─── サブカード（コンパクト） ─── */
function SubCard({ href, icon, label, hint, accent }) {
  const s = accentStyles[accent];
  return (
    <Link href={href} className="group block">
      <div
        className={`flex items-center gap-4 bg-white/60 backdrop-blur-sm rounded-xl border border-slate-200/50 px-5 py-4 cursor-pointer transition-all duration-300 ${s.card} hover:shadow-md active:scale-[0.98]`}
      >
        <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center transition-colors duration-300 ${s.icon}`}>
          <div className="scale-[0.78]">{icon}</div>
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-bold text-slate-700">{label}</span>
          <span className="block text-[12px] text-slate-400 font-medium">{hint}</span>
        </div>
        <div className={`flex-shrink-0 opacity-0 group-hover:opacity-100 transition-all duration-300 group-hover:translate-x-0.5 ${s.arrow}`}>
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
    <div className="min-h-screen flex items-center justify-center px-3 py-6 sm:px-6 sm:py-16 pb-24 sm:pb-16">
      <div className="max-w-xl w-full mx-auto">

        {/* ── ヘッダー ── */}
        <div className="text-center mb-8 sm:mb-12">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-indigo-50/60 text-indigo-500 rounded-full text-[11px] font-bold mb-5 border border-indigo-100/40">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-indigo-500"></span>
            </span>
            RAG-Powered
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-slate-800 mb-3 tracking-tight">
            <span className="gradient-text">ExamGen</span>
            <span className="text-slate-200 font-light ml-2 text-3xl">v2</span>
          </h1>
          <p className="text-[15px] text-slate-400 max-w-md mx-auto leading-relaxed font-medium">
            AIと過去問データで、試験問題を賢くつくる
          </p>
        </div>

        {/* ── 何をしますか？ ── */}
        <div className="mb-4">
          <h2 className="text-[11px] font-black text-slate-400 tracking-[0.15em] uppercase mb-3 px-1">
            何をしますか？
          </h2>
          <div className="space-y-3">
            {MAIN_ACTIONS.map((a) => (
              <MainCard key={a.href} {...a} />
            ))}
          </div>
        </div>

        {/* ── ツール ── */}
        <div className="mt-8">
          <h2 className="text-[11px] font-black text-slate-400 tracking-[0.15em] uppercase mb-3 px-1">
            ツール
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {SUB_ACTIONS.map((a) => (
              <SubCard key={a.href} {...a} />
            ))}
          </div>
        </div>

        {/* ── フッター ── */}
        <div className="text-center mt-10 sm:mt-14 opacity-25 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
          For Educators & Developers
        </div>
      </div>
    </div>
  );
}
