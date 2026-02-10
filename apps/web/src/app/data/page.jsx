'use client';

import { useState, useCallback } from 'react';
import { uploadJson, searchProblems } from '@/lib/api';
import {
  StatusBar,
  SectionCard,
  TextArea,
  Button,
  SelectField,
  EmptyState,
  Tabs,
  Icons,
  PageHeader,
} from '@/components/ui';
import { SUBJECTS, DIFFICULTIES, difficultyLabel } from '@/lib/constants';

export default function DataPage() {
  const [status, setStatus] = useState('');
  const [activeTab, setActiveTab] = useState('ingest');

  // ── インジェスト State ──
  const [ingestText, setIngestText] = useState('');
  const [ingestSubject, setIngestSubject] = useState('数学');
  const [ingestSource, setIngestSource] = useState('');
  const [ingesting, setIngesting] = useState(false);
  const [ingestResult, setIngestResult] = useState(null);

  // ── ブラウズ State ──
  const [browseQuery, setBrowseQuery] = useState('');
  const [browseSubject, setBrowseSubject] = useState('');
  const [browseResults, setBrowseResults] = useState([]);
  const [browsing, setBrowsing] = useState(false);
  const [selectedProblem, setSelectedProblem] = useState(null);

  // ── データ投入 ──
  const handleIngest = async () => {
    if (!ingestText.trim()) {
      setStatus('テキストを入力してください');
      return;
    }
    setIngesting(true);
    setStatus('データをチャンクしてDBに投入中...');
    try {
      const isLatex =
        ingestText.includes('\\begin{') ||
        ingestText.includes('\\section') ||
        ingestText.includes('\\item') ||
        ingestText.includes('$');

      const body = {
        ...(isLatex ? { latex: ingestText } : { plain_text: ingestText }),
        source: ingestSource || 'manual_input',
        metadata: { subject: ingestSubject },
      };
      const data = await uploadJson(body);
      setIngestResult(data);
      setStatus(
        `DB投入完了！doc_id: ${data.doc_id || '—'} / チャンク数: ${data.chunk_count || data.count || '—'}`
      );
    } catch (e) {
      setStatus(`投入エラー: ${e.message}`);
    }
    setIngesting(false);
  };

  // ── データブラウズ ──
  const handleBrowse = async () => {
    setBrowsing(true);
    setStatus('データを取得中...');
    try {
      const params = {};
      if (browseQuery.trim()) params.q = browseQuery.trim();
      if (browseSubject) params.topic = browseSubject;
      const data = await searchProblems(params);
      const items = data.results || data.problems || data || [];
      setBrowseResults(Array.isArray(items) ? items : []);
      setStatus(`${Array.isArray(items) ? items.length : 0}件取得`);
    } catch (e) {
      setStatus(`取得エラー: ${e.message}`);
      setBrowseResults([]);
    }
    setBrowsing(false);
  };

  const tabs = [
    { id: 'ingest', label: 'データ投入', icon: <Icons.Data /> },
    { id: 'browse', label: 'データ閲覧', icon: <Icons.Search /> },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <PageHeader
        title="データ管理・構築"
        description="RAGの情報源データを投入・管理。テキスト/LaTeX/JSONを自動チャンクしてDBに保存。"
        icon={<Icons.Data />}
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Data Management' }]}
      />

      <StatusBar message={status} />

      {/* タブ切替 */}
      <div className="mb-6">
        <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
      </div>

      {/* ── データ投入タブ ── */}
      {activeTab === 'ingest' && (
        <div className="space-y-5">
          <SectionCard
            title="テキスト・LaTeX・JSON を投入"
            icon={<Icons.Data />}
            subtitle="貼り付けたデータを自動でチャンク分割し、problemsテーブルに保存します"
          >
            <TextArea
              label="投入データ"
              value={ingestText}
              onChange={setIngestText}
              rows={12}
              placeholder={`問題データをここに貼り付けてください。\n\n対応フォーマット:\n• LaTeX (\\begin{problem}...\\end{problem})\n• プレーンテキスト（問1. ... 解答: ...）\n• JSON（{\"problem\": {\"stem\": \"...\"}}）\n\n自動的にチャンク分割されDBに保存されます。`}
            />

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
              <SelectField
                label="科目"
                value={ingestSubject}
                onChange={setIngestSubject}
                options={SUBJECTS.map((s) => ({ value: s, label: s }))}
              />
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">
                  ソース
                </label>
                <input
                  value={ingestSource}
                  onChange={(e) => setIngestSource(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm input-ring placeholder:text-slate-300"
                  placeholder="教科書名、URL等"
                />
              </div>
            </div>

            <div className="mt-4 flex items-center gap-3">
              <Button
                variant="success"
                onClick={handleIngest}
                disabled={ingesting || !ingestText.trim()}
              >
                {ingesting ? (
                  <span className="flex items-center gap-2">
                    <Icons.Info className="animate-pulse" /> 投入中...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Icons.Data /> チャンクしてDB投入
                  </span>
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIngestText('');
                  setIngestResult(null);
                  setStatus('');
                }}
              >
                クリア
              </Button>
            </div>

            {ingestResult && (
              <div className="mt-4 p-4 bg-emerald-50/50 rounded-xl border border-emerald-200/60">
                <div className="text-sm font-semibold text-emerald-700 mb-2">投入結果</div>
                <div className="grid grid-cols-2 gap-2 text-xs text-emerald-600">
                  {ingestResult.doc_id && (
                    <div>
                      <span className="text-emerald-400">doc_id:</span>{' '}
                      <span className="font-mono">{ingestResult.doc_id}</span>
                    </div>
                  )}
                  {(ingestResult.chunk_count || ingestResult.count) && (
                    <div>
                      <span className="text-emerald-400">チャンク数:</span>{' '}
                      <strong>{ingestResult.chunk_count || ingestResult.count}</strong>
                    </div>
                  )}
                  {ingestResult.inserted_ids && (
                    <div className="col-span-2">
                      <span className="text-emerald-400">問題ID:</span>{' '}
                      <span className="font-mono">
                        {Array.isArray(ingestResult.inserted_ids)
                          ? ingestResult.inserted_ids.join(', ')
                          : JSON.stringify(ingestResult.inserted_ids)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </SectionCard>

          {/* ヒント */}
          <div className="p-4 bg-indigo-50/50 rounded-xl border border-indigo-200/40">
            <div className="text-xs font-semibold text-indigo-600 mb-2 flex items-center gap-2">
              <Icons.Info className="w-3.5 h-3.5" />
              投入のヒント
            </div>
            <ul className="text-xs text-indigo-500 space-y-1.5 list-none">
              <li>• LaTeX形式の場合、<code className="bg-indigo-100 px-1 rounded">\begin{'{'}problem{'}'}</code> や <code className="bg-indigo-100 px-1 rounded">\item</code> で自動分割</li>
              <li>• テキスト形式の場合、「問1.」「Q1.」などの見出しで自動分割</li>
              <li>• JSON形式（<code className="bg-indigo-100 px-1 rounded">{'{"stem":"...","solution_outline":"..."}'}</code>）も対応</li>
              <li>• 大量のデータは複数回に分けて投入すると安定します</li>
            </ul>
          </div>
        </div>
      )}

      {/* ── データ閲覧タブ ── */}
      {activeTab === 'browse' && (
        <div className="space-y-5">
          <SectionCard title="保存済みデータの閲覧" icon={<Icons.Search />}>
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">
                  キーワード
                </label>
                <input
                  type="text"
                  value={browseQuery}
                  onChange={(e) => setBrowseQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleBrowse()}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm input-ring
                             placeholder:text-slate-300"
                  placeholder="検索ワード（任意）"
                />
              </div>
              <SelectField
                label="科目"
                value={browseSubject}
                onChange={setBrowseSubject}
                options={[
                  { value: '', label: '全て' },
                  ...SUBJECTS.map((s) => ({ value: s, label: s })),
                ]}
              />
              <Button onClick={handleBrowse} disabled={browsing}>
                {browsing ? '取得中...' : <span className="flex items-center gap-2"><Icons.Search className="w-4 h-4" /> データを取得</span>}
              </Button>
            </div>
          </SectionCard>

          {browseResults.length > 0 ? (
            <div className="space-y-3">
              <div className="text-xs text-slate-400 font-semibold uppercase tracking-wide">
                {browseResults.length} 件のデータ
              </div>
              {browseResults.map((item, idx) => {
                const isOpen = selectedProblem === (item.id || idx);
                return (
                  <div
                    key={item.id || idx}
                    className={`bg-white rounded-2xl border p-4 cursor-pointer transition-all duration-200
                      ${isOpen
                        ? 'border-indigo-200 ring-1 ring-indigo-100 shadow-card-hover'
                        : 'border-slate-200/80 shadow-card hover:shadow-card-hover'
                      }`}
                    onClick={() => setSelectedProblem(isOpen ? null : (item.id || idx))}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-xs text-slate-300 font-mono mt-0.5">
                        #{item.id || idx + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-slate-700">
                          {(item.stem || item.text || item.normalized_text || '').slice(0, 100)}
                          {(item.stem || item.text || '').length > 100 ? '...' : ''}
                        </div>
                        <div className="flex gap-1.5 mt-2 flex-wrap">
                          {item.metadata?.subject && (
                            <span className="badge badge-primary">{item.metadata.subject}</span>
                          )}
                          {item.difficulty != null && (
                            <span className="badge badge-warning">{difficultyLabel(item.difficulty)}</span>
                          )}
                          {item.source && (
                            <span className="badge badge-neutral">{item.source}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {isOpen && (
                      <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
                        {item.stem && (
                          <pre className="text-xs whitespace-pre-wrap text-slate-600 bg-slate-50/80 rounded-xl p-3 font-mono">
                            {item.stem}
                          </pre>
                        )}
                        {item.solution_outline && (
                          <pre className="text-xs whitespace-pre-wrap text-slate-600 bg-indigo-50/50 rounded-xl p-3 font-mono">
                            {item.solution_outline}
                          </pre>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            !browsing && (
              <EmptyState
                icon={<Icons.Empty />}
                title="データがありません"
                description="「データ投入」タブから問題データを投入してください"
              />
            )
          )}
        </div>
      )}
    </div>
  );
}
