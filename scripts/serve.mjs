import { createServer } from 'node:http'
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { resolve, sep, extname } from 'node:path'
import { loadEnv } from 'vite'
import { createVisualsHandler } from '../server/visuals.mjs'

const env = { ...loadEnv('production', process.cwd(), ''), ...process.env }
const handler = createVisualsHandler({ apiKey: env.PEXELS_API_KEY || '', directory: env.MUSICWALL_VISUALS_DIR || undefined })
const root = resolve('dist')
const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.mp4': 'video/mp4' }
createServer(async (request, response) => {
  const pathname = new URL(request.url || '/', 'http://localhost').pathname
  if (pathname.startsWith('/api/visuals/')) { await handler(request, response); return }
  if (pathname.startsWith('/api/')) { response.writeHead(404); response.end('API route unavailable'); return }
  try {
    let path = resolve(root, `.${decodeURIComponent(pathname)}`)
    if (path !== root && !path.startsWith(root + sep)) { response.writeHead(403); response.end(); return }
    if (!extname(path)) path = resolve(root, 'index.html')
    const file = await stat(path)
    if (!file.isFile()) throw new Error('Not a file')
    response.setHeader('Content-Type', types[extname(path)] || 'application/octet-stream')
    createReadStream(path).on('error', () => response.destroy()).pipe(response)
  } catch { response.writeHead(404); response.end('Not found') }
}).listen(Number(env.PORT || 4173), '127.0.0.1', () => console.log(`MusicWall: http://127.0.0.1:${env.PORT || 4173}`))
