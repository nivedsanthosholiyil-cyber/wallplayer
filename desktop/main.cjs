const { app, BrowserWindow, dialog, Menu, shell, utilityProcess, session, Tray, nativeImage } = require('electron')
const { join } = require('node:path')
const { appendFileSync, readFileSync, writeFileSync, unlinkSync } = require('node:fs')
const { spawn } = require('node:child_process')
const { waitForReady, stopServer } = require('./lifecycle.cjs')

app.setName('MusicWall')
app.setAppUserModelId('com.musicwall.desktop')
let window, child, tray, wallpaperHost, wallpaperStateFile, quitting = false, shutdownComplete = false, started = false
let wallpaperActive = false, requestedWindow = false
let policy, pendingLogin = null

function log(message) {
  try { appendFileSync(join(app.getPath('userData'), 'desktop.log'), `${new Date().toISOString()} ${message}\n`) } catch { /* A log failure must not block shutdown. */ }
}
function fail(message) {
  if (quitting) return
  log(message)
  dialog.showErrorBox('MusicWall could not continue', message)
  app.quit()
}
function updateTrayMenu() {
  if (!tray) return
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: wallpaperActive ? 'Open MusicWall window' : 'Set as desktop wallpaper', click: () => wallpaperActive ? showNormalWindow() : startWallpaperHost() },
    { type: 'separator' },
    { label: 'Quit MusicWall', click: () => app.quit() },
  ]))
}
function createTray() {
  if (tray || process.platform !== 'win32') return
  const iconPath = join(app.getAppPath(), 'dist-desktop', 'artwork', 'afterglow.svg')
  let icon = nativeImage.createFromPath(iconPath)
  if (icon.isEmpty()) icon = nativeImage.createFromPath(join(app.getAppPath(), 'dist-desktop', 'images', 'afterglow-night.png'))
  tray = new Tray(icon)
  tray.setToolTip('MusicWall')
  updateTrayMenu()
}
function showNormalWindow() {
  if (!window || window.isDestroyed()) return
  if (!wallpaperActive || !wallpaperHost || wallpaperHost.killed) {
    wallpaperActive = false
    window.show()
    window.focus()
    updateTrayMenu()
    return
  }
  requestedWindow = true
  try { writeFileSync(wallpaperStateFile, 'window', 'utf8') }
  catch (error) {
    requestedWindow = false
    log(`Could not request window mode: ${error.message}`)
    dialog.showErrorBox('MusicWall', 'Could not switch out of desktop wallpaper mode.')
  }
}
function startWallpaperHost() {
  if (process.platform !== 'win32' || !window || window.isDestroyed() || wallpaperActive) return
  try {
    const scriptSource = readFileSync(join(__dirname, 'wallpaper-host.ps1'), 'utf8')
    const scriptPath = join(app.getPath('userData'), 'wallpaper-host.ps1')
    wallpaperStateFile = join(app.getPath('userData'), 'wallpaper-host.state')
    writeFileSync(scriptPath, scriptSource, 'utf8')
    try { unlinkSync(wallpaperStateFile) } catch {}
    writeFileSync(wallpaperStateFile, 'wallpaper', 'utf8')
    const handle = window.getNativeWindowHandle().readBigUInt64LE(0).toString(16)
    wallpaperHost = spawn('powershell.exe', [
      '-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
      '-File', scriptPath, '-WindowHandle', handle, '-StateFile', wallpaperStateFile,
    ], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] })
    let stderr = ''
    wallpaperHost.stderr.on('data', (chunk) => { if (stderr.length < 4000) stderr += chunk.toString() })
    wallpaperHost.once('error', (error) => {
      wallpaperActive = false
      log(`Wallpaper host failed to start: ${error.message}`)
      updateTrayMenu()
      if (!quitting) dialog.showErrorBox('MusicWall wallpaper mode', 'Could not start the Windows desktop host. MusicWall will remain a normal window.')
    })
    wallpaperHost.once('close', (code) => {
      if (quitting) return
      log(`Wallpaper host exited (${code})${stderr.trim() ? `: ${stderr.trim()}` : ''}`)
      wallpaperActive = false
      wallpaperHost = null
      if (requestedWindow) {
        requestedWindow = false
        if (window && !window.isDestroyed()) { window.show(); window.focus() }
      } else if (code !== 0 && code !== null) {
        if (window && !window.isDestroyed()) { window.show(); window.focus() }
        dialog.showErrorBox('MusicWall wallpaper mode', 'The Windows desktop host stopped unexpectedly. MusicWall has returned to its normal window.')
      }
      updateTrayMenu()
    })
    wallpaperActive = true
    updateTrayMenu()
    log('Started Windows desktop wallpaper host')
  } catch (error) {
    wallpaperActive = false
    log(`Could not configure wallpaper host: ${error.message}`)
    updateTrayMenu()
    dialog.showErrorBox('MusicWall wallpaper mode', 'Could not prepare the Windows desktop host. MusicWall will remain a normal window.')
  }
}
async function openAuthorization(url) {
  const state = policy.authorizationState(url)
  if (!state) return
  pendingLogin = { state, url }
  child.postMessage({ type: 'oauth-begin', state })
}
function externalNavigation(event, url) {
  if (policy.isAppUrl(url)) return
  event.preventDefault()
  if (!policy.isAppUrl(window.webContents.getURL())) return
  if (policy.authorizationState(url)) void openAuthorization(url)
  else if (policy.isExternalLink(url)) void shell.openExternal(url).catch(() => dialog.showErrorBox('MusicWall', 'Could not open the system browser.'))
}
async function start() {
  policy = await import('./policy.mjs')
  const origin = policy.DESKTOP_ORIGIN
  session.defaultSession.setPermissionRequestHandler((_contents, permission, callback, details) => {
    callback(permission === 'mediaKeySystem' && /^https:\/\/sdk\.scdn\.co(?:\/|$)/.test(details.requestingUrl || ''))
  })
  session.defaultSession.setPermissionCheckHandler((_contents, permission, requestingOrigin) =>
    permission === 'mediaKeySystem' && requestingOrigin === 'https://sdk.scdn.co')
  session.defaultSession.on('will-download', (event) => event.preventDefault())
  child = utilityProcess.fork(join(__dirname, 'server.cjs'), [], {
    serviceName: 'MusicWall local server', stdio: 'ignore',
    env: { ...process.env, MUSICWALL_SERVER_CONFIG: join(app.getPath('userData'), 'server.env') },
  })
  child.on('exit', () => { if (started && !quitting) fail('The MusicWall local server stopped. Close and reopen the application.') })
  child.on('message', (data) => {
    if (data?.type === 'oauth-ready' && pendingLogin?.state === data.state) {
      void shell.openExternal(pendingLogin.url).catch(() => {
        child.postMessage({ type: 'oauth-cancel' })
        pendingLogin = null
        dialog.showErrorBox('MusicWall', 'Could not open Spotify login. Try Connect Spotify again.')
      })
    }
    if (data?.type === 'oauth-callback' && pendingLogin) {
      const params = new URLSearchParams(data.query)
      if (params.get('state') !== pendingLogin.state) return
      pendingLogin = null
      void window.loadURL(`${origin}/?${params}`).catch(() => fail('Could not return to MusicWall after Spotify login.'))
      if (window.isMinimized()) window.restore()
      window.show(); window.focus()
    }
  })
  await waitForReady(child, origin)
  started = true
  log('Local server ready at ' + origin)
  window = new BrowserWindow({
    title: 'MusicWall', width: 1360, height: 900, minWidth: 760, minHeight: 600,
    backgroundColor: '#08121b', show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true, webviewTag: false },
  })
  window.webContents.on('will-navigate', externalNavigation)
  window.webContents.on('will-redirect', externalNavigation)
  window.webContents.on('will-attach-webview', (event) => event.preventDefault())
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (policy.isAppUrl(window.webContents.getURL()) && policy.isExternalLink(url)) void shell.openExternal(url).catch(() => {})
    return { action: 'deny' }
  })
  window.webContents.on('render-process-gone', () => fail('The MusicWall display process stopped. Close and reopen the application.'))
  window.on('page-title-updated', (event) => event.preventDefault())
  window.once('ready-to-show', () => {
    window.show()
    createTray()
    if (process.platform === 'win32') startWallpaperHost()
  })
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'File', submenu: [{ role: 'quit' }] },
    { label: 'Edit', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
    { label: 'View', submenu: [{ role: 'reload' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { role: 'togglefullscreen' }] },
  ]))
  await window.loadURL(origin)
  log('Window document loaded')
}
if (!app.requestSingleInstanceLock()) app.quit()
else {
  app.on('second-instance', () => {
    if (wallpaperActive) showNormalWindow()
    else if (window && !window.isDestroyed()) { if (window.isMinimized()) window.restore(); window.show(); window.focus() }
  })
  app.on('window-all-closed', () => app.quit())
  app.on('before-quit', (event) => {
    if (shutdownComplete) return
    event.preventDefault()
    if (quitting) return
    quitting = true
    pendingLogin = null
    try { if (wallpaperStateFile) writeFileSync(wallpaperStateFile, 'stop', 'utf8') } catch {}
    try { wallpaperHost?.kill() } catch {}
    void stopServer(child).finally(() => {
      log('Local server stopped')
      if (tray) { tray.destroy(); tray = null }
      shutdownComplete = true
      app.quit()
    })
  })
  app.whenReady().then(start).catch((error) => fail(error.message))
}
