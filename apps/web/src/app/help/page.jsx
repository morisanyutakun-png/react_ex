'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

/* ═══════════════════════════════════════════
   § 0  アイコン SVG
   ═══════════════════════════════════════════ */

function IcoCreate() {
  return (
    <svg className="w-10 h-10" viewBox="0 0 40 40" fill="none">
      <rect x="6" y="3" width="22" height="30" rx="3" fill="white" stroke="#fc3c44" strokeWidth="1.8"/>
      <rect x="6" y="3" width="22" height="30" rx="3" fill="url(#hD1)" opacity=".08"/>
      <line x1="11" y1="10" x2="23" y2="10" stroke="#fc3c44" strokeWidth="1.2" opacity=".4" strokeLinecap="round"/>
      <line x1="11" y1="14" x2="20" y2="14" stroke="#fc3c44" strokeWidth="1.2" opacity=".3" strokeLinecap="round"/>
      <line x1="11" y1="18" x2="22" y2="18" stroke="#fc3c44" strokeWidth="1.2" opacity=".25" strokeLinecap="round"/>
      <rect x="10" y="22" width="14" height="7" rx="2" fill="#fc3c44" opacity=".08"/>
      <text x="13" y="27.5" fontSize="6" fontWeight="bold" fill="#fc3c44" fontFamily="serif" opacity=".7">∑ f(x)</text>
      <circle cx="30" cy="8" r="7" fill="url(#hP1)"/>
      <line x1="27" y1="8" x2="33" y2="8" stroke="white" strokeWidth="2" strokeLinecap="round"/>
      <line x1="30" y1="5" x2="30" y2="11" stroke="white" strokeWidth="2" strokeLinecap="round"/>
      <defs>
        <linearGradient id="hD1" x1="6" y1="3" x2="28" y2="33"><stop stopColor="#fc3c44"/><stop offset="1" stopColor="#bf5af2"/></linearGradient>
        <linearGradient id="hP1" x1="23" y1="1" x2="37" y2="15"><stop stopColor="#fc3c44"/><stop offset="1" stopColor="#ff375f"/></linearGradient>
      </defs>
    </svg>
  );
}

function IcoTune() {
  return (
    <svg className="w-10 h-10" viewBox="0 0 40 40" fill="none">
      <circle cx="18" cy="20" r="10" stroke="#bf5af2" strokeWidth="1.5" opacity=".25"/>
      <circle cx="18" cy="20" r="6" stroke="#bf5af2" strokeWidth="1.8" opacity=".5"/>
      <circle cx="18" cy="20" r="2.5" fill="url(#hDi1)"/>
      <line x1="18" y1="8" x2="18" y2="11" stroke="#bf5af2" strokeWidth="1.2" opacity=".4" strokeLinecap="round"/>
      <line x1="18" y1="29" x2="18" y2="32" stroke="#bf5af2" strokeWidth="1.2" opacity=".4" strokeLinecap="round"/>
      <line x1="6" y1="20" x2="9" y2="20" stroke="#bf5af2" strokeWidth="1.2" opacity=".4" strokeLinecap="round"/>
      <line x1="27" y1="20" x2="30" y2="20" stroke="#bf5af2" strokeWidth="1.2" opacity=".4" strokeLinecap="round"/>
      <path d="M32 8 L33.2 11.5 L36.5 12 L33.2 12.5 L32 16 L30.8 12.5 L27.5 12 L30.8 11.5Z" fill="url(#hSp1)" opacity=".9"/>
      <path d="M18 10 A10 10 0 0 1 28 20" stroke="url(#hAr1)" strokeWidth="2" strokeLinecap="round" fill="none"/>
      <defs>
        <linearGradient id="hDi1" x1="15" y1="17" x2="21" y2="23"><stop stopColor="#bf5af2"/><stop offset="1" stopColor="#5e5ce6"/></linearGradient>
        <linearGradient id="hSp1" x1="27" y1="8" x2="37" y2="16"><stop stopColor="#ff9f0a"/><stop offset="1" stopColor="#ff375f"/></linearGradient>
        <linearGradient id="hAr1" x1="18" y1="10" x2="28" y2="20"><stop stopColor="#fc3c44"/><stop offset="1" stopColor="#bf5af2"/></linearGradient>
      </defs>
    </svg>
  );
}

