import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { motion } from 'framer-motion'
import { useMotionSettings } from '../../hooks/useMotionSettings'
import { AlbumArtBackground } from './AlbumArtBackground'
import type { VisualSource } from '../../types/music'
import type { WallpaperSettings } from '../../types/interfaceSettings'

interface VideoBackgroundProps {
  visual: VisualSource
  isPlaying: boolean
  isMuted: boolean
  volume: number
  artwork?: string | null
  settings?: WallpaperSettings
  ambient?: boolean
  hold?: boolean
  trackId?: string | null
}
interface Layer { key: string; visual: VisualSource; visible: boolean; loaded: boolean; trackId?: string | null }
const fallback: VisualSource = { kind: 'image', src: '/images/afterglow-night.png' }
const keyOf = (source: VisualSource) => `${source.kind}:${source.src}`

function BackgroundMedia({ layer, active, inactive, settings, isPlaying, isMuted, volume, ambient, trackId, onReady, onError }: {
  layer: Layer; active: boolean; inactive: boolean; settings?: WallpaperSettings; isPlaying: boolean; isMuted: boolean; volume: number; ambient: boolean; trackId?: string | null; onReady: () => void; onError: () => void
}) {
  const video = useRef<HTMLVideoElement>(null)
  const movement = useMotionSettings()
  const reducedMotion = !movement.enabled
  const motionAmount = Math.min(1, (settings?.motionIntensity ?? 50) / 50)
  const baseScale = 1
  const peakScale = 1 + (movement.backgroundScale - 1) * motionAmount
  const position = settings?.position === 'custom' ? `${settings.customX}% ${settings.customY}%` : 'center center'
  useEffect(() => {
    const media = video.current
    if (!media) return
    media.muted = ambient || isMuted
    media.volume = ambient ? 0 : volume
    media.playbackRate = settings?.videoSpeed ?? 1
    if (movement.enabled && active && (ambient || isPlaying) && !(settings?.pauseWhenInactive && inactive)) void media.play().catch(() => {})
    else media.pause()
  }, [active, isPlaying, isMuted, volume, ambient, inactive, settings?.videoSpeed, settings?.pauseWhenInactive, movement.enabled])
  useEffect(() => {
    const media = video.current
    return () => { media?.pause(); media?.removeAttribute('src'); media?.load() }
  }, [])
  return <motion.div className="video-background__layer" initial={false} animate={{ opacity: layer.visible || layer.loaded ? 1 : 0 }} transition={{ duration: movement.crossfade, ease: 'easeOut' }}>
    {layer.visual.kind === 'video' ? <video ref={video} className="video-background__media" src={layer.visual.src} poster={layer.visual.poster} autoPlay={movement.enabled} muted={ambient || isMuted} loop={ambient || (settings?.loopVideo ?? true)} playsInline preload="auto" onLoadedData={onReady} onError={onError} style={{ objectPosition: position, objectFit: ambient ? 'cover' : undefined }} />
      : ambient ? <AlbumArtBackground imageUrl={layer.visual.src} trackId={trackId ?? null} visible={layer.visible} motionIntensity={settings?.motionIntensity} onReady={onReady} onError={onError} /> : <motion.img className="video-background__media video-background__image" src={layer.visual.src} alt="" onLoad={onReady} onError={onError} style={{ objectPosition: position, objectFit: ambient ? 'cover' : undefined }} animate={reducedMotion || !(ambient || isPlaying) || (settings?.pauseWhenInactive && inactive) ? { scale: baseScale, x: 0 } : { scale: [baseScale, peakScale, baseScale], x: [0, movement.backgroundDrift * motionAmount, 0] }} transition={{ duration: movement.backgroundDuration, ease: 'easeInOut', repeat: Infinity }} />}
  </motion.div>
}

