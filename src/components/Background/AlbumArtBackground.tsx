import { useEffect, useRef } from 'react'

interface AlbumArtBackgroundProps {
  imageUrl: string | null
  trackId: string | null
  onReady: () => void
  onError: () => void
}

// The shared background compositor owns loading, crossfades, and cinematic overlays.
// This image layer never reads the playback clock or restarts on pause/resume.
export function AlbumArtBackground({ imageUrl, trackId, onReady, onError }: AlbumArtBackgroundProps) {
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  return <img
    key={`${trackId ?? 'default'}:${imageUrl}`}
    className="video-background__media video-background__image album-art-background"
    src={imageUrl || '/images/afterglow-night.png'} alt="" draggable={false}
    style={{ objectFit: 'cover', objectPosition: 'var(--album-x, 50%) var(--album-y, 50%)' }}
    onLoad={(event) => {
      const image = event.currentTarget
      // A downloaded image may still need decoding before it can be painted.
      if (!image.decode) { onReady(); return }
      void image.decode().then(() => { if (mounted.current) onReady() }).catch(() => { if (mounted.current) onError() })
    }}
    onError={onError}
  />
}
