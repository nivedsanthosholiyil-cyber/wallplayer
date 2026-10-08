import { useState, type CSSProperties } from 'react'
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
}

function formatTime(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`
}

export function PlayerControls({ currentTime, duration, isPlaying, isMuted, volume, isVisible, canControl, canControlVolume, onTogglePlay, onToggleMute, onVolumeChange, onPrevious, onNext, onSeek, appearance }: PlayerControlsProps) {
  const movement = useMotionSettings()
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const hidden = appearance?.playerVisibility === 'hidden'
  const visible = !hidden && (appearance?.playerVisibility === 'always' || isVisible || !isPlaying || hovered || focused)
  const restOpacity = (appearance?.controlOpacity ?? 25) / 100
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
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false)
      }}
      initial={false}
      animate={{ opacity: hidden ? 0 : visible ? 1 : restOpacity, y: visible || dissolve ? 0 : movement.playerRise * intensity, filter: visible || direct || !movement.enabled ? 'blur(0px)' : `blur(${1.5 * intensity}px)` }}
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
          max={duration}
          step="0.1"
          value={Math.min(currentTime, duration)}
          onChange={(event) => onSeek(Number(event.target.value))}
          disabled={!canControl || duration === 0 || hidden}
          aria-label="Seek through track"
          style={{ '--progress': `${duration ? currentTime / duration * 100 : 0}%` } as CSSProperties}
        />
        <div className="player-controls__time-row"><time>{formatTime(currentTime)}</time><time>{formatTime(duration)}</time></div>
      </div>
      <div className="player-controls__volume-group">
        <button className="transport-button player-controls__volume" onClick={onToggleMute} disabled={!canControlVolume || hidden} aria-label={isMuted ? 'Unmute' : 'Mute'} aria-pressed={!isMuted} title={isMuted ? 'Unmute' : 'Mute'}>
          <ThemeGlyph theme={theme} name="volume" size={17 * iconScale} muted={isMuted} />
        </button>
        <input className="player-controls__volume-range" type="range" min="0" max="1" step="0.01" value={isMuted ? 0 : volume} onChange={(event) => onVolumeChange(Number(event.target.value))} disabled={!canControlVolume || hidden} aria-label="Volume level" />
      </div>
    </motion.div>
  )
}