export function VideoBackground({ visual, isPlaying, isMuted, volume, artwork, settings, ambient = false, hold = false, trackId = null }: VideoBackgroundProps) {
  const movement = useMotionSettings()
  const scene = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const element = scene.current
    if (!element || !movement.enabled || settings?.motionIntensity === 0) return
    let frame = 0
    let x = 0; let y = 0
    const move = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return
      x = (event.clientX / window.innerWidth - .5) * 2 * movement.parallax
      y = (event.clientY / window.innerHeight - .5) * 2 * movement.parallax
      if (!frame) frame = requestAnimationFrame(() => { frame = 0; element.style.transform = `translate3d(${x}px, ${y}px, 0)` })
    }
    window.addEventListener('pointermove', move, { passive: true })
    return () => { window.removeEventListener('pointermove', move); cancelAnimationFrame(frame); element.style.transform = 'none' }
  }, [movement.enabled, movement.parallax, settings?.motionIntensity])
  const [inactive, setInactive] = useState(document.hidden)
  const [layers, setLayers] = useState<Layer[]>([{ key: keyOf(fallback), visual: fallback, visible: true, loaded: false }])
  const desired = useRef(keyOf(fallback))
  const cleanupTimer = useRef<number | null>(null)
  const visualKey = ambient && visual.kind === 'image' ? `${trackId ?? 'default'}:${keyOf(visual)}` : keyOf(visual)
  const temperature = settings?.colorTemperature ?? 0
  const variables = {
    '--wallpaper-brightness': `${settings?.brightness ?? 100}%`, '--wallpaper-contrast': `${settings?.contrast ?? 107}%`,
    '--wallpaper-saturation': `${settings?.saturation ?? 103}%`, '--wallpaper-blur': `${settings?.blur ?? 0}px`,
    '--wallpaper-opacity': (settings?.backgroundOpacity ?? 100) / 100,
    '--wallpaper-vignette': (settings?.vignette ?? 40) / 40, '--wallpaper-wash': (settings?.overlayOpacity ?? 100) / 100,
    '--wallpaper-fit': settings?.position === 'fill' ? 'fill' : settings?.position === 'center' ? 'contain' : 'cover',
  } as CSSProperties
  useEffect(() => {
    const onVisibility = () => setInactive(document.hidden)
    document.addEventListener('visibilitychange', onVisibility)
    return () => { document.removeEventListener('visibilitychange', onVisibility); if (cleanupTimer.current !== null) window.clearTimeout(cleanupTimer.current) }
  }, [])
  useEffect(() => {
    if (hold) return
    const key = visualKey
    desired.current = key
    if (cleanupTimer.current !== null) window.clearTimeout(cleanupTimer.current)
    setLayers((current) => {
      const existing = current.find((layer) => layer.key === key)
      if (existing?.visible) return current.filter((layer) => layer.visible)
      if (existing?.loaded) {
        cleanupTimer.current = window.setTimeout(() => setLayers((layers) => layers.filter((layer) => layer.visible || layer.key === desired.current)), movement.crossfade * 1000 + 50)
        return current.filter((layer) => layer.visible || layer.key === key).map((layer) => ({ ...layer, visible: layer.key === key })).sort((a, b) => Number(a.visible) - Number(b.visible))
      }
      // Keep the displayed frame while a new image/video loads. Discard superseded pending media.
      return [...current.filter((layer) => layer.visible), { key, visual, visible: false, loaded: false, trackId }]
    })
  }, [visualKey, hold])
  function ready(key: string) {
    if (key !== desired.current) { setLayers((current) => current.map((layer) => layer.key === key ? { ...layer, loaded: true } : layer)); return }
    // Keep the decoded old frame opaque underneath the incoming fade, avoiding a dark dip.
    setLayers((current) => current.map((layer) => ({ ...layer, loaded: layer.loaded || layer.key === key, visible: layer.key === key })).sort((a, b) => Number(a.visible) - Number(b.visible)))
    if (cleanupTimer.current !== null) window.clearTimeout(cleanupTimer.current)
    cleanupTimer.current = window.setTimeout(() => setLayers((current) => current.filter((layer) => layer.visible || layer.key === desired.current)), movement.crossfade * 1000 + 50)
  }
  function failed(key: string) {
    if (key !== desired.current || key.endsWith(keyOf(fallback))) return
    const recovery: VisualSource = artwork && !key.endsWith(keyOf({ kind: 'image', src: artwork })) ? { kind: 'image', src: artwork } : fallback
    const recoveryKey = keyOf(recovery)
    desired.current = recoveryKey
    setLayers((current) => {
      const remaining = current.filter((layer) => layer.key !== key || layer.visible)
      const existing = remaining.find((layer) => layer.key === recoveryKey)
      if (existing?.visible) return remaining.filter((layer) => layer.visible)
      return [...remaining.filter((layer) => layer.visible), { key: recoveryKey, visual: recovery, visible: false, loaded: false }]
    })
  }
  return <div className="video-background" aria-hidden="true" style={variables}>
    <div ref={scene} className="video-background__scene" data-parallax={movement.enabled}>{layers.map((layer) => <BackgroundMedia key={layer.key} layer={layer} active={layer.visible || layer.key === desired.current} inactive={inactive} settings={settings} isPlaying={isPlaying} isMuted={isMuted} volume={volume} ambient={ambient} trackId={layer.trackId} onReady={() => ready(layer.key)} onError={() => failed(layer.key)} />)}</div>
    {artwork && !ambient && <div className="video-background__artwork-tint" style={{ backgroundImage: `url(${artwork})` }} />}
    <div className="video-background__temperature" style={{ background: temperature >= 0 ? `rgba(255, 164, 92, ${temperature / 100 * .36})` : `rgba(88, 155, 255, ${-temperature / 100 * .36})` }} />
    <div className="video-background__wash" /><div className="video-background__vignette" /><div className="video-background__grain" />
  </div>
}
