// @vitest-environment node
import { EventEmitter } from 'node:events'
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { request as httpRequest } from 'node:http'
import { afterEach, expect, it, vi } from 'vitest'
import { startProductionServer, readEnvironment } from '../server/production.mjs'
import { OAuthCallbackBroker, authorizationState, isAppUrl, isExternalLink, DESKTOP_CALLBACK } from '../desktop/policy.mjs'
import lifecycle from '../desktop/lifecycle.cjs'
import { createLyricsHandler } from '../server/lyrics.mjs'

const resources = []
async function start(options = {}) {
  const root = await mkdtemp(join(tmpdir(), 'musicwall-desktop-test-'))
  const resource = { root }
  resources.push(resource)
  await writeFile(join(root, 'index.html'), '<title>MusicWall fixture</title>')
  await writeFile(join(root, 'sample.mp4'), '0123456789')
  resource.runtime = await startProductionServer({ root, port: 0, ...options })
  return resource.runtime
}
afterEach(async () => {
  vi.useRealTimers()
  for (const { root, runtime } of resources.splice(0)) {
    await runtime?.close()
    if (dirname(root) !== tmpdir() || !root.startsWith(join(tmpdir(), 'musicwall-desktop-test-'))) throw new Error('Unsafe cleanup path')
    await rm(root, { recursive: true, force: true })
  }
})
function rawRequest(origin, path, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = httpRequest(origin, { path, headers }, (res) => { res.resume(); res.on('end', () => resolve(res.statusCode)) })
    req.on('error', reject); req.end()
  })
}
it('serves the configured build, browser callback, CSP and media ranges', async () => {
  const { origin } = await start()
  const html = await fetch(`${origin}/callback?code=test`)
  expect(await html.text()).toContain('MusicWall fixture')
  expect(html.headers.get('content-security-policy')).toContain("default-src 'none'")
  expect(html.headers.get('content-security-policy')).not.toContain('unsafe-eval')
  const video = await fetch(`${origin}/sample.mp4`, { headers: { Range: 'bytes=2-5' } })
  expect(video.status).toBe(206)
  expect(video.headers.get('content-range')).toBe('bytes 2-5/10')
  expect(await video.text()).toBe('2345')
  expect((await fetch(`${origin}/sample.mp4`, { method: 'HEAD' })).headers.get('content-length')).toBe('10')
  expect((await fetch(`${origin}/sample.mp4`, { headers: { Range: 'bytes=99-' } })).status).toBe(416)
  expect((await fetch(`${origin}/missing.png`)).status).toBe(404)
})
it('rejects traversal, DNS rebinding, unsupported methods and cross-site API requests', async () => {
  const { origin } = await start()
  expect(await rawRequest(origin, '/%2e%2e%5cpackage.json')).toBe(403)
  expect(await rawRequest(origin, '/%ZZ')).toBe(400)
  expect(await rawRequest(origin, '/', { Host: 'attacker.example' })).toBe(403)
  expect((await fetch(origin, { method: 'POST' })).status).toBe(405)
  expect((await fetch(`${origin}/api/lyrics/get`, { headers: { Origin: 'https://attacker.example' } })).status).toBe(403)
  expect((await fetch(`${origin}/api/not-a-route`)).status).toBe(404)
})
it('fails on an occupied port and releases it on idempotent shutdown', async () => {
  const runtime = await start()
  const port = runtime.server.address().port
  await expect(start({ port })).rejects.toMatchObject({ code: 'EADDRINUSE' })
  await Promise.all([runtime.close(), runtime.close()])
  const replacement = await start({ port })
  expect((await fetch(replacement.origin)).status).toBe(200)
})
it('fails before readiness when the frontend build is missing', async () => {
  await expect(startProductionServer({ root: join(tmpdir(), 'musicwall-build-that-does-not-exist'), port: 0 })).rejects.toMatchObject({ code: 'ENOENT' })
})
it('relays only a matching one-time callback without reflecting credentials in HTML', async () => {
  const broker = new OAuthCallbackBroker(), callbacks = []
  broker.begin('valid-state')
  const { origin } = await start({ onCallback(params) { const query = broker.accept(params); if (query) callbacks.push(query); return Boolean(query) } })
  expect((await fetch(`${origin}/callback?state=wrong&code=secret`)).status).toBe(400)
  const accepted = await fetch(`${origin}/callback?state=valid-state&code=secret`)
  expect(accepted.status).toBe(200)
  expect(await accepted.text()).not.toContain('secret')
  expect(accepted.headers.get('cache-control')).toBe('no-store')
  expect(callbacks).toEqual(['state=valid-state&code=secret'])
  expect((await fetch(`${origin}/callback?state=valid-state&code=secret`)).status).toBe(400)
})
it('rejects expired/ambiguous callbacks and relays a declined authorization', () => {
  const broker = new OAuthCallbackBroker()
  broker.begin('state', 100)
  expect(broker.accept(new URLSearchParams('state=state&code=a'), 600101)).toBeNull()
  broker.begin('state')
  expect(broker.accept(new URLSearchParams('state=state&code=a&code=b'))).toBeNull()
  expect(broker.accept(new URLSearchParams('state=state&code=a&error=b'))).toBeNull()
  expect(broker.accept(new URLSearchParams('state=state&error=access_denied'))).toBe('state=state&error=access_denied')
})
it('validates exact OAuth destination, redirect and safe external links', () => {
  const url = new URL('https://accounts.spotify.com/authorize')
  url.search = new URLSearchParams({ redirect_uri: DESKTOP_CALLBACK, response_type: 'code', code_challenge_method: 'S256', code_challenge: 'a'.repeat(43), state: 'b'.repeat(32), client_id: 'public-client-id' }).toString()
  expect(authorizationState(url.href)).toBe('b'.repeat(32))
  url.searchParams.set('redirect_uri', 'http://127.0.0.1:5173/callback')
  expect(authorizationState(url.href)).toBeNull()
  expect(authorizationState(url.href.replace('accounts.spotify.com', 'accounts.spotify.com.evil.test'))).toBeNull()
  expect(isExternalLink('https://open.spotify.com/track/123')).toBe(true)
  for (const unsafe of ['file:///C:/Windows/notepad.exe', 'spotify:track:123', 'https://open.spotify.com.evil.test', 'https://user@open.spotify.com']) expect(isExternalLink(unsafe)).toBe(false)
  expect(isAppUrl('http://127.0.0.1:4173/')).toBe(true)
  expect(isAppUrl('http://127.0.0.1:4174/')).toBe(false)
})
it('waits for readiness and reports child startup failure, exit and timeout', async () => {
  const child = new EventEmitter()
  const ready = lifecycle.waitForReady(child, 'expected')
  child.emit('message', { type: 'ready', origin: 'expected' })
  await ready
  expect(child.listenerCount('message')).toBe(0)
  const failed = lifecycle.waitForReady(child, 'expected')
  child.emit('message', { type: 'startup-error', message: 'Port occupied' })
  await expect(failed).rejects.toThrow('Port occupied')
  const exited = lifecycle.waitForReady(child, 'expected')
  child.emit('exit', 1)
  await expect(exited).rejects.toThrow('exited')
  await expect(lifecycle.waitForReady(child, 'expected', 5)).rejects.toThrow('did not start')
})
it('requests graceful shutdown and kills an unresponsive server after the deadline', async () => {
  const child = Object.assign(new EventEmitter(), { pid: 42, kill: vi.fn(), postMessage: vi.fn() })
  const stop = lifecycle.stopServer(child)
  expect(child.postMessage).toHaveBeenCalledWith({ type: 'shutdown' })
  child.emit('exit', 0)
  await stop
  expect(child.kill).not.toHaveBeenCalled()
  await lifecycle.stopServer(child, 5)
  expect(child.kill).toHaveBeenCalledOnce()
})
it('loads optional environment files without Vite and lets process configuration win', async () => {
  await start()
  const config = join(resources.at(-1).root, 'server.env')
  await writeFile(config, 'LYRICS_API_KEY="server-only"\nPORT=9000\n')
  expect(await readEnvironment([config, config + '.missing'], { PORT: '4173' })).toEqual({ LYRICS_API_KEY: 'server-only', PORT: '4173' })
})
it('bounds proxy parameters, keeps keys server-side and disallows upstream redirects', async () => {
  const upstream = vi.fn().mockResolvedValue(new Response('{"syncedLyrics":"example"}'))
  const handler = createLyricsHandler({ apiUrl: 'https://provider.example/api', apiKey: 'private-key', fetchImpl: upstream })
  const response = { setHeader: vi.fn(), writeHead: vi.fn(), end: vi.fn() }
  await handler({ url: '/api/lyrics/get?track_name=Song&url=https://evil.test', method: 'GET', headers: {} }, response)
  const [url, options] = upstream.mock.calls[0]
  expect(url.href).toBe('https://provider.example/api/get?track_name=Song')
  expect(options).toMatchObject({ headers: { Authorization: 'Bearer private-key' }, redirect: 'error' })
  expect(response.end.mock.calls[0][0].toString()).not.toContain('private-key')
  expect(() => createLyricsHandler({ apiUrl: 'http://provider.example' })).toThrow('HTTPS')
})

it('wires the Windows desktop host and a return-to-window control path', async () => {
  const main = await readFile(new URL('../desktop/main.cjs', import.meta.url), 'utf8')
  const host = await readFile(new URL('../desktop/wallpaper-host.ps1', import.meta.url), 'utf8')
  expect(main).toContain('startWallpaperHost()')
  expect(main).toContain("writeFileSync(wallpaperStateFile, 'window', 'utf8')")
  expect(main).toContain("new Tray(icon)")
  expect(host).toContain('SHELLDLL_DefView')
  expect(host).toContain('[MusicWallDesktop]::SetParent')
  expect(host).toContain('[MusicWallDesktop]::GetSystemMetrics(78)')
})
