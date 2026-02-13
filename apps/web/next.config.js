/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    // On Vercel, proxy to the Render backend.
    // Locally, proxy to the local backend on port 8000.
    const defaultBase = process.env.VERCEL
      ? 'https://examgen-backend.onrender.com'
      : 'http://localhost:8000';
    const base = (process.env.API_BASE_URL || defaultBase).replace(/\/$/, '');
    const normalized = base.endsWith('/api') ? base.slice(0, -4) : base;
    return [
      {
        source: '/api/:path*',
        destination: `${normalized}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
