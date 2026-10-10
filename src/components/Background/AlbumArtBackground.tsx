import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useMotionSettings } from '../../hooks/useMotionSettings'

interface AlbumArtBackgroundProps {
  imageUrl: string | null
  trackId: string | null
  visible: boolean
  motionIntensity?: number
  paused?: boolean
  onReady: () => void
  onError: () => void
}

// The shared background compositor owns loading, crossfades, and cinematic overlays.
// This image layer never reads the playback clock or restarts on pause/resume.
export function AlbumArtBackground({ imageUrl, trackId, visible, motionIntensity = 50, paused = false, onReady, onError }: AlbumArtBackgroundProps) {
  const movement = useMotionSettings()
  const mounted = useRef(true)
  const [started, setStarted] = useState(false)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  useEffect(() => { if (visible) setStarted(true) }, [visible])
  const amount = Math.max(0, Math.min(1, motionIntensity / 50))
  const still = !movement.enabled || !started || amount === 0
  return <img
    key={`${trackId ?? 'default'}:${imageUrl}`}
    className="video-background__media video-background__image album-art-background"
    data-moving={!still}
    src={imageUrl || '/images/afterglow-night.png'} alt="" draggable={false}
    style={{ objectFit: 'cover', objectPosition: 'var(--album-x, 50%) calc(var(--album-y, 50%) + var(--album-idle, 0%))', '--ambient-scale': 1, '--ambient-drift': '0%', animationDuration: `${movement.backgroundDuration}s`, animationPlayState: paused ? 'paused' : 'running' } as CSSProperties}
    onLoad={(event) => {
      const image = event.currentTarget
      // A downloaded image may still need decoding before it can be painted.
      if (!image.decode) { onReady(); return }
      void image.decode().then(() => { if (mounted.current) onReady() }).catch(() => { if (mounted.current) onError() })
    }}
    onError={onError}
  />
}
