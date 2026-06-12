import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// In dev, proxy API + websocket traffic to the backend on :3000.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
      '/socket.io': { target: 'http://localhost:3000', ws: true, changeOrigin: true },
    },
  },
})
