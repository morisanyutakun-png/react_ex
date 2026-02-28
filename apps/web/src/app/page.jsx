'use client';

import Link from 'next/link';

/* ─── Apple Music 風カード — 白背景・自然な影 ─── */

/* ─── メイン機能カード ─── */
function ActionCard({ href, icon, label, hint, description, accent }) {
  return (
    <Link href={href} className="group block">
      <div className="relative card-premium p-6 transition-all duration-500 ease-out hover:shadow-lg active:scale-[0.97] overflow-hidden">
        {/* アクセントライン（左端） */}
        <div className={`absolute left-0 top-4 bottom-4 w-[3px] rounded-r-full ${accent} opacity-80 group-hover:opacity-100 transition-opacity`} />

        {/* アイコン */}
        <div className={`w-11 h-11 rounded-2xl ${accent} bg-opacity-10 flex items-center justify-center mb-4 transition-transform duration-500 group-hover:scale-110`}
             style={{ backgroundColor: 'currentColor', opacity: 0.08 }}>
          <div className={accent}>{icon}</div>
        </div>

        {/* テキスト */}
        <h3 className="text-[18px] font-bold text-[#1d1d1f] mb-1 tracking-tight">{label}</h3>
        <p className="text-[13px] text-[#86868b] leading-relaxed mb-3">{description}</p>

        {/* ヒント — 何ができるか一言で */}
        <div className="flex items-center gap-2 text-[12px] font-medium text-[#aeaeb2] group-hover:text-[#fc3c44] transition-colors">
          <span>{hint}</span>
          <svg className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </div>
      </div>
    </Link>
  );
}

/* ─── ツールカード（コンパクト） ─── */
function ToolCard({ href, icon, label, description, accent }) {
  return (
    <Link href={href} className="group block">
      <div className="flex items-center gap-4 card-premium px-5 py-4 transition-all duration-500 hover:shadow-md active:scale-[0.97]">
        <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-transform duration-500 group-hover:scale-110 ${accent}`}
             style={{ backgroundColor: 'currentColor', opacity: 0.08 }}>
          <div className={`scale-90 ${accent}`}>{icon}</div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-semibold text-[#1d1d1f]">{label}</div>
          <div className="text-[12px] text-[#86868b] mt-0.5">{description}</div>
        </div>
        <svg className="w-4 h-4 flex-shrink-0 text-[#c7c7cc] group-hover:text-[#fc3c44] transition-all" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
      </div>
    </Link>
  );
}

/* ─── ページ本体 ─── */
export default function HomePage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-5 py-10 sm:px-6 sm:py-20 pb-28 sm:pb-20">
      <div className="max-w-[520px] w-full mx-auto">

        {/* ── ヒーロー: 一目で「何のアプリか」が伝わる ── */}
        <div className="text-center mb-14">
          {/* ロゴマーク */}
          <div className="inline-flex items-center justify-center w-[72px] h-[72px] rounded-[22px] bg-gradient-to-br from-[#fc3c44] to-[#e0323a] text-white mb-6 shadow-lg shadow-[#fc3c44]/20">
            <svg className="w-9 h-9" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>

          <h1 className="text-[48px] sm:text-[56px] font-bold tracking-tight text-[#1d1d1f] mb-2 leading-none">
            REM
          </h1>
          <p className="text-[17px] gradient-text font-semibold mb-2">
            Rapid Exam Maker
          </p>
          <p className="text-[15px] text-[#86868b] leading-relaxed max-w-sm mx-auto">
            過去問データとAIで、試験問題を賢くつくる。
          </p>
        </div>

        {/* ── メイン機能: 2つだけ。迷わない。 ── */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4 px-1">
            <h2 className="text-[12px] font-bold text-[#86868b] uppercase tracking-widest">はじめる</h2>
            <div className="flex-1 h-px bg-black/[0.06]" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <ActionCard
              href="/user"
              icon={
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              }
              label="問題をつくる"
              description="テンプレートを選んで、AIが試験問題を自動生成します"
              hint="テンプレート選択 → 生成 → PDF"
              accent="text-[#fc3c44]"
            />
            <ActionCard
              href="/dev"
              icon={
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
              }
              label="品質を高める"
              description="RAGとプロンプトを調整して出力品質を改善します"
              hint="プロンプト調整 → テスト → 評価"
              accent="text-[#af52de]"
            />
          </div>
        </div>

        {/* ── ツール: さっと使いたいもの ── */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-4 px-1">
            <h2 className="text-[12px] font-bold text-[#86868b] uppercase tracking-widest">ツール</h2>
            <div className="flex-1 h-px bg-black/[0.06]" />
          </div>
          <div className="space-y-2.5">
            <ToolCard
              href="/search"
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
                  <circle cx="11" cy="11" r="7" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
                </svg>
              }
              label="問題を検索"
              description="保存済みの問題をキーワードや科目で検索"
              accent="text-[#ff9500]"
            />
            <ToolCard
              href="/db-editor"
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
                  <ellipse cx="12" cy="5.5" rx="8" ry="3" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 5.5v13c0 1.657 3.582 3 8 3s8-1.343 8-3v-13" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 12c0 1.657 3.582 3 8 3s8-1.343 8-3" opacity={0.4} />
                </svg>
              }
              label="DB編集"
              description="問題データを直接編集・管理"
              accent="text-[#34c759]"
            />
          </div>
        </div>

        {/* ── ステータス ── */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 text-[11px] text-[#aeaeb2]">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#34c759] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#34c759]"></span>
            </span>
            <span className="font-medium tracking-wider">RAG-Powered</span>
          </div>
        </div>
      </div>
    </div>
  );
}
