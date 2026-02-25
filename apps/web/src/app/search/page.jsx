'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { searchProblems, generateSimilarProblem } from '@/lib/api';
import { StatusBar, Button, SelectField, SectionCard, EmptyState, Icons, PageHeader } from '@/components/ui';
import { SUBJECTS, DIFFICULTIES, SUBJECT_TOPICS, difficultyLabel } from '@/lib/constants';
import { LatexText, LatexBlock } from '@/components/LatexRenderer';

/* ── 小さなUIパーツ ── */
function Badge({ children, color = 'slate' }) {
  const map = {
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
    rose: 'bg-rose-50 text-rose-600 border-rose-100',
    violet: 'bg-violet-50 text-violet-600 border-violet-100',
    slate: 'bg-gray-50 text-gray-500 border-gray-100',
    sky: 'bg-sky-50 text-sky-600 border-sky-100',
  };
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${map[color] || map.slate}`}>
      {children}
    </span>
  );
}

function Skeleton({ className = '' }) {
  return <div className={`animate-pulse bg-gray-200 rounded-lg ${className}`} />;
}

function DetailBlock({ label, color = 'slate', children }) {
  const bgMap = { slate: 'bg-gray-50', blue: 'bg-blue-50', indigo: 'bg-indigo-50', emerald: 'bg-emerald-50' };
  return (
    <div>
      <div className="text-[10px] font-bold text-gray-400 mb-1.5">{label}</div>
      <div className={`text-sm text-gray-600 ${bgMap[color] || bgMap.slate} rounded-lg p-3 leading-relaxed`}>
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
    <div className="max-w-5xl mx-auto space-y-6">
      <PageHeader
        title="問題検索"
        description="DBに保存された問題を検索・閲覧。科目・分野・難易度での絞り込みや類題生成も可能です。"
        icon={<Icons.Search />}
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Search' }]}
      />

      <StatusBar message={status} />

      {/* ── 検索フォーム ── */}
      <SectionCard title="検索条件" icon={<Icons.Search />}>
        {/* キーワード入力行 */}
        <div className="flex items-end gap-3 mb-4">
          <div className="flex-1 min-w-0">
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">
              キーワード
            </label>
            <div className="relative">
              <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300 pointer-events-none" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-100 bg-white text-sm
                           text-gray-700 transition-all hover:border-gray-300 focus:border-indigo-500
                           focus:ring-2 focus:ring-indigo-500/10 outline-none placeholder:text-gray-300"
                placeholder="二次関数、微分、確率 ..."
                autoFocus
              />
            </div>
          </div>
          <Button onClick={doSearch} disabled={searching} className="mb-0.5">
            {searching ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                検索中...
              </span>
            ) : (
              <span className="flex items-center gap-2"><Icons.Search className="w-4 h-4" /> 検索</span>
            )}
          </Button>
        </div>

        {/* フィルタ行 */}
        <div className="flex flex-wrap items-end gap-3">
          <SelectField label="科目" value={subjectFilter} onChange={setSubjectFilter}
            options={[{ value: '', label: '全科目' }, ...SUBJECTS.map((s) => ({ value: s, label: s }))]} />

          <SelectField label="分野" value={fieldFilter} onChange={setFieldFilter}
            options={[{ value: '', label: subjectFilter ? '全分野' : '科目を先に選択' }, ...fieldOptions]} />

          <SelectField label="難易度" value={difficultyFilter} onChange={setDifficultyFilter}
            options={[{ value: '', label: '全て' }, ...DIFFICULTIES.map((d) => ({ value: d, label: d }))]} />

          {hasActiveFilters && (
            <button onClick={clearFilters}
              className="mb-1 text-xs text-gray-400 hover:text-rose-500 transition-colors font-medium
                         flex items-center gap-1 px-3 py-2 rounded-lg hover:bg-rose-50">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              クリア
            </button>
          )}
        </div>

        {/* アクティブフィルタ表示 */}
        {hasActiveFilters && (
          <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-100">
            {query && <Badge color="sky">キーワード: {query}</Badge>}
            {subjectFilter && <Badge color="indigo">{subjectFilter}</Badge>}
            {fieldFilter && <Badge color="emerald">{fieldFilter}</Badge>}
            {difficultyFilter && <Badge color="amber">難易度: {difficultyFilter}</Badge>}
          </div>
        )}
      </SectionCard>

      {/* ── ローディング表示 ── */}
      {searching && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-lg border border-gray-200 p-5">
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
          <div className="text-xs text-gray-400 font-medium px-1">{totalCount} 件の結果</div>
          {results.map((item, idx) => {
            const isOpen = expandedId === (item.id ?? idx);
            const subj = item.subject || item.metadata?.subject || '';
            const field = item.topic || item.metadata?.field || '';
            return (
              <div key={item.id ?? idx}
                className={`bg-white rounded-lg border transition-all duration-200 cursor-pointer
                  ${isOpen ? 'border-indigo-200 ring-1 ring-indigo-100 shadow-card-hover'
                           : 'border-gray-200 shadow-card hover:shadow-card-hover hover:border-gray-300'}`}
                onClick={() => setExpandedId(isOpen ? null : (item.id ?? idx))}>
                <div className="p-5">
                  <div className="flex items-start gap-3">
                    <span className="text-xs text-gray-300 font-mono mt-0.5 flex-shrink-0 w-8 text-right">#{item.id ?? idx + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-gray-700 leading-relaxed">
                        <LatexText>{(item.stem || item.text || '').slice(0, 200)}</LatexText>
                        {(item.stem || item.text || '').length > 200 ? <span className="text-gray-400">...</span> : ''}
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
                        <span className="text-[10px] text-gray-300 font-mono tabular-nums">{Number(item.score).toFixed(3)}</span>
                      )}
                      <svg className={`w-4 h-4 text-gray-300 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                        fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* ── 展開コンテンツ ── */}
                {isOpen && (
                  <div className="px-5 pb-5 space-y-3 border-t border-gray-100" onClick={(e) => e.stopPropagation()}>
                    <div className="pt-4" />
                    {item.stem && <DetailBlock label="問題文">{item.stem}</DetailBlock>}
                    {item.solution_outline && <DetailBlock label="解法概要" color="blue">{item.solution_outline}</DetailBlock>}
                    {item.explanation && <DetailBlock label="解説" color="indigo">{item.explanation}</DetailBlock>}
                    {item.answer_brief && <DetailBlock label="解答" color="emerald">{item.answer_brief}</DetailBlock>}

                    {/* アクションボタン */}
                    <div className="flex items-center gap-3 pt-2">
                      <button onClick={() => handleGenerateSimilar(item)}
                        disabled={generatingId === (item.id ?? idx)}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold
                                   bg-gradient-to-r from-violet-500 to-indigo-500 text-white
                                   hover:from-violet-600 hover:to-indigo-600 transition-all
                                   disabled:opacity-50 disabled:cursor-not-allowed shadow-sm">
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
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium
                                   text-gray-500 bg-gray-50 hover:bg-gray-100 transition-colors">
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
                        <div className="text-xs font-semibold text-violet-500 uppercase">
                          生成された類題 ({similarResults[item.id].length}件)
                        </div>
                        {similarResults[item.id].map((sim, sIdx) => (
                          <div key={sIdx} className="bg-violet-50 rounded-lg p-3 border border-violet-100">
                            <LatexBlock className="text-xs text-gray-700">
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
        <div className="text-center py-16">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-lg bg-gradient-to-br from-indigo-100 to-violet-100 mb-4">
            <Icons.Search className="w-7 h-7 text-indigo-400" />
          </div>
          <p className="text-sm text-gray-400 max-w-md mx-auto leading-relaxed">
            キーワードや科目・分野で問題を検索できます。<br />
            検索結果から類題の自動生成も可能です。
          </p>
        </div>
      )}
    </div>
  );
}