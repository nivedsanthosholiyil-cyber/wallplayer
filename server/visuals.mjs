import { createReadStream, createWriteStream } from 'node:fs'
import { mkdir, readFile, writeFile, rename, unlink, readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { randomUUID } from 'node:crypto'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'

const MAX_BYTES = 120 * 1024 * 1024
const validId = (id) => /^[a-zA-Z0-9_-]{1,80}$/.test(id)
const filePattern = /^visual-[a-f0-9-]+\.mp4$/
class HttpError extends Error { constructor(status, message) { super(message); this.status = status } }
function requireTrackId(id) { if (!validId(id)) throw new HttpError(400, 'Invalid Spotify track ID.'); return id }
export function defaultVisualDirectory() {
  const base = process.platform === 'win32' ? process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local') : process.platform === 'darwin' ? join(homedir(), 'Library', 'Application Support') : process.env.XDG_DATA_HOME || join(homedir(), '.local', 'share')
  return join(base, 'MusicWall', 'musicwall-data', 'visuals')
}
export class VisualLibrary {
  constructor(directory = defaultVisualDirectory()) { this.directory = directory }
  folder(trackId) { return join(this.directory, requireTrackId(trackId)) }
  async getVisual(trackId) {
    try {
      const folder = this.folder(trackId)
      const metadata = JSON.parse(await readFile(join(folder, 'metadata.json'), 'utf8'))
      if (metadata.spotifyTrackId !== trackId || !filePattern.test(metadata.fileName)) return null
      await stat(join(folder, metadata.fileName))
      return { ...metadata, src: `/api/visuals/library/${encodeURIComponent(trackId)}/file?version=${metadata.fileName}` }
    } catch (error) { if (error.code === 'ENOENT' || error instanceof SyntaxError) return null; throw error }
  }
  async hasVisual(trackId) { return Boolean(await this.getVisual(trackId)) }
  async listVisuals() {
    let folders
    try { folders = await readdir(this.directory, { withFileTypes: true }) } catch (error) { if (error.code === 'ENOENT') return []; throw error }
    const records = await Promise.all(folders.filter((folder) => folder.isDirectory() && validId(folder.name)).map((folder) => this.getVisual(folder.name)))
    return records.filter(Boolean)
  }
  async saveVisual(trackId, metadata, body, signal) {
    const folder = this.folder(trackId)
    await mkdir(folder, { recursive: true })
    const previous = await this.getVisual(trackId)
    const fileName = `visual-${randomUUID()}.mp4`
    const partial = join(folder, `${fileName}.part`)
    const complete = join(folder, fileName)
    const temporaryMetadata = join(folder, `${fileName}.json.part`)
    let bytes = 0
    const limit = new Transform({ transform(chunk, encoding, callback) {
      bytes += chunk.length
      callback(bytes > MAX_BYTES ? new HttpError(413, 'Choose a smaller video (maximum 120 MB).') : null, chunk)
    } })
    try {
      await pipeline(Readable.fromWeb(body), limit, createWriteStream(partial, { flags: 'wx' }), { signal })
      if (!bytes) throw new HttpError(502, 'Pexels returned an empty video.')
      await rename(partial, complete)
      const record = { ...metadata, spotifyTrackId: trackId, source: 'pexels', downloadedAt: new Date().toISOString(), fileName, bytes }
      await writeFile(temporaryMetadata, JSON.stringify(record, null, 2), { flag: 'wx' })
      await rename(temporaryMetadata, join(folder, 'metadata.json'))
      if (previous) await unlink(join(folder, previous.fileName)).catch(() => {})
      return this.getVisual(trackId)
    } catch (error) {
      await Promise.all([partial, complete, temporaryMetadata].map((path) => unlink(path).catch(() => {})))
      throw error
    }
  }
  async removeVisual(trackId) {
    const metadata = await this.getVisual(trackId)
    if (!metadata) return
    await unlink(join(this.folder(trackId), 'metadata.json'))
    await unlink(join(this.folder(trackId), metadata.fileName)).catch(() => {})
  }
}
function safeMediaUrl(value) {
  const url = new URL(value)
  if (url.protocol !== 'https:' || url.username || url.password || url.port || !(['videos.pexels.com', 'player.vimeo.com'].includes(url.hostname) || url.hostname.endsWith('.vimeocdn.com'))) throw new HttpError(502, 'Pexels returned an unsupported video host.')
  return url
}
export function normalizeVideo(video) {
  return {
    id: video.id, width: video.width, height: video.height, duration: video.duration, thumbnail: video.image,
    url: video.url, creator: video.user?.name || 'Pexels creator', creatorUrl: video.user?.url || 'https://www.pexels.com',
    videoFiles: (video.video_files || []).filter((file) => file.file_type === 'video/mp4' && file.width && file.height).map((file) => ({ id: file.id, width: file.width, height: file.height, quality: file.quality, fileType: file.file_type, link: file.link })),
  }
}
function json(response, status, payload) {
  response.statusCode = status
  response.setHeader('Content-Type', 'application/json')
  response.setHeader('Cache-Control', 'no-store')
  response.end(JSON.stringify(payload))
}
async function readJson(request) {
  let body = ''
  for await (const chunk of request) { body += chunk; if (body.length > 8192) throw new HttpError(413, 'Request too large.') }
  try { return JSON.parse(body) } catch { throw new HttpError(400, 'Invalid request.') }
}

export function createVisualsHandler({ apiKey = '', directory, fetchImpl = fetch } = {}) {
  const library = new VisualLibrary(directory)
  const busy = new Set()
  let rateLimitUntil = 0
  async function pexels(path, signal) {
    if (!apiKey) throw new HttpError(503, 'Add PEXELS_API_KEY to .env.local and restart MusicWall to search Pexels.')
    if (Date.now() < rateLimitUntil) throw new HttpError(429, 'Pexels rate limit reached. Please try again later.')
    const response = await fetchImpl(`https://api.pexels.com/v1/videos${path}`, { headers: { Authorization: apiKey }, signal })
    if (response.status === 429) {
      rateLimitUntil = Date.now() + Math.max(60000, Number(response.headers.get('Retry-After') || 60) * 1000)
      throw new HttpError(429, 'Pexels rate limit reached. Please try again later.')
    }
    if (!response.ok) throw new HttpError(response.status === 401 || response.status === 403 ? 503 : 502, response.status === 401 || response.status === 403 ? 'The Pexels API key was rejected. Check server configuration.' : 'Pexels is temporarily unavailable.')
    return response.json()
  }
  return async function visualsHandler(request, response, next = () => json(response, 404, { error: 'Not found' })) {
    const url = new URL(request.url || '/', 'http://localhost')
    const path = url.pathname.replace(/^\/api\/visuals(?=\/|$)/, '')
    const host = request.headers.host || 'localhost'
    if (!/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host) || request.headers['sec-fetch-site'] === 'cross-site' || request.headers.origin && ![`http://${host}`, `https://${host}`].includes(request.headers.origin)) {
      json(response, 403, { error: 'Visual library only accepts requests from MusicWall on this computer.' }); return
    }
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 90000)
    const onClose = () => { if (!response.writableEnded) controller.abort() }
    response.on('close', onClose)
    try {
      if (path === '/search' && request.method === 'GET') {
        const query = (url.searchParams.get('q') || '').trim().slice(0, 200)
        if (!query) throw new HttpError(400, 'Enter a search phrase.')
        const bounded = (key, fallback, maximum) => Math.min(maximum, Math.max(1, Number.parseInt(url.searchParams.get(key) || '', 10) || fallback))
        const orientation = url.searchParams.get('orientation') || ''
        if (orientation && !['landscape', 'portrait', 'square'].includes(orientation)) throw new HttpError(400, 'Choose a valid orientation.')
        const params = new URLSearchParams({ query, page: String(bounded('page', 1, 1000)), per_page: String(bounded('per_page', 12, 24)) })
        if (orientation) params.set('orientation', orientation)
        const result = await pexels(`/search?${params}`, controller.signal)
        const videos = (result.videos || []).map(normalizeVideo).filter((video) => video.videoFiles.length).sort((a, b) => Number(a.duration > 30) - Number(b.duration > 30) || a.duration - b.duration)
        json(response, 200, { videos, page: result.page, perPage: result.per_page, totalResults: result.total_results, hasNext: Boolean(result.next_page) })
        return
      }
      if (path === '/library' && request.method === 'GET') { json(response, 200, await library.listVisuals()); return }
      const match = path.match(/^\/library\/([^/]+)(\/file)?$/)
      if (!match) { next(); return }
      const trackId = requireTrackId(decodeURIComponent(match[1]))
      if (match[2] && ['GET', 'HEAD'].includes(request.method)) {
        const record = await library.getVisual(trackId)
        const version = url.searchParams.get('version') || record?.fileName
        if (!record || !version || !filePattern.test(version)) throw new HttpError(404, 'Saved visual not found.')
        const file = join(library.folder(trackId), version)
        const info = await stat(file).catch(() => { throw new HttpError(404, 'Saved visual not found.') })
        let start = 0, end = info.size - 1
        const range = request.headers.range
        if (range) {
          const parts = /^bytes=(\d*)-(\d*)$/.exec(range)
          if (!parts || (!parts[1] && !parts[2])) throw new HttpError(416, 'Invalid video range.')
          if (!parts[1]) start = Math.max(0, info.size - Number(parts[2]))
          else { start = Number(parts[1]); if (parts[2]) end = Math.min(end, Number(parts[2])) }
          if (start > end || start >= info.size) { response.setHeader('Content-Range', `bytes */${info.size}`); throw new HttpError(416, 'Invalid video range.') }
          response.statusCode = 206
          response.setHeader('Content-Range', `bytes ${start}-${end}/${info.size}`)
        }
        response.setHeader('Content-Type', 'video/mp4')
        response.setHeader('Accept-Ranges', 'bytes')
        response.setHeader('Content-Length', end - start + 1)
        response.setHeader('Cache-Control', 'private, max-age=31536000, immutable')
        if (request.method === 'HEAD') response.end()
        else await pipeline(createReadStream(file, { start, end }), response, { signal: controller.signal })
        return
      }
      if (request.method === 'GET') { json(response, 200, await library.getVisual(trackId)); return }
      if (busy.has(trackId)) throw new HttpError(409, 'A visual update for this track is already running.')
      if (request.method === 'DELETE') {
        busy.add(trackId)
        try { await library.removeVisual(trackId); json(response, 200, { removed: true }) } finally { busy.delete(trackId) }
        return
      }
      if (request.method === 'POST') {
        busy.add(trackId)
        try {
          const body = await readJson(request)
          if (!Number.isSafeInteger(body.pexelsId) || !Number.isSafeInteger(body.fileId)) throw new HttpError(400, 'Choose a valid Pexels video.')
          const video = await pexels(`/videos/${body.pexelsId}`, controller.signal)
          const file = video.video_files?.find((file) => file.id === body.fileId && file.file_type === 'video/mp4')
          if (!file) throw new HttpError(400, 'This video format is no longer available. Search again.')
          let downloadUrl = safeMediaUrl(file.link)
          let download
          for (let attempt = 0; attempt < 5; attempt++) {
            download = await fetchImpl(downloadUrl, { signal: controller.signal, redirect: 'manual' })
            if (download.status >= 300 && download.status < 400 && download.headers.get('Location')) {
              await download.body?.cancel()
              downloadUrl = safeMediaUrl(new URL(download.headers.get('Location'), downloadUrl).href)
            } else break
          }
          if (!download?.ok || !download.body) throw new HttpError(502, 'Video download failed. Try another video.')
          const contentType = download.headers.get('Content-Type') || ''
          if (contentType && !contentType.includes('video/mp4') && !contentType.includes('application/octet-stream')) { await download.body.cancel(); throw new HttpError(502, 'Pexels returned an invalid video file.') }
          if (Number(download.headers.get('Content-Length')) > MAX_BYTES) { await download.body.cancel(); throw new HttpError(413, 'Choose a smaller video (maximum 120 MB).') }
          const record = await library.saveVisual(trackId, { title: String(body.title || '').slice(0, 512), artist: String(body.artist || '').slice(0, 512), pexelsId: video.id, width: file.width, height: file.height, duration: video.duration, creator: video.user?.name, creatorUrl: video.user?.url, sourceUrl: video.url }, download.body, controller.signal)
          json(response, 200, record)
        } finally { busy.delete(trackId) }
        return
      }
      throw new HttpError(405, 'Method not allowed.')
    } catch (error) {
      if (!response.headersSent && !response.destroyed) json(response, error.status || (error.name === 'AbortError' ? 504 : 500), { error: error instanceof HttpError ? error.message : error.name === 'AbortError' ? 'Video download timed out. Try a smaller video.' : 'Could not access the local visual library.' })
    } finally { clearTimeout(timeout); response.off('close', onClose) }
  }
}
