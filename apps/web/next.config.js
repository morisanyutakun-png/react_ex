/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // API プロキシは src/app/api/[...path]/route.js で処理。
  // ローカル開発のフォールバックとして rewrites も残しておく。
  async rewrites() {
    // Route Handler がすべての /api/* を処理するので
    // ここの rewrites は Route Handler が存在しない場合のフォールバック。
    if (process.env.VERCEL) return [];  // Vercel では Route Handler に任せる
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:8000/api/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
