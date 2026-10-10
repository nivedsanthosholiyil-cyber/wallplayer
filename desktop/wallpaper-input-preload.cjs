const { ipcRenderer } = require('electron')
window.addEventListener('DOMContentLoaded', () => {
  const button = event => ['left', 'middle', 'right'][event.button] || 'left'
  for (const [name, type] of [['pointerdown', 'mouseDown'], ['pointerup', 'mouseUp'], ['pointermove', 'mouseMove']]) {
    document.addEventListener(name, event => {
      if (!event.isTrusted) return
      if (name === 'pointerdown') event.target.setPointerCapture(event.pointerId)
      ipcRenderer.send('musicwall:control-input', { type, x: event.clientX, y: event.clientY, button: button(event), clickCount: event.detail })
      event.preventDefault()
    })
  }
  document.addEventListener('wheel', event => {
    if (!event.isTrusted) return
    ipcRenderer.send('musicwall:control-input', { type: 'mouseWheel', x: event.clientX, y: event.clientY, deltaX: -event.deltaX, deltaY: -event.deltaY })
    event.preventDefault()
  }, { passive: false })
})
