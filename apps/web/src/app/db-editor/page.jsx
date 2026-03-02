'use client';

import { useState, useEffect, useCallback, useRef, forwardRef } from 'react';
import {
  fetchDbTables,
  fetchDbSchema,
  fetchDbRows,
  updateDbRow,
  createDbRow,
  deleteDbRow,
  estimateDifficulty,
  smartCreateDbRow,
} from '@/lib/api';
import {
  StatusBar,
  SectionCard,
  Button,
  PageHeader,
  SelectField,
  Icons,
} from '@/components/ui';
import { SUBJECT_TOPICS } from '@/lib/constants';

const PAGE_SIZE = 30;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ヘルパー関数
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function isJsonColumn(type) {
  if (!type) return false;
  const t = type.toUpperCase();
  return t.includes('JSON') || t.includes('JSONB');
}

function isNumericColumn(type) {
  if (!type) return false;
  const t = type.toUpperCase();
  return t.includes('INT') || t.includes('DOUBLE') || t.includes('FLOAT')
    || t.includes('NUMERIC') || t.includes('DECIMAL') || t.includes('REAL')
    || t.includes('SERIAL') || t.includes('SMALLINT') || t.includes('BIGINT');
}

function isBoolColumn(type) {
  if (!type) return false;
  return type.toUpperCase().includes('BOOL');
}

function formatCellValue(val) {
  if (val === null || val === undefined) return '';
  if (typeof val === 'object') {
    try { return JSON.stringify(val, null, 2); } catch { return String(val); }
  }
  return String(val);
}

