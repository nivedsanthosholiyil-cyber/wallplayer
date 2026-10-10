// @vitest-environment node
import { EventEmitter } from 'node:events'
import Module, { createRequire } from 'node:module'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'

const require = createRequire(import.meta.url)
const fixtures = []
async function desktop() {
  const directory = await mkdtemp(join(tmpdir(), 'musicwall-lifecycle-'))
  const windows = [], helpers = []
  const app = Object.assign(new EventEmitter(), {
    commandLine: { appendSwitch: vi.fn() },
    setName() {}, setAppUserModelId() {}, getPath: () => directory, getAppPath: () => resolve('.'),
    requestSingleInstanceLock: () => true, whenReady: () => Promise.resolve(),
    quit: vi.fn(() => { app.emit('before-quit', { preventDefault() {} }) }),
  })
  class Window extends EventEmitter {
    constructor() {
      super(); windows.push(this); this.webContents = Object.assign(new EventEmitter(), {
        mainFrame: {url:'http://127.0.0.1:4173/'}, setWindowOpenHandler() {}, getURL: () => 'http://127.0.0.1:4173/',
      })
    }
    loadURL = vi.fn(async () => { queueMicrotask(() => this.emit('ready-to-show')) })
    getNativeWindowHandle() { return Buffer.from([1, 0, 0, 0, 0, 0, 0, 0]) }
    isDestroyed() { return !!this.destroyed }
    destroy() { this.destroyed = true; this.emit('closed'); app.emit('window-all-closed') }
    isMinimized() { return false }
    show() { this.visible = true }
    showInactive() { this.visible = true; this.shownWithoutFocus = true }
    focus() {} restore() {} setMinimumSize() {} setMenuBarVisibility() {}
  }
  class Host extends EventEmitter {
    constructor() { super(); helpers.push(this); this.child = { pid: 33 }; this.mode = 'window' }
    async start() { this.mode = 'wallpaper'; this.details = { Verified: true, Parent: 101, X: 0, Y: 0, Width: 1920, Height: 1080 }; this.emit('status', { mode: this.mode, details: this.details }) }
    async setMode(mode) { this.mode = mode; this.details = { Verified: true, Parent: mode === 'window' ? 0 : 101, Child: mode !== 'window' }; this.emit('status', { mode, details: this.details }) }
    stop = vi.fn(async () => { this.closed = true; return { exited: true, forced: false } })
  }
  const server = Object.assign(new EventEmitter(), { pid: 22,
    postMessage: vi.fn(data => { if(data.type === 'shutdown') queueMicrotask(() => server.emit('exit', 0)); if(data.type === 'oauth-begin') queueMicrotask(() => server.emit('message',{type:'oauth-ready',state:data.state})) }), kill: vi.fn(),
  })
  const electron = { app, BrowserWindow: Window, dialog: { showErrorBox: vi.fn() },
    Menu: { buildFromTemplate: value => value, setApplicationMenu() {} },
    shell: { openExternal: vi.fn().mockResolvedValue(undefined) }, session: { defaultSession: Object.assign(new EventEmitter(), { setPermissionRequestHandler() {}, setPermissionCheckHandler() {} }) },
    ipcMain: {handle:vi.fn(),removeHandler:vi.fn()}, safeStorage:{isAsyncEncryptionAvailable:vi.fn().mockResolvedValue(true)},
    utilityProcess: { fork: () => { setImmediate(() => server.emit('message', { type: 'ready', origin: 'http://127.0.0.1:4173' })); return server } },
    nativeImage: { createFromPath: () => ({ resize: () => ({ isEmpty: () => false }) }) },
    Tray: class extends EventEmitter { setToolTip() {} setContextMenu() {} destroy() {} },
  }
  const entry = require.resolve('../desktop/main.cjs'), load = Module._load
  const args = [...process.argv]; process.argv.push('--wallpaper')
  class Input { ready=Promise.resolve(); handle='2'; setActive() {} destroy() {} }
  Module._load = function (name, ...rest) { return name === 'electron' ? electron : name === './wallpaper-controller.cjs' ? { WallpaperController: Host } : name === './wallpaper-input.cjs' ? { WallpaperInput: Input } : load.call(this, name, ...rest) }
  try { delete require.cache[entry]; require(entry) } finally { Module._load = load; process.argv.splice(0, process.argv.length, ...args) }
  const fixture = { app, directory, windows, helpers, server, electron, entry,
    status: async () => JSON.parse(await readFile(join(directory, 'desktop-status.json'), 'utf8')) }
  fixtures.push(fixture)
  await vi.waitFor(async () => expect(await fixture.status()).toMatchObject({ event: 'mode-settled', mode: 'wallpaper' }))
  await Promise.resolve()
  return fixture
}
afterEach(async () => {
  vi.useRealTimers()
  for (const item of fixtures.splice(0)) {
    item.app.quit()
    await vi.waitFor(() => expect(item.server.postMessage).toHaveBeenCalledWith({ type: 'shutdown' }))
    delete require.cache[item.entry]
    if (!item.directory.startsWith(join(tmpdir(), 'musicwall-lifecycle-'))) throw new Error('Unsafe cleanup')
    await rm(item.directory, { recursive: true, force: true })
  }
})
it.runIf(process.platform === 'win32')('recreates an Explorer-lost window in the desired wallpaper mode and cleans both processes on quit', async () => {
  const f = await desktop(); vi.useFakeTimers()
  f.helpers[0].windowLost = true; f.helpers[0].emit('window-lost')
  await vi.advanceTimersByTimeAsync(2000)
  expect(f.helpers[0].stop).toHaveBeenCalledOnce()
  expect(f.windows[0].destroyed).toBe(true)
  expect(f.windows).toHaveLength(2); expect(f.helpers).toHaveLength(2)
  expect(await f.status()).toMatchObject({ mode: 'wallpaper', desiredMode: 'wallpaper', native: { Parent: 101, Width: 1920, Height: 1080 } })
  f.app.quit(); await vi.advanceTimersByTimeAsync(0)
  expect(f.helpers[1].stop).toHaveBeenCalledOnce()
  expect(f.server.postMessage).toHaveBeenCalledWith({ type: 'shutdown' })
  expect(f.server.kill).not.toHaveBeenCalled()
})
it.runIf(process.platform === 'win32')('returns to a normal window after a crash without overwriting the desired wallpaper preference', async () => {
  const f = await desktop(); vi.useFakeTimers()
  f.helpers[0].failed = true; f.helpers[0].emit('failure', new Error('native attachment failed'))
  await vi.advanceTimersByTimeAsync(2000)
  expect(f.windows).toHaveLength(2); expect(f.windows[1].visible).toBe(true)
  expect(f.helpers).toHaveLength(1)
  expect(await f.status()).toMatchObject({ mode: 'window', desiredMode: 'wallpaper' })
  expect(JSON.parse(await readFile(join(f.directory, 'desktop-mode.json'), 'utf8'))).toEqual({ mode: 'wallpaper' })
  expect(f.app.quit).not.toHaveBeenCalled()
  expect(f.electron.dialog.showErrorBox).toHaveBeenCalledOnce()
  // A subsequent real mode request still works through the existing second-instance action.
  f.app.emit('second-instance', {}, ['--wallpaper']); await vi.advanceTimersByTimeAsync(0)
  expect(await f.status()).toMatchObject({ mode: 'wallpaper', desiredMode: 'wallpaper' })
})
it.runIf(process.platform === 'win32')('restores a normal parent before showing the same renderer window', async () => {
  const f = await desktop()
  expect(f.app.commandLine.appendSwitch).toHaveBeenCalledWith('disable-direct-composition')
  expect(f.windows[0].shownWithoutFocus).toBe(true)
  const restoreNative = vi.spyOn(f.helpers[0], 'setMode')
  const restoreWindow = vi.spyOn(f.windows[0], 'restore')
  f.app.emit('second-instance', {}, ['--windowed'])
  await vi.waitFor(() => expect(f.helpers[0].mode).toBe('window'))
  expect(f.windows).toHaveLength(1); expect(f.windows[0].visible).toBe(true)
  expect(await f.status()).toMatchObject({ mode: 'window', desiredMode: 'window', attachment: 'verified', native: { Parent: 0, Child: false } })
  f.app.emit('second-instance', {}, ['--windowed'])
  await vi.waitFor(() => expect(restoreNative).toHaveBeenCalledTimes(2))
  expect(restoreWindow).toHaveBeenCalledTimes(2)
})

