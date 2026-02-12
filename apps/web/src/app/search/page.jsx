'use client';

import { useState } from 'react';
import { searchProblems, generateSimilarProblem } from '@/lib/api';
import { StatusBar, Button, SelectField, SectionCard, EmptyState, Icons, PageHeader } from '@/components/ui';
import { SUBJECTS, DIFFICULTIES, difficultyLabel } from '@/lib/constants';

export default function SearchPage() {
  const [status, setStatus] = useState('');
  const [query, setQuery] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [generatingId, setGeneratingId] = useState(null);
  const [similarResults, setSimilarResults] = useState({});

  const doSearch = async () => {
    if (!query.trim() && !subjectFilter) {
      setStatus('検索キーワードまたは科目フィルタを指定してください');
      return;
    }
    setSearching(true);
    setStatus('検索中...');
    try {
      const params = {};
      if (query.trim()) params.q = query.trim();
      if (subjectFilter) params.topic = subjectFilter;
      if (difficultyFilter) params.difficulty = difficultyFilter;
      const data = await searchProblems(params);
      const items = data.results || data.problems || data || [];
      setResults(Array.isArray(items) ? items : []);
      setStatus(`${Array.isArray(items) ? items.length : 0}件見つかりました`);
    } catch (e) {
      setStatus(`検索エラー: ${e.message}`);
      setResults([]);
    }
    setSearching(false);
  };

  const handleGenerateSimilar = async (item) => {
    const itemId = item.id;
    const stem = item.stem || item.text || '';
    if (!stem.trim()) {
      setStatus('問題文が空のため類題を生成できません');
      return;
    }
    setGeneratingId(itemId);
    setStatus(`問題 #${itemId} の類題を生成中...`);
    try {
      const data = await generateSimilarProblem(stem, {
        num: 3,
        include_explanations: true,
      });
      const variations = data.variations || data.retrieved || [];
      setSimilarResults((prev) => ({ ...prev, [itemId]: variations }));
      setStatus(`問題 #${itemId} の類題を ${variations.length} 件生成しました`);
    } catch (e) {
      setStatus(`類題生成エラー: ${e.message}`);
    }
    setGeneratingId(null);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <PageHeader
        title="問題検索"
        description="DBに保存された問題を検索・閲覧。科目や難易度での絞り込みが可能です。"
        icon={<Icons.Search />}
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Search' }]}
      />

      <StatusBar message={status} />

      {/* 検索フォーム */}
      <SectionCard title="検索条件" icon={<Icons.Search />} className="mb-8">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-[11px] font-black text-slate-400 mb-2 tracking-[0.1em] uppercase">
              キーワード
            </label>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && doSearch()}
              className="w-full px-4 py-3 rounded-2xl border-2 border-slate-100 bg-white/50 text-sm
                         text-slate-700 transition-all hover:border-indigo-200 focus:border-indigo-500
                         focus:bg-white outline-none shadow-sm placeholder:text-slate-300"
              placeholder="二次関数、微分、確率 ..."
            />
          </div>

          <SelectField
            label="科目"
            value={subjectFilter}
            onChange={setSubjectFilter}
            options={[
              { value: '', label: '全て' },
              ...SUBJECTS.map((s) => ({ value: s, label: s })),
            ]}
          />

          <SelectField
            label="難易度"
            value={difficultyFilter}
            onChange={setDifficultyFilter}
            options={[
              { value: '', label: '全て' },
              ...DIFFICULTIES.map((d) => ({ value: d, label: d })),
            ]}
          />

          <Button onClick={doSearch} disabled={searching} className="mb-1">
            {searching ? '検索中...' : <span className="flex items-center gap-2"><Icons.Search /> 検索</span>}
          </Button>
        </div>
      </SectionCard>

      {/* 検索結果 */}
      {results.length > 0 && (
        <div className="space-y-3">
          {results.map((item, idx) => {
            const isOpen = selectedId === (item.id || idx);
            return (
              <div
                key={item.id || idx}
                className={`bg-white rounded-2xl border p-5 transition-all duration-200 cursor-pointer
                  ${isOpen
                    ? 'border-indigo-200 ring-1 ring-indigo-100 shadow-card-hover'
                    : 'border-slate-200/80 shadow-card hover:shadow-card-hover'
                  }`}
                onClick={() => setSelectedId(isOpen ? null : (item.id || idx))}
              >
                <div className="flex items-start gap-3">
                  <span className="text-xs text-slate-300 font-mono mt-0.5">
                    #{item.id || idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-slate-700 leading-relaxed">
                      {(item.stem || item.normalized_text || item.text || '').slice(0, 120)}
                      {(item.stem || item.normalized_text || item.text || '').length > 120 ? '...' : ''}
                    </div>
                    <div className="flex gap-2 mt-2 flex-wrap">
                      {item.metadata?.subject && (
                        <span className="badge badge-primary">
                          <Icons.Book className="w-3 h-3 mr-1" />
                          {item.metadata.subject}
                        </span>
                      )}
                      {item.difficulty != null && (
                        <span className="badge badge-warning">
                          <Icons.Chart className="w-3 h-3 mr-1" />
                          {difficultyLabel(item.difficulty)}
                        </span>
                      )}
                      {item.trickiness != null && (
                        <span className="badge badge-danger">
                          <Icons.Target className="w-3 h-3 mr-1" />
                          {Number(item.trickiness).toFixed(2)}
                        </span>
                      )}
                      {item.source && (
                        <span className="badge badge-neutral">
                          <Icons.File className="w-3 h-3 mr-1" />
                          {item.source}
                        </span>
                      )}
                    </div>
                  </div>
                  <svg
                    className={`w-5 h-5 text-slate-300 transition-transform duration-200 flex-shrink-0 ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>

                {isOpen && (
                  <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
                    {item.stem && (
                      <div>
                        <div className="text-xs font-semibold text-slate-400 mb-1 uppercase">問題文</div>
                        <pre className="text-xs whitespace-pre-wrap text-slate-600 bg-slate-50/80 rounded-xl p-3 font-mono">
                          {item.stem}
                        </pre>
                      </div>
                    )}
                    {item.solution_outline && (
                      <div>
                        <div className="text-xs font-semibold text-slate-400 mb-1 uppercase">解法概要</div>
                        <pre className="text-xs whitespace-pre-wrap text-slate-600 bg-slate-50/80 rounded-xl p-3 font-mono">
                          {item.solution_outline}
                        </pre>
                      </div>
                    )}
                    {item.explanation && (
                      <div>
                        <div className="text-xs font-semibold text-slate-400 mb-1 uppercase">解説</div>
                        <pre className="text-xs whitespace-pre-wrap text-slate-600 bg-indigo-50/50 rounded-xl p-3 font-mono">
                          {item.explanation}
                        </pre>
                      </div>
                    )}
                    {item.answer_brief && (
                      <div>
                        <div className="text-xs font-semibold text-slate-400 mb-1 uppercase">解答</div>
                        <pre className="text-xs whitespace-pre-wrap text-emerald-700 bg-emerald-50/50 rounded-xl p-3 font-mono">
                          {item.answer_brief}
                        </pre>
                      </div>
                    )}

                    {/* 類題生成ボタン */}
                    <div className="pt-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleGenerateSimilar(item); }}
                        disabled={generatingId === (item.id || idx)}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold
                                   bg-gradient-to-r from-violet-500 to-indigo-500 text-white
                                   hover:from-violet-600 hover:to-indigo-600 transition-all
                                   disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                      >
                        {generatingId === (item.id || idx) ? (
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
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                    d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                            </svg>
                            この問題の類題を生成
                          </>
                        )}
                      </button>
                    </div>

                    {/* 類題生成結果 */}
                    {similarResults[item.id] && similarResults[item.id].length > 0 && (
                      <div className="mt-3 space-y-2">
                        <div className="text-xs font-semibold text-violet-500 mb-1 uppercase">
                          生成された類題 ({similarResults[item.id].length}件)
                        </div>
                        {similarResults[item.id].map((sim, sIdx) => (
                          <div key={sIdx} className="bg-violet-50/50 rounded-xl p-3 border border-violet-100">
                            <pre className="text-xs whitespace-pre-wrap text-slate-700 font-mono">
                              {sim.text || sim.stem || JSON.stringify(sim, null, 2)}
                            </pre>
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

      {results.length === 0 && !searching && status.includes('見つかり') && (
        <EmptyState
          icon={<Icons.Empty />}
          title="検索結果なし"
          description="条件を変えて再検索してください"
        />
      )}
    </div>
  );
}