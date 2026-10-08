import { useEffect, useState } from 'react'
import { visualLibrary, type SavedVisual } from '../services/visuals/VisualLibrary'
export function useTrackVisual(trackId: string | null, revision: number) {
  const key = `${trackId || ''}:${revision}`
  const [lookup, setLookup] = useState<{ key: string; visual: SavedVisual | null }>({ key: '', visual: null })
  useEffect(() => {
    if (!trackId) return
    const controller = new AbortController()
    void visualLibrary.getVisual(trackId, controller.signal).then((visual) => {
      if (!controller.signal.aborted) setLookup({ key, visual })
    }).catch((error) => {
      if (controller.signal.aborted) return
      setLookup({ key, visual: null })
      if (import.meta.env.DEV) console.warn('[Visuals] Local library unavailable', error)
    })
    return () => controller.abort()
  }, [trackId, key])
  return { visual: lookup.key === key ? lookup.visual : null, loading: Boolean(trackId && lookup.key !== key) }
}
