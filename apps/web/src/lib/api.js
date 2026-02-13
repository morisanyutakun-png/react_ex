/**
 * FastAPI バックエンドへの API 呼び出しヘルパー
 * Next.js の rewrites で /api/* → localhost:8000 にプロキシされる
 */

const BASE = process.env.NEXT_PUBLIC_API_BASE || '';  // same-origin (proxy via next.config.js rewrites)

/**
 * Generic fetch wrapper with JSON handling
 */
export async function apiFetch(path, options = {}) {
  const url = `${BASE}${path}`;
  const { timeout = 60000, ...fetchOpts } = options;
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
      throw new Error(`リクエストがタイムアウトしました (${timeout / 1000}秒)`);
    }
    throw new Error(`バックエンドに接続できません: ${err.message}`);
  }
  clearTimeout(timer);

  let data;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    const msg = data?.detail || data?.error || res.statusText;
    throw new Error(msg);
  }

  return data;
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