function IcoSearch() {
  return (
    <svg className="w-10 h-10" viewBox="0 0 36 36" fill="none">
      <rect x="6" y="4" width="16" height="20" rx="2.5" fill="white" stroke="#ff9f0a" strokeWidth="1.5"/>
      <line x1="10" y1="10" x2="18" y2="10" stroke="#ff9f0a" strokeWidth="1" opacity=".4" strokeLinecap="round"/>
      <line x1="10" y1="13" x2="16" y2="13" stroke="#ff9f0a" strokeWidth="1" opacity=".3" strokeLinecap="round"/>
      <line x1="10" y1="16" x2="17" y2="16" stroke="#ff9f0a" strokeWidth="1" opacity=".25" strokeLinecap="round"/>
      <circle cx="25" cy="22" r="7" stroke="url(#hSe1)" strokeWidth="2" fill="white" fillOpacity=".8"/>
      <line x1="30" y1="27" x2="34" y2="31" stroke="url(#hSe1)" strokeWidth="2.5" strokeLinecap="round"/>
      <defs><linearGradient id="hSe1" x1="18" y1="15" x2="34" y2="31"><stop stopColor="#ff9f0a"/><stop offset="1" stopColor="#ff375f"/></linearGradient></defs>
    </svg>
  );
}

function IcoDb() {
  return (
    <svg className="w-10 h-10" viewBox="0 0 36 36" fill="none">
      <ellipse cx="16" cy="9" rx="10" ry="4" fill="white" stroke="#30d158" strokeWidth="1.5"/>
      <path d="M6 9v16c0 2.2 4.5 4 10 4s10-1.8 10-4V9" stroke="#30d158" strokeWidth="1.5" fill="white"/>
      <ellipse cx="16" cy="9" rx="10" ry="4" fill="url(#hDb1)" opacity=".12"/>
      <path d="M6 17c0 2.2 4.5 4 10 4s10-1.8 10-4" stroke="#30d158" strokeWidth="1" opacity=".3"/>
      <path d="M6 22c0 2.2 4.5 4 10 4s10-1.8 10-4" stroke="#30d158" strokeWidth="1" opacity=".2"/>
      <circle cx="29" cy="27" r="5" fill="white" stroke="#30d158" strokeWidth="1.3"/>
      <circle cx="29" cy="27" r="2" fill="#30d158" opacity=".3"/>
      <defs><linearGradient id="hDb1" x1="6" y1="5" x2="26" y2="13"><stop stopColor="#30d158"/><stop offset="1" stopColor="#0a84ff"/></linearGradient></defs>
    </svg>
  );
}


/* ═══════════════════════════════════════════
   § 1  TOC
   ═══════════════════════════════════════════ */

const TOC = [
  { id: 'overview',   label: '概要',        emoji: '📖' },
  { id: 'quickstart', label: 'はじめかた',    emoji: '🚀' },
  { id: 'create',     label: 'つくる',       emoji: '📝' },
  { id: 'tune',       label: '高める',       emoji: '⚙️' },
  { id: 'search',     label: '検索',        emoji: '🔍' },
  { id: 'db',         label: 'DB編集',      emoji: '🗄️' },
  { id: 'faq',        label: 'FAQ',         emoji: '❓' },
];

