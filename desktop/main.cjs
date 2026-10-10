const { app, BrowserWindow, dialog, Menu, shell, utilityProcess, session, Tray, nativeImage, ipcMain, safeStorage, screen } = require('electron')
const { join } = require('node:path')
const { readFileSync, writeFileSync } = require('node:fs')
const { waitForReady, stopServer } = require('./lifecycle.cjs')
const { WallpaperController } = require('./wallpaper-controller.cjs')
const { desktopStatus } = require('./desktop-status.cjs')
const { WallpaperInput } = require('./wallpaper-input.cjs')
const { SpotifySession } = require('./spotify-session.cjs')
const { Diagnostics, atomicJson, boundedLog } = require('./diagnostics.cjs')
const diagnostics = new Diagnostics({ enabled: !app.isPackaged })

// Keep the legacy internal name/data directory so the display-name change does
// not lose encrypted Spotify credentials, IndexedDB files or saved preferences.
app.setName('MusicWall')
app.setAppUserModelId('com.musicwall.desktop')
// The raised Explorer desktop cannot composite Chromium's DirectComposition
// surface reliably below its visible icon view. Select the compatible surface
// before Chromium starts; GPU acceleration remains enabled.
if (process.platform === 'win32') app.commandLine.appendSwitch('disable-direct-composition')
let window, child, tray, host, policy, wallpaperInput, spotifySession, pendingLogin = null
let quitting = false, shutdownComplete = false, started = false, changingMode = false
let mode = 'window', desiredMode = 'window', lastStatus = '', recoveryTimer
let recoveries = [], recoveringWindow = false
function log(message) {
  try { boundedLog(join(app.getPath('userData'), 'desktop.log'), message) } catch (error) { console.error('Desktop log unavailable:', error.code) }
}
function recordStatus(event, error) {
  const snapshot = desktopStatus({ event, mode, desiredMode, changingMode, quitting,
    recovering: !!recoveryTimer || recoveringWindow, host, server: child, serverReady: started, error, input: wallpaperInput?.status })
  diagnostics.record('desktop', event, snapshot, event === 'native-status' ? 5000 : 0)
  try { void atomicJson(join(app.getPath('userData'), 'desktop-status.json'), snapshot).catch(error => console.error('Desktop status unavailable:', error.code)) } catch (error) { console.error('Desktop status unavailable:', error.code) }
  log('Desktop status: ' + JSON.stringify(snapshot))
}
function fail(message) {
  if (quitting) return
  log(message); dialog.showErrorBox('Spontaneous could not continue', message); app.quit()
}
function saveMode() {
  try { writeFileSync(join(app.getPath('userData'), 'desktop-mode.json'), JSON.stringify({ mode: desiredMode })) } catch (error) { log('Could not save desktop mode: ' + error.message) }
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
    { label: 'Open Spontaneous window', enabled: !busy, click: () => void changeMode('window') },
    { label: 'Set as desktop wallpaper', enabled: !busy && mode !== 'wallpaper', click: () => void changeMode('wallpaper') },
    { type: 'separator' }, { label: 'Quit Spontaneous', click: () => app.quit() },
  ]))
}
function createTray() {
  if (tray || process.platform !== 'win32') return
  const image = nativeImage.createFromPath(join(app.getAppPath(), 'dist-desktop', 'brand', 'spontaneous.png')).resize({ width: 24, height: 24 })
  if (image.isEmpty()) throw new Error('Spontaneous tray artwork is missing')
  tray = new Tray(image); tray.setToolTip('Spontaneous')
  tray.on('double-click', () => void changeMode('window'))
  updateTrayMenu()
}
function presentNormalWindow() {
  if (!window || window.isDestroyed()) return
  window.setMinimumSize(760, 600); window.setMenuBarVisibility(true)
  window.restore()
  window.show(); window.focus()
}
async function hostFailure(error, failedHost) {
  if (quitting || failedHost !== host || failedHost.handlingFailure) return
  failedHost.handlingFailure = true
  log('Wallpaper host failure: ' + error.message); recordStatus('helper-failure', error.message)
  await failedHost.stop(); if (host !== failedHost || quitting) return
  wallpaperInput?.destroy(); wallpaperInput = null
  host = null; mode = 'window'; updateTrayMenu()
  // If a helper was force-killed, its HWND may still be a desktop child. Recreate
  // our own window rather than showing a potentially stranded child as a popup.
  scheduleWindowRecovery('window')
  if (window && !window.isDestroyed()) window.destroy()
  // A synchronous dialog would prevent the recovery timer from reopening the player.
  void dialog.showMessageBox({ type: 'error', title: 'Spontaneous wallpaper mode',
    message: `${error.message}\nSpontaneous will reopen in normal-window mode. Reconnect Spotify if necessary.` })
    .catch(error => log('Could not show wallpaper error: ' + error.message))
}
async function changeMode(next, remember = true) {
  if (quitting || changingMode || !window || window.isDestroyed()) return
  if (next === 'wallpaper' && process.platform !== 'win32') return
  diagnostics.record('desktop', 'mode-requested', { next, mode, remember })
  if (next === mode && (next === 'window' ? !host : host)) {
    if (remember) { desiredMode = next; saveMode() }
    if (next === 'window') presentNormalWindow()
    recordStatus('mode-settled'); return
  }
  changingMode = true; if (remember) desiredMode = next; updateTrayMenu()
  try {
    wallpaperInput?.setActive(false)
    if (next === 'wallpaper') {
      // Native style changes alone do not notify Chromium that a minimized
      // renderer is visible again. Restore through Electron before reparenting.
      window.restore()
      createTray(); window.setMinimumSize(0, 0); window.setMenuBarVisibility(false)
    }
    if (!host && next === 'wallpaper') {
      const handle = window.getNativeWindowHandle()
      if (!wallpaperInput) {
        wallpaperInput = new WallpaperInput({ target: window, BrowserWindow, ipcMain, isAppUrl: policy.isAppUrl, screen })
        await wallpaperInput.ready
      }
      const controller = new WallpaperController({ source: __dirname, inputHandle: wallpaperInput.handle,
        runtime: join(app.getPath('userData'), 'wallpaper-runtime'),
        handle: (handle.length === 8 ? handle.readBigUInt64LE() : BigInt(handle.readUInt32LE())).toString(16) })
      host = controller
      controller.on('status', status => {
        if (host !== controller || quitting) return
        const text = JSON.stringify(status)
        if (text !== lastStatus) { lastStatus = text; log('Wallpaper verified: ' + text) }
        recordStatus('native-status')
      })
      controller.on('failure', error => void hostFailure(error, controller))
      controller.on('window-lost', scheduleWindowRecovery)
      controller.on('recovering', () => { if (lastStatus !== 'recovering') { lastStatus = 'recovering'; log('Waiting for Explorer desktop recovery'); recordStatus('explorer-recovering') } })
      await controller.start('wallpaper')
    } else if (host) await host.setMode(next)
    if (quitting) return
    mode = next; saveMode()
    if (next === 'window') presentNormalWindow()
    else window.showInactive()
    wallpaperInput?.setActive(next === 'wallpaper')
    log('Desktop mode: ' + mode); recordStatus('mode-changed')
  } catch (error) {
    const failedHost = host
    if (failedHost) await hostFailure(error, failedHost)
    else { mode = 'window'; presentNormalWindow(); log(error.message); recordStatus('mode-error', error.message) }
  } finally { changingMode = false; updateTrayMenu(); recordStatus('mode-settled') }
}
function scheduleWindowRecovery(target) {
  // An event emitter may supply arguments; only accept a deliberate mode override.
  if (!['window', 'wallpaper'].includes(target)) target = null
  if (quitting || recoveryTimer || recoveringWindow) return
  log('Desktop host/window lost; waiting for Explorer before recovery'); recordStatus('window-recovery')
  recoveryTimer = setTimeout(async () => {
    recoveryTimer = null
    if (quitting) return
    recoveries = recoveries.filter(time => Date.now() - time < 60000)
    if (recoveries.length >= 3) { fail('The Windows desktop repeatedly destroyed the Spontaneous window. Restart Explorer before reopening Spontaneous.'); return }
    recoveries.push(Date.now())
    recoveringWindow = true
    try {
      const previous = host; host = null; await previous?.stop()
      wallpaperInput?.destroy(); wallpaperInput = null
      mode = 'window'; changingMode = false
      if (previous?.windowLost && window && !window.isDestroyed()) window.destroy()
      if (!window || window.isDestroyed()) await createWindow(target || desiredMode)
      else await changeMode(target || desiredMode, false)
    } catch (error) { fail('Could not recover the Spontaneous window: ' + error.message) }
    finally { recoveringWindow = false; recordStatus('recovery-complete') }
  }, 2000)
}
async function openAuthorization(url) {
  const state = policy.authorizationState(url)
  if (!state) return
  // The system browser handles login; keep our existing wallpaper HWND and the
  // same WebContents/sessionStorage PKCE verifier throughout authorization.
  pendingLogin = { state, url }; child.postMessage({ type: 'oauth-begin', state })
}
function externalNavigation(event, url) {
  if (policy.isAppUrl(url)) return
  event.preventDefault()
  if (!policy.isAppUrl(window.webContents.getURL())) return
  if (policy.authorizationState(url)) void openAuthorization(url)
  else if (policy.isExternalLink(url)) void shell.openExternal(url).catch(() => dialog.showErrorBox('Spontaneous', 'Could not open the system browser.'))
}
async function createWindow(presentation = desiredMode) {
  window = new BrowserWindow({
    title: 'Spontaneous', icon: join(app.getAppPath(), 'dist-desktop', 'brand', 'spontaneous.ico'), width: 1360, height: 900, minWidth: 760, minHeight: 600,
    backgroundColor: '#08121b', show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true,
      preload: join(__dirname, 'wallpaper-preload.cjs'),
      webviewTag: false, backgroundThrottling: false },
  })
  const currentWindow = window
  let sampling = false
  // Read-only, bounded rendering diagnostics. No account, URL, lyrics or cursor
  // data is recorded; successive samples distinguish a live timeline from a stall.
  if (diagnostics.enabled) {
    currentWindow.webContents.on('did-finish-load', () => {
      diagnostics.record('renderer', 'loaded')
      void currentWindow.webContents.executeJavaScript(readFileSync(join(__dirname, 'renderer-probe.js'), 'utf8'))
        .catch(error => diagnostics.record('renderer', 'probe-error', error))
    })
    for (const event of ['show', 'hide', 'focus', 'blur', 'minimize', 'restore', 'closed', 'unresponsive', 'responsive'])
      currentWindow.on(event, () => diagnostics.record('window', event))
  }
  const renderTimer = setInterval(async () => {
    if (sampling || currentWindow.isDestroyed() || quitting) return
    sampling = true
    try {
      const rendering = await currentWindow.webContents.executeJavaScript(`(() => {
        if (window.__musicwallProbe) return window.__musicwallProbe.sample();
        const scene = document.querySelector('.video-background__scene');
        const idle = document.querySelector('.video-background__idle');
        const image = document.querySelector('.album-art-background');
        return { hidden: document.hidden, wallpaper: document.documentElement.hasAttribute('data-wallpaper-input'),
          motion: document.querySelector('.app-shell')?.getAttribute('data-motion'),
          scene: scene ? getComputedStyle(scene).transform : null,
          objectPosition: image ? getComputedStyle(image).objectPosition : null,
          idle: idle ? getComputedStyle(idle).animationPlayState : null,
          animations: document.getAnimations().slice(0, 12).map(a => ({time: typeof a.currentTime === 'number' ? Math.round(a.currentTime) : null, state: a.playState})),
          videos: [...document.querySelectorAll('.video-background video')].map(v => ({time: v.currentTime, paused: v.paused, ready: v.readyState, width: v.videoWidth, height: v.videoHeight, error: v.error?.code ?? null})) };
      })()`)
      diagnostics.record('renderer', 'sample', { mode, zoom: currentWindow.webContents.getZoomFactor(), rendering })
      await atomicJson(join(app.getPath('userData'), 'renderer-status.json'), {time:new Date().toISOString(), mode, rendering})
      await diagnostics.export(join(app.getPath('userData'), 'diagnostics.json'))
    } catch (error) { diagnostics.record('renderer', 'sample-error', error, 10000); log('Renderer diagnostic unavailable: ' + error.message) }
    finally { sampling = false }
  }, diagnostics.enabled ? 5000 : 30000)
  renderTimer.unref?.()
  currentWindow.once('closed', () => clearInterval(renderTimer))
  window.webContents.on('will-navigate', externalNavigation)
  window.webContents.on('will-redirect', externalNavigation)
  window.webContents.on('will-attach-webview', event => event.preventDefault())
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (policy.isAppUrl(window.webContents.getURL()) && policy.isExternalLink(url)) void shell.openExternal(url).catch(() => {})
    return { action: 'deny' }
  })
  window.webContents.on('render-process-gone', (_event, details) => { diagnostics.record('renderer', 'process-gone', { reason: details.reason, exitCode: details.exitCode }); fail('The Spontaneous display process stopped. Close and reopen the application.') })
  window.on('page-title-updated', event => event.preventDefault())
  window.on('close', event => {
    if (quitting) return
    event.preventDefault()
    if (mode === 'wallpaper' || desiredMode === 'wallpaper' && changingMode) {
      // Explorer can close its children; that is not an application Quit action.
      scheduleWindowRecovery()
      window.destroy()
    } else app.quit()
  })
  window.on('closed', () => { window = null; if (!quitting) scheduleWindowRecovery() })
  window.once('ready-to-show', () => {
    try { createTray() } catch (error) { log(error.message); desiredMode = 'window' }
    if (presentation === 'wallpaper' && desiredMode === 'wallpaper') void changeMode('wallpaper')
    else { presentNormalWindow(); recordStatus('normal-window') }
  })
  await window.loadURL(policy.DESKTOP_ORIGIN); log('Window document loaded')
}
async function start() {
  diagnostics.record('app', 'start', { pid: process.pid })
  if (diagnostics.enabled) console.info('Spontaneous diagnostics:', app.getPath('userData'))
  app.on('child-process-gone', (_event, details) => diagnostics.record('process', 'gone', { type: details.type, reason: details.reason, exitCode: details.exitCode }))
  policy = await import('./policy.mjs'); desiredMode = initialMode()
  spotifySession = new SpotifySession({ directory: app.getPath('userData'), safeStorage, ipcMain, getWindow: () => window, isAppUrl: policy.isAppUrl })
  session.defaultSession.setPermissionRequestHandler((_contents, permission, callback, details) => {
    callback(permission === 'mediaKeySystem' && /^https:\/\/sdk\.scdn\.co(?:\/|$)/.test(details.requestingUrl || ''))
  })
  session.defaultSession.setPermissionCheckHandler((_contents, permission, requestingOrigin) =>
    permission === 'mediaKeySystem' && requestingOrigin === 'https://sdk.scdn.co')
  session.defaultSession.on('will-download', event => event.preventDefault())
  child = utilityProcess.fork(join(__dirname, 'server.cjs'), [], {
    serviceName: 'Spontaneous local server', stdio: 'ignore',
    env: { ...process.env, MUSICWALL_SERVER_CONFIG: join(app.getPath('userData'), 'server.env') },
  })
  child.on('exit', () => { const wasReady = started; started = false; recordStatus('server-exited'); if (wasReady && !quitting) fail('The Spontaneous local server stopped. Close and reopen the application.') })
  child.on('message', data => {
    if (data?.type === 'oauth-ready' && pendingLogin?.state === data.state) {
      void shell.openExternal(pendingLogin.url).catch(() => {
        child.postMessage({ type: 'oauth-cancel' }); pendingLogin = null
        dialog.showErrorBox('Spontaneous', 'Could not open Spotify login. Try Connect Spotify again.')
      })
    }
    if (data?.type === 'oauth-callback' && pendingLogin) {
      const params = new URLSearchParams(data.query)
      if (params.get('state') !== pendingLogin.state) return
      pendingLogin = null
      void (async () => {
        await window.loadURL(`${policy.DESKTOP_ORIGIN}/?${params}`)
        // Respect a deliberate tray mode change during login. Never replace the
        // wallpaper preference just because OAuth returned to the application.
        if (mode !== desiredMode) await changeMode(desiredMode, false)
        if (mode === 'window') presentNormalWindow()
        else window.showInactive()
        wallpaperInput?.setActive(mode === 'wallpaper')
      })().catch(() => fail('Could not return to Spontaneous after Spotify login.'))
    }
  })
  await waitForReady(child, policy.DESKTOP_ORIGIN); started = true
  log('Local server ready at ' + policy.DESKTOP_ORIGIN); recordStatus('server-ready')
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'File', submenu: [
      { label: 'Open Spontaneous window', accelerator: 'Ctrl+Alt+O', click: () => void changeMode('window') },
      { label: 'Set as desktop wallpaper', accelerator: 'Ctrl+Alt+W', click: () => void changeMode('wallpaper') },
      { type: 'separator' }, { role: 'quit', label: 'Quit Spontaneous' },
    ] },
    { label: 'Edit', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
    { label: 'View', submenu: [{ role: 'reload' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, ...(diagnostics.enabled ? [{ type: 'separator' }, { label: 'Export development diagnostics', click: async () => {
      const result = await dialog.showSaveDialog(window, { defaultPath: 'spontaneous-diagnostics.json', filters: [{ name: 'JSON diagnostics', extensions: ['json'] }] })
      if (!result.canceled && result.filePath) { try { await diagnostics.export(result.filePath) } catch (error) { dialog.showErrorBox('Spontaneous diagnostics', error.message) } }
    } }] : [])] },
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
      await spotifySession?.close()
      const result = await host?.stop()
      wallpaperInput?.destroy(); wallpaperInput = null
      log(!result || result.exited ? 'Wallpaper helper stopped' : 'Wallpaper helper termination could not be confirmed')
      const serverResult = await stopServer(child)
      log(serverResult.exited ? 'Local server stopped' : 'Local server termination could not be confirmed')
      recordStatus('shutdown', !serverResult.exited || (result && !result.exited) ? 'Process termination unconfirmed' : undefined)
      await diagnostics.export(join(app.getPath('userData'), 'diagnostics.json'))
      tray?.destroy(); tray = null; shutdownComplete = true; app.quit()
    })().catch(error => { log('Shutdown error: ' + error.message); shutdownComplete = true; app.quit() })
  })
  app.whenReady().then(start).catch(error => fail(error.message))
}
