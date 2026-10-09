import { AnimatePresence, motion } from 'framer-motion'
import { useMotionSettings } from '../../hooks/useMotionSettings'
import type { Track } from '../../types/music'
import type { LyricsState, LyricWindow } from '../../hooks/useLyrics'
import type { LyricLayout, LyricPreferences, LyricStyle, PortableLayout } from '../../types/preferences'
import { effectiveLyricStyle, lyricStyleVariables } from '../../data/lyricStyles'
import { DualSplitLyrics } from './DualSplitLyrics'

interface LyricsDisplayProps {
  track: Track
  lyricsState: LyricsState
  preferences: LyricPreferences
  layout?: LyricLayout | PortableLayout
  compact?: boolean
  isPlaying?: boolean
  currentTime?: number
}

interface LyricStreamProps {
  view: LyricWindow
  trackId: string
  style: LyricStyle
  maxVisibleLines: LyricPreferences['maxVisibleLines']
  minimal: boolean
}

function LyricStream({ view, trackId, style, maxVisibleLines, minimal }: LyricStreamProps) {
  const movement = useMotionSettings()
  const reducedMotion = !movement.enabled
  const activeIndex = view.activeIndex
  const radius = minimal ? 0 : Math.floor(maxVisibleLines / 2)
  const offsets = Array.from({ length: radius * 2 + 1 }, (_, index) => index - radius)
  const animate = reducedMotion || style.animationStyle === 'none'
    ? { initial: false, exit: undefined, duration: 0 }
    : style.animationStyle === 'fade'
      ? { initial: { opacity: 0, filter: 'blur(2px)' }, exit: { opacity: 0, filter: 'blur(2px)' }, duration: style.animationSpeed }
      : { initial: { opacity: 0, y: movement.lyricY, scale: movement.lyricScale, filter: 'blur(3px)' }, exit: { opacity: 0, y: -movement.lyricY, scale: movement.lyricScale, filter: 'blur(3px)' }, duration: style.animationSpeed * (.6 + movement.intensity * .8) }

  return (
    <div className="lyrics__stage">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          className="lyrics__lines"
          key={`${trackId}-${view.current?.id ?? `gap-${view.previous?.id ?? ''}-${view.next?.id ?? ''}`}`}
          initial={animate.initial}
          animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
          exit={animate.exit}
          transition={{ duration: animate.duration, ease: [0.22, 1, 0.36, 1] }}
        >
          {offsets.map((offset) => {
            const gapAnchor = offset < 0 ? view.lines.indexOf(view.previous!) : view.lines.indexOf(view.next!)
            const line = activeIndex >= 0 ? view.lines[activeIndex + offset]
              : offset === 0 || gapAnchor < 0 ? undefined : view.lines[gapAnchor + offset + (offset < 0 ? 1 : -1)]
            const role = offset === 0 ? 'current' : 'adjacent'
            return <p key={offset} className={`lyrics__${role} ${offset < 0 ? 'lyrics__previous' : offset > 0 ? 'lyrics__next' : ''}`}>{line?.text ?? '\u00a0'}</p>
          })}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

export function LyricsDisplay({ track, lyricsState, preferences, layout, compact = false, isPlaying = true, currentTime }: LyricsDisplayProps) {
  const selectedLayout = layout ?? preferences.layout
  const mainStyle = effectiveLyricStyle(preferences)
  const styles = lyricStyleVariables(mainStyle, preferences)

  const classes = [
    'lyrics',
    `lyrics--${selectedLayout}`,
    `lyrics--preset-${mainStyle.preset}`,
    compact ? 'lyrics--compact' : '',
  ].filter(Boolean).join(' ')

  if (selectedLayout === 'duet' && !compact) return <DualSplitLyrics track={track} lyricsState={lyricsState} preferences={preferences} isPlaying={isPlaying} currentTime={currentTime} />
  // Portable duet retains its compact layout.
  if (selectedLayout === 'duet' && lyricsState.streams.every(({ view }) => view.lines.length > 0)) {
    return (
      <section className={classes} style={styles} aria-label="Synchronized duet lyrics">
        <div className="lyrics__duet">
          {lyricsState.streams.map(({ singer, view }) => {
            const voiceStyle = effectiveLyricStyle(preferences, singer.id)
            return <div className={`lyrics__voice lyrics--preset-${voiceStyle.preset}`} key={singer.id} style={lyricStyleVariables(voiceStyle, preferences)}>
              <span className="lyrics__voice-label">{singer.name}</span>
              <LyricStream view={view} trackId={`${track.id}-${singer.id}`} style={voiceStyle} maxVisibleLines={preferences.maxVisibleLines} minimal={false} />
            </div>
          })}
        </div>
      </section>
    )
  }

  return (
    <section className={classes} style={styles} aria-label="Synchronized lyrics">
      <LyricStream view={lyricsState.main} trackId={track.id} style={mainStyle} maxVisibleLines={preferences.maxVisibleLines} minimal={selectedLayout === 'minimal'} />
    </section>
  )
}
