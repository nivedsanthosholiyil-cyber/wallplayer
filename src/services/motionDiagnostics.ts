export function motionDiagnostic(subsystem: 'background' | 'parallax' | 'video', phase: 'mount' | 'cleanup' | 'start' | 'stop' | 'play-rejected') {
  // The development probe owns the opt-in flag. No production logging or IPC.
  if (document.documentElement.hasAttribute('data-motion-diagnostics'))
    window.dispatchEvent(new CustomEvent('musicwall:motion-lifecycle', { detail: { subsystem, phase } }))
}