function TableOfContents({ activeId }) {
  return (
    <nav className="space-y-0.5">
      {TOC.map(({ id, label, emoji }) => (
        <a key={id} href={`#${id}`}
          className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-semibold transition-all duration-300
            ${activeId === id ? 'bg-[#0a84ff]/[0.08] text-[#0a84ff]' : 'text-[#86868b] hover:bg-black/[0.03] hover:text-[#1d1d1f]'}`}>
          <span className="text-[14px]">{emoji}</span>{label}
        </a>
      ))}
    </nav>
  );
}


/* ═══════════════════════════════════════════
   § 2  画面モック
   ═══════════════════════════════════════════ */

function ScreenFrame({ children, title, color }) {
  return (
    <div className="rounded-2xl border border-black/[0.06] bg-white shadow-lg overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-black/[0.04]" style={{ background: `linear-gradient(90deg,${color}08,${color}02)` }}>
        <div className="flex gap-1">
          <div className="w-2 h-2 rounded-full bg-[#ff5f57]" />
          <div className="w-2 h-2 rounded-full bg-[#febc2e]" />
          <div className="w-2 h-2 rounded-full bg-[#28c840]" />
        </div>
        <span className="text-[10px] font-bold text-[#86868b] tracking-wide ml-1">{title}</span>
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

function DiagramCreateWizard() {
  const steps = [
    { n: 1, label: 'テンプレート', active: true },
    { n: 2, label: '設定' },
    { n: 3, label: 'PDF' },
    { n: 4, label: '生成' },
    { n: 5, label: '完成' },
  ];
  return (
    <ScreenFrame title="問題をつくる" color="#fc3c44">
      <div className="flex items-center gap-1 mb-3">
        {steps.map((s, i) => (
          <div key={i} className="flex items-center gap-1 flex-1">
            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold ${s.active ? 'text-white bg-[#fc3c44]' : 'text-[#c7c7cc] border border-[#e5e5ea]'}`}>{s.n}</div>
            {i < steps.length - 1 && <div className="flex-1 h-[2px] rounded-full" style={{ background: i === 0 ? '#fc3c44' : '#e5e5ea' }} />}
          </div>
        ))}
      </div>
      <div className="space-y-1.5">
        {['数学 — 微分積分', '物理 — 力学', '化学 — 有機化学'].map((t, i) => (
          <div key={i} className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border text-[10px] font-semibold
            ${i === 0 ? 'border-[#fc3c44]/30 bg-[#fc3c44]/[0.04] text-[#fc3c44]' : 'border-black/[0.04] text-[#86868b]'}`}>
            <div className={`w-3 h-3 rounded-full border-2 flex items-center justify-center ${i === 0 ? 'border-[#fc3c44]' : 'border-[#d1d1d6]'}`}>
              {i === 0 && <div className="w-1.5 h-1.5 rounded-full bg-[#fc3c44]" />}
            </div>
            {t}
          </div>
        ))}
      </div>
    </ScreenFrame>
  );
}

function DiagramTunePage() {
  return (
    <ScreenFrame title="品質を高める" color="#bf5af2">
      <div className="flex gap-1 mb-3">
        {['⚙️ 設定', '▶️ 実行', '✅ 評価'].map((t, i) => (
          <div key={i} className={`flex-1 text-center py-1.5 rounded-lg text-[9px] font-bold ${i === 0 ? 'bg-[#bf5af2] text-white' : 'bg-[#f5f5f7] text-[#86868b]'}`}>{t}</div>
        ))}
      </div>
      <div className="space-y-2 p-2.5 rounded-xl bg-[#f5f5f7] border border-black/[0.04]">
        <div className="text-[9px] font-bold text-[#86868b] mb-1">バランス調整</div>
        {[
          { label: '類似度', value: 60, color: '#0a84ff' },
          { label: '難易度', value: 25, color: '#bf5af2' },
          { label: 'ひっかけ', value: 15, color: '#ff9f0a' },
        ].map((s) => (
          <div key={s.label} className="flex items-center gap-2">
            <span className="text-[8px] font-semibold text-[#6e6e73] w-10">{s.label}</span>
            <div className="flex-1 h-2 rounded-full bg-white border border-black/[0.04] overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${s.value}%`, background: s.color }} />
            </div>
            <span className="text-[8px] font-bold w-6 text-right" style={{ color: s.color }}>{s.value}%</span>
          </div>
        ))}
      </div>
    </ScreenFrame>
  );
}