function beginLogin(f) {
  const state='safe-state-for-desktop-login', url=new URL('https://accounts.spotify.com/authorize')
  url.search=new URLSearchParams({state,client_id:'test-client',response_type:'code',redirect_uri:'http://127.0.0.1:4173/callback',code_challenge_method:'S256',code_challenge:'a'.repeat(43)}).toString()
  f.windows[0].webContents.emit('will-navigate',{preventDefault:vi.fn()},url.toString())
  return {state,url:url.toString()}
}
it.runIf(process.platform === 'win32')('keeps wallpaper mode and its saved preference throughout Spotify sign-in and callback',async()=>{
  const f=await desktop(), login=beginLogin(f)
  await vi.waitFor(()=>expect(f.electron.shell.openExternal).toHaveBeenCalledWith(login.url))
  expect(f.helpers[0].mode).toBe('wallpaper')
  f.server.emit('message',{type:'oauth-callback',query:new URLSearchParams({state:login.state,code:'fixture-code'}).toString()})
  await vi.waitFor(()=>expect(f.windows[0].loadURL).toHaveBeenCalledTimes(2))
  await Promise.resolve()
  expect(f.helpers[0].mode).toBe('wallpaper')
  expect(JSON.parse(await readFile(join(f.directory,'desktop-mode.json'),'utf8'))).toEqual({mode:'wallpaper'})
  expect(f.windows).toHaveLength(1)
})
it.runIf(process.platform === 'win32')('respects a deliberate normal-mode request during Spotify login instead of forcing wallpaper',async()=>{
  const f=await desktop(), login=beginLogin(f)
  await vi.waitFor(()=>expect(f.electron.shell.openExternal).toHaveBeenCalledWith(login.url))
  f.app.emit('second-instance',{},['--windowed'])
  await vi.waitFor(async()=>expect(await f.status()).toMatchObject({mode:'window',changingMode:false}))
  f.server.emit('message',{type:'oauth-callback',query:new URLSearchParams({state:login.state,error:'access_denied'}).toString()})
  await vi.waitFor(()=>expect(f.windows[0].loadURL).toHaveBeenCalledTimes(2))
  expect(f.helpers[0].mode).toBe('window')
  expect(JSON.parse(await readFile(join(f.directory,'desktop-mode.json'),'utf8'))).toEqual({mode:'window'})
})

