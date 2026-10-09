const { app, BrowserWindow, dialog, Menu, shell, utilityProcess, session } = require('electron')
const { join } = require('node:path')
const { appendFileSync } = require('node:fs')
const { waitForReady, stopServer } = require('./lifecycle.cjs')

app.setName('MusicWall')
app.setAppUserModelId('com.musicwall.desktop')
let window, child, quitting = false, shutdownComplete = false, started = false
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
  // No preload, Node bridge, remote module, or unrestricted IPC is exposed.
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
      // The same WebContents retains the PKCE verifier in sessionStorage.
      // Use /, so this internal load does not re-enter the external /callback route.
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
  window.once('ready-to-show', () => window.show())
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
  app.on('second-instance', () => { if (window && !window.isDestroyed()) { if (window.isMinimized()) window.restore(); window.show(); window.focus() } })
  app.on('window-all-closed', () => app.quit())
  app.on('before-quit', (event) => {
    if (shutdownComplete) return
    event.preventDefault()
    if (quitting) return
    quitting = true
    pendingLogin = null
    void stopServer(child).finally(() => { log('Local server stopped'); shutdownComplete = true; app.quit() })
  })
  app.whenReady().then(start).catch((error) => fail(error.message))
}