function DiagramSearchPage() {
  return (
    <ScreenFrame title="問題を検索" color="#ff9f0a">
      <div className="flex items-center gap-2 px-2.5 py-2 rounded-xl bg-[#f5f5f7] border border-black/[0.04] mb-2.5">
        <svg className="w-3.5 h-3.5 text-[#aeaeb2]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        <span className="text-[9px] text-[#aeaeb2]">キーワードを入力...</span>
      </div>
      <div className="flex gap-1 mb-2.5 flex-wrap">
        {['数学', '★3', '微積分'].map((f, i) => (
          <span key={i} className="px-2 py-0.5 rounded-full text-[8px] font-bold bg-[#ff9f0a]/10 text-[#ff9f0a] border border-[#ff9f0a]/20">{f}</span>
        ))}
      </div>
      {[1, 2].map((r) => (
        <div key={r} className="flex items-start gap-2 p-2 rounded-lg border border-black/[0.04] mb-1.5 bg-white/60">
          <div className="text-[8px] font-bold text-[#ff9f0a] bg-[#ff9f0a]/10 px-1.5 py-0.5 rounded">#{r}</div>
          <div className="flex-1"><div className="h-1.5 w-3/4 bg-[#e5e5ea] rounded-full mb-1" /><div className="h-1.5 w-1/2 bg-[#e5e5ea] rounded-full" /></div>
        </div>
      ))}
    </ScreenFrame>
  );
}

function DiagramDbEditor() {
  return (
    <ScreenFrame title="DB編集" color="#30d158">
      <div className="flex gap-1 mb-2.5">
        {['📋 データ一覧', '➕ かんたん登録'].map((t, i) => (
          <div key={i} className={`flex-1 text-center py-1.5 rounded-lg text-[9px] font-bold ${i === 0 ? 'bg-[#30d158] text-white' : 'bg-[#f5f5f7] text-[#86868b]'}`}>{t}</div>
        ))}
      </div>
      <div className="rounded-lg border border-black/[0.04] overflow-hidden">
        <div className="grid grid-cols-4 text-[7px] font-bold text-[#86868b] bg-[#f5f5f7] px-2 py-1.5"><span>ID</span><span>科目</span><span>難易度</span><span>操作</span></div>
        {[{ id: 1, s: '数学', d: '★3' }, { id: 2, s: '物理', d: '★4' }].map((r) => (
          <div key={r.id} className="grid grid-cols-4 text-[8px] text-[#6e6e73] px-2 py-1.5 border-t border-black/[0.03]">
            <span className="font-bold text-[#30d158]">{r.id}</span><span>{r.s}</span><span>{r.d}</span><span className="text-[#0a84ff]">✏️</span>
          </div>
        ))}
      </div>
    </ScreenFrame>
  );
}


/* ═══════════════════════════════════════════
   § 3  抽象フロー図（セキュア版）
   ═══════════════════════════════════════════ */

function FlowDiagram() {
  return (
    <svg viewBox="0 0 480 100" fill="none" className="w-full h-auto">
      {/* テンプレート */}
      <rect x="0" y="20" width="120" height="60" rx="16" fill="white" stroke="#fc3c44" strokeWidth="1.5"/>
      <rect x="0" y="20" width="120" height="60" rx="16" fill="#fc3c44" opacity=".04"/>
      <text x="60" y="48" textAnchor="middle" fontSize="11" fontWeight="800" fill="#fc3c44">テンプレート</text>
      <text x="60" y="63" textAnchor="middle" fontSize="8" fill="#86868b">教科・分野・難易度</text>

      {/* 矢印 1 */}
      <line x1="125" y1="50" x2="170" y2="50" stroke="#d1d1d6" strokeWidth="2" strokeDasharray="4 3" markerEnd="url(#fArr)"/>

      {/* AI 生成 */}
      <rect x="175" y="10" width="130" height="80" rx="20" fill="white" stroke="url(#fGr1)" strokeWidth="1.8"/>
      <rect x="175" y="10" width="130" height="80" rx="20" fill="url(#fGr2)" opacity=".04"/>
      <text x="240" y="40" textAnchor="middle" fontSize="18">🤖</text>
      <text x="240" y="57" textAnchor="middle" fontSize="11" fontWeight="800" fill="#bf5af2">REM が自動生成</text>
      <text x="240" y="72" textAnchor="middle" fontSize="8" fill="#86868b">AI × 過去問データ</text>

      {/* 矢印 2 */}
      <line x1="310" y1="50" x2="355" y2="50" stroke="#d1d1d6" strokeWidth="2" strokeDasharray="4 3" markerEnd="url(#fArr)"/>

      {/* PDF */}
      <rect x="360" y="20" width="120" height="60" rx="16" fill="white" stroke="#30d158" strokeWidth="1.5"/>
      <rect x="360" y="20" width="120" height="60" rx="16" fill="#30d158" opacity=".04"/>
      <text x="420" y="48" textAnchor="middle" fontSize="11" fontWeight="800" fill="#30d158">試験問題 完成</text>
      <text x="420" y="63" textAnchor="middle" fontSize="8" fill="#86868b">PDF ダウンロード</text>

      <defs>
        <linearGradient id="fGr1" x1="175" y1="10" x2="305" y2="90"><stop stopColor="#bf5af2"/><stop offset="1" stopColor="#5e5ce6"/></linearGradient>
        <linearGradient id="fGr2" x1="175" y1="10" x2="305" y2="90"><stop stopColor="#bf5af2"/><stop offset="1" stopColor="#fc3c44"/></linearGradient>
        <marker id="fArr" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8 Z" fill="#d1d1d6"/></marker>
      </defs>
    </svg>
  );
}


/* ═══════════════════════════════════════════
   § 4  FeatureSection (簡潔版)
   ═══════════════════════════════════════════ */

function FeatureSection({ id, icon, title, subtitle, color, href, diagram, steps, tips }) {
  return (
    <section id={id} className="scroll-mt-24">
      <div className="relative overflow-hidden rounded-[28px] bg-white/70 backdrop-blur-xl border border-black/[0.04] shadow-lg shadow-black/[0.03] transition-all duration-300 hover:shadow-xl">
        <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: `linear-gradient(90deg, ${color}, ${color}66)` }} />
        <div className="p-6 sm:p-8">
          {/* Header */}
          <div className="flex items-center gap-3.5 mb-2">
            <div className="flex items-center justify-center w-12 h-12 rounded-2xl shadow-lg flex-shrink-0"
                 style={{ background: `linear-gradient(135deg, ${color}18, ${color}06)`, boxShadow: `0 4px 20px ${color}18` }}>
              {icon}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-[18px] font-black text-[#1d1d1f] tracking-tight">{title}</h3>
              <p className="text-[12px] text-[#86868b] mt-0.5">{subtitle}</p>
            </div>
            <Link href={href} className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-bold text-white shadow-md hover:shadow-lg transition-all duration-300 hover:scale-[1.03] active:scale-[0.97]"
                  style={{ background: `linear-gradient(135deg, ${color}, ${color}cc)`, boxShadow: `0 4px 12px ${color}30` }}>
              開く
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
            </Link>
          </div>

          {/* Diagram + Steps */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mt-5">
            <div className="order-2 sm:order-1">{diagram}</div>
            <div className="order-1 sm:order-2 space-y-2.5">
              {steps.map((step, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <div className="flex items-center justify-center w-6 h-6 rounded-lg text-white text-[10px] font-bold flex-shrink-0 mt-0.5"
                       style={{ background: `linear-gradient(135deg, ${color}, ${color}bb)` }}>{i + 1}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-bold text-[#1d1d1f] leading-snug">{step.title}</div>
                    <div className="text-[11px] text-[#86868b] mt-0.5 leading-relaxed">{step.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tips */}
          {tips && (
            <div className="mt-5 p-4 rounded-2xl border border-black/[0.04]" style={{ background: `${color}04` }}>
              <div className="flex items-center gap-1.5 mb-2">
                <svg className="w-3.5 h-3.5" style={{ color }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
                </svg>
                <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color }}>ヒント</span>
              </div>
              <ul className="space-y-1">
                {tips.map((tip, i) => (
                  <li key={i} className="text-[11px] text-[#6e6e73] flex items-start gap-2 leading-relaxed">
                    <span className="mt-[5px] flex-shrink-0 w-1 h-1 rounded-full" style={{ background: color }} />{tip}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Mobile CTA */}
          <Link href={href} className="sm:hidden flex items-center justify-center gap-2 mt-4 px-4 py-3 rounded-2xl text-[14px] font-bold text-white shadow-lg active:scale-[0.97] transition-all"
                style={{ background: `linear-gradient(135deg, ${color}, ${color}cc)` }}>
            ページを開く →
          </Link>
        </div>
      </div>
    </section>
  );
}


/* ═══════════════════════════════════════════
   § 5  FAQ（ユーザー向けのみ・簡潔版）
   ═══════════════════════════════════════════ */

const FAQ_DATA = [
  {
    category: '基本', color: '#fc3c44', icon: '🎯',
    items: [
      { q: 'テンプレートがない場合は？', a: '「問題をつくる」ページ下部から新規追加できます。教科・分野・難易度を設定するだけでOKです。' },
      { q: 'どの教科に対応している？', a: '数学・物理・化学・英語・生物・情報の6教科。カスタムテンプレートで他教科も設定できます。' },
      { q: '何度でも再生成できる？', a: 'はい。同じ設定で「生成」を押すたび、毎回異なるバリエーションが作成されます。' },
      { q: '出題形式は選べる？', a: '記述式・穴埋め・選択肢(4択)・○×の4種類から選択可能です。' },
    ],
  },
  {
    category: '生成・PDF', color: '#bf5af2', icon: '📄',
    items: [
      { q: 'PDFプリセットとは？', a: '試験問題・ワークシート・フラッシュカード・模擬試験の4形式。用途に合わせて選ぶだけです。' },
      { q: '手動モードとは？', a: 'プロンプトをコピーして、お好みのAI(ChatGPT/Claude等)に貼り付けて使うモードです。' },
      { q: '品質評価はどう活用される？', a: '評価データが次回の生成に自動反映。使い続けるほど、好みに合った問題が生まれます。' },
      { q: '図やグラフを含む問題も作れる？', a: 'はい。生成設定で図表オプションを選択すると、数式グラフや回路図入りの問題を生成できます。' },
    ],
  },
  {
    category: '検索・データ', color: '#0a84ff', icon: '🔍',
    items: [
      { q: '検索のフィルターは？', a: 'キーワード・科目・分野（科目連動）・難易度の4条件で絞り込めます。' },
      { q: '検索結果から類題を作れる？', a: 'はい。結果カードの「類題を生成」ボタンで、その場でAIが類題を作成します。' },
      { q: 'データを誤削除した場合は？', a: '削除前に確認ダイアログが表示されます。万一の場合は管理者にお問い合わせください。' },
      { q: 'かんたん登録とは？', a: 'DB編集ページの登録フォーム。必須項目を入力するだけで問題を追加でき、難易度も自動推定されます。' },
    ],
  },
];

function FaqCategory({ category, color, icon, items }) {
  return (
    <div className="relative overflow-hidden rounded-[24px] bg-white/65 backdrop-blur-xl border border-black/[0.04] shadow-sm">
      <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(90deg, ${color}, ${color}66)` }} />
      <div className="px-5 pt-5 pb-2">
        <div className="flex items-center gap-2.5">
          <span className="text-[16px]">{icon}</span>
          <h4 className="text-[15px] font-bold text-[#1d1d1f] tracking-tight">{category}</h4>
        </div>
      </div>
      <div className="px-3 pb-3 space-y-0.5">
        {items.map((faq, i) => (
          <details key={i} className="group">
            <summary className="cursor-pointer px-3 py-2.5 rounded-xl text-[13px] font-semibold text-[#1d1d1f] select-none flex items-center gap-2.5 transition-all hover:bg-black/[0.02]">
              <span className="flex-1">{faq.q}</span>
              <svg className="w-4 h-4 text-[#c7c7cc] transition-transform duration-200 group-open:rotate-180 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </summary>
            <div className="px-3 pb-2.5">
              <p className="text-[12px] text-[#6e6e73] leading-relaxed">{faq.a}</p>
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════
   § 6  用語集（厳選6語）
   ═══════════════════════════════════════════ */

const GLOSSARY = [
  { term: 'テンプレート', def: '教科・分野・難易度が定義された問題生成の設計図。繰り返し使えます。', color: '#fc3c44' },
  { term: 'RAG', ruby: 'ラグ', def: '過去問データを参照して、AI生成の品質を高める仕組み。', color: '#bf5af2' },
  { term: 'プリセット', def: 'PDF出力や生成バランスの事前設定。ワンタップで切り替え可能。', color: '#ff9f0a' },
  { term: 'フィードバック', def: '生成問題への評価。保存すると次回の生成に自動反映されます。', color: '#30d158' },
  { term: 'チューニング', def: '生成バランスを調整して品質を改善するプロセス。', color: '#5856d6' },
  { term: 'LaTeX', ruby: 'ラテフ', def: '数式を美しく表現するための記述形式。PDF出力に使用されます。', color: '#0a84ff' },
];


/* ═══════════════════════════════════════════
   ◆ メインページ
   ═══════════════════════════════════════════ */

export default function HelpPage() {
  const [activeSection, setActiveSection] = useState('overview');

  useEffect(() => {
    const ids = TOC.map(t => t.id);
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveSection(entry.target.id);
        }
      },
      { rootMargin: '-20% 0px -60% 0px', threshold: 0.1 }
    );
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-14 pb-28 sm:pb-14">

      {/* ── ヒーロー ── */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center justify-center w-[72px] h-[72px] rounded-[22px] bg-gradient-to-br from-[#0a84ff] via-[#5856d6] to-[#bf5af2] text-white mb-5 shadow-xl shadow-[#5856d6]/25 animate-glow-pulse">
          <svg className="w-9 h-9" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
          </svg>
        </div>
        <h1 className="text-[36px] sm:text-[48px] font-black tracking-tight text-[#1d1d1f] mb-2 leading-none">
          はじめてガイド
        </h1>
        <p className="text-[15px] sm:text-[17px] text-[#86868b] max-w-sm mx-auto leading-relaxed">
          REM の使い方をかんたんにご案内します。
        </p>
        <Link href="/" className="inline-flex items-center gap-2 mt-5 px-5 py-2 rounded-full bg-white/60 backdrop-blur-lg border border-black/[0.04] shadow-sm text-[13px] font-bold text-[#86868b] hover:text-[#fc3c44] hover:border-[#fc3c44]/20 transition-all">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
          ホームに戻る
        </Link>
      </div>

      {/* ── 2カラム ── */}
      <div className="flex gap-8">
        <aside className="hidden lg:block w-[160px] flex-shrink-0">
          <div className="sticky top-20">
            <div className="text-[10px] font-bold text-[#aeaeb2] uppercase tracking-[0.2em] mb-3 px-3">目次</div>
            <TableOfContents activeId={activeSection} />
          </div>
        </aside>

        <div className="flex-1 min-w-0 space-y-10">

          {/* ═══ 概要 ═══ */}
          <section id="overview" className="scroll-mt-24">
            <div className="relative overflow-hidden rounded-[28px] bg-white/70 backdrop-blur-xl border border-black/[0.04] shadow-lg p-6 sm:p-8">
              <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#fc3c44] via-[#bf5af2] to-[#0a84ff] opacity-70" />

              <h2 className="text-[20px] font-black text-[#1d1d1f] tracking-tight mb-2">REM とは？</h2>
              <p className="text-[14px] text-[#6e6e73] leading-relaxed mb-5">
                <strong className="text-[#1d1d1f]">Rapid Exam Maker</strong> — AIと過去問データを活用して、高品質な試験問題をかんたんに作成できるサービスです。
              </p>

              <div className="flex flex-wrap gap-2 mb-6">
                {[
                  { tag: 'AI 問題生成', color: '#fc3c44' },
                  { tag: '過去問活用', color: '#bf5af2' },
                  { tag: 'PDF 出力', color: '#ff9f0a' },
                  { tag: '品質改善', color: '#30d158' },
                  { tag: '6教科対応', color: '#0a84ff' },
                ].map(({ tag, color }) => (
                  <span key={tag} className="px-3 py-1 rounded-full text-[11px] font-bold border"
                        style={{ color, borderColor: `${color}20`, background: `${color}08` }}>{tag}</span>
                ))}
              </div>

              {/* 抽象フロー図 */}
              <div className="p-4 sm:p-5 rounded-2xl bg-[#fafafa] border border-black/[0.04]">
                <div className="text-[10px] font-bold text-[#aeaeb2] uppercase tracking-[0.15em] mb-3">しくみ</div>
                <FlowDiagram />
              </div>

              {/* ナビゲーション */}
              <div className="mt-6">
                <div className="text-[10px] font-bold text-[#aeaeb2] uppercase tracking-[0.15em] mb-3">主な機能</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { icon: <IcoCreate />, label: '問題をつくる', href: '/user', color: '#fc3c44' },
                    { icon: <IcoTune />,   label: '品質を高める', href: '/dev', color: '#bf5af2' },
                    { icon: <IcoSearch />, label: '問題を検索',   href: '/search', color: '#ff9f0a' },
                    { icon: <IcoDb />,     label: 'DB編集',      href: '/db-editor', color: '#30d158' },
                  ].map((item) => (
                    <Link key={item.href} href={item.href}
                      className="group flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-white/80 border border-black/[0.04] shadow-sm hover:shadow-md transition-all hover:scale-[1.02] active:scale-[0.98]">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110"
                           style={{ background: `linear-gradient(135deg, ${item.color}12, ${item.color}05)` }}>{item.icon}</div>
                      <span className="text-[11px] font-bold text-[#1d1d1f]">{item.label}</span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* ═══ はじめかた ═══ */}
          <section id="quickstart" className="scroll-mt-24">
            <div className="flex items-center gap-3 mb-4 px-1">
              <div className="w-1.5 h-1.5 rounded-full bg-[#0a84ff]" />
              <h2 className="text-[12px] font-bold text-[#6e6e73] uppercase tracking-[0.2em]">はじめかた</h2>
              <div className="flex-1 h-px bg-gradient-to-r from-black/[0.06] to-transparent" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { n: '1', icon: '📝', title: 'テンプレートを選ぶ', desc: '教科・難易度が設定済みのカードから選択。', color: '#fc3c44' },
                { n: '2', icon: '🚀', title: '生成する', desc: 'AIが過去問を参照しながら自動生成。数秒で完了。', color: '#bf5af2' },
                { n: '3', icon: '📥', title: 'PDFをダウンロード', desc: '完成した試験問題をPDFで取得。そのまま印刷OK。', color: '#30d158' },
              ].map((s) => (
                <div key={s.n} className="relative flex flex-col items-center gap-3 p-5 rounded-2xl bg-white/70 border border-black/[0.04] shadow-sm hover:shadow-md transition-all">
                  <div className="absolute top-0 left-5 right-5 h-[2px] rounded-b-full" style={{ background: `linear-gradient(90deg,${s.color},transparent)`, opacity: 0.3 }} />
                  <div className="flex items-center justify-center w-10 h-10 rounded-2xl text-white text-[14px] font-black shadow-md"
                       style={{ background: `linear-gradient(135deg, ${s.color}, ${s.color}cc)` }}>{s.n}</div>
                  <span className="text-xl">{s.icon}</span>
                  <h4 className="text-[14px] font-bold text-[#1d1d1f] text-center">{s.title}</h4>
                  <p className="text-[11px] text-[#86868b] text-center leading-relaxed">{s.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ═══ 機能ガイド ═══ */}
          <div className="flex items-center gap-3 mb-4 px-1">
            <div className="w-1.5 h-1.5 rounded-full bg-[#fc3c44]" />
            <h2 className="text-[12px] font-bold text-[#6e6e73] uppercase tracking-[0.2em]">機能ガイド</h2>
            <div className="flex-1 h-px bg-gradient-to-r from-black/[0.06] to-transparent" />
          </div>

          <FeatureSection id="create" icon={<IcoCreate />} title="問題をつくる" subtitle="5ステップのウィザードで AI が試験問題を自動生成" color="#fc3c44" href="/user"
            diagram={<DiagramCreateWizard />}
            steps={[
              { title: 'テンプレート → 設定', desc: '教科カードを選択し、問題数や出題形式を設定します。' },
              { title: 'PDF形式を選ぶ', desc: '試験問題・ワークシート等4種のプリセットから選択。' },
              { title: '生成 → ダウンロード', desc: 'AI が自動生成。完成PDFをダウンロードできます。' },
            ]}
            tips={[
              '参考問題を選ぶと、出題スタイルが意図に沿いやすくなります',
              '手動モードでプロンプトをコピーして好きなAIに貼付も可能',
            ]}
          />

          <FeatureSection id="tune" icon={<IcoTune />} title="品質を高める" subtitle="バランス調整とフィードバックで品質を継続改善" color="#bf5af2" href="/dev"
            diagram={<DiagramTunePage />}
            steps={[
              { title: 'テンプレートを選んで条件設定', desc: '科目・難易度を選択し、生成バランスを3軸で調整。' },
              { title: 'プロンプト生成 → AI実行', desc: '調整を反映したプロンプトでAIに問題を生成させます。' },
              { title: '品質を評価して保存', desc: '5段階評価。フィードバックが次回の生成品質に反映されます。' },
            ]}
            tips={[
              'プリセット「バランス」が最初はおすすめ',
              '評価を重ねるほど、好みに合った問題が生まれます',
            ]}
          />

          <FeatureSection id="search" icon={<IcoSearch />} title="問題を検索" subtitle="キーワードとフィルターで過去問をかんたん検索" color="#ff9f0a" href="/search"
            diagram={<DiagramSearchPage />}
            steps={[
              { title: 'キーワード入力', desc: '検索バーにキーワードを入力。科目・分野を横断検索。' },
              { title: 'フィルターで絞込み', desc: '科目・分野・難易度のプルダウンで結果を絞り込み。' },
              { title: '詳細確認 → 類題生成', desc: 'カード展開で詳細表示。ボタン一つでAI類題生成も可能。' },
            ]}
            tips={[
              'キーワードなしでフィルターだけの検索もできます',
              '検索結果から直接 類題を生成できて便利です',
            ]}
          />

          <FeatureSection id="db" icon={<IcoDb />} title="DB編集" subtitle="データの閲覧・編集・かんたん登録" color="#30d158" href="/db-editor"
            diagram={<DiagramDbEditor />}
            steps={[
              { title: 'テーブルを選んで閲覧', desc: 'プルダウンで切替。テーブルビューで一覧表示。' },
              { title: 'インライン編集', desc: 'セルをクリックしてその場で修正。保存で確定。' },
              { title: 'かんたん登録', desc: '「➕ かんたん登録」タブから、フォーム入力で問題を追加。' },
            ]}
            tips={[
              '難易度は入力内容から自動推定されます',
              '表示カラムはグループ切替でスッキリ表示できます',
            ]}
          />

          {/* ═══ FAQ ═══ */}
          <section id="faq" className="scroll-mt-24">
            <div className="flex items-center gap-3 mb-4 px-1">
              <div className="w-1.5 h-1.5 rounded-full bg-[#ff9f0a]" />
              <h2 className="text-[12px] font-bold text-[#6e6e73] uppercase tracking-[0.2em]">よくある質問</h2>
              <div className="flex-1 h-px bg-gradient-to-r from-black/[0.06] to-transparent" />
            </div>
            <div className="space-y-3">
              {FAQ_DATA.map((cat) => (
                <FaqCategory key={cat.category} {...cat} />
              ))}
            </div>

            {/* 用語集インライン */}
            <div className="mt-8 relative overflow-hidden rounded-[24px] bg-white/65 backdrop-blur-xl border border-black/[0.04] shadow-sm p-5 sm:p-6">
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#5856d6] via-[#0a84ff] to-[#5856d6] opacity-40" />
              <div className="flex items-center gap-2 mb-4">
                <span className="text-[16px]">📘</span>
                <h4 className="text-[15px] font-bold text-[#1d1d1f] tracking-tight">用語集</h4>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {GLOSSARY.map((g) => (
                  <div key={g.term} className="flex items-center gap-3 p-3 rounded-xl bg-white/60 border border-black/[0.04]">
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg text-white text-[11px] font-bold flex-shrink-0"
                         style={{ background: `linear-gradient(135deg, ${g.color}, ${g.color}bb)` }}>{g.term.charAt(0)}</div>
                    <div className="flex-1 min-w-0">
                      <span className="text-[12px] font-bold text-[#1d1d1f]">
                        {g.term}
                        {g.ruby && <span className="text-[9px] font-normal text-[#aeaeb2] ml-1">({g.ruby})</span>}
                      </span>
                      <span className="text-[11px] text-[#86868b] ml-1.5">{g.def}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ═══ フッター ═══ */}
          <div className="text-center pt-6 pb-4">
            <Link href="/" className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-[#fc3c44] to-[#e0323a] text-white text-[14px] font-bold shadow-lg shadow-[#fc3c44]/20 hover:shadow-xl hover:shadow-[#fc3c44]/30 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              ホームに戻って始める
            </Link>
            <p className="text-[11px] text-[#c7c7cc] mt-4">REM — Rapid Exam Maker</p>
          </div>

        </div>
      </div>
    </div>
  );
}
