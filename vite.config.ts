import { defineConfig, loadEnv, type Plugin, type ViteDevServer, type PreviewServer } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { createVisualsHandler } from './server/visuals.mjs'
import { createLyricsHandler } from './server/lyrics.mjs'

function lyricsProxy(apiUrl: string, apiKey: string): Plugin {
  const install = (server: ViteDevServer | PreviewServer) => {
    server.middlewares.use('/api/lyrics', createLyricsHandler({ apiUrl, apiKey }))
  }
  return { name: 'lyrics-server-proxy', configureServer: install, configurePreviewServer: install }
}

function visualsServer(apiKey: string, directory?: string): Plugin {
  const install = (server: ViteDevServer | PreviewServer) => {
    server.middlewares.use('/api/visuals', createVisualsHandler({ apiKey, directory }))
  }
  return { name: 'musicwall-visual-library', configureServer: install, configurePreviewServer: install }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const serverProvider = Boolean(env.LYRICS_API_URL)
  const desktop = mode === 'desktop'
  return {
    plugins: [react(), tailwindcss(), visualsServer(env.PEXELS_API_KEY, env.MUSICWALL_VISUALS_DIR || undefined), ...(serverProvider ? [lyricsProxy(env.LYRICS_API_URL, env.LYRICS_API_KEY || '')] : [])],
    ...(desktop ? { build: { outDir: 'dist-desktop' } } : {}),
    define: {
      ...(serverProvider || desktop ? { 'import.meta.env.VITE_LYRICS_API_URL': JSON.stringify('/api/lyrics') } : {}),
      // Desktop must not inherit a developer's port-5173 callback from .env.local.
      ...(desktop ? { 'import.meta.env.VITE_SPOTIFY_REDIRECT_URI': JSON.stringify('http://127.0.0.1:4173/callback') } : {}),
    },
  }
})
