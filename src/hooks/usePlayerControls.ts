import { useCallback, useEffect, useRef, useState } from 'react'

export function usePlayerControls(onTogglePlay: () => void, settingsOpen: boolean, autoHide = true) {
  const [isVisible, setIsVisible] = useState(false)
  const idleTimer = useRef<number | null>(null)

  const revealControls = useCallback(() => {
    setIsVisible(true)
    if (idleTimer.current !== null) window.clearTimeout(idleTimer.current)
    if (autoHide) idleTimer.current = window.setTimeout(() => setIsVisible(false), 2600)
  }, [autoHide])

  useEffect(() => () => {
    if (idleTimer.current !== null) window.clearTimeout(idleTimer.current)
  }, [])

  useEffect(() => {
    if (idleTimer.current !== null) window.clearTimeout(idleTimer.current)
    idleTimer.current = null
    setIsVisible(!autoHide)
  }, [autoHide])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (settingsOpen || event.code !== 'Space' || event.repeat) return
      const target = event.target as HTMLElement
      if (['BUTTON', 'INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
      event.preventDefault()
      revealControls()
      onTogglePlay()
    }
    function onPointerMove(event: PointerEvent) {
      if (event.clientY >= window.innerHeight - Math.min(220, window.innerHeight * 0.3)) revealControls()
    }
    function onPointerDown(event: PointerEvent) {
      if (event.clientY >= window.innerHeight - Math.min(220, window.innerHeight * 0.3)) revealControls()
    }
    function onWallpaperPointer(event: Event) {
      const point = (event as CustomEvent<{ x: number; y: number; inside: boolean }>).detail
      if (point.inside && point.y >= window.innerHeight - Math.min(220, window.innerHeight * 0.3)) revealControls()
    }
    function onFocus(event: FocusEvent) {
      if ((event.target as HTMLElement).closest('.player-controls')) revealControls()
    }
    window.addEventListener('pointermove', onPointerMove, { passive: true })
    window.addEventListener('pointerdown', onPointerDown, { passive: true })
    window.addEventListener('musicwall:wallpaper-pointer', onWallpaperPointer)
    window.addEventListener('focusin', onFocus)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('musicwall:wallpaper-pointer', onWallpaperPointer)
      window.removeEventListener('focusin', onFocus)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [onTogglePlay, revealControls, settingsOpen])

  return autoHide ? isVisible : true
}
