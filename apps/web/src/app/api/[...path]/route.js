/**
 * Catch-all API proxy Route Handler.
 *
 * すべての /api/* リクエストを FastAPI バックエンドへ転送する。
 *
 * ブラウザ → /api/generate_pdf (same-origin, CORS 不要)
 *   → この Route Handler がサーバーで受け取る
 *   → Koyeb バックエンドへ転送
 *   → レスポンスをそのまま返す
 *
 * 環境変数 API_BASE_URL を設定すれば任意のバックエンドを指定可能。
 * Vercel 上では Koyeb バックエンドがデフォルト。
 */

const BACKEND_URL = (() => {
  const explicit = process.env.API_BASE_URL;
  if (explicit) return explicit.replace(/\/+$/, '');
  if (process.env.VERCEL) return 'https://zeroth-aubree-yutamori-95ef4ba2.koyeb.app';
  return 'http://localhost:8000';
})();

async function handler(request, context) {
  const { path } = await context.params;
  const backendPath = `/api/${path.join('/')}`;

  const { searchParams } = new URL(request.url);
  const qs = searchParams.toString();
  const url = `${BACKEND_URL}${backendPath}${qs ? '?' + qs : ''}`;

  // リクエストヘッダーを転送（hop-by-hop ヘッダーは除外）
  // accept-encoding も除外: バックエンドに gzip を要求しない（生の JSON/PDF を受け取る）
  const headers = new Headers();
  const skipHeaders = new Set(['host', 'connection', 'transfer-encoding', 'content-length', 'accept-encoding']);
  for (const [key, value] of request.headers.entries()) {
    if (!skipHeaders.has(key.toLowerCase())) {
      headers.set(key, value);
    }
  }

  // LLM 生成エンドポイントは OpenAI API (最大180秒) + PDF コンパイル (最大30秒) があるため
  // 長いタイムアウトが必要。それ以外は 55秒で十分。
  const isLongRunning = backendPath.includes('generate_with_llm') || backendPath.includes('generate_pdf');
  const timeoutMs = isLongRunning ? 240000 : 55000;  // 240s vs 55s

  const fetchInit = {
    method: request.method,
    headers,
    signal: AbortSignal.timeout(timeoutMs),
  };

  if (!['GET', 'HEAD'].includes(request.method)) {
    fetchInit.body = await request.text();
  }

  try {
    const upstream = await fetch(url, fetchInit);

    // レスポンスを一旦 arrayBuffer で読み取り、圧縮/エンコーディング問題を回避
    const body = await upstream.arrayBuffer();

    const resHeaders = new Headers();
    const skipResHeaders = new Set(['transfer-encoding', 'connection', 'content-encoding', 'content-length']);
    for (const [key, value] of upstream.headers.entries()) {
      if (!skipResHeaders.has(key.toLowerCase())) {
        resHeaders.set(key, value);
      }
    }
    // 正しい content-length をセット
    resHeaders.set('content-length', String(body.byteLength));

    return new Response(body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: resHeaders,
    });
  } catch (err) {
    console.error(`[API Proxy] ${request.method} ${url} failed:`, err.message);
    const isTimeout = err.name === 'TimeoutError' || err.name === 'AbortError';
    return new Response(
      JSON.stringify({
        error: isTimeout ? 'backend_timeout' : 'backend_unavailable',
        detail: isTimeout
          ? 'バックエンドの応答がタイムアウトしました。しばらく待ってからもう一度お試しください。'
          : `バックエンドに接続できません: ${err.message}`,
        backend_url: BACKEND_URL,
      }),
      {
        status: isTimeout ? 504 : 502,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const DELETE = handler;
export const PATCH = handler;
export const OPTIONS = handler;

// Vercel Pro: 最大300秒。Hobby: 最大60秒。
// LLM + PDF 生成に十分な時間を確保する。
export const maxDuration = 300;
