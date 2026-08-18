import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const apiProxy =
  process.env.EST_MAP_API_PROXY || 'http://127.0.0.1:8765'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: apiProxy,
        changeOrigin: true,
      },
    },
  },
})