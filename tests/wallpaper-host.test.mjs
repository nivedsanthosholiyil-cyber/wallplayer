// @vitest-environment node
import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { afterEach, expect, it, vi } from 'vitest'
import api from '../desktop/wallpaper-controller.cjs'

const roots = [], controllers = []
async function fixture(timeoutMs = 1000) {
  const runtime = await mkdtemp(join(tmpdir(), 'musicwall-host-test-')); roots.push(runtime)
  const child = Object.assign(new EventEmitter(), { stdin: new PassThrough(), stdout: new PassThrough(), stderr: new PassThrough(), kill: vi.fn() })
  child.kill.mockImplementation(() => { queueMicrotask(() => child.emit('close', 1)); return true })
  const spawnImpl = vi.fn(() => child)
  const host = new api.WallpaperController({ source: resolve('desktop'), runtime, handle: '1234', parentPid: 123, spawnImpl, timeoutMs })
  controllers.push(host)
  const send = data => child.stdout.write(JSON.stringify(data) + '\n')
  return { host, child, spawnImpl, send }
}
afterEach(async () => {
  for (const host of controllers.splice(0)) { host.child?.emit('close', 0); await host.stop(1) }
  for (const root of roots.splice(0)) {
    if (!root.startsWith(join(tmpdir(), 'musicwall-host-test-'))) throw new Error('Unsafe fixture cleanup')
    await rm(root, { recursive: true, force: true })
  }
})
const attached = { type: 'ready', mode: 'wallpaper', details: { Verified: true, Parent: 101, Child: true } }
it('waits for native verification before accepting attachment and uses a fixed trusted helper', async () => {
  const { host, spawnImpl, send } = await fixture()
  const ready = host.start(); let settled = false; ready.then(() => { settled = true })
  await Promise.resolve(); expect(settled).toBe(false); expect(host.mode).toBe('window')
  const [exe, args, options] = spawnImpl.mock.calls[0]
  expect(exe).toMatch(/WindowsPowerShell.*powershell\.exe$/)
  expect(args).not.toContain('Bypass'); expect(args).toContain('-ParentPid'); expect(options.windowsHide).toBe(true)
  send(attached); await ready; expect(host.mode).toBe('wallpaper')
})
it('rejects native errors and unverified success instead of claiming wallpaper mode', async () => {
  for (const message of [{ ...attached, details: { Verified: false } }, { type: 'error', message: 'SetParent failed' }]) {
    const { host, send } = await fixture(); const result = host.start()
    const rejected = expect(result).rejects.toThrow(/verified|SetParent/)
    send(message); await rejected; expect(host.mode).toBe('window')
  }
})
it('times out missing readiness and still permits bounded shutdown', async () => {
  const { host, child } = await fixture(10)
  await expect(host.start()).rejects.toThrow('confirm attachment')
  await host.stop(5); expect(child.kill).toHaveBeenCalledOnce()
})
it('changes modes only after the corresponding command is acknowledged', async () => {
  const { host, child, send } = await fixture(); const start = host.start(); send(attached); await start
  let commands = ''; child.stdin.on('data', data => { commands += data })
  const normal = host.setMode('window'); expect(host.mode).toBe('wallpaper')
  const command = JSON.parse(commands.trim()); expect(command).toMatchObject({ type: 'mode', mode: 'window' })
  send({ type: 'mode', id: command.id, mode: 'window', details: { Verified: true, Child: false, Parent: 0 } }); await normal
  expect(host.mode).toBe('window'); expect(host.details.Child).toBe(false)
  await expect(host.setMode('arbitrary')).rejects.toThrow('Invalid wallpaper mode')
})
it('reports a crashed helper and rejects an outstanding mode request', async () => {
  const { host, child, send } = await fixture(); const start = host.start(); send(attached); await start
  const failure = vi.fn(); host.on('failure', failure)
  const changing = host.setMode('window'), rejected = expect(changing).rejects.toThrow('exited')
  child.stderr.write('native failure'); child.emit('close', 1); await rejected
  expect(failure).toHaveBeenCalledOnce(); expect(failure.mock.calls[0][0].message).toContain('native failure')
})
it('stops over the pipe, waits for helper exit and avoids killing a healthy helper', async () => {
  const { host, child, send } = await fixture(); const start = host.start(); send(attached); await start
  let command = ''; child.stdin.on('data', data => { command += data })
  const stop = host.stop(); expect(JSON.parse(command.trim())).toEqual({ type: 'stop' })
  expect(host.stop()).toBe(stop); child.emit('close', 0); await stop
  expect(child.kill).not.toHaveBeenCalled()
})
it('keeps an Explorer-destroyed window distinct from a helper crash so recovery can retain wallpaper mode', async () => {
  const { host, child, send } = await fixture(); const start = host.start(); send(attached); await start
  const lost = vi.fn(), failure = vi.fn(); host.on('window-lost', lost); host.on('failure', failure)
  send({ type: 'window-lost' }); child.emit('close', 0)
  expect(lost).toHaveBeenCalledOnce(); expect(failure).not.toHaveBeenCalled()
  expect(host.windowLost).toBe(true); expect(host.mode).toBe('wallpaper')
})
it('waits for process close after requesting forced termination', async () => {
  const { host, child, send } = await fixture(); const start = host.start(); send(attached); await start
  child.kill.mockImplementation(() => true)
  let settled = false; const stop = host.stop(5); stop.then(() => { settled = true })
  await new Promise(resolve => setTimeout(resolve, 20))
  expect(child.kill).toHaveBeenCalledOnce(); expect(settled).toBe(false)
  child.emit('close', 1); await expect(stop).resolves.toEqual({ exited: true, forced: true })
})
it.runIf(process.platform === 'win32')('compiles the actual native helper and probes the real desktop without changing it', async () => {
  const { stdout } = await promisify(execFile)('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-File', resolve('desktop/wallpaper-host.ps1'), '-Probe'], { windowsHide: true, timeout: 15000 })
  const probe = JSON.parse(stdout.trim())
  expect(probe.type).toBe('probe'); expect(Array.isArray(probe.windows)).toBe(true)
  const progman = probe.windows.find(w => w.Class === 'Progman')
  if (progman) expect(progman.Handle).toBeGreaterThan(0)
}, 20000)
it.runIf(process.platform === 'win32')('refuses a HWND that does not belong to the specified Electron parent', async () => {
  await expect(promisify(execFile)('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-File', resolve('desktop/wallpaper-host.ps1'), '-WindowHandle', '0', '-ParentPid', String(process.pid)], { windowsHide: true, timeout: 15000 }))
    .rejects.toMatchObject({ code: 1, stdout: expect.stringContaining('does not belong') })
}, 20000)
