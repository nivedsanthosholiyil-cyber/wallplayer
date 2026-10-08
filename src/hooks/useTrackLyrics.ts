import { useEffect, useState } from 'react'
import type { Track } from '../types/music'
import { lyricsService } from '../services/lyrics/LyricsService'
import { playerStore } from '../store/playerStore'

export function useTrackLyrics(track: Track | null, enabled: boolean) {
  const key = enabled && track ? `${track.id}|${track.title}|${track.artist}|${track.duration}` : ''
  const [lookup, setLookup] = useState({ key: '', status: 'idle' })
  useEffect(() => {
    if (!key || !track) return
    let disposed = false
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 12000)
    setLookup({ key, status: 'loading' })
    if (import.meta.env.DEV) console.debug('[Lyrics]', { trackLookup: `${track.artist} — ${track.title}`, loading: true })
    void lyricsService.getLyrics(track, controller.signal).then((result) => {
      if (disposed || controller.signal.aborted) return
      playerStore.setSpotifyLyrics(track.id, result?.synced ? result.lines.map((line, index) => ({ id: `${track.id}-${index}`, start: line.startMs! / 1000, end: line.endMs! / 1000, text: line.text, singer: 'artist-a' as const })) : [], result && !result.synced ? result.lines.map((line) => line.text) : [])
      setLookup({ key, status: result ? 'ready' : 'unavailable' })
      if (import.meta.env.DEV) console.debug('[Lyrics]', { trackLookup: track.title, loading: false, synced: result?.synced ?? false, lineCount: result?.lines.length ?? 0 })
    }).catch((error: unknown) => {
      if (disposed) return
      setLookup({ key, status: 'unavailable' })
      if (import.meta.env.DEV) console.warn('[Lyrics] Lookup failed', error)
    }).finally(() => window.clearTimeout(timeout))
    return () => { disposed = true; window.clearTimeout(timeout); controller.abort() }
    // Only track identity/metadata changes trigger lookup, never the playback position.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return key && lookup.key !== key ? 'loading' : lookup.status
}
