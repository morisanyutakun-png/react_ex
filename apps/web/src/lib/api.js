/**
 * FastAPI バックエンドへの API 呼び出しヘルパー
 * Next.js Route Handler で /api/* → バックエンドにプロキシされる
 *
 * 重要: ブラウザからは常に same-origin (自サイト) の /api/* を呼ぶ。
 * Route Handler がサーバーサイドでバックエンドへプロキシするので、
 * CORS 問題は発生しない。
 */

// Always use same-origin proxy — never call the backend directly from the browser.
const BASE = '';

/**
 * Generic fetch wrapper with JSON handling and automatic retry for 502/504.
 *
 * Render 無料枠はコールドスタートに ~30秒かかるため、502/504 が返った場合は
 * 自動的にリトライする。最大 2 回リトライ（合計 3 回試行）。
 */
export async function apiFetch(path, options = {}) {
  const url = `${BASE}${path}`;
  const { timeout = 60000, retries = 2, ...fetchOpts } = options;

  let lastError = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    // リトライ時は少し待つ（コールドスタート復帰を待つ）
    if (attempt > 0) {
      await new Promise(r => setTimeout(r, 3000 * attempt));
    }

    const controller = new AbortController();
    const timer = timeout > 0 ? setTimeout(() => controller.abort(), timeout) : null;
    let res;
    try {
      res = await fetch(url, {
        headers: { 'Content-Type': 'application/json', ...fetchOpts.headers },
        signal: controller.signal,
        ...fetchOpts,
      });
    } catch (err) {
      clearTimeout(timer);
      if (err.name === 'AbortError') {
        lastError = new Error(`リクエストがタイムアウトしました (${timeout / 1000}秒)`);
        continue; // retry on timeout
      }
      lastError = new Error(`バックエンドに接続できません: ${err.message}`);
      continue; // retry on connection error
    }
    clearTimeout(timer);

    // 502/504 はサーバー復帰待ちの可能性が高いのでリトライ
    if ((res.status === 502 || res.status === 504) && attempt < retries) {
      lastError = new Error(`HTTP ${res.status}: バックエンドが一時的に利用できません（リトライ中...）`);
      continue;
    }

    // Content-Type を確認して JSON 以外のレスポンスも処理できるようにする
    const contentType = res.headers.get('content-type') || '';

    let data;
    if (contentType.includes('application/json')) {
      try {
        const text = await res.text();
        data = text ? JSON.parse(text) : null;
      } catch (parseErr) {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: レスポンスの解析に失敗しました`);
        }
        data = null;
      }
    } else {
      // PDF 等の非 JSON レスポンス
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      return res;
    }

    if (!res.ok) {
      const msg = data?.detail || data?.error || res.statusText || `HTTP ${res.status}`;
      const err = new Error(msg);
      err.data = data; // preserve full response body for structured error handling
      throw err;
    }

    if (data === null || data === undefined) {
      throw new Error('サーバーから空のレスポンスが返りました');
    }

    return data;
  }

  // All retries exhausted
  throw lastError || new Error('バックエンドに接続できません');
}

// ── Templates ──────────────────────────────────────

export async function fetchTemplates() {
  const data = await apiFetch('/api/templates');
  return data.templates || [];
}

export async function createTemplate(body) {
  return apiFetch('/api/template', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

// ── Template Rendering ─────────────────────────────

export async function renderTemplate(params) {
  return apiFetch('/api/template_render', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

// ── RAG / Assemble Prompt ──────────────────────────

export async function assemblePrompt(params) {
  return apiFetch('/api/assemble_prompt', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

// ── Upload / Ingest ────────────────────────────────

export async function uploadJson(body) {
  return apiFetch('/api/upload_json', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

// ── Tuning ─────────────────────────────────────────

export async function saveTuningLog(body) {
  return apiFetch('/api/tuning/log', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/**
 * Parse された問題データを problems テーブルに保存
 * parsed_output には最低限 stem フィールドが必要。
 * final_answer, checks (2件以上) も含めるとバリデーション通過。
 */
export async function saveProblem(parsedOutput, extraMetadata = {}) {
  return apiFetch('/api/tuning/save_problem', {
    method: 'POST',
    body: JSON.stringify({
      parsed_output: parsedOutput,
      extra_metadata: extraMetadata,
    }),
  });
}

// ── Doc Entries ────────────────────────────────────

export async function fetchDocEntries(docId) {
  return apiFetch(`/api/doc/${docId}/entries`);
}

// ── LaTeX Presets ──────────────────────────────────

export async function fetchLatexPresets() {
  const data = await apiFetch('/api/latex_presets');
  return data.presets || [];
}

// ── PDF ────────────────────────────────────────────

export async function generatePdf(latex) {
  return apiFetch('/api/generate_pdf', {
    method: 'POST',
    body: JSON.stringify({ latex, title: 'Generated', return_url: true }),
    timeout: 90000,
  });
}

// ── Search ─────────────────────────────────────────

export async function searchProblems(params) {
  const query = new URLSearchParams(params).toString();
  return apiFetch(`/api/search?${query}`);
}

// ── Similar Problem Generation ─────────────────────

export async function generateSimilarProblem(problemStem, options = {}) {
  return apiFetch('/api/generate_similar', {
    method: 'POST',
    body: JSON.stringify({
      question: problemStem,
      top_k: options.top_k || 5,
      num: options.num || 3,
      use_vector: options.use_vector ?? true,
      include_explanations: options.include_explanations ?? true,
      ...options,
    }),
  });
}

// ── DB Editor ─────────────────────────────────────

export async function fetchDbTables() {
  return apiFetch('/api/db/tables');
}

export async function fetchDbSchema(table) {
  return apiFetch(`/api/db/${table}/schema`);
}

export async function fetchDbRows(table, params = {}) {
  const query = new URLSearchParams(params).toString();
  return apiFetch(`/api/db/${table}/rows${query ? '?' + query : ''}`);
}

export async function updateDbRow(table, id, data) {
  return apiFetch(`/api/db/${table}/rows/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ data }),
  });
}

