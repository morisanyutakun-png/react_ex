/**
 * Catch-all API proxy Route Handler.
 *
 * すべての /api/* リクエストを FastAPI バックエンドへ転送する。
 * vercel.json の rewrites は Next.js プロジェクトでは無視されるため、
 * Route Handler でサーバーサイドプロキシを行う。
 *
 * ブラウザ → /api/generate_pdf (same-origin, CORS 不要)
 *   → この Route Handler がサーバーで受け取る
 *   → https://examgen-backend.onrender.com/api/generate_pdf へ転送
 *   → レスポンスをそのまま返す
 */

const BACKEND_URL = (() => {
  // 1. 明示的な環境変数があればそれを使う
  const explicit = process.env.API_BASE_URL;
  if (explicit) return explicit.replace(/\/+$/, '');
  // 2. Vercel 上なら Render バックエンドを使う
  if (process.env.VERCEL) return 'https://examgen-backend.onrender.com';
  // 3. ローカル開発なら localhost
  return 'http://localhost:8000';
})();

async function handler(request, context) {
  const { path } = await context.params;
  const backendPath = `/api/${path.join('/')}`;

  // クエリパラメータを保持
  const { searchParams } = new URL(request.url);
  const qs = searchParams.toString();
  const url = `${BACKEND_URL}${backendPath}${qs ? '?' + qs : ''}`;

  // リクエストヘッダーを転送（hop-by-hop ヘッダーは除外）
  const headers = new Headers();
  const skipHeaders = new Set(['host', 'connection', 'transfer-encoding', 'content-length']);
  for (const [key, value] of request.headers.entries()) {
    if (!skipHeaders.has(key.toLowerCase())) {
      headers.set(key, value);
    }
  }

  const fetchInit = {
    method: request.method,
    headers,
  };

  // GET/HEAD 以外はボディを転送
  if (!['GET', 'HEAD'].includes(request.method)) {
    fetchInit.body = await request.text();
  }

  try {
    const upstream = await fetch(url, fetchInit);

    // レスポンスヘッダーを転送
    const resHeaders = new Headers();
    const skipResHeaders = new Set(['transfer-encoding', 'connection', 'content-encoding', 'content-length']);
    for (const [key, value] of upstream.headers.entries()) {
      if (!skipResHeaders.has(key.toLowerCase())) {
        resHeaders.set(key, value);
      }
    }

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: resHeaders,
    });
  } catch (err) {
    console.error(`[API Proxy] ${request.method} ${url} failed:`, err.message);
    return new Response(
      JSON.stringify({
        error: 'backend_unavailable',
        detail: `バックエンドに接続できません (${BACKEND_URL}): ${err.message}`,
      }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const DELETE = handler;
export const PATCH = handler;
export const OPTIONS = handler;

// PDF 生成などの長時間処理用（Vercel Hobby: max 60s, Pro: max 300s）
export const maxDuration = 60;
