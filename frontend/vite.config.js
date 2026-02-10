import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 開発時の /api をバックエンド (http://localhost:8000) にプロキシします。
// これによりフロントは相対パス (/api/...) のまま fetch でき、CORS を気にせず開発できます。
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
