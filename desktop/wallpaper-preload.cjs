const { ipcRenderer, contextBridge } = require('electron')
// Narrow credential API; no paths, generic IPC, filesystem or shell access.
contextBridge.exposeInMainWorld('musicwallSpotifySession', {
  read: () => ipcRenderer.invoke('musicwall:spotify-session:read'),
  write: record => ipcRenderer.invoke('musicwall:spotify-session:write', record),
  clear: () => ipcRenderer.invoke('musicwall:spotify-session:clear'),
})
// Report the existing UI's visible hit areas.
window.addEventListener('DOMContentLoaded', () => {
  let active = false, previous = '', timer, lastPointer = null
  const replayPointer = () => {
    if (active && lastPointer) window.dispatchEvent(new window.CustomEvent('musicwall:wallpaper-pointer', { detail: { ...lastPointer } }))
  }
  const titles = new Map()
  const clearDisplaySelection = () => {
    if (!active) return
    const selection = window.getSelection()
    if (!selection || selection.isCollapsed) return
    const anchor = selection.anchorNode?.parentElement
    if (anchor?.closest('input,textarea,[contenteditable="true"]')) return
    const display = document.querySelectorAll('.app-main,.player-controls,.app-brand,.video-background')
    for (let index = 0; index < selection.rangeCount; index++) {
      const range = selection.getRangeAt(index)
      if ([...display].some(element => range.intersectsNode(element))) {
        selection.removeAllRanges()
        return
      }
    }
  }
  const suppressTooltips = () => {
    // Native Chromium title popups cannot follow the below-icons window correctly.
    // Keep accessible names; restore ordinary title tooltips in normal window mode.
    for (const el of document.querySelectorAll('[title]')) {
      titles.set(el, el.getAttribute('title')); el.removeAttribute('title')
    }
  }
  const report = () => {
    if (!active) return
    suppressTooltips()
    const panel = '.settings-panel,.music-browser,[role="dialog"]'
    const scrim = '.settings-layer__scrim,.music-browser__scrim,.visual-panel-scrim'
    const selector = `${panel},button,input,select,textarea,[role="slider"],a[href]`
    const regions = [...document.querySelectorAll(selector)].filter(el => !el.closest(scrim))
      .filter(el => !el.parentElement?.closest(panel))
      .filter(el => { const s = getComputedStyle(el); return s.display !== 'none' && s.visibility !== 'hidden' && s.pointerEvents !== 'none' })
      .map(el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height } })
      .filter(r => r.width > 0 && r.height > 0 && r.x < innerWidth && r.y < innerHeight).slice(0, 256)
    const text = JSON.stringify(regions)
    if (text !== previous) { previous = text; ipcRenderer.send('musicwall:control-regions', regions) }
  }
  ipcRenderer.on('musicwall:wallpaper-input', (_event, value) => {
    active = value === true; clearInterval(timer); previous = ''
    if (!active) lastPointer = null
    // Keep the existing player's controls reachable over an otherwise passive desktop.
    document.documentElement.toggleAttribute('data-wallpaper-input', active)
    if (!active) { for (const [el, title] of titles) if (el.isConnected && !el.hasAttribute('title')) el.setAttribute('title', title); titles.clear() }
    if (active) { clearDisplaySelection(); report(); timer = setInterval(report, 150) }
  })
  ipcRenderer.on('musicwall:wallpaper-pointer', (_event, point) => {
    if (!active || !point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return
    lastPointer = { x: point.x, y: point.y, inside: point.inside === true }
    replayPointer()
  })
  window.addEventListener('musicwall:request-wallpaper-pointer', replayPointer)
  document.addEventListener('selectionchange', clearDisplaySelection)
  window.addEventListener('resize', report)
  window.addEventListener('beforeunload', () => clearInterval(timer))
})
