import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { VisualSource } from '../../types/music'
import type { WallpaperSettings } from '../../types/interfaceSettings'

/** A paused frame, never another background player. Reuses the scene's CSS overlays. */
export function WallpaperSettingsPreview({ visual, settings }: { visual: VisualSource; settings: WallpaperSettings }) {
  const video = useRef<HTMLVideoElement>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    const media = video.current
    return () => { media?.pause(); media?.removeAttribute('src'); media?.load() }
  }, [])
  const temperature = settings.colorTemperature
  const variables = {
    '--wallpaper-wash': settings.overlayOpacity / 100,
    '--wallpaper-vignette': settings.vignette / 40,
  } as CSSProperties
  const mediaStyle: CSSProperties = {
    objectFit: settings.position === 'fill' ? 'fill' : settings.position === 'center' ? 'contain' : 'cover',
    objectPosition: settings.position === 'custom' ? `${settings.customX}% ${settings.customY}%` : 'center',
    opacity: settings.backgroundOpacity / 100,
    filter: `brightness(${settings.brightness}%) contrast(${settings.contrast}%) saturate(${settings.saturation}%) blur(${settings.blur}px)`,
  }
  const image = failed ? '/images/afterglow-night.png' : visual.kind === 'image' ? visual.src : visual.poster
  return <figure className="settings-preview">
    <figcaption>Wallpaper preview <span>{visual.kind === 'video' && !failed ? 'Paused frame' : 'Live adjustments'}</span></figcaption>
    <div className="settings-wallpaper-preview" style={variables} aria-label="Wallpaper preview">
      {image ? <img src={image} alt="Selected wallpaper" style={mediaStyle} onError={() => setFailed(true)} /> : <video ref={video} src={visual.src} muted playsInline preload="metadata" style={mediaStyle} onLoadedMetadata={(event) => { const media = event.currentTarget; if (Number.isFinite(media.duration) && media.duration > 0) media.currentTime = Math.min(.01, media.duration / 2) }} onError={() => setFailed(true)} />}
      <div className="video-background__temperature" style={{ background: temperature >= 0 ? `rgba(255, 164, 92, ${temperature / 100 * .36})` : `rgba(88, 155, 255, ${-temperature / 100 * .36})` }} />
      <div className="video-background__wash" /><div className="video-background__vignette" />
    </div>
  </figure>
}
