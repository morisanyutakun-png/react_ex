'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  fetchDbTables,
  fetchDbSchema,
  fetchDbRows,
  updateDbRow,
  createDbRow,
  deleteDbRow,
} from '@/lib/api';
import {
  StatusBar,
  SectionCard,
  Button,
  PageHeader,
  SelectField,
  Icons,
} from '@/components/ui';

const PAGE_SIZE = 30;

/** JSONB / JSON かどうかの判定 */
function isJsonColumn(type) {
  if (!type) return false;
  const t = type.toUpperCase();
  return t.includes('JSON') || t.includes('JSONB');
}

/** 数値型かどうか */
function isNumericColumn(type) {
  if (!type) return false;
  const t = type.toUpperCase();
  return t.includes('INT') || t.includes('DOUBLE') || t.includes('FLOAT')
    || t.includes('NUMERIC') || t.includes('DECIMAL') || t.includes('REAL')
    || t.includes('SERIAL') || t.includes('SMALLINT') || t.includes('BIGINT');
}

/** BOOLEAN型 */
function isBoolColumn(type) {
  if (!type) return false;
  return type.toUpperCase().includes('BOOL');
}

/** セル表示用の値フォーマット */
function formatCellValue(val) {
  if (val === null || val === undefined) return '';
  if (typeof val === 'object') {
    try { return JSON.stringify(val, null, 2); } catch { return String(val); }
  }
  return String(val);
}

