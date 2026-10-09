import { useEffect, useState, type CSSProperties } from 'react'
import { motion } from 'framer-motion'
import { useMotionSettings } from '../../hooks/useMotionSettings'
import type { AppearanceSettings } from '../../types/interfaceSettings'
import { ThemeGlyph } from '../Settings/ThemeArtwork'

interface PlayerControlsProps {
  currentTime: number
  duration: number
  isPlaying: boolean
  isMuted: boolean
  volume: number
  isVisible: boolean
  canControl: boolean
  canControlVolume: boolean
  onTogglePlay: () => void
  onToggleMute: () => void
  onVolumeChange: (volume: number) => void
  onPrevious: () => void
  onNext: () => void
  onSeek: (time: number) => void
  appearance?: AppearanceSettings
  message?: string
}

function formatTime(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`
}

export function PlayerControls({ currentTime, duration, isPlaying, isMuted, volume, isVisible, canControl, canControlVolume, onTogglePlay, onToggleMute, onVolumeChange, onPrevious, onNext, onSeek, appearance, message }: PlayerControlsProps) {
  const movement = useMotionSettings()
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [dragging, setDragging] = useState(false)
  useEffect(() => {
    if (!dragging) return
    const end = () => setDragging(false)
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
    window.addEventListener('blur', end)
    return () => {
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
      window.removeEventListener('blur', end)
    }
  }, [dragging])
  const safeDuration = Number.isFinite(duration) ? Math.max(0, duration) : 0
  const position = Number.isFinite(currentTime) ? Math.max(0, Math.min(currentTime, safeDuration)) : 0
  const safeVolume = Number.isFinite(volume) ? Math.max(0, Math.min(volume, 1)) : 0
  const hidden = appearance?.playerVisibility === 'hidden'
  const visible = !hidden && (appearance?.playerVisibility === 'always' || isVisible || !isPlaying || hovered || focused || dragging || Boolean(message))
  const restOpacity = Math.max(movement.enabled ? 0 : .55, (appearance?.controlOpacity ?? 25) / 100)
  const intensity = (appearance?.playerAnimationIntensity ?? 50) / 50
  const speed = (appearance?.animationSpeed ?? 100) / 100
  const direct = appearance?.transitionStyle === 'instant'
  const dissolve = appearance?.transitionStyle === 'dissolve'
  const iconScale = (appearance?.iconSize ?? 100) / 100
  const theme = appearance?.theme ?? 'default'
  return (
    <motion.div
      className="player-controls"
      role="group"
      aria-label="Playback controls"
      data-visible={visible}
      data-hidden={hidden}
      data-playing={isPlaying}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onPointerDownCapture={(event) => { if ((event.target as HTMLElement).matches('input[type="range"]')) setDragging(true) }}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false)
      }}
      initial={false}
      animate={{ opacity: hidden ? 0 : visible ? 1 : restOpacity, y: visible || dissolve || !movement.enabled ? 0 : movement.playerRise * intensity }}
      transition={{ duration: direct ? 0 : movement.uiDuration * speed, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="player-controls__transport">
        <button className="transport-button" onClick={onPrevious} disabled={!canControl || hidden} aria-label="Previous track" title="Previous track"><ThemeGlyph theme={theme} name="previous" size={23 * iconScale} /></button>
        <button className="transport-button player-controls__play" onClick={onTogglePlay} disabled={!canControl || hidden} aria-label={isPlaying ? 'Pause' : 'Play'} title={isPlaying ? 'Pause' : 'Play'}>
          <ThemeGlyph theme={theme} name={isPlaying ? 'pause' : 'play'} size={(theme === 'batman' ? 42 : 26) * iconScale} playing={isPlaying} className="play-icon" />
        </button>
        <button className="transport-button" onClick={onNext} disabled={!canControl || hidden} aria-label="Next track" title="Next track"><ThemeGlyph theme={theme} name="next" size={23 * iconScale} /></button>
      </div>
      <div className="player-controls__timeline">
        <input
          className="player-controls__range"
          type="range"
          min="0"
          max={safeDuration || 1}
          step="0.1"
          value={position}
          onChange={(event) => onSeek(Number(event.target.value))}
          disabled={!canControl || safeDuration === 0 || hidden}
          aria-label="Seek through track"
          aria-valuetext={`${formatTime(position)} of ${formatTime(safeDuration)}`}
          style={{ '--progress': `${safeDuration ? position / safeDuration * 100 : 0}%` } as CSSProperties}
        />
        <div className="player-controls__time-row"><time>{formatTime(position)}</time><time>{formatTime(safeDuration)}</time></div>
      </div>
      <div className="player-controls__volume-group">
        <button className="transport-button player-controls__volume" onClick={onToggleMute} disabled={!canControlVolume || hidden} aria-label={isMuted ? 'Unmute' : 'Mute'} aria-pressed={isMuted} title={isMuted ? 'Unmute' : 'Mute'}>
          <ThemeGlyph theme={theme} name="volume" size={17 * iconScale} muted={isMuted} />
        </button>
        <input className="player-controls__volume-range" type="range" min="0" max="1" step="0.01" value={isMuted ? 0 : safeVolume} onChange={(event) => onVolumeChange(Number(event.target.value))} disabled={!canControlVolume || hidden} aria-label="Volume level" aria-valuetext={`${Math.round((isMuted ? 0 : safeVolume) * 100)} percent`} />
      </div>
      {message && <p className="player-controls__message" role="status">{message}</p>}
    </motion.div>
  )
}
