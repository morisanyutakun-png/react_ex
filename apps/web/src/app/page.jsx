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

/* 品質を高める — スパークル + チューニングダイヤル */
function TuneIcon() {
  return (
    <svg className="w-8 h-8" viewBox="0 0 40 40" fill="none">
      {/* 中心のダイヤル */}
      <circle cx="18" cy="20" r="10" stroke="#bf5af2" strokeWidth="1.5" opacity="0.25"/>
      <circle cx="18" cy="20" r="6" stroke="#bf5af2" strokeWidth="1.8" opacity="0.5"/>
      <circle cx="18" cy="20" r="2.5" fill="url(#dialGrad)"/>
      {/* チューニング目盛り */}
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

/* DB編集 — データベースシリンダー + 歯車 */
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

/* ─── メイン機能カード (Vivid) ─── */
function ActionCard({ href, icon, label, hint, description, gradient, glowColor, delay }) {
  return (
    <Link href={href} className="group block stagger-item" style={{ animationDelay: `${delay}ms` }}>
      <div className="relative card-premium card-glow p-5 sm:p-6 transition-all duration-500 ease-out hover:shadow-xl active:scale-[0.97] overflow-hidden">
        {/* 背景グラデーション装飾 */}
        <div className={`absolute -top-8 -right-8 w-28 h-28 rounded-full ${gradient} opacity-[0.07] blur-2xl group-hover:opacity-[0.14] transition-all duration-700 group-hover:scale-125`} />

        {/* アクセントライン（左端） — グラデーション */}
        <div className={`absolute left-0 top-4 bottom-4 w-[3px] rounded-r-full ${gradient} opacity-70 group-hover:opacity-100 transition-all duration-500 group-hover:h-[calc(100%-16px)]`} />

        {/* アイコン — ヴィヴィッドコンテナ */}
        <div className={`icon-vivid w-14 h-14 rounded-2xl mb-4 transition-all duration-500 group-hover:scale-110 group-hover:rotate-[-2deg]`}
             style={{ background: `linear-gradient(135deg, ${glowColor}18, ${glowColor}08)` }}>
          {icon}
        </div>

        {/* テキスト */}
        <h3 className="text-[18px] font-bold text-[#1d1d1f] mb-1.5 tracking-tight">{label}</h3>
        <p className="text-[13px] text-[#6e6e73] leading-relaxed mb-3">{description}</p>

        {/* ヒント — ワークフロー表示 */}
        <div className="flex items-center gap-2 text-[12px] font-semibold opacity-60 group-hover:opacity-100 transition-all duration-400"
             style={{ color: glowColor }}>
          <span>{hint}</span>
          <svg className="w-3.5 h-3.5 transition-transform duration-500 group-hover:translate-x-1" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </div>
      </div>
    </Link>
  );
}

/* ─── ツールカード (Vivid) ─── */
function ToolCard({ href, icon, label, description, glowColor, delay }) {
  return (
    <Link href={href} className="group block stagger-item" style={{ animationDelay: `${delay}ms` }}>
      <div className="relative flex items-center gap-4 card-premium card-glow px-5 py-4 transition-all duration-500 hover:shadow-lg active:scale-[0.97] overflow-hidden">
        {/* 背景グロー */}
        <div className="absolute -left-4 top-1/2 -translate-y-1/2 w-20 h-20 rounded-full opacity-0 group-hover:opacity-[0.08] blur-2xl transition-all duration-700"
             style={{ background: glowColor }} />
        <div className={`icon-vivid flex-shrink-0 w-11 h-11 rounded-xl transition-all duration-500 group-hover:scale-110`}
             style={{ background: `linear-gradient(135deg, ${glowColor}15, ${glowColor}08)` }}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-semibold text-[#1d1d1f]">{label}</div>
          <div className="text-[12px] text-[#6e6e73] mt-0.5">{description}</div>
        </div>
        <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-all duration-400 group-hover:scale-110"
             style={{ background: `${glowColor}10` }}>
          <svg className="w-3.5 h-3.5 transition-all duration-400" style={{ color: glowColor }} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
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
    <div className="relative min-h-screen flex items-center justify-center px-4 py-8 sm:px-6 sm:py-20 pb-28 sm:pb-20 overflow-hidden">

      {/* ── 背景パターン: トポグラフィック・メッシュ ── */}
      <div className="absolute inset-0 pointer-events-none z-0" aria-hidden="true">
        <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
          <defs>
            {/* グリッドドット */}
            <pattern id="heroGrid" x="0" y="0" width="48" height="48" patternUnits="userSpaceOnUse">
              <circle cx="24" cy="24" r="0.8" fill="#c084fc" opacity="0.18" />
            </pattern>
            {/* 六角ハニカム */}
            <pattern id="heroHex" x="0" y="0" width="56" height="48" patternUnits="userSpaceOnUse">
              <path d="M28 0 L42 8 L42 24 L28 32 L14 24 L14 8 Z" fill="none" stroke="#e8457a" strokeWidth="0.5" opacity="0.06" />
              <path d="M0 16 L14 24 L14 40 L0 48 L-14 40 L-14 24 Z" fill="none" stroke="#c084fc" strokeWidth="0.5" opacity="0.04" />
              <path d="M56 16 L70 24 L70 40 L56 48 L42 40 L42 24 Z" fill="none" stroke="#818cf8" strokeWidth="0.5" opacity="0.04" />
            </pattern>
            {/* グラデーション定義 */}
            <radialGradient id="heroGlow1" cx="30%" cy="25%" r="45%">
              <stop offset="0%" stopColor="#f472b6" stopOpacity="0.12" />
              <stop offset="50%" stopColor="#c084fc" stopOpacity="0.06" />
              <stop offset="100%" stopColor="#818cf8" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="heroGlow2" cx="75%" cy="70%" r="40%">
              <stop offset="0%" stopColor="#818cf8" stopOpacity="0.10" />
              <stop offset="50%" stopColor="#c084fc" stopOpacity="0.04" />
              <stop offset="100%" stopColor="#f472b6" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="heroGlow3" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.04" />
              <stop offset="100%" stopColor="transparent" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="ringGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#e8457a" stopOpacity="0.15" />
              <stop offset="50%" stopColor="#c084fc" stopOpacity="0.10" />
              <stop offset="100%" stopColor="#818cf8" stopOpacity="0.05" />
            </linearGradient>
            <linearGradient id="ringGrad2" x1="100%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#818cf8" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#e8457a" stopOpacity="0.04" />
            </linearGradient>
            {/* フェード用マスク */}
            <radialGradient id="fadeMask" cx="50%" cy="45%" r="60%">
              <stop offset="0%" stopColor="white" stopOpacity="1" />
              <stop offset="70%" stopColor="white" stopOpacity="0.6" />
              <stop offset="100%" stopColor="white" stopOpacity="0" />
            </radialGradient>
            <mask id="centerFade">
              <rect width="100%" height="100%" fill="url(#fadeMask)" />
            </mask>
          </defs>

          {/* グラデーションオーブ */}
          <rect width="100%" height="100%" fill="url(#heroGlow1)" />
          <rect width="100%" height="100%" fill="url(#heroGlow2)" />
          <rect width="100%" height="100%" fill="url(#heroGlow3)" />

          {/* グリッドドットレイヤー */}
          <rect width="100%" height="100%" fill="url(#heroGrid)" mask="url(#centerFade)" />

          {/* 六角メッシュレイヤー */}
          <rect width="100%" height="100%" fill="url(#heroHex)" mask="url(#centerFade)" />

          {/* コンセントリック・リング群 */}
          <g opacity="0.5">
            <circle cx="50%" cy="42%" r="140" fill="none" stroke="url(#ringGrad1)" strokeWidth="0.8">
              <animateTransform attributeName="transform" type="rotate" from="0 50% 42%" to="360 50% 42%" dur="90s" repeatCount="indefinite" />
            </circle>
            <circle cx="50%" cy="42%" r="200" fill="none" stroke="url(#ringGrad2)" strokeWidth="0.5" strokeDasharray="8 12">
              <animateTransform attributeName="transform" type="rotate" from="360 50% 42%" to="0 50% 42%" dur="120s" repeatCount="indefinite" />
            </circle>
            <circle cx="50%" cy="42%" r="280" fill="none" stroke="url(#ringGrad1)" strokeWidth="0.4" strokeDasharray="4 20">
              <animateTransform attributeName="transform" type="rotate" from="0 50% 42%" to="360 50% 42%" dur="150s" repeatCount="indefinite" />
            </circle>
            <circle cx="50%" cy="42%" r="380" fill="none" stroke="url(#ringGrad2)" strokeWidth="0.3" strokeDasharray="2 30">
              <animateTransform attributeName="transform" type="rotate" from="360 50% 42%" to="0 50% 42%" dur="180s" repeatCount="indefinite" />
            </circle>
          </g>

          {/* フローティング・パーティクル */}
          <g opacity="0.6">
            <circle r="2" fill="#e8457a" opacity="0.25">
              <animateMotion dur="18s" repeatCount="indefinite" path="M120,200 C200,100 400,300 500,150 C600,50 200,350 120,200" />
            </circle>
            <circle r="1.5" fill="#c084fc" opacity="0.2">
              <animateMotion dur="22s" repeatCount="indefinite" path="M500,300 C380,150 200,250 150,400 C100,500 450,350 500,300" />
            </circle>
            <circle r="1.8" fill="#818cf8" opacity="0.18">
              <animateMotion dur="26s" repeatCount="indefinite" path="M300,100 C450,250 100,350 250,450 C400,500 350,150 300,100" />
            </circle>
            <circle r="1.2" fill="#f472b6" opacity="0.22">
              <animateMotion dur="20s" repeatCount="indefinite" path="M600,350 C500,200 300,400 200,250 C100,100 500,450 600,350" />
            </circle>
          </g>

          {/* コーナーアクセント弧 */}
          <path d="M0 120 Q60 60 120 0" fill="none" stroke="#e8457a" strokeWidth="0.6" opacity="0.1">
            <animate attributeName="opacity" values="0.1;0.18;0.1" dur="6s" repeatCount="indefinite" />
          </path>
          <path d="M100% 100% Q calc(100% - 80px) calc(100% - 80px) calc(100% - 160px) 100%" fill="none" stroke="#818cf8" strokeWidth="0.6" opacity="0.08" />
        </svg>

        {/* ソフトバイナルグラス・オーバーレイ */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#f5f5f7]/30 via-transparent to-[#f5f5f7]/60" />
      </div>

      <div className="relative z-10 max-w-[540px] w-full mx-auto">

        {/* ── ヒーロー ── */}
        <div className="text-center mb-14 stagger-item" style={{ animationDelay: '0ms' }}>
          {/* ロゴマーク — パルスグロー */}
          <div className="inline-flex items-center justify-center w-[72px] h-[72px] sm:w-[80px] sm:h-[80px] rounded-[22px] sm:rounded-[24px] bg-gradient-to-br from-[#e8457a] via-[#f472b6] to-[#c084fc] text-white mb-5 sm:mb-6 shadow-xl shadow-[#e8457a]/25 animate-glow-pulse">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>

          <h1 className="text-[44px] sm:text-[60px] font-black tracking-tight text-[#1d1d1f] mb-2 leading-none">
            REM
          </h1>
          <p className="text-[18px] gradient-text font-bold mb-3">
            Rapid Exam Maker
          </p>
          <p className="text-[14px] sm:text-[15px] text-[#6e6e73] leading-relaxed max-w-[280px] sm:max-w-sm mx-auto">
            過去問データとAIで、試験問題を賢くつくる。
          </p>
        </div>

        {/* ── メイン機能 ── */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-5 px-1 stagger-item" style={{ animationDelay: '80ms' }}>
            <div className="w-1.5 h-1.5 rounded-full bg-[#fc3c44]" />
            <h2 className="text-[12px] font-bold text-[#6e6e73] uppercase tracking-[0.2em]">はじめる</h2>
            <div className="flex-1 h-px bg-gradient-to-r from-black/[0.06] to-transparent" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <ActionCard
              href="/user"
              icon={<CreateIcon />}
              label="問題をつくる"
              description="テンプレートを選んで、AIが試験問題を自動生成"
              hint="テンプレート → 生成 → PDF"
              gradient="bg-gradient-to-br from-[#fc3c44] to-[#ff375f]"
              glowColor="#fc3c44"
              delay={120}
            />
            <ActionCard
              href="/dev"
              icon={<TuneIcon />}
              label="品質を高める"
              description="RAGとプロンプトを調整して出力品質を改善"
              hint="調整 → テスト → 評価"
              gradient="bg-gradient-to-br from-[#bf5af2] to-[#5e5ce6]"
              glowColor="#bf5af2"
              delay={200}
            />
          </div>
        </div>

        {/* ── ツール ── */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-5 px-1 stagger-item" style={{ animationDelay: '260ms' }}>
            <div className="w-1.5 h-1.5 rounded-full bg-[#ff9f0a]" />
            <h2 className="text-[12px] font-bold text-[#6e6e73] uppercase tracking-[0.2em]">ツール</h2>
            <div className="flex-1 h-px bg-gradient-to-r from-black/[0.06] to-transparent" />
          </div>
          <div className="space-y-3">
            <ToolCard
              href="/search"
              icon={<SearchIcon />}
              label="問題を検索"
              description="キーワードや科目でスマート検索"
              glowColor="#ff9f0a"
              delay={300}
            />
            <ToolCard
              href="/db-editor"
              icon={<DbIcon />}
              label="DB編集"
              description="問題データを直接編集・管理"
              glowColor="#30d158"
              delay={360}
            />
          </div>
        </div>

        {/* ── ヘルプ ── */}
        <div className="mb-12 stagger-item" style={{ animationDelay: '380ms' }}>
          <Link href="/help" className="group block">
            <div className="relative flex items-center gap-4 card-premium card-glow px-5 py-4 transition-all duration-500 hover:shadow-lg active:scale-[0.97] overflow-hidden">
              <div className="absolute -left-4 top-1/2 -translate-y-1/2 w-20 h-20 rounded-full opacity-0 group-hover:opacity-[0.08] blur-2xl transition-all duration-700"
                   style={{ background: '#5856d6' }} />
              <div className="icon-vivid flex-shrink-0 w-11 h-11 rounded-xl transition-all duration-500 group-hover:scale-110"
                   style={{ background: 'linear-gradient(135deg, #5856d615, #5856d608)' }}>
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="#5856d6" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[15px] font-semibold text-[#1d1d1f]">はじめてガイド</div>
                <div className="text-[12px] text-[#6e6e73] mt-0.5">使い方・ワークフロー・用語集</div>
              </div>
              <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-all duration-400 group-hover:scale-110"
                   style={{ background: '#5856d610' }}>
                <svg className="w-3.5 h-3.5 transition-all duration-400 text-[#5856d6]" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </div>
            </div>
          </Link>
        </div>

        {/* ── ステータス ── */}
        <div className="text-center stagger-item" style={{ animationDelay: '440ms' }}>
          <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-white/60 backdrop-blur-xl border border-black/[0.04] shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#30d158] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#30d158]"></span>
            </span>
            <span className="text-[11px] font-bold text-[#6e6e73] tracking-wider uppercase">RAG-Powered</span>
          </div>
        </div>
      </div>
    </div>
  );
}
