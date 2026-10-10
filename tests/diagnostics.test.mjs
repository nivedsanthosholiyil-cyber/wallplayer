// @vitest-environment node
import { expect, it, vi } from 'vitest'
import { createRequire } from 'node:module'
import { readFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { JSDOM } from 'jsdom'
import { runInNewContext } from 'node:vm'
const { Diagnostics } = createRequire(import.meta.url)('../desktop/diagnostics.cjs')

it('serializes status replacements when a Windows reader briefly locks the destination', async () => {
  const require = createRequire(import.meta.url), fs = require('node:fs')
  const directory = mkdtempSync(join(tmpdir(), 'musicwall-diagnostics-')), path = join(directory, 'status.json')
  const rename = fs.renameSync
  const locked = vi.spyOn(fs, 'renameSync').mockImplementationOnce(() => { throw Object.assign(new Error('Reader still open'), { code: 'EPERM' }) }).mockImplementation(rename)
  const entry = require.resolve('../desktop/diagnostics.cjs'); delete require.cache[entry]
  try {
    const { atomicJson } = require(entry)
    const first = atomicJson(path, { mode: 'wallpaper' })
    const second = atomicJson(path, { mode: 'window' })
    await Promise.all([first, second])
    expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual({ mode: 'window' })
    expect(locked).toHaveBeenCalledTimes(3)
  } finally { locked.mockRestore(); delete require.cache[entry]; rmSync(directory, { recursive: true, force: true }) }
})

it('bounds and rate limits diagnostics, redacts secrets, and disables them in production', () => {
  let time = 1000
  const d = new Diagnostics({ enabled: true, capacity: 3, now: () => time, sessionId: 'test' })
  d.record('input', 'aggregate', { token: 'private', count: 5, message: 'https://example.test/?code=private Bearer private state=private' }, 5000)
  d.record('input', 'aggregate', { count: 999 }, 5000)
  expect(d.events).toHaveLength(1)
  expect(JSON.stringify(d.snapshot())).not.toContain('private')
  time += 5000; d.record('input', 'aggregate', { count: 6 }, 5000)
  d.record('renderer', 'error', new Error('https://example.test/?secret=private'))
  expect(d.events.at(-1).details.stack).toContain('Error')
  for (let i = 0; i < 100; i++) d.record('renderer', 'sample', { count: i })
  expect(d.events).toHaveLength(3)
  expect(d.events[0].sessionId).toBe('test')
  const production = new Diagnostics(); production.record('renderer', 'error', new Error('private'))
  expect(production.events).toHaveLength(0)
})

it('reinitializes the renderer probe without duplicate frame loops and cleans up media listeners', () => {
  const dom = new JSDOM('<body><div class="video-background"><video></video></div></body>')
  const { window } = dom
  let sequence = 0
  const frames = new Map()
  const source = readFileSync(new URL('../desktop/renderer-probe.js', import.meta.url), 'utf8')
  const context = { window, document: window.document, MutationObserver: window.MutationObserver, innerWidth: 1000, innerHeight: 600, devicePixelRatio: 1,
    getComputedStyle: window.getComputedStyle.bind(window), matchMedia: () => ({ matches: false }),
    requestAnimationFrame: fn => { frames.set(++sequence, fn); return sequence }, cancelAnimationFrame: id => frames.delete(id) }
  window.document.getAnimations = () => []
  runInNewContext(source, context)
  expect(frames.size).toBe(1)
  runInNewContext(source, context)
  expect(frames.size).toBe(1)
  for (const time of [10, 26, 42, 242]) {
    const [id, callback] = frames.entries().next().value; frames.delete(id); callback(time)
  }
  window.dispatchEvent(new window.Event('pointermove'))
  const video = window.document.querySelector('video'); video.dispatchEvent(new window.Event('waiting'))
  const sample = window.__musicwallProbe.sample()
  expect(sample.frames).toMatchObject({ count: 4, maxMs: 200, gapsOver100Ms: 1 })
  expect(sample.counts.windowPointer).toBe(1)
  expect(sample.events.some(e => e.event === 'video-waiting')).toBe(true)
  expect(window.__musicwallProbe.sample().frames.count).toBe(0)
  window.__musicwallProbe.dispose()
  expect(frames.size).toBe(0)
  expect(window.__musicwallProbe).toBeUndefined()
  dom.window.close()
})
