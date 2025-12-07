import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Проксируем запросы к LLM API через Vite dev server для обхода CORS
      '/api/llm': {
        target: 'https://ai.megallm.io',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/llm/, '/v1'),
        secure: true,
      }
    }
  }
})
