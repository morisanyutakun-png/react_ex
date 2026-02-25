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
    card: 'hover:border-indigo-200',
    icon: 'bg-indigo-50 text-indigo-600',
    tag: 'bg-indigo-50 text-indigo-600',
    arrow: 'text-gray-300 group-hover:text-indigo-500',
  },
  violet: {
    card: 'hover:border-violet-200',
    icon: 'bg-violet-50 text-violet-600',
    tag: 'bg-violet-50 text-violet-600',
    arrow: 'text-gray-300 group-hover:text-violet-500',
  },
  emerald: {
    card: 'hover:border-emerald-200',
    icon: 'bg-emerald-50 text-emerald-600',
    tag: 'bg-emerald-50 text-emerald-600',
    arrow: 'text-gray-300 group-hover:text-emerald-500',
  },
  amber: {
    card: 'hover:border-amber-200',
    icon: 'bg-amber-50 text-amber-600',
    tag: 'bg-amber-50 text-amber-600',
    arrow: 'text-gray-300 group-hover:text-amber-500',
  },
};

/* ─── メインカード ─── */
function MainCard({ href, icon, label, hint, accent, tag }) {
  const s = accentStyles[accent];
  return (
    <Link href={href} className="group block">
      <div
        className={`relative flex items-center gap-4 bg-white rounded-lg border border-gray-200 px-4 sm:px-5 py-4 cursor-pointer transition-all duration-200 ${s.card} hover:shadow-sm active:scale-[0.99]`}
      >
        {/* アイコン */}
        <div className={`flex-shrink-0 w-11 h-11 rounded-lg flex items-center justify-center ${s.icon}`}>
          {icon}
        </div>

        {/* テキスト */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-base font-semibold text-gray-900">{label}</span>
            {tag && (
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${s.tag}`}>
                {tag}
              </span>
            )}
          </div>
          <span className="text-xs text-gray-500">{hint}</span>
        </div>

        {/* 矢印 */}
        <div className={`flex-shrink-0 transition-all duration-200 group-hover:translate-x-0.5 ${s.arrow}`}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
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
        className={`flex items-center gap-3 bg-white rounded-lg border border-gray-200 px-4 py-3 cursor-pointer transition-all duration-200 ${s.card} hover:shadow-sm active:scale-[0.99]`}
      >
        <div className={`flex-shrink-0 w-9 h-9 rounded-md flex items-center justify-center ${s.icon}`}>
          <div className="scale-[0.78]">{icon}</div>
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium text-gray-800">{label}</span>
          <span className="block text-[11px] text-gray-400">{hint}</span>
        </div>
        <div className={`flex-shrink-0 opacity-0 group-hover:opacity-100 transition-all duration-200 ${s.arrow}`}>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
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
    <div className="min-h-screen flex items-center justify-center px-4 py-8 sm:px-6 sm:py-16 pb-24 sm:pb-16">
      <div className="max-w-lg w-full mx-auto">

        {/* ── ヘッダー ── */}
        <div className="text-center mb-8 sm:mb-10">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 text-indigo-600 rounded-md text-[11px] font-medium mb-4 border border-indigo-100">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-indigo-500"></span>
            </span>
            RAG-Powered
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
            <span className="gradient-text">ExamGen</span>
            <span className="text-gray-300 font-normal ml-1.5 text-2xl">v2</span>
          </h1>
          <p className="text-sm text-gray-500 max-w-sm mx-auto leading-relaxed">
            AIと過去問データで、試験問題を賢くつくる
          </p>
        </div>

        {/* ── 何をしますか？ ── */}
        <div className="mb-6">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2.5 px-0.5">
            何をしますか？
          </h2>
          <div className="space-y-2">
            {MAIN_ACTIONS.map((a) => (
              <MainCard key={a.href} {...a} />
            ))}
          </div>
        </div>

        {/* ── ツール ── */}
        <div>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2.5 px-0.5">
            ツール
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {SUB_ACTIONS.map((a) => (
              <SubCard key={a.href} {...a} />
            ))}
          </div>
        </div>

        {/* ── フッター ── */}
        <div className="text-center mt-10 sm:mt-12 text-[10px] font-medium uppercase tracking-widest text-gray-300">
          For Educators & Developers
        </div>
      </div>
    </div>
  );
}
