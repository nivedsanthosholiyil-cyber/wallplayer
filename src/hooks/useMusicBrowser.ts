import { useEffect, useState } from 'react'
import type { MediaItem, MusicSearchResults } from '../services/musicBrowser/types'
import { spotifyMusicBrowser, libraryError, type BrowserPage } from '../services/musicBrowser/spotifyBrowser'
import { spotifyAuth } from '../services/spotify/auth'
import type { Track } from '../types/music'
const emptyResults: MusicSearchResults & { hasNext: boolean } = { songs: [], artists: [], albums: [], playlists: [], hasNext: false }
export function useMusicBrowser(open: boolean, connected: boolean, query: string, selected: MediaItem | null, searchOffset: number, detailOffset: number) {
  const [results, setResults] = useState(emptyResults)
  const [detail, setDetail] = useState<BrowserPage>({ tracks: [], items: [], hasNext: false })
  const [home, setHome] = useState<{ playlists: MediaItem[]; recent: Track[]; saved: Track[] }>({ playlists: [], recent: [], saved: [] })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [homeNote, setHomeNote] = useState('')
  useEffect(() => { if (!connected) { setHome({ playlists: [], recent: [], saved: [] }); setHomeNote('') } }, [connected])
  useEffect(() => {
    if (!open || !connected) return
    const controller = new AbortController()
    const hasRecent = spotifyAuth.hasScope('user-read-recently-played')
    const hasSaved = spotifyAuth.hasScope('user-library-read')
    const hasPlaylists = spotifyAuth.hasScope('playlist-read-private')
    void Promise.allSettled([hasPlaylists ? spotifyMusicBrowser.playlists(controller.signal) : Promise.resolve([]), hasRecent ? spotifyMusicBrowser.recent(controller.signal) : Promise.resolve([]), hasSaved ? spotifyMusicBrowser.saved(controller.signal) : Promise.resolve([])]).then(([playlists, recent, saved]) => {
      if (controller.signal.aborted) return
      setHome({ playlists: playlists.status === 'fulfilled' ? playlists.value : [], recent: recent.status === 'fulfilled' ? recent.value : [], saved: saved.status === 'fulfilled' ? saved.value : [] })
      const failure = [playlists, recent, saved].find((result) => result.status === 'rejected')
      setHomeNote(failure?.status === 'rejected' ? libraryError(failure.reason) : !hasRecent || !hasSaved || !hasPlaylists ? 'Reconnect Spotify to load playlists, recently played and saved music.' : '')
    })
    return () => controller.abort()
  }, [open, connected])
  useEffect(() => {
    const controller = new AbortController()
    setError(''); setLoading(false)
    if (!open || !connected || (!query && selected?.source !== 'spotify')) { setResults(emptyResults); return () => controller.abort() }
    setLoading(true)
    if (selected?.source === 'spotify') {
      if (!detailOffset) setDetail({ tracks: [], items: [], hasNext: false })
      void spotifyMusicBrowser.detail(selected, detailOffset, controller.signal).then((value) => {
        if (!controller.signal.aborted) setDetail((previous) => detailOffset ? { tracks: [...previous.tracks, ...value.tracks], items: [...previous.items, ...value.items], hasNext: value.hasNext } : value)
      }).catch((cause) => { if (!controller.signal.aborted) setError(libraryError(cause)) }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    } else {
      setResults(emptyResults)
      void spotifyMusicBrowser.search(query, searchOffset, controller.signal).then((value) => { if (!controller.signal.aborted) setResults(value) }).catch((cause) => { if (!controller.signal.aborted) setError(libraryError(cause)) }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    }
    return () => controller.abort()
  }, [open, connected, query, selected, searchOffset, detailOffset])
  return { results, detail, home, loading, error, homeNote }
}
