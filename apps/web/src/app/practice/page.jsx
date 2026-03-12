'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import Link from 'next/link';
import { searchProblems, practiceGenerate, practiceRenderPrompt, practiceParseJson, generatePdf } from '@/lib/api';
import { SUBJECT_TOPICS } from '@/lib/constants';
import { LatexBlock } from '@/components/LatexRenderer';
import TikzFigure from '@/components/TikzFigure';
import { MobileNavLinks } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';

/* ─────────────────────────────────────────────────────────────
   定数
───────────────────────────────────────────────────────────── */

const SCREEN = { SELECT: 'select', LOADING: 'loading', PROMPT: 'prompt', PROBLEM: 'problem', ANSWER: 'answer', FOLLOW: 'follow', EXAM: 'exam', SUMMARY: 'summary', PDF: 'pdf' };

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

/* ── 配点からスコア判定を導出するヘルパー ── */
function deriveScoreFromPoints(earned, max) {
  if (max <= 0) return SCORE.DELTA;
  const ratio = earned / max;
  if (ratio >= 0.8) return SCORE.CORRECT;
  if (ratio >= 0.3) return SCORE.DELTA;
  return SCORE.WRONG;
}

/* ── 問題の合計配点を取得 ── */
function getTotalPoints(problem) {
  const subs = problem?.subproblems;
  if (Array.isArray(subs) && subs.length > 0) {
    return subs.reduce((s, sp) => s + (sp.points || 0), 0);
  }
  return 0;
}

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