it.runIf(process.platform === 'win32')('recovers a native child close instead of treating Explorer closure as a user quit', async () => {
  const f = await desktop(); vi.useFakeTimers()
  const preventDefault = vi.fn()
  f.windows[0].emit('close', { preventDefault })
  expect(preventDefault).toHaveBeenCalledOnce(); expect(f.app.quit).not.toHaveBeenCalled()
  await vi.advanceTimersByTimeAsync(2000)
  expect(f.windows).toHaveLength(2)
  expect(await f.status()).toMatchObject({ mode: 'wallpaper', desiredMode: 'wallpaper' })
})

it.runIf(process.platform === 'win32')('restores Chromium visibility before attaching a minimized window', async () => {
  const f = await desktop()
  f.app.emit('second-instance', {}, ['--windowed'])
  await vi.waitFor(async () => expect(await f.status()).toMatchObject({ mode: 'window', changingMode: false }))
  let minimized = true
  const order = []
  vi.spyOn(f.windows[0], 'restore').mockImplementation(() => { minimized = false; order.push('restore') })
  const attach = f.helpers[0].setMode.bind(f.helpers[0])
  vi.spyOn(f.helpers[0], 'setMode').mockImplementation(async mode => {
    expect(minimized).toBe(false); order.push('native'); await attach(mode)
  })
  f.app.emit('second-instance', {}, ['--wallpaper'])
  await vi.waitFor(async () => expect(await f.status()).toMatchObject({ mode: 'wallpaper', changingMode: false }))
  expect(order).toEqual(['restore', 'native'])
  expect(f.windows).toHaveLength(1)
})
