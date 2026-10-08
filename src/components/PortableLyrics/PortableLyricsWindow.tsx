import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import type { Track } from '../../types/music'
import type { LyricsState } from '../../hooks/useLyrics'
import type { LyricPreferences } from '../../types/preferences'
import { LyricsDisplay } from '../Lyrics/LyricsDisplay'

interface PortableLyricsWindowProps {
  track: Track
  lyricsState: LyricsState
  preferences: LyricPreferences
}

interface DragState {
  pointerId: number
  startX: number
  startY: number
  originX: number
  originY: number
}

interface ResizeState {
  pointerId: number
  startX: number
  startY: number
  originWidth: number
  originHeight: number
}

export function PortableLyricsWindow({ track, lyricsState, preferences }: PortableLyricsWindowProps) {
  const [position, setPosition] = useState(() => ({
    x: window.innerWidth > preferences.portableWidth + 80 ? 42 : 12,
    y: Math.max(16, Math.round((window.innerHeight - 260) / 2)),
  }))
  const [size, setSize] = useState({ width: preferences.portableWidth, height: 250 })
  const drag = useRef<DragState | null>(null)
  const resize = useRef<ResizeState | null>(null)

  useEffect(() => {
    setSize((current) => ({ ...current, width: preferences.portableWidth }))
  }, [preferences.portableWidth])

  useEffect(() => {
    const keepInView = () => setPosition((current) => ({
      x: Math.min(Math.max(12, current.x), Math.max(12, window.innerWidth - Math.min(size.width, window.innerWidth - 24) - 12)),
      y: Math.min(Math.max(12, current.y), Math.max(12, window.innerHeight - Math.min(size.height, window.innerHeight - 24) - 12)),
    }))
    keepInView()
    window.addEventListener('resize', keepInView)
    window.visualViewport?.addEventListener('resize', keepInView)
    const observer = new ResizeObserver(keepInView)
    observer.observe(document.documentElement)
    return () => {
      window.removeEventListener('resize', keepInView)
      window.visualViewport?.removeEventListener('resize', keepInView)
      observer.disconnect()
    }
  }, [size.height, size.width])

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return
    drag.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, originX: position.x, originY: position.y }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const active = drag.current
    if (!active || active.pointerId !== event.pointerId) return
    setPosition({
      x: Math.min(Math.max(12, active.originX + event.clientX - active.startX), Math.max(12, window.innerWidth - Math.min(size.width, window.innerWidth - 24) - 12)),
      y: Math.min(Math.max(12, active.originY + event.clientY - active.startY), Math.max(12, window.innerHeight - Math.min(size.height, window.innerHeight - 24) - 12)),
    })
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    if (drag.current?.pointerId !== event.pointerId) return
    drag.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }

  function onResizePointerDown(event: PointerEvent<HTMLDivElement>) {
    event.stopPropagation()
    resize.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, originWidth: size.width, originHeight: size.height }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function onResizePointerMove(event: PointerEvent<HTMLDivElement>) {
    const active = resize.current
    if (!active || active.pointerId !== event.pointerId) return
    event.stopPropagation()
    setSize({
      width: Math.min(Math.max(280, active.originWidth + event.clientX - active.startX), Math.max(280, window.innerWidth - position.x - 12)),
      height: Math.min(Math.max(180, active.originHeight + event.clientY - active.startY), Math.max(180, window.innerHeight - position.y - 12)),
    })
  }

  function onResizePointerUp(event: PointerEvent<HTMLDivElement>) {
    if (resize.current?.pointerId !== event.pointerId) return
    event.stopPropagation()
    resize.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }

  const style = {
    '--widget-opacity': preferences.portableOpacity,
    left: `min(${position.x}px, max(12px, calc(100vw - min(${size.width}px, 100vw - 24px) - 12px)))`,
    top: `min(${position.y}px, max(12px, calc(100vh - min(${size.height}px, 100vh - 24px) - var(--portable-bottom-clearance))))`,
    width: size.width,
    height: size.height,
  } as CSSProperties

  return (
    <div
      className="portable-widget portable-widget--inline"
      style={style}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      aria-label="Portable lyrics window"
    >
      <LyricsDisplay track={track} lyricsState={lyricsState} preferences={preferences} layout={preferences.portableLayout} compact />
      <div className="portable-widget__resize" onPointerDown={onResizePointerDown} onPointerMove={onResizePointerMove} onPointerUp={onResizePointerUp} onPointerCancel={onResizePointerUp} aria-hidden="true" />
    </div>
  )
}