/* ── 得点入力コンポーネント（自己採点） ── */
function ScoreInput({ subproblems, onSubmit, accent }) {
  const [inputScores, setInputScores] = useState({});
  const totalMax = subproblems.reduce((s, sp) => s + (sp.points || 0), 0);
  const totalEarned = subproblems.reduce((s, sp, i) => s + (Number(inputScores[i]) || 0), 0);
  const allFilled = subproblems.every((_, i) => inputScores[i] !== undefined && inputScores[i] !== '');

  const handleChange = (idx, val) => {
    const max = subproblems[idx]?.points || 0;
    const num = val === '' ? '' : Math.max(0, Math.min(max, Number(val) || 0));
    setInputScores((prev) => ({ ...prev, [idx]: num }));
  };

  const handleSubmit = () => {
    const earned = subproblems.reduce((s, sp, i) => s + (Number(inputScores[i]) || 0), 0);
    onSubmit(earned, totalMax);
  };

  // 配点がない場合（全部0）はフォールバック
  if (totalMax === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-2xl border border-[#e2e8f0] p-5 shadow-md">
      <div className="text-[13px] font-black text-[#0f172a] mb-1 text-center">自己採点</div>
      <p className="text-[10px] text-[#94a3b8] text-center mb-4">各小問の得点を入力してください</p>

      <div className="space-y-3 mb-4">
        {subproblems.map((sp, idx) => (
          <div key={idx} className="flex items-center gap-3">
            <span className="text-[12px] font-bold w-8 text-right" style={{ color: accent }}>{sp.label || `(${idx + 1})`}</span>
            <div className="flex-1 flex items-center gap-2">
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={sp.points || 0}
                value={inputScores[idx] ?? ''}
                onChange={(e) => handleChange(idx, e.target.value)}
                placeholder="0"
                className="w-16 h-9 rounded-lg border-2 border-[#e2e8f0] text-center text-[14px] font-bold text-[#0f172a] focus:outline-none focus:border-violet-400 transition-colors"
                style={inputScores[idx] !== undefined && inputScores[idx] !== '' ? { borderColor: accent + '60' } : {}}
              />
              <span className="text-[12px] text-[#94a3b8] font-medium">/ {sp.points || 0}点</span>
            </div>
          </div>
        ))}
      </div>

      {/* 合計 */}
      <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] mb-4">
        <span className="text-[12px] font-bold text-[#64748b]">合計</span>
        <span className="text-[18px] font-black" style={{ color: accent }}>{totalEarned} / {totalMax}点</span>
      </div>

      <button
        type="button"
        disabled={!allFilled}
        onClick={handleSubmit}
        className="w-full py-4 rounded-2xl text-[15px] font-black text-white shadow-xl transition-all duration-250 active:scale-[0.97] disabled:opacity-30 disabled:cursor-not-allowed"
        style={{ background: allFilled ? `linear-gradient(135deg, ${accent}, ${accent}bb)` : '#e2e8f0', boxShadow: allFilled ? `0 8px 28px ${accent}30` : 'none' }}
      >
        {allFilled ? '採点する →' : '全小問を入力してください'}
      </button>
    </div>
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
   選択画面 A — ウィザード型 4ステップ
───────────────────────────────────────────────────────────── */

const WIZARD_SUBJECT_DEFS = [
  { name: '物理', emoji: '⚡', tag: '理科', desc: '力学・電磁気・波動・熱力学' },
  { name: '数学', emoji: '∑', tag: '数学', desc: '微積・確率・数列・ベクトル' },
  { name: '化学', emoji: '⚗️', tag: '理科', desc: '有機・無機・物理化学・計算' },
];

const DIFF_ICONS = ['📗', '📘', '📙', '📕', '🔥', '🏆'];

function WizardHeader({ step, accent }) {
  const labels = ['科目', '単元', '難易度', '確認'];
  return (
    <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-md px-5 pt-4 pb-3 border-b border-[#f1f5f9]">
      {/* step dots + progress bar */}
      <div className="flex items-center justify-center gap-2 mb-3">
        {labels.map((label, i) => (
          <div key={i} className="flex items-center gap-2">
            <div
              className={`flex items-center justify-center rounded-full font-black text-[10px] transition-all duration-400 ease-out
                ${i === step ? 'w-8 h-8 text-white shadow-lg scale-110'
                  : i < step ? 'w-6 h-6 text-white opacity-80'
                  : 'w-6 h-6 bg-[#f1f5f9] text-[#b0bec5]'}`}
              style={i <= step ? { background: i < step ? accent + 'aa' : accent, boxShadow: i === step ? `0 4px 14px ${accent}55` : 'none' } : {}}
            >
              {i < step ? (
                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              ) : i + 1}
            </div>
            {i < labels.length - 1 && (
              <div
                className="h-0.5 rounded-full transition-all duration-500"
                style={{ width: 18, background: i < step ? accent : '#e2e8f0' }}
              />
            )}
          </div>
        ))}
      </div>
      {/* thin progress bar */}
      <div className="w-full h-1 bg-[#f1f5f9] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-600 ease-out"
          style={{ width: `${((step + 1) / 4) * 100}%`, background: accent }}
        />
      </div>
    </div>
  );
}

function SelectScreen({ onStart, isAuthenticated, isGuest }) {
  const [step, setStep] = useState(0);
  const [animKey, setAnimKey] = useState(0);
  const [subject, setSubject] = useState(null);
  const [topics, setTopics] = useState([]);
  const [difficulty, setDifficulty] = useState(null);
  const [numQ, setNumQ] = useState(3);
  const [genMode, setGenMode] = useState(isGuest ? GEN_MODE.MANUAL : GEN_MODE.AUTO);
  const [practiceFormat, setPracticeFormat] = useState(PRACTICE_FORMAT.DRILL);

  const subDef = subject ? WIZARD_SUBJECT_DEFS.find(d => d.name === subject) : null;
  const acc = subject ? SUBJECT_COLOR[subject].accent : '#7c3aed';
  const ring = subject ? SUBJECT_COLOR[subject].ring : 'rgba(124,58,237,0.15)';

  const goStep = (n) => { setStep(n); setAnimKey(k => k + 1); };

  const handleSubjectSelect = (s) => {
    setSubject(s);
    setTopics([]);
    setTimeout(() => goStep(1), 220);
  };

  const handleDifficultySelect = (d) => {
    setDifficulty(d);
    setTimeout(() => goStep(3), 220);
  };

  const handleStart = () => {
    onStart({
      subject: subject || '物理',
      topics,
      difficulty: difficulty || '応用',
      numQ,
      genMode,
      practiceFormat,
    });
  };

  return (
    <div className="max-w-[480px] mx-auto min-h-screen">
      <WizardHeader step={step} accent={acc} />

      {/* ── Step content with slide-up animation ── */}
      <div key={animKey} className="px-5 pt-7 pb-28 animate-in fade-in slide-in-from-bottom-4 duration-300">

        {/* ══ Step 0: 科目 ══ */}
        {step === 0 && (
          <div>
            <div className="mb-8">
              <p className="text-[11px] font-extrabold text-[#94a3b8] tracking-[0.14em] uppercase mb-2.5">Step 1 / 4</p>
              <h2 className="text-[28px] font-black text-[#0f172a] tracking-[-0.03em] leading-[1.2]">
                今日も1問、<br />差をつけよう。
              </h2>
              <p className="text-[13px] text-[#64748b] mt-2">科目を選んでスタート ↓</p>
            </div>

            <div className="space-y-3">
              {WIZARD_SUBJECT_DEFS.map((s, i) => {
                const col = SUBJECT_COLOR[s.name];
                return (
                  <button
                    key={s.name}
                    type="button"
                    onClick={() => handleSubjectSelect(s.name)}
                    className="w-full flex items-center gap-4 p-5 rounded-2xl border-2 border-[#f1f5f9] bg-white shadow-sm transition-all duration-250 active:scale-[0.97] hover:shadow-lg group"
                    style={{ animationDelay: `${i * 60}ms` }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = col.accent + '55'; e.currentTarget.style.boxShadow = `0 8px 28px ${col.ring}`; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#f1f5f9'; e.currentTarget.style.boxShadow = ''; }}
                  >
                    <div
                      className="w-14 h-14 rounded-2xl flex items-center justify-center text-[26px] flex-shrink-0 shadow-sm"
                      style={{ background: `linear-gradient(135deg, ${col.accent}18, ${col.accent}08)`, border: `1.5px solid ${col.accent}22` }}
                    >
                      {s.emoji}
                    </div>
                    <div className="flex-1 text-left">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[18px] font-black text-[#0f172a]">{s.name}</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: col.accent + '16', color: col.accent }}>{s.tag}</span>
                      </div>
                      <div className="text-[12px] text-[#64748b]">{s.desc}</div>
                    </div>
                    <svg className="w-5 h-5 text-[#cbd5e1] flex-shrink-0 group-hover:translate-x-1 group-hover:text-[#94a3b8] transition-all duration-200" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  </button>
                );
              })}
            </div>

            <p className="text-center text-[11px] text-[#b0bec5] mt-8 flex items-center justify-center gap-1.5">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.042 21.672L13.684 16.6m0 0l-2.51 2.225.569-9.47 5.227 7.917-3.286-.672zm-7.518-.267A8.25 8.25 0 1120.25 10.5M8.288 14.212A5.25 5.25 0 1117.25 10.5" />
              </svg>
              タップで次のステップへ自動で進みます
            </p>
          </div>
        )}

        {/* ══ Step 1: 単元 ══ */}
        {step === 1 && (
          <div>
            <div className="mb-6">
              <p className="text-[11px] font-extrabold text-[#94a3b8] tracking-[0.14em] uppercase mb-2.5">Step 2 / 4</p>
              <h2 className="text-[24px] font-black text-[#0f172a] tracking-[-0.03em] leading-[1.2]">
                <span style={{ color: acc }}>{subject}</span>の<br />どの単元をやる？
              </h2>
              <p className="text-[13px] text-[#94a3b8] mt-2">複数選択可 · 空欄 = 全単元ランダム</p>
            </div>

            {/* 全単元ボタン */}
            <button
              type="button"
              onClick={() => setTopics([])}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border-2 mb-4 transition-all duration-250 ${
                topics.length === 0
                  ? 'text-white border-transparent shadow-lg'
                  : 'bg-white border-[#e2e8f0] text-[#64748b] hover:border-[#cbd5e1]'
              }`}
              style={topics.length === 0 ? { background: `linear-gradient(135deg, ${acc}, ${acc}cc)`, boxShadow: `0 6px 20px ${ring}` } : {}}
            >
              <span className="text-[18px]">{topics.length === 0 ? '✓' : '○'}</span>
              <div className="flex-1 text-left">
                <div className={`text-[13px] font-bold ${topics.length === 0 ? 'text-white' : ''}`}>全単元からランダム出題</div>
                <div className={`text-[11px] mt-0.5 ${topics.length === 0 ? 'text-white/75' : 'text-[#94a3b8]'}`}>バランスよく全範囲を練習</div>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${topics.length === 0 ? 'bg-white/20 text-white' : 'bg-[#f1f5f9] text-[#64748b]'}`}>おすすめ</span>
            </button>

            {/* 単元チップ */}
            <div className="flex flex-wrap gap-2 mb-6">
              {(SUBJECT_TOPICS[subject] || []).map((t) => {
                const sel = topics.includes(t);
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTopics((prev) => sel ? prev.filter((x) => x !== t) : [...prev, t])}
                    className={`px-3.5 py-2 rounded-full text-[12px] font-semibold border-2 transition-all duration-200 active:scale-[0.95] ${
                      sel ? 'text-white border-transparent shadow-sm' : 'bg-white text-[#64748b] border-[#e8edf2] hover:border-[#cbd5e1]'
                    }`}
                    style={sel ? { background: acc, boxShadow: `0 2px 8px ${ring}` } : {}}
                  >
                    {sel && <span className="mr-1 text-[10px]">✓</span>}
                    {t}
                  </button>
                );
              })}
            </div>

            {topics.length > 0 && (
              <div className="mb-5 px-4 py-3 rounded-xl text-[11px] text-[#64748b] bg-[#f8fafc] border border-[#f1f5f9] flex items-start gap-2">
                <svg className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>
                  <span className="font-bold" style={{ color: acc }}>{topics.join('・')}</span>
                  <span className="ml-1">を選択中</span>
                </span>
              </div>
            )}

            <button
              type="button"
              onClick={() => goStep(2)}
              className="w-full py-4.5 rounded-2xl text-[15px] font-black text-white shadow-xl transition-all duration-250 active:scale-[0.97] hover:shadow-2xl"
              style={{ background: `linear-gradient(135deg, ${acc}, ${acc}cc)`, boxShadow: `0 8px 28px ${ring}` }}
            >
              {topics.length === 0 ? '全単元で次へ →' : `${topics.length}単元を選択 · 次へ →`}
            </button>
          </div>
        )}

        {/* ══ Step 2: 難易度 ══ */}
        {step === 2 && (
          <div>
            <div className="mb-6">
              <p className="text-[11px] font-extrabold text-[#94a3b8] tracking-[0.14em] uppercase mb-2.5">Step 3 / 4</p>
              <h2 className="text-[24px] font-black text-[#0f172a] tracking-[-0.03em] leading-[1.2]">
                難しさは<br />どのくらい？
              </h2>
              <p className="text-[13px] text-[#94a3b8] mt-2">タップで次へ自動で進みます</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {EXAM_LEVELS.map((lv, i) => {
                const sel = difficulty === lv.value;
                return (
                  <button
                    key={lv.value}
                    type="button"
                    onClick={() => handleDifficultySelect(lv.value)}
                    className={`p-4 rounded-2xl border-2 text-left transition-all duration-250 active:scale-[0.95] ${
                      sel
                        ? 'text-white border-transparent shadow-xl scale-[1.04]'
                        : 'bg-white border-[#e2e8f0] hover:border-[#cbd5e1] hover:shadow-md'
                    }`}
                    style={sel ? { background: `linear-gradient(135deg, ${acc}, ${acc}dd)`, boxShadow: `0 8px 24px ${ring}` } : {}}
                  >
                    <div className="text-[22px] mb-2 leading-none">{DIFF_ICONS[i]}</div>
                    <div className={`text-[14px] font-black ${sel ? 'text-white' : 'text-[#0f172a]'}`}>{lv.label}</div>
                    <div className={`text-[11px] mt-0.5 ${sel ? 'text-white/80' : 'text-[#94a3b8]'}`}>{lv.sub}</div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ══ Step 3: 確認 ══ */}
        {step === 3 && (
          <div>
            <div className="mb-6">
              <p className="text-[11px] font-extrabold text-[#94a3b8] tracking-[0.14em] uppercase mb-2.5">Step 4 / 4</p>
              <h2 className="text-[24px] font-black text-[#0f172a] tracking-[-0.03em] leading-[1.2]">
                あと少し！<br />最後の設定を
              </h2>
            </div>

            {/* 選択内容サマリー */}
            <div
              className="rounded-2xl border-2 p-4 mb-6"
              style={{ borderColor: acc + '35', background: acc + '07' }}
            >
              <p className="text-[10px] font-extrabold tracking-[0.1em] uppercase mb-3" style={{ color: acc }}>選択内容</p>
              <div className="flex flex-wrap gap-2">
                {subDef && (
                  <span className="inline-flex items-center gap-1.5 text-[12px] font-bold px-3 py-1.5 rounded-full text-white" style={{ background: acc }}>
                    <span>{subDef.emoji}</span>{subject}
                  </span>
                )}
                {topics.length === 0 ? (
                  <span className="text-[12px] font-semibold px-3 py-1.5 rounded-full bg-white border border-[#e2e8f0] text-[#64748b]">全単元</span>
                ) : topics.map((t) => (
                  <span key={t} className="text-[12px] font-semibold px-2.5 py-1 rounded-full border" style={{ background: acc + '12', color: acc, borderColor: acc + '30' }}>{t}</span>
                ))}
                {difficulty && (
                  <span className="text-[12px] font-bold px-3 py-1.5 rounded-full bg-white border border-[#e2e8f0] text-[#1e293b]">
                    {DIFF_ICONS[EXAM_LEVELS.findIndex(l => l.value === difficulty)]} {EXAM_LEVELS.find(l => l.value === difficulty)?.label}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => goStep(0)}
                className="mt-3 text-[11px] font-semibold underline underline-offset-2 opacity-60 hover:opacity-100 transition-opacity"
                style={{ color: acc }}
              >
                選択をやり直す
              </button>
            </div>

            {/* 問題数 */}
            <div className="mb-5">
              <p className="text-[11px] font-extrabold text-[#64748b] tracking-[0.1em] uppercase mb-3">問題数</p>
              <div className="flex gap-2.5">
                {[1, 2, 3].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setNumQ(n)}
                    className={`flex-1 py-3.5 rounded-xl border-2 text-[14px] font-black transition-all duration-200 active:scale-[0.96] ${
                      numQ === n ? 'text-white border-transparent shadow-md scale-[1.04]' : 'bg-white text-[#64748b] border-[#e2e8f0] hover:border-[#cbd5e1]'
                    }`}
                    style={numQ === n ? { background: `linear-gradient(135deg, ${acc}, ${acc}cc)`, boxShadow: `0 4px 16px ${ring}` } : {}}
                  >
                    {n}問
                  </button>
                ))}
              </div>
            </div>

            {/* 形式 */}
            <div className="mb-5">
              <p className="text-[11px] font-extrabold text-[#64748b] tracking-[0.1em] uppercase mb-3">練習形式</p>
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { val: PRACTICE_FORMAT.DRILL, icon: '📝', name: '一問一答', desc: '1問ずつ即採点' },
                  { val: PRACTICE_FORMAT.EXAM,  icon: '📋', name: '模試形式', desc: '全問 · タイマー付き' },
                ].map((f) => {
                  const sel = practiceFormat === f.val;
                  return (
                    <button
                      key={f.val}
                      type="button"
                      onClick={() => setPracticeFormat(f.val)}
                      className={`p-3.5 rounded-xl border-2 text-left transition-all duration-200 active:scale-[0.96] ${
                        sel ? 'border-transparent shadow-md' : 'bg-white border-[#e2e8f0] hover:border-[#cbd5e1]'
                      }`}
                      style={sel ? { background: acc + '10', borderColor: acc + '45' } : {}}
                    >
                      <div className="text-[20px] mb-1.5">{f.icon}</div>
                      <div className={`text-[12px] font-black ${sel ? '' : 'text-[#1e293b]'}`} style={sel ? { color: acc } : {}}>{f.name}</div>
                      <div className="text-[10px] text-[#94a3b8] mt-0.5">{f.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 生成モード */}
            <div className="mb-7">
              <p className="text-[11px] font-extrabold text-[#64748b] tracking-[0.1em] uppercase mb-3">生成モード</p>
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { val: GEN_MODE.AUTO,   icon: '✨', name: 'AI 自動生成', desc: 'ワンクリックで作成', locked: isGuest },
                  { val: GEN_MODE.MANUAL, icon: '📋', name: '手動',        desc: 'ChatGPTに貼り付け', locked: false },
                ].map((m) => {
                  const sel = genMode === m.val && !m.locked;
                  return (
                    <button
                      key={m.val}
                      type="button"
                      onClick={() => !m.locked && setGenMode(m.val)}
                      disabled={m.locked}
                      className={`p-3.5 rounded-xl border-2 text-left transition-all duration-200 ${
                        m.locked ? 'opacity-45 cursor-not-allowed' : 'active:scale-[0.96]'
                      } ${sel ? 'border-transparent shadow-md' : 'bg-white border-[#e2e8f0] hover:border-[#cbd5e1]'}`}
                      style={sel ? { background: acc + '10', borderColor: acc + '45' } : {}}
                    >
                      <div className="text-[20px] mb-1.5">{m.icon}</div>
                      <div className={`text-[12px] font-black ${sel ? '' : 'text-[#1e293b]'}`} style={sel ? { color: acc } : {}}>{m.name}</div>
                      <div className="text-[10px] text-[#94a3b8] mt-0.5">{m.locked ? '🔒 ログインが必要' : m.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* スタートボタン */}
            <button
              type="button"
              onClick={handleStart}
              className="w-full py-5 rounded-2xl text-[17px] font-black text-white shadow-2xl transition-all duration-250 active:scale-[0.97] hover:scale-[1.01] hover:shadow-2xl flex items-center justify-center gap-2"
              style={{ background: `linear-gradient(135deg, ${acc}, ${acc}cc)`, boxShadow: `0 12px 32px ${ring}` }}
            >
              {practiceFormat === PRACTICE_FORMAT.EXAM ? '模試スタート' : '練習スタート'}
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </button>

            <p className="text-center text-[11px] text-[#94a3b8] mt-3 leading-relaxed">
              {genMode === GEN_MODE.AUTO
                ? '✨ AIが入試品質の問題をリアルタイムで生成'
                : '📋 プロンプトをコピー → ChatGPT等に貼り付け → 問題をインポート'}
            </p>

            <div className="mt-7 pt-5 border-t border-[#f1f5f9]">
              <Link href="/user" className="group flex items-center justify-center gap-2 text-[11px] text-[#b0bec5] hover:text-[#64748b] transition-colors duration-200">
                <svg className="w-3.5 h-3.5 transition-transform duration-200 group-hover:rotate-12" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5" />
                </svg>
                PDF生成・問題作成（教員・本格演習モード）
              </Link>
            </div>

            <MobileNavLinks currentPath="/practice" />
          </div>
        )}

      </div>

      {/* ── 下部 戻るボタン（Step 1以降に固定表示） ── */}
      {step > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-30 pointer-events-none">
          <div className="max-w-[480px] mx-auto px-5 pb-6 flex justify-start pointer-events-auto">
            <button
              type="button"
              onClick={() => goStep(step - 1)}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-white border border-[#e2e8f0] shadow-md text-[12px] font-semibold text-[#64748b] hover:text-[#334155] hover:shadow-lg transition-all duration-200 active:scale-[0.96]"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
              戻る
            </button>
          </div>
        </div>
      )}
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
          <p className="text-[11px] text-[#94a3b8] mt-1">AIから返ってきた出力をそのまま貼り付けてください（マーカー形式・JSON形式 両方対応）</p>
        </div>
        <div className="p-4">
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            rows={8}
            className="w-full rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-4 py-3 text-[12px] font-mono text-[#1e293b] placeholder:text-[#cbd5e1] focus:outline-none focus:ring-2 focus:ring-offset-1 focus:border-transparent resize-none transition-all duration-200"
            style={{ '--tw-ring-color': c.accent + '60' }}
            placeholder={'%%% PROBLEM 1 %%%\n%%% TOPIC: 力学 %%%\n%%% STEM %%%\n質量 $m$ の物体が...\n%%% SUBPROBLEM (1) %%%\n...\n%%% END PROBLEM 1 %%%'}
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
   LatexTikzBlock — TikZ コードを含むテキストを分割して描画
   通常テキスト → LatexBlock、TikZ 部分 → TikzFigure
───────────────────────────────────────────────────────────── */

function LatexTikzBlock({ children, className = '' }) {
  const text = children || '';
  if (!text) return null;

  // 毎回新しい regex を生成して lastIndex の状態共有バグを防ぐ
  const tikzRe = /\\begin\{(tikzpicture|circuitikz|axis)\}[\s\S]*?\\end\{\1\}/g;

  // TikZ がなければそのまま LatexBlock へ
  if (!tikzRe.test(text)) {
    return <LatexBlock className={className}>{text}</LatexBlock>;
  }

  // 再度新しい regex で実際の分割処理
  const tikzRe2 = /\\begin\{(tikzpicture|circuitikz|axis)\}[\s\S]*?\\end\{\1\}/g;
  const segments = [];
  let lastIndex = 0;
  let match;
  while ((match = tikzRe2.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', content: text.slice(lastIndex, match.index) });
    }
    segments.push({ type: 'tikz', content: match[0] });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    segments.push({ type: 'text', content: text.slice(lastIndex) });
  }

  return (
    <div className={className}>
      {segments.map((seg, idx) =>
        seg.type === 'tikz' ? (
          <TikzFigure key={idx} tikzCode={seg.content} />
        ) : (
          <LatexBlock key={idx}>{seg.content}</LatexBlock>
        )
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   問題画面 B + 解答画面 C
───────────────────────────────────────────────────────────── */

function ProblemScreen({ problem, index, total, subject, showAnswer, onShowAnswer, onScore, onScorePoints, onSkip, onQuit, latexForPdf, onDownloadPdf, onCompileExplanation, explanationPdfLoading, pdfLoading }) {
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
          {/* PDFボタン（問題画面ヘッダー） */}
          {latexForPdf && (
            <button
              type="button"
              onClick={onDownloadPdf}
              disabled={pdfLoading}
              title="高品質PDFをダウンロード"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition-all duration-200 active:scale-[0.94] disabled:opacity-50"
              style={{ background: '#f8faff', borderColor: c.accent + '40', color: c.accent }}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              {pdfLoading ? '生成中…' : 'PDF'}
            </button>
          )}
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

        {/* 図（TikZ） */}
        {hasFigure && (
          <TikzFigure tikzCode={problem.figure_tikz} className="mb-4" />
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
                      <LatexBlock className="text-[13px] leading-[1.9] text-[#1e293b] flex-1">{sp.question}</LatexBlock>
                    )}
                    {sp.points > 0 && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#f8fafc] text-[#94a3b8] border border-[#e2e8f0] self-start shrink-0 ml-auto">{sp.points}点</span>
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
                      <LatexTikzBlock className="text-[12px] leading-[1.85] text-[#475569]">{sp.explanation}</LatexTikzBlock>
                    </div>
                  )}
                  {/* 配点基準 */}
                  {sp.scoring_criteria && (
                    <div className="px-5 pb-4 pt-2 border-t border-blue-100 bg-blue-50/40">
                      <div className="flex items-center gap-1.5 mb-2">
                        <svg className="w-3.5 h-3.5 text-blue-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-[10px] font-bold text-blue-600 tracking-[0.05em]">配点基準{sp.points > 0 ? ` [${sp.points}点]` : ''}</span>
                      </div>
                      <div className="space-y-1">
                        {sp.scoring_criteria.split('\n').filter(Boolean).map((line, li) => (
                          <div key={li} className="text-[11px] text-blue-800/80 leading-[1.6] pl-1 flex gap-1.5">
                            <span className="text-blue-400 flex-shrink-0">•</span>
                            <LatexBlock className="flex-1">{line.trim()}</LatexBlock>
                          </div>
                        ))}
                      </div>
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

          {/* 解説PDF化ボタン（自己採点前） */}
          {latexForPdf && (
            <div
              className="flex items-center gap-3 px-4 py-3 rounded-2xl border cursor-pointer transition-all duration-200 hover:shadow-md active:scale-[0.98]"
              style={{ background: 'linear-gradient(135deg, #6366f108, #8b5cf605)', borderColor: '#6366f130' }}
              onClick={onCompileExplanation}
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg, #6366f1, #7c3aed)' }}>
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-black text-[#4f46e5]">
                  {explanationPdfLoading ? '解説PDF生成中…' : '解説をPDFで見る'}
                </div>
                <div className="text-[10px] text-[#818cf8] mt-0.5">
                  解答・解説を美しいLaTeX PDFで確認
                </div>
              </div>
              {explanationPdfLoading ? (
                <div className="w-4 h-4 border-2 border-[#818cf8]/30 border-t-[#6366f1] rounded-full animate-spin flex-shrink-0" />
              ) : (
                <svg className="w-4 h-4 text-[#a5b4fc] flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              )}
            </div>
          )}

          {/* 自己採点 — 得点入力 or ○△× フォールバック */}
          <div className="pt-2">
            {getTotalPoints(problem) > 0 ? (
              <ScoreInput
                subproblems={subproblems}
                onSubmit={(earned, max) => onScorePoints(earned, max)}
                accent={c.accent}
              />
            ) : (
              <>
                <div className="text-[13px] font-black text-[#0f172a] mb-1 text-center">自己採点してね</div>
                <p className="text-[10px] text-[#94a3b8] text-center mb-4">正直に答えることが成績アップの近道</p>
                <div className="flex gap-3">
                  <ScoreButton type={SCORE.CORRECT} onClick={() => onScore(SCORE.CORRECT)} />
                  <ScoreButton type={SCORE.DELTA}   onClick={() => onScore(SCORE.DELTA)} />
                  <ScoreButton type={SCORE.WRONG}   onClick={() => onScore(SCORE.WRONG)} />
                </div>
              </>
            )}
          </div>

          {/* 高品質PDFバナー（解答表示時） */}
          {latexForPdf && (
            <div
              className="flex items-center gap-3 px-4 py-3 rounded-2xl border cursor-pointer transition-all duration-200 hover:shadow-md active:scale-[0.98]"
              style={{ background: 'linear-gradient(135deg, #0f172a08, #1e293b05)', borderColor: '#1e293b20' }}
              onClick={onDownloadPdf}
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg, #1e293b, #334155)' }}>
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-black text-[#1e293b]">
                  {pdfLoading ? 'PDF生成中…' : '高品質PDFで保存'}
                </div>
                <div className="text-[10px] text-[#64748b] mt-0.5">
                  LaTeX組版 · 美しい数式 · 印刷対応
                </div>
              </div>
              <svg className="w-4 h-4 text-[#94a3b8] flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </div>
          )}

          {/* スキップ */}
          <button type="button" onClick={() => onSkip && onSkip()} className="w-full py-2.5 text-[11px] text-[#b0bec5] hover:text-[#64748b] transition-colors duration-200">
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

function ExamScreen({ problems, subject, onFinish, onQuit, latexForPdf, onDownloadPdf, pdfLoading }) {
  const c = SUBJECT_COLOR[subject] || SUBJECT_COLOR['物理'];
  const numQ = problems.length;
  const initialTime = numQ <= 3 ? 15 * 60 : numQ <= 5 ? 30 * 60 : 60 * 60;
  const [timeLeft, setTimeLeft] = useState(initialTime);
  const [finished, setFinished] = useState(false);
  const [examScores, setExamScores] = useState({}); // { index: SCORE.xxx }
  const [examPointScores, setExamPointScores] = useState({}); // { index: { earned, max } }

  const anyPoints = problems.some((p) => getTotalPoints(p) > 0);

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
    const scoreArray = problems.map((p, i) => {
      if (examPointScores[i]) return deriveScoreFromPoints(examPointScores[i].earned, examPointScores[i].max);
      return examScores[i] || SCORE.DELTA;
    });
    const pointArray = problems.map((_, i) => examPointScores[i] || null);
    onFinish(scoreArray, pointArray);
  };

  const allScored = problems.every((p, i) => {
    if (anyPoints && getTotalPoints(p) > 0) return examPointScores[i] != null;
    return examScores[i] != null;
  });
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
                {problem?.figure_tikz && problem.figure_tikz !== 'null' && (
                  <TikzFigure tikzCode={problem.figure_tikz} />
                )}
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
                            <LatexTikzBlock className="text-[11px] leading-[1.75] text-[#475569]">{sp.explanation}</LatexTikzBlock>
                          </div>
                        </details>
                      )}
                      {sp.scoring_criteria && (
                        <details className="mt-1">
                          <summary className="text-[10px] font-bold text-blue-500 cursor-pointer select-none hover:underline">
                            配点基準{sp.points > 0 ? ` [${sp.points}点]` : ''}
                          </summary>
                          <div className="mt-1.5 pl-2 border-l-2 border-blue-200 space-y-0.5">
                            {sp.scoring_criteria.split('\n').filter(Boolean).map((line, li) => (
                              <div key={li} className="text-[10px] text-blue-700/80 leading-[1.5] flex gap-1">
                                <span className="text-blue-400">•</span>
                                <LatexBlock className="flex-1">{line.trim()}</LatexBlock>
                              </div>
                            ))}
                          </div>
                        </details>
                      )}
                    </div>
                  ))}
                  {/* 自己採点 */}
                  {(() => {
                    const maxPts = getTotalPoints(problem);
                    if (anyPoints && maxPts > 0) {
                      // 得点入力モード
                      return (
                        <div className="flex items-center gap-3 mt-3">
                          <span className="text-[11px] font-bold text-[#64748b]">得点：</span>
                          <input
                            type="number" min={0} max={maxPts}
                            value={examPointScores[idx]?.earned ?? ''}
                            onChange={(e) => {
                              const v = Math.max(0, Math.min(maxPts, parseInt(e.target.value) || 0));
                              setExamPointScores((prev) => ({ ...prev, [idx]: { earned: v, max: maxPts } }));
                            }}
                            placeholder="0"
                            className="w-16 text-center text-[14px] font-bold border border-[#e2e8f0] rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#8b5cf6]"
                          />
                          <span className="text-[12px] text-[#94a3b8]">/ {maxPts}点</span>
                        </div>
                      );
                    }
                    // ○△× モード
                    return (
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
                    );
                  })()}
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
            {allScored ? '結果を見る →' : '全問採点してください'}
          </button>
        )}

        {/* PDFダウンロード（模試画面でも使用可能） */}
        {latexForPdf && (
          <button
            type="button"
            onClick={onDownloadPdf}
            disabled={pdfLoading}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-[12px] font-bold border-2 border-[#1e293b20] text-[#475569] bg-white hover:bg-[#f8faff] transition-all duration-200 active:scale-[0.97] disabled:opacity-50"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            {pdfLoading ? 'PDF生成中…' : '高品質PDFで保存'}
          </button>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   PDF 埋め込み練習画面 — LaTeX 組版 PDF をページ内に表示
───────────────────────────────────────────────────────────── */

function PdfViewScreen({ pdfUrl, pdfLoading, pdfProgress, answerPdfUrl, answerPdfLoading, onRevealAnswer, subject, problems, onFinish, onQuit }) {
  const c = SUBJECT_COLOR[subject] || SUBJECT_COLOR['物理'];
  const [scores, setScores] = useState({});
  const [pScores, setPScores] = useState({}); // { idx: { earned, max } }
  const [answersRevealed, setAnswersRevealed] = useState(false);
  const [finished, setFinished] = useState(false);
  const [scorePanelOpen, setScorePanelOpen] = useState(false);
  const iframeContainerRef = useRef(null);

  // 解答 PDF が生成されたら自動で表示状態に
  const [viewingAnswer, setViewingAnswer] = useState(false);
  const effectiveUrl = viewingAnswer && answerPdfUrl && answerPdfUrl !== '__failed__'
    ? answerPdfUrl
    : pdfUrl;

  // 配点のある問題があるかチェック
  const anyPoints = problems.some((p) => getTotalPoints(p) > 0);

  // 得点入力済みかどうか
  const allScored = problems.length > 0 && problems.every((_, i) => {
    if (anyPoints && getTotalPoints(problems[i]) > 0) return pScores[i] != null;
    return scores[i] != null;
  });

  const pdfFailed = !pdfLoading && !pdfUrl;

  const scoreLabel = { [SCORE.CORRECT]: '○', [SCORE.DELTA]: '△', [SCORE.WRONG]: '×' };
  const scoreColor = {
    [SCORE.CORRECT]: { bg: '#f0fdf4', border: '#86efac', text: '#16a34a', active: '#16a34a' },
    [SCORE.DELTA]:   { bg: '#fffbeb', border: '#fcd34d', text: '#d97706', active: '#d97706' },
    [SCORE.WRONG]:   { bg: '#fef2f2', border: '#fca5a5', text: '#dc2626', active: '#dc2626' },
  };

  return (
    <div className="practice-pdf-layout">
      {/* ── ヘッダー ── */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3 border-b border-[#e2e8f0] bg-white flex-shrink-0">
        <BackButton onClick={onQuit} label="終了" />
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: c.accent }} />
          <span className="text-[11px] sm:text-[12px] font-bold text-[#64748b]">
            {subject}{pdfFailed ? ' カード表示' : ' PDF'}
          </span>
        </div>
        <div className="w-14 sm:w-16" />
      </div>

      {/* ── PDF または カードフォールバック ── */}
      <div ref={iframeContainerRef} className="flex-1 min-h-0 bg-[#f1f5f9] overflow-y-auto practice-pdf-content">
        {pdfLoading ? (
          <div className="h-full flex flex-col items-center justify-center px-6">
            <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-[#e2e8f0] px-6 py-7 flex flex-col gap-5">
              {/* アイコン + タイトル */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                     style={{ background: c.accent + '14' }}>
                  <div className="w-5 h-5 border-[3px] border-[#e2e8f0] rounded-full animate-spin"
                       style={{ borderTopColor: c.accent }} />
                </div>
                <div>
                  <p className="text-[13px] font-bold text-[#1e293b]">LaTeX PDF を生成中</p>
                  <p className="text-[11px] text-[#94a3b8] mt-0.5">
                    {pdfProgress < 15 ? 'LaTeX 文書を構築中...' :
                     pdfProgress < 35 ? '数式・記号をレンダリング中...' :
                     pdfProgress < 60 ? 'TikZ 図・グラフを処理中...' :
                     pdfProgress < 80 ? 'PDF コンパイル中...' :
                     pdfProgress < 95 ? '仕上げ処理中...' : '完了'}
                  </p>
                </div>
              </div>
              {/* プログレスバー */}
              <div className="space-y-1.5">
                <div className="w-full h-2 bg-[#f1f5f9] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700 ease-out"
                    style={{ width: `${Math.max(4, pdfProgress)}%`, background: c.accent }}
                  />
                </div>
                <p className="text-[10px] text-[#94a3b8] text-right">{pdfProgress}%</p>
              </div>
              {/* ステップ一覧 */}
              <div className="flex flex-col gap-1.5">
                {[
                  { label: 'LaTeX 文書を構築',    done: pdfProgress >= 15 },
                  { label: '数式・記号をレンダリング', done: pdfProgress >= 35 },
                  { label: 'TikZ 図・グラフを処理', done: pdfProgress >= 60 },
                  { label: 'PDF コンパイル',      done: pdfProgress >= 80 },
                  { label: '仕上げ処理',          done: pdfProgress >= 95 },
                ].map(({ label: stepLabel, done }) => (
                  <div key={stepLabel} className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-500"
                         style={{ background: done ? c.accent : '#e2e8f0' }}>
                      {done && (
                        <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <span className="text-[11px]" style={{ color: done ? '#1e293b' : '#94a3b8' }}>{stepLabel}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : effectiveUrl ? (
          /* PDF が生成できた場合: iframe で埋め込み表示（モバイル最適化） */
          <iframe
            src={effectiveUrl}
            title="練習問題 PDF"
            className="practice-pdf-iframe"
          />
        ) : (
          /* PDF 失敗フォールバック: 問題カードを直接表示 */
          <div className="px-4 py-5 space-y-5 max-w-[640px] mx-auto">
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-[11px] font-semibold">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              LaTeX PDF の生成に失敗しました。問題をカード形式で表示しています。
            </div>
            {problems.map((problem, idx) => {
              const stem = problem?.stem || problem?.text || problem?.question || '';
              const topic = problem?.topic || '';
              const subproblems = (() => {
                const subs = problem?.subproblems;
                if (Array.isArray(subs) && subs.length > 0) return subs;
                const a = problem?.answer || problem?.solution || '';
                const e = problem?.explanation || '';
                if (a || e) return [{ label: '', question: '', answer: a, explanation: e }];
                return [];
              })();
              return (
                <div key={idx} className="bg-white rounded-2xl border border-[#e2e8f0] overflow-hidden shadow-sm">
                  <div className="flex items-center gap-2 px-5 pt-4 pb-2">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[12px] font-black text-white"
                         style={{ background: c.accent }}>{idx + 1}</div>
                    {topic && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                            style={{ background: c.accent + '14', color: c.accent }}>{topic}</span>
                    )}
                  </div>
                  <div className="px-5 pb-4 space-y-2">
                    {stem && <LatexBlock className="text-[13px] leading-[1.9] text-[#1e293b]">{stem}</LatexBlock>}
                    {problem?.figure_tikz && problem.figure_tikz !== 'null' && (
                      <TikzFigure tikzCode={problem.figure_tikz} />
                    )}
                    {subproblems.length > 0 && (
                      <div className="space-y-1 border-t pt-2" style={{ borderColor: c.accent + '22' }}>
                        {subproblems.map((sp, si) => sp.question ? (
                          <div key={si} className="flex gap-1.5">
                            {sp.label && <span className="text-[12px] font-black shrink-0" style={{ color: c.accent }}>{sp.label}</span>}
                            <LatexBlock className="text-[12px] leading-[1.8] text-[#334155]">{sp.question}</LatexBlock>
                          </div>
                        ) : null)}
                      </div>
                    )}
                    {finished && subproblems.map((sp, si) => (
                      <div key={si} className="border-t pt-3 mt-2" style={{ borderColor: c.accent + '22' }}>
                        {sp.answer && (
                          <div className="mb-1">
                            <span className="text-[10px] font-bold" style={{ color: c.accent }}>
                              {sp.label ? `解答 ${sp.label}` : '解答'}
                            </span>
                            <LatexBlock className="text-[13px] leading-[1.8] text-[#1e293b] font-semibold">{sp.answer}</LatexBlock>
                          </div>
                        )}
                        {sp.explanation && (
                          <details className="mt-1">
                            <summary className="text-[10px] font-bold text-[#6366f1] cursor-pointer select-none hover:underline">解説を見る</summary>
                            <div className="mt-1.5 pl-2 border-l-2 border-[#e8eeff]">
                              <LatexTikzBlock className="text-[11px] leading-[1.75] text-[#475569]">{sp.explanation}</LatexTikzBlock>
                            </div>
                          </details>
                        )}
                        {sp.scoring_criteria && (
                          <details className="mt-1">
                            <summary className="text-[10px] font-bold text-blue-500 cursor-pointer select-none hover:underline">
                              配点基準{sp.points > 0 ? ` [${sp.points}点]` : ''}
                            </summary>
                            <div className="mt-1.5 pl-2 border-l-2 border-blue-200 space-y-0.5">
                              {sp.scoring_criteria.split('\n').filter(Boolean).map((line, li) => (
                                <div key={li} className="text-[10px] text-blue-700/80 leading-[1.5] flex gap-1">
                                  <span className="text-blue-400">•</span>
                                  <LatexBlock className="flex-1">{line.trim()}</LatexBlock>
                                </div>
                              ))}
                            </div>
                          </details>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            {!finished && (
              <button type="button" onClick={() => setFinished(true)}
                className="w-full py-4 rounded-2xl text-[15px] font-black text-white shadow-xl transition-all duration-250 active:scale-[0.97]"
                style={{ background: 'linear-gradient(135deg, #1e293b, #334155)' }}>
                解き終わった → 解答を見る
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── 解答・解説を見るボタン / 採点パネル ── */}
      {!answersRevealed && !pdfLoading ? (
        /* まだ解答を見ていない → 解答確認ボタンを表示 */
        <div className="flex-shrink-0 bg-white border-t border-[#e2e8f0] px-4 py-3">
          <button
            type="button"
            onClick={() => {
              setAnswersRevealed(true);
              setViewingAnswer(true);
              onRevealAnswer();
            }}
            className="w-full py-3.5 rounded-2xl text-[14px] font-black text-white shadow-lg transition-all duration-250 active:scale-[0.97]"
            style={{ background: `linear-gradient(135deg, ${c.accent}, ${c.accent}bb)`, boxShadow: `0 6px 20px ${c.ring}` }}
          >
            📖 解答・解説を見て採点する
          </button>
        </div>
      ) : (
      /* ── 採点パネル (モバイル: 折りたたみ可) ── */
      <div className="flex-shrink-0 bg-white border-t border-[#e2e8f0] practice-score-panel">
        <button
          type="button"
          className="w-full flex items-center justify-between sm:hidden px-4 py-2.5"
          onClick={() => setScorePanelOpen(!scorePanelOpen)}
        >
          <span className="text-[11px] font-extrabold text-[#94a3b8] tracking-[0.1em] uppercase">自己採点</span>
          <svg className={`w-4 h-4 text-[#94a3b8] transition-transform duration-200 ${scorePanelOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
          </svg>
        </button>
        <div className={`px-3 sm:px-4 pb-3 sm:pb-4 ${scorePanelOpen ? '' : 'hidden sm:block'}`}>
        <p className="text-[11px] font-extrabold text-[#94a3b8] tracking-[0.1em] uppercase mb-2 hidden sm:block">自己採点</p>

        {anyPoints ? (
          /* 配点ベースの得点入力 */
          <div className="space-y-2 max-h-48 overflow-y-auto pb-2">
            {problems.map((p, idx) => {
              const maxPts = getTotalPoints(p);
              if (maxPts > 0) {
                return (
                  <div key={idx} className="flex items-center gap-3">
                    <span className="text-[11px] font-bold text-[#64748b] w-10 shrink-0">問{idx + 1}</span>
                    <input
                      type="number"
                      min={0}
                      max={maxPts}
                      value={pScores[idx]?.earned ?? ''}
                      onChange={(e) => {
                        const v = Math.max(0, Math.min(maxPts, parseInt(e.target.value) || 0));
                        setPScores((prev) => ({ ...prev, [idx]: { earned: v, max: maxPts } }));
                      }}
                      placeholder="得点"
                      className="w-16 text-center text-[13px] font-bold border border-[#e2e8f0] rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#8b5cf6]"
                    />
                    <span className="text-[11px] text-[#94a3b8]">/ {maxPts}点</span>
                  </div>
                );
              }
              // 配点なし→○△×
              return (
                <div key={idx} className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-[#64748b] w-10 shrink-0">問{idx + 1}</span>
                  <div className="flex gap-1">
                    {[SCORE.CORRECT, SCORE.DELTA, SCORE.WRONG].map((s) => {
                      const sc = scoreColor[s];
                      const selected = scores[idx] === s;
                      return (
                        <button key={s} type="button"
                          onClick={() => setScores((prev) => ({ ...prev, [idx]: s }))}
                          className="w-8 h-8 rounded-full text-[13px] font-black border-2 transition-all duration-150 active:scale-90"
                          style={selected
                            ? { background: sc.active, borderColor: sc.active, color: 'white' }
                            : { background: 'white', borderColor: '#e2e8f0', color: '#cbd5e1' }}>
                          {scoreLabel[s]}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* 従来の ○△× モード */
          <div className="flex gap-2 overflow-x-auto pb-2">
          {problems.map((p, idx) => (
            <div key={idx} className="flex flex-col items-center gap-1 flex-shrink-0">
              <span className="text-[10px] font-bold text-[#94a3b8]">問{idx + 1}</span>
              <div className="flex gap-1">
                {[SCORE.CORRECT, SCORE.DELTA, SCORE.WRONG].map((s) => {
                  const sc = scoreColor[s];
                  const selected = scores[idx] === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setScores((prev) => ({ ...prev, [idx]: s }))}
                      className="w-9 h-9 rounded-full text-[14px] font-black border-2 transition-all duration-150 active:scale-90"
                      style={selected
                        ? { background: sc.active, borderColor: sc.active, color: 'white', transform: 'scale(1.1)' }
                        : { background: 'white', borderColor: '#e2e8f0', color: '#cbd5e1' }}
                    >
                      {scoreLabel[s]}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        )}

        <button
          type="button"
          disabled={!allScored}
          onClick={() => {
            // スコア配列と得点データを構築
            const scoreArray = problems.map((p, i) => {
              if (pScores[i]) return deriveScoreFromPoints(pScores[i].earned, pScores[i].max);
              return scores[i] || SCORE.DELTA;
            });
            const pointArray = problems.map((_, i) => pScores[i] || null);
            onFinish(scoreArray, pointArray);
          }}
          className="w-full mt-2 py-3 sm:py-3.5 rounded-2xl text-[13px] sm:text-[14px] font-black text-white shadow-lg transition-all duration-250 active:scale-[0.97] disabled:opacity-30 disabled:cursor-not-allowed"
          style={{ background: allScored ? `linear-gradient(135deg, ${c.accent}, ${c.accent}bb)` : '#e2e8f0', boxShadow: allScored ? `0 6px 20px ${c.ring}` : 'none' }}
        >
          {allScored ? '採点して結果を見る →' : `まだ採点が完了していません`}
        </button>
        </div>
      </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   サマリー画面 E
───────────────────────────────────────────────────────────── */

function SummaryScreen({ scores, problems, subject, onRetry, onRestart, latexForPdf, onDownloadPdf, pdfLoading, pointScores }) {
  const c = SUBJECT_COLOR[subject] || SUBJECT_COLOR['物理'];
  const correct = scores.filter((s) => s === SCORE.CORRECT).length;
  const delta   = scores.filter((s) => s === SCORE.DELTA).length;
  const wrong   = scores.filter((s) => s === SCORE.WRONG).length;
  const total   = scores.length;

  // 得点ベースの集計
  const hasPointData = pointScores && pointScores.some((p) => p !== null);
  const totalEarned = hasPointData ? pointScores.reduce((s, p) => s + (p?.earned || 0), 0) : 0;
  const totalMax    = hasPointData ? pointScores.reduce((s, p) => s + (p?.max || 0), 0) : 0;
  const pct = hasPointData && totalMax > 0
    ? Math.round((totalEarned / totalMax) * 100)
    : total > 0 ? Math.round((correct / total) * 100) : 0;
  const [shared, setShared] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  // パーフェクト時にアニメーション
  useEffect(() => {
    if (correct === total && total > 0) {
      setShowConfetti(true);
      const t = setTimeout(() => setShowConfetti(false), 3000);
      return () => clearTimeout(t);
    }
  }, [correct, total]);

  // 弱点単元を抽出
  const weakTopics = problems
    .filter((_, i) => scores[i] === SCORE.WRONG)
    .map((p) => p?.topic || p?.metadata?.field)
    .filter(Boolean)
    .filter((v, i, a) => a.indexOf(v) === i);

  // 学習履歴を localStorage に保存
  useEffect(() => {
    try {
      const prev = JSON.parse(localStorage.getItem('rem_practice_history') || '[]');
      const entry = {
        subject,
        difficulty: problems[0]?.metadata?.difficulty || '',
        earnedPoints: hasPointData ? totalEarned : correct,
        maxPoints: hasPointData ? totalMax : total,
        numProblems: total,
        date: new Date().toISOString(),
        weakTopics,
      };
      prev.push(entry);
      // 直近200件のみ保持
      if (prev.length > 200) prev.splice(0, prev.length - 200);
      localStorage.setItem('rem_practice_history', JSON.stringify(prev));
    } catch {}
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 合格ライン/メッセージ
  const getRating = () => {
    if (pct === 100) return { emoji: '🏆', label: 'パーフェクト！', sub: '完璧な理解です。次のレベルへ！', color: '#f59e0b' };
    if (pct >= 80)  return { emoji: '🎯', label: 'ほぼ完璧！',  sub: 'あと少しで完成度100%。もう一周！', color: c.accent };
    if (pct >= 60)  return { emoji: '💪', label: 'いい調子！',  sub: '正答率60%超え。弱点を集中攻略しよう！', color: '#3b82f6' };
    if (pct >= 40)  return { emoji: '📖', label: '基礎を固めよう', sub: '解説をよく読んで理解を深めよう。', color: '#d97706' };
    return           { emoji: '🔁', label: 'もう一周やろう！', sub: 'インプットと反復が合格への近道。', color: '#dc2626' };
  };
  const rating = getRating();

  const handleShare = async () => {
    const scoreText = hasPointData && totalMax > 0
      ? `${totalEarned}/${totalMax}点（${pct}%）`
      : `${total}問中${correct}問正解（${pct}%）`;
    const text = `${subject}練習 ${scoreText}${rating.emoji}\n受験AIで演習中！ #受験AI #${subject}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: '練習結果', text });
        setShared(true);
        setTimeout(() => setShared(false), 2000);
      } catch {}
    } else {
      await navigator.clipboard.writeText(text).catch(() => {});
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    }
  };

  return (
    <div className="max-w-[480px] mx-auto px-5 pt-8 pb-20 relative overflow-hidden">
      {/* パーフェクト紙吹雪アニメーション */}
      {showConfetti && (
        <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
          {[...Array(18)].map((_, i) => (
            <div
              key={i}
              className="absolute w-2.5 h-2.5 rounded-sm animate-bounce"
              style={{
                left: `${Math.random() * 100}%`,
                top: `-${10 + Math.random() * 20}px`,
                background: ['#f59e0b','#8b5cf6','#3b82f6','#10b981','#ef4444','#f97316'][i % 6],
                animationDelay: `${Math.random() * 1.2}s`,
                animationDuration: `${0.7 + Math.random() * 0.8}s`,
                transform: `rotate(${Math.random() * 360}deg)`,
                opacity: 0.85,
              }}
            />
          ))}
        </div>
      )}

      {/* ヘッダー */}
      <div className="text-center mb-7">
        <div
          className="w-20 h-20 mx-auto mb-4 rounded-3xl flex items-center justify-center text-[36px] shadow-lg"
          style={{ background: `linear-gradient(135deg, ${rating.color}18, ${rating.color}08)`, border: `2px solid ${rating.color}30` }}
        >
          {rating.emoji}
        </div>
        <h2 className="text-[24px] font-black text-[#0f172a] tracking-[-0.03em]">{rating.label}</h2>
        <p className="text-[13px] text-[#64748b] mt-1.5 leading-relaxed">{rating.sub}</p>
      </div>

      {/* 正答率 円グラフ */}
      <div className="flex justify-center mb-6">
        <div className="relative w-28 h-28">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
            <circle cx="18" cy="18" r="15.9" fill="none" stroke="#f1f5f9" strokeWidth="3.5" />
            <circle
              cx="18" cy="18" r="15.9" fill="none"
              stroke={rating.color}
              strokeWidth="3.5"
              strokeDasharray={`${pct} ${100 - pct}`}
              strokeLinecap="round"
              style={{ transition: 'stroke-dasharray 1.2s cubic-bezier(0.22,1,0.36,1)' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[30px] font-black tracking-[-0.03em]" style={{ color: rating.color }}>{pct}</span>
            <span className="text-[10px] font-bold text-[#94a3b8] -mt-0.5">%</span>
          </div>
        </div>
      </div>

      {/* スコアカード */}
      {hasPointData && totalMax > 0 ? (
        <div className="bg-white rounded-2xl border border-[#e2e8f0] p-5 mb-6 text-center">
          <div className="text-[11px] font-bold text-[#94a3b8] mb-1 tracking-[0.05em]">得点</div>
          <div className="text-[36px] font-black text-[#0f172a] leading-none">
            {totalEarned}<span className="text-[18px] text-[#94a3b8] font-bold"> / {totalMax}</span>
          </div>
          <div className="text-[12px] text-[#64748b] mt-2">{total}問 ─ ○{correct} △{delta} ×{wrong}</div>
        </div>
      ) : (
      <div className="grid grid-cols-3 gap-2.5 mb-6">
        <div className="bg-[#f0fdf4] rounded-2xl border border-[#86efac]/60 p-4 text-center">
          <div className="text-[32px] font-black text-[#16a34a] leading-none">{correct}</div>
          <div className="text-[10px] font-bold text-[#16a34a] mt-1.5">○ 解けた</div>
        </div>
        <div className="bg-[#fffbeb] rounded-2xl border border-[#fcd34d]/60 p-4 text-center">
          <div className="text-[32px] font-black text-[#d97706] leading-none">{delta}</div>
          <div className="text-[10px] font-bold text-[#d97706] mt-1.5">△ 惜しい</div>
        </div>
        <div className="bg-[#fef2f2] rounded-2xl border border-[#fca5a5]/60 p-4 text-center">
          <div className="text-[32px] font-black text-[#dc2626] leading-none">{wrong}</div>
          <div className="text-[10px] font-bold text-[#dc2626] mt-1.5">× 要復習</div>
        </div>
        </div>
      )}
      {/* 弱点単元 */}
      {weakTopics.length > 0 && (
        <div className="bg-gradient-to-br from-[#fef2f2] to-[#fff7ed] rounded-2xl border border-[#fca5a5]/40 p-4 mb-5">
          <div className="flex items-center gap-2 mb-2.5">
            <span className="text-[13px]">🎯</span>
            <span className="text-[12px] font-black text-[#dc2626] tracking-[0.04em] uppercase">今日の重点復習単元</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {weakTopics.map((t) => (
              <span key={t} className="text-[12px] font-bold px-3 py-1.5 rounded-full bg-white text-[#dc2626] border border-[#fca5a5]/50 shadow-sm">
                {t}
              </span>
            ))}
          </div>
          <p className="text-[10px] text-[#f87171] mt-2.5 leading-relaxed">
            間違えた単元を今日中にもう1問解くと記憶定着率が大幅に上がります
          </p>
        </div>
      )}

      {/* モチベーションメッセージ */}
      <div className="bg-gradient-to-r from-[#f8faff] to-[#f0f4ff] rounded-2xl border border-[#e0e7ff] px-4 py-3 mb-6 flex items-center gap-3">
        <span className="text-[20px] flex-shrink-0">✨</span>
        <p className="text-[11px] text-[#4f46e5] font-semibold leading-relaxed">
          {pct === 100
            ? 'この調子で毎日続けよう！継続が合格への最短ルートです。'
            : pct >= 60
            ? '毎日少しずつでも続けることが、合格への確実な一歩です。'
            : 'まずは解説を熟読。理解してから再チャレンジが効果的です。'}
        </p>
      </div>

      {/* アクション */}
      <div className="space-y-3">
        <button
          type="button"
          onClick={onRetry}
          className="w-full py-4.5 rounded-2xl text-[15px] font-black text-white shadow-xl transition-all duration-250 active:scale-[0.97] hover:shadow-2xl flex items-center justify-center gap-2"
          style={{ background: `linear-gradient(135deg, ${c.accent}, ${c.accent}cc)`, boxShadow: `0 8px 28px ${c.ring}` }}
        >
          <span>もう一周やる</span>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
          </svg>
        </button>

        {/* シェアボタン */}
        <button
          type="button"
          onClick={handleShare}
          className="w-full py-3.5 rounded-2xl text-[14px] font-black border-2 transition-all duration-250 active:scale-[0.97] flex items-center justify-center gap-2"
          style={{
            background: shared ? '#f0fdf4' : 'white',
            borderColor: shared ? '#86efac' : '#e2e8f0',
            color: shared ? '#16a34a' : '#475569',
          }}
        >
          {shared ? (
            <><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>コピー完了！</>
          ) : (
            <><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" /></svg>結果をシェア</>
          )}
        </button>

        {latexForPdf && (
          <button
            type="button"
            onClick={onDownloadPdf}
            disabled={pdfLoading}
            className="w-full rounded-2xl text-[13px] font-bold text-white shadow-lg transition-all duration-250 active:scale-[0.97] disabled:opacity-60 hover:shadow-xl overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #0f172a, #1e293b)' }}
          >
            <div className="flex items-center gap-3 px-5 py-4">
              <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
                <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
              </div>
              <div className="flex-1 text-left">
                <div className="text-[13px] font-black">
                  {pdfLoading ? 'LaTeX組版中…' : '高品質PDFで保存'}
                </div>
                <div className="text-[10px] text-white/60 mt-0.5">
                  {pdfLoading ? 'しばらくお待ちください' : 'LaTeX組版 · 美しい数式印刷 · 問題+解答付き'}
                </div>
              </div>
              {!pdfLoading && (
                <svg className="w-4 h-4 text-white/50 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
              )}
              {pdfLoading && (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin flex-shrink-0" />
              )}
            </div>
          </button>
        )}

        <button type="button" onClick={onRestart} className="w-full py-3 text-[12px] text-[#94a3b8] hover:text-[#475569] transition-colors duration-200">
          別の科目・単元で練習する
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
  const [latexForPdf, setLatexForPdf]     = useState(null);
  const [latexAnswers, setLatexAnswers]   = useState(null);
  const [pdfUrl, setPdfUrl]               = useState(null);
  const [answerPdfUrl, setAnswerPdfUrl]   = useState(null);
  const [answerPdfLoading, setAnswerPdfLoading] = useState(false);
  const [pdfLoading, setPdfLoading]       = useState(false);
  const [pdfProgress, setPdfProgress]     = useState(0);
  const pdfProgressTimer = useRef(null);
  const [followLoading, setFollowLoading] = useState(false);
  const [manualPrompt, setManualPrompt] = useState('');
  const [promptLoading, setPromptLoading] = useState(false);
  const [explanationPdfLoading, setExplanationPdfLoading] = useState(false);
  // 得点入力による採点結果 { earnedPoints, maxPoints } per problem
  const [pointScores, setPointScores] = useState([]);
  // × 後のフォローアップ用に追加問題をキューに積む
  const extraQueue = useRef([]);

  /* ── PDF 生成プログレス管理 ── */
  const startPdfProgress = useCallback(() => {
    if (pdfProgressTimer.current) clearInterval(pdfProgressTimer.current);
    setPdfProgress(0);
    // 段階的に進める: 最初は速く、後半は遅くなる
    const schedule = [
      { at: 800,  val: 12 },
      { at: 2000, val: 28 },
      { at: 4000, val: 48 },
      { at: 7000, val: 62 },
      { at: 12000, val: 75 },
      { at: 20000, val: 85 },
      { at: 35000, val: 92 },
    ];
    const timers = schedule.map(({ at, val }) =>
      setTimeout(() => setPdfProgress(val), at)
    );
    pdfProgressTimer.current = { _timers: timers };
  }, []);

  const finishPdfProgress = useCallback((success) => {
    if (pdfProgressTimer.current?._timers) {
      pdfProgressTimer.current._timers.forEach(clearTimeout);
    }
    pdfProgressTimer.current = null;
    setPdfProgress(success ? 100 : 0);
  }, []);

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
      // 問題のみの PDF を先に表示し、解答は別途生成する
      const latexProbs = result.latex_problems || result.latex || null;
      const latexAns   = result.latex_answers  || result.latex || null;
      setLatexForPdf(latexProbs);
      setLatexAnswers(latexAns);
      setAnswerPdfUrl(null);
      setCurrent(0);
      setScores([]);
      setPointScores([]);
      setShowAnswer(false);
      extraQueue.current = [];

      // LaTeX が返ってきたら自動で PDF 生成 → PDF 埋め込み画面へ
      if (latexProbs) {
        setPdfUrl(null);
        setPdfLoading(true);
        startPdfProgress();
        setScreen(SCREEN.PDF);
        try {
          const pdfData = await generatePdf(latexProbs);
          finishPdfProgress(true);
          setPdfUrl(pdfData?.pdf_url || pdfData?.url || null);
        } catch (_pdfErr) {
          finishPdfProgress(false);
          setPdfUrl(null);
        }
        setPdfLoading(false);
      } else {
        setScreen(SCREEN.PDF); // latex がなくても PDF 画面でカード表示
      }
    } catch (e) {
      clearTimeout(t1);
      clearTimeout(t2);
      setError(`AI生成に失敗しました: ${e.message}`);
      setScreen(SCREEN.SELECT);
    }
  }, [user, startPdfProgress, finishPdfProgress]);

  /* ── 解答 PDF を生成・表示 ── */
  const handleRevealAnswer = useCallback(async () => {
    if (!latexAnswers) return;
    if (answerPdfUrl) return; // already generated
    setAnswerPdfLoading(true);
    try {
      const pdfData = await generatePdf(latexAnswers);
      setAnswerPdfUrl(pdfData?.pdf_url || pdfData?.url || null);
    } catch (_) {
      setAnswerPdfUrl('__failed__');
    }
    setAnswerPdfLoading(false);
  }, [latexAnswers, answerPdfUrl]);

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
  const handleManualParsed = useCallback(async (parsedProblems, latex) => {
    setProblems(parsedProblems);
    setLatexForPdf(latex);
    setLatexAnswers(latex); // 手動モードは全文を解答 PDF にも使う
    setAnswerPdfUrl(null);
    setCurrent(0);
    setScores([]);
    setPointScores([]);
    setShowAnswer(false);
    extraQueue.current = [];
    if (latex) {
      setPdfUrl(null);
      setPdfLoading(true);
      startPdfProgress();
      setScreen(SCREEN.PDF);
      try {
        const pdfData = await generatePdf(latex);
        finishPdfProgress(true);
        setPdfUrl(pdfData?.pdf_url || pdfData?.url || null);
      } catch (_) {
        finishPdfProgress(false);
        setPdfUrl(null);
      }
      setPdfLoading(false);
    } else {
      setScreen(SCREEN.PDF); // latex なしでもPDF画面でカード表示
    }
  }, [config, startPdfProgress, finishPdfProgress]);

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
    setPointScores((prev) => [...prev, null]); // no point data for ○△× mode

    if (score === SCORE.WRONG) {
      setScreen(SCREEN.FOLLOW);
      return;
    }

    advanceToNext();
  }, [advanceToNext]);

  /* ── 得点入力による自己採点 ── */
  const handleScorePoints = useCallback((earned, max) => {
    const score = deriveScoreFromPoints(earned, max);
    setScores((prev) => [...prev, score]);
    setPointScores((prev) => [...prev, { earned, max }]);

    if (score === SCORE.WRONG) {
      setScreen(SCREEN.FOLLOW);
      return;
    }

    advanceToNext();
  }, [advanceToNext]);

  /* ── 解説コンパイル（解説部分をPDF化） ── */
  const handleCompileExplanation = useCallback(async () => {
    if (!latexForPdf) return;
    setExplanationPdfLoading(true);
    try {
      // generate_pdf に answers モード用の LaTeX を渡す
      // latexForPdf は full 版なので、そのまま送って PDF 取得
      const resp = await generatePdf(latexForPdf);
      if (resp?.pdf_url || resp?.url) {
        window.open(resp.pdf_url || resp.url, '_blank');
      }
    } catch (e) {
      console.error('解説PDF生成エラー:', e);
    }
    setExplanationPdfLoading(false);
  }, [latexForPdf]);

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
      setPointScores([]);
      setCurrent(0);
      setShowAnswer(false);
    }
  }, [scores]);

  /* ── 模試形式: 全問採点完了 ── */
  const handleExamFinish = useCallback((scoreArray, pointArray) => {
    setScores(scoreArray);
    setPointScores(pointArray || scoreArray.map(() => null));
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
    setPointScores([]);
    setCurrent(0);
    setShowAnswer(false);
    setLatexForPdf(null);
    setLatexAnswers(null);
    setPdfUrl(null);
    setAnswerPdfUrl(null);
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

  if (screen === SCREEN.PDF) {
    return (
      <PdfViewScreen
        pdfUrl={pdfUrl}
        pdfLoading={pdfLoading}
        pdfProgress={pdfProgress}
        answerPdfUrl={answerPdfUrl}
        answerPdfLoading={answerPdfLoading}
        onRevealAnswer={handleRevealAnswer}
        subject={subject}
        problems={problems}
        onFinish={(scoreArray, pointArray) => { setScores(scoreArray); setPointScores(pointArray || scoreArray.map(() => null)); setScreen(SCREEN.SUMMARY); }}
        onQuit={handleQuit}
      />
    );
  }

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
        onScorePoints={handleScorePoints}
        onSkip={handleSkip}
        onQuit={handleQuit}
        latexForPdf={latexForPdf}
        onDownloadPdf={handleDownloadPdf}
        onCompileExplanation={handleCompileExplanation}
        explanationPdfLoading={explanationPdfLoading}
        pdfLoading={pdfLoading}
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
        latexForPdf={latexForPdf}
        onDownloadPdf={handleDownloadPdf}
        pdfLoading={pdfLoading}
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
        pointScores={pointScores}
      />
    );
  }

  return null;
}
