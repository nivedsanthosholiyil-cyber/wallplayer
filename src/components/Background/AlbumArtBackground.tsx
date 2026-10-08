import { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

interface AlbumArtBackgroundProps {
  imageUrl: string | null
  trackId: string | null
  visible: boolean
  motionIntensity?: number
  onReady: () => void
  onError: () => void
}

// The shared background compositor owns loading, crossfades, and cinematic overlays.
// This image layer never reads the playback clock or restarts on pause/resume.
export function AlbumArtBackground({ imageUrl, trackId, visible, motionIntensity = 50, onReady, onError }: AlbumArtBackgroundProps) {
  const reducedMotion = useReducedMotion()
  const mounted = useRef(true)
  const [started, setStarted] = useState(false)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  useEffect(() => { if (visible) setStarted(true) }, [visible])
  const amount = Math.max(0, Math.min(1, motionIntensity / 50))
  const still = reducedMotion || !started || amount === 0
  return <motion.img
    key={`${trackId ?? 'default'}:${imageUrl}`}
    className="video-background__media video-background__image album-art-background"
    src={imageUrl || '/images/afterglow-night.png'} alt="" draggable={false}
    style={{ objectFit: 'cover', objectPosition: 'center' }}
    initial={{ scale: 1, x: '0%' }}
    animate={still ? { scale: 1, x: '0%' } : { scale: [1.008, 1 + .04 * amount], x: ['0%', `${-.25 * amount}%`] }}
    transition={{ duration: still ? 0 : 90, ease: 'easeInOut', repeat: still ? 0 : Infinity, repeatType: 'reverse' }}
    onLoad={(event) => {
      const image = event.currentTarget
      // A downloaded image may still need decoding before it can be painted.
      if (!image.decode) { onReady(); return }
      void image.decode().then(() => { if (mounted.current) onReady() }).catch(() => { if (mounted.current) onError() })
    }}
    onError={onError}
  />
}
