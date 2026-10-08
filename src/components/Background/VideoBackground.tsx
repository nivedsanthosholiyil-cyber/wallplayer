import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import type { VisualSource } from '../../types/music'
import type { WallpaperSettings } from '../../types/interfaceSettings'

interface VideoBackgroundProps {
  visual: VisualSource
  isPlaying: boolean
  isMuted: boolean
  volume: number
  artwork?: string | null
  settings?: WallpaperSettings
}

export function VideoBackground({ visual, isPlaying, isMuted, volume, artwork, settings }: VideoBackgroundProps) {
  const reducedMotion = useReducedMotion()
  const videoRef = useRef<HTMLVideoElement>(null)
  const [inactive, setInactive] = useState(document.hidden)
  const motionAmount = (settings?.motionIntensity ?? 50) / 50
  const baseScale = 1 + .045 * motionAmount
  const peakScale = 1 + .105 * motionAmount
  const fit = settings?.position === 'fill' ? 'fill' : settings?.position === 'center' ? 'contain' : 'cover'
  const position = settings?.position === 'custom' ? `${settings.customX}% ${settings.customY}%` : 'center center'
  const temperature = settings?.colorTemperature ?? 0
  const variables = {
    '--wallpaper-brightness': `${settings?.brightness ?? 100}%`,
    '--wallpaper-contrast': `${settings?.contrast ?? 107}%`,
    '--wallpaper-saturation': `${settings?.saturation ?? 103}%`,
    '--wallpaper-blur': `${settings?.blur ?? 0}px`,
    '--wallpaper-opacity': (settings?.backgroundOpacity ?? 100) / 100,
    '--wallpaper-vignette': (settings?.vignette ?? 40) / 40,
    '--wallpaper-wash': (settings?.overlayOpacity ?? 100) / 100,
    '--wallpaper-position': position,
    '--wallpaper-size': settings?.position === 'fill' ? '100% 100%' : settings?.position === 'center' ? 'auto' : 'cover',
    '--wallpaper-fit': fit,
  } as CSSProperties

  useEffect(() => {
    const onVisibility = () => setInactive(document.hidden)
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  useEffect(() => {
    if (visual.kind !== 'video' || !videoRef.current) return
    videoRef.current.muted = isMuted
    videoRef.current.volume = volume
    videoRef.current.playbackRate = settings?.videoSpeed ?? 1
    if (isPlaying && !(settings?.pauseWhenInactive && inactive)) void videoRef.current.play().catch(() => {})
    else videoRef.current.pause()
  }, [isPlaying, isMuted, volume, visual, settings?.videoSpeed, settings?.pauseWhenInactive, inactive])

  return (
    <div className="video-background" aria-hidden="true" style={variables}>
      {visual.kind === 'video' ? (
        <video
          ref={videoRef}
          className="video-background__media"
          src={visual.src}
          poster={visual.poster}
          muted={isMuted}
          loop={settings?.loopVideo ?? true}
          playsInline
          style={{ objectPosition: position }}
        />
      ) : (
        <motion.div
          className="video-background__media video-background__image"
          style={{ backgroundImage: `url(${visual.src})` }}
          animate={reducedMotion || !isPlaying || (settings?.pauseWhenInactive && inactive) ? { scale: baseScale, x: 0 } : { scale: [baseScale, peakScale, baseScale], x: [0, -18 * motionAmount, 0] }}
          transition={{ duration: 30, ease: 'easeInOut', repeat: Infinity }}
        />
      )}
      {artwork && <div className="video-background__artwork-tint" style={{ backgroundImage: `url(${artwork})` }} />}
      <div className="video-background__temperature" style={{ background: temperature >= 0 ? `rgba(255, 164, 92, ${temperature / 100 * .36})` : `rgba(88, 155, 255, ${-temperature / 100 * .36})` }} />
      <div className="video-background__wash" />
      <div className="video-background__vignette" />
      <div className="video-background__grain" />
    </div>
  )
}
