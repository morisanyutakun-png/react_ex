'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

/* ═══════════════════════════════════════════════════════
   § 0  インラインアイコンSVG
   ═══════════════════════════════════════════════════════ */

/* 問題をつくる (赤) */
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
      <circle cx="32" cy="28" r="6" fill="#bf5af2" opacity=".1"/>
      <path d="M29 31 L31 27 L33 29 L35 25" stroke="#bf5af2" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" opacity=".6"/>
      <defs>
        <linearGradient id="hD1" x1="6" y1="3" x2="28" y2="33"><stop stopColor="#fc3c44"/><stop offset="1" stopColor="#bf5af2"/></linearGradient>
        <linearGradient id="hP1" x1="23" y1="1" x2="37" y2="15"><stop stopColor="#fc3c44"/><stop offset="1" stopColor="#ff375f"/></linearGradient>
      </defs>
    </svg>
  );
}
/* 品質を高める (紫) */
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
      <path d="M34 24 L34.8 26.5 L37 27 L34.8 27.5 L34 30 L33.2 27.5 L31 27 L33.2 26.5Z" fill="#bf5af2" opacity=".6"/>
      <path d="M18 10 A10 10 0 0 1 28 20" stroke="url(#hAr1)" strokeWidth="2" strokeLinecap="round" fill="none"/>
      <defs>
        <linearGradient id="hDi1" x1="15" y1="17" x2="21" y2="23"><stop stopColor="#bf5af2"/><stop offset="1" stopColor="#5e5ce6"/></linearGradient>
        <linearGradient id="hSp1" x1="27" y1="8" x2="37" y2="16"><stop stopColor="#ff9f0a"/><stop offset="1" stopColor="#ff375f"/></linearGradient>
        <linearGradient id="hAr1" x1="18" y1="10" x2="28" y2="20"><stop stopColor="#fc3c44"/><stop offset="1" stopColor="#bf5af2"/></linearGradient>
      </defs>
    </svg>
  );
}
/* 検索 (橙) */
function IcoSearch() {
  return (
    <svg className="w-10 h-10" viewBox="0 0 36 36" fill="none">
      <rect x="4" y="6" width="16" height="20" rx="2.5" fill="white" stroke="#ff9f0a" strokeWidth="1.3" opacity=".5"/>
      <rect x="6" y="4" width="16" height="20" rx="2.5" fill="white" stroke="#ff9f0a" strokeWidth="1.5"/>
      <line x1="10" y1="10" x2="18" y2="10" stroke="#ff9f0a" strokeWidth="1" opacity=".4" strokeLinecap="round"/>
      <line x1="10" y1="13" x2="16" y2="13" stroke="#ff9f0a" strokeWidth="1" opacity=".3" strokeLinecap="round"/>
      <line x1="10" y1="16" x2="17" y2="16" stroke="#ff9f0a" strokeWidth="1" opacity=".25" strokeLinecap="round"/>
      <circle cx="25" cy="22" r="7" stroke="url(#hSe1)" strokeWidth="2" fill="white" fillOpacity=".8"/>
      <line x1="30" y1="27" x2="34" y2="31" stroke="url(#hSe1)" strokeWidth="2.5" strokeLinecap="round"/>
      <circle cx="23" cy="20" r="1" fill="#ff9f0a" opacity=".4"/>
      <defs><linearGradient id="hSe1" x1="18" y1="15" x2="34" y2="31"><stop stopColor="#ff9f0a"/><stop offset="1" stopColor="#ff375f"/></linearGradient></defs>
    </svg>
  );
}
/* DB (緑) */
function IcoDb() {
  return (
    <svg className="w-10 h-10" viewBox="0 0 36 36" fill="none">
      <ellipse cx="16" cy="9" rx="10" ry="4" fill="white" stroke="#30d158" strokeWidth="1.5"/>
      <path d="M6 9v16c0 2.2 4.5 4 10 4s10-1.8 10-4V9" stroke="#30d158" strokeWidth="1.5" fill="white"/>
      <ellipse cx="16" cy="9" rx="10" ry="4" fill="url(#hDb1)" opacity=".12"/>
      <path d="M6 17c0 2.2 4.5 4 10 4s10-1.8 10-4" stroke="#30d158" strokeWidth="1" opacity=".3"/>
      <path d="M6 22c0 2.2 4.5 4 10 4s10-1.8 10-4" stroke="#30d158" strokeWidth="1" opacity=".2"/>
      <circle cx="12" cy="14" r="1" fill="#30d158" opacity=".4"/>
      <line x1="15" y1="14" x2="22" y2="14" stroke="#30d158" strokeWidth=".8" opacity=".3" strokeLinecap="round"/>
      <circle cx="29" cy="27" r="5" fill="white" stroke="#30d158" strokeWidth="1.3"/>
      <circle cx="29" cy="27" r="2" fill="#30d158" opacity=".3"/>
      <defs><linearGradient id="hDb1" x1="6" y1="5" x2="26" y2="13"><stop stopColor="#30d158"/><stop offset="1" stopColor="#0a84ff"/></linearGradient></defs>
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════
   § 1  目次 (Table of Contents) — sticky sidebar
   ═══════════════════════════════════════════════════════ */

const TOC = [
  { id: 'overview',   label: '概要',       emoji: '📖' },
  { id: 'quickstart', label: 'クイックスタート', emoji: '🚀' },
  { id: 'workflow',   label: 'ワークフロー',  emoji: '🔄' },
  { id: 'create',     label: '問題をつくる',  emoji: '📝' },
  { id: 'tune',       label: '品質を高める',  emoji: '⚙️' },
  { id: 'search',     label: '問題を検索',   emoji: '🔍' },
  { id: 'db',         label: 'DB編集',      emoji: '🗄️' },
  { id: 'glossary',   label: '用語集',      emoji: '📘' },
  { id: 'faq',        label: 'FAQ',         emoji: '❓' },
];

function TableOfContents({ activeId }) {
  return (
    <nav className="space-y-0.5">
      {TOC.map(({ id, label, emoji }) => {
        const active = activeId === id;
        return (
          <a key={id} href={`#${id}`}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-semibold transition-all duration-300
              ${active ? 'bg-[#0a84ff]/[0.08] text-[#0a84ff]' : 'text-[#86868b] hover:bg-black/[0.03] hover:text-[#1d1d1f]'}`}>
            <span className="text-[14px]">{emoji}</span>{label}
          </a>
        );
      })}
    </nav>
  );
}

/* ═══════════════════════════════════════════════════════
   § 2  画面モック — 各ページのミニチュア再現
   ═══════════════════════════════════════════════════════ */

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

/* 5ステップウィザード画面 */
function DiagramCreateWizard() {
  const steps = [
    { n: 1, label: 'テンプレート', active: true },
    { n: 2, label: '生成設定' },
    { n: 3, label: 'PDF形式' },
    { n: 4, label: 'AI生成' },
    { n: 5, label: '完成!' },
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
      <div className="flex justify-end mt-3">
        <div className="px-3 py-1.5 rounded-lg bg-[#fc3c44] text-white text-[9px] font-bold">次へ →</div>
      </div>
    </ScreenFrame>
  );
}

/* チューニング画面 */
function DiagramTunePage() {
  return (
    <ScreenFrame title="品質を高める" color="#bf5af2">
      <div className="flex gap-1 mb-3">
        {['⚙️ 設定', '▶️ 実行', '✅ 評価'].map((t, i) => (
          <div key={i} className={`flex-1 text-center py-1.5 rounded-lg text-[9px] font-bold ${i === 0 ? 'bg-[#bf5af2] text-white' : 'bg-[#f5f5f7] text-[#86868b]'}`}>{t}</div>
        ))}
      </div>
      <div className="space-y-2 p-2.5 rounded-xl bg-[#f5f5f7] border border-black/[0.04]">
        <div className="text-[9px] font-bold text-[#86868b] mb-1">RAG ミキサー</div>
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
      <div className="flex justify-center mt-2.5">
        <div className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#bf5af2] to-[#5e5ce6] text-white text-[9px] font-bold shadow-sm">プロンプト生成</div>
      </div>
    </ScreenFrame>
  );
}

/* 検索画面 */
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
          <div className="flex-1">
            <div className="h-1.5 w-3/4 bg-[#e5e5ea] rounded-full mb-1" /><div className="h-1.5 w-1/2 bg-[#e5e5ea] rounded-full" />
          </div>
        </div>
      ))}
    </ScreenFrame>
  );
}

/* DB編集画面 */
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
        {[{ id: 1, s: '数学', d: '★3' }, { id: 2, s: '物理', d: '★4' }, { id: 3, s: '化学', d: '★2' }].map((r) => (
          <div key={r.id} className="grid grid-cols-4 text-[8px] text-[#6e6e73] px-2 py-1.5 border-t border-black/[0.03]">
            <span className="font-bold text-[#30d158]">{r.id}</span><span>{r.s}</span><span>{r.d}</span><span className="text-[#0a84ff]">✏️</span>
          </div>
        ))}
      </div>
    </ScreenFrame>
  );
}

/* ═══════════════════════════════════════════════════════
   § 3  アーキテクチャ図 SVG
   ═══════════════════════════════════════════════════════ */

function ArchitectureDiagram() {
  return (
    <svg viewBox="0 0 560 200" fill="none" className="w-full h-auto">
      <rect x="10" y="10" width="160" height="180" rx="16" fill="white" stroke="#0a84ff" strokeWidth="1.5" opacity=".8"/>
      <rect x="10" y="10" width="160" height="36" rx="16" fill="url(#agFe)" opacity=".12"/>
      <text x="90" y="34" textAnchor="middle" fontSize="11" fontWeight="800" fill="#0a84ff">フロントエンド</text>
      <text x="90" y="48" textAnchor="middle" fontSize="8" fill="#86868b">Next.js + Tailwind</text>
      {[
        { y: 62, label: '/user  — 問題をつくる', color: '#fc3c44' },
        { y: 82, label: '/dev   — 品質を高める', color: '#bf5af2' },
        { y: 102, label: '/search — 問題を検索', color: '#ff9f0a' },
        { y: 122, label: '/db-editor — DB編集', color: '#30d158' },
        { y: 142, label: '/help  — ヘルプ', color: '#5856d6' },
      ].map((r) => (
        <g key={r.y}>
          <rect x="22" y={r.y} width="136" height="16" rx="5" fill={r.color} opacity=".06"/>
          <circle cx="31" cy={r.y + 8} r="3" fill={r.color} opacity=".5"/>
          <text x="39" y={r.y + 11.5} fontSize="7.5" fontWeight="600" fill="#6e6e73">{r.label}</text>
        </g>
      ))}
      <text x="90" y="175" textAnchor="middle" fontSize="7" fill="#aeaeb2">Vercel でホスト</text>

      <line x1="175" y1="100" x2="215" y2="100" stroke="#c7c7cc" strokeWidth="2" strokeDasharray="4 3" markerEnd="url(#arrowG)"/>
      <text x="195" y="92" textAnchor="middle" fontSize="7" fill="#aeaeb2">API</text>

      <rect x="220" y="10" width="160" height="180" rx="16" fill="white" stroke="#bf5af2" strokeWidth="1.5" opacity=".8"/>
      <rect x="220" y="10" width="160" height="36" rx="16" fill="url(#agBe)" opacity=".12"/>
      <text x="300" y="34" textAnchor="middle" fontSize="11" fontWeight="800" fill="#bf5af2">バックエンド</text>
      <text x="300" y="48" textAnchor="middle" fontSize="8" fill="#86868b">FastAPI + Python</text>
      {[
        { y: 62, label: 'RAG — 類似問題検索', color: '#bf5af2' },
        { y: 82, label: 'Generator — AI問題生成', color: '#fc3c44' },
        { y: 102, label: 'LaTeX → PDF 変換', color: '#ff9f0a' },
        { y: 122, label: 'DB CRUD — 永続保存', color: '#30d158' },
        { y: 142, label: 'Embeddings — ベクトル化', color: '#0a84ff' },
      ].map((r) => (
        <g key={r.y}>
          <rect x="232" y={r.y} width="136" height="16" rx="5" fill={r.color} opacity=".06"/>
          <circle cx="241" cy={r.y + 8} r="3" fill={r.color} opacity=".5"/>
          <text x="249" y={r.y + 11.5} fontSize="7.5" fontWeight="600" fill="#6e6e73">{r.label}</text>
        </g>
      ))}
      <text x="300" y="175" textAnchor="middle" fontSize="7" fill="#aeaeb2">Render / Koyeb</text>

      <line x1="385" y1="100" x2="425" y2="100" stroke="#c7c7cc" strokeWidth="2" strokeDasharray="4 3" markerEnd="url(#arrowG)"/>
      <text x="405" y="92" textAnchor="middle" fontSize="7" fill="#aeaeb2">SQL</text>

      <rect x="430" y="25" width="120" height="150" rx="16" fill="white" stroke="#30d158" strokeWidth="1.5" opacity=".8"/>
      <ellipse cx="490" cy="55" rx="45" ry="14" fill="url(#agDb)" opacity=".12" stroke="#30d158" strokeWidth="1"/>
      <text x="490" y="59" textAnchor="middle" fontSize="10" fontWeight="800" fill="#30d158">Database</text>
      <text x="490" y="72" textAnchor="middle" fontSize="8" fill="#86868b">PostgreSQL / SQLite</text>
      {[
        { y: 85, label: 'problems テーブル' },
        { y: 102, label: 'tuning_logs テーブル' },
        { y: 119, label: 'templates テーブル' },
        { y: 136, label: 'embeddings データ' },
      ].map((r) => (
        <g key={r.y}>
          <rect x="444" y={r.y} width="92" height="14" rx="4" fill="#30d158" opacity=".06"/>
          <text x="490" y={r.y + 10} textAnchor="middle" fontSize="7" fontWeight="600" fill="#6e6e73">{r.label}</text>
        </g>
      ))}
      <text x="490" y="165" textAnchor="middle" fontSize="7" fill="#aeaeb2">永続保存</text>

      <defs>
        <linearGradient id="agFe" x1="10" y1="10" x2="170" y2="46"><stop stopColor="#0a84ff"/><stop offset="1" stopColor="#64d2ff"/></linearGradient>
        <linearGradient id="agBe" x1="220" y1="10" x2="380" y2="46"><stop stopColor="#bf5af2"/><stop offset="1" stopColor="#5e5ce6"/></linearGradient>
        <linearGradient id="agDb" x1="445" y1="41" x2="535" y2="69"><stop stopColor="#30d158"/><stop offset="1" stopColor="#0a84ff"/></linearGradient>
        <marker id="arrowG" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto" markerUnits="strokeWidth">
          <path d="M0 0 L8 4 L0 8 Z" fill="#c7c7cc"/>
        </marker>
      </defs>
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════
   § 4  ワークフロー ステップ グリッド
   ═══════════════════════════════════════════════════════ */

function WorkflowSvg() {
  const steps = [
    { icon: '📝', label: 'テンプレート選択', sub: '教科/分野/難易度', color: '#fc3c44' },
    { icon: '🎯', label: '参考問題選択', sub: 'DB自動マッチ', color: '#ff375f' },
    { icon: '🤖', label: 'RAG + AI生成', sub: '過去問参照', color: '#bf5af2' },
    { icon: '📄', label: 'LaTeX → PDF', sub: '試験用紙出力', color: '#ff9f0a' },
    { icon: '⭐', label: '品質評価', sub: '5段階レート', color: '#30d158' },
    { icon: '💾', label: 'DB永続保存', sub: 'フィードバック記録', color: '#0a84ff' },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {steps.map((s, i) => (
        <div key={i} className="relative">
          <div className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-white/80 border border-black/[0.04] shadow-sm hover:shadow-md transition-all">
            <div className="text-2xl">{s.icon}</div>
            <div className="text-center">
              <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: s.color }}>Step {i + 1}</div>
              <div className="text-[12px] font-bold text-[#1d1d1f] mt-0.5">{s.label}</div>
              <div className="text-[10px] text-[#aeaeb2] mt-0.5">{s.sub}</div>
            </div>
          </div>
          {i < steps.length - 1 && i !== 2 && (
            <div className="absolute -right-2.5 top-1/2 -translate-y-1/2 text-[#d1d1d6] z-10 hidden sm:block">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   § 5  機能セクション (ダイアグラム + ステップ + ヒント)
   ═══════════════════════════════════════════════════════ */

function FeatureSection({ id, icon, title, subtitle, color, href, diagram, steps, tips, shortcuts }) {
  return (
    <section id={id} className="scroll-mt-24">
      <div className="relative overflow-hidden rounded-[28px] bg-white/70 backdrop-blur-xl border border-black/[0.04] shadow-lg shadow-black/[0.03] transition-all duration-300 hover:shadow-xl">
        <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: `linear-gradient(90deg, ${color}, ${color}66)` }} />

        <div className="p-6 sm:p-8">
          {/* Header */}
          <div className="flex items-center gap-3.5 mb-2">
            <div className="flex items-center justify-center w-14 h-14 rounded-2xl shadow-lg flex-shrink-0"
                 style={{ background: `linear-gradient(135deg, ${color}18, ${color}06)`, boxShadow: `0 4px 20px ${color}18` }}>
              {icon}
            </div>
            <div className="flex-1">
              <h3 className="text-[20px] font-black text-[#1d1d1f] tracking-tight">{title}</h3>
              <p className="text-[12px] text-[#86868b] mt-0.5">{subtitle}</p>
            </div>
            <Link href={href} className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-bold text-white shadow-md hover:shadow-lg transition-all duration-300 hover:scale-[1.03] active:scale-[0.97]"
                  style={{ background: `linear-gradient(135deg, ${color}, ${color}cc)`, boxShadow: `0 4px 12px ${color}30` }}>
              ページを開く
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
            </Link>
          </div>

          {/* Diagram + Steps 2col */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mt-6">
            <div className="order-2 sm:order-1">{diagram}</div>
            <div className="order-1 sm:order-2 space-y-2.5">
              <div className="text-[10px] font-bold text-[#aeaeb2] uppercase tracking-[0.15em] mb-1">操作ステップ</div>
              {steps.map((step, i) => (
                <div key={i} className="flex items-start gap-2.5 group">
                  <div className="flex items-center justify-center w-6 h-6 rounded-lg text-white text-[10px] font-bold flex-shrink-0 mt-0.5 transition-transform duration-300 group-hover:scale-110"
                       style={{ background: `linear-gradient(135deg, ${color}, ${color}bb)` }}>{i + 1}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-bold text-[#1d1d1f] leading-snug">{step.title}</div>
                    <div className="text-[11px] text-[#86868b] mt-0.5 leading-relaxed">{step.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tips + Shortcuts */}
          <div className={`grid grid-cols-1 ${shortcuts ? 'sm:grid-cols-2' : ''} gap-3 mt-5`}>
            {tips && tips.length > 0 && (
              <div className="p-4 rounded-2xl border border-black/[0.04]" style={{ background: `${color}04` }}>
                <div className="flex items-center gap-1.5 mb-2.5">
                  <svg className="w-4 h-4" style={{ color }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
                  </svg>
                  <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color }}>ヒント</span>
                </div>
                <ul className="space-y-1.5">
                  {tips.map((tip, i) => (
                    <li key={i} className="text-[11px] text-[#6e6e73] flex items-start gap-2 leading-relaxed">
                      <span className="mt-[5px] flex-shrink-0 w-1.5 h-1.5 rounded-full" style={{ background: color }} />{tip}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {shortcuts && shortcuts.length > 0 && (
              <div className="p-4 rounded-2xl border border-black/[0.04] bg-[#f5f5f7]/60">
                <div className="flex items-center gap-1.5 mb-2.5">
                  <svg className="w-4 h-4 text-[#6e6e73]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                  </svg>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#6e6e73]">ショートカット</span>
                </div>
                <ul className="space-y-1.5">
                  {shortcuts.map((sc, i) => (
                    <li key={i} className="text-[11px] text-[#6e6e73] flex items-start gap-2 leading-relaxed">
                      <span className="mt-[5px] flex-shrink-0 w-1.5 h-1.5 rounded-full bg-[#6e6e73]" />{sc}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Mobile CTA */}
          <Link href={href} className="sm:hidden flex items-center justify-center gap-2 mt-5 px-4 py-3 rounded-2xl text-[14px] font-bold text-white shadow-lg active:scale-[0.97] transition-all"
                style={{ background: `linear-gradient(135deg, ${color}, ${color}cc)` }}>
            ページを開く
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
          </Link>
        </div>
      </div>
    </section>
  );
}


/* ═══════════════════════════════════════════════════════
   § 6  FAQ データ (6カテゴリ, 27+件)
   ═══════════════════════════════════════════════════════ */

const FAQ_DATA = [
  {
    category: '基本操作', color: '#fc3c44', icon: '🎯',
    items: [
      { q: 'テンプレートがない場合はどうする？', a: '「問題をつくる」ページ下部の「+ 新規テンプレート追加」ボタンから作成できます。科目・分野・難易度を設定してください。' },
      { q: '出題形式はどんな種類がある？', a: '標準（記述式）・穴埋め・選択肢（4択）・○×の4種類です。テンプレートごとに最適な形式を設定可能。' },
      { q: '問題を何度でも再生成できる？', a: 'はい。テンプレートと設定を変えずに「生成する」を押すと、毎回異なるバリエーションの問題が生成されます。' },
      { q: 'どの教科に対応している？', a: '数学・物理・化学・英語・生物・情報の6教科に対応。テンプレートのカスタマイズで他の科目も設定可能です。' },
      { q: '5ステップウィザードの途中でやり直せる？', a: '「← 戻る」ボタンで前のステップへ自由に戻れます。「最初からやり直す」で完全リセットも可能。' },
    ],
  },
  {
    category: 'PDF・出力', color: '#ff9f0a', icon: '📄',
    items: [
      { q: 'PDFプリセットの違いは？', a: '4種類: 試験問題 (exam)=正式な試験形式、ワークシート (worksheet)=授業用プリント、フラッシュカード (flashcard)=暗記カード、模擬試験 (mock_exam)=本番形式。すべてA4出力。' },
      { q: 'PDF生成でエラーが出る場合は？', a: 'LaTeXエンジン(texlive)がバックエンドにない可能性。管理者に依頼するか、手動モードでLaTeXソースをOverleaf等に貼って変換してください。' },
      { q: '図表(TikZ)を含められる？', a: 'はい。生成設定 Step 2 で「tikz」を選択。回路図は「circuitikz」、グラフは「pgfplots」も選択可能。' },
      { q: '手動モードとは？', a: '生成設定で「手動モード」を選ぶと、プロンプトがクリップボードにコピー可能。ChatGPT/Claude/Gemini等の好きなAIに貼り付けて使うフローです。' },
    ],
  },
  {
    category: 'RAG・AI生成', color: '#bf5af2', icon: '🤖',
    items: [
      { q: 'RAGとは何ですか？', a: 'Retrieval-Augmented Generation の略。過去問DBから類似問題を検索し、AIの生成プロンプトに注入して品質を上げる技術です。' },
      { q: 'RAGがエラーになる場合は？', a: '① 数秒待って再試行、② 「RAGをスキップ」で過去問参照なしで続行、③ backendのembeddings状態をログで確認。' },
      { q: 'RAG ミキサーの3軸とは？', a: '類似度(テキスト的類似性)、難易度(問題の難しさ)、ひっかけ度(引っかけ要素)の3軸。プリセット(バランス/類似重視/難易度重視/ひっかけ強化)もワンタップで設定可能。' },
      { q: 'Top-Kの数値はいくつが最適？', a: '3〜5が推奨。大きいほど参照する過去問が増え精度向上する一方、プロンプトが長くなりLLMコストも増加します。' },
      { q: '参考問題は必ず選ぶ必要がある？', a: 'いいえ、任意です。選択すればスタイルを踏襲した類似問題が生まれますが、選ばなくてもテンプレート設定ベースで生成されます。' },
    ],
  },
  {
    category: '品質評価・チューニング', color: '#30d158', icon: '⭐',
    items: [
      { q: '品質評価はどこに保存される？', a: 'tuning_logsテーブルにDB永続保存。ブラウザを閉じても消えず、次回の生成プロンプトに自動反映されるフィードバックループです。' },
      { q: '5段階評価の目安は？', a: '1=使えない、2=大幅修正必要、3=普通(部分修正要)、4=良い(軽微な修正)、5=完璧(そのまま使える)。' },
      { q: '評価を繰り返すと品質は向上する？', a: 'はい。フィードバックデータ蓄積でプロンプトが自動調整されます。評価履歴パネルでスコア推移をスパークラインで確認可能。' },
      { q: '評価履歴ダッシュボードの見方は？', a: 'スコア分布(ヒストグラム)、科目別平均スコア、時系列トレンド(スパークライン)を表示。低スコア科目はRAGミキサーの調整推奨。' },
    ],
  },
  {
    category: '検索・DB管理', color: '#0a84ff', icon: '🔍',
    items: [
      { q: '検索の絞り込み条件は？', a: 'キーワード(テキスト検索)、科目(プルダウン)、分野(科目連動)、難易度の4条件。フィルターはバッジ表示で個別解除可能。' },
      { q: '検索結果から類題生成できる？', a: 'はい。結果カード展開→「この問題の類題を生成」ボタン→その場でAI類題生成・表示されます。' },
      { q: 'DB編集でデータを誤削除した場合は？', a: '削除前に確認ダイアログが表示されます。万一はDBバックアップからリストア可能。定期バックアップを推奨。' },
      { q: 'かんたん登録とは？', a: 'DB編集「➕ かんたん登録」タブで、必須/推奨/任意フィールドに分かれたスマートフォームで問題追加。教科連動の分野候補+難易度自動推定あり。' },
      { q: 'LaTeX数式はDB内でも見られる？', a: 'はい。検索結果やDB編集画面でLaTeX数式がレンダリング表示されます。生記法と整形表示の両方確認可能。' },
    ],
  },
  {
    category: 'トラブルシューティング', color: '#ff453a', icon: '🛠️',
    items: [
      { q: 'バックエンドが起動しない', a: 'requirements.txtの依存パッケージ確認。`pip install -r requirements.txt`で再インストール。Python 3.9以上必要。' },
      { q: 'フロントエンドのビルドエラー', a: '`cd apps/web && npm install`で依存関係再インストール。Node.js 18以上推奨。' },
      { q: '生成結果が期待と大きく異なる', a: '① テンプレートの科目/分野/難易度を確認、② RAGミキサーの「類似度」を高めに、③ 参考問題を選択してスタイル指定、④ 数回再生成して最良を選択。' },
      { q: 'APIレスポンスが遅い', a: '初回起動時はembeddings読み込みに時間がかかります。2回目以降はキャッシュで高速化。Render無料プランは15分非アクティブ後にスリープ。' },
      { q: 'Embeddings関連のエラーが出る', a: 'embed用モデルファイルのダウンロードが必要な場合があります。`python check_attribute_embeddings.py`で状態を確認してください。' },
      { q: 'DBの接続がタイムアウトする', a: 'PostgreSQLの場合はDATABASE_URL環境変数を確認。SQLiteの場合はdb/ディレクトリの書き込み権限を確認してください。' },
    ],
  },
];

function FaqCategory({ category, color, icon, items }) {
  return (
    <div className="relative overflow-hidden rounded-[24px] bg-white/65 backdrop-blur-xl border border-black/[0.04] shadow-sm">
      <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(90deg, ${color}, ${color}66)` }} />
      <div className="px-5 pt-5 pb-2">
        <div className="flex items-center gap-2.5 mb-3">
          <span className="text-[16px]">{icon}</span>
          <h4 className="text-[15px] font-bold text-[#1d1d1f] tracking-tight">{category}</h4>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-black/[0.06] text-[#aeaeb2]">{items.length}件</span>
        </div>
      </div>
      <div className="px-3 pb-3 space-y-1">
        {items.map((faq, i) => (
          <details key={i} className="group">
            <summary className="cursor-pointer px-3 py-3 rounded-xl text-[13px] font-semibold text-[#1d1d1f] select-none flex items-center gap-2.5 transition-all hover:bg-black/[0.02] active:bg-black/[0.04]">
              <div className="w-5 h-5 rounded-md flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0"
                   style={{ background: `linear-gradient(135deg, ${color}, ${color}bb)` }}>?</div>
              <span className="flex-1">{faq.q}</span>
              <svg className="w-4 h-4 text-[#c7c7cc] transition-transform duration-200 group-open:rotate-180 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </summary>
            <div className="px-3 pb-3 pl-[2.5rem]">
              <p className="text-[12px] text-[#6e6e73] leading-relaxed">{faq.a}</p>
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   § 7  用語集データ
   ═══════════════════════════════════════════════════════ */

const GLOSSARY = [
  { term: 'RAG', ruby: 'ラグ', def: 'Retrieval-Augmented Generation — 過去問DBを検索して、AIの生成プロンプトに参考情報を注入する技術。品質向上の核心。', color: '#bf5af2' },
  { term: 'テンプレート', ruby: null, def: '科目・分野・難易度・出題パターンが定義された問題生成の設計図。使い回し可能。', color: '#fc3c44' },
  { term: 'Top-K', ruby: 'トップケー', def: 'RAG検索で参照する過去問の件数。K=5なら類似度上位5件を抽出。', color: '#0a84ff' },
  { term: 'LaTeX', ruby: 'ラテフ', def: '数式や文書を美しく組版する言語。REMでは生成問題をLaTeX化してPDF出力。', color: '#ff9f0a' },
  { term: 'Embedding', ruby: 'エンベディング', def: 'テキストを数値ベクトルに変換すること。意味的に近い文章は近いベクトルに。RAGの基盤技術。', color: '#5856d6' },
  { term: 'チューニング', ruby: null, def: 'RAGバランスやプロンプトを調整してAI出力品質を改善するプロセス。', color: '#30d158' },
  { term: 'フィードバック', ruby: null, def: '生成問題の品質評価。DBに保存され、次回プロンプトに自動反映。継続的改善の鍵。', color: '#5856d6' },
  { term: 'プリセット', ruby: null, def: 'RAGミキサーやPDF出力の事前設定パターン。ワンタップで最適設定に切替。', color: '#ff375f' },
  { term: 'TikZ', ruby: 'ティクズ', def: 'LaTeX上で図・グラフ・回路図を描画するパッケージ。物理・数学の問題で使用。', color: '#0a84ff' },
  { term: 'スパークライン', ruby: null, def: '評価履歴推移を表す小さな折れ線グラフ。ダッシュボードでトレンドを一目で確認。', color: '#30d158' },
];

/* ═══════════════════════════════════════════════════════
   § 8  クイックスタートカード
   ═══════════════════════════════════════════════════════ */

function QuickStartCard({ number, title, description, color, icon }) {
  return (
    <div className="relative flex items-start gap-4 p-5 rounded-2xl bg-white/70 border border-black/[0.04] shadow-sm hover:shadow-md transition-all duration-300">
      <div className="absolute top-0 left-5 right-5 h-[2px] rounded-b-full" style={{ background: `linear-gradient(90deg,${color},transparent)`, opacity: 0.4 }} />
      <div className="flex items-center justify-center w-11 h-11 rounded-2xl text-white text-[16px] font-black flex-shrink-0 shadow-md"
           style={{ background: `linear-gradient(135deg, ${color}, ${color}cc)`, boxShadow: `0 4px 16px ${color}25` }}>
        {number}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[15px]">{icon}</span>
          <h4 className="text-[15px] font-bold text-[#1d1d1f] tracking-tight">{title}</h4>
        </div>
        <p className="text-[12px] text-[#86868b] mt-1 leading-relaxed">{description}</p>
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════
   ◆ メインページ
   ═══════════════════════════════════════════════════════ */

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
        <div className="inline-flex items-center justify-center w-[80px] h-[80px] rounded-[24px] bg-gradient-to-br from-[#0a84ff] via-[#5856d6] to-[#bf5af2] text-white mb-6 shadow-xl shadow-[#5856d6]/25 animate-glow-pulse">
          <svg className="w-10 h-10" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
          </svg>
        </div>
        <h1 className="text-[40px] sm:text-[52px] font-black tracking-tight text-[#1d1d1f] mb-3 leading-none">
          はじめてガイド
        </h1>
        <p className="text-[16px] sm:text-[18px] text-[#86868b] max-w-lg mx-auto leading-relaxed">
          REM の使い方を、画面ダイアグラムと<br className="sm:hidden" />ステップ解説でご案内します。
        </p>
        <Link href="/" className="inline-flex items-center gap-2 mt-6 px-5 py-2.5 rounded-full bg-white/60 backdrop-blur-lg border border-black/[0.04] shadow-sm text-[13px] font-bold text-[#86868b] hover:text-[#fc3c44] hover:border-[#fc3c44]/20 transition-all">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
          ホームに戻る
        </Link>
      </div>

      {/* ── 2カラム: サイドTOC + メイン ── */}
      <div className="flex gap-8">
        {/* Sticky TOC — デスクトップのみ */}
        <aside className="hidden lg:block w-[180px] flex-shrink-0">
          <div className="sticky top-20">
            <div className="text-[10px] font-bold text-[#aeaeb2] uppercase tracking-[0.2em] mb-3 px-3">目次</div>
            <TableOfContents activeId={activeSection} />
          </div>
        </aside>

        {/* メインコンテンツ */}
        <div className="flex-1 min-w-0 space-y-10">

          {/* ═══ 概要 ═══ */}
          <section id="overview" className="scroll-mt-24">
            <div className="relative overflow-hidden rounded-[28px] bg-white/70 backdrop-blur-xl border border-black/[0.04] shadow-lg p-6 sm:p-8">
              <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#fc3c44] via-[#bf5af2] to-[#0a84ff] opacity-70" />

              <div className="flex flex-col sm:flex-row items-start gap-5">
                <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-[#fc3c44] to-[#e0323a] text-white shadow-lg shadow-[#fc3c44]/20 flex-shrink-0">
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h2 className="text-[22px] font-black text-[#1d1d1f] tracking-tight mb-2">REM とは？</h2>
                  <p className="text-[14px] text-[#6e6e73] leading-relaxed mb-4">
                    <strong className="text-[#1d1d1f]">Rapid Exam Maker</strong> は、過去問データベースと AI を組み合わせて
                    高品質な試験問題を効率的に生成するプラットフォームです。
                    テンプレートを選んでワンクリックで問題を生成し、PDF で出力できます。
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { tag: 'AI 問題生成', color: '#fc3c44' },
                      { tag: 'RAG 検索', color: '#bf5af2' },
                      { tag: 'LaTeX / PDF', color: '#ff9f0a' },
                      { tag: '品質フィードバック', color: '#30d158' },
                      { tag: 'DB 永続保存', color: '#0a84ff' },
                      { tag: '6教科対応', color: '#5856d6' },
                    ].map(({ tag, color }) => (
                      <span key={tag} className="px-3 py-1 rounded-full text-[11px] font-bold border"
                            style={{ color, borderColor: `${color}20`, background: `${color}08` }}>{tag}</span>
                    ))}
                  </div>
                </div>
              </div>

              {/* アーキテクチャ図 */}
              <div className="mt-8 p-4 sm:p-6 rounded-2xl bg-[#fafafa] border border-black/[0.04]">
                <div className="text-[10px] font-bold text-[#aeaeb2] uppercase tracking-[0.15em] mb-4">システムアーキテクチャ</div>
                <ArchitectureDiagram />
              </div>

              {/* ホーム画面アイコン */}
              <div className="mt-6">
                <div className="text-[10px] font-bold text-[#aeaeb2] uppercase tracking-[0.15em] mb-3">ホーム画面のアイコン</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {[
                    { icon: <IcoCreate />, label: '問題をつくる', href: '/user', color: '#fc3c44' },
                    { icon: <IcoTune />,   label: '品質を高める', href: '/dev', color: '#bf5af2' },
                    { icon: <IcoSearch />, label: '問題を検索',   href: '/search', color: '#ff9f0a' },
                    { icon: <IcoDb />,     label: 'DB編集',      href: '/db-editor', color: '#30d158' },
                  ].map((item) => (
                    <Link key={item.href} href={item.href}
                      className="group flex flex-col items-center gap-2 p-4 rounded-2xl bg-white/80 border border-black/[0.04] shadow-sm hover:shadow-md transition-all hover:scale-[1.02] active:scale-[0.98]">
                      <div className="w-14 h-14 rounded-2xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110"
                           style={{ background: `linear-gradient(135deg, ${item.color}12, ${item.color}05)` }}>{item.icon}</div>
                      <span className="text-[12px] font-bold text-[#1d1d1f]">{item.label}</span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* ═══ クイックスタート ═══ */}
          <section id="quickstart" className="scroll-mt-24">
            <div className="flex items-center gap-3 mb-5 px-1">
              <div className="w-1.5 h-1.5 rounded-full bg-[#0a84ff]" />
              <h2 className="text-[12px] font-bold text-[#6e6e73] uppercase tracking-[0.2em]">クイックスタート</h2>
              <div className="flex-1 h-px bg-gradient-to-r from-black/[0.06] to-transparent" />
            </div>
            <div className="space-y-3">
              <QuickStartCard number="1" icon="📝" title="テンプレートを選ぶ" description="ホームから「問題をつくる」をタップ。教科・難易度が設定されたテンプレートカードを選択するだけでOK。" color="#fc3c44" />
              <QuickStartCard number="2" icon="⚙️" title="生成設定を調整（省略可）" description="問題数・参考問題・出題形式を設定。そのままでもデフォルトで生成可能。" color="#bf5af2" />
              <QuickStartCard number="3" icon="🎨" title="PDFプリセットを選ぶ" description="試験問題・ワークシート・フラッシュカード・模擬試験の4形式から選択。" color="#ff9f0a" />
              <QuickStartCard number="4" icon="🚀" title="「生成する」をタップ" description="AIが過去問を参照しながら問題を自動生成。数秒で完了。" color="#30d158" />
              <QuickStartCard number="5" icon="📥" title="PDFをダウンロード" description="完成PDFをダウンロード。そのまま印刷して試験に使えます。" color="#0a84ff" />
            </div>
          </section>

          {/* ═══ ワークフロー ═══ */}
          <section id="workflow" className="scroll-mt-24">
            <div className="flex items-center gap-3 mb-5 px-1">
              <div className="w-1.5 h-1.5 rounded-full bg-[#bf5af2]" />
              <h2 className="text-[12px] font-bold text-[#6e6e73] uppercase tracking-[0.2em]">ワークフロー全体図</h2>
              <div className="flex-1 h-px bg-gradient-to-r from-black/[0.06] to-transparent" />
            </div>
            <div className="relative overflow-hidden rounded-[28px] bg-white/70 backdrop-blur-xl border border-black/[0.04] shadow-lg p-6 sm:p-8">
              <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#fc3c44] via-[#bf5af2] to-[#0a84ff] opacity-70" />
              <p className="text-[13px] text-[#86868b] mb-5 leading-relaxed">
                テンプレート選択から DB 保存まで、6ステップで試験問題が完成します。
              </p>
              <WorkflowSvg />
              <div className="mt-6 p-4 rounded-2xl bg-gradient-to-r from-[#30d158]/[0.04] to-[#0a84ff]/[0.04] border border-[#30d158]/10">
                <div className="flex items-center gap-3 text-[12px] font-bold text-[#30d158] mb-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
                  </svg>
                  フィードバックループ
                </div>
                <p className="text-[11px] text-[#86868b] leading-relaxed">
                  Step 5 の品質評価データは DB に保存され、次回の Step 3（RAG + AI生成）のプロンプトに自動反映。使うほど品質が向上します。
                </p>
              </div>
            </div>
          </section>

          {/* ═══ 機能ガイド ═══ */}
          <div className="flex items-center gap-3 mb-5 px-1">
            <div className="w-1.5 h-1.5 rounded-full bg-[#fc3c44]" />
            <h2 className="text-[12px] font-bold text-[#6e6e73] uppercase tracking-[0.2em]">機能ガイド（画面つき）</h2>
            <div className="flex-1 h-px bg-gradient-to-r from-black/[0.06] to-transparent" />
          </div>

          <FeatureSection id="create" icon={<IcoCreate />} title="問題をつくる" subtitle="5ステップのウィザードで試験問題をAI自動生成" color="#fc3c44" href="/user"
            diagram={<DiagramCreateWizard />}
            steps={[
              { title: 'テンプレートを選択', desc: '教科・分野・難易度が設定されたカードから選択。色分けでひと目でわかります。' },
              { title: '生成設定を調整', desc: '問題数・RAG参照数・参考問題（任意）・出題形式（標準/穴埋め/選択肢/○×）を設定。' },
              { title: 'PDFプリセットを選ぶ', desc: '試験問題・ワークシート等4種。ビジュアルサムネイルで直感的に選択。' },
              { title: 'AI自動生成', desc: '「生成する」を押すと、RAGで過去問参照 → AI生成。進行アニメーション表示。' },
              { title: '結果確認 → PDF DL', desc: 'LaTeX出力プレビュー。PDFリンクからダウンロード。RAGフィードバックも確認可。' },
            ]}
            tips={[
              '参考問題を選ぶと出題スタイルがより意図に沿うものに',
              'テンプレートは何度でも再利用可 — 保存しておきましょう',
              '図表が必要なら TikZ / CircuiTikZ / pgfplots を Step 2 で選択',
              '手動モードでプロンプトをコピーして好きなAIに貼付可能',
            ]}
            shortcuts={[
              '「← 戻る」で前ステップに自由に戻れます',
              '「最初からやり直す」で全ステップリセット',
              'プレビュー画面でLaTeXソースをコピー可能',
            ]}
          />

          <FeatureSection id="tune" icon={<IcoTune />} title="品質を高める" subtitle="RAGミキサー + フィードバックループで出力品質を継続改善" color="#bf5af2" href="/dev"
            diagram={<DiagramTunePage />}
            steps={[
              { title: 'テンプレート + 条件選択', desc: 'テンプレートカードから選択。科目・分野・難易度ドロップダウンで条件設定。' },
              { title: 'RAG ミキサー調整', desc: '類似度・難易度・ひっかけの3軸バランス調整。プリセットもワンタップ。' },
              { title: 'プロンプト生成 → コピー', desc: '調整反映のプロンプトが自動生成。ChatGPT / Claude / Gemini にコピペ。' },
              { title: '出力パース & 確認', desc: 'LLM出力を貼付 → JSON自動パース → 問題・解答・解説を構造確認。' },
              { title: '品質評価 → DB記録', desc: '5段階評価 → 保存。フィードバックループに自動反映。' },
            ]}
            tips={[
              'RAGミキサーのプリセット「バランス」が最初は推奨',
              '評価を繰り返すほどAIの出力品質が自動向上',
              '評価履歴パネルでスコア推移トレンドを確認可能',
              '低スコア科目はRAGミキサーの「類似度」を上げてみてください',
            ]}
            shortcuts={[
              'タブ切替: 設定→実行→評価の3ステップ',
              '「RAGスキップ」で過去問参照なしの直接生成可能',
              '評価メモに改善提案を記載すると次回に活用されます',
            ]}
          />

          <FeatureSection id="search" icon={<IcoSearch />} title="問題を検索" subtitle="キーワード × フィルターで過去問をスマート検索" color="#ff9f0a" href="/search"
            diagram={<DiagramSearchPage />}
            steps={[
              { title: 'キーワード入力', desc: '検索バーにキーワード入力（Enter確定）。問題文・科目・分野を横断検索。' },
              { title: 'フィルター絞込み', desc: '科目・分野（連動）・難易度のドロップダウンで絞り込み。バッジで一覧表示。' },
              { title: '結果カード確認', desc: 'クリックでアコーディオン展開。問題文・解法・解説・解答がLatex表示。' },
              { title: '類題生成（任意）', desc: '「この問題の類題を生成」ボタンでその場でAI類題生成・表示。' },
            ]}
            tips={[
              'キーワードなしで科目だけのフィルターも機能',
              'LaTeX数式はそのまま美しくレンダリング',
              '検索スコアが高いほど関連性が高い',
              '類題生成はネットワーク状況により数秒かかる場合も',
            ]}
          />

          <FeatureSection id="db" icon={<IcoDb />} title="DB編集" subtitle="データの閲覧・編集・かんたん登録" color="#30d158" href="/db-editor"
            diagram={<DiagramDbEditor />}
            steps={[
              { title: 'テーブル選択', desc: 'problems・tuning_logs・templates等をプルダウンで切替。PK表示あり。' },
              { title: 'データ閲覧・編集', desc: 'テーブルビューで一覧。セルクリックでインライン編集。カラムグループフィルタ可能。' },
              { title: 'かんたん登録', desc: '「➕ かんたん登録」タブで必須/推奨/任意のスマートフォームから問題追加。難易度自動推定。' },
              { title: '行の詳細・削除', desc: '行クリックで詳細モーダル。削除前に確認ダイアログ。一括保存で変更確定。' },
            ]}
            tips={[
              '誤字修正・難易度変更はインライン編集でサッと完了',
              'スマート作成で難易度を自動推定して便利',
              '表示カラムはグループ切替で最適組合せに',
              'ページネーション(30件/ページ)で大量データも快適',
            ]}
            shortcuts={[
              '検索バーでテーブル内絞り込み可能',
              '新規分野の追加もフォーム内から直接可能',
              'embedding等の巨大カラムは自動非表示',
            ]}
          />

          {/* ═══ 用語集 ═══ */}
          <section id="glossary" className="scroll-mt-24">
            <div className="flex items-center gap-3 mb-5 px-1">
              <div className="w-1.5 h-1.5 rounded-full bg-[#5856d6]" />
              <h2 className="text-[12px] font-bold text-[#6e6e73] uppercase tracking-[0.2em]">用語集</h2>
              <div className="flex-1 h-px bg-gradient-to-r from-black/[0.06] to-transparent" />
            </div>
            <div className="relative overflow-hidden rounded-[28px] bg-white/70 backdrop-blur-xl border border-black/[0.04] shadow-lg p-5 sm:p-7">
              <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#5856d6] via-[#0a84ff] to-[#5856d6] opacity-50" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {GLOSSARY.map((g) => (
                  <div key={g.term} className="flex items-start gap-3 p-3.5 rounded-2xl bg-white/60 border border-black/[0.04] hover:bg-white/90 hover:shadow-sm transition-all">
                    <div className="flex items-center justify-center w-9 h-9 rounded-xl text-white text-[12px] font-bold flex-shrink-0"
                         style={{ background: `linear-gradient(135deg, ${g.color}, ${g.color}bb)` }}>{g.term.charAt(0)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-bold text-[#1d1d1f] flex items-center gap-1.5">
                        {g.term}
                        {g.ruby && <span className="text-[9px] font-normal text-[#aeaeb2]">({g.ruby})</span>}
                      </div>
                      <div className="text-[11px] text-[#86868b] mt-1 leading-relaxed">{g.def}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ═══ FAQ ═══ */}
          <section id="faq" className="scroll-mt-24">
            <div className="flex items-center gap-3 mb-5 px-1">
              <div className="w-1.5 h-1.5 rounded-full bg-[#ff9f0a]" />
              <h2 className="text-[12px] font-bold text-[#6e6e73] uppercase tracking-[0.2em]">よくある質問</h2>
              <span className="text-[10px] font-bold text-[#aeaeb2] bg-black/[0.03] px-2.5 py-0.5 rounded-full">
                {FAQ_DATA.reduce((sum, c) => sum + c.items.length, 0)} 件
              </span>
              <div className="flex-1 h-px bg-gradient-to-r from-black/[0.06] to-transparent" />
            </div>
            <div className="space-y-4">
              {FAQ_DATA.map((cat) => (
                <FaqCategory key={cat.category} {...cat} />
              ))}
            </div>
          </section>

          {/* ═══ フッター ═══ */}
          <div className="text-center pt-8 pb-4">
            <Link href="/" className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-[#fc3c44] to-[#e0323a] text-white text-[15px] font-bold shadow-lg shadow-[#fc3c44]/20 hover:shadow-xl hover:shadow-[#fc3c44]/30 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              ホームに戻って始める
            </Link>
            <p className="text-[11px] text-[#c7c7cc] mt-5">REM — Rapid Exam Maker</p>
          </div>

        </div>
      </div>
    </div>
  );
}
