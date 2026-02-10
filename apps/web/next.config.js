/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    const base = (process.env.API_BASE_URL || 'http://localhost:8000').replace(/\/$/, '');
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
