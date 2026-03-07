'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { searchProblems, generateSimilarProblem } from '@/lib/api';
import { StatusBar, Button, EmptyState, Icons, PageHeader } from '@/components/ui';
import { SUBJECTS, DIFFICULTIES, SUBJECT_TOPICS, difficultyLabel } from '@/lib/constants';
import { LatexText, LatexBlock } from '@/components/LatexRenderer';

/* ── 科目カラーマップ ── */
const SUBJECT_COLORS = {
  '数学': '#3b82f6',
  '物理': '#8b5cf6',
  '英語': '#f59e0b',
  '化学': '#10b981',
  '生物': '#22c55e',
  '情報': '#06b6d4',
  '国語': '#ec4899',
  '社会': '#f97316',
  '地学': '#14b8a6',
  '理科': '#6366f1',
};

const SUBJECT_ICONS = {
  '数学': '∑',
  '物理': '⊛',
  '英語': '◎',
  '化学': '⬡',
  '生物': '◈',
  '情報': '▸',
  '国語': '〒',
  '社会': '△',
  '地学': '◇',
  '理科': '☼',
};

/* ── Badge ── */
function Badge({ children, color = 'slate' }) {
  const map = {
    indigo: 'bg-indigo-100/60 text-indigo-700 border-indigo-300/50',
    emerald: 'bg-emerald-100/60 text-emerald-700 border-emerald-300/50',
    amber: 'bg-amber-100/50 text-amber-700 border-amber-300/50',
    rose: 'bg-rose-100/50 text-rose-700 border-rose-300/50',
    violet: 'bg-violet-100/50 text-violet-700 border-violet-200/40',
    slate: 'bg-blue-50/60 text-[#64748b] border-blue-200/50',
    sky: 'bg-sky-100/50 text-sky-700 border-sky-200/40',
  };
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-0.5 rounded-full border ${map[color] || map.slate}`}>
      {children}
    </span>
  );
}

/* ── 科目チップ ── */
function SubjectChip({ subject, selected, onClick }) {
  const c = SUBJECT_COLORS[subject] || '#60a5fa';
  const icon = SUBJECT_ICONS[subject] || '•';
  return (
    <button onClick={onClick} type="button"
      className={`relative flex items-center gap-2 px-4 py-2.5 rounded-2xl text-[13px] font-bold
        transition-all duration-300 cursor-pointer select-none border
        ${selected
          ? 'text-white shadow-lg hover:shadow-xl scale-[1.02]'
          : 'bg-white text-[#64748b] border-blue-200/50 hover:border-blue-300/50 hover:bg-white hover:shadow-sm'
        } active:scale-[0.96]`}
      style={selected ? {
        background: `linear-gradient(135deg, ${c}, ${c}cc)`,
        borderColor: 'transparent',
        boxShadow: `0 4px 16px ${c}35`,
      } : {}}>
      <span className={`text-[14px] ${selected ? '' : 'opacity-50'}`}
            style={selected ? {} : { color: c }}>{icon}</span>
      {subject}
      {selected && (
        <svg className="w-3.5 h-3.5 ml-0.5 opacity-80" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      )}
    </button>
  );
}

/* ── 難易度セグメント ── */
function DifficultySegment({ difficulties, value, onChange }) {
  return (
    <div className="flex gap-1 p-1 bg-blue-50/50 rounded-2xl border border-blue-200/40">
      <button onClick={() => onChange('')} type="button"
        className={`px-3.5 py-2 rounded-[13px] text-[12px] font-bold transition-all duration-300
          ${!value ? 'bg-white text-[#1e293b] shadow-md' : 'text-[#94a3b8] hover:text-[#64748b] hover:bg-white/50'}`}>
        全て
      </button>
      {difficulties.map((d, i) => {
        const isActive = value === d.value;
        const intensity = (i + 1) / difficulties.length;
        const hue = 10 + (1 - intensity) * 30; // red → orange range
        const activeColor = `hsl(${hue}, 88%, ${55 - intensity * 12}%)`;
        return (
          <button key={d.value} onClick={() => onChange(isActive ? '' : d.value)} type="button"
            className={`group relative px-3 py-2 rounded-[13px] text-[12px] font-bold transition-all duration-300
              ${isActive
                ? 'text-white shadow-md'
                : 'text-[#94a3b8] hover:text-[#64748b] hover:bg-white/50'
              }`}
            style={isActive ? {
              background: `linear-gradient(135deg, ${activeColor}, ${activeColor}dd)`,
              boxShadow: `0 2px 10px ${activeColor}30`,
            } : {}}
            title={d.description}>
            {d.label}
            {/* レベルドット */}
            <span className="flex gap-[2px] justify-center mt-0.5">
              {Array.from({ length: i + 1 }).map((_, di) => (
                <span key={di} className="w-[3px] h-[3px] rounded-full transition-colors"
                  style={{ background: isActive ? 'rgba(255,255,255,0.7)' : `${activeColor}40` }} />
              ))}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ── 分野ドロップダウン(拡張) ── */
function FieldSelector({ subject, value, onChange, options }) {
  if (!subject) return null;
  const c = SUBJECT_COLORS[subject] || '#60a5fa';
  return (
    <div className="animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="relative group">
        <select value={value} onChange={(e) => onChange(e.target.value)}
          className="w-full pl-4 pr-10 py-3 rounded-2xl border border-blue-200/50 bg-white text-[13px]
                    text-[#1e293b] transition-all duration-300 cursor-pointer appearance-none font-semibold shadow-sm
                    hover:border-blue-300/50 hover:bg-white hover:shadow-md
                    focus:ring-2 focus:shadow-lg outline-none"
          style={{ '--tw-ring-color': `${c}20`, borderColor: value ? `${c}30` : undefined }}>
          <option value="">全分野</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-[#c7c7cc] group-hover:text-[#64748b] transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
        {value && (
          <div className="absolute top-2 right-8 w-1.5 h-1.5 rounded-full" style={{ background: c, opacity: 0.6 }} />
        )}
      </div>
    </div>
  );
}

function Skeleton({ className = '' }) {
  return <div className={`animate-pulse bg-blue-50/60 rounded-lg ${className}`} />;
}

function DetailBlock({ label, color = 'slate', children }) {
  const bgMap = { slate: 'bg-blue-50/60', blue: 'bg-blue-100/50', indigo: 'bg-blue-100/60', emerald: 'bg-blue-100/60' };
  return (
    <div>
      <div className="text-[10px] font-bold text-[#c7c7cc] mb-1.5">{label}</div>
      <div className={`text-sm text-[#1e293b] ${bgMap[color] || bgMap.slate} rounded-lg p-3 leading-relaxed`}>
        <LatexBlock>{children}</LatexBlock>
      </div>
    </div>
  );
}

