import { defineConfig, loadEnv, type Plugin, type ViteDevServer, type PreviewServer } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { createVisualsHandler } from './server/visuals.mjs'

function lyricsProxy(apiUrl: string, apiKey: string): Plugin {
  const install = (server: ViteDevServer | PreviewServer) => {
    server.middlewares.use('/api/lyrics', async (request, response, next) => {
      const query = new URL(request.url || '/', 'http://localhost')
      if (!['/get', '/search'].includes(query.pathname)) return next()
      if (request.method !== 'GET') { response.statusCode = 405; response.end(); return }
      const upstream = new URL(`${apiUrl.replace(/\/$/, '')}${query.pathname}`)
      for (const key of ['artist_name', 'track_name', 'album_name', 'duration']) {
        upstream.searchParams.set(key, (query.searchParams.get(key) || '').slice(0, 500))
      }
      try {
        const result = await fetch(upstream, { headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {}, signal: AbortSignal.timeout(10000) })
        response.statusCode = result.status
        response.setHeader('Content-Type', 'application/json')
        response.end(await result.text())
      } catch {
        response.statusCode = 502
        response.end(JSON.stringify({ error: 'Lyrics provider unavailable' }))
      }
    })
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
  return {
    plugins: [react(), tailwindcss(), visualsServer(env.PEXELS_API_KEY, env.MUSICWALL_VISUALS_DIR || undefined), ...(serverProvider ? [lyricsProxy(env.LYRICS_API_URL, env.LYRICS_API_KEY || '')] : [])],
    ...(serverProvider ? { define: { 'import.meta.env.VITE_LYRICS_API_URL': JSON.stringify('/api/lyrics') } } : {}),
  }
})
