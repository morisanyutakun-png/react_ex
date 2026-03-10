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

const SCREEN = { SELECT: 'select', LOADING: 'loading', PROMPT: 'prompt', PROBLEM: 'problem', ANSWER: 'answer', FOLLOW: 'follow', SUMMARY: 'summary' };

const PRACTICE_SUBJECTS = ['物理', '数学', '化学'];

const SUBJECT_COLOR = {
  '物理': { accent: '#8b5cf6', light: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200', gradient: 'from-violet-500 to-violet-600', ring: '#8b5cf620', glow: 'rgba(139,92,246,0.15)' },
  '数学': { accent: '#3b82f6', light: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-200',   gradient: 'from-blue-500 to-blue-600',   ring: '#3b82f620', glow: 'rgba(59,130,246,0.15)' },
  '化学': { accent: '#10b981', light: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', gradient: 'from-emerald-500 to-emerald-600', ring: '#10b98120', glow: 'rgba(16,185,129,0.15)' },
};

// 難易度を受験生の言語で表現
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

/* ─────────────────────────────────────────────────────────────
   小コンポーネント
───────────────────────────────────────────────────────────── */

function SubjectTab({ subject, selected, onClick }) {
  const c = SUBJECT_COLOR[subject];
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-5 py-2 rounded-full text-[13px] font-bold transition-all duration-200 border
        ${selected
          ? 'text-white border-transparent shadow-md'
          : 'bg-white text-[#64748b] border-[#e2e8f0] hover:border-[#cbd5e1]'
        }`}
      style={selected ? { background: `linear-gradient(135deg, var(--from), var(--to))`, '--from': c.accent, '--to': c.accent + 'cc', boxShadow: `0 4px 14px ${c.ring}` } : {}}
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
      className={`px-3.5 py-1.5 rounded-xl text-[12px] font-semibold transition-all duration-200 border
        ${selected
          ? 'text-white border-transparent'
          : 'bg-white text-[#64748b] border-[#e2e8f0] hover:border-[#cbd5e1]'
        }`}
      style={selected ? { backgroundColor: accent, borderColor: 'transparent' } : {}}
    >
      {label}
    </button>
  );
}

function ProgressBar({ current, total, accent }) {
  const pct = total > 0 ? (current / total) * 100 : 0;
  return (
    <div className="w-full h-1.5 bg-[#f1f5f9] rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${accent || '#8b5cf6'}, ${accent || '#6366f1'}cc)` }}
      />
    </div>
  );
}

function ScoreButton({ type, onClick }) {
  const map = {
    [SCORE.CORRECT]: { label: '解けた', icon: '○', bg: '#f0fdf4', border: '#86efac', text: '#16a34a' },
    [SCORE.DELTA]:   { label: '惜しい', icon: '△', bg: '#fffbeb', border: '#fcd34d', text: '#d97706' },
    [SCORE.WRONG]:   { label: 'わからない', icon: '×', bg: '#fef2f2', border: '#fca5a5', text: '#dc2626' },
  };
  const s = map[type];
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex-1 flex flex-col items-center gap-1.5 py-4 rounded-2xl border-2 font-bold transition-all duration-150 active:scale-95"
      style={{ background: s.bg, borderColor: s.border, color: s.text }}
    >
      <span className="text-[24px] leading-none">{s.icon}</span>
      <span className="text-[11px]">{s.label}</span>
    </button>
  );
}

