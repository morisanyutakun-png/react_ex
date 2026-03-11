'use client';

import { useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { searchProblems, practiceGenerate, practiceRenderPrompt, practiceParseJson, generatePdf } from '@/lib/api';
import { SUBJECT_TOPICS } from '@/lib/constants';
import { LatexBlock } from '@/components/LatexRenderer';
import { MobileNavLinks } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';

/* ─────────────────────────────────────────────────────────────
   定数
───────────────────────────────────────────────────────────── */

const SCREEN = { SELECT: 'select', LOADING: 'loading', PROMPT: 'prompt', PROBLEM: 'problem', ANSWER: 'answer', FOLLOW: 'follow', EXAM: 'exam', SUMMARY: 'summary' };

const PRACTICE_SUBJECTS = ['物理', '数学', '化学'];

const SUBJECT_COLOR = {
  '物理': { accent: '#8b5cf6', light: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200', gradient: 'from-violet-500 to-violet-600', ring: '#8b5cf620', glow: 'rgba(139,92,246,0.15)' },
  '数学': { accent: '#3b82f6', light: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-200',   gradient: 'from-blue-500 to-blue-600',   ring: '#3b82f620', glow: 'rgba(59,130,246,0.15)' },
  '化学': { accent: '#10b981', light: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', gradient: 'from-emerald-500 to-emerald-600', ring: '#10b98120', glow: 'rgba(16,185,129,0.15)' },
};

const EXAM_LEVELS = [
  { value: '基礎',   label: '基礎',      sub: '教科書レベル' },
  { value: '標準',   label: '共通テスト', sub: '共通テスト相当' },
  { value: '応用',   label: 'MARCH',     sub: '中堅私大・地国' },
  { value: '発展',   label: '難関大',    sub: '早慶・上位国立' },
  { value: '難関',   label: '旧帝大',    sub: '阪大・東北大等' },
  { value: '最難関', label: '東大・京大', sub: '最難関' },
];

const SCORE = { CORRECT: 'correct', DELTA: 'delta', WRONG: 'wrong' };

const GEN_MODE = { AUTO: 'auto', MANUAL: 'manual' };

const PRACTICE_FORMAT = { DRILL: 'drill', EXAM: 'exam' };

/* ─────────────────────────────────────────────────────────────
   セクション見出し
───────────────────────────────────────────────────────────── */

function SectionLabel({ children, extra }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="text-[11px] font-extrabold text-[#64748b] tracking-[0.1em] uppercase select-none">{children}</div>
      {extra}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   小コンポーネント
───────────────────────────────────────────────────────────── */

function SubjectTab({ subject, selected, onClick }) {
  const c = SUBJECT_COLOR[subject];
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-5 py-2.5 rounded-full text-[13px] font-bold transition-all duration-250 border
        ${selected
          ? 'text-white border-transparent shadow-lg scale-[1.04]'
          : 'bg-white text-[#64748b] border-[#e2e8f0] hover:border-[#cbd5e1] hover:shadow-sm active:scale-[0.97]'
        }`}
      style={selected ? { background: `linear-gradient(135deg, ${c.accent}, ${c.accent}bb)`, boxShadow: `0 6px 20px ${c.ring}` } : {}}
    >
      {subject}
    </button>
  );
}

function TopicChip({ label, selected, onClick, accent }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3.5 py-1.5 rounded-full text-[12px] font-semibold transition-all duration-200 border
        ${selected
          ? 'text-white border-transparent shadow-sm'
          : 'bg-white text-[#64748b] border-[#e2e8f0] hover:border-[#cbd5e1] hover:bg-[#f8fafc]'
        }`}
      style={selected ? { backgroundColor: accent, borderColor: 'transparent', boxShadow: `0 2px 8px ${accent}30` } : {}}
    >
      {label}
    </button>
  );
}

function ProgressBar({ current, total, accent }) {
  const pct = total > 0 ? (current / total) * 100 : 0;
  return (
    <div className="w-full h-2 bg-[#f1f5f9] rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-700 ease-out relative"
        style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${accent || '#8b5cf6'}, ${accent || '#6366f1'}bb)` }}
      />
    </div>
  );
}

function ScoreButton({ type, onClick }) {
  const map = {
    [SCORE.CORRECT]: { label: '解けた', icon: '○', bg: '#f0fdf4', bgHover: '#dcfce7', border: '#86efac', text: '#16a34a' },
    [SCORE.DELTA]:   { label: '惜しい', icon: '△', bg: '#fffbeb', bgHover: '#fef3c7', border: '#fcd34d', text: '#d97706' },
    [SCORE.WRONG]:   { label: 'わからない', icon: '×', bg: '#fef2f2', bgHover: '#fee2e2', border: '#fca5a5', text: '#dc2626' },
  };
  const s = map[type];
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex-1 flex flex-col items-center gap-2 py-5 rounded-2xl border-2 font-bold transition-all duration-200 active:scale-[0.93] hover:shadow-md"
      style={{ background: s.bg, borderColor: s.border, color: s.text }}
      onMouseEnter={(e) => (e.currentTarget.style.background = s.bgHover)}
      onMouseLeave={(e) => (e.currentTarget.style.background = s.bg)}
    >
      <span className="text-[28px] leading-none">{s.icon}</span>
      <span className="text-[11px] font-bold">{s.label}</span>
    </button>
  );
}

function BackButton({ onClick, label = '終了' }) {
  return (
    <button type="button" onClick={onClick} className="flex items-center gap-1.5 text-[13px] font-medium text-[#94a3b8] hover:text-[#475569] transition-colors duration-200 group">
      <svg className="w-4 h-4 transition-transform duration-200 group-hover:-translate-x-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
      </svg>
      {label}
    </button>
  );
}

/* ─────────────────────────────────────────────────────────────
   選択画面 A
───────────────────────────────────────────────────────────── */

function SelectScreen({ onStart, isAuthenticated, isGuest }) {
  const [subject, setSubject] = useState('物理');
  const [topics, setTopics] = useState([]);
  const [difficulty, setDifficulty] = useState('応用');
  const [numQ, setNumQ] = useState(5);
  const [genMode, setGenMode] = useState(isGuest ? GEN_MODE.MANUAL : GEN_MODE.AUTO);
  const [practiceFormat, setPracticeFormat] = useState(PRACTICE_FORMAT.DRILL);

  const c = SUBJECT_COLOR[subject];
  const topicOptions = SUBJECT_TOPICS[subject] || [];

  const toggleTopic = (t) =>
    setTopics((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]);

  const handleStart = () => {
    onStart({ subject, topics, difficulty, numQ, genMode, practiceFormat });
  };

  return (
    <div className="max-w-[480px] mx-auto px-5 pt-10 pb-24">

      {/* ヘッダー */}
      <div className="mb-10">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-all duration-300"
               style={{ background: `linear-gradient(135deg, ${c.accent}, ${c.accent}bb)`, boxShadow: `0 8px 24px ${c.ring}` }}>
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342" />
            </svg>
          </div>
          <div>
            <h1 className="text-[24px] font-black text-[#0f172a] tracking-[-0.03em] leading-tight">
              今日は何を練習する？
            </h1>
            <p className="text-[13px] text-[#94a3b8] mt-1">選んだらすぐ問題が出てくる</p>
          </div>
        </div>
      </div>

      {/* 生成モード切替 */}
      <div className="mb-7">
        <SectionLabel>生成モード</SectionLabel>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => !isGuest && setGenMode(GEN_MODE.AUTO)}
            disabled={isGuest}
            className={`relative text-left p-4 rounded-2xl border-2 transition-all duration-250
              ${genMode === GEN_MODE.AUTO ? 'border-[#2563eb] bg-blue-50/50 shadow-md' : 'border-[#e2e8f0] bg-white hover:border-[#cbd5e1] hover:shadow-sm'}
              ${isGuest ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {genMode === GEN_MODE.AUTO && (
              <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-[#2563eb] flex items-center justify-center">
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
            )}
            <div className="flex items-start gap-2.5">
              <div className={`flex items-center justify-center w-9 h-9 rounded-xl flex-shrink-0 transition-all duration-250 ${
                genMode === GEN_MODE.AUTO ? 'bg-[#2563eb] text-white shadow-md' : 'bg-blue-50 text-[#64748b]'
              }`}>
                <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-bold text-[#1e293b]">AI 自動生成</div>
                <div className="text-[10px] text-[#64748b] mt-0.5 leading-snug">ワンクリックで問題を自動作成</div>
                {isGuest && (
                  <div className="text-[10px] text-amber-600 mt-1.5 flex items-center gap-1 font-medium">
                    <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                    </svg>
                    ログインが必要
                  </div>
                )}
              </div>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setGenMode(GEN_MODE.MANUAL)}
            className={`relative text-left p-4 rounded-2xl border-2 transition-all duration-250
              ${genMode === GEN_MODE.MANUAL ? 'border-[#2563eb] bg-blue-50/50 shadow-md' : 'border-[#e2e8f0] bg-white hover:border-[#cbd5e1] hover:shadow-sm'}`}
          >
            {genMode === GEN_MODE.MANUAL && (
              <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-[#2563eb] flex items-center justify-center">
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
            )}
            <div className="flex items-start gap-2.5">
              <div className={`flex items-center justify-center w-9 h-9 rounded-xl flex-shrink-0 transition-all duration-250 ${
                genMode === GEN_MODE.MANUAL ? 'bg-[#2563eb] text-white shadow-md' : 'bg-blue-50 text-[#64748b]'
              }`}>
                <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-bold text-[#1e293b]">手動</div>
                <div className="text-[10px] text-[#64748b] mt-0.5 leading-snug">AIへの指示文を取得して自分で送る</div>
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* 練習形式 */}
      <div className="mb-7">
        <SectionLabel>練習形式</SectionLabel>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setPracticeFormat(PRACTICE_FORMAT.DRILL)}
            className={`relative text-left p-4 rounded-2xl border-2 transition-all duration-250
              ${practiceFormat === PRACTICE_FORMAT.DRILL ? 'border-[#2563eb] bg-blue-50/50 shadow-md' : 'border-[#e2e8f0] bg-white hover:border-[#cbd5e1] hover:shadow-sm'}`}
          >
            {practiceFormat === PRACTICE_FORMAT.DRILL && (
              <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-[#2563eb] flex items-center justify-center">
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
            )}
            <div className="flex items-start gap-2.5">
              <div className={`flex items-center justify-center w-9 h-9 rounded-xl flex-shrink-0 transition-all duration-250 ${
                practiceFormat === PRACTICE_FORMAT.DRILL ? 'bg-[#2563eb] text-white shadow-md' : 'bg-blue-50 text-[#64748b]'
              }`}>
                <span className="text-[16px]">📝</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-bold text-[#1e293b]">一問一答</div>
                <div className="text-[10px] text-[#64748b] mt-0.5 leading-snug">1問ずつ解いて即座に採点</div>
              </div>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setPracticeFormat(PRACTICE_FORMAT.EXAM)}
            className={`relative text-left p-4 rounded-2xl border-2 transition-all duration-250
              ${practiceFormat === PRACTICE_FORMAT.EXAM ? 'border-[#2563eb] bg-blue-50/50 shadow-md' : 'border-[#e2e8f0] bg-white hover:border-[#cbd5e1] hover:shadow-sm'}`}
          >
            {practiceFormat === PRACTICE_FORMAT.EXAM && (
              <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-[#2563eb] flex items-center justify-center">
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
            )}
            <div className="flex items-start gap-2.5">
              <div className={`flex items-center justify-center w-9 h-9 rounded-xl flex-shrink-0 transition-all duration-250 ${
                practiceFormat === PRACTICE_FORMAT.EXAM ? 'bg-[#2563eb] text-white shadow-md' : 'bg-blue-50 text-[#64748b]'
              }`}>
                <span className="text-[16px]">📋</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-bold text-[#1e293b]">模試形式</div>
                <div className="text-[10px] text-[#64748b] mt-0.5 leading-snug">全問表示＋タイマーで本番演習</div>
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* 科目タブ */}
      <div className="mb-7">
        <SectionLabel>科目</SectionLabel>
        <div className="flex gap-2.5">
          {PRACTICE_SUBJECTS.map((s) => (
            <SubjectTab key={s} subject={s} selected={subject === s} onClick={() => { setSubject(s); setTopics([]); }} />
          ))}
        </div>
      </div>

      {/* 単元選択（複数可） */}
      <div className="mb-7">
        <SectionLabel extra={
          topics.length > 0 ? (
            <button type="button" onClick={() => setTopics([])} className="text-[11px] font-medium text-[#94a3b8] hover:text-[#64748b] transition-colors">すべて解除</button>
          ) : null
        }>単元</SectionLabel>
        <div className="flex flex-wrap gap-2">
          {topicOptions.map((t) => (
            <TopicChip key={t} label={t} selected={topics.includes(t)} onClick={() => toggleTopic(t)} accent={c.accent} />
          ))}
        </div>
        {topics.length === 0 && (
          <p className="text-[11px] text-[#94a3b8] mt-2.5 flex items-center gap-1">
            <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
            </svg>
            選択なし = 全単元からランダム出題
          </p>
        )}
      </div>

      {/* 難易度 */}
      <div className="mb-8">
        <SectionLabel>難易度</SectionLabel>
        <div className="grid grid-cols-3 gap-2.5">
          {EXAM_LEVELS.map((lv) => {
            const sel = difficulty === lv.value;
            return (
              <button
                key={lv.value}
                type="button"
                onClick={() => setDifficulty(lv.value)}
                className={`px-3 py-3 rounded-xl border text-left transition-all duration-250
                  ${sel ? 'border-transparent text-white shadow-md scale-[1.02]' : 'bg-white border-[#e2e8f0] hover:border-[#cbd5e1] hover:shadow-sm'}`}
                style={sel ? { background: `linear-gradient(135deg, ${c.accent}, ${c.accent}bb)`, boxShadow: `0 4px 16px ${c.ring}` } : {}}
              >
                <div className={`text-[12px] font-bold ${sel ? 'text-white' : 'text-[#1e293b]'}`}>{lv.label}</div>
                <div className={`text-[10px] mt-0.5 ${sel ? 'text-white/80' : 'text-[#94a3b8]'}`}>{lv.sub}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 問題数 */}
      <div className="mb-10">
        <SectionLabel>問題数</SectionLabel>
        <div className="flex gap-2.5">
          {[3, 5, 10].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setNumQ(n)}
              className={`flex-1 py-3 rounded-xl border text-[13px] font-bold transition-all duration-250
                ${numQ === n ? 'text-white border-transparent shadow-md scale-[1.02]' : 'bg-white text-[#64748b] border-[#e2e8f0] hover:border-[#cbd5e1] hover:shadow-sm'}`}
              style={numQ === n ? { background: `linear-gradient(135deg, ${c.accent}, ${c.accent}bb)`, boxShadow: `0 4px 16px ${c.ring}` } : {}}
            >
              {n}問
            </button>
          ))}
        </div>
      </div>

      {/* スタートボタン */}
      <button
        type="button"
        onClick={handleStart}
        className="w-full py-4.5 rounded-2xl text-[16px] font-black text-white tracking-[-0.01em] shadow-xl transition-all duration-250 active:scale-[0.97] hover:shadow-2xl"
        style={{ background: `linear-gradient(135deg, ${c.accent}, ${c.accent}bb)`, boxShadow: `0 10px 30px ${c.ring}` }}
      >
        {practiceFormat === PRACTICE_FORMAT.EXAM ? '模試を始める →' : '練習を始める →'}
      </button>

      <p className="text-center text-[11px] text-[#94a3b8] mt-4 leading-relaxed">
        {practiceFormat === PRACTICE_FORMAT.EXAM
          ? '全問一覧＋タイマーで本番さながらの演習'
          : genMode === GEN_MODE.AUTO ? 'AIが問題を生成します（作るモードと同じアルゴリズム）' : 'プロンプトを生成 → ChatGPT等で実行 → 貼り付け'}
      </p>

      {/* 詳細モードへの導線 */}
      <div className="mt-10 pt-6 border-t border-[#f1f5f9]">
        <Link href="/user" className="group flex items-center justify-center gap-2 text-[12px] text-[#94a3b8] hover:text-[#64748b] transition-colors duration-200">
          <svg className="w-3.5 h-3.5 transition-transform duration-200 group-hover:rotate-12" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5" />
          </svg>
          PDF生成・詳細設定モードはこちら（教員向け）
        </Link>
      </div>

      <MobileNavLinks currentPath="/practice" />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   手動モード: プロンプト & 貼り付け画面
───────────────────────────────────────────────────────────── */

function PromptScreen({ prompt, subject, difficulty, onParsed, onBack, promptLoading }) {
  const c = SUBJECT_COLOR[subject] || SUBJECT_COLOR['物理'];
  const [copied, setCopied] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState('');

  const handleCopy = async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(prompt);
      } else {
        const ta = document.createElement('textarea');
        ta.value = prompt;
        ta.style.position = 'fixed'; ta.style.left = '-9999px'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.focus(); ta.select();
        document.execCommand('copy'); document.body.removeChild(ta);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {}
  };

  const handleParse = async () => {
    if (!pasteText.trim()) return;
    setParsing(true);
    setParseError('');
    try {
      const result = await practiceParseJson(pasteText, subject, difficulty);
      if (result?.error) {
        setParseError(result.error);
      } else if (result?.problems?.length > 0) {
        onParsed(result.problems, result.latex || null);
      } else {
        setParseError('problems 配列が空です。AIの出力をそのまま貼り付けてください。');
      }
    } catch (e) {
      setParseError(`パースに失敗しました: ${e.message}`);
    }
    setParsing(false);
  };

  if (promptLoading) {
    return (
      <div className="max-w-[480px] mx-auto px-5 pt-24 flex flex-col items-center gap-7">
        <div className="relative">
          <div className="w-20 h-20 rounded-3xl flex items-center justify-center text-[32px]"
               style={{ background: `linear-gradient(135deg, ${c.glow}, ${c.accent}10)` }}>
            🧠
          </div>
          <div className="absolute inset-0 rounded-3xl animate-ping opacity-20" style={{ background: c.accent }} />
        </div>
        <div className="text-center">
          <p className="text-[17px] font-bold text-[#1e293b]">プロンプトを生成中…</p>
          <p className="text-[12px] text-[#94a3b8] mt-1.5">最適な出題指示を構築しています</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[480px] mx-auto px-5 pt-8 pb-24">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-8">
        <BackButton onClick={onBack} label="戻る" />
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: c.accent }} />
          <span className="text-[12px] font-bold text-[#64748b]">手動モード</span>
        </div>
      </div>

      {/* ステップインジケーター */}
      <div className="flex items-center gap-3 mb-8 px-2">
        <div className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-black text-white shadow-md`}
               style={{ background: copied ? '#16a34a' : c.accent }}>
            {copied ? '✓' : '1'}
          </div>
          <span className={`text-[12px] font-bold ${copied ? 'text-[#16a34a]' : 'text-[#1e293b]'}`}>コピー</span>
        </div>
        <div className="flex-1 h-[2px] rounded-full" style={{ background: copied ? c.accent : '#e2e8f0' }} />
        <div className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-black ${copied ? 'text-white shadow-md' : 'text-[#94a3b8] border-2 border-[#e2e8f0]'}`}
               style={copied ? { background: c.accent } : {}}>
            2
          </div>
          <span className={`text-[12px] font-bold ${copied ? 'text-[#1e293b]' : 'text-[#94a3b8]'}`}>貼り付け</span>
        </div>
      </div>

      {/* ステップ1: プロンプトコピー */}
      <div className={`rounded-2xl border overflow-hidden mb-6 transition-all duration-300 ${copied ? 'border-[#86efac] bg-green-50/30' : 'border-[#e2e8f0] bg-white shadow-sm'}`}>
        <div className="p-4 border-b border-[#f1f5f9] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-[13px] font-bold text-[#1e293b]">📋 指示文をコピー</span>
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[11px] font-bold transition-all duration-250 border active:scale-[0.95]"
            style={copied
              ? { background: '#dcfce7', borderColor: '#86efac', color: '#16a34a' }
              : { background: c.accent + '10', borderColor: c.accent + '30', color: c.accent }}
          >
            {copied ? (
              <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>コピー済み</>
            ) : (
              <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" /></svg>コピー</>
            )}
          </button>
        </div>
        <div className="p-4 max-h-[180px] overflow-y-auto bg-[#0f172a] rounded-b-none">
          <pre className="text-[11px] leading-[1.7] text-[#94d5a8] whitespace-pre-wrap font-mono break-all select-all">{prompt}</pre>
        </div>
        <div className="px-4 py-3 bg-[#f8fafc]">
          <p className="text-[11px] text-[#64748b] flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
            </svg>
            ChatGPT / Claude などに貼り付けて実行してください
          </p>
        </div>
      </div>

      {/* ステップ2: AIの出力を貼り付け */}
      <div className="bg-white rounded-2xl border border-[#e2e8f0] overflow-hidden shadow-sm">
        <div className="p-4 border-b border-[#f1f5f9]">
          <span className="text-[13px] font-bold text-[#1e293b]">📥 AIの出力を貼り付け</span>
          <p className="text-[11px] text-[#94a3b8] mt-1">AIから返ってきたJSON出力をそのまま貼り付けてください</p>
        </div>
        <div className="p-4">
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            rows={8}
            className="w-full rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-4 py-3 text-[12px] font-mono text-[#1e293b] placeholder:text-[#cbd5e1] focus:outline-none focus:ring-2 focus:ring-offset-1 focus:border-transparent resize-none transition-all duration-200"
            style={{ '--tw-ring-color': c.accent + '60' }}
            placeholder='{&#10;  &quot;problems&quot;: [&#10;    { &quot;stem&quot;: &quot;...&quot;, &quot;answer&quot;: &quot;...&quot;, ... }&#10;  ]&#10;}'
          />

          {parseError && (
            <div className="mt-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-[11px] text-red-700 font-medium flex items-start gap-2">
              <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              {parseError}
            </div>
          )}

          <button
            type="button"
            onClick={handleParse}
            disabled={!pasteText.trim() || parsing}
            className="w-full mt-4 py-4 rounded-2xl text-[14px] font-black text-white shadow-lg transition-all duration-250 active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none hover:shadow-xl"
            style={{ background: `linear-gradient(135deg, ${c.accent}, ${c.accent}bb)`, boxShadow: `0 6px 20px ${c.ring}` }}
          >
            {parsing ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                パース中…
              </span>
            ) : '問題を読み込んで練習開始 →'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   ローディング画面
───────────────────────────────────────────────────────────── */

function LoadingScreen({ subject, genMode, loadingStep }) {
  const c = SUBJECT_COLOR[subject] || SUBJECT_COLOR['物理'];
  const isAI = genMode === GEN_MODE.AUTO;

  const steps = isAI
    ? [
        { label: 'プロンプトを構築中…', icon: '🧠', sub: '出題条件を最適化しています' },
        { label: 'AIが問題を生成中…',   icon: '✨', sub: '教員モードと同じアルゴリズムで生成' },
        { label: '仕上げ中…',           icon: '📝', sub: 'もう少しで完了します' },
      ]
    : [{ label: 'DBから問題を取得中…', icon: '🔍', sub: '最適な問題を選んでいます' }];

  const activeStep = Math.min(loadingStep || 0, steps.length - 1);

  return (
    <div className="max-w-[480px] mx-auto px-5 pt-24 flex flex-col items-center gap-8">
      {/* アイコン with ring animation */}
      <div className="relative">
        <div className="w-20 h-20 rounded-3xl flex items-center justify-center text-[32px] relative z-10"
             style={{ background: `linear-gradient(135deg, ${c.glow}, ${c.accent}15)` }}>
          {steps[activeStep].icon}
        </div>
        <div className="absolute -inset-3 rounded-[28px] animate-ping opacity-10" style={{ background: c.accent }} />
        <div className="absolute -inset-1.5 rounded-[24px] opacity-20 animate-pulse" style={{ border: `2px solid ${c.accent}` }} />
      </div>

      <div className="text-center">
        <p className="text-[18px] font-black text-[#0f172a] tracking-[-0.02em]">{steps[activeStep].label}</p>
        <p className="text-[12px] text-[#94a3b8] mt-2">{steps[activeStep].sub}</p>

        {isAI && (
          <div className="flex items-center justify-center gap-2.5 mt-8">
            {steps.map((s, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <div className="flex flex-col items-center gap-1.5">
                  <div
                    className={`w-3 h-3 rounded-full transition-all duration-700 ${i <= activeStep ? 'scale-100' : 'scale-75 opacity-30'}`}
                    style={{ backgroundColor: i <= activeStep ? c.accent : '#cbd5e1', boxShadow: i <= activeStep ? `0 0 8px ${c.accent}40` : 'none' }}
                  />
                  <span className={`text-[9px] font-bold transition-all duration-500 ${i <= activeStep ? 'opacity-100' : 'opacity-30'}`}
                        style={{ color: i <= activeStep ? c.accent : '#94a3b8' }}>
                    {i + 1}
                  </span>
                </div>
                {i < steps.length - 1 && (
                  <div className={`w-10 h-[2px] rounded-full transition-all duration-700 mb-5 ${i < activeStep ? '' : 'opacity-25'}`}
                       style={{ backgroundColor: i < activeStep ? c.accent : '#cbd5e1' }} />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   問題画面 B + 解答画面 C
───────────────────────────────────────────────────────────── */

function ProblemScreen({ problem, index, total, subject, showAnswer, onShowAnswer, onScore, onSkip, onQuit }) {
  const c = SUBJECT_COLOR[subject] || SUBJECT_COLOR['物理'];
  const stem = problem?.stem || problem?.text || problem?.question || '';
  const topic = problem?.topic || problem?.metadata?.field || '';
  const diffLabel = EXAM_LEVELS.find((l) => l.value === (problem?.difficulty || problem?.metadata?.difficulty))?.label || '';
  const hasFigure = problem?.figure_tikz && problem.figure_tikz !== 'null';

  // subproblems 対応: なければ旧形式の answer/explanation からラップ
  const subproblems = (() => {
    const subs = problem?.subproblems;
    if (Array.isArray(subs) && subs.length > 0) return subs;
    const a = problem?.answer || problem?.solution || '';
    const e = problem?.explanation || problem?.解説 || '';
    if (a || e) return [{ label: '', question: '', answer: a, explanation: e }];
    return [];
  })();

  return (
    <div className="max-w-[480px] mx-auto px-5 pt-8 pb-20">

      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-5">
        <BackButton onClick={onQuit} label="終了" />
        <div className="flex items-center gap-2.5">
          <span className="text-[13px] font-black tracking-[-0.01em]" style={{ color: c.accent }}>
            {index + 1}
          </span>
          <span className="text-[12px] text-[#cbd5e1] font-bold">/</span>
          <span className="text-[13px] font-bold text-[#94a3b8]">
            {total}
          </span>
        </div>
      </div>

      {/* プログレス */}
      <div className="mb-7">
        <div className="flex items-center gap-2 mb-2.5">
          {topic && (
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full"
                  style={{ background: c.accent + '14', color: c.accent }}>
              {topic}
            </span>
          )}
          {diffLabel && (
            <span className="text-[11px] text-[#94a3b8] font-medium bg-[#f8fafc] px-2 py-0.5 rounded-full">{diffLabel}</span>
          )}
          {hasFigure && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">図あり</span>
          )}
        </div>
        <ProgressBar current={index + (showAnswer ? 1 : 0.5)} total={total} accent={c.accent} />
      </div>

      {/* 問題本文 */}
      <div className={`bg-white rounded-2xl border p-6 mb-6 transition-all duration-500 ${showAnswer ? 'border-[#e2e8f0] opacity-70 shadow-none' : 'border-[#e2e8f0] shadow-md'}`}
           style={!showAnswer ? { boxShadow: `0 4px 20px ${c.ring}` } : {}}>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-6 h-6 rounded-lg flex items-center justify-center text-[11px] font-black text-white"
               style={{ background: c.accent }}>
            Q
          </div>
          <span className="text-[11px] font-bold text-[#94a3b8] tracking-[0.06em] uppercase">問題</span>
        </div>

        {/* 状況設定 */}
        {stem ? (
          <LatexBlock className="text-[14px] leading-[2] text-[#1e293b] mb-4">{stem}</LatexBlock>
        ) : (
          <p className="text-[13px] text-[#94a3b8] mb-4">問題文を読み込めませんでした</p>
        )}

        {/* 小問リスト（答え表示前は問題文のみ） */}
        {subproblems.length > 0 && (
          <div className="space-y-3 border-t pt-4" style={{ borderColor: c.accent + '22' }}>
            {subproblems.map((sp, idx) => (
              <div key={idx}>
                {(sp.label || sp.question) && (
                  <div className="flex gap-2">
                    {sp.label && (
                      <span className="text-[13px] font-black shrink-0" style={{ color: c.accent }}>{sp.label}</span>
                    )}
                    {sp.question && (
                      <LatexBlock className="text-[13px] leading-[1.9] text-[#1e293b]">{sp.question}</LatexBlock>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 解答エリア */}
      {!showAnswer ? (
        <div className="space-y-3">
          <button
            type="button"
            onClick={onShowAnswer}
            className="w-full py-4.5 rounded-2xl text-[15px] font-black text-white shadow-xl transition-all duration-250 active:scale-[0.97] hover:shadow-2xl"
            style={{ background: `linear-gradient(135deg, ${c.accent}, ${c.accent}bb)`, boxShadow: `0 8px 28px ${c.ring}` }}
          >
            答えを見る
          </button>
          <p className="text-center text-[11px] text-[#94a3b8] flex items-center justify-center gap-1.5">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            先に自分で解いてみてから確認しよう
          </p>
        </div>
      ) : (
        <div className="animate-in fade-in slide-in-from-bottom-3 duration-400 space-y-4">
          {/* 解答・解説（小問ごと） */}
          {subproblems.length > 0 ? (
            <div className="space-y-4">
              {subproblems.map((sp, idx) => (
                <div key={idx} className="bg-white rounded-2xl border border-[#e2e8f0] overflow-hidden shadow-md"
                     style={{ boxShadow: `0 4px 16px ${c.ring}` }}>
                  {/* 解答ヘッダー */}
                  <div className="flex items-center gap-2 px-5 pt-4 pb-3 border-b border-[#f1f5f9]">
                    <div className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-black text-white"
                         style={{ background: c.accent }}>
                      A
                    </div>
                    <span className="text-[11px] font-black tracking-[0.05em] uppercase" style={{ color: c.accent }}>
                      {sp.label ? `解答 ${sp.label}` : '解答'}
                    </span>
                  </div>
                  {/* 解答値 */}
                  {sp.answer && (
                    <div className="px-5 pt-3 pb-2">
                      <LatexBlock className="text-[14px] leading-[2] text-[#1e293b] font-semibold">{sp.answer}</LatexBlock>
                    </div>
                  )}
                  {/* 解説 */}
                  {sp.explanation && (
                    <div className="px-5 pb-4 pt-1 border-t border-[#f1f5f9] bg-[#fafbff]">
                      <div className="flex items-center gap-1.5 mb-2 pt-2">
                        <span className="text-[10px] font-bold text-[#6366f1] tracking-[0.05em] uppercase">解説</span>
                      </div>
                      <LatexBlock className="text-[12px] leading-[1.85] text-[#475569]">{sp.explanation}</LatexBlock>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-[#e2e8f0] p-6 shadow-md text-[13px] text-[#94a3b8]">
              解答データなし
            </div>
          )}

          {/* 自己採点 */}
          <div className="pt-2">
            <div className="text-[13px] font-bold text-[#1e293b] mb-4 text-center">どうだった？</div>
            <div className="flex gap-3">
              <ScoreButton type={SCORE.CORRECT} onClick={() => onScore(SCORE.CORRECT)} />
              <ScoreButton type={SCORE.DELTA}   onClick={() => onScore(SCORE.DELTA)} />
              <ScoreButton type={SCORE.WRONG}   onClick={() => onScore(SCORE.WRONG)} />
            </div>
          </div>

          {/* スキップ */}
          <button type="button" onClick={() => onSkip && onSkip()} className="w-full py-2.5 text-[12px] text-[#94a3b8] hover:text-[#64748b] transition-colors duration-200">
            スキップ（△扱い）
          </button>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   弱点フォロー画面 D（×のとき）
───────────────────────────────────────────────────────────── */

function FollowScreen({ problem, subject, onContinue, onSkip, isLoading }) {
  const c = SUBJECT_COLOR[subject] || SUBJECT_COLOR['物理'];
  const topic = problem?.topic || problem?.metadata?.field || '同じ単元';
  return (
    <div className="max-w-[480px] mx-auto px-5 pt-20 pb-16 text-center">
      {/* アイコン */}
      <div className="relative w-16 h-16 mx-auto mb-6">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-red-50 to-orange-50 border-2 border-red-200 flex items-center justify-center">
          <span className="text-[28px]">💪</span>
        </div>
      </div>

      <h2 className="text-[20px] font-black text-[#0f172a] tracking-[-0.02em] mb-2">
        {topic}、もう1問やる？
      </h2>
      <p className="text-[13px] text-[#64748b] mb-2 leading-relaxed">
        すぐ復習すると記憶に定着しやすい
      </p>
      <p className="text-[11px] text-[#94a3b8] mb-10">
        間違えた問題の周辺をもう少し練習しよう
      </p>

      <button
        type="button"
        onClick={onContinue}
        disabled={isLoading}
        className="w-full py-4.5 rounded-2xl text-[15px] font-black text-white shadow-xl mb-4 transition-all duration-250 active:scale-[0.97] disabled:opacity-60 hover:shadow-2xl"
        style={{ background: `linear-gradient(135deg, ${c.accent}, ${c.accent}bb)`, boxShadow: `0 8px 24px ${c.ring}` }}
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
            取得中…
          </span>
        ) : '同じ単元をもう1問 →'}
      </button>
      <button type="button" onClick={onSkip} className="w-full py-3 text-[13px] text-[#94a3b8] hover:text-[#475569] transition-colors duration-200">
        次の問題へ進む
      </button>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   模試形式画面: 全問一覧 + タイマー
───────────────────────────────────────────────────────────── */

function ExamScreen({ problems, subject, onFinish, onQuit }) {
  const c = SUBJECT_COLOR[subject] || SUBJECT_COLOR['物理'];
  const numQ = problems.length;
  const initialTime = numQ <= 3 ? 15 * 60 : numQ <= 5 ? 30 * 60 : 60 * 60;
  const [timeLeft, setTimeLeft] = useState(initialTime);
  const [finished, setFinished] = useState(false);
  const [examScores, setExamScores] = useState({}); // { index: SCORE.xxx }

  // タイマー
  useEffect(() => {
    if (finished) return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) { setFinished(true); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [finished]);

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${String(sec).padStart(2, '0')}`;
  };

  const handleFinishExam = () => setFinished(true);

  const handleScoreChange = (idx, score) => {
    setExamScores((prev) => ({ ...prev, [idx]: score }));
  };

  const handleSubmitScores = () => {
    const scoreArray = problems.map((_, i) => examScores[i] || SCORE.DELTA);
    onFinish(scoreArray);
  };

  const allScored = Object.keys(examScores).length === problems.length;
  const timeWarning = timeLeft > 0 && timeLeft <= 60;
  const timeDanger = timeLeft > 0 && timeLeft <= 30;
  const pct = Math.max(0, (timeLeft / initialTime) * 100);

  return (
    <div className="max-w-[480px] mx-auto px-5 pt-6 pb-24">
      {/* 固定ヘッダー: タイマー */}
      <div className="sticky top-0 z-20 bg-white/90 backdrop-blur-md -mx-5 px-5 pb-4 pt-2 border-b border-[#f1f5f9]">
        <div className="flex items-center justify-between mb-2">
          <BackButton onClick={onQuit} label="中断" />
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: finished ? '#16a34a' : timeDanger ? '#dc2626' : timeWarning ? '#d97706' : c.accent }} />
            <span className={`text-[20px] font-black tabular-nums tracking-[-0.02em] ${timeDanger ? 'text-[#dc2626]' : timeWarning ? 'text-[#d97706]' : 'text-[#0f172a]'}`}>
              {finished ? '終了' : formatTime(timeLeft)}
            </span>
          </div>
          <span className="text-[12px] font-bold text-[#94a3b8]">{numQ}問</span>
        </div>
        {/* タイマーバー */}
        {!finished && (
          <div className="w-full h-1.5 bg-[#f1f5f9] rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-1000 ease-linear"
                 style={{ width: `${pct}%`, background: timeDanger ? '#dc2626' : timeWarning ? '#d97706' : c.accent }} />
          </div>
        )}
        {finished && (
          <div className="text-center">
            <p className="text-[12px] font-bold text-[#16a34a]">試験終了 — 各問題を自己採点してください</p>
          </div>
        )}
      </div>

      {/* 問題一覧 */}
      <div className="space-y-5 mt-6">
        {problems.map((problem, idx) => {
          const stem = problem?.stem || problem?.text || problem?.question || '';
          const topic = problem?.topic || problem?.metadata?.field || '';
          const scored = examScores[idx];
          // subproblems 対応
          const subproblems = (() => {
            const subs = problem?.subproblems;
            if (Array.isArray(subs) && subs.length > 0) return subs;
            const a = problem?.answer || problem?.solution || '';
            const e = problem?.explanation || problem?.解説 || '';
            if (a || e) return [{ label: '', question: '', answer: a, explanation: e }];
            return [];
          })();

          return (
            <div key={idx} className="bg-white rounded-2xl border border-[#e2e8f0] overflow-hidden shadow-sm transition-all duration-300"
                 style={scored ? { borderColor: scored === SCORE.CORRECT ? '#86efac' : scored === SCORE.WRONG ? '#fca5a5' : '#fcd34d' } : {}}>
              {/* 問題ヘッダー */}
              <div className="flex items-center gap-2 px-5 pt-4 pb-2">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[12px] font-black text-white"
                     style={{ background: c.accent }}>
                  {idx + 1}
                </div>
                {topic && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{ background: c.accent + '14', color: c.accent }}>
                    {topic}
                  </span>
                )}
                {scored && (
                  <span className="ml-auto text-[18px]">
                    {scored === SCORE.CORRECT ? '○' : scored === SCORE.WRONG ? '×' : '△'}
                  </span>
                )}
              </div>

              {/* 問題文 + 小問 */}
              <div className="px-5 pb-4 space-y-2">
                {stem && <LatexBlock className="text-[13px] leading-[1.9] text-[#1e293b]">{stem}</LatexBlock>}
                {subproblems.length > 1 && (
                  <div className="space-y-1 border-t pt-2" style={{ borderColor: c.accent + '22' }}>
                    {subproblems.map((sp, si) => sp.question ? (
                      <div key={si} className="flex gap-1.5">
                        {sp.label && <span className="text-[12px] font-black shrink-0" style={{ color: c.accent }}>{sp.label}</span>}
                        <LatexBlock className="text-[12px] leading-[1.8] text-[#334155]">{sp.question}</LatexBlock>
                      </div>
                    ) : null)}
                  </div>
                )}
              </div>

              {/* 解答（試験終了後） */}
              {finished && (
                <div className="border-t border-[#f1f5f9] px-5 py-4 bg-[#fafbff] space-y-3">
                  {subproblems.map((sp, si) => (
                    <div key={si}>
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-4 h-4 rounded flex items-center justify-center text-[9px] font-black text-white"
                             style={{ background: c.accent }}>A</div>
                        <span className="text-[10px] font-bold" style={{ color: c.accent }}>
                          {sp.label ? `解答 ${sp.label}` : '解答'}
                        </span>
                      </div>
                      {sp.answer && <LatexBlock className="text-[13px] leading-[1.8] text-[#1e293b] font-semibold">{sp.answer}</LatexBlock>}
                      {sp.explanation && (
                        <details className="mt-1">
                          <summary className="text-[10px] font-bold text-[#6366f1] cursor-pointer select-none hover:underline">
                            解説を見る
                          </summary>
                          <div className="mt-1.5 pl-2 border-l-2 border-[#e8eeff]">
                            <LatexBlock className="text-[11px] leading-[1.75] text-[#475569]">{sp.explanation}</LatexBlock>
                          </div>
                        </details>
                      )}
                    </div>
                  ))}
                  {/* 自己採点ボタン */}
                  <div className="flex gap-2 mt-3">
                    {[SCORE.CORRECT, SCORE.DELTA, SCORE.WRONG].map((sc) => {
                      const map = {
                        [SCORE.CORRECT]: { label: '○', bg: '#f0fdf4', border: '#86efac', text: '#16a34a', activeBg: '#16a34a' },
                        [SCORE.DELTA]:   { label: '△', bg: '#fffbeb', border: '#fcd34d', text: '#d97706', activeBg: '#d97706' },
                        [SCORE.WRONG]:   { label: '×', bg: '#fef2f2', border: '#fca5a5', text: '#dc2626', activeBg: '#dc2626' },
                      };
                      const m = map[sc];
                      const active = scored === sc;
                      return (
                        <button key={sc} type="button" onClick={() => handleScoreChange(idx, sc)}
                          className="flex-1 py-2.5 rounded-xl border-2 font-black text-[16px] transition-all duration-200 active:scale-[0.93]"
                          style={{
                            background: active ? m.activeBg : m.bg,
                            borderColor: active ? m.activeBg : m.border,
                            color: active ? 'white' : m.text
                          }}>
                          {m.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 下部ボタン */}
      <div className="mt-8 space-y-3">
        {!finished ? (
          <button type="button" onClick={handleFinishExam}
            className="w-full py-4 rounded-2xl text-[15px] font-black text-white shadow-xl transition-all duration-250 active:scale-[0.97]"
            style={{ background: 'linear-gradient(135deg, #1e293b, #334155)' }}>
            解き終わった → 解答を見る
          </button>
        ) : (
          <button type="button" onClick={handleSubmitScores} disabled={!allScored}
            className="w-full py-4 rounded-2xl text-[15px] font-black text-white shadow-xl transition-all duration-250 active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: `linear-gradient(135deg, ${c.accent}, ${c.accent}bb)`, boxShadow: `0 8px 24px ${c.ring}` }}>
            {allScored ? '結果を見る →' : `全問採点してください（残り${numQ - Object.keys(examScores).length}問）`}
          </button>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   サマリー画面 E
───────────────────────────────────────────────────────────── */

function SummaryScreen({ scores, problems, subject, onRetry, onRestart, latexForPdf, onDownloadPdf, pdfLoading }) {
  const c = SUBJECT_COLOR[subject] || SUBJECT_COLOR['物理'];
  const correct = scores.filter((s) => s === SCORE.CORRECT).length;
  const delta   = scores.filter((s) => s === SCORE.DELTA).length;
  const wrong   = scores.filter((s) => s === SCORE.WRONG).length;
  const total   = scores.length;
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;

  // 弱点単元を抽出
  const weakTopics = problems
    .filter((_, i) => scores[i] === SCORE.WRONG)
    .map((p) => p?.topic || p?.metadata?.field)
    .filter(Boolean)
    .filter((v, i, a) => a.indexOf(v) === i);

  const emoji = correct === total ? '🎯' : correct > total / 2 ? '💪' : '📖';
  const message = correct === total ? 'パーフェクト！' : correct > total / 2 ? 'いい調子！' : '復習しよう！';

  return (
    <div className="max-w-[480px] mx-auto px-5 pt-10 pb-20">
      {/* ヘッダー */}
      <div className="text-center mb-8">
        <div className="text-[44px] mb-2">{emoji}</div>
        <h2 className="text-[24px] font-black text-[#0f172a] tracking-[-0.03em]">{message}</h2>
        <p className="text-[13px] text-[#64748b] mt-1.5">{total}問中 {correct}問正解</p>
      </div>

      {/* 正答率 円グラフ風 */}
      <div className="flex justify-center mb-8">
        <div className="relative w-28 h-28">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
            <circle cx="18" cy="18" r="15.9" fill="none" stroke="#f1f5f9" strokeWidth="3" />
            <circle cx="18" cy="18" r="15.9" fill="none" stroke={c.accent} strokeWidth="3"
              strokeDasharray={`${pct} ${100 - pct}`}
              strokeLinecap="round"
              className="transition-all duration-1000 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[28px] font-black tracking-[-0.03em]" style={{ color: c.accent }}>{pct}</span>
            <span className="text-[10px] font-bold text-[#94a3b8] -mt-0.5">%</span>
          </div>
        </div>
      </div>

      {/* スコアカード */}
      <div className="grid grid-cols-3 gap-3 mb-7">
        <div className="bg-[#f0fdf4] rounded-2xl border border-[#86efac]/60 p-4 text-center transition-all hover:shadow-sm">
          <div className="text-[30px] font-black text-[#16a34a]">{correct}</div>
          <div className="text-[11px] font-bold text-[#16a34a] mt-0.5">○ 解けた</div>
        </div>
        <div className="bg-[#fffbeb] rounded-2xl border border-[#fcd34d]/60 p-4 text-center transition-all hover:shadow-sm">
          <div className="text-[30px] font-black text-[#d97706]">{delta}</div>
          <div className="text-[11px] font-bold text-[#d97706] mt-0.5">△ 惜しい</div>
        </div>
        <div className="bg-[#fef2f2] rounded-2xl border border-[#fca5a5]/60 p-4 text-center transition-all hover:shadow-sm">
          <div className="text-[30px] font-black text-[#dc2626]">{wrong}</div>
          <div className="text-[11px] font-bold text-[#dc2626] mt-0.5">× わからない</div>
        </div>
      </div>

      {/* 弱点単元 */}
      {weakTopics.length > 0 && (
        <div className="bg-gradient-to-br from-[#fef2f2] to-[#fff7ed] rounded-2xl border border-[#fca5a5]/40 p-5 mb-7">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[14px]">🔍</span>
            <span className="text-[12px] font-bold text-[#dc2626] tracking-[0.04em]">復習候補</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {weakTopics.map((t) => (
              <span key={t} className="text-[12px] font-semibold px-3 py-1.5 rounded-full bg-white text-[#dc2626] border border-[#fca5a5]/50 shadow-sm">
                {t}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* アクション */}
      <div className="space-y-3">
        {latexForPdf && (
          <button
            type="button"
            onClick={onDownloadPdf}
            disabled={pdfLoading}
            className="w-full py-4 rounded-2xl text-[15px] font-black text-white shadow-lg transition-all duration-250 active:scale-[0.97] disabled:opacity-60 flex items-center justify-center gap-2.5 hover:shadow-xl"
            style={{ background: 'linear-gradient(135deg, #1e293b, #334155)' }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            {pdfLoading ? 'PDF生成中…' : 'PDFでダウンロード'}
          </button>
        )}
        <button
          type="button"
          onClick={onRetry}
          className="w-full py-4 rounded-2xl text-[15px] font-black text-white shadow-xl transition-all duration-250 active:scale-[0.97] hover:shadow-2xl"
          style={{ background: `linear-gradient(135deg, ${c.accent}, ${c.accent}bb)`, boxShadow: `0 8px 24px ${c.ring}` }}
        >
          続けてもう一周 →
        </button>
        <button type="button" onClick={onRestart} className="w-full py-3 text-[13px] text-[#94a3b8] hover:text-[#475569] transition-colors duration-200">
          単元を変えて練習する
        </button>
      </div>

      <MobileNavLinks currentPath="/practice" />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   メインページ
───────────────────────────────────────────────────────────── */

export default function PracticePage() {
  const { user, isAuthenticated, isGuest } = useAuth();
  const [screen, setScreen]     = useState(SCREEN.SELECT);
  const [config, setConfig]     = useState(null);   // { subject, topics, difficulty, numQ, genMode }
  const [problems, setProblems] = useState([]);
  const [current, setCurrent]   = useState(0);
  const [scores, setScores]     = useState([]);
  const [showAnswer, setShowAnswer] = useState(false);
  const [error, setError]       = useState('');
  const [loadingStep, setLoadingStep] = useState(0);
  const [latexForPdf, setLatexForPdf] = useState(null);
  const [pdfLoading, setPdfLoading]   = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [manualPrompt, setManualPrompt] = useState('');
  const [promptLoading, setPromptLoading] = useState(false);
  // × 後のフォローアップ用に追加問題をキューに積む
  const extraQueue = useRef([]);

  /* ── AI問題生成 ── */
  const fetchProblemsAI = useCallback(async (cfg) => {
    const { subject, topics, difficulty, numQ } = cfg;
    setScreen(SCREEN.LOADING);
    setLoadingStep(0);
    setError('');
    setLatexForPdf(null);

    // ステップアニメーション
    const t1 = setTimeout(() => setLoadingStep(1), 2000);
    const t2 = setTimeout(() => setLoadingStep(2), 8000);

    try {
      const result = await practiceGenerate({
        subject,
        topics: topics.length > 0 ? topics : undefined,
        difficulty,
        num_questions: numQ,
        user_id: user?.id,
      });

      clearTimeout(t1);
      clearTimeout(t2);

      if (!result || result.status === 'error') {
        setError(result?.error || 'AI生成に失敗しました。もう一度お試しください。');
        setScreen(SCREEN.SELECT);
        return;
      }

      const items = result.problems || [];
      if (items.length === 0) {
        setError('AIが問題を生成できませんでした。条件を変えて試してください。');
        setScreen(SCREEN.SELECT);
        return;
      }

      setProblems(items);
      setLatexForPdf(result.latex || null);
      setCurrent(0);
      setScores([]);
      setShowAnswer(false);
      extraQueue.current = [];
      setScreen(cfg?.practiceFormat === PRACTICE_FORMAT.EXAM ? SCREEN.EXAM : SCREEN.PROBLEM);
    } catch (e) {
      clearTimeout(t1);
      clearTimeout(t2);
      setError(`AI生成に失敗しました: ${e.message}`);
      setScreen(SCREEN.SELECT);
    }
  }, [user]);

  /* ── 手動モード: プロンプト生成 ── */
  const fetchManualPrompt = useCallback(async ({ subject, topics, difficulty, numQ }) => {
    setPromptLoading(true);
    setScreen(SCREEN.PROMPT);
    setError('');
    setLatexForPdf(null);
    try {
      const result = await practiceRenderPrompt({
        subject,
        topics: topics.length > 0 ? topics : undefined,
        difficulty,
        num_questions: numQ,
      });
      setManualPrompt(result?.prompt || '');
      // 自動コピー
      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(result?.prompt || '');
        }
      } catch {}
    } catch (e) {
      setError(`プロンプト生成に失敗しました: ${e.message}`);
      setScreen(SCREEN.SELECT);
    }
    setPromptLoading(false);
  }, []);

  /* ── 手動モード: JSON貼り付け → 問題開始 ── */
  const handleManualParsed = useCallback((parsedProblems, latex) => {
    setProblems(parsedProblems);
    setLatexForPdf(latex);
    setCurrent(0);
    setScores([]);
    setShowAnswer(false);
    extraQueue.current = [];
    setScreen(config?.practiceFormat === PRACTICE_FORMAT.EXAM ? SCREEN.EXAM : SCREEN.PROBLEM);
  }, [config]);

  /* ── 開始 ── */
  const handleStart = useCallback((cfg) => {
    setConfig(cfg);
    if (cfg.genMode === GEN_MODE.AUTO) {
      fetchProblemsAI(cfg);
    } else {
      fetchManualPrompt(cfg);
    }
  }, [fetchProblemsAI, fetchManualPrompt]);

  /* ── 解答表示 ── */
  const handleShowAnswer = useCallback(() => setShowAnswer(true), []);

  /* ── 次へ進む共通ロジック ── */
  const advanceToNext = useCallback(() => {
    const next = current + 1;
    if (next >= problems.length && extraQueue.current.length === 0) {
      setScreen(SCREEN.SUMMARY);
    } else {
      if (next < problems.length) {
        setCurrent(next);
      } else {
        const extra = extraQueue.current.shift();
        setProblems((prev) => [...prev, extra]);
        setCurrent(next);
      }
      setShowAnswer(false);
      setScreen(SCREEN.PROBLEM);
    }
  }, [current, problems]);

  /* ── 自己採点 ── */
  const handleScore = useCallback((score) => {
    setScores((prev) => [...prev, score]);

    if (score === SCORE.WRONG) {
      setScreen(SCREEN.FOLLOW);
      return;
    }

    advanceToNext();
  }, [advanceToNext]);

  /* ── スキップ（△扱い） ── */
  const handleSkip = useCallback(() => {
    setScores((prev) => [...prev, SCORE.DELTA]);
    advanceToNext();
  }, [advanceToNext]);

  /* ── 途中終了 ── */
  const handleQuit = useCallback(() => {
    if (scores.length > 0) {
      setScreen(SCREEN.SUMMARY);
    } else {
      setScreen(SCREEN.SELECT);
      setProblems([]);
      setScores([]);
      setCurrent(0);
      setShowAnswer(false);
    }
  }, [scores]);

  /* ── 模試形式: 全問採点完了 ── */
  const handleExamFinish = useCallback((scoreArray) => {
    setScores(scoreArray);
    setScreen(SCREEN.SUMMARY);
  }, []);

  /* ── フォロー: 同じ単元をもう1問 ── */
  const handleFollowContinue = useCallback(async () => {
    setFollowLoading(true);
    const cur = problems[current];
    const topic = cur?.topic || cur?.metadata?.field;
    try {
      const params = { subject: config.subject, limit: 5 };
      if (topic) params.topic = topic;
      const data = await searchProblems(params);
      const items = data?.results || data?.problems || (Array.isArray(data) ? data : []);
      const used = new Set(problems.map((p) => p?.id).filter(Boolean));
      const fresh = items.filter((p) => !used.has(p?.id));
      if (fresh.length > 0) {
        extraQueue.current.push(fresh[0]);
      }
    } catch { /* エラーでも続行 */ }
    setFollowLoading(false);
    advanceToNext();
  }, [problems, current, config, advanceToNext]);

  /* ── フォロー: スキップ ── */
  const handleFollowSkip = useCallback(() => {
    advanceToNext();
  }, [advanceToNext]);

  /* ── PDFダウンロード ── */
  const handleDownloadPdf = useCallback(async () => {
    if (!latexForPdf) return;
    setPdfLoading(true);
    try {
      const resp = await generatePdf(latexForPdf);
      if (resp?.pdf_url) {
        window.open(resp.pdf_url, '_blank');
      } else if (resp?.url) {
        window.open(resp.url, '_blank');
      }
    } catch (e) {
      console.error('PDF生成エラー:', e);
    }
    setPdfLoading(false);
  }, [latexForPdf]);

  /* ── リトライ（同じ設定で再取得） ── */
  const handleRetry = useCallback(() => {
    if (config) handleStart(config);
  }, [config, handleStart]);

  /* ── リスタート（選択画面へ） ── */
  const handleRestart = useCallback(() => {
    setScreen(SCREEN.SELECT);
    setProblems([]);
    setScores([]);
    setCurrent(0);
    setShowAnswer(false);
    setLatexForPdf(null);
    setManualPrompt('');
  }, []);

  /* ── レンダー ── */
  const subject = config?.subject || '物理';
  const genMode = config?.genMode || GEN_MODE.MANUAL;

  if (screen === SCREEN.SELECT) {
    return (
      <>
        {error && (
          <div className="max-w-[480px] mx-auto px-5 pt-4">
            <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3.5 text-[12px] text-red-700 font-medium flex items-start gap-2.5 shadow-sm">
              <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              {error}
            </div>
          </div>
        )}
        <SelectScreen onStart={handleStart} isAuthenticated={isAuthenticated} isGuest={isGuest} />
      </>
    );
  }

  if (screen === SCREEN.LOADING) return <LoadingScreen subject={subject} genMode={genMode} loadingStep={loadingStep} />;

  if (screen === SCREEN.PROMPT) {
    return (
      <PromptScreen
        prompt={manualPrompt}
        subject={subject}
        difficulty={config?.difficulty}
        onParsed={handleManualParsed}
        onBack={handleRestart}
        promptLoading={promptLoading}
      />
    );
  }

  if (screen === SCREEN.PROBLEM || screen === SCREEN.ANSWER) {
    return (
      <ProblemScreen
        problem={problems[current]}
        index={current}
        total={problems.length}
        subject={subject}
        showAnswer={showAnswer}
        onShowAnswer={handleShowAnswer}
        onScore={handleScore}
        onSkip={handleSkip}
        onQuit={handleQuit}
      />
    );
  }

  if (screen === SCREEN.FOLLOW) {
    return (
      <FollowScreen
        problem={problems[current]}
        subject={subject}
        onContinue={handleFollowContinue}
        onSkip={handleFollowSkip}
        isLoading={followLoading}
      />
    );
  }

  if (screen === SCREEN.EXAM) {
    return (
      <ExamScreen
        problems={problems}
        subject={subject}
        onFinish={handleExamFinish}
        onQuit={handleQuit}
      />
    );
  }

  if (screen === SCREEN.SUMMARY) {
    return (
      <SummaryScreen
        scores={scores}
        problems={problems}
        subject={subject}
        onRetry={handleRetry}
        onRestart={handleRestart}
        latexForPdf={latexForPdf}
        onDownloadPdf={handleDownloadPdf}
        pdfLoading={pdfLoading}
      />
    );
  }

  return null;
}
