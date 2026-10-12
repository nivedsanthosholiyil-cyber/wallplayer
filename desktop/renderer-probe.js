// Injected by the trusted main process only in development. No URLs/content or
// keys are collected, no IPC API is exposed, and every buffer/counter is bounded.
(() => {
  window.__musicwallProbe?.dispose()
  document.documentElement.setAttribute('data-motion-diagnostics', '')
  const counts = {}, events = [], media = new Map(), cleanup = []
  let frames = 0, elapsed = 0, maximum = 0, gaps = 0, previous = 0, frame
  const push = (event, details = {}) => { events.push({ event, details }); if (events.length > 24) events.shift() }
  const listen = (target, event, fn, options) => { target.addEventListener(event, fn, options); cleanup.push(() => target.removeEventListener(event, fn, options)) }
  const count = name => { counts[name] = Math.min(1000000, (counts[name] || 0) + 1) }
  const tick = time => {
    if (previous) { const delta = time - previous; elapsed += delta; maximum = Math.max(maximum, delta); if (delta > 100) gaps++ }
    previous = time; frames++; frame = requestAnimationFrame(tick)
  }
  frame = requestAnimationFrame(tick)
  listen(window, 'pointermove', () => count('windowPointer'), { passive: true })
  listen(window, 'musicwall:wallpaper-pointer', () => count('desktopPointer'))
  listen(window, 'musicwall:motion-lifecycle', e => {
    const { phase, subsystem } = e.detail || {}
    if (['mount', 'cleanup', 'start', 'stop', 'play-rejected'].includes(phase) && ['background', 'parallax', 'video'].includes(subsystem)) push(phase, { subsystem })
  })
  listen(document, 'visibilitychange', () => push('visibility', { hidden: document.hidden }))
  listen(window, 'error', e => push('renderer-error', { name: e.error?.name ?? 'Error', stack: e.error?.stack ?? 'Unavailable' }))
  listen(window, 'unhandledrejection', e => push('unhandled-rejection', { name: e.reason?.name ?? 'Error', stack: e.reason?.stack ?? 'Unavailable' }))
  function bindMedia() {
    for (const [v, dispose] of media) if (!v.isConnected) { dispose(); media.delete(v) }
    for (const v of [...document.querySelectorAll('.video-background video')].slice(0, 4)) {
      if (media.has(v)) continue
      const handlers = []
      for (const name of ['play', 'pause', 'waiting', 'stalled', 'error', 'loadeddata', 'canplay']) {
        const handler = () => push('video-' + name, { ready: v.readyState, error: v.error?.code ?? null })
        v.addEventListener(name, handler); handlers.push(() => v.removeEventListener(name, handler))
      }
      media.set(v, () => handlers.forEach(fn => fn()))
    }
  }
  const observer = new MutationObserver(bindMedia); observer.observe(document.body, { childList: true, subtree: true }); bindMedia()
  window.__musicwallProbe = {
    sample() {
      const scene = document.querySelector('.video-background__scene'), idle = document.querySelector('.video-background__idle')
      const image = document.querySelector('.album-art-background'), style = scene && getComputedStyle(scene)
      const result = {
        hidden: document.hidden, focused: document.hasFocus(), wallpaper: document.documentElement.hasAttribute('data-wallpaper-input'),
        motion: document.querySelector('.app-shell')?.getAttribute('data-motion'), reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
        parallax: scene?.getAttribute('data-parallax'), idleEnabled: idle?.getAttribute('data-moving'),
        scene: style?.transform, inputX: style?.getPropertyValue('--album-x'), inputY: style?.getPropertyValue('--album-y'),
        objectPosition: image && getComputedStyle(image).objectPosition,
        viewport: { width: innerWidth, height: innerHeight, pixelRatio: devicePixelRatio },
        frames: { count: frames, meanMs: frames > 1 ? elapsed / (frames - 1) : 0, maxMs: maximum, gapsOver100Ms: gaps }, counts: { ...counts },
        animations: document.getAnimations().slice(0, 12).map(a => ({ time: typeof a.currentTime === 'number' ? Math.round(a.currentTime) : null, state: a.playState })),
        videos: [...document.querySelectorAll('.video-background video')].slice(0, 4).map(v => ({ time: v.currentTime, paused: v.paused, ready: v.readyState, width: v.videoWidth, height: v.videoHeight, error: v.error?.code ?? null })),
        events: events.splice(0)
      }
      frames = 0; elapsed = 0; maximum = 0; gaps = 0; previous = 0
      return result
    },
    dispose() { cancelAnimationFrame(frame); observer.disconnect(); cleanup.forEach(fn => fn()); media.forEach(fn => fn()); media.clear(); document.documentElement.removeAttribute('data-motion-diagnostics'); delete window.__musicwallProbe }
  }
  push('probe-start')
})()