function truncateDisplay(val, max = 60) {
  const s = formatCellValue(val);
  if (s.length <= max) return s;
  return s.slice(0, max) + '…';
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// カラム日本語名マッピング
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const COL_LABELS = {
  id: 'ID',
  subject: '教科',
  topic: 'トピック',
  subtopic: 'サブトピック',
  language: '言語',
  origin: '登録元',
  format: '形式',
  stem: '問題文',
  stem_latex: '問題文(ソース)',
  choices_json: '選択肢',
  answer_json: '正解データ',
  answer_brief: '答え',
  solution_outline: '解法概要',
  explanation: '解説',
  difficulty: '難易度',
  difficulty_level: '難易度Lv',
  trickiness: 'ひっかけ度',
  est_time_sec: '想定時間(秒)',
  skill_type: 'スキル種別',
  concepts_json: '関連概念',
  source: '出典名',
  source_page: '出典ページ',
  source_ref: '出典参照',
  confidence: '信頼度',
  solvable: '解答可能',
  steps: 'ステップ数',
  learning_objective: '学習目標',
  prerequisite_level: '前提レベル',
  parent_problem_id: '親問題ID',
  generator: '生成器',
  created_at: '作成日時',
  updated_at: '更新日時',
  wrong_patterns_json: '誤答パターン',
  expected_mistakes: 'よくある間違い',
  references_json: '参考文献',
  structural_sim_target: '構造類似度',
  surface_sim_target: '表面類似度',
  parameter_dof: 'パラメータ自由度',
  trap_type: 'トラップ種別',
  context_dependency: '文脈依存度',
  span_locality: 'スパン局所性',
  noise_robustness: 'ノイズ耐性',
  page: 'ページ',
  final_answer_text: '最終解答(文)',
  final_answer_numeric: '最終解答(数)',
  raw_text: '生テキスト',
  raw_json: '生JSON',
  normalized_json: '正規化JSON',
  normalized_text: '正規化テキスト',
};

/** カラム名 → 日本語表示名 */
function colLabel(name) {
  return COL_LABELS[name] || name;
}

// テーブル名日本語マッピング（メタ情報付き）
const TABLE_META = {
  problems:        { label: '問題データ',  desc: '過去問・オリジナル問題の一覧',           icon: 'P', color: '#1d1d1f' },
  templates:       { label: '出題パターン', desc: '教科・分野・難易度の組み合わせ',   icon: 'T', color: '#bf5af2' },
  generations:     { label: '生成履歴',      desc: 'AIが作った問題の履歴',               icon: 'G',  color: '#ff9f0a' },
  generation_runs: { label: '生成バッチ',    desc: 'まとめて生成した記録',               icon: 'R', color: '#30d158' },
  annotations:     { label: '評価データ',    desc: '生成結果の品質評価記録',           icon: 'A',  color: '#5856d6' },
  generation_evals:{ label: '生成評価',      desc: '生成の自動評価スコア',             icon: 'E', color: '#007aff' },
  users:           { label: 'ユーザー',      desc: 'ユーザーアカウント情報',             icon: 'U', color: '#64d2ff' },
};

function tableLabel(name) {
  return TABLE_META[name]?.label || name;
}
function tableMeta(name) {
  return TABLE_META[name] || { label: name, desc: '', icon: '—', color: '#86868b' };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// カラムグループ定義 (一覧表示用)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const COLUMN_GROUPS = {
  core: {
    label: '基本',
    cols: ['id', 'subject', 'topic', 'subtopic', 'language', 'format'],
  },
  content: {
    label: '問題内容',
    cols: ['stem', 'stem_latex', 'choices_json', 'answer_json', 'answer_brief', 'solution_outline', 'explanation'],
  },
  difficulty: {
    label: '難易度',
    cols: ['difficulty', 'difficulty_level', 'trickiness', 'est_time_sec'],
  },
  meta: {
    label: 'メタ',
    cols: ['skill_type', 'concepts_json', 'source', 'source_page', 'source_ref', 'confidence', 'solvable', 'origin'],
  },
};

// 一覧表のデフォルト表示カラム（見やすい最小セット）
const DEFAULT_VISIBLE_COLS = ['id', 'subject', 'topic', 'subtopic', 'stem', 'answer_brief', 'difficulty', 'difficulty_level'];

// 非表示推奨（embedding等の巨大カラム）
const HIDDEN_COLS = new Set([
  'vector', 'embedding', 'raw_text', 'raw_json', 'normalized_json', 'normalized_text',
  'prompt_hash', 'generation_seed', 'schema_version', 'request_id',
  'metadata', 'metadata_json', 'checks_json', 'assumptions_json', 'selected_reference_json',
]);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// メインコンポーネント
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default function DbEditorPage() {
  const [status, setStatus] = useState('');
  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState('');
  const [schema, setSchema] = useState([]);
  const [pk, setPk] = useState('id');
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(false);

  // カラム表示制御
  const [visibleCols, setVisibleCols] = useState(DEFAULT_VISIBLE_COLS);
  const [showColPicker, setShowColPicker] = useState(false);

  // 編集状態
  const [edits, setEdits] = useState({});
  const [editingCell, setEditingCell] = useState(null);
  const editRef = useRef(null);

  // 削除確認
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // 行詳細表示
  const [detailRow, setDetailRow] = useState(null);

  // インライン行追加 (browseタブ)
  const [showInlineAdd, setShowInlineAdd] = useState(false);
  const [inlineAddData, setInlineAddData] = useState({});
  const [inlineAddSaving, setInlineAddSaving] = useState(false);

  // 難易度推定状態
  const [difficultyEstimating, setDifficultyEstimating] = useState(false);
  const [difficultyResult, setDifficultyResult] = useState(null);

  // テーブル一覧取得（fieldsテーブルは除外）
  useEffect(() => {
    fetchDbTables()
      .then((data) => {
        const filtered = (data.tables || []).filter((t) => t.name !== 'fields');
        setTables(filtered);
        if (filtered.length > 0) setSelectedTable(filtered[0].name);
      })
      .catch((e) => setStatus(`データ種類の取得エラー: ${e.message}`));
  }, []);

  // テーブル切替
  const loadTableData = useCallback(async (table, pageNum = 0, searchQuery = '') => {
    if (!table) return;
    setLoading(true);
    setEdits({});
    setEditingCell(null);
    setDeleteConfirm(null);
    setDetailRow(null);
    try {
      const [schemaRes, rowsRes] = await Promise.all([
        fetchDbSchema(table),
        fetchDbRows(table, { limit: PAGE_SIZE, offset: pageNum * PAGE_SIZE, ...(searchQuery ? { search: searchQuery } : {}) }),
      ]);
      setSchema(schemaRes.columns || []);
      setPk(schemaRes.pk || 'id');
      setRows(rowsRes.rows || []);
      setTotal(rowsRes.total || 0);
      setStatus(`${table}: ${rowsRes.total || 0}件`);
    } catch (e) {
      setStatus(`データ取得エラー: ${e.message}`);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (selectedTable) {
      setPage(0);
      setSearch('');
      setSearchInput('');
      loadTableData(selectedTable, 0, '');
    }
  }, [selectedTable, loadTableData]);

  const handlePageChange = (newPage) => {
    setPage(newPage);
    loadTableData(selectedTable, newPage, search);
  };

  const handleSearch = () => {
    setSearch(searchInput);
    setPage(0);
    loadTableData(selectedTable, 0, searchInput);
  };

  // ── セル編集 ──
  const startEdit = (rowPk, col) => {
    setEditingCell({ rowPk, col });
    setTimeout(() => editRef.current?.focus(), 0);
  };
  const onCellChange = (rowPk, col, value) => {
    setEdits((prev) => ({ ...prev, [rowPk]: { ...(prev[rowPk] || {}), [col]: value } }));
  };
  const finishEdit = () => setEditingCell(null);
  const getCellValue = (row, col) => {
    const rowPk = row[pk];
    if (edits[rowPk] && col in edits[rowPk]) return edits[rowPk][col];
    return row[col];
  };
  const isCellDirty = (row, col) => {
    const rowPk = row[pk];
    return edits[rowPk] && col in edits[rowPk];
  };

  // ── 一括保存 ──
  const saveAll = async () => {
    const dirtyPks = Object.keys(edits);
    if (dirtyPks.length === 0) { setStatus('変更がありません'); return; }
    setStatus('保存中...');
    let ok = 0, ng = 0;
    for (const rowPk of dirtyPks) {
      try {
        const data = edits[rowPk];
        const converted = {};
        for (const [col, val] of Object.entries(data)) {
          const cs = schema.find((c) => c.name === col);
          if (cs && isNumericColumn(cs.type) && val !== '' && val !== null) {
            const num = Number(val);
            converted[col] = isNaN(num) ? val : num;
          } else if (cs && isBoolColumn(cs.type)) {
            converted[col] = val === 'true' || val === true;
          } else if (cs && isJsonColumn(cs.type) && typeof val === 'string') {
            try { converted[col] = JSON.parse(val); } catch { converted[col] = val; }
          } else {
            converted[col] = val === '' ? null : val;
          }
        }
        await updateDbRow(selectedTable, rowPk, converted);
        ok++;
      } catch (e) {
        ng++;
        setStatus(`保存エラー (id=${rowPk}): ${e.message}`);
      }
    }
    setEdits({});
    setStatus(ng === 0 ? `${ok}行を保存しました` : `${ok}行保存、${ng}行エラー`);
    loadTableData(selectedTable, page, search);
  };

  // ── 削除 ──
  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await deleteDbRow(selectedTable, deleteConfirm);
      setStatus(`行を削除しました (id: ${deleteConfirm})`);
      setDeleteConfirm(null);
      loadTableData(selectedTable, page, search);
    } catch (e) {
      setStatus(`削除エラー: ${e.message}`);
    }
  };

  // ── 難易度自動推定 ──
  const triggerDifficultyEstimate = useCallback(async (stem, answer) => {
    if (!stem || !stem.trim()) return;
    setDifficultyEstimating(true);
    try {
      const res = await estimateDifficulty(stem, answer || '');
      setDifficultyResult(res);
      return res;
    } catch (e) {
      console.warn('difficulty estimation failed:', e);
      setDifficultyResult(null);
      return null;
    } finally {
      setDifficultyEstimating(false);
    }
  }, []);

  // ── インライン行追加 (browseタブ) ──
  const onInlineFieldChange = (col, value) => {
    setInlineAddData((prev) => ({ ...prev, [col]: value }));
  };

  const submitInlineAdd = async () => {
    setInlineAddSaving(true);
    setStatus('行を追加中...');
    try {
      const data = {};
      for (const [col, val] of Object.entries(inlineAddData)) {
        if (val === '' || val === null || val === undefined) continue;
        const cs = schema.find((c) => c.name === col);
        if (cs && isNumericColumn(cs.type) && val !== '' && val !== null) {
          const num = Number(val);
          data[col] = isNaN(num) ? val : num;
        } else if (cs && isBoolColumn(cs.type)) {
          data[col] = val === 'true' || val === true;
        } else if (cs && isJsonColumn(cs.type) && typeof val === 'string') {
          try { data[col] = JSON.parse(val); } catch { data[col] = val; }
        } else {
          data[col] = val;
        }
      }
      const res = await smartCreateDbRow(selectedTable, data, true);
      const diffInfo = res.difficulty_auto
        ? ` [難易度: ${res.difficulty_auto.difficulty} / Lv${res.difficulty_auto.difficulty_level}]`
        : '';
      setStatus(`行を追加しました (ID: ${res.inserted_id || '—'})${diffInfo}`);
      setInlineAddData({});
      setShowInlineAdd(false);
      loadTableData(selectedTable, page, search);
    } catch (e) {
      setStatus(`追加エラー: ${e.message}`);
    }
    setInlineAddSaving(false);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const hasDirty = Object.keys(edits).length > 0;

  // フィルタされた表示カラム
  const allCols = schema.filter((c) => !HIDDEN_COLS.has(c.name.toLowerCase()));
  const displayCols = allCols.filter((c) => visibleCols.includes(c.name));

  return (
    <div className="max-w-[100rem] mx-auto space-y-4 sm:space-y-5 px-4 sm:px-5 py-6 sm:py-10 pb-28 sm:pb-12">
      <PageHeader
        title="データ管理"
        description="過去問データの閲覧・編集・新規登録"
        icon={<Icons.Data />}
        breadcrumbs={[{ label: 'ホーム', href: '/' }, { label: 'データ管理' }]}
      />

      <StatusBar message={status} />

      {/* データ種類選択 — カードグリッド */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2.5">
        {tables.map((t) => {
          const meta = tableMeta(t.name);
          const active = selectedTable === t.name;
          return (
            <button
              key={t.name}
              onClick={() => setSelectedTable(t.name)}
              className={`group relative text-left rounded-[16px] p-3.5 transition-all duration-300 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] overflow-hidden
                ${active
                  ? 'bg-white border-2 scale-[1.02]'
                  : 'bg-white/60 backdrop-blur-sm border border-black/[0.04] hover:bg-white hover:scale-[1.01]'
                }`}
              style={active ? { borderColor: `${meta.color}40`, boxShadow: 'var(--shadow-card)' } : {}}

            >
              {/* アクティブ時の背景グロー */}
              {active && (
                <div className="absolute -top-4 -right-4 w-16 h-16 rounded-full blur-2xl opacity-20"
                     style={{ background: meta.color }} />
              )}
              {/* アイコン */}
              <div className="text-xl mb-1.5 transition-transform duration-300 group-hover:scale-110">{meta.icon}</div>
              {/* ラベル */}
              <div className={`text-[12px] font-bold leading-tight transition-colors duration-300
                ${active ? 'text-[#1d1d1f]' : 'text-[#6e6e73] group-hover:text-[#1d1d1f]'}`}>
                {meta.label}
              </div>
              {/* 説明 */}
              <div className="text-[10px] text-[#aeaeb2] leading-snug mt-0.5 line-clamp-2">{meta.desc}</div>
              {/* アクティブドット */}
              {active && (
                <div className="absolute top-2 right-2 w-2 h-2 rounded-full"
                     style={{ background: meta.color }} />
              )}
            </button>
          );
        })}
      </div>

      {/* ── データ一覧 ── */}
      {selectedTable && (
        <>
          {/* ツールバー */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex gap-1.5 items-center flex-1 min-w-[180px] max-w-xs">
              <div className="relative flex-1">
                <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#aeaeb2] pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="検索..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-black/[0.03] text-sm
                             text-[#1d1d1f] transition-all border border-transparent
                             focus:bg-white focus:border-black/[0.08] focus:shadow-sm
                             focus:ring-0 outline-none placeholder:text-[#c7c7cc]"
                />
              </div>
            </div>

            {/* カラム選択ボタン */}
            <button
              onClick={() => setShowColPicker(!showColPicker)}
              className="px-3 py-2 text-xs font-medium text-[#86868b] bg-black/[0.03]
                         rounded-xl hover:bg-black/[0.06] transition-all flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              表示列 ({visibleCols.length}/{allCols.length})
            </button>

            <div className="flex gap-2 ml-auto">
              <Button
                variant="primary"
                size="sm"
                onClick={() => { setShowInlineAdd(!showInlineAdd); setInlineAddData({}); }}
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                {showInlineAdd ? '閉じる' : '行を追加'}
              </Button>
              {hasDirty && (
                <Button variant="success" onClick={saveAll}>
                  <Icons.Success className="w-4 h-4 mr-1" />
                  保存 ({Object.keys(edits).length}行)
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={() => { setEdits({}); loadTableData(selectedTable, page, search); }}>
                リロード
              </Button>
            </div>
          </div>

          {/* カラムピッカー */}
          {showColPicker && (
            <ColumnPicker
              allCols={allCols}
              visibleCols={visibleCols}
              setVisibleCols={setVisibleCols}
              onClose={() => setShowColPicker(false)}
            />
          )}

          {/* ── インライン行追加フォーム ── */}
          {showInlineAdd && (
            <InlineAddForm
              schema={schema}
              pk={pk}
              table={selectedTable}
              data={inlineAddData}
              onChange={onInlineFieldChange}
              onSubmit={submitInlineAdd}
              onCancel={() => { setShowInlineAdd(false); setInlineAddData({}); }}
              saving={inlineAddSaving}
              onEstimateDifficulty={triggerDifficultyEstimate}
              difficultyEstimating={difficultyEstimating}
              difficultyResult={difficultyResult}
            />
          )}

          {/* ページネーション */}
          <div className="flex items-center gap-4 text-sm text-[#86868b]">
            <span>{total}件中 {Math.min(page * PAGE_SIZE + 1, total)}〜{Math.min((page + 1) * PAGE_SIZE, total)}件</span>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" onClick={() => handlePageChange(page - 1)} disabled={page === 0}>
                &laquo; 前
              </Button>
              <span className="px-2 py-1 text-xs font-mono">{page + 1}/{totalPages || 1}</span>
              <Button variant="ghost" size="sm" onClick={() => handlePageChange(page + 1)} disabled={page + 1 >= totalPages}>
                次 &raquo;
              </Button>
            </div>
          </div>

          {/* データ一覧 (デスクトップ) */}
          <div className="hidden sm:block rounded-[20px] bg-white border border-black/[0.04] overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-black/[0.04]">
                    <th className="px-3 py-2.5 text-left text-[11px] font-medium text-[#aeaeb2] tracking-wide sticky left-0 bg-white z-10 w-10">
                      #
                    </th>
                    {displayCols.map((col) => (
                      <th key={col.name}
                        className="px-3 py-2.5 text-left text-[11px] font-medium text-[#aeaeb2] tracking-wide whitespace-nowrap"
                        title={colLabel(col.name)}
                      >
                        <div className="flex items-center gap-1.5">
                          {colLabel(col.name)}
                          {col.pk && <span className="text-[9px] font-medium bg-[#007aff]/[0.08] text-[#007aff] px-1.5 py-0.5 rounded-full">主キー</span>}
                        </div>
                      </th>
                    ))}
                    <th className="px-3 py-2.5 text-center text-[11px] font-medium text-[#aeaeb2] tracking-wide w-20">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => {
                    const rowPk = row[pk];
                    const rowDirty = !!edits[rowPk];
                    return (
                      <tr key={rowPk ?? idx}
                        className={`border-b border-black/[0.04] transition-colors
                          ${rowDirty ? 'bg-[#ff9500]/[0.06]' : 'hover:bg-black/[0.02]'}`}
                      >
                        <td className={`px-3 py-2.5 font-mono text-[11px] text-[#c7c7cc] sticky left-0 z-10 bg-white
                          ${rowDirty ? '!bg-[#ff9500]/[0.06]' : ''}`}>
                          {page * PAGE_SIZE + idx + 1}
                        </td>
                        {displayCols.map((col) => {
                          const isEditing = editingCell?.rowPk === rowPk && editingCell?.col === col.name;
                          const cellVal = getCellValue(row, col.name);
                          const dirty = isCellDirty(row, col.name);
                          const isPkCol = col.name === pk;

                          if (isPkCol) {
                            return (
                              <td key={col.name} className="px-3 py-2.5 font-mono text-[#007aff] font-semibold text-[11px]">
                                {formatCellValue(cellVal)}
                              </td>
                            );
                          }

                          return (
                            <td key={col.name}
                              className={`px-1 py-1 cursor-pointer
                                ${dirty ? 'bg-[#ff9500]/[0.06]' : ''}
                                ${isEditing ? 'p-0' : ''}`}
                              onClick={() => !isEditing && startEdit(rowPk, col.name)}
                              title={formatCellValue(cellVal)}
                            >
                              {isEditing ? (
                                <CellEditor
                                  ref={editRef}
                                  col={col}
                                  value={cellVal}
                                  onChange={(v) => onCellChange(rowPk, col.name, v)}
                                  onFinish={finishEdit}
                                />
                              ) : (
                                <span className={`block px-2 py-1 text-[#1d1d1f] max-w-[300px] truncate ${
                                  typeof cellVal === 'object' && cellVal !== null ? 'font-mono text-[10px] text-[#af52de]' : ''
                                }`}>
                                  {cellVal === null || cellVal === undefined
                                    ? <span className="text-[#d2d2d7] italic">—</span>
                                    : truncateDisplay(cellVal)}
                                </span>
                              )}
                            </td>
                          );
                        })}
                        <td className="px-2 py-2.5 text-center">
                          <div className="flex gap-1 justify-center">
                            <button
                              onClick={() => setDetailRow(row)}
                              className="text-[#d2d2d7] hover:text-[#1d1d1f] transition-colors p-1"
                              title="詳細"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(rowPk)}
                              className="text-[#d2d2d7] hover:text-rose-600 transition-colors p-1"
                              title="削除"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {rows.length === 0 && !loading && (
                    <tr>
                      <td colSpan={displayCols.length + 2} className="text-center py-12 text-[#c7c7cc]">
                        データがありません
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {loading && (
              <div className="flex items-center justify-center py-8 text-[#c7c7cc]">
                <Icons.Info className="w-5 h-5 animate-pulse mr-2" /> 読み込み中...
              </div>
            )}
          </div>

          {/* モバイルカードビュー */}
          <div className="sm:hidden space-y-3">
            {loading && (
              <div className="flex items-center justify-center py-8 text-[#c7c7cc]">
                <Icons.Info className="w-5 h-5 animate-pulse mr-2" /> 読み込み中...
              </div>
            )}
            {rows.map((row, idx) => {
              const rowPk = row[pk];
              const rowDirty = !!edits[rowPk];
              return (
                <div key={rowPk ?? idx}
                  className={`rounded-[20px] border p-4 transition-all duration-300 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] ${
                    rowDirty
                      ? 'bg-[#ff9500]/[0.06] border-[#ff9500]/20'
                      : 'bg-white/70 border-black/[0.04]'
                  }`}
                >
                  {/* Card header with PK and actions */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-[#aeaeb2]">#{page * PAGE_SIZE + idx + 1}</span>
                      <span className="text-sm font-bold text-[#e8457a] font-mono">{rowPk}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setDetailRow(row)}
                        className="p-2 rounded-xl text-[#aeaeb2] hover:text-[#e8457a] hover:bg-[#e8457a]/5 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                        title="詳細">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </button>
                      <button onClick={() => setDeleteConfirm(rowPk)}
                        className="p-2 rounded-xl text-[#aeaeb2] hover:text-rose-500 hover:bg-rose-50 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                        title="削除">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  {/* Key fields as stacked list */}
                  <div className="space-y-1.5">
                    {displayCols.filter(c => c.name !== pk).slice(0, 5).map((col) => {
                      const cellVal = getCellValue(row, col.name);
                      const dirty = isCellDirty(row, col.name);
                      return (
                        <div key={col.name}
                          className={`flex items-start gap-2 py-1.5 px-2 rounded-lg ${dirty ? 'bg-[#ff9500]/[0.08]' : ''}`}
                          onClick={() => startEdit(rowPk, col.name)}
                        >
                          <span className="text-[10px] font-bold text-[#aeaeb2] uppercase min-w-[4.5rem] flex-shrink-0 pt-0.5">{colLabel(col.name)}</span>
                          <span className="text-[13px] text-[#1d1d1f] break-all line-clamp-2 min-w-0">
                            {cellVal === null || cellVal === undefined
                              ? <span className="text-[#d2d2d7] italic text-xs">—</span>
                              : truncateDisplay(cellVal)}
                          </span>
                        </div>
                      );
                    })}
                    {displayCols.filter(c => c.name !== pk).length > 5 && (
                      <button onClick={() => setDetailRow(row)}
                        className="text-[11px] text-[#e8457a] font-semibold px-2 py-1">
                        + {displayCols.filter(c => c.name !== pk).length - 5} 項目を表示...
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {rows.length === 0 && !loading && (
              <div className="text-center py-12 text-[#c7c7cc] text-sm">データがありません</div>
            )}
          </div>
        </>
      )}

      {/* ── 行詳細モーダル ── */}
      {detailRow && (
        <RowDetailModal row={detailRow} schema={schema} pk={pk} onClose={() => setDetailRow(null)} />
      )}

      {/* ── 削除確認 ── */}
      {deleteConfirm !== null && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-md z-50 flex items-center justify-center">
          <div className="rounded-[20px] bg-white/90 backdrop-blur-xl p-6 max-w-sm mx-4 border border-black/[0.04]" style={{ boxShadow: 'var(--shadow-premium)' }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
                <svg className="w-5 h-5 text-[#ff3b30]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <div className="text-[17px] font-bold text-[#1d1d1f]">削除しますか？</div>
            </div>
            <p className="text-[13px] text-[#86868b] mb-5 pl-[52px]">
              ID: <strong className="text-[#1d1d1f]">{deleteConfirm}</strong> のデータを削除します。この操作は取り消せません。
            </p>
            <div className="flex gap-2.5 justify-end">
              <Button variant="ghost" onClick={() => setDeleteConfirm(null)}>キャンセル</Button>
              <Button variant="danger" onClick={confirmDelete}>削除する</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// サブコンポーネント
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


// ── セルエディタ ──
const CellEditor = forwardRef(function CellEditor({ col, value, onChange, onFinish }, ref) {
  const formatted = formatCellValue(value);

  if (isJsonColumn(col.type)) {
    return (
      <textarea
        ref={ref}
        value={formatted}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onFinish}
        onKeyDown={(e) => { if (e.key === 'Escape') onFinish(); }}
        className="w-full min-w-[200px] px-2 py-1.5 text-xs border border-[#1d1d1f]
                   rounded-[12px] bg-black/[0.03] font-mono resize-y outline-none"
        rows={4}
      />
    );
  }
  if (isBoolColumn(col.type)) {
    return (
      <select
        ref={ref}
        value={String(value ?? '')}
        onChange={(e) => { onChange(e.target.value); onFinish(); }}
        onBlur={onFinish}
        className="px-2 py-1.5 text-xs border border-[#1d1d1f] rounded-[12px] bg-black/[0.03]"
      >
        <option value="">—</option>
        <option value="true">はい</option>
        <option value="false">いいえ</option>
      </select>
    );
  }
  return (
    <input
      ref={ref}
      type={isNumericColumn(col.type) ? 'number' : 'text'}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onFinish}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onFinish();
        if (e.key === 'Escape') onFinish();
      }}
      step={isNumericColumn(col.type) ? 'any' : undefined}
      className="w-full min-w-[80px] px-2 py-1.5 text-xs border border-[#1d1d1f]
                 rounded-[12px] bg-black/[0.03] outline-none"
    />
  );
});


// ── カラムピッカー ──
function ColumnPicker({ allCols, visibleCols, setVisibleCols, onClose }) {
  const colNames = allCols.map((c) => c.name);

  const toggleCol = (name) => {
    setVisibleCols((prev) =>
      prev.includes(name) ? prev.filter((c) => c !== name) : [...prev, name]
    );
  };

  const selectGroup = (groupKey) => {
    const group = COLUMN_GROUPS[groupKey];
    if (!group) return;
    const existing = new Set(visibleCols);
    const groupCols = group.cols.filter((c) => colNames.includes(c));
    const allSelected = groupCols.every((c) => existing.has(c));
    if (allSelected) {
      setVisibleCols((prev) => prev.filter((c) => !groupCols.includes(c) || c === 'id'));
    } else {
      setVisibleCols((prev) => [...new Set([...prev, ...groupCols])]);
    }
  };

  return (
    <div className="bg-black/[0.02] rounded-[16px] border border-black/[0.04] p-5" style={{ boxShadow: 'var(--shadow-card)' }}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-[#1d1d1f]">表示カラムを選択</h3>
        <div className="flex gap-2">
          <button onClick={() => setVisibleCols(DEFAULT_VISIBLE_COLS)}
            className="text-xs text-[#1d1d1f] hover:text-[#1d1d1f] font-semibold">デフォルト</button>
          <button onClick={() => setVisibleCols(colNames)}
            className="text-xs text-[#d2d2d7] hover:text-[#86868b] font-semibold">全選択</button>
          <button onClick={onClose}
            className="text-xs text-[#d2d2d7] hover:text-[#86868b] font-semibold ml-2">閉じる</button>
        </div>
      </div>

      {/* グループクイック選択 */}
      <div className="flex gap-2 mb-3">
        {Object.entries(COLUMN_GROUPS).map(([key, group]) => (
          <button key={key} onClick={() => selectGroup(key)}
            className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-black/[0.04] text-[#86868b]
                       hover:bg-[#1d1d1f]/[0.08] hover:text-[#1d1d1f] transition-colors border border-black/[0.04]">
            {group.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-1.5">
        {allCols.map((col) => (
          <label key={col.name} className={`flex items-center gap-1.5 p-1.5 rounded-lg cursor-pointer text-[11px]
            transition-colors ${visibleCols.includes(col.name) ? 'bg-[#1d1d1f]/[0.08] text-[#1d1d1f]' : 'text-[#c7c7cc] hover:bg-black/[0.03]'}`}>
            <input type="checkbox" checked={visibleCols.includes(col.name)}
              onChange={() => toggleCol(col.name)} className="w-3 h-3 rounded accent-[#1d1d1f]" />
            <span className="truncate">{colLabel(col.name)}</span>
          </label>
        ))}
      </div>
    </div>
  );
}


// ── 行詳細モーダル ──
function RowDetailModal({ row, schema, pk, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/20 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white/95 backdrop-blur-xl rounded-t-[20px] sm:rounded-[20px] max-w-3xl w-full max-h-[90vh] sm:max-h-[85vh] overflow-hidden flex flex-col border border-black/[0.04]" style={{ boxShadow: 'var(--shadow-premium)' }}>
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-black/[0.04]">
          <h2 className="text-base sm:text-lg font-bold text-[#1d1d1f]">
            データ詳細
          </h2>
          <button onClick={onClose} className="text-[#c7c7cc] hover:text-[#424245] text-xl font-bold p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="overflow-y-auto flex-1 p-4 sm:p-6 space-y-2">
          {schema.map((col) => {
            const val = row[col.name];
            const isEmpty = val === null || val === undefined || val === '';
            return (
              <div key={col.name} className="flex flex-col sm:flex-row sm:gap-3 py-2 border-b border-black/[0.04]">
                <div className="sm:w-44 flex-shrink-0 mb-0.5 sm:mb-0">
                  <span className="text-xs font-bold text-[#424245]">{colLabel(col.name)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  {isEmpty ? (
                    <span className="text-xs text-[#d2d2d7] italic">—</span>
                  ) : typeof val === 'object' ? (
                    <pre className="text-xs text-[#af52de] font-mono bg-black/[0.04] rounded-lg p-2 overflow-x-auto whitespace-pre-wrap">
                      {JSON.stringify(val, null, 2)}
                    </pre>
                  ) : (
                    <span className="text-xs text-[#1d1d1f] whitespace-pre-wrap break-all">{String(val)}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}


// ── 難易度推定結果パネル ──
function DifficultyEstimatePanel({ result, estimating, onApply }) {
  if (estimating) {
    return (
      <div className="bg-[#1d1d1f]/[0.06] border border-black/[0.04] rounded-[16px] p-4 flex items-center gap-3">
        <svg className="w-5 h-5 animate-spin text-[#1d1d1f]" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span className="text-sm font-semibold text-[#1d1d1f]">難易度を推定中...</span>
      </div>
    );
  }
  if (!result) return null;

  const levelColors = {
    1: 'bg-[#34c759]/[0.08] text-[#34c759]',
    2: 'bg-[#007aff]/[0.08] text-[#007aff]',
    3: 'bg-[#ff9500]/[0.08] text-[#ff9500]',
    4: 'bg-orange-50 text-orange-600',
    5: 'bg-rose-50 text-rose-600',
  };
  const levelLabels = { 1: '基礎', 2: '標準', 3: '応用', 4: '発展', 5: '難問' };

  return (
    <div className="bg-gradient-to-r from-violet-50/60 to-rose-50/60 border border-black/[0.04] rounded-[16px] p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-[#af52de]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <span className="text-sm font-bold text-[#af52de]">難易度自動推定</span>
        </div>
        <button
          onClick={onApply}
          className="px-3 py-1.5 text-xs font-bold bg-violet-600 text-[#1d1d1f] rounded-lg hover:bg-violet-700 transition-colors"
        >
          推定値を適用
        </button>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-black/[0.02] rounded-[12px] p-3 text-center border border-black/[0.04]">
          <div className="text-[10px] font-semibold text-[#aeaeb2] mb-1">難易度スコア</div>
          <div className="text-xl font-bold text-[#af52de]">{result.difficulty.toFixed(3)}</div>
          <div className="h-1.5 bg-black/[0.04] rounded-full mt-1.5 overflow-hidden">
            <div className="h-full bg-[#af52de] rounded-full" style={{ width: `${result.difficulty * 100}%` }} />
          </div>
        </div>
        <div className="bg-black/[0.02] rounded-[12px] p-3 text-center border border-black/[0.04]">
          <div className="text-[10px] font-semibold text-[#aeaeb2] mb-1">レベル</div>
          <div className={`inline-flex px-3 py-1 rounded-lg text-lg font-bold ${levelColors[result.difficulty_level] || 'bg-black/[0.04] text-[#86868b]'}`}>
            Lv.{result.difficulty_level}
          </div>
          <div className="text-[10px] text-[#c7c7cc] mt-1">{levelLabels[result.difficulty_level] || ''}</div>
        </div>
        <div className="bg-black/[0.02] rounded-[12px] p-3 text-center border border-black/[0.04]">
          <div className="text-[10px] font-semibold text-[#aeaeb2] mb-1">ひっかけ度</div>
          <div className="text-xl font-bold text-[#ff9500]">{result.trickiness.toFixed(3)}</div>
          <div className="h-1.5 bg-black/[0.04] rounded-full mt-1.5 overflow-hidden">
            <div className="h-full bg-[#ff9500] rounded-full" style={{ width: `${result.trickiness * 100}%` }} />
          </div>
        </div>
      </div>
      <p className="text-[10px] text-[#d2d2d7] mt-2 text-center">
        登録時に自動で反映されます。「推定値を適用」で推奨項目にも即座に反映できます。
      </p>
    </div>
  );
}


// ── インライン行追加フォーム (browseタブ用) ──
const PRIORITY_FIELDS = ['subject', 'topic', 'stem', 'answer_brief'];

function InlineAddForm({ schema, pk, table, data, onChange, onSubmit, onCancel, saving, onEstimateDifficulty, difficultyEstimating, difficultyResult }) {
  const [showMore, setShowMore] = useState(false);

  // 優先フィールド（教科, トピック, 問題文, 答え）
  const priorityCols = PRIORITY_FIELDS
    .map((name) => schema.find((c) => c.name === name))
    .filter(Boolean);

  // その他の編集可能カラム
  const otherCols = schema.filter((c) =>
    c.name !== pk &&
    !PRIORITY_FIELDS.includes(c.name) &&
    !HIDDEN_COLS.has(c.name.toLowerCase()) &&
    !['created_at', 'updated_at'].includes(c.name)
  );

  const baseInputClass = `w-full px-3 py-2 text-sm border border-black/[0.04] rounded-[12px] bg-white
    text-[#1d1d1f] transition-all hover:border-black/[0.06] focus:border-[#1d1d1f]/50 focus:ring-2 focus:ring-[#1d1d1f]/20 outline-none placeholder:text-[#c7c7cc]`;

  const handleStemBlur = () => {
    if (data.stem?.trim()) {
      onEstimateDifficulty(data.stem, data.answer_brief || '');
    }
  };
  const handleAnswerBlur = () => {
    if (data.stem?.trim()) {
      onEstimateDifficulty(data.stem, data.answer_brief || '');
    }
  };

  const subjectOptions = ['数学', '英語', '国語', '理科', '社会', '物理', '化学', '生物', '地学', '情報'];
  const topicOptions = data.subject ? (SUBJECT_TOPICS[data.subject] || []) : [];

  const hasPriority = data.subject && data.stem;

  return (
    <div className="bg-gradient-to-r from-emerald-50/60 to-teal-50/60 border border-black/[0.04] rounded-[20px] p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-[#34c759]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span className="text-sm font-bold text-[#34c759]">新しい行を追加</span>
          <span className="text-[10px] bg-[#34c759]/[0.08] text-[#34c759] px-2 py-0.5 rounded-lg font-bold">
            {tableLabel(table)}
          </span>
        </div>
        <button onClick={onCancel} className="text-[#c7c7cc] hover:text-[#424245] transition-colors p-1">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* 優先入力フィールド: 教科・トピック・問題文・答え */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* 教科 */}
        <div>
          <label className="block text-[11px] font-bold text-[#34c759] mb-1">
            教科 <span className="text-rose-600">*</span>
          </label>
          <select
            value={data.subject || ''}
            onChange={(e) => onChange('subject', e.target.value)}
            className={baseInputClass}
          >
            <option value="">— 選択 —</option>
            {subjectOptions.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* トピック */}
        <div>
          <label className="block text-[11px] font-bold text-[#34c759] mb-1">
            トピック <span className="text-rose-600">*</span>
          </label>
          {topicOptions.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-1">
              {topicOptions.map((t) => (
                <button key={t} type="button" onClick={() => onChange('topic', t)}
                  className={`px-2 py-0.5 text-[10px] rounded-lg border transition-all ${
                    data.topic === t
                      ? 'bg-emerald-600 text-[#1d1d1f] border-emerald-600'
                      : 'bg-black/[0.03] text-[#86868b] border-black/[0.04] hover:border-emerald-600'
                  }`}>
                  {t}
                </button>
              ))}
            </div>
          )}
          <input
            type="text"
            value={data.topic || ''}
            onChange={(e) => onChange('topic', e.target.value)}
            placeholder={data.subject ? '候補から選択または自由入力' : '先に教科を選択してください'}
            className={baseInputClass}
          />
        </div>

        {/* 問題文 */}
        <div className="md:col-span-2">
          <label className="block text-[11px] font-bold text-[#34c759] mb-1">
            問題文 <span className="text-rose-600">*</span>
            <span className="text-[10px] font-normal text-[#d2d2d7] ml-2">数式は $...$ で囲んで入力</span>
          </label>
          <textarea
            value={data.stem || ''}
            onChange={(e) => onChange('stem', e.target.value)}
            onBlur={handleStemBlur}
            rows={3}
            placeholder="問題のテキストを入力..."
            className={`${baseInputClass} resize-y`}
          />
        </div>

        {/* 答え */}
        <div className="md:col-span-2">
          <label className="block text-[11px] font-bold text-[#34c759] mb-1">
            答え
          </label>
          <input
            type="text"
            value={data.answer_brief || ''}
            onChange={(e) => onChange('answer_brief', e.target.value)}
            onBlur={handleAnswerBlur}
            placeholder="例: 42, (B), x=3"
            className={baseInputClass}
          />
        </div>
      </div>

      {/* 難易度推定結果 (インライン) */}
      {(difficultyResult || difficultyEstimating) && (
        <DifficultyEstimatePanel
          result={difficultyResult}
          estimating={difficultyEstimating}
          onApply={() => {
            if (difficultyResult) {
              onChange('difficulty', difficultyResult.difficulty);
              onChange('difficulty_level', difficultyResult.difficulty_level);
              onChange('trickiness', difficultyResult.trickiness);
            }
          }}
        />
      )}

      {/* 追加フィールド展開 */}
      <div>
        <button
          type="button"
          onClick={() => setShowMore(!showMore)}
          className="text-xs text-[#d2d2d7] hover:text-[#86868b] font-semibold flex items-center gap-1"
        >
          <svg className={`w-3.5 h-3.5 transition-transform ${showMore ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
          {showMore ? 'その他の項目を閉じる' : `その他の項目 (${otherCols.length}件)`}
        </button>
        {showMore && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
            {otherCols.map((col) => (
              <div key={col.name}>
                <label className="block text-[10px] font-bold text-[#d2d2d7] mb-1">
                  {colLabel(col.name)}
                </label>
                {isJsonColumn(col.type) ? (
                  <textarea
                    value={data[col.name] || ''}
                    onChange={(e) => onChange(col.name, e.target.value)}
                    rows={2}
                    className={`${baseInputClass} font-mono text-xs resize-y`}
                    placeholder={col.type === 'JSONB' ? 'JSON形式で入力' : col.type === 'TEXT' ? 'テキストを入力' : '値を入力'}
                  />
                ) : isBoolColumn(col.type) ? (
                  <select
                    value={data[col.name] ?? ''}
                    onChange={(e) => onChange(col.name, e.target.value)}
                    className={baseInputClass}
                  >
                    <option value="">—</option>
                    <option value="true">はい</option>
                    <option value="false">いいえ</option>
                  </select>
                ) : (
                  <input
                    type={isNumericColumn(col.type) ? 'number' : 'text'}
                    value={data[col.name] ?? ''}
                    onChange={(e) => onChange(col.name, e.target.value)}
                    step={isNumericColumn(col.type) ? 'any' : undefined}
                    className={baseInputClass}
                    placeholder={colLabel(col.name)}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 追加ボタン */}
      <div className="flex gap-3 justify-end pt-1">
        <button onClick={onCancel}
          className="px-4 py-2 text-sm text-[#d2d2d7] hover:text-[#86868b] transition-colors font-semibold">
          キャンセル
        </button>
        <button
          onClick={onSubmit}
          disabled={!hasPriority || saving}
          className={`px-6 py-2.5 text-sm font-bold rounded-lg  transition-all flex items-center gap-1.5
            ${hasPriority && !saving
              ? 'bg-emerald-600 text-[#1d1d1f] hover:bg-emerald-700 shadow-emerald-200'
              : 'bg-black/[0.04] text-[#d2d2d7] cursor-not-allowed'
            }`}
        >
          {saving ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              追加中...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              行を追加 (難易度自動計算)
            </>
          )}
        </button>
      </div>
    </div>
  );
}