/* ── メインページ ── */
export default function SearchPage() {
  const [status, setStatus] = useState('');
  const [query, setQuery] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [fieldFilter, setFieldFilter] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState('');
  const [results, setResults] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [searching, setSearching] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [generatingId, setGeneratingId] = useState(null);
  const [similarResults, setSimilarResults] = useState({});
  const [hasSearched, setHasSearched] = useState(false);
  const inputRef = useRef(null);

  // 分野選択肢を科目に連動
  const fieldOptions = subjectFilter && SUBJECT_TOPICS[subjectFilter]
    ? SUBJECT_TOPICS[subjectFilter].map((f) => ({ value: f, label: f }))
    : [];

  // 科目変更時に分野をリセット
  useEffect(() => { setFieldFilter(''); }, [subjectFilter]);

  const doSearch = useCallback(async (retryCount = 0) => {
    if (!query.trim() && !subjectFilter && !difficultyFilter) {
      setStatus('検索キーワード、科目、または難易度を指定してください');
      return;
    }
    setSearching(true);
    setStatus(retryCount > 0 ? `リトライ中... (${retryCount}/2)` : '');
    setHasSearched(true);
    try {
      const params = { limit: 20 };
      if (query.trim()) params.q = query.trim();
      if (subjectFilter) params.subject = subjectFilter;
      if (fieldFilter) params.topic = fieldFilter;
      if (difficultyFilter) params.difficulty = difficultyFilter;
      const data = await searchProblems(params);
      const items = data.results || data.problems || data || [];
      const list = Array.isArray(items) ? items : [];
      setResults(list);
      setTotalCount(data.total || list.length);
      if (list.length === 0) {
        setStatus('該当する問題が見つかりませんでした');
      } else {
        setStatus(`${list.length} 件の問題が見つかりました`);
      }
    } catch (e) {
      const msg = e.message || '';
      const isRetryable = msg.includes('500') || msg.includes('502') || msg.includes('504')
        || msg.includes('timeout') || msg.includes('unavailable');
      if (isRetryable && retryCount < 2) {
        // サーバーがコールドスタート中の場合、自動リトライ
        const delay = (retryCount + 1) * 2000;
        setStatus(`サーバー応答待ち... ${Math.round(delay / 1000)}秒後にリトライします`);
        setTimeout(() => doSearch(retryCount + 1), delay);
        return; // keep searching=true
      }
      setStatus(`検索エラー: ${msg}`);
      setResults([]);
    }
    setSearching(false);
  }, [query, subjectFilter, fieldFilter, difficultyFilter]);

  const handleKeyDown = (e) => { if (e.key === 'Enter') doSearch(); };

  const handleGenerateSimilar = async (item) => {
    const itemId = item.id;
    const stem = item.stem || item.text || '';
    if (!stem.trim()) { setStatus('問題文が空のため類題を生成できません'); return; }
    setGeneratingId(itemId);
    setStatus(`問題 #${itemId} の類題を生成中...`);
    try {
      const data = await generateSimilarProblem(stem, { num: 3, include_explanations: true });
      const variations = data.variations || data.retrieved || [];
      setSimilarResults((prev) => ({ ...prev, [itemId]: variations }));
      setStatus(`問題 #${itemId} の類題を ${variations.length} 件生成しました`);
    } catch (e) { setStatus(`類題生成エラー: ${e.message}`); }
    setGeneratingId(null);
  };

  const clearFilters = () => {
    setQuery(''); setSubjectFilter(''); setFieldFilter(''); setDifficultyFilter('');
    setResults([]); setHasSearched(false); setStatus('');
    inputRef.current?.focus();
  };

  const hasActiveFilters = query || subjectFilter || fieldFilter || difficultyFilter;

  return (
    <div className="max-w-3xl mx-auto space-y-4 sm:space-y-5 px-4 sm:px-5 py-6 sm:py-10 pb-28 sm:pb-12">
      {/* ── ヒーローヘッダー ── */}
      <div className="text-center mb-2 relative">
        <div className="absolute inset-0 -z-10 overflow-hidden rounded-3xl">
          <div className="absolute -top-10 -left-10 w-40 h-40 rounded-full bg-gradient-to-br from-blue-400/20 to-indigo-400/10 blur-3xl" />
          <div className="absolute -top-5 -right-10 w-32 h-32 rounded-full bg-gradient-to-bl from-purple-400/15 to-blue-400/10 blur-3xl" />
        </div>
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-[#3b82f6] to-[#2563eb] text-white mb-4 shadow-lg shadow-blue-500/25">
          <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <circle cx="10.5" cy="10.5" r="6.5" />
            <line x1="15.5" y1="15.5" x2="21" y2="21" strokeLinecap="round" />
          </svg>
        </div>
        <h1 className="text-[22px] sm:text-[26px] font-bold text-[#1e293b] tracking-[-0.02em] mb-1.5">問題をさがす</h1>
        <p className="text-[13px] text-[#94a3b8] leading-relaxed max-w-md mx-auto">
          保存された過去問をキーワード・科目・難易度で検索。<br className="hidden sm:block" />
          気になる問題から類題の自動生成もできます。
        </p>
      </div>

      <StatusBar message={status} />

      {/* ── 検索パネル ── */}
      <div className="relative overflow-hidden rounded-[20px] bg-white border border-blue-200/40"
           style={{ boxShadow: 'var(--shadow-card)' }}>

        <div className="p-4 sm:p-7 space-y-4 sm:space-y-5">

          {/* ── 検索バー ── */}
          <div className="relative group">
            <div className="relative flex items-center gap-2 bg-blue-50/40 rounded-[20px] border border-blue-200/50
                            group-focus-within:border-blue-300/60 group-focus-within:shadow-md
                            transition-all duration-300">
              <div className="flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 ml-1.5 rounded-2xl bg-blue-50/60 flex-shrink-0">
                <Icons.Search className="w-[18px] h-[18px] text-[#64748b]" />
              </div>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1 min-w-0 py-3.5 pr-2 bg-transparent text-[15px] font-medium text-[#1e293b] outline-none placeholder:text-[#c7c7cc]"
                placeholder="キーワードで検索..."
                autoFocus
              />
              <Button onClick={doSearch} disabled={searching} size="sm"
                className="mr-1.5 !rounded-2xl !px-5 !py-2.5">
                {searching ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    検索中
                  </span>
                ) : '検索'}
              </Button>
            </div>
          </div>

          {/* ── 科目チップ ── */}
          <div>
            <div className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-[0.15em] mb-2.5 px-0.5">科目</div>
            <div className="flex flex-wrap gap-2">
              {SUBJECTS.map((s) => (
                <SubjectChip key={s} subject={s}
                  selected={subjectFilter === s}
                  onClick={() => setSubjectFilter(subjectFilter === s ? '' : s)} />
              ))}
            </div>
          </div>

          {/* ── 分野 (科目選択時のみ表示) ── */}
          {subjectFilter && fieldOptions.length > 0 && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.15em] mb-2.5 px-0.5"
                   style={{ color: SUBJECT_COLORS[subjectFilter] || '#93c5fd' }}>
                {subjectFilter} の分野
              </div>
              <FieldSelector subject={subjectFilter} value={fieldFilter}
                onChange={setFieldFilter} options={fieldOptions} />
            </div>
          )}

          {/* ── 難易度 ── */}
          <div>
            <div className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-[0.15em] mb-2.5 px-0.5">難易度</div>
            <DifficultySegment difficulties={DIFFICULTIES} value={difficultyFilter} onChange={setDifficultyFilter} />
          </div>

          {/* ── アクティブフィルタ バー ── */}
          {hasActiveFilters && (
            <div className="flex items-center gap-2 pt-3 border-t border-blue-200/40">
              <span className="text-[10px] font-bold text-[#c7c7cc] flex-shrink-0">絞り込み</span>
              <div className="flex flex-wrap gap-1.5 flex-1 min-w-0">
                {query && (
                  <button onClick={() => setQuery('')}
                    className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1 rounded-full
                               bg-blue-100/50 text-[#334155] border border-blue-200/40 hover:bg-[#2563eb]/[0.14] transition-colors">
                    "{query}"
                    <svg className="w-3 h-3 opacity-50" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                )}
                {subjectFilter && (
                  <button onClick={() => setSubjectFilter('')}
                    className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1 rounded-full border hover:opacity-80 transition-opacity"
                    style={{ background: `${SUBJECT_COLORS[subjectFilter]}10`, color: SUBJECT_COLORS[subjectFilter], borderColor: `${SUBJECT_COLORS[subjectFilter]}20` }}>
                    {subjectFilter}
                    <svg className="w-3 h-3 opacity-50" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                )}
                {fieldFilter && (
                  <button onClick={() => setFieldFilter('')}
                    className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1 rounded-full
                               bg-blue-100/60 text-[#1e293b] border border-blue-300/50 hover:bg-[#2563eb]/[0.14] transition-colors">
                    {fieldFilter}
                    <svg className="w-3 h-3 opacity-50" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                )}
                {difficultyFilter && (
                  <button onClick={() => setDifficultyFilter('')}
                    className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1 rounded-full
                               bg-blue-100/50 text-[#475569] border border-blue-300/50/[0.12] hover:bg-[#475569]/[0.14] transition-colors">
                    {difficultyFilter}
                    <svg className="w-3 h-3 opacity-50" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                )}
              </div>
              <button onClick={clearFilters}
                className="text-[11px] text-[#94a3b8] hover:text-[#1e293b] transition-all font-semibold
                           flex items-center gap-1 px-3 py-1.5 rounded-xl hover:bg-blue-50/50 flex-shrink-0">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                全解除
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── ローディング表示 ── */}
      {searching && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card-premium p-5" style={{ animationDelay: `${i * 0.08}s` }}>
              <div className="flex gap-3">
                <Skeleton className="w-10 h-5" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="w-full h-4" />
                  <Skeleton className="w-2/3 h-4" />
                  <div className="flex gap-2 mt-2"><Skeleton className="w-16 h-5" /><Skeleton className="w-20 h-5" /></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── 検索結果 ── */}
      {!searching && results.length > 0 && (
        <div className="space-y-3">
          <div className="text-[11px] text-[#94a3b8] font-bold uppercase tracking-wider px-1">{totalCount} 件の結果</div>
          {results.map((item, idx) => {
            const isOpen = expandedId === (item.id ?? idx);
            const subj = item.subject || item.metadata?.subject || '';
            const field = item.topic || item.metadata?.field || '';
            return (
              <div key={item.id ?? idx}
                className={`result-item transition-all duration-300 
                  ${isOpen ? '!border-[#2563eb]/30 ring-1 ring-[#2563eb]/10 !bg-white shadow-lg' : ''}`}
                onClick={() => setExpandedId(isOpen ? null : (item.id ?? idx))}>
                <div className="p-5">
                  <div className="flex items-start gap-3">
                    <span className="text-[10px] text-[#94a3b8] font-mono mt-0.5 flex-shrink-0 w-8 text-right">#{item.id ?? idx + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] text-[#1e293b] leading-relaxed">
                        <LatexText>{(item.stem || item.text || '').slice(0, 200)}</LatexText>
                        {(item.stem || item.text || '').length > 200 ? <span className="text-[#c7c7cc]">...</span> : ''}
                      </div>
                      <div className="flex gap-1.5 mt-2.5 flex-wrap">
                        {subj && <Badge color="indigo">{subj}</Badge>}
                        {field && <Badge color="emerald">{field}</Badge>}
                        {item.difficulty != null && <Badge color="amber">{difficultyLabel(item.difficulty)}</Badge>}
                        {item.trickiness != null && item.trickiness > 0 && (
                          <Badge color="rose">引掛度 {Number(item.trickiness).toFixed(2)}</Badge>
                        )}
                        {item.source && <Badge color="slate">{item.source}</Badge>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {item.score != null && (
                        <span className="text-[10px] text-[#94a3b8] font-mono tabular-nums px-1.5 py-0.5 rounded-lg bg-blue-50/50">{Number(item.score).toFixed(3)}</span>
                      )}
                      <svg className={`w-4 h-4 text-[#c7c7cc] transition-transform duration-300 ${isOpen ? 'rotate-180 text-[#1e293b]' : ''}`}
                        fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* ── 展開コンテンツ ── */}
                {isOpen && (
                  <div className="px-5 pb-5 space-y-3 border-t border-blue-200/50 animate-expand" onClick={(e) => e.stopPropagation()}>
                    <div className="pt-4" />
                    {item.stem && <DetailBlock label="問題文">{item.stem}</DetailBlock>}
                    {item.solution_outline && <DetailBlock label="解法概要" color="blue">{item.solution_outline}</DetailBlock>}
                    {item.explanation && <DetailBlock label="解説" color="indigo">{item.explanation}</DetailBlock>}
                    {item.answer_brief && <DetailBlock label="解答" color="emerald">{item.answer_brief}</DetailBlock>}

                    {/* アクションボタン */}
                    <div className="flex items-center gap-3 pt-2">
                      <button onClick={() => handleGenerateSimilar(item)}
                        disabled={generatingId === (item.id ?? idx)}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold
                                   bg-[#2563eb] text-white
                                   shadow-md hover:shadow-lg
                                   hover:-translate-y-0.5 transition-all
                                   disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none active:scale-95">
                        {generatingId === (item.id ?? idx) ? (
                          <>
                            <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                            生成中...
                          </>
                        ) : (
                          <>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                            </svg>
                            この問題の類題を生成
                          </>
                        )}
                      </button>
                      <button onClick={() => { navigator.clipboard.writeText(item.stem || item.text || ''); setStatus('問題文をコピーしました'); }}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl text-xs font-bold
                                   text-[#64748b] bg-white border border-blue-200/50
                                   hover:bg-white hover:shadow-md hover:-translate-y-0.5 transition-all active:scale-95">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        コピー
                      </button>
                    </div>

                    {/* 類題生成結果 */}
                    {similarResults[item.id] && similarResults[item.id].length > 0 && (
                      <div className="mt-3 space-y-2">
                        <div className="text-xs font-semibold text-[#334155] uppercase">
                          生成された類題 ({similarResults[item.id].length}件)
                        </div>
                        {similarResults[item.id].map((sim, sIdx) => (
                          <div key={sIdx} className="bg-blue-100/50 rounded-lg p-3 border border-blue-200/50">
                            <LatexBlock className="text-xs text-[#1e293b]">
                              {sim.text || sim.stem || JSON.stringify(sim, null, 2)}
                            </LatexBlock>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── 空の状態 ── */}
      {!searching && results.length === 0 && hasSearched && (
        <EmptyState icon={<Icons.Empty />} title="検索結果なし"
          description="条件を変えて再検索してください。キーワードを短くするか、フィルタを外すと見つかりやすくなります。" />
      )}

      {/* ── 初回表示 ── */}
      {!searching && !hasSearched && (
        <div className="text-center py-12 sm:py-16">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-50/60 mb-5 shadow-sm">
            <Icons.Search className="w-7 h-7 text-[#2563eb]" />
          </div>
          <h3 className="text-[17px] font-bold text-[#1e293b] mb-2">キーワードや科目で検索</h3>
          <p className="text-[13px] text-[#94a3b8] max-w-sm mx-auto leading-relaxed mb-6">
            上の検索バーにキーワードを入力するか、<br />
            科目チップをタップして絞り込めます。
          </p>
          <div className="flex flex-wrap justify-center gap-2 max-w-xs mx-auto">
            {['二次関数', '微分', '力学', '英文法'].map((hint) => (
              <button key={hint} onClick={() => { setQuery(hint); }}
                className="px-3 py-1.5 rounded-full text-[12px] font-semibold text-[#64748b] bg-white border border-blue-200/50 
                           hover:border-[#2563eb]/30 hover:text-[#2563eb] hover:bg-blue-50/50 transition-all shadow-sm">
                {hint}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}