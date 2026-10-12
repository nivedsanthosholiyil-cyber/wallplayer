const { ipcRenderer } = require('electron')
window.addEventListener('DOMContentLoaded', () => {
  const button = event => ['left', 'middle', 'right'][event.button] || 'left'
  let held = null
  const release = () => {
    if (!held) return
    ipcRenderer.send('musicwall:control-input', { ...held, type: 'mouseUp' })
    held = null
  }
  for (const [name, type] of [['pointerdown', 'mouseDown'], ['pointerup', 'mouseUp'], ['pointermove', 'mouseMove']]) {
    document.addEventListener(name, event => {
      if (!event.isTrusted) return
      if (name === 'pointerdown') {
        held = { x: event.clientX, y: event.clientY, button: button(event), clickCount: event.detail }
        event.target.setPointerCapture(event.pointerId)
      }
      if (held && name === 'pointermove') { held.x = event.clientX; held.y = event.clientY }
      if (name === 'pointerup') held = null
      ipcRenderer.send('musicwall:control-input', { type, x: event.clientX, y: event.clientY, button: button(event), clickCount: event.detail })
      event.preventDefault()
    })
  }
  // Native file dialogs can cancel capture before pointerup reaches this surface.
  // Release the routed button too, so later Settings clicks are not treated as drags.
  document.addEventListener('pointercancel', release)
  document.addEventListener('lostpointercapture', release)
  document.addEventListener('wheel', event => {
    if (!event.isTrusted) return
    ipcRenderer.send('musicwall:control-input', { type: 'mouseWheel', x: event.clientX, y: event.clientY, deltaX: -event.deltaX, deltaY: -event.deltaY })
    event.preventDefault()
  }, { passive: false })
})
