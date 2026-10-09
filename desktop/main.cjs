const { app, BrowserWindow, dialog, Menu, shell, utilityProcess, session, Tray, nativeImage } = require('electron')
const { join } = require('node:path')
const { appendFileSync, readFileSync, writeFileSync } = require('node:fs')
const { waitForReady, stopServer } = require('./lifecycle.cjs')
const { WallpaperController } = require('./wallpaper-controller.cjs')

app.setName('MusicWall')
app.setAppUserModelId('com.musicwall.desktop')
let window, child, tray, host, policy, pendingLogin = null
let quitting = false, shutdownComplete = false, started = false, changingMode = false
let mode = 'window', desiredMode = 'window', lastStatus = '', recoveryTimer
let recoveries = [], recoveringWindow = false
function log(message) {
  try { appendFileSync(join(app.getPath('userData'), 'desktop.log'), `${new Date().toISOString()} ${message}\n`) } catch {}
}
function fail(message) {
  if (quitting) return
  log(message); dialog.showErrorBox('MusicWall could not continue', message); app.quit()
}
function saveMode() {
  try { writeFileSync(join(app.getPath('userData'), 'desktop-mode.json'), JSON.stringify({ mode })) } catch (error) { log('Could not save desktop mode: ' + error.message) }
}
function initialMode() {
  if (process.platform !== 'win32' || process.argv.includes('--windowed')) return 'window'
  if (process.argv.includes('--wallpaper')) return 'wallpaper'
  try { if (JSON.parse(readFileSync(join(app.getPath('userData'), 'desktop-mode.json'), 'utf8')).mode === 'window') return 'window' } catch {}
  return 'wallpaper'
}
function updateTrayMenu() {
  const busy = changingMode || quitting
  if (tray) tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open MusicWall window', enabled: !busy, click: () => void changeMode('window') },
    { label: 'Set as desktop wallpaper', enabled: !busy && mode !== 'wallpaper', click: () => void changeMode('wallpaper') },
    { type: 'separator' }, { label: 'Quit MusicWall', click: () => app.quit() },
  ]))
}
function createTray() {
  if (tray || process.platform !== 'win32') return
  const image = nativeImage.createFromPath(join(app.getAppPath(), 'dist-desktop', 'images', 'afterglow-night.png')).resize({ width: 24, height: 24 })
  if (image.isEmpty()) throw new Error('MusicWall tray artwork is missing')
  tray = new Tray(image); tray.setToolTip('MusicWall')
  tray.on('double-click', () => void changeMode('window'))
  updateTrayMenu()
}
function presentNormalWindow() {
  if (!window || window.isDestroyed()) return
  window.setMinimumSize(760, 600); window.setMenuBarVisibility(true)
  if (window.isMinimized()) window.restore()
  window.show(); window.focus()
}
async function hostFailure(error, failedHost) {
  if (quitting || failedHost !== host || failedHost.handlingFailure) return
  failedHost.handlingFailure = true
  log('Wallpaper host failure: ' + error.message)
  await failedHost.stop(); if (host !== failedHost || quitting) return
  host = null; mode = 'window'; desiredMode = 'window'; updateTrayMenu()
  // If a helper was force-killed, its HWND may still be a desktop child. Recreate
  // our own window rather than showing a potentially stranded child as a popup.
  if (window && !window.isDestroyed()) window.destroy()
  scheduleWindowRecovery()
  dialog.showErrorBox('MusicWall wallpaper mode', `${error.message}\nMusicWall will reopen in normal-window mode. Reconnect Spotify if necessary.`)
}
async function changeMode(next) {
  if (quitting || changingMode || !window || window.isDestroyed()) return
  if (next === 'wallpaper' && process.platform !== 'win32') return
  if (next === mode && (next === 'window' || host)) { if (next === 'window') presentNormalWindow(); return }
  changingMode = true; desiredMode = next; updateTrayMenu()
  try {
    if (next === 'wallpaper') {
      createTray(); window.setMinimumSize(0, 0); window.setMenuBarVisibility(false)
    }
    if (!host && next === 'wallpaper') {
      const handle = window.getNativeWindowHandle()
      const controller = new WallpaperController({ source: __dirname,
        runtime: join(app.getPath('userData'), 'wallpaper-runtime'),
        handle: (handle.length === 8 ? handle.readBigUInt64LE() : BigInt(handle.readUInt32LE())).toString(16) })
      host = controller
      controller.on('status', status => {
        const text = JSON.stringify(status)
        if (text !== lastStatus) { lastStatus = text; log('Wallpaper verified: ' + text) }
      })
      controller.on('failure', error => void hostFailure(error, controller))
      controller.on('window-lost', scheduleWindowRecovery)
      controller.on('recovering', () => { if (lastStatus !== 'recovering') { lastStatus = 'recovering'; log('Waiting for Explorer desktop recovery') } })
      await controller.start('wallpaper')
    } else if (host) await host.setMode(next)
    if (quitting) return
    mode = next; saveMode()
    if (next === 'window') presentNormalWindow()
    log('Desktop mode: ' + mode)
  } catch (error) {
    const failedHost = host
    if (failedHost) await hostFailure(error, failedHost)
    else { mode = 'window'; desiredMode = 'window'; presentNormalWindow(); log(error.message) }
  } finally { changingMode = false; updateTrayMenu() }
}
function scheduleWindowRecovery() {
  if (quitting || recoveryTimer || recoveringWindow) return
  log('Desktop host/window lost; waiting for Explorer before recovery')
  recoveryTimer = setTimeout(async () => {
    recoveryTimer = null
    if (quitting) return
    recoveries = recoveries.filter(time => Date.now() - time < 60000)
    if (recoveries.length >= 3) { fail('The Windows desktop repeatedly destroyed the MusicWall window. Restart Explorer before reopening MusicWall.'); return }
    recoveries.push(Date.now())
    recoveringWindow = true
    try {
      const previous = host; host = null; await previous?.stop()
      mode = 'window'; changingMode = false
      if (previous?.windowLost && window && !window.isDestroyed()) window.destroy()
      if (!window || window.isDestroyed()) await createWindow()
      else await changeMode(desiredMode)
    } catch (error) { fail('Could not recover the MusicWall window: ' + error.message) }
    finally { recoveringWindow = false }
  }, 2000)
}
async function openAuthorization(url) {
  const state = policy.authorizationState(url)
  if (!state) return
  // Keep the same WebContents/sessionStorage verifier when returning from wallpaper.
  if (mode === 'wallpaper') await changeMode('window')
  pendingLogin = { state, url }; child.postMessage({ type: 'oauth-begin', state })
}
function externalNavigation(event, url) {
  if (policy.isAppUrl(url)) return
  event.preventDefault()
  if (!policy.isAppUrl(window.webContents.getURL())) return
  if (policy.authorizationState(url)) void openAuthorization(url)
  else if (policy.isExternalLink(url)) void shell.openExternal(url).catch(() => dialog.showErrorBox('MusicWall', 'Could not open the system browser.'))
}
async function createWindow() {
  window = new BrowserWindow({
    title: 'MusicWall', width: 1360, height: 900, minWidth: 760, minHeight: 600,
    backgroundColor: '#08121b', show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true,
      webviewTag: false, backgroundThrottling: false },
  })
  window.webContents.on('will-navigate', externalNavigation)
  window.webContents.on('will-redirect', externalNavigation)
  window.webContents.on('will-attach-webview', event => event.preventDefault())
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (policy.isAppUrl(window.webContents.getURL()) && policy.isExternalLink(url)) void shell.openExternal(url).catch(() => {})
    return { action: 'deny' }
  })
  window.webContents.on('render-process-gone', () => fail('The MusicWall display process stopped. Close and reopen the application.'))
  window.on('page-title-updated', event => event.preventDefault())
  window.on('close', event => { if (!quitting) { event.preventDefault(); app.quit() } })
  window.on('closed', () => { window = null; if (!quitting) scheduleWindowRecovery() })
  window.once('ready-to-show', () => {
    try { createTray() } catch (error) { log(error.message); desiredMode = 'window' }
    if (desiredMode === 'wallpaper') void changeMode('wallpaper')
    else presentNormalWindow()
  })
  await window.loadURL(policy.DESKTOP_ORIGIN); log('Window document loaded')
}
async function start() {
  policy = await import('./policy.mjs'); desiredMode = initialMode()
  session.defaultSession.setPermissionRequestHandler((_contents, permission, callback, details) => {
    callback(permission === 'mediaKeySystem' && /^https:\/\/sdk\.scdn\.co(?:\/|$)/.test(details.requestingUrl || ''))
  })
  session.defaultSession.setPermissionCheckHandler((_contents, permission, requestingOrigin) =>
    permission === 'mediaKeySystem' && requestingOrigin === 'https://sdk.scdn.co')
  session.defaultSession.on('will-download', event => event.preventDefault())
  child = utilityProcess.fork(join(__dirname, 'server.cjs'), [], {
    serviceName: 'MusicWall local server', stdio: 'ignore',
    env: { ...process.env, MUSICWALL_SERVER_CONFIG: join(app.getPath('userData'), 'server.env') },
  })
  child.on('exit', () => { if (started && !quitting) fail('The MusicWall local server stopped. Close and reopen the application.') })
  child.on('message', data => {
    if (data?.type === 'oauth-ready' && pendingLogin?.state === data.state) {
      void shell.openExternal(pendingLogin.url).catch(() => {
        child.postMessage({ type: 'oauth-cancel' }); pendingLogin = null
        dialog.showErrorBox('MusicWall', 'Could not open Spotify login. Try Connect Spotify again.')
      })
    }
    if (data?.type === 'oauth-callback' && pendingLogin) {
      const params = new URLSearchParams(data.query)
      if (params.get('state') !== pendingLogin.state) return
      pendingLogin = null
      void (async () => {
        await changeMode('window')
        await window.loadURL(`${policy.DESKTOP_ORIGIN}/?${params}`)
        presentNormalWindow()
      })().catch(() => fail('Could not return to MusicWall after Spotify login.'))
    }
  })
  await waitForReady(child, policy.DESKTOP_ORIGIN); started = true
  log('Local server ready at ' + policy.DESKTOP_ORIGIN)
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'File', submenu: [
      { label: 'Open MusicWall window', accelerator: 'Ctrl+Alt+O', click: () => void changeMode('window') },
      { label: 'Set as desktop wallpaper', accelerator: 'Ctrl+Alt+W', click: () => void changeMode('wallpaper') },
      { type: 'separator' }, { role: 'quit' },
    ] },
    { label: 'Edit', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
    { label: 'View', submenu: [{ role: 'reload' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }] },
  ]))
  await createWindow()
}
if (!app.requestSingleInstanceLock()) app.quit()
else {
  app.on('second-instance', (_event, argv) => void changeMode(argv.includes('--wallpaper') ? 'wallpaper' : 'window'))
  app.on('window-all-closed', () => { if (!quitting && !recoveryTimer && !recoveringWindow) app.quit() })
  app.on('before-quit', event => {
    if (shutdownComplete) return
    event.preventDefault(); if (quitting) return
    quitting = true; pendingLogin = null; clearTimeout(recoveryTimer)
    void (async () => {
      const result = await host?.stop()
      log(!result || result.exited ? 'Wallpaper helper stopped' : 'Wallpaper helper termination could not be confirmed')
      await stopServer(child); log('Local server stopped')
      tray?.destroy(); tray = null; shutdownComplete = true; app.quit()
    })().catch(error => { log('Shutdown error: ' + error.message); shutdownComplete = true; app.quit() })
  })
  app.whenReady().then(start).catch(error => fail(error.message))
}