/** セル表示用の短縮値 */
function truncateDisplay(val, max = 80) {
  const s = formatCellValue(val);
  if (s.length <= max) return s;
  return s.slice(0, max) + '...';
}

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

  // 編集状態: { rowPk: { colName: newValue } }
  const [edits, setEdits] = useState({});
  // 現在編集中のセル
  const [editingCell, setEditingCell] = useState(null); // { rowPk, col }
  const editRef = useRef(null);

  // 新規行追加モード
  const [newRow, setNewRow] = useState(null);

  // 削除確認
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // テーブル一覧取得
  useEffect(() => {
    fetchDbTables()
      .then((data) => {
        setTables(data.tables || []);
        if (data.tables?.length > 0) {
          setSelectedTable(data.tables[0].name);
        }
      })
      .catch((e) => setStatus(`テーブル一覧取得エラー: ${e.message}`));
  }, []);

  // テーブル切替時にスキーマ＋行を取得
  const loadTableData = useCallback(async (table, pageNum = 0, searchQuery = '') => {
    if (!table) return;
    setLoading(true);
    setEdits({});
    setEditingCell(null);
    setNewRow(null);
    setDeleteConfirm(null);
    try {
      const [schemaRes, rowsRes] = await Promise.all([
        fetchDbSchema(table),
        fetchDbRows(table, {
          limit: PAGE_SIZE,
          offset: pageNum * PAGE_SIZE,
          ...(searchQuery ? { search: searchQuery } : {}),
        }),
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

  // セル編集開始
  const startEdit = (rowPk, col) => {
    setEditingCell({ rowPk, col });
    setTimeout(() => editRef.current?.focus(), 0);
  };

  // セル編集値変更
  const onCellChange = (rowPk, col, value) => {
    setEdits((prev) => ({
      ...prev,
      [rowPk]: { ...(prev[rowPk] || {}), [col]: value },
    }));
  };

  // 編集確定（セルからフォーカス外れ時）
  const finishEdit = () => {
    setEditingCell(null);
  };

  // 行の現在値（編集反映済み）
  const getCellValue = (row, col) => {
    const rowPk = row[pk];
    if (edits[rowPk] && col in edits[rowPk]) return edits[rowPk][col];
    return row[col];
  };

  // セルが変更されたか
  const isCellDirty = (row, col) => {
    const rowPk = row[pk];
    return edits[rowPk] && col in edits[rowPk];
  };

  // 変更行を一括保存
  const saveAll = async () => {
    const dirtyPks = Object.keys(edits);
    if (dirtyPks.length === 0) {
      setStatus('変更がありません');
      return;
    }
    setStatus('保存中...');
    let successCount = 0;
    let errorCount = 0;
    for (const rowPk of dirtyPks) {
      try {
        const data = edits[rowPk];
        // 型変換
        const converted = {};
        for (const [col, val] of Object.entries(data)) {
          const colSchema = schema.find((c) => c.name === col);
          if (colSchema && isNumericColumn(colSchema.type) && val !== '' && val !== null) {
            const num = Number(val);
            converted[col] = isNaN(num) ? val : num;
          } else if (colSchema && isBoolColumn(colSchema.type)) {
            converted[col] = val === 'true' || val === true;
          } else if (colSchema && isJsonColumn(colSchema.type) && typeof val === 'string') {
            try { converted[col] = JSON.parse(val); } catch { converted[col] = val; }
          } else {
            converted[col] = val === '' ? null : val;
          }
        }
        await updateDbRow(selectedTable, rowPk, converted);
        successCount++;
      } catch (e) {
        errorCount++;
        setStatus(`保存エラー (id=${rowPk}): ${e.message}`);
      }
    }
    setEdits({});
    if (errorCount === 0) {
      setStatus(`${successCount}行を保存しました`);
    } else {
      setStatus(`${successCount}行保存、${errorCount}行エラー`);
    }
    loadTableData(selectedTable, page, search);
  };

  // 新規行
  const startNewRow = () => {
    const empty = {};
    for (const col of schema) {
      if (col.name === pk && col.type?.toUpperCase().includes('SERIAL')) continue;
      empty[col.name] = '';
    }
    setNewRow(empty);
  };

  const onNewRowChange = (col, val) => {
    setNewRow((prev) => ({ ...prev, [col]: val }));
  };

  const saveNewRow = async () => {
    if (!newRow) return;
    setStatus('新規行を追加中...');
    try {
      const data = {};
      for (const [col, val] of Object.entries(newRow)) {
        if (val === '' || val === null || val === undefined) continue;
        const colSchema = schema.find((c) => c.name === col);
        if (colSchema && isNumericColumn(colSchema.type)) {
          const num = Number(val);
          data[col] = isNaN(num) ? val : num;
        } else if (colSchema && isBoolColumn(colSchema.type)) {
          data[col] = val === 'true' || val === true;
        } else if (colSchema && isJsonColumn(colSchema.type) && typeof val === 'string') {
          try { data[col] = JSON.parse(val); } catch { data[col] = val; }
        } else {
          data[col] = val;
        }
      }
      const res = await createDbRow(selectedTable, data);
      setNewRow(null);
      setStatus(`行を追加しました (id: ${res.inserted_id || '—'})`);
      loadTableData(selectedTable, page, search);
    } catch (e) {
      setStatus(`追加エラー: ${e.message}`);
    }
  };

  // 削除
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

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const hasDirty = Object.keys(edits).length > 0;

  // 表示するカラム（id を先頭に、timestamp系を最後に）
  const displayCols = schema.filter((c) => {
    // embedding系の巨大カラムは除外
    const n = c.name.toLowerCase();
    return !n.includes('vector') && !n.includes('embedding');
  });

  return (
    <div className="max-w-[100rem] mx-auto space-y-6 px-4">
      <PageHeader
        title="DB エディタ"
        description="データベースのテーブルを直接閲覧・編集。Excelのようにセルをクリックして書き換え。"
        icon={<Icons.Data />}
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'DB Editor' }]}
      />

      <StatusBar message={status} />

      {/* ツールバー */}
      <SectionCard>
        <div className="flex flex-wrap items-end gap-4">
          <SelectField
            label="テーブル"
            value={selectedTable}
            onChange={(v) => setSelectedTable(v)}
            options={tables.map((t) => ({ value: t.name, label: `${t.name} (PK: ${t.pk})` }))}
            className="min-w-[200px]"
          />

          <div>
            <label className="block text-[11px] font-black text-slate-400 mb-2 tracking-[0.1em] uppercase">
              検索
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="キーワード検索..."
                className="px-3 py-2.5 rounded-xl border-2 border-slate-100 bg-white/50 text-sm
                           text-slate-700 transition-all hover:border-indigo-200 focus:border-indigo-500
                           focus:bg-white outline-none w-48"
              />
              <Button variant="secondary" size="sm" onClick={handleSearch}>
                <Icons.Search className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="flex gap-2 ml-auto">
            <Button variant="success" onClick={saveAll} disabled={!hasDirty}>
              <Icons.Success className="w-4 h-4 mr-1" />
              変更を保存 {hasDirty && `(${Object.keys(edits).length}行)`}
            </Button>
            <Button onClick={startNewRow} disabled={!!newRow}>
              + 行を追加
            </Button>
            <Button variant="ghost" onClick={() => { setEdits({}); loadTableData(selectedTable, page, search); }}>
              リロード
            </Button>
          </div>
        </div>

        {/* ページネーション */}
        <div className="flex items-center gap-4 mt-4 text-sm text-slate-500">
          <span>{total}件中 {page * PAGE_SIZE + 1}〜{Math.min((page + 1) * PAGE_SIZE, total)}件</span>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={() => handlePageChange(page - 1)} disabled={page === 0}>
              &lt; 前
            </Button>
            <span className="px-2 py-1 text-xs font-mono">{page + 1}/{totalPages || 1}</span>
            <Button variant="ghost" size="sm" onClick={() => handlePageChange(page + 1)} disabled={page + 1 >= totalPages}>
              次 &gt;
            </Button>
          </div>
        </div>
      </SectionCard>

      {/* 削除確認ダイアログ */}
      {deleteConfirm !== null && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-6 shadow-xl max-w-sm mx-4">
            <div className="text-lg font-bold text-slate-800 mb-2">削除確認</div>
            <p className="text-sm text-slate-600 mb-4">
              ID: <strong>{deleteConfirm}</strong> を削除しますか？この操作は取り消せません。
            </p>
            <div className="flex gap-3 justify-end">
              <Button variant="ghost" onClick={() => setDeleteConfirm(null)}>キャンセル</Button>
              <Button variant="danger" onClick={confirmDelete}>削除する</Button>
            </div>
          </div>
        </div>
      )}

      {/* スプレッドシート */}
      <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/80 shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200">
                <th className="px-2 py-3 text-left font-bold text-slate-500 uppercase tracking-wider sticky left-0 bg-slate-50/80 z-10 w-10">
                  #
                </th>
                {displayCols.map((col) => (
                  <th
                    key={col.name}
                    className="px-3 py-3 text-left font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap border-l border-slate-100"
                    title={`${col.name} (${col.type})${col.notnull ? ' NOT NULL' : ''}`}
                  >
                    <div className="flex items-center gap-1">
                      {col.name}
                      {col.pk && <span className="text-[9px] bg-indigo-100 text-indigo-600 px-1 rounded">PK</span>}
                      {col.notnull && !col.pk && <span className="text-[9px] bg-amber-100 text-amber-600 px-1 rounded">*</span>}
                    </div>
                    <div className="text-[9px] font-normal text-slate-300 mt-0.5">{col.type}</div>
                  </th>
                ))}
                <th className="px-2 py-3 text-center font-bold text-slate-500 uppercase tracking-wider border-l border-slate-100 w-16">
                  操作
                </th>
              </tr>
            </thead>
            <tbody>
              {/* 新規行 */}
              {newRow && (
                <tr className="bg-emerald-50/60 border-b border-emerald-200">
                  <td className="px-2 py-2 text-emerald-600 font-bold sticky left-0 bg-emerald-50/60 z-10">
                    NEW
                  </td>
                  {displayCols.map((col) => {
                    if (col.name === pk && col.type?.toUpperCase().includes('SERIAL')) {
                      return (
                        <td key={col.name} className="px-1 py-1 border-l border-emerald-100 text-slate-300 italic">
                          auto
                        </td>
                      );
                    }
                    return (
                      <td key={col.name} className="px-1 py-1 border-l border-emerald-100">
                        {isJsonColumn(col.type) ? (
                          <textarea
                            value={newRow[col.name] || ''}
                            onChange={(e) => onNewRowChange(col.name, e.target.value)}
                            className="w-full min-w-[120px] px-2 py-1.5 text-xs border border-emerald-200 rounded-lg
                                       bg-white/80 font-mono resize-y focus:border-emerald-400 outline-none"
                            rows={2}
                            placeholder="JSON..."
                          />
                        ) : isBoolColumn(col.type) ? (
                          <select
                            value={newRow[col.name] || ''}
                            onChange={(e) => onNewRowChange(col.name, e.target.value)}
                            className="px-2 py-1.5 text-xs border border-emerald-200 rounded-lg bg-white/80"
                          >
                            <option value="">—</option>
                            <option value="true">true</option>
                            <option value="false">false</option>
                          </select>
                        ) : (
                          <input
                            type={isNumericColumn(col.type) ? 'number' : 'text'}
                            value={newRow[col.name] || ''}
                            onChange={(e) => onNewRowChange(col.name, e.target.value)}
                            className="w-full min-w-[80px] px-2 py-1.5 text-xs border border-emerald-200 rounded-lg
                                       bg-white/80 focus:border-emerald-400 outline-none"
                            placeholder={col.name}
                            step={isNumericColumn(col.type) ? 'any' : undefined}
                          />
                        )}
                      </td>
                    );
                  })}
                  <td className="px-2 py-2 border-l border-emerald-100 text-center">
                    <div className="flex gap-1 justify-center">
                      <Button variant="success" size="sm" onClick={saveNewRow}>保存</Button>
                      <Button variant="ghost" size="sm" onClick={() => setNewRow(null)}>取消</Button>
                    </div>
                  </td>
                </tr>
              )}

              {/* データ行 */}
              {rows.map((row, idx) => {
                const rowPk = row[pk];
                const rowDirty = !!edits[rowPk];
                return (
                  <tr
                    key={rowPk ?? idx}
                    className={`border-b border-slate-100 hover:bg-indigo-50/30 transition-colors
                      ${rowDirty ? 'bg-amber-50/40' : idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}
                  >
                    <td className={`px-2 py-2 font-mono text-slate-400 sticky left-0 z-10
                      ${rowDirty ? 'bg-amber-50/40' : idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                      {page * PAGE_SIZE + idx + 1}
                    </td>
                    {displayCols.map((col) => {
                      const isEditing = editingCell?.rowPk === rowPk && editingCell?.col === col.name;
                      const cellVal = getCellValue(row, col.name);
                      const dirty = isCellDirty(row, col.name);
                      const isPkCol = col.name === pk;

                      // PKカラムは読み取り専用
                      if (isPkCol) {
                        return (
                          <td key={col.name} className="px-3 py-2 border-l border-slate-100 font-mono text-indigo-600 font-bold">
                            {formatCellValue(cellVal)}
                          </td>
                        );
                      }

                      return (
                        <td
                          key={col.name}
                          className={`px-1 py-1 border-l border-slate-100 cursor-pointer
                            ${dirty ? 'bg-amber-100/60 ring-1 ring-amber-300/50' : ''}
                            ${isEditing ? 'p-0' : ''}`}
                          onClick={() => !isEditing && startEdit(rowPk, col.name)}
                          title={formatCellValue(cellVal)}
                        >
                          {isEditing ? (
                            isJsonColumn(col.type) ? (
                              <textarea
                                ref={editRef}
                                value={formatCellValue(cellVal)}
                                onChange={(e) => onCellChange(rowPk, col.name, e.target.value)}
                                onBlur={finishEdit}
                                onKeyDown={(e) => {
                                  if (e.key === 'Escape') finishEdit();
                                }}
                                className="w-full min-w-[200px] px-2 py-1.5 text-xs border-2 border-indigo-400
                                           rounded-lg bg-white font-mono resize-y outline-none shadow-inner"
                                rows={4}
                              />
                            ) : isBoolColumn(col.type) ? (
                              <select
                                ref={editRef}
                                value={String(cellVal ?? '')}
                                onChange={(e) => { onCellChange(rowPk, col.name, e.target.value); finishEdit(); }}
                                onBlur={finishEdit}
                                className="px-2 py-1.5 text-xs border-2 border-indigo-400 rounded-lg bg-white"
                              >
                                <option value="">—</option>
                                <option value="true">true</option>
                                <option value="false">false</option>
                              </select>
                            ) : (
                              <input
                                ref={editRef}
                                type={isNumericColumn(col.type) ? 'number' : 'text'}
                                value={cellVal ?? ''}
                                onChange={(e) => onCellChange(rowPk, col.name, e.target.value)}
                                onBlur={finishEdit}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') finishEdit();
                                  if (e.key === 'Escape') { setEditingCell(null); }
                                }}
                                step={isNumericColumn(col.type) ? 'any' : undefined}
                                className="w-full min-w-[80px] px-2 py-1.5 text-xs border-2 border-indigo-400
                                           rounded-lg bg-white outline-none shadow-inner"
                              />
                            )
                          ) : (
                            <span className={`block px-2 py-1 text-slate-600 max-w-[300px] truncate ${
                              typeof cellVal === 'object' && cellVal !== null ? 'font-mono text-[10px] text-violet-600' : ''
                            }`}>
                              {cellVal === null || cellVal === undefined
                                ? <span className="text-slate-300 italic">null</span>
                                : truncateDisplay(cellVal)}
                            </span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-2 py-2 border-l border-slate-100 text-center">
                      <button
                        onClick={() => setDeleteConfirm(rowPk)}
                        className="text-slate-300 hover:text-rose-500 transition-colors p-1"
                        title="削除"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                );
              })}

              {rows.length === 0 && !loading && (
                <tr>
                  <td colSpan={displayCols.length + 2} className="text-center py-12 text-slate-400">
                    データがありません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-8 text-slate-400">
            <Icons.Info className="w-5 h-5 animate-pulse mr-2" /> 読み込み中...
          </div>
        )}
      </div>

      {/* スキーマ情報 */}
      {schema.length > 0 && (
        <SectionCard title="スキーマ情報" icon={<Icons.Info />}
          subtitle={`${selectedTable} テーブルの全カラム定義`}>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
            {schema.map((col) => (
              <div key={col.name} className="p-2 bg-slate-50/60 rounded-lg border border-slate-100 text-xs">
                <div className="font-bold text-slate-700 flex items-center gap-1">
                  {col.name}
                  {col.pk && <span className="text-[9px] bg-indigo-100 text-indigo-600 px-1 rounded">PK</span>}
                </div>
                <div className="text-slate-400 mt-0.5">{col.type}</div>
                {col.notnull && <div className="text-amber-500 text-[10px]">NOT NULL</div>}
                {col.default && <div className="text-slate-300 text-[10px] truncate" title={col.default}>default: {col.default}</div>}
              </div>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
}
