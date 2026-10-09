import { createContext, useContext, useEffect, useLayoutEffect, useRef } from 'react'
import { animate, AnimatePresence, usePresence } from 'framer-motion'
import { useMotionSettings } from '../../hooks/useMotionSettings'
import { effectiveLyricStyle, lyricStyleVariables } from '../../data/lyricStyles'
import type { LyricsState } from '../../hooks/useLyrics'
import type { Track, TimedLyric } from '../../types/music'
import type { LyricPreferences } from '../../types/preferences'

export const dualPositionForIndex = (index: number): 'top-left' | 'bottom-right' => index % 2 === 0 ? 'top-left' : 'bottom-right'
const PlaybackMotionContext = createContext(true)

function DualLine({ line, index, preferences, immediate }: { line:TimedLyric; index:number; preferences:LyricPreferences; immediate:boolean }) {
  const isPlaying = useContext(PlaybackMotionContext)
  const movement = useMotionSettings()
  const [present, remove] = usePresence()
  const removeRef = useRef(remove); removeRef.current = remove
  const element = useRef<HTMLDivElement>(null)
  const animation = useRef<ReturnType<typeof animate> | null>(null)
  const playing = useRef(isPlaying); playing.current = isPlaying
  const style = effectiveLyricStyle(preferences, line.singer)
  const moving = movement.enabled && style.animationStyle === 'float'
  const travel = moving ? 24 * movement.intensity : 0
  const initial = useRef({ opacity: immediate || !isPlaying ? 1 : 0, filter: immediate || !isPlaying || !movement.enabled ? 'blur(0px)' : `blur(${Math.min(6, 2 + style.blur)}px)`, transform: immediate || !isPlaying ? 'none' : `translateY(${travel}px)` }).current
  useLayoutEffect(() => {
    const slot = element.current
    const text = slot?.querySelector('p')
    if (!slot || !text || typeof ResizeObserver === 'undefined') return
    const fit = () => {
      text.style.fontSize = ''
      const size = parseFloat(getComputedStyle(text).fontSize)
      if (!size || !slot.clientHeight || !slot.clientWidth) return
      let low = Math.min(12, size), high = size
      for (let step = 0; step < 10; step++) {
        const candidate = (low + high) / 2
        text.style.fontSize = `${candidate}px`
        if (text.scrollHeight <= slot.clientHeight && text.scrollWidth <= slot.clientWidth) low = candidate
        else high = candidate
      }
      text.style.fontSize = `${low}px`
    }
    const observer = new ResizeObserver(fit)
    observer.observe(slot)
    fit()
    let disposed = false
    void document.fonts?.ready.then(() => { if (!disposed) fit() })
    return () => { disposed = true; observer.disconnect() }
  }, [line.text, style.fontFamily, style.fontSize, style.fontWeight, style.letterSpacing, style.lineHeight, style.preset])
  useEffect(() => {
    if (!element.current) return
    let disposed = false
    const duration = immediate || style.animationStyle === 'none' ? 0 : movement.enabled ? (present ? .45 + .3 * movement.intensity : .18 + .12 * movement.intensity) * Math.max(.5, Math.min(1.5,style.animationSpeed / .65)) : .1
    const control = animate(element.current, { opacity: present ? 1 : 0, y: present ? 0 : -travel / 2, scale: 1, filter: present ? 'blur(0px)' : `blur(${movement.enabled ? Math.min(6, 2 + style.blur) : 0}px)` }, {duration: present && !playing.current ? 0 : duration, ease:[.22,1,.36,1]})
    animation.current = control
    if (!playing.current && !present) control.pause()
    void control.then(() => { if (!disposed && !present) removeRef.current?.() })
    return () => { disposed = true; control.stop(); animation.current = null }
  }, [present, immediate, movement.enabled, movement.intensity, style.animationStyle, style.animationSpeed, style.blur, travel, moving])
  useEffect(() => { if (isPlaying) animation.current?.play(); else animation.current?.pause() }, [isPlaying])
  return <div ref={element} className={`lyrics__dual-line lyrics--preset-${style.preset}`} data-dual-position={dualPositionForIndex(index)} data-active={present} style={{...lyricStyleVariables(style,preferences),...initial}}><p className="lyrics__current">{line.text}</p></div>
}

export function DualSplitLyrics({ track, lyricsState, preferences, isPlaying, currentTime }: {track:Track; lyricsState:LyricsState; preferences:LyricPreferences; isPlaying:boolean; currentTime?:number}) {
  const canvas = useRef<HTMLElement>(null)
  useLayoutEffect(() => {
    const stage = canvas.current
    if (!stage || typeof ResizeObserver === 'undefined') return
    const shell = stage.closest('.app-shell')
    const player = shell?.querySelector<HTMLElement>('.player-controls')
    const update = () => {
      const height = stage.clientHeight
      // The resting layout position ignores the player's transient hover animation.
      const limit = player ? player.offsetTop - 40 : height * .70
      stage.style.setProperty('--dual-lower-edge', `${Math.max(height * .42, Math.min(height * .70, limit))}px`)
    }
    const resize = new ResizeObserver(update)
    resize.observe(stage)
    if (player) resize.observe(player)
    const attributes = new MutationObserver(update)
    if (shell) attributes.observe(shell, {attributes:true, attributeFilter:['data-player-position','style']})
    update()
    return () => { resize.disconnect(); attributes.disconnect() }
  }, [])
  const { activeIndex, current } = lyricsState.main
  const observedAt = performance.now()
  const previous = useRef({track:track.id,index:activeIndex,time:currentTime,revision:0,observedAt})
  const changedIndex = previous.current.index !== activeIndex
  const timeDelta = currentTime !== undefined && previous.current.time !== undefined ? currentTime - previous.current.time : 0
  const elapsed = (observedAt - previous.current.observedAt) / 1000
  // Detect short seeks across an adjacent line without adding another playback clock.
  const discontinuity = changedIndex && Math.abs(timeDelta - (isPlaying ? elapsed : 0)) > .75
  const jump = previous.current.track !== track.id || (!isPlaying && changedIndex) || discontinuity || activeIndex >= 0 && previous.current.index >= 0 && (activeIndex < previous.current.index || activeIndex > previous.current.index + 1) || Math.abs(timeDelta) > 2.5
  const revision = previous.current.revision + Number(jump)
  previous.current = {track:track.id,index:activeIndex,time:currentTime,revision,observedAt}
  const immediate = useRef(false)
  // Remount only on seeks/track changes: skipped lyrics never enter an animation queue.
  if (jump) immediate.current = true
  else if (changedIndex) immediate.current = false
  return <section ref={canvas} className="lyrics--dual-split" style={lyricStyleVariables(effectiveLyricStyle(preferences),preferences)} aria-label="Synchronized Dual Split lyrics" data-lyric-index={activeIndex} data-dual-position={activeIndex >= 0 ? dualPositionForIndex(activeIndex) : 'gap'}>
    <PlaybackMotionContext.Provider value={isPlaying}><AnimatePresence key={`${track.id}:${revision}`} mode="wait" initial={false}>{current && <DualLine key={current.id} line={current} index={activeIndex} preferences={preferences} immediate={jump || immediate.current} />}</AnimatePresence></PlaybackMotionContext.Provider>
  </section>
}
