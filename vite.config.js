import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // FastAPI(localhost:8000)로 REST와 WebSocket을 함께 넘긴다
    //   /api/stocks/005930/chart   → http://localhost:8000/stocks/005930/chart
    //   /api/ws/stocks/005930      → ws://localhost:8000/ws/stocks/005930
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        ws: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
