'use client';

import { useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { searchProblems } from '@/lib/api';
import { SUBJECT_TOPICS, DIFFICULTIES } from '@/lib/constants';
import { LatexBlock } from '@/components/LatexRenderer';
import { MobileNavLinks } from '@/components/ui';

/* ─────────────────────────────────────────────────────────────
   定数
───────────────────────────────────────────────────────────── */

const SCREEN = { SELECT: 'select', LOADING: 'loading', PROBLEM: 'problem', ANSWER: 'answer', SUMMARY: 'summary' };

const PRACTICE_SUBJECTS = ['物理', '数学', '化学'];

const SUBJECT_COLOR = {
  '物理': { accent: '#8b5cf6', light: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200', gradient: 'from-violet-500 to-violet-600', ring: '#8b5cf620' },
  '数学': { accent: '#3b82f6', light: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-200',   gradient: 'from-blue-500 to-blue-600',   ring: '#3b82f620' },
  '化学': { accent: '#10b981', light: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', gradient: 'from-emerald-500 to-emerald-600', ring: '#10b98120' },
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

function ProgressBar({ current, total }) {
  const pct = total > 0 ? (current / total) * 100 : 0;
  return (
    <div className="w-full h-1.5 bg-[#f1f5f9] rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #8b5cf6, #6366f1)' }}
      />
    </div>
  );
}

function ScoreButton({ type, onClick }) {
  const map = {
    [SCORE.CORRECT]: { label: '解けた', icon: '○', bg: '#f0fdf4', border: '#86efac', text: '#16a34a', active: '#22c55e' },
    [SCORE.DELTA]:   { label: '惜しい', icon: '△', bg: '#fffbeb', border: '#fcd34d', text: '#d97706', active: '#f59e0b' },
    [SCORE.WRONG]:   { label: 'わからない', icon: '×', bg: '#fef2f2', border: '#fca5a5', text: '#dc2626', active: '#ef4444' },
  };
  const s = map[type];
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex-1 flex flex-col items-center gap-1 py-3 rounded-2xl border-2 font-bold transition-all duration-150 active:scale-95"
      style={{ background: s.bg, borderColor: s.border, color: s.text }}
    >
      <span className="text-[22px] leading-none">{s.icon}</span>
      <span className="text-[11px]">{s.label}</span>
    </button>
  );
}

/* ─────────────────────────────────────────────────────────────
   選択画面 A
───────────────────────────────────────────────────────────── */

function SelectScreen({ onStart }) {
  const [subject, setSubject] = useState('物理');
  const [topics, setTopics] = useState([]);
  const [difficulty, setDifficulty] = useState('応用');
  const [numQ, setNumQ] = useState(5);

  const c = SUBJECT_COLOR[subject];
  const topicOptions = SUBJECT_TOPICS[subject] || [];

  const toggleTopic = (t) =>
    setTopics((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]);

  const handleStart = () => {
    onStart({ subject, topics, difficulty, numQ });
  };

  return (
    <div className="max-w-[480px] mx-auto px-5 pt-10 pb-16">

      {/* ヘッダー */}
      <div className="mb-8">
        <h1 className="text-[24px] font-black text-[#0f172a] tracking-[-0.03em] leading-tight">
          今日は何を練習する？
        </h1>
        <p className="text-[13px] text-[#94a3b8] mt-1.5">単元と難易度を選ぶだけ。すぐ始められる。</p>
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
        DBから問題を取得します。AI生成問題は「作る」から
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
   ローディング画面
───────────────────────────────────────────────────────────── */

function LoadingScreen({ subject }) {
  const c = SUBJECT_COLOR[subject] || SUBJECT_COLOR['物理'];
  return (
    <div className="max-w-[480px] mx-auto px-5 pt-20 flex flex-col items-center gap-6">
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
           style={{ background: `linear-gradient(135deg, ${c.accent}, ${c.accent}cc)` }}>
        <svg className="w-7 h-7 text-white animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      </div>
      <div className="text-center">
        <p className="text-[16px] font-bold text-[#1e293b]">問題を取得中...</p>
        <p className="text-[12px] text-[#94a3b8] mt-1">DBから最適な問題を選んでいます</p>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   問題画面 B + 解答画面 C
───────────────────────────────────────────────────────────── */

function ProblemScreen({ problem, index, total, subject, showAnswer, onShowAnswer, onScore }) {
  const c = SUBJECT_COLOR[subject] || SUBJECT_COLOR['物理'];
  const stem = problem?.stem || problem?.text || problem?.question || '';
  const answer = problem?.answer || problem?.solution || '';
  const explanation = problem?.explanation || problem?.解説 || '';
  const topic = problem?.topic || problem?.metadata?.field || '';
  const diffLabel = EXAM_LEVELS.find((l) => l.value === (problem?.difficulty || problem?.metadata?.difficulty))?.label || '';

  return (
    <div className="max-w-[480px] mx-auto px-5 pt-8 pb-16">

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
          <span className="text-[12px] font-bold text-[#94a3b8]">
            {index + 1} / {total}
          </span>
        </div>
        <ProgressBar current={index + (showAnswer ? 1 : 0.5)} total={total} />
      </div>

      {/* 問題本文 */}
      <div className="bg-white rounded-2xl border border-[#e2e8f0] p-5 mb-5 shadow-sm">
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
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   弱点フォロー画面 D（×のとき）
───────────────────────────────────────────────────────────── */

function FollowScreen({ problem, subject, onContinue, onSkip }) {
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
        className="w-full py-4 rounded-2xl text-[15px] font-black text-white shadow-lg mb-3 transition-all active:scale-[0.98]"
        style={{ background: `linear-gradient(135deg, ${c.accent}, ${c.accent}cc)` }}
      >
        同じ単元をもう1問 →
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

function SummaryScreen({ scores, problems, subject, onRetry, onRestart }) {
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
  const [screen, setScreen]     = useState(SCREEN.SELECT);
  const [config, setConfig]     = useState(null);   // { subject, topics, difficulty, numQ }
  const [problems, setProblems] = useState([]);
  const [current, setCurrent]   = useState(0);
  const [scores, setScores]     = useState([]);
  const [showAnswer, setShowAnswer] = useState(false);
  const [error, setError]       = useState('');
  // × 後のフォローアップ用に追加問題をキューに積む
  const extraQueue = useRef([]);

  /* ── 問題取得 ── */
  const fetchProblems = useCallback(async ({ subject, topics, difficulty, numQ }) => {
    setScreen(SCREEN.LOADING);
    setError('');
    try {
      const params = { subject, difficulty, limit: numQ * 2 }; // 多めに取って shuffle
      if (topics.length === 1) params.topic = topics[0];
      const data = await searchProblems(params);
      let items = data?.results || data?.problems || (Array.isArray(data) ? data : []);

      // トピック複数指定の場合はフィルタ
      if (topics.length > 1) {
        items = items.filter((p) => topics.includes(p?.topic || p?.metadata?.field));
      }

      // Fisher-Yates shuffle
      for (let i = items.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [items[i], items[j]] = [items[j], items[i]];
      }
      items = items.slice(0, numQ);

      if (items.length === 0) {
        setError('この条件に合う問題がDBに見つかりませんでした。条件を変えて試してください。');
        setScreen(SCREEN.SELECT);
        return;
      }

      setProblems(items);
      setCurrent(0);
      setScores([]);
      setShowAnswer(false);
      extraQueue.current = [];
      setScreen(SCREEN.PROBLEM);
    } catch (e) {
      setError(`問題の取得に失敗しました: ${e.message}`);
      setScreen(SCREEN.SELECT);
    }
  }, []);

  /* ── 開始 ── */
  const handleStart = useCallback((cfg) => {
    setConfig(cfg);
    fetchProblems(cfg);
  }, [fetchProblems]);

  /* ── 解答表示 ── */
  const handleShowAnswer = useCallback(() => setShowAnswer(true), []);

  /* ── 自己採点 ── */
  const handleScore = useCallback((score) => {
    const newScores = [...scores, score];
    setScores(newScores);

    if (score === SCORE.WRONG) {
      // × → フォローアップ画面へ
      setScreen(SCREEN.ANSWER); // 一時的に ANSWER を flow-marker として使用
      // フォローアップに遷移
      setTimeout(() => setScreen('follow'), 0);
      return;
    }

    // ○ or △ → 次の問題 or サマリー
    const next = current + 1;
    if (next >= problems.length && extraQueue.current.length === 0) {
      setScreen(SCREEN.SUMMARY);
    } else {
      if (next < problems.length) {
        setCurrent(next);
      } else {
        // extraQueue から次の問題を積む
        const extra = extraQueue.current.shift();
        const newProblems = [...problems, extra];
        setProblems(newProblems);
        setCurrent(next);
      }
      setShowAnswer(false);
      setScreen(SCREEN.PROBLEM);
    }
  }, [scores, current, problems]);

  /* ── フォロー: 同じ単元をもう1問 ── */
  const handleFollowContinue = useCallback(async () => {
    const cur = problems[current];
    const topic = cur?.topic || cur?.metadata?.field;
    try {
      const params = { subject: config.subject, limit: 5 };
      if (topic) params.topic = topic;
      const data = await searchProblems(params);
      const items = data?.results || data?.problems || (Array.isArray(data) ? data : []);
      // すでに解いた問題を除外
      const used = new Set(problems.map((p) => p?.id).filter(Boolean));
      const fresh = items.filter((p) => !used.has(p?.id));
      if (fresh.length > 0) {
        extraQueue.current.push(fresh[0]);
      }
    } catch { /* エラーでも続行 */ }
    handleFollowSkip();
  }, [problems, current, config]);

  /* ── フォロー: スキップ ── */
  const handleFollowSkip = useCallback(() => {
    const next = current + 1;
    if (next >= problems.length && extraQueue.current.length === 0) {
      setScreen(SCREEN.SUMMARY);
    } else {
      if (next < problems.length) {
        setCurrent(next);
      } else {
        const extra = extraQueue.current.shift();
        const newProblems = [...problems, extra];
        setProblems(newProblems);
        setCurrent(next);
      }
      setShowAnswer(false);
      setScreen(SCREEN.PROBLEM);
    }
  }, [current, problems]);

  /* ── リトライ（同じ設定で再取得） ── */
  const handleRetry = useCallback(() => {
    if (config) fetchProblems(config);
  }, [config, fetchProblems]);

  /* ── リスタート（選択画面へ） ── */
  const handleRestart = useCallback(() => {
    setScreen(SCREEN.SELECT);
    setProblems([]);
    setScores([]);
    setCurrent(0);
    setShowAnswer(false);
  }, []);

  /* ── レンダー ── */
  const subject = config?.subject || '物理';

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
        <SelectScreen onStart={handleStart} />
      </>
    );
  }

  if (screen === SCREEN.LOADING) return <LoadingScreen subject={subject} />;

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
      />
    );
  }

  if (screen === 'follow') {
    return (
      <FollowScreen
        problem={problems[current]}
        subject={subject}
        onContinue={handleFollowContinue}
        onSkip={handleFollowSkip}
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
      />
    );
  }

  return null;
}
