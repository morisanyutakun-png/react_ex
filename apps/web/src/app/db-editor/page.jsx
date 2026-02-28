'use client';

import { useState, useEffect, useCallback, useRef, forwardRef } from 'react';
import {
  fetchDbTables,
  fetchDbSchema,
  fetchDbRows,
  updateDbRow,
  createDbRow,
  deleteDbRow,
  fetchSmartFields,
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
  stem_latex: '問題文(LaTeX)',
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

  // タブ: 'browse' | 'add'
  const [activeTab, setActiveTab] = useState('browse');

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

  // スマート登録
  const [smartFields, setSmartFields] = useState(null);
  const [smartForm, setSmartForm] = useState({});
  const [smartExpanded, setSmartExpanded] = useState({ required: true, recommended: false, optional: false });
  const [saving, setSaving] = useState(false);

  // インライン行追加 (browseタブ)
  const [showInlineAdd, setShowInlineAdd] = useState(false);
  const [inlineAddData, setInlineAddData] = useState({});
  const [inlineAddSaving, setInlineAddSaving] = useState(false);

  // 難易度推定状態
  const [difficultyEstimating, setDifficultyEstimating] = useState(false);
  const [difficultyResult, setDifficultyResult] = useState(null);

  // テーブル一覧取得
  useEffect(() => {
    fetchDbTables()
      .then((data) => {
        setTables(data.tables || []);
        if (data.tables?.length > 0) setSelectedTable(data.tables[0].name);
      })
      .catch((e) => setStatus(`テーブル一覧取得エラー: ${e.message}`));
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

  // スマートフィールド取得
  const loadSmartFields = useCallback(async (table) => {
    if (!table) return;
    try {
      const res = await fetchSmartFields(table);
      setSmartFields(res);
      const defaults = {};
      for (const group of ['required', 'recommended', 'optional']) {
        for (const f of res[group] || []) {
          if (f.default !== undefined) defaults[f.name] = f.default;
        }
      }
      setSmartForm(defaults);
    } catch {
      setSmartFields(null);
    }
  }, []);

  useEffect(() => {
    if (selectedTable) {
      setPage(0);
      setSearch('');
      setSearchInput('');
      loadTableData(selectedTable, 0, '');
      loadSmartFields(selectedTable);
    }
  }, [selectedTable, loadTableData, loadSmartFields]);

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

  // ── スマート登録 ──
  const onSmartFieldChange = (name, value) => {
    setSmartForm((prev) => ({ ...prev, [name]: value }));
  };

  const submitSmartForm = async () => {
    setSaving(true);
    setStatus('登録中...');
    try {
      const data = {};
      for (const [key, val] of Object.entries(smartForm)) {
        if (val === '' || val === null || val === undefined) continue;
        const fieldDef = [...(smartFields?.required || []), ...(smartFields?.recommended || []), ...(smartFields?.optional || [])]
          .find((f) => f.name === key);

        if (fieldDef?.type === 'json' && typeof val === 'string') {
          try { data[key] = JSON.parse(val); } catch { data[key] = val; }
        } else if (fieldDef?.type === 'number' || fieldDef?.type === 'slider') {
          const num = Number(val);
          data[key] = isNaN(num) ? val : num;
        } else if (fieldDef?.type === 'boolean') {
          data[key] = val === 'true' || val === true;
        } else {
          data[key] = val;
        }
      }
      // smart-create を使用（難易度自動計算付き）
      const res = await smartCreateDbRow(selectedTable, data, true);
      const diffInfo = res.difficulty_auto
        ? ` [難易度: ${res.difficulty_auto.difficulty} / Lv${res.difficulty_auto.difficulty_level}]`
        : '';
      setStatus(`登録完了! (ID: ${res.inserted_id || '—'})${diffInfo}`);
      setDifficultyResult(null);
      // フォームリセット
      const defaults = {};
      for (const group of ['required', 'recommended', 'optional']) {
        for (const f of smartFields?.[group] || []) {
          if (f.default !== undefined) defaults[f.name] = f.default;
        }
      }
      setSmartForm(defaults);
      loadTableData(selectedTable, page, search);
    } catch (e) {
      setStatus(`登録エラー: ${e.message}`);
    }
    setSaving(false);
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
    <div className="max-w-[100rem] mx-auto space-y-5 px-4 pb-12">
      <PageHeader
        title="DB エディタ"
        description="問題データの閲覧・編集・新規登録"
        icon={<Icons.Data />}
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'DB Editor' }]}
      />

      <StatusBar message={status} />

      {/* テーブル選択 + タブ切り替え */}
      <SectionCard>
        <div className="flex flex-wrap items-end gap-4">
          <SelectField
            label="テーブル"
            value={selectedTable}
            onChange={(v) => setSelectedTable(v)}
            options={tables.map((t) => ({ value: t.name, label: `${t.name} (PK: ${t.pk})` }))}
            className="min-w-[200px]"
          />
          <div className="flex gap-1 ml-auto">
            <TabButton active={activeTab === 'browse'} onClick={() => setActiveTab('browse')}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
              データ一覧
            </TabButton>
            <TabButton active={activeTab === 'add'} onClick={() => setActiveTab('add')}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 4v16m8-8H4" />
              </svg>
              かんたん登録
            </TabButton>
          </div>
        </div>
      </SectionCard>

      {/* ━━ データ一覧タブ ━━ */}
      {activeTab === 'browse' && (
        <>
          {/* ツールバー */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex gap-2 items-center">
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="キーワード検索..."
                className="px-3 py-2 rounded-lg border border-black/[0.06] bg-white shadow-sm text-sm
                           text-[#1d1d1f] transition-all hover:border-black/[0.08] focus:border-red-600
                           focus:ring-2 focus:ring-red-600/40 outline-none w-48"
              />
              <Button variant="secondary" size="sm" onClick={handleSearch}>
                <Icons.Search className="w-4 h-4" />
              </Button>
            </div>

            {/* カラム選択ボタン */}
            <button
              onClick={() => setShowColPicker(!showColPicker)}
              className="px-3 py-2 text-xs font-semibold text-[#86868b] bg-black/[0.04] border border-black/[0.06]
                         rounded-lg hover:border-black/[0.08] transition-all flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              表示カラム ({visibleCols.length}/{allCols.length})
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
                {showInlineAdd ? '追加を閉じる' : '行を追加'}
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

          {/* テーブル */}
          <div className="bg-black/[0.04] backdrop-blur-md rounded-lg border border-black/[0.06]  overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-black/[0.04] border-b border-black/[0.06]">
                    <th className="px-2 py-3 text-left font-bold text-[#86868b] uppercase tracking-wider sticky left-0 bg-black/[0.04] z-10 w-10">
                      #
                    </th>
                    {displayCols.map((col) => (
                      <th key={col.name}
                        className="px-3 py-3 text-left font-bold text-[#86868b] tracking-wider whitespace-nowrap border-l border-black/[0.06]"
                        title={`${col.name} (${col.type})${col.notnull ? ' NOT NULL' : ''}`}
                      >
                        <div className="flex items-center gap-1">
                          {colLabel(col.name)}
                          {col.pk && <span className="text-[9px] bg-[#fc3c44]/[0.08] text-[#fc3c44] px-1 rounded">PK</span>}
                        </div>
                        <div className="text-[9px] font-normal text-[#d2d2d7] mt-0.5">{col.name}</div>
                      </th>
                    ))}
                    <th className="px-2 py-3 text-center font-bold text-[#86868b] uppercase tracking-wider border-l border-black/[0.06] w-20">
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
                        className={`border-b border-black/[0.06] hover:bg-black/[0.04] transition-colors
                          ${rowDirty ? 'bg-[#ff9500]/[0.08]' : idx % 2 === 0 ? 'bg-black/[0.04]' : 'bg-black/[0.04]'}`}
                      >
                        <td className={`px-2 py-2 font-mono text-[#c7c7cc] sticky left-0 z-10
                          ${rowDirty ? 'bg-[#ff9500]/[0.08]' : idx % 2 === 0 ? 'bg-black/[0.04]' : 'bg-black/[0.04]'}`}>
                          {page * PAGE_SIZE + idx + 1}
                        </td>
                        {displayCols.map((col) => {
                          const isEditing = editingCell?.rowPk === rowPk && editingCell?.col === col.name;
                          const cellVal = getCellValue(row, col.name);
                          const dirty = isCellDirty(row, col.name);
                          const isPkCol = col.name === pk;

                          if (isPkCol) {
                            return (
                              <td key={col.name} className="px-3 py-2 border-l border-black/[0.06] font-mono text-[#fc3c44] font-bold">
                                {formatCellValue(cellVal)}
                              </td>
                            );
                          }

                          return (
                            <td key={col.name}
                              className={`px-1 py-1 border-l border-black/[0.06] cursor-pointer
                                ${dirty ? 'bg-[#ff9500]/[0.08] ring-1 ring-amber-500/30' : ''}
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
                                    ? <span className="text-[#d2d2d7] italic">null</span>
                                    : truncateDisplay(cellVal)}
                                </span>
                              )}
                            </td>
                          );
                        })}
                        <td className="px-2 py-2 border-l border-black/[0.06] text-center">
                          <div className="flex gap-1 justify-center">
                            <button
                              onClick={() => setDetailRow(row)}
                              className="text-[#d2d2d7] hover:text-[#fc3c44] transition-colors p-1"
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
        </>
      )}

      {/* ━━ かんたん登録タブ ━━ */}
      {activeTab === 'add' && smartFields && (
        <SmartRegistrationForm
          smartFields={smartFields}
          smartForm={smartForm}
          onFieldChange={onSmartFieldChange}
          expanded={smartExpanded}
          setExpanded={setSmartExpanded}
          onSubmit={submitSmartForm}
          saving={saving}
          table={selectedTable}
          onEstimateDifficulty={triggerDifficultyEstimate}
          difficultyEstimating={difficultyEstimating}
          difficultyResult={difficultyResult}
        />
      )}

      {/* ── 行詳細モーダル ── */}
      {detailRow && (
        <RowDetailModal row={detailRow} schema={schema} pk={pk} onClose={() => setDetailRow(null)} />
      )}

      {/* ── 削除確認 ── */}
      {deleteConfirm !== null && (
        <div className="fixed inset-0 bg-[#f5f5f7]/30 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-black/[0.04] rounded-lg p-6 shadow-xl max-w-sm mx-4 border border-black/[0.06]">
            <div className="text-lg font-bold text-[#1d1d1f] mb-2">削除確認</div>
            <p className="text-sm text-[#424245] mb-4">
              ID: <strong>{deleteConfirm}</strong> を削除しますか？この操作は取り消せません。
            </p>
            <div className="flex gap-3 justify-end">
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

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold rounded-lg transition-all
        ${active
          ? 'bg-[#fc3c44] text-white'
          : 'bg-black/[0.04] text-[#86868b] border border-black/[0.06] hover:border-black/[0.08] hover:text-[#fc3c44]'
        }`}
    >
      {children}
    </button>
  );
}


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
        className="w-full min-w-[200px] px-2 py-1.5 text-xs border border-red-600
                   rounded-lg bg-black/[0.04] font-mono resize-y outline-none shadow-inner"
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
        className="px-2 py-1.5 text-xs border border-red-600 rounded-lg bg-black/[0.04]"
      >
        <option value="">—</option>
        <option value="true">true</option>
        <option value="false">false</option>
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
      className="w-full min-w-[80px] px-2 py-1.5 text-xs border border-red-600
                 rounded-lg bg-black/[0.04] outline-none shadow-inner"
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
    <div className="bg-black/[0.04] rounded-lg border border-black/[0.06] shadow-lg p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-[#1d1d1f]">表示カラムを選択</h3>
        <div className="flex gap-2">
          <button onClick={() => setVisibleCols(DEFAULT_VISIBLE_COLS)}
            className="text-xs text-[#fc3c44] hover:text-[#fc3c44] font-semibold">デフォルト</button>
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
                       hover:bg-[#fc3c44]/[0.08] hover:text-[#fc3c44] transition-colors border border-black/[0.06]">
            {group.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-1.5">
        {allCols.map((col) => (
          <label key={col.name} className={`flex items-center gap-1.5 p-1.5 rounded-lg cursor-pointer text-[11px]
            transition-colors ${visibleCols.includes(col.name) ? 'bg-[#fc3c44]/[0.08] text-[#fc3c44]' : 'text-[#c7c7cc] hover:bg-black/[0.03]'}`}>
            <input type="checkbox" checked={visibleCols.includes(col.name)}
              onChange={() => toggleCol(col.name)} className="w-3 h-3 rounded accent-[#fc3c44]" />
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
    <div className="fixed inset-0 bg-[#f5f5f7]/30 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-black/[0.04] rounded-lg shadow-2xl max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col border border-black/[0.06]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-black/[0.06]">
          <h2 className="text-lg font-bold text-[#1d1d1f]">
            行詳細 — ID: {row[pk]}
          </h2>
          <button onClick={onClose} className="text-[#c7c7cc] hover:text-[#424245] text-xl font-bold p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="overflow-y-auto flex-1 p-6 space-y-2">
          {schema.map((col) => {
            const val = row[col.name];
            const isEmpty = val === null || val === undefined || val === '';
            return (
              <div key={col.name} className="flex gap-3 py-2 border-b border-black/[0.06]">
                <div className="w-44 flex-shrink-0">
                  <span className="text-xs font-bold text-[#424245]">{colLabel(col.name)}</span>
                  <span className="text-[9px] text-[#d2d2d7] block">{col.name} · {col.type}</span>
                </div>
                <div className="flex-1 min-w-0">
                  {isEmpty ? (
                    <span className="text-xs text-[#d2d2d7] italic">null</span>
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


// ── スマート登録フォーム ──
function SmartRegistrationForm({ smartFields, smartForm, onFieldChange, expanded, setExpanded, onSubmit, saving, table, onEstimateDifficulty, difficultyEstimating, difficultyResult }) {
  const toggleSection = (section) => {
    setExpanded((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const requiredFilled = (smartFields.required || []).every((f) => {
    const val = smartForm[f.name];
    return val !== undefined && val !== null && val !== '';
  });

  const filledCount = Object.values(smartForm).filter((v) => v !== undefined && v !== null && v !== '').length;
  const totalFieldCount = [...(smartFields.required || []), ...(smartFields.recommended || []), ...(smartFields.optional || [])].length;

  // 難易度推定トリガー: stem 入力後にBlurした時
  const handleStemBlur = () => {
    const stem = smartForm.stem || '';
    const answer = smartForm.answer_brief || '';
    if (stem.trim()) {
      onEstimateDifficulty(stem, answer);
    }
  };

  const handleAnswerBlur = () => {
    const stem = smartForm.stem || '';
    const answer = smartForm.answer_brief || '';
    if (stem.trim()) {
      onEstimateDifficulty(stem, answer);
    }
  };

  // 推定結果を反映するボタン
  const applyDifficultyResult = () => {
    if (!difficultyResult) return;
    onFieldChange('difficulty', difficultyResult.difficulty);
    onFieldChange('difficulty_level', String(difficultyResult.difficulty_level));
    onFieldChange('trickiness', difficultyResult.trickiness);
  };

  return (
    <div className="space-y-4">
      {/* プログレスバー */}
      <div className="bg-black/[0.04] backdrop-blur-md rounded-lg border border-black/[0.06] p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-bold text-[#1d1d1f]">入力進捗</span>
          <span className="text-xs text-[#c7c7cc]">{filledCount}/{totalFieldCount} フィールド入力済み</span>
        </div>
        <div className="h-2 bg-black/[0.04] rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${requiredFilled ? 'bg-[#34c759]' : 'bg-[#fc3c44]'}`}
            style={{ width: `${Math.min(100, (filledCount / totalFieldCount) * 100)}%` }}
          />
        </div>
        {!requiredFilled && (
          <p className="text-xs text-[#ff9500] mt-2 flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            必須フィールドを入力してください
          </p>
        )}
      </div>

      {/* 必須フィールド */}
      <FieldSection
        title="必須フィールド"
        subtitle="教科・トピック・問題文・答えを優先入力"
        color="rose"
        open={expanded.required}
        onToggle={() => toggleSection('required')}
        badge="必須"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(smartFields.required || []).map((field) => (
            <SmartField key={field.name} field={field}
              value={smartForm[field.name] ?? ''}
              onChange={(v) => onFieldChange(field.name, v)}
              allValues={smartForm}
              onBlur={field.name === 'stem' ? handleStemBlur : field.name === 'answer_brief' ? handleAnswerBlur : undefined}
            />
          ))}
        </div>
      </FieldSection>

      {/* 難易度自動推定パネル */}
      {(difficultyResult || difficultyEstimating) && (
        <DifficultyEstimatePanel
          result={difficultyResult}
          estimating={difficultyEstimating}
          onApply={applyDifficultyResult}
        />
      )}

      {/* 推奨フィールド */}
      <FieldSection
        title="推奨フィールド"
        subtitle="入力するとRAG精度が向上します"
        color="amber"
        open={expanded.recommended}
        onToggle={() => toggleSection('recommended')}
        badge="推奨"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(smartFields.recommended || []).map((field) => (
            <SmartField key={field.name} field={field}
              value={smartForm[field.name] ?? ''}
              onChange={(v) => onFieldChange(field.name, v)}
              allValues={smartForm} />
          ))}
        </div>
      </FieldSection>

      {/* 任意フィールド */}
      <FieldSection
        title="その他"
        subtitle="任意のメタデータ"
        color="slate"
        open={expanded.optional}
        onToggle={() => toggleSection('optional')}
        badge="任意"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(smartFields.optional || []).map((field) => (
            <SmartField key={field.name} field={field}
              value={smartForm[field.name] ?? ''}
              onChange={(v) => onFieldChange(field.name, v)}
              allValues={smartForm} />
          ))}
        </div>
      </FieldSection>

      {/* 登録ボタン */}
      <div className="flex justify-end gap-3 pt-2">
        <Button variant="ghost" onClick={() => {
          const defaults = {};
          for (const group of ['required', 'recommended', 'optional']) {
            for (const f of smartFields?.[group] || []) {
              onFieldChange(f.name, f.default ?? '');
            }
          }
        }}>
          クリア
        </Button>
        <Button
          variant="success"
          onClick={onSubmit}
          disabled={!requiredFilled || saving}
          className="px-8"
        >
          {saving ? (
            <>
              <svg className="w-4 h-4 animate-spin mr-2" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              登録中...
            </>
          ) : (
            <>
              <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {table} に登録
            </>
          )}
        </Button>
      </div>
    </div>
  );
}


// ── 難易度推定結果パネル ──
function DifficultyEstimatePanel({ result, estimating, onApply }) {
  if (estimating) {
    return (
      <div className="bg-[#fc3c44]/[0.08] border border-black/[0.06] rounded-lg p-4 flex items-center gap-3">
        <svg className="w-5 h-5 animate-spin text-[#fc3c44]" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span className="text-sm font-semibold text-[#fc3c44]">難易度を推定中...</span>
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
    <div className="bg-gradient-to-r from-violet-50 to-red-50 border border-black/[0.06] rounded-lg p-4">
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
        <div className="bg-black/[0.04] rounded-lg p-3 text-center border border-black/[0.06]">
          <div className="text-[10px] font-bold text-[#c7c7cc] mb-1">難易度スコア</div>
          <div className="text-xl font-bold text-[#af52de]">{result.difficulty.toFixed(3)}</div>
          <div className="h-1.5 bg-black/[0.04] rounded-full mt-1.5 overflow-hidden">
            <div className="h-full bg-[#af52de] rounded-full" style={{ width: `${result.difficulty * 100}%` }} />
          </div>
        </div>
        <div className="bg-black/[0.04] rounded-lg p-3 text-center border border-black/[0.06]">
          <div className="text-[10px] font-bold text-[#c7c7cc] mb-1">レベル</div>
          <div className={`inline-flex px-3 py-1 rounded-lg text-lg font-bold ${levelColors[result.difficulty_level] || 'bg-black/[0.04] text-[#86868b]'}`}>
            Lv.{result.difficulty_level}
          </div>
          <div className="text-[10px] text-[#c7c7cc] mt-1">{levelLabels[result.difficulty_level] || ''}</div>
        </div>
        <div className="bg-black/[0.04] rounded-lg p-3 text-center border border-black/[0.06]">
          <div className="text-[10px] font-bold text-[#c7c7cc] mb-1">ひっかけ度</div>
          <div className="text-xl font-bold text-[#ff9500]">{result.trickiness.toFixed(3)}</div>
          <div className="h-1.5 bg-black/[0.04] rounded-full mt-1.5 overflow-hidden">
            <div className="h-full bg-[#ff9500] rounded-full" style={{ width: `${result.trickiness * 100}%` }} />
          </div>
        </div>
      </div>
      <p className="text-[10px] text-[#d2d2d7] mt-2 text-center">
        登録時に自動で反映されます。「推定値を適用」で推奨フィールドにも即座に反映できます。
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

  const baseInputClass = `w-full px-3 py-2 text-sm border border-black/[0.06] rounded-lg bg-white
    text-[#1d1d1f] transition-all hover:border-black/[0.08] focus:border-[#fc3c44]/50 focus:ring-2 focus:ring-[#fc3c44]/20 outline-none placeholder:text-[#c7c7cc]`;

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
    <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-black/[0.06] rounded-lg p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-[#34c759]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span className="text-sm font-bold text-[#34c759]">新しい行を追加</span>
          <span className="text-[10px] bg-[#34c759]/[0.08] text-[#34c759] px-2 py-0.5 rounded-lg font-bold">
            {table}
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
                      : 'bg-black/[0.04] text-[#86868b] border-black/[0.06] hover:border-emerald-600'
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
            placeholder={data.subject ? '候補から選択 or 自由入力' : '先に教科を選択してください'}
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
          {showMore ? 'その他のフィールドを閉じる' : `その他のフィールド (${otherCols.length}項目)`}
        </button>
        {showMore && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
            {otherCols.map((col) => (
              <div key={col.name}>
                <label className="block text-[10px] font-bold text-[#d2d2d7] mb-1">
                  {colLabel(col.name)} <span className="text-[9px] text-[#c7c7cc]">{col.name}</span>
                </label>
                {isJsonColumn(col.type) ? (
                  <textarea
                    value={data[col.name] || ''}
                    onChange={(e) => onChange(col.name, e.target.value)}
                    rows={2}
                    className={`${baseInputClass} font-mono text-xs resize-y`}
                    placeholder={col.type}
                  />
                ) : isBoolColumn(col.type) ? (
                  <select
                    value={data[col.name] ?? ''}
                    onChange={(e) => onChange(col.name, e.target.value)}
                    className={baseInputClass}
                  >
                    <option value="">—</option>
                    <option value="true">true</option>
                    <option value="false">false</option>
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


// ── フィールドセクション (アコーディオン) ──
function FieldSection({ title, subtitle, color, open, onToggle, badge, children }) {
  const colorMap = {
    rose: { bg: 'bg-rose-50', border: 'border-rose-200', badge: 'bg-rose-100 text-rose-600', icon: 'text-rose-600' },
    amber: { bg: 'bg-[#ff9500]/[0.08]', border: 'border-[#ff9500]/20', badge: 'bg-amber-100 text-[#ff9500]', icon: 'text-[#ff9500]' },
    slate: { bg: 'bg-black/[0.04]', border: 'border-black/[0.06]', badge: 'bg-black/[0.04] text-[#86868b]', icon: 'text-[#d2d2d7]' },
  };
  const c = colorMap[color] || colorMap.slate;

  return (
    <div className={`rounded-lg border ${c.border} overflow-hidden transition-all`}>
      <button onClick={onToggle}
        className={`w-full flex items-center justify-between px-5 py-4 ${c.bg} hover:brightness-95 transition-all`}>
        <div className="flex items-center gap-3">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${c.badge}`}>
            {badge}
          </span>
          <div className="text-left">
            <div className="text-sm font-bold text-[#1d1d1f]">{title}</div>
            <div className="text-[11px] text-[#c7c7cc]">{subtitle}</div>
          </div>
        </div>
        <svg className={`w-5 h-5 ${c.icon} transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="px-5 py-5 bg-black/[0.04]">
          {children}
        </div>
      )}
    </div>
  );
}


// ── 数式パレット（リッチテキストエリア用） ──
const MATH_SYMBOLS = [
  { group: '基本', items: [
    { label: '分数', insert: '\\frac{a}{b}', display: 'a/b' },
    { label: '平方根', insert: '\\sqrt{x}', display: '√x' },
    { label: 'n乗根', insert: '\\sqrt[n]{x}', display: 'ⁿ√x' },
    { label: '上付き', insert: 'x^{n}', display: 'xⁿ' },
    { label: '下付き', insert: 'x_{i}', display: 'xᵢ' },
    { label: 'プラマイ', insert: '\\pm', display: '±' },
    { label: '掛ける', insert: '\\times', display: '×' },
    { label: '割る', insert: '\\div', display: '÷' },
  ]},
  { group: 'ギリシャ文字', items: [
    { label: 'α', insert: '\\alpha' },
    { label: 'β', insert: '\\beta' },
    { label: 'θ', insert: '\\theta' },
    { label: 'π', insert: '\\pi' },
    { label: 'Σ', insert: '\\sum_{i=1}^{n}' },
    { label: '∫', insert: '\\int_{a}^{b}' },
    { label: 'lim', insert: '\\lim_{x \\to \\infty}' },
    { label: '∞', insert: '\\infty' },
  ]},
  { group: '関数・記号', items: [
    { label: 'sin', insert: '\\sin' },
    { label: 'cos', insert: '\\cos' },
    { label: 'tan', insert: '\\tan' },
    { label: 'log', insert: '\\log' },
    { label: 'ln', insert: '\\ln' },
    { label: '≤', insert: '\\leq' },
    { label: '≥', insert: '\\geq' },
    { label: '≠', insert: '\\neq' },
    { label: '→', insert: '\\rightarrow' },
    { label: '⇒', insert: '\\Rightarrow' },
  ]},
  { group: '括弧', items: [
    { label: '()', insert: '\\left( \\right)' },
    { label: '{}', insert: '\\left\\{ \\right\\}' },
    { label: '||', insert: '\\left| \\right|' },
    { label: '[]', insert: '\\left[ \\right]' },
  ]},
];

/** リッチテキストエリア — シンプル/数式モード切替付き */
function RichTextArea({ value, onChange, rows, help, name, onBlur }) {
  const textRef = useRef(null);
  const [showPalette, setShowPalette] = useState(false);
  const [mode, setMode] = useState('simple'); // 'simple' | 'math'

  const insertAtCursor = (text) => {
    const ta = textRef.current;
    if (!ta) { onChange(value + text); return; }
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const before = value.slice(0, start);
    const after = value.slice(end);
    const newVal = before + text + after;
    onChange(newVal);
    requestAnimationFrame(() => {
      ta.focus();
      ta.selectionStart = ta.selectionEnd = start + text.length;
    });
  };

  const wrapWithDollar = () => {
    const ta = textRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    if (start !== end) {
      const selected = value.slice(start, end);
      const newVal = value.slice(0, start) + '$' + selected + '$' + value.slice(end);
      onChange(newVal);
      requestAnimationFrame(() => { ta.focus(); ta.selectionStart = start; ta.selectionEnd = end + 2; });
    } else {
      insertAtCursor('$$');
      requestAnimationFrame(() => { ta.focus(); ta.selectionStart = ta.selectionEnd = start + 1; });
    }
  };

  const baseInputClass = `w-full px-3 py-2.5 text-sm border border-black/[0.06] rounded-lg bg-white
    text-[#1d1d1f] transition-all hover:border-black/[0.08] focus:border-[#fc3c44]/50 focus:ring-2 focus:ring-[#fc3c44]/20 outline-none`;

  return (
    <div className="md:col-span-2">
      {/* モード切替タブ */}
      <div className="flex items-center gap-0 mb-2 bg-black/[0.04] rounded-lg p-0.5 w-fit">
        <button type="button" onClick={() => setMode('simple')}
          className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all ${
            mode === 'simple'
              ? 'bg-white text-[#1d1d1f] '
              : 'text-[#d2d2d7] hover:text-[#86868b]'
          }`}>
          📝 テキスト入力
        </button>
        <button type="button" onClick={() => setMode('math')}
          className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all ${
            mode === 'math'
              ? 'bg-black/[0.04] text-[#fc3c44] '
              : 'text-[#d2d2d7] hover:text-[#86868b]'
          }`}>
          🔢 数式入力
        </button>
      </div>

      {/* 数式モード: ツールバー */}
      {mode === 'math' && (
        <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
          <button type="button" onClick={wrapWithDollar}
            className="px-2 py-1 text-[11px] font-bold bg-[#fc3c44]/[0.08] text-[#fc3c44] rounded-lg hover:bg-[#fc3c44]/[0.12] transition-colors border border-[#fc3c44]/20"
            title="選択テキストを数式$...$で囲む">
            $ 数式 $
          </button>
          <button type="button" onClick={() => setShowPalette(!showPalette)}
            className={`px-2 py-1 text-[11px] font-bold rounded-lg transition-colors border ${
              showPalette ? 'bg-[#fc3c44] text-white border-red-600' : 'bg-black/[0.04] text-[#c7c7cc] border-black/[0.06] hover:bg-black/[0.03]'
            }`}>
            {showPalette ? '▼ パレット閉じる' : '▶ 数式パレット'}
          </button>
          <span className="text-[10px] text-[#d2d2d7] ml-2">日本語テキスト + 数式は $ で囲んで入力</span>
        </div>
      )}

      {/* 数式パレット */}
      {mode === 'math' && showPalette && (
        <div className="mb-2 p-3 bg-gradient-to-b from-red-50 to-white rounded-lg border border-[#fc3c44]/20 space-y-2">
          {MATH_SYMBOLS.map((g) => (
            <div key={g.group}>
              <div className="text-[9px] font-bold text-[#fc3c44] mb-1 tracking-wider">{g.group}</div>
              <div className="flex flex-wrap gap-1">
                {g.items.map((sym) => (
                  <button key={sym.insert} type="button"
                    onClick={() => insertAtCursor(sym.insert)}
                    className="px-2 py-1 text-xs bg-black/[0.04] border border-[#fc3c44]/20 rounded-md hover:bg-[#fc3c44]/[0.08] hover:border-red-700 transition-colors text-[#1d1d1f] font-mono"
                    title={`${sym.label}: ${sym.insert}`}>
                    {sym.display || sym.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* テキストエリア本体 */}
      <textarea
        ref={textRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        rows={rows || 6}
        placeholder={mode === 'simple'
          ? 'テキストをそのまま入力 or 貼り付け（コピペOK）'
          : '日本語テキスト＋数式（$x^2+1$のように$で囲む）'}
        className={`${baseInputClass} resize-y`}
      />
      {mode === 'simple' ? (
        <p className="text-[10px] text-[#d2d2d7] mt-1">
          テキストデータをそのままコピペできます。数式挿入が必要なら「🔢 数式入力」タブへ
        </p>
      ) : (
        <p className="text-[10px] text-[#d2d2d7] mt-1">
          例: 「$x^2 + 2x + 1 = 0$ を解け。」 — ふつうの文章の中に $...$ で数式を入れるだけ
        </p>
      )}
    </div>
  );
}


// ── 個別フィールド入力 ──
function SmartField({ field, value, onChange, allValues, onBlur }) {
  const { name, label, type, help, options, rows, min, max, step, depends_on } = field;

  const baseInputClass = `w-full px-3 py-2.5 text-sm border border-black/[0.06] rounded-lg bg-white
    text-[#1d1d1f] transition-all hover:border-black/[0.08] focus:border-[#fc3c44]/50 focus:ring-2 focus:ring-[#fc3c44]/20 outline-none`;

  const isWide = type === 'textarea' || type === 'json' || type === 'rich_textarea';

  // dependent_select: 親の選択に応じた選択肢を動的生成 + 自由入力対応
  if (type === 'dependent_select') {
    const parentVal = depends_on ? allValues?.[depends_on] : null;
    const dynamicOptions = parentVal ? (SUBJECT_TOPICS[parentVal] || []) : [];
    const isCustom = value && dynamicOptions.length > 0 && !dynamicOptions.includes(value);

    return (
      <div className={isWide ? 'md:col-span-2' : ''}>
        <label className="block text-[11px] font-bold text-[#86868b] mb-1.5 tracking-[0.08em]">
          {label}
          <span className="text-[10px] font-normal text-[#c7c7cc] ml-2 normal-case tracking-normal">{name}</span>
        </label>

        {/* 候補チップ（親が選択済みのとき表示） */}
        {parentVal && dynamicOptions.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-1.5">
            {dynamicOptions.map((opt) => (
              <button key={opt} type="button"
                onClick={() => onChange(opt)}
                className={`px-2 py-0.5 text-[11px] rounded-lg border transition-all ${
                  value === opt
                    ? 'bg-[#fc3c44] text-white border-red-600'
                    : 'bg-black/[0.04] text-[#c7c7cc] border-black/[0.06] hover:border-red-700 hover:text-[#fc3c44]'
                }`}>
                {opt}
              </button>
            ))}
          </div>
        )}

        {/* 自由入力フィールド */}
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={parentVal ? `候補から選択 or 新しい分野を自由入力` : '先に教科を選択してください'}
          className={`${baseInputClass} ${isCustom ? 'border-emerald-300 bg-[#34c759]/[0.08]/30' : ''}`}
        />
        {isCustom && (
          <p className="text-[10px] text-[#34c759] mt-0.5 flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
            新しい分野「{value}」を追加します
          </p>
        )}
        {!parentVal && depends_on && (
          <p className="text-[10px] text-[#ff9500] mt-1">⬆ 教科を先に選択すると候補が表示されます</p>
        )}
      </div>
    );
  }

  // rich_textarea: 数式パレット付きテキストエリア
  if (type === 'rich_textarea') {
    return (
      <div className="md:col-span-2">
        <label className="block text-[11px] font-bold text-[#86868b] mb-1.5 tracking-[0.08em]">
          {label}
          <span className="text-[10px] font-normal text-[#c7c7cc] ml-2 normal-case tracking-normal">{name}</span>
        </label>
        <RichTextArea value={value} onChange={onChange} rows={rows} help={help} name={name} onBlur={onBlur} />
      </div>
    );
  }

  return (
    <div className={isWide ? 'md:col-span-2' : ''}>
      <label className="block text-[11px] font-bold text-[#86868b] mb-1.5 tracking-[0.08em]">
        {label}
        <span className="text-[10px] font-normal text-[#c7c7cc] ml-2 normal-case tracking-normal">{name}</span>
      </label>

      {type === 'select' && options ? (
        <select value={value} onChange={(e) => onChange(e.target.value)} className={baseInputClass}>
          <option value="">— 選択 —</option>
          {options.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      ) : type === 'textarea' ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows || 4}
          placeholder={help}
          className={`${baseInputClass} resize-y`}
        />
      ) : type === 'json' ? (
        <textarea
          value={typeof value === 'object' ? JSON.stringify(value, null, 2) : value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows || 3}
          placeholder={help}
          className={`${baseInputClass} resize-y font-mono text-xs`}
        />
      ) : type === 'slider' ? (
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={min ?? 0}
            max={max ?? 1}
            step={step ?? 0.05}
            value={value || min || 0}
            onChange={(e) => onChange(e.target.value)}
            className="flex-1 h-2 bg-black/[0.04] rounded-full appearance-none accent-red-500"
          />
          <span className="text-sm font-mono text-[#fc3c44] font-bold w-12 text-right">
            {Number(value || 0).toFixed(2)}
          </span>
        </div>
      ) : type === 'number' ? (
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          step="any"
          placeholder={help}
          className={baseInputClass}
        />
      ) : type === 'boolean' ? (
        <select value={String(value)} onChange={(e) => onChange(e.target.value)} className={baseInputClass}>
          <option value="">— 選択 —</option>
          <option value="true">true</option>
          <option value="false">false</option>
        </select>
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder={help}
          className={baseInputClass}
        />
      )}

      {help && type !== 'textarea' && type !== 'json' && (
        <p className="text-[10px] text-[#d2d2d7] mt-1">{help}</p>
      )}
    </div>
  );
}
