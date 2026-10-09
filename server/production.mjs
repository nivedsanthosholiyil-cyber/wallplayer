import { createServer } from 'node:http'
import { createReadStream } from 'node:fs'
import { stat, readFile } from 'node:fs/promises'
import { resolve, sep, extname, isAbsolute } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseEnv } from 'node:util'
import { createVisualsHandler } from './visuals.mjs'
import { createLyricsHandler } from './lyrics.mjs'

export const projectRoot = fileURLToPath(new URL('../', import.meta.url))
const types = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.webm': 'video/webm', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4', '.aac': 'audio/aac', '.flac': 'audio/flac' }
export async function readEnvironment(files, inherited = process.env) {
  let env = {}
  for (const path of files) {
    try { env = { ...env, ...parseEnv(await readFile(path, 'utf8')) } }
    catch (error) { if (error.code !== 'ENOENT') throw error }
  }
  return { ...env, ...inherited }
}
export function contentSecurityPolicy(publicLyricsUrl) {
  let provider = ''
  if (publicLyricsUrl?.startsWith('https://')) provider = new URL(publicLyricsUrl).origin
  return [
    "default-src 'none'", "base-uri 'none'", "object-src 'none'", "frame-ancestors 'none'", "form-action 'none'",
    "script-src 'self' https://sdk.scdn.co", "style-src 'self' 'unsafe-inline'", "font-src 'self' data:",
    "img-src 'self' data: blob: https:", "media-src 'self' blob: https://*.scdn.co https://*.spotifycdn.com https://videos.pexels.com https://player.vimeo.com https://*.vimeocdn.com",
    `connect-src 'self' https://lrclib.net https://*.spotify.com https://*.scdn.co https://*.spotifycdn.com wss://*.spotify.com ${provider}`.trim(),
    "frame-src https://sdk.scdn.co https://open.spotify.com", "worker-src 'self' blob:",
  ].join('; ')
}
export async function startProductionServer({ root = resolve(projectRoot, 'dist'), port = 4173, env = {}, onCallback } = {}) {
  root = resolve(root)
  if (!(await stat(resolve(root, 'index.html'))).isFile()) throw new Error('Frontend build is missing. Run npm run build.')
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Invalid server port')
  if (env.MUSICWALL_VISUALS_DIR && !isAbsolute(env.MUSICWALL_VISUALS_DIR)) throw new Error('MUSICWALL_VISUALS_DIR must be an absolute path')
  const visuals = createVisualsHandler({ apiKey: env.PEXELS_API_KEY || '', directory: env.MUSICWALL_VISUALS_DIR || undefined })
  const lyrics = createLyricsHandler({ apiUrl: env.LYRICS_API_URL || undefined, apiKey: env.LYRICS_API_KEY || '' })
  const csp = contentSecurityPolicy(env.VITE_LYRICS_API_URL)
  const server = createServer(async (request, response) => {
    response.setHeader('Content-Security-Policy', csp)
    response.setHeader('X-Content-Type-Options', 'nosniff')
    response.setHeader('Referrer-Policy', 'no-referrer')
    response.setHeader('X-Frame-Options', 'DENY')
    try {
      const address = server.address()
      if (![ `127.0.0.1:${address.port}`, `localhost:${address.port}` ].includes(request.headers.host)) { response.writeHead(403); response.end('Invalid host'); return }
      const url = new URL(request.url || '/', `http://${request.headers.host}`), pathname = url.pathname
      if (pathname.startsWith('/api/')) {
        if (request.headers['sec-fetch-site'] === 'cross-site' || request.headers.origin && request.headers.origin !== `http://${request.headers.host}`) { response.writeHead(403); response.end(); return }
        if (pathname.startsWith('/api/visuals/')) { await visuals(request, response); return }
        if (pathname.startsWith('/api/lyrics/')) { await lyrics(request, response); return }
        response.writeHead(404); response.end('API route unavailable'); return
      }
      if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405, { Allow: 'GET, HEAD' }); response.end(); return }
      if (pathname === '/callback' && onCallback) {
        response.setHeader('Cache-Control', 'no-store')
        const accepted = request.method === 'GET' && onCallback(url.searchParams)
        response.writeHead(accepted ? 200 : 400, { 'Content-Type': 'text/html; charset=utf-8' })
        response.end(`<!doctype html><title>MusicWall</title><h1>MusicWall</h1><p>${accepted ? 'Return to MusicWall to finish connecting. You can close this tab.' : 'No matching MusicWall connection. Start Connect Spotify inside the app again.'}</p>`)
        return
      }
      const decoded = decodeURIComponent(pathname)
      if (decoded.includes('\\') || decoded.includes('\0') || decoded.split('/').includes('..') || decoded.includes(':')) { response.writeHead(403); response.end(); return }
      let path = resolve(root, `.${decoded}`)
      if (path !== root && !path.startsWith(root + sep)) { response.writeHead(403); response.end(); return }
      if (!extname(path)) path = resolve(root, 'index.html')
      const file = await stat(path)
      if (!file.isFile()) { response.writeHead(404); response.end(); return }
      response.setHeader('Content-Type', types[extname(path)] || 'application/octet-stream')
      response.setHeader('Cache-Control', 'no-cache')
      response.setHeader('Accept-Ranges', 'bytes')
      let start = 0, end = file.size - 1
      if (request.headers.range) {
        const match = /^bytes=(\d*)-(\d*)$/.exec(request.headers.range)
        if (match && (match[1] || match[2])) {
          start = match[1] ? Number(match[1]) : Math.max(0, file.size - Number(match[2]))
          end = match[1] && match[2] ? Math.min(Number(match[2]), end) : end
        }
        if (!match || (!match[1] && !match[2]) || start > end || start >= file.size) { response.writeHead(416, { 'Content-Range': `bytes */${file.size}` }); response.end(); return }
        response.statusCode = 206
        response.setHeader('Content-Range', `bytes ${start}-${end}/${file.size}`)
      }
      response.setHeader('Content-Length', Math.max(0, end - start + 1))
      if (request.method === 'HEAD' || file.size === 0) { response.end(); return }
      const stream = createReadStream(path, { start, end })
      response.on('close', () => stream.destroy())
      stream.on('error', () => response.destroy()).pipe(response)
    } catch (error) {
      if (response.headersSent) { response.destroy(); return }
      response.writeHead(error.code === 'ENOENT' ? 404 : error instanceof URIError ? 400 : 500)
      response.end('Request unavailable')
    }
  })
  server.requestTimeout = 15000
  server.headersTimeout = 10000
  await new Promise((resolveReady, reject) => {
    server.once('error', reject)
    server.listen(port, '127.0.0.1', () => { server.removeListener('error', reject); resolveReady() })
  })
  let closing
  return {
    server, origin: `http://127.0.0.1:${server.address().port}`,
    close() {
      return closing ||= new Promise((done) => {
        const timer = setTimeout(() => server.closeAllConnections(), 2000)
        server.close(() => { clearTimeout(timer); done() })
        server.closeIdleConnections()
      })
    },
  }
}