export async function createDbRow(table, data) {
  return apiFetch(`/api/db/${table}/rows`, {
    method: 'POST',
    body: JSON.stringify({ data }),
  });
}

export async function deleteDbRow(table, id) {
  return apiFetch(`/api/db/${table}/rows/${id}`, {
    method: 'DELETE',
  });
}

// ── Groq Cloud LLM → PDF ワンクリック生成 ──────────────

export async function generateWithLlm(params) {
  return apiFetch('/api/generate_with_llm', {
    method: 'POST',
    body: JSON.stringify(params),
    timeout: 180000, // LLM + PDF compilation can take time
  });
}

// ── LaTeX Diagram Packages ─────────────────────────────────────────────────

/** 選択可能な図表パッケージの定義（フロントエンド表示用） */
export const DIAGRAM_PACKAGE_DEFS = [
  {
    id: 'tikz',
    name: 'TikZ',
    label: '図形・図解',
    icon: '◻',
    description: '矢印図・幾何図形・フローチャートなど汎用的な図を描画',
  },
  {
    id: 'circuitikz',
    name: 'CircuiTikZ',
    label: '回路図',
    icon: '⚡',
    description: '電気回路図（抵抗・コンデンサ・電源など）を描画',
  },
  {
    id: 'pgfplots',
    name: 'PGFPlots',
    label: 'グラフ',
    icon: '📈',
    description: '関数グラフ・散布図・棒グラフなどを描画',
  },
  {
    id: 'tikz-cd',
    name: 'TikZ-CD',
    label: '可換図式',
    icon: '↗',
    description: '数学の可換図式・射影ダイアグラムを描画',
  },
  {
    id: 'forest',
    name: 'Forest',
    label: '樹形図',
    icon: '🌲',
    description: '確率の樹形図・構文木・階層図を描画',
  },
  {
    id: 'listings',
    name: 'Listings',
    label: 'コード',
    icon: '{ }',
    description: 'Python・Java・C等のソースコードをシンタックスハイライト付きで表示',
  },
  {
    id: 'tabularx',
    name: 'Tabularx',
    label: '拡張表',
    icon: '⊞',
    description: '幅を自動調整した表（booktabs罫線スタイル付き）',
  },
];


