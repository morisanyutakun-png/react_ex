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
  const { timeout = 60000, retries = 2, noRetry = false, ...fetchOpts } = options;

  // 副作用のある生成系エンドポイントはリトライしない（二重課金防止）
  const effectiveRetries = noRetry ? 0 : retries;

  let lastError = null;

  for (let attempt = 0; attempt <= effectiveRetries; attempt++) {
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
        if (noRetry) break;
        continue; // retry on timeout
      }
      lastError = new Error(`バックエンドに接続できません: ${err.message}`);
      if (noRetry) break;
      continue; // retry on connection error
    }
    clearTimeout(timer);

    // 500/502/504 はサーバー復帰待ちの可能性が高いのでリトライ
    if ((res.status === 500 || res.status === 502 || res.status === 504) && attempt < effectiveRetries) {
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

export async function deleteTemplate(templateId) {
  return apiFetch(`/api/template/${encodeURIComponent(templateId)}`, {
    method: 'DELETE',
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
 * 過去の高評価チューニングログを取得（フィードバックループ用）
 * subject, template_id, min_score, limit で絞り込み可能
 */
export async function fetchTuningFeedback({ subject, templateId, minScore = 4.0, limit = 5 } = {}) {
  const params = new URLSearchParams();
  if (subject) params.set('subject', subject);
  if (templateId) params.set('template_id', templateId);
  if (minScore != null) params.set('min_score', String(minScore));
  if (limit != null) params.set('limit', String(limit));
  return apiFetch(`/api/tuning/feedback?${params.toString()}`);
}

/**
 * 評価履歴を包括的に取得（分析データ付き）
 * subject, limit, offset で絞り込み可能
 */
export async function fetchEvaluationHistory({ subject, limit = 50, offset = 0 } = {}) {
  const params = new URLSearchParams();
  if (subject) params.set('subject', subject);
  if (limit != null) params.set('limit', String(limit));
  if (offset != null) params.set('offset', String(offset));
  return apiFetch(`/api/tuning/evaluation_history?${params.toString()}`);
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

export async function fetchSmartFields(table) {
  return apiFetch(`/api/db/smart-fields/${table}`);
}

export async function estimateDifficulty(stem, answer = '') {
  return apiFetch('/api/db/estimate-difficulty', {
    method: 'POST',
    body: JSON.stringify({ stem, answer }),
  });
}

export async function smartCreateDbRow(table, data, autoDifficulty = true) {
  return apiFetch(`/api/db/${table}/smart-create`, {
    method: 'POST',
    body: JSON.stringify({ data, auto_difficulty: autoDifficulty }),
  });
}

// ── OpenAI GPT LLM → PDF ワンクリック生成 ──────────────

export async function generateWithLlm(params) {
  return apiFetch('/api/generate_with_llm', {
    method: 'POST',
    body: JSON.stringify(params),
    timeout: 250000, // LLM (最大180秒) + PDF compilation (最大30秒) + マージン
    noRetry: true,   // 二重課金防止: 502/504 でもリトライしない
  });
}

// ── ベース問題 PDF バリデーション ─────────────────────────

export async function validateBasePdf(file) {
  const formData = new FormData();
  formData.append('file', file);
  const url = `${BASE}/api/validate_base_pdf`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data?.detail || `HTTP ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') throw new Error('タイムアウトしました');
    throw err;
  }
}

// ── パターン別問題取得 ─────────────────────────────────────

export async function fetchProblemsByPattern(templateId, limit = 20) {
  const params = new URLSearchParams();
  if (templateId) params.set('template_id', templateId);
  if (limit) params.set('limit', String(limit));
  return apiFetch(`/api/problems_by_pattern?${params.toString()}`);
}

// ── AI 使用回数制限 ──────────────────────────────────────

export async function fetchUsage(userId) {
  return apiFetch(`/api/usage/${encodeURIComponent(userId)}`);
}

export async function adminUnlock(userId, password) {
  return apiFetch('/api/admin/unlock', {
    method: 'POST',
    body: JSON.stringify({ user_id: userId, password }),
  });
}

export async function verifyGenerationCode(code) {
  return apiFetch('/api/verify_code', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
}

/**
 * アカウントパスワードで本人確認する（JWT + パスワード二重認証）。
 * AI自動生成モードの実行前に呼ばれる。
 */
export async function verifyAccountPassword(password, accessToken) {
  return apiFetch('/api/auth/verify_password', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ password }),
  });
}

// ── Authentication ────────────────────────────────────────────────────────

export async function authRegister({ email, password, orgName, displayName }) {
  return apiFetch('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, org_name: orgName || '', display_name: displayName || '' }),
  });
}

export async function authLogin({ email, password }) {
  return apiFetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function authRefresh(refreshToken) {
  return apiFetch('/api/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
}

export async function authMe(accessToken) {
  return apiFetch('/api/auth/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

// ── LaTeX Diagram Packages ─────────────────────────────────────────────────

/** 選択可能な図表パッケージの定義（フロントエンド表示用） */
export const DIAGRAM_PACKAGE_DEFS = [
  /* ═══════ 図描画（ベース） ═══════ */
  {
    id: 'tikz',
    name: '図形・図解',
    label: '万能タイプ',
    icon: '✏️',
    category: 'diagram',
    description: '矢印・力の図示・幾何図形・フローチャートなど、あらゆる図を描画できます',
    hint: '迷ったらこれを選べばOK',
    recommended: true,
  },
  {
    id: 'pgfplots',
    name: 'グラフ・チャート',
    label: 'グラフ',
    icon: '📈',
    category: 'diagram',
    description: '関数のグラフ・散布図・棒グラフなどを描画します',
    hint: '関数やデータの視覚化に',
  },
  {
    id: 'tikz-cd',
    name: '数学図式',
    label: '関係図',
    icon: '↗',
    category: 'diagram',
    description: '数学の写像や関係を示す図式を描画します',
    hint: '大学数学の図に',
  },
  {
    id: 'forest',
    name: '樹形図・ツリー',
    label: '樹形図',
    icon: '🌲',
    category: 'diagram',
    description: '確率の樹形図・場合分けの図・階層図を描画します',
    hint: '確率や場合の数の問題に',
  },
  {
    id: 'tikz-3dplot',
    name: '3D 図形',
    label: '3D描画',
    icon: '🧊',
    category: 'diagram',
    description: '3次元の立体図や空間ベクトルの図を描画します',
    hint: '空間図形・ベクトルに',
  },
  {
    id: 'smartdiagram',
    name: 'スマート図解',
    label: 'フロー図',
    icon: '🔄',
    category: 'diagram',
    description: 'フロー図・サイクル図・リスト図を簡単に生成します',
    hint: '工程や手順のまとめに',
  },

  /* ═══════ 分子生物学 ═══════ */
  {
    id: 'pgfmolbio',
    name: 'DNA／タンパク質配列',
    label: 'DNA配列',
    icon: '🧬',
    category: 'molbio',
    description: 'DNA・RNA・タンパク質配列の図解やクロマトグラムを描画します',
    hint: '分子生物学・遺伝学に',
    recommended: true,
  },
  {
    id: 'texshade',
    name: '配列アラインメント',
    label: 'アラインメント',
    icon: '📐',
    category: 'molbio',
    description: 'マルチプルシーケンスアラインメントを色分けして表示します',
    hint: 'タンパク質・遺伝子比較に',
  },
  {
    id: 'genealogytree',
    name: '家系図',
    label: '家系図',
    icon: '👨‍👩‍👧‍👦',
    category: 'molbio',
    description: '遺伝の家系図や系統図を描画します',
    hint: '遺伝学の問題に',
  },

  /* ═══════ 化学・生化学 ═══════ */
  {
    id: 'chemfig',
    name: '構造式',
    label: '構造式',
    icon: '⚗️',
    category: 'chem',
    description: '有機化合物の構造式や反応機構を描画します',
    hint: '有機化学の問題に',
    recommended: true,
  },
  {
    id: 'mhchem',
    name: '化学式・反応式',
    label: '化学式',
    icon: '🧪',
    category: 'chem',
    description: '化学反応式・イオン式を美しく記述します',
    hint: '化学全般の問題に',
    recommended: true,
  },
  {
    id: 'chemformula',
    name: '化学式（拡張）',
    label: '化学式+',
    icon: '⚛️',
    category: 'chem',
    description: 'chemformulaパッケージで高度な化学式を記述します',
    hint: 'mhchemの代替・拡張',
  },
  {
    id: 'chemmacros',
    name: '化学マクロ集',
    label: '化学マクロ',
    icon: '🔬',
    category: 'chem',
    description: 'IUPAC命名法・酸化数・電子配置など化学全般のマクロ集',
    hint: '大学化学の問題に',
  },
  {
    id: 'modiagram',
    name: '分子軌道図',
    label: '軌道図',
    icon: '🌀',
    category: 'chem',
    description: '分子軌道ダイアグラム（MO図）を描画します',
    hint: '物理化学の軌道論に',
  },

  /* ═══════ 生体・医学図 ═══════ */
  {
    id: 'tikz-network',
    name: '生体ネットワーク',
    label: 'ネットワーク',
    icon: '🕸️',
    category: 'medical',
    description: '生体ネットワーク・代謝経路・相互作用ネットワークを描画します',
    hint: 'シグナル伝達や代謝経路に',
  },
  {
    id: 'circuitikz',
    name: '電気回路図',
    label: '回路図',
    icon: '⚡',
    category: 'medical',
    description: '回路図を描画。医療機器回路・ME機器の図にも便利',
    hint: '物理の電気回路・医療機器に',
  },
  {
    id: 'algorithm2e',
    name: 'アルゴリズム図',
    label: 'アルゴリズム',
    icon: '📋',
    category: 'medical',
    description: '医療フローチャート・診断アルゴリズムを擬似コード形式で記述します',
    hint: '臨床判断アルゴリズムに',
  },

  /* ═══════ 統計・論文用 ═══════ */
  {
    id: 'siunitx',
    name: '単位・数値',
    label: '単位表記',
    icon: '📏',
    category: 'stats',
    description: 'SI単位系をルール通りに記述。μg/mL・mol/Lなどの表記に最適',
    hint: '科学系全般の問題に',
    recommended: true,
  },
  {
    id: 'booktabs',
    name: '美しい表',
    label: '論文用表',
    icon: '📊',
    category: 'stats',
    description: 'プロフェッショナルな表を作成。学術論文品質の罫線ルール',
    hint: 'データ表・実験結果に',
  },
  {
    id: 'datatool',
    name: 'データ処理',
    label: 'CSVデータ',
    icon: '📂',
    category: 'stats',
    description: 'CSV/データベースからの表・グラフの自動生成',
    hint: '大量データの表に',
  },

  /* ═══════ 図配置・コード表示 ═══════ */
  {
    id: 'subcaption',
    name: '複数図並列',
    label: '図並列',
    icon: '🖼️',
    category: 'layout',
    description: '複数の図を横に並べて配置し、個別にキャプションを付けます',
    hint: '比較図や複数結果の表示に',
  },
  {
    id: 'wrapfig',
    name: '文章回り込み図',
    label: '回り込み',
    icon: '📰',
    category: 'layout',
    description: '図を本文に回り込みで配置します',
    hint: '教科書風レイアウトに',
  },
  {
    id: 'listings',
    name: 'プログラムコード',
    label: 'コード表示',
    icon: '💻',
    category: 'layout',
    description: 'プログラムのソースコードを見やすく色付きで表示します',
    hint: 'プログラミング・情報の問題に',
  },
  {
    id: 'tabularx',
    name: '表・データ表',
    label: '表組み',
    icon: '📋',
    category: 'layout',
    description: 'きれいに整った表やデータ一覧を挿入します',
    hint: '表やデータを使う問題に',
  },
];

/* ── カテゴリ定義 ── */
export const PACKAGE_CATEGORIES = [
  { id: 'diagram', name: '図描画（ベース）', icon: '✏️', description: 'TikZ・グラフ・樹形図' },
  { id: 'molbio', name: '分子生物学', icon: '🧬', description: 'DNA配列・系統図・家系図' },
  { id: 'chem', name: '化学・生化学', icon: '⚗️', description: '構造式・化学反応式・軌道図' },
  { id: 'medical', name: '生体・医学図', icon: '🏥', description: 'ネットワーク・回路・アルゴリズム' },
  { id: 'stats', name: '統計・論文用', icon: '📏', description: '単位・美しい表・データ' },
  { id: 'layout', name: '図配置・コード', icon: '🖼️', description: '図の並列・コード・表' },
];

/* ═══════ プリセットバンドル（ワンクリックで複数パッケージを一括選択） ═══════ */
export const PACKAGE_PRESETS = [
  {
    id: 'math_physics',
    name: '数学・物理',
    icon: '📐',
    subtitle: '図形・グラフ・回路・3D',
    description: '力学・電磁気・関数グラフ・空間図形など理数系の図を網羅',
    packages: ['tikz', 'pgfplots', 'circuitikz', 'tikz-3dplot', 'forest'],
    color: '#3b82f6',
    gradient: 'from-blue-500/10 to-indigo-500/10',
    borderActive: 'border-blue-500/40',
    illustration: `  F↑  ──→v
  │╲  ○
  │  ╲   📈 y=f(x)
  ◇──→ ⚡回路`,
  },
  {
    id: 'biology',
    name: '生物・遺伝',
    icon: '🧬',
    subtitle: 'DNA・家系図・代謝経路',
    description: '分子生物学・遺伝学・生態系ネットワークのリアルな図解',
    packages: ['tikz', 'pgfmolbio', 'texshade', 'genealogytree', 'tikz-network'],
    color: '#10b981',
    gradient: 'from-emerald-500/10 to-teal-500/10',
    borderActive: 'border-emerald-500/40',
    illustration: `  🧬 ATGCGA...
  ♂──♀ 家系図
  A──B──C 経路`,
  },
  {
    id: 'chemistry',
    name: '化学',
    icon: '⚗️',
    subtitle: '構造式・反応式・軌道図',
    description: '有機化学・無機化学・物理化学の構造式や反応を美しく描画',
    packages: ['tikz', 'chemfig', 'mhchem', 'chemmacros', 'modiagram', 'chemformula'],
    color: '#f59e0b',
    gradient: 'from-amber-500/10 to-orange-500/10',
    borderActive: 'border-amber-500/40',
    illustration: `  H─C═C─H 構造式
  2H₂+O₂→2H₂O
  σ ── π 軌道`,
  },
  {
    id: 'document',
    name: '論文・レポート',
    icon: '📊',
    subtitle: '表・単位・コード・図配置',
    description: '学術論文品質の表・SI単位・ソースコード・図の並列配置',
    packages: ['siunitx', 'booktabs', 'tabularx', 'subcaption', 'listings', 'wrapfig'],
    color: '#8b5cf6',
    gradient: 'from-violet-500/10 to-purple-500/10',
    borderActive: 'border-violet-500/40',
    illustration: `  ┌──┬──┐ 表
  │  │  │ 📏SI
  └──┴──┘ 💻code`,
  },
];


