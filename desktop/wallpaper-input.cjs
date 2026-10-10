const { join } = require('node:path')

// Only the two owned windows can use this bridge. The renderer cannot request
// paths, commands, HWNDs, or input into any other application.
class WallpaperInput {
  constructor({ target, BrowserWindow, ipcMain, isAppUrl, screen }) {
    this.target = target; this.ipcMain = ipcMain; this.active = false; this.rects = []; this.routedEvents = 0; this.routedKeys = 0; this.pointerSamples = 0
    this.screen = screen
    this.surface = new BrowserWindow({ title: 'MusicWall controls', width: 1, height: 1,
      frame: false, transparent: true, backgroundColor: '#00000000', show: false,
      skipTaskbar: true, hasShadow: false, resizable: false,
      webPreferences: { preload: join(__dirname, 'wallpaper-input-preload.cjs'), contextIsolation: true,
        nodeIntegration: false, sandbox: true, webSecurity: true, backgroundThrottling: false },
    })
    this.surface.setMenu(null)
    this.surface.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
    this.surface.webContents.on('will-navigate', event => event.preventDefault())
    this.surface.webContents.on('will-attach-webview', event => event.preventDefault())
    this.shapes = (event, payload) => {
      if (event.sender !== target.webContents || event.senderFrame !== target.webContents.mainFrame || !isAppUrl(event.senderFrame.url)) return
      if (!Array.isArray(payload) || payload.length > 256) return
      const bounds = target.getContentBounds()
      const rects = payload.filter(r => r && ['x', 'y', 'width', 'height'].every(k => Number.isFinite(r[k])))
        .map(r => {
          const x = Math.max(0, Math.floor(r.x)), y = Math.max(0, Math.floor(r.y))
          return { x, y, width: Math.max(0, Math.min(bounds.width - x, Math.ceil(r.width))), height: Math.max(0, Math.min(bounds.height - y, Math.ceil(r.height))) }
        }).filter(r => r.width > 0 && r.height > 0)
      this.rects = rects; this.refresh()
    }
    this.input = (event, packet) => {
      if (!this.active || event.sender !== this.surface.webContents || event.senderFrame !== this.surface.webContents.mainFrame || !packet) return
      const { width, height } = target.getContentBounds()
      if (!Number.isFinite(packet.x) || !Number.isFinite(packet.y)) return
      const outside = packet.x < 0 || packet.y < 0 || packet.x >= width || packet.y >= height
      if (outside && !this.dragging) return
      const validPoint = this.rects.some(r => packet.x >= r.x && packet.y >= r.y && packet.x < r.x + r.width && packet.y < r.y + r.height)
      // Continue a drag beyond the starting region until release.
      if (!validPoint && !this.dragging) return
      const buttons = ['left', 'middle', 'right']
      let input
      if (['mouseDown', 'mouseUp', 'mouseMove'].includes(packet.type) && buttons.includes(packet.button)) {
        input = { type: packet.type, x: Math.max(0, Math.min(width - 1, Math.round(packet.x))), y: Math.max(0, Math.min(height - 1, Math.round(packet.y))), button: packet.button, clickCount: packet.clickCount === 2 ? 2 : 1 }
        if (packet.type === 'mouseDown') { this.dragging = true; this.dragButton = packet.button }
        if (packet.type === 'mouseMove' && this.dragging) input.modifiers = [`${this.dragButton}ButtonDown`]
        if (packet.type === 'mouseUp') this.dragging = false
      } else if (packet.type === 'mouseWheel' && Number.isFinite(packet.deltaY) && Number.isFinite(packet.deltaX)) {
        input = { type: 'mouseWheel', x: Math.round(packet.x), y: Math.round(packet.y), deltaX: Math.max(-1000, Math.min(1000, packet.deltaX)), deltaY: Math.max(-1000, Math.min(1000, packet.deltaY)), canScroll: true }
      }
      if (!input || target.isDestroyed()) return
      if (['mouseMove', 'mouseDown'].includes(input.type)) this.controlHovered = true
      const needsFocus = input.type !== 'mouseMove' || this.dragging
      if (needsFocus) target.webContents.focus()
      target.webContents.sendInputEvent(input); this.routedEvents++
      // The renderer needs focus for its existing DOM controls, but native keys
      // must keep arriving at the above-icons input surface. Leaving focus on
      // the below-icons renderer breaks typing after an otherwise valid click.
      if (input.type === 'mouseDown') this.surface.focus()
      if (needsFocus) this.surface.webContents.focus()
    }
    this.key = (event, input) => {
      if (!this.active || target.isDestroyed() || !['keyDown', 'keyUp'].includes(input.type)) return
      // This is Electron's native event, not a renderer-provided keyboard packet.
      event.preventDefault(); target.webContents.focus()
      const modifiers = ['shift', 'control', 'alt', 'meta'].filter(k => input[k])
      target.webContents.sendInputEvent({ type: input.type, keyCode: input.key, modifiers })
      if (input.type === 'keyDown' && input.key.length === 1 && !input.control && !input.alt && !input.meta)
        target.webContents.sendInputEvent({ type: 'char', keyCode: input.key, modifiers })
      this.routedKeys++
      this.surface.webContents.focus()
    }
    ipcMain.on('musicwall:control-regions', this.shapes)
    ipcMain.on('musicwall:control-input', this.input)
    this.surface.webContents.on('before-input-event', this.key)
    // A reload creates a new preload/DOM. Re-send mode and cursor state rather
    // than waiting for another native mode switch to reactivate the renderer.
    this.loaded = () => this.setActive(this.active)
    target.webContents.on('did-finish-load', this.loaded)
    this.ready = this.surface.loadFile(join(__dirname, 'wallpaper-input.html'))
  }
  get handle() { const h = this.surface.getNativeWindowHandle(); return (h.length === 8 ? h.readBigUInt64LE() : BigInt(h.readUInt32LE())).toString(16) }
  get status() { return { active: this.active, regionCount: this.rects.length, routedEvents: this.routedEvents, routedKeys: this.routedKeys, pointerSamples: this.pointerSamples } }
  setActive(active) {
    this.active = active; this.dragging = false
    this.controlHovered = false
    clearInterval(this.pointerTimer); this.lastPointer = null
    this.target.webContents.send('musicwall:wallpaper-input', active)
    // Passive cursor samples restore parallax/idle UI under Explorer's icon layer.
    // No global hooks, extra hit regions, focus stealing, clicks or coordinate logs.
    if (active && this.screen) {
      this.pollPointer()
      this.pointerTimer = setInterval(() => this.pollPointer(), 50)
      this.pointerTimer.unref?.()
    }
    this.refresh()
  }
  pollPointer() {
    if (!this.active || this.target.isDestroyed() || this.dragging) return
    const cursor = this.screen.getCursorScreenPoint(), bounds = this.target.getContentBounds()
    const x = Math.round(cursor.x - bounds.x), y = Math.round(cursor.y - bounds.y)
    const geometry = `${bounds.x}:${bounds.y}:${bounds.width}:${bounds.height}`
    if (this.lastPointer?.x === x && this.lastPointer?.y === y && this.lastPointer.geometry === geometry) return
    this.lastPointer = { x, y, geometry }; this.pointerSamples++
    if (this.controlHovered && !this.rects.some(r => x >= r.x && y >= r.y && x < r.x + r.width && y < r.y + r.height)) {
      this.target.webContents.sendInputEvent({ type: 'mouseLeave', x, y })
      this.controlHovered = false
    }
    this.target.webContents.send('musicwall:wallpaper-pointer', { x, y, inside: x >= 0 && y >= 0 && x < bounds.width && y < bounds.height })
  }
  refresh() {
    if (this.surface.isDestroyed()) return
    if (!this.active || !this.rects.length || this.target.isDestroyed()) { this.surface.hide(); return }
    this.surface.setBounds(this.target.getContentBounds())
    this.surface.setShape(this.rects)
    if (!this.surface.isVisible()) this.surface.showInactive()
  }
  destroy() {
    this.active = false
    clearInterval(this.pointerTimer)
    this.ipcMain.removeListener('musicwall:control-regions', this.shapes)
    this.ipcMain.removeListener('musicwall:control-input', this.input)
    this.target.webContents.removeListener('did-finish-load', this.loaded)
    if (!this.surface.isDestroyed()) this.surface.destroy()
  }
}
module.exports = { WallpaperInput }
