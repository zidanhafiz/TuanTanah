import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// In dev, proxy API + websocket traffic to the backend on :3000.
export default defineConfig(({ mode }) => {
  // Absolute origin for social-share (og:/twitter:) tags, e.g.
  // https://tuantanah.com. Leave VITE_PUBLIC_URL blank to emit root-relative
  // URLs (most crawlers resolve those against the page, but Facebook's debugger
  // prefers absolute — set it for prod).
  const env = loadEnv(mode, process.cwd(), '')
  const publicUrl = (env.VITE_PUBLIC_URL ?? '').replace(/\/$/, '')

  return {
    plugins: [
      react(),
      {
        name: 'inject-public-url',
        transformIndexHtml: (html) => html.replaceAll('%PUBLIC_URL%', publicUrl),
      },
    ],
    server: {
      port: 5173,
      proxy: {
        '/api': { target: 'http://localhost:3000', changeOrigin: true },
        '/socket.io': { target: 'http://localhost:3000', ws: true, changeOrigin: true },
      },
    },
  }
})