function BackButton({ onClick, label = '終了' }) {
  return (
    <button type="button" onClick={onClick} className="flex items-center gap-1 text-[13px] text-[#94a3b8] hover:text-[#64748b] transition-colors">
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
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

  const c = SUBJECT_COLOR[subject];
  const topicOptions = SUBJECT_TOPICS[subject] || [];

  const toggleTopic = (t) =>
    setTopics((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]);

  const handleStart = () => {
    onStart({ subject, topics, difficulty, numQ, genMode });
  };

  return (
    <div className="max-w-[480px] mx-auto px-5 pt-8 pb-20">

      {/* ヘッダー */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
               style={{ background: `linear-gradient(135deg, ${c.accent}, ${c.accent}cc)` }}>
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342" />
            </svg>
          </div>
          <div>
            <h1 className="text-[22px] font-black text-[#0f172a] tracking-[-0.03em] leading-tight">
              今日は何を練習する？
            </h1>
            <p className="text-[12px] text-[#94a3b8] mt-0.5">選んだらすぐ問題が出てくる</p>
          </div>
        </div>
      </div>

      {/* 生成モード切替 */}
      <div className="mb-6">
        <div className="text-[11px] font-bold text-[#94a3b8] tracking-[0.08em] uppercase mb-2.5">生成モード</div>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => !isGuest && setGenMode(GEN_MODE.AUTO)}
            disabled={isGuest}
            className={`text-left p-3.5 rounded-2xl border-2 transition-all duration-200
              ${genMode === GEN_MODE.AUTO ? 'border-[#2563eb] bg-blue-50/40' : 'border-[#e2e8f0] bg-white hover:border-[#cbd5e1]'}
              ${isGuest ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <div className="flex items-start gap-2.5">
              <div className={`flex items-center justify-center w-9 h-9 rounded-xl flex-shrink-0 transition-all duration-200 ${
                genMode === GEN_MODE.AUTO ? 'bg-[#2563eb] text-white shadow-md' : 'bg-blue-50/60 text-[#64748b]'
              }`}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-bold text-[#1e293b]">AI 自動生成</div>
                <div className="text-[10px] text-[#64748b] mt-0.5 leading-snug">ワンクリックで問題を自動作成</div>
                {isGuest && (
                  <div className="text-[10px] text-amber-600 mt-1 flex items-center gap-1">
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
            className={`text-left p-3.5 rounded-2xl border-2 transition-all duration-200
              ${genMode === GEN_MODE.MANUAL ? 'border-[#2563eb] bg-blue-50/40' : 'border-[#e2e8f0] bg-white hover:border-[#cbd5e1]'}`}
          >
            <div className="flex items-start gap-2.5">
              <div className={`flex items-center justify-center w-9 h-9 rounded-xl flex-shrink-0 transition-all duration-200 ${
                genMode === GEN_MODE.MANUAL ? 'bg-[#2563eb] text-white shadow-md' : 'bg-blue-50/60 text-[#64748b]'
              }`}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
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

      {/* 科目タブ */}
      <div className="mb-6">
        <div className="text-[11px] font-bold text-[#94a3b8] tracking-[0.08em] uppercase mb-2.5">科目</div>
        <div className="flex gap-2">
          {PRACTICE_SUBJECTS.map((s) => (
            <SubjectTab key={s} subject={s} selected={subject === s} onClick={() => { setSubject(s); setTopics([]); }} />
          ))}
        </div>
      </div>

      {/* 単元選択（複数可） */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2.5">
          <div className="text-[11px] font-bold text-[#94a3b8] tracking-[0.08em] uppercase">単元</div>
          {topics.length > 0 && (
            <button type="button" onClick={() => setTopics([])} className="text-[11px] text-[#94a3b8] hover:text-[#64748b]">すべて解除</button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {topicOptions.map((t) => (
            <TopicChip key={t} label={t} selected={topics.includes(t)} onClick={() => toggleTopic(t)} accent={c.accent} />
          ))}
        </div>
        {topics.length === 0 && (
          <p className="text-[11px] text-[#94a3b8] mt-2">選択なし = 全単元からランダム出題</p>
        )}
      </div>

      {/* 難易度 */}
      <div className="mb-8">
        <div className="text-[11px] font-bold text-[#94a3b8] tracking-[0.08em] uppercase mb-2.5">難易度</div>
        <div className="grid grid-cols-3 gap-2">
          {EXAM_LEVELS.map((lv) => {
            const sel = difficulty === lv.value;
            return (
              <button
                key={lv.value}
                type="button"
                onClick={() => setDifficulty(lv.value)}
                className={`px-3 py-2.5 rounded-xl border text-left transition-all duration-200
                  ${sel ? 'border-transparent text-white' : 'bg-white border-[#e2e8f0] hover:border-[#cbd5e1]'}`}
                style={sel ? { background: `linear-gradient(135deg, ${c.accent}, ${c.accent}cc)` } : {}}
              >
                <div className={`text-[12px] font-bold ${sel ? 'text-white' : 'text-[#1e293b]'}`}>{lv.label}</div>
                <div className={`text-[10px] mt-0.5 ${sel ? 'text-white/70' : 'text-[#94a3b8]'}`}>{lv.sub}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 問題数 */}
      <div className="mb-8">
        <div className="text-[11px] font-bold text-[#94a3b8] tracking-[0.08em] uppercase mb-2.5">問題数</div>
        <div className="flex gap-2">
          {[3, 5, 10].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setNumQ(n)}
              className={`flex-1 py-2.5 rounded-xl border text-[13px] font-bold transition-all duration-200
                ${numQ === n ? 'text-white border-transparent' : 'bg-white text-[#64748b] border-[#e2e8f0] hover:border-[#cbd5e1]'}`}
              style={numQ === n ? { background: `linear-gradient(135deg, ${c.accent}, ${c.accent}cc)` } : {}}
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
        className="w-full py-4 rounded-2xl text-[16px] font-black text-white tracking-[-0.01em] shadow-lg transition-all duration-200 active:scale-[0.98]"
        style={{ background: `linear-gradient(135deg, ${c.accent}, ${c.accent}cc)`, boxShadow: `0 8px 24px ${c.ring}` }}
      >
        練習を始める →
      </button>

      <p className="text-center text-[11px] text-[#94a3b8] mt-3">
        {genMode === GEN_MODE.AUTO ? 'AIが問題を生成します（作るモードと同じアルゴリズム）' : 'プロンプトを生成 → ChatGPT等で実行 → 貼り付け'}
      </p>

      {/* 詳細モードへの導線 */}
      <div className="mt-8 pt-6 border-t border-[#f1f5f9]">
        <Link href="/user" className="flex items-center justify-center gap-2 text-[12px] text-[#94a3b8] hover:text-[#64748b] transition-colors">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
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

function PromptScreen({ prompt, subject, onParsed, onBack, promptLoading }) {
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
      const result = await practiceParseJson(pasteText, subject);
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
      <div className="max-w-[480px] mx-auto px-5 pt-20 flex flex-col items-center gap-6">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-[28px] animate-pulse"
             style={{ background: c.glow }}>
          🧠
        </div>
        <p className="text-[16px] font-bold text-[#1e293b]">プロンプトを生成中…</p>
      </div>
    );
  }

  return (
    <div className="max-w-[480px] mx-auto px-5 pt-8 pb-20">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-6">
        <BackButton onClick={onBack} label="戻る" />
        <span className="text-[12px] font-bold text-[#94a3b8]">手動モード</span>
      </div>

      {/* ステップ1: プロンプトコピー */}
      <div className="bg-white rounded-2xl border border-[#e2e8f0] overflow-hidden mb-6 shadow-sm">
        <div className="p-4 border-b border-[#f1f5f9] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black text-white"
                 style={{ background: c.accent }}>1</div>
            <span className="text-[13px] font-bold text-[#1e293b]">指示文をコピー</span>
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all duration-200 border"
            style={copied
              ? { background: '#f0fdf4', borderColor: '#86efac', color: '#16a34a' }
              : { background: '#f8fafc', borderColor: '#e2e8f0', color: '#64748b' }}
          >
            {copied ? (
              <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>コピー済み</>
            ) : (
              <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" /></svg>コピー</>
            )}
          </button>
        </div>
        <div className="p-4 max-h-[200px] overflow-y-auto">
          <pre className="text-[11px] leading-[1.6] text-[#475569] whitespace-pre-wrap font-mono break-all">{prompt}</pre>
        </div>
        <div className="px-4 pb-4">
          <p className="text-[11px] text-[#94a3b8]">↑ これを ChatGPT や Claude に貼り付けて実行してください</p>
        </div>
      </div>

      {/* ステップ2: AIの出力を貼り付け */}
      <div className="bg-white rounded-2xl border border-[#e2e8f0] overflow-hidden shadow-sm">
        <div className="p-4 border-b border-[#f1f5f9]">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black text-white"
                 style={{ background: c.accent }}>2</div>
            <span className="text-[13px] font-bold text-[#1e293b]">AIの出力を貼り付け</span>
          </div>
          <p className="text-[11px] text-[#94a3b8] mt-1 ml-8">AIから返ってきたJSON出力をそのまま貼り付けてください</p>
        </div>
        <div className="p-4">
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            rows={8}
            className="w-full rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-4 py-3 text-[12px] font-mono text-[#1e293b] placeholder:text-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-offset-1 resize-none"
            style={{ focusRingColor: c.accent }}
            placeholder='{&#10;  &quot;problems&quot;: [&#10;    { &quot;stem&quot;: &quot;...&quot;, &quot;answer&quot;: &quot;...&quot;, ... }&#10;  ]&#10;}'
          />

          {parseError && (
            <div className="mt-3 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-[11px] text-red-700 font-medium">
              {parseError}
            </div>
          )}

          <button
            type="button"
            onClick={handleParse}
            disabled={!pasteText.trim() || parsing}
            className="w-full mt-4 py-3.5 rounded-2xl text-[14px] font-black text-white shadow-lg transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: `linear-gradient(135deg, ${c.accent}, ${c.accent}cc)` }}
          >
            {parsing ? 'パース中…' : '問題を読み込んで練習開始 →'}
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
        { label: 'プロンプトを構築中…', icon: '🧠' },
        { label: 'AIが問題を生成中…',   icon: '✨' },
        { label: '仕上げ中…',           icon: '📝' },
      ]
    : [{ label: 'DBから問題を取得中…', icon: '🔍' }];

  const activeStep = Math.min(loadingStep || 0, steps.length - 1);

  return (
    <div className="max-w-[480px] mx-auto px-5 pt-20 flex flex-col items-center gap-6">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-[28px] animate-pulse"
           style={{ background: c.glow }}>
        {steps[activeStep].icon}
      </div>
      <div className="text-center">
        <p className="text-[16px] font-bold text-[#1e293b]">{steps[activeStep].label}</p>
        {isAI && (
          <div className="flex items-center justify-center gap-2 mt-4">
            {steps.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <div
                  className={`w-2.5 h-2.5 rounded-full transition-all duration-500 ${i <= activeStep ? '' : 'opacity-30'}`}
                  style={{ backgroundColor: i <= activeStep ? c.accent : '#cbd5e1' }}
                />
                {i < steps.length - 1 && (
                  <div className={`w-8 h-0.5 rounded transition-all duration-500 ${i < activeStep ? '' : 'opacity-30'}`}
                       style={{ backgroundColor: i < activeStep ? c.accent : '#cbd5e1' }} />
                )}
              </div>
            ))}
          </div>
        )}
        <p className="text-[11px] text-[#94a3b8] mt-3">
          {isAI ? '教員モードと同じアルゴリズムで生成しています' : '最適な問題を選んでいます'}
        </p>
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
  const answer = problem?.answer || problem?.solution || '';
  const explanation = problem?.explanation || problem?.解説 || '';
  const topic = problem?.topic || problem?.metadata?.field || '';
  const diffLabel = EXAM_LEVELS.find((l) => l.value === (problem?.difficulty || problem?.metadata?.difficulty))?.label || '';

  return (
    <div className="max-w-[480px] mx-auto px-5 pt-8 pb-16">

      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-4">
        <BackButton onClick={onQuit} label="終了" />
        <span className="text-[12px] font-bold text-[#94a3b8]">
          {index + 1} / {total}
        </span>
      </div>

      {/* プログレス */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {topic && (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: c.accent + '18', color: c.accent }}>
                {topic}
              </span>
            )}
            {diffLabel && (
              <span className="text-[11px] text-[#94a3b8] font-medium">{diffLabel}</span>
            )}
          </div>
        </div>
        <ProgressBar current={index + (showAnswer ? 1 : 0.5)} total={total} accent={c.accent} />
      </div>

      {/* 問題本文 */}
      <div className={`bg-white rounded-2xl border border-[#e2e8f0] p-5 mb-5 shadow-sm transition-opacity duration-300 ${showAnswer ? 'opacity-60' : ''}`}>
        <div className="text-[11px] font-bold text-[#94a3b8] tracking-[0.06em] uppercase mb-3">問題</div>
        {stem ? (
          <LatexBlock className="text-[14px] leading-[1.9] text-[#1e293b]">{stem}</LatexBlock>
        ) : (
          <p className="text-[13px] text-[#94a3b8]">問題文を読み込めませんでした</p>
        )}
      </div>

      {/* 解答エリア */}
      {!showAnswer ? (
        <>
          <button
            type="button"
            onClick={onShowAnswer}
            className="w-full py-4 rounded-2xl text-[15px] font-black text-white shadow-lg mb-3 transition-all duration-200 active:scale-[0.98]"
            style={{ background: `linear-gradient(135deg, ${c.accent}, ${c.accent}cc)` }}
          >
            答えを見る
          </button>
          <p className="text-center text-[11px] text-[#94a3b8]">先に自分で解いてみてから確認しよう</p>
        </>
      ) : (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          {/* 解答 */}
          <div className="bg-white rounded-2xl border border-[#e2e8f0] p-5 mb-3 shadow-sm">
            <div className="text-[11px] font-bold tracking-[0.06em] uppercase mb-3" style={{ color: c.accent }}>解答</div>
            {answer ? (
              <LatexBlock className="text-[14px] leading-[1.9] text-[#1e293b]">{answer}</LatexBlock>
            ) : (
              <p className="text-[13px] text-[#94a3b8]">解答データなし</p>
            )}
          </div>

          {/* 解説 */}
          {explanation && (
            <div className="bg-[#fafbff] rounded-2xl border border-[#e8eeff] p-5 mb-5 shadow-sm">
              <div className="text-[11px] font-bold text-[#6366f1] tracking-[0.06em] uppercase mb-3">解説</div>
              <LatexBlock className="text-[13px] leading-[1.8] text-[#475569]">{explanation}</LatexBlock>
            </div>
          )}

          {/* 自己採点 */}
          <div className="mb-2">
            <div className="text-[12px] font-bold text-[#1e293b] mb-3 text-center">どうだった？</div>
            <div className="flex gap-2">
              <ScoreButton type={SCORE.CORRECT} onClick={() => onScore(SCORE.CORRECT)} />
              <ScoreButton type={SCORE.DELTA}   onClick={() => onScore(SCORE.DELTA)} />
              <ScoreButton type={SCORE.WRONG}   onClick={() => onScore(SCORE.WRONG)} />
            </div>
          </div>

          {/* スキップ */}
          <button type="button" onClick={() => onSkip && onSkip()} className="w-full py-2 text-[12px] text-[#94a3b8] hover:text-[#64748b] mt-2 transition-colors">
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
    <div className="max-w-[480px] mx-auto px-5 pt-16 pb-16 text-center">
      <div className="w-14 h-14 rounded-full bg-red-50 border-2 border-red-200 flex items-center justify-center mx-auto mb-5">
        <span className="text-[26px]">×</span>
      </div>
      <h2 className="text-[18px] font-black text-[#0f172a] mb-2">{topic}、もう1問やる？</h2>
      <p className="text-[13px] text-[#64748b] mb-8">すぐ復習すると記憶に定着しやすい</p>
      <button
        type="button"
        onClick={onContinue}
        disabled={isLoading}
        className="w-full py-4 rounded-2xl text-[15px] font-black text-white shadow-lg mb-3 transition-all active:scale-[0.98] disabled:opacity-60"
        style={{ background: `linear-gradient(135deg, ${c.accent}, ${c.accent}cc)` }}
      >
        {isLoading ? '取得中…' : '同じ単元をもう1問 →'}
      </button>
      <button type="button" onClick={onSkip} className="w-full py-3 text-[13px] text-[#94a3b8] hover:text-[#64748b] transition-colors">
        次の問題へ進む
      </button>
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

  // 弱点単元を抽出
  const weakTopics = problems
    .filter((_, i) => scores[i] === SCORE.WRONG)
    .map((p) => p?.topic || p?.metadata?.field)
    .filter(Boolean)
    .filter((v, i, a) => a.indexOf(v) === i);

  return (
    <div className="max-w-[480px] mx-auto px-5 pt-10 pb-16">
      <div className="text-center mb-8">
        <div className="text-[36px] mb-3">{correct === total ? '🎯' : correct > total / 2 ? '💪' : '📖'}</div>
        <h2 className="text-[22px] font-black text-[#0f172a] tracking-[-0.02em]">練習完了！</h2>
        <p className="text-[13px] text-[#64748b] mt-1">{total}問 解いた</p>
      </div>

      {/* スコアカード */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-[#f0fdf4] rounded-2xl border border-[#86efac] p-4 text-center">
          <div className="text-[28px] font-black text-[#16a34a]">{correct}</div>
          <div className="text-[11px] font-bold text-[#16a34a] mt-0.5">○ 解けた</div>
        </div>
        <div className="bg-[#fffbeb] rounded-2xl border border-[#fcd34d] p-4 text-center">
          <div className="text-[28px] font-black text-[#d97706]">{delta}</div>
          <div className="text-[11px] font-bold text-[#d97706] mt-0.5">△ 惜しい</div>
        </div>
        <div className="bg-[#fef2f2] rounded-2xl border border-[#fca5a5] p-4 text-center">
          <div className="text-[28px] font-black text-[#dc2626]">{wrong}</div>
          <div className="text-[11px] font-bold text-[#dc2626] mt-0.5">× わからない</div>
        </div>
      </div>

      {/* 弱点単元 */}
      {weakTopics.length > 0 && (
        <div className="bg-[#fef2f2] rounded-2xl border border-[#fca5a5]/60 p-4 mb-6">
          <div className="text-[11px] font-bold text-[#dc2626] tracking-[0.06em] uppercase mb-2">復習候補</div>
          <div className="flex flex-wrap gap-1.5">
            {weakTopics.map((t) => (
              <span key={t} className="text-[12px] font-semibold px-2.5 py-1 rounded-full bg-white text-[#dc2626] border border-[#fca5a5]/60">
                {t}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* アクション */}
      {latexForPdf && (
        <button
          type="button"
          onClick={onDownloadPdf}
          disabled={pdfLoading}
          className="w-full py-4 rounded-2xl text-[15px] font-black text-white shadow-lg mb-3 transition-all active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2"
          style={{ background: 'linear-gradient(135deg, #1e293b, #334155)' }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          {pdfLoading ? 'PDF生成中…' : 'PDFでダウンロード'}
        </button>
      )}
      <button
        type="button"
        onClick={onRetry}
        className="w-full py-4 rounded-2xl text-[15px] font-black text-white shadow-lg mb-3 transition-all active:scale-[0.98]"
        style={{ background: `linear-gradient(135deg, ${c.accent}, ${c.accent}cc)` }}
      >
        続けてもう一周 →
      </button>
      <button type="button" onClick={onRestart} className="w-full py-3 text-[13px] text-[#94a3b8] hover:text-[#64748b] transition-colors">
        単元を変えて練習する
      </button>

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
  const fetchProblemsAI = useCallback(async ({ subject, topics, difficulty, numQ }) => {
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
      setScreen(SCREEN.PROBLEM);
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
    setScreen(SCREEN.PROBLEM);
  }, []);

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
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-[12px] text-red-700 font-medium">
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
