// @vitest-environment node
import { createServer, type Server } from 'node:http'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import { createVisualsHandler } from '../server/visuals.mjs'

const resources: { server: Server; directory: string }[] = []
const video = { id: 42, width: 1280, height: 720, duration: 12, image: 'https://images.pexels.com/test.jpg', url: 'https://www.pexels.com/video/42', user: { name: 'Artist', url: 'https://www.pexels.com/@artist' }, video_files: [{ id: 8, width: 1280, height: 720, quality: 'hd', file_type: 'video/mp4', link: 'https://videos.pexels.com/video-files/42/test.mp4' }] }
const binary = Buffer.from('00000018667479706d703432000000006d70343269736f6d', 'hex')
async function start(fetchImpl: typeof fetch, apiKey = 'server-only-test-key', directory?: string) {
  directory ||= await mkdtemp(join(tmpdir(), 'musicwall-visual-test-'))
  const server = createServer(createVisualsHandler({ apiKey, directory, fetchImpl }))
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  resources.push({ server, directory })
  return { url: `http://127.0.0.1:${(server.address() as { port: number }).port}/api/visuals`, server, directory }
}
afterEach(async () => {
  for (const { server, directory } of resources.splice(0)) {
    server.closeAllConnections()
    await new Promise<void>((resolve) => server.close(() => resolve()))
    if (dirname(directory) !== tmpdir() || !directory.startsWith(join(tmpdir(), 'musicwall-visual-test-'))) throw new Error('Unsafe test cleanup path')
    await rm(directory, { recursive: true, force: true })
  }
})
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

it('proxies normalized search, bounds paging, and keeps credentials on the server', async () => {
  const upstream = vi.fn().mockResolvedValue(response({ videos: [video], page: 2, per_page: 24, total_results: 1 }))
  const { url } = await start(upstream)
  const result = await fetch(`${url}/search?q=ocean&orientation=landscape&page=2&per_page=1000`)
  const payload = await result.json()
  expect(payload.videos[0]).toMatchObject({ id: 42, thumbnail: video.image, videoFiles: [{ id: 8, fileType: 'video/mp4' }] })
  expect(upstream.mock.calls[0][0]).toContain('per_page=24')
  expect(upstream.mock.calls[0][1].headers.Authorization).toBe('server-only-test-key')
  expect(JSON.stringify(payload)).not.toContain('server-only-test-key')
})

it('downloads bytes to disk, persists metadata across server restart, serves ranges, and removes a visual', async () => {
  const upstream = vi.fn().mockResolvedValueOnce(response(video)).mockResolvedValueOnce(new Response(binary, { headers: { 'Content-Type': 'video/mp4' } }))
  const first = await start(upstream)
  const result = await fetch(`${first.url}/library/track-one`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pexelsId: 42, fileId: 8, title: 'Song', artist: 'Artist' }) })
  expect(result.status).toBe(200)
  const saved = await result.json()
  expect(saved).toMatchObject({ spotifyTrackId: 'track-one', source: 'pexels', pexelsId: 42, bytes: binary.length })
  expect(await readFile(join(first.directory, 'track-one', saved.fileName))).toEqual(binary)
  expect(JSON.parse(await readFile(join(first.directory, 'track-one', 'metadata.json'), 'utf8')).title).toBe('Song')
  const second = await start(upstream, '', first.directory)
  const persisted = await (await fetch(`${second.url}/library/track-one`)).json()
  expect(persisted.src).toBe(saved.src)
  const range = await fetch(`${second.url}/library/track-one/file?version=${saved.fileName}`, { headers: { Range: 'bytes=4-7' } })
  expect(range.status).toBe(206)
  expect(Buffer.from(await range.arrayBuffer())).toEqual(binary.subarray(4, 8))
  expect(await (await fetch(`${second.url}/library`)).json()).toHaveLength(1)
  expect((await fetch(`${second.url}/library/track-one`, { method: 'DELETE' })).status).toBe(200)
  expect(await (await fetch(`${second.url}/library/track-one`)).json()).toBeNull()
  expect(upstream).toHaveBeenCalledTimes(2)
})

it('keeps an existing visual when replacement download fails', async () => {
  const upstream = vi.fn().mockResolvedValueOnce(response(video)).mockResolvedValueOnce(new Response(binary, { headers: { 'Content-Type': 'video/mp4' } })).mockResolvedValueOnce(response(video)).mockResolvedValueOnce(new Response('', { status: 502 }))
  const { url } = await start(upstream)
  const options = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pexelsId: 42, fileId: 8 }) }
  const original = await (await fetch(`${url}/library/track-one`, options)).json()
  expect((await fetch(`${url}/library/track-one`, options)).status).toBe(502)
  expect((await (await fetch(`${url}/library/track-one`)).json()).fileName).toBe(original.fileName)
})

it('handles missing configuration, API rate limits, hostile origins and paths', async () => {
  const upstream = vi.fn().mockResolvedValue(new Response('', { status: 429, headers: { 'Retry-After': '60' } }))
  const unconfigured = await start(upstream, '')
  expect((await fetch(`${unconfigured.url}/search?q=ocean`)).status).toBe(503)
  const configured = await start(upstream)
  expect((await fetch(`${configured.url}/search?q=ocean`)).status).toBe(429)
  expect((await fetch(`${configured.url}/search?q=ocean`)).status).toBe(429)
  expect(upstream).toHaveBeenCalledTimes(1)
  expect((await fetch(`${configured.url}/library/track-one`, { method: 'DELETE', headers: { Origin: 'https://evil.example' } })).status).toBe(403)
  expect((await fetch(`${configured.url}/library/a%2Fb`)).status).toBe(400)
})
