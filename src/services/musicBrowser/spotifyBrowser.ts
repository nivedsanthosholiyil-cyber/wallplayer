import { spotifyClient, SpotifyApiError } from '../spotify/client'
import { spotifyAuth } from '../spotify/auth'
import { spotifyPlayback, toMusicWallTrack } from '../spotify/playback'
import { playerStore } from '../../store/playerStore'
import type { Track } from '../../types/music'
import type { MediaItem, MusicSearchResults } from './types'

type Raw = { id?: string; type?: string; name?: string; uri?: string; duration_ms?: number; is_local?: boolean; is_playable?: boolean; images?: { url: string }[]; artists?: Raw[]; album?: Raw; owner?: { display_name?: string }; external_urls?: { spotify?: string }; description?: string }
type Page<T> = { items?: T[]; next?: string | null; total?: number }
export interface BrowserPage { tracks: Track[]; items: MediaItem[]; hasNext: boolean }
const artwork = (raw?: Raw) => raw?.images?.[0]?.url || '/artwork/local-music.svg'
export function normalizeLibraryTrack(raw: Raw, album?: Raw): Track | null {
  if (!raw.id || raw.type && raw.type !== 'track' || raw.is_local || raw.is_playable === false) return null
  const cover = raw.album || album
  const artists = raw.artists || []
  return { id: raw.id, title: raw.name || 'Untitled', artist: artists.map((artist) => artist.name).join(', ') || 'Unknown artist', artists: artists.map((artist) => ({ id: artist.id || null, name: artist.name || '' })), album: cover?.name, artwork: artwork(cover), duration: (raw.duration_ms || 0) / 1000, visual: { kind: 'image', src: '/images/afterglow-night.png' }, singers: [{ id: 'artist-a', name: artists[0]?.name || 'ARTIST A' }, { id: 'artist-b', name: artists[1]?.name || 'ARTIST B' }], lyrics: [] }
}
export function normalizeLibraryItem(raw: Raw, type: 'album' | 'artist' | 'playlist'): MediaItem | null {
  if (!raw.id) return null
  return { id: raw.id, type, title: raw.name || 'Untitled', subtitle: raw.artists?.map((artist) => artist.name).join(', ') || raw.owner?.display_name || (type === 'artist' ? 'Artist' : 'Spotify'), artwork: artwork(raw), description: raw.description?.replace(/<[^>]*>/g, ''), trackIds: [], source: 'spotify', uri: raw.uri || `spotify:${type}:${raw.id}`, sourceUrl: raw.external_urls?.spotify || `https://open.spotify.com/${type}/${raw.id}` }
}
const cache = new Map<string, { value: unknown; at: number }>()
let rateLimitUntil = 0
let recommendationsAvailable = true
spotifyAuth.subscribe(() => { cache.clear(); rateLimitUntil = 0; recommendationsAvailable = true })
async function get<T>(path: string, signal?: AbortSignal): Promise<T | null> {
  if (Date.now() < rateLimitUntil) throw new Error('Spotify is busy. Try again shortly.')
  const stored = cache.get(path)
  if (stored && Date.now() - stored.at < 60_000) return stored.value as T
  try {
    const value = await spotifyClient.request<T>(path, { signal })
    if (!signal?.aborted) { if (cache.size >= 40) cache.delete(cache.keys().next().value!); cache.set(path, { value, at: Date.now() }) }
    return value
  } catch (cause) {
    if (cause instanceof SpotifyApiError && cause.status === 429) rateLimitUntil = Date.now() + Math.max(5, cause.retryAfterSeconds) * 1000
    throw cause
  }
}
const validTracks = (raw: Raw[], album?: Raw) => raw.filter(Boolean).map((track) => normalizeLibraryTrack(track, album)).filter((track): track is Track => Boolean(track))
const validItems = (raw: Raw[], type: 'album' | 'artist' | 'playlist') => raw.filter(Boolean).map((item) => normalizeLibraryItem(item, type)).filter((item): item is MediaItem => Boolean(item))
function uniqueQueue(seed: Track, candidates: Track[]) {
  const seen = new Set([seed.id])
  return [seed, ...candidates.filter(track => {
    if (!track.id || track.audioSrc || seen.has(track.id)) return false
    seen.add(track.id); return true
  })].slice(0, 25)
}
export function libraryError(cause: unknown) {
  if (cause instanceof SpotifyApiError && cause.status === 403) return 'Spotify does not allow access to this section. Reconnect for library permissions; some playlists are restricted by Spotify.'
  if (cause instanceof SpotifyApiError && cause.status === 404) return 'No active Spotify device. Start a track in Spotify first.'
  if (cause instanceof SpotifyApiError && cause.status === 429) return 'Spotify is busy. Try again shortly.'
  return cause instanceof Error ? cause.message : 'The music library is temporarily unavailable.'
}
export const spotifyMusicBrowser = {
  async playSingle(track: Track, fallbackTracks: Track[] = []) {
    let related: Track[] = []
    try {
      if (recommendationsAvailable) {
        try {
          const data = await get<{ tracks?: Raw[] }>(`/recommendations?${new URLSearchParams({ seed_tracks: track.id, limit: '20' })}`)
          related = validTracks(data?.tracks || []).filter(item => item.id !== track.id)
        } catch (cause) {
          if (cause instanceof SpotifyApiError && [403, 404].includes(cause.status)) recommendationsAvailable = false
          else throw cause
        }
      }
      // Recommendations are unavailable to many Spotify apps. Use supported,
      // artist-filtered search instead of assuming Spotify will autoplay a lone URI.
      const artist = track.artists?.[0]?.name || track.artist
      if (!related.length && artist && artist !== 'Unknown artist') {
        for (const offset of [0, 8, 16]) {
          const data = await get<{ tracks?: Page<Raw> }>(`/search?${new URLSearchParams({ q: `artist:"${artist.replace(/["\\]/g, '')}"`, type: 'track', limit: '8', offset: String(offset) })}`)
          related.push(...validTracks(data?.tracks?.items || []))
          if (!data?.tracks?.next) break
        }
      }
    } catch (cause) {
      // A continuation lookup must not prevent the requested song from playing.
      // Surface the short queue to the caller; never log URLs or credentials.
      console.warn('[Spotify] Continuation unavailable:', cause instanceof SpotifyApiError ? cause.status : 'network or service error')
    }
    const relatedQueue = uniqueQueue(track, related)
    const queue = relatedQueue.length > 1 ? relatedQueue : uniqueQueue(track, fallbackTracks)
    await spotifyMusicBrowser.play(queue)
    return queue.length - 1
  },
  async search(query: string, offset = 0, signal?: AbortSignal): Promise<MusicSearchResults & { hasNext: boolean }> {
    const data = await get<{ tracks?: Page<Raw>; artists?: Page<Raw>; albums?: Page<Raw>; playlists?: Page<Raw> }>(`/search?${new URLSearchParams({ q: query, type: 'track,artist,album,playlist', limit: '8', offset: String(offset) })}`, signal)
    return { songs: validTracks(data?.tracks?.items || []), artists: validItems(data?.artists?.items || [], 'artist'), albums: validItems(data?.albums?.items || [], 'album'), playlists: validItems(data?.playlists?.items || [], 'playlist'), hasNext: Object.values(data || {}).some((page) => Boolean(page?.next)) }
  },
  async playlists(signal?: AbortSignal) { const data = await get<Page<Raw>>('/me/playlists?limit=12', signal); return validItems(data?.items || [], 'playlist') },
  async recent(signal?: AbortSignal) { const data = await get<Page<{ track: Raw }>>('/me/player/recently-played?limit=12', signal); return validTracks((data?.items || []).map((item) => item.track)) },
  async saved(signal?: AbortSignal) { const data = await get<Page<{ track: Raw }>>('/me/tracks?limit=12', signal); return validTracks((data?.items || []).map((item) => item.track)) },
  async detail(item: MediaItem, offset = 0, signal?: AbortSignal): Promise<BrowserPage> {
    const id = encodeURIComponent(item.id)
    if (item.type === 'artist') { const data = await get<Page<Raw>>(`/artists/${id}/albums?limit=8&offset=${offset}`, signal); return { tracks: [], items: validItems(data?.items || [], 'album'), hasNext: Boolean(data?.next) } }
    if (item.type === 'playlist') {
      const data = await get<Page<{ item?: Raw; track?: Raw }>>(`/playlists/${id}/items?limit=40&offset=${offset}`, signal)
      return { tracks: validTracks((data?.items || []).map((entry) => entry.item || entry.track).filter((track): track is Raw => Boolean(track))), items: [], hasNext: Boolean(data?.next) }
    }
    const data = await get<Page<Raw>>(`/albums/${id}/tracks?limit=40&offset=${offset}`, signal)
    return { tracks: validTracks(data?.items || [], { name: item.title, images: [{ url: item.artwork }] }), items: [], hasNext: Boolean(data?.next) }
  },
  async play(tracks: Track[], shuffle = false) {
    if (!spotifyAuth.getSnapshot().canControl) throw new Error('Reconnect Spotify with playback permission.')
    const current = await spotifyPlayback.getCurrent()
    if (!current.playback?.deviceAvailable || current.playback.deviceRestricted) throw new Error('No controllable Spotify device. Start playback in Spotify first.')
    const queue = [...tracks].slice(0, 100)
    if (shuffle) for (let i = queue.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [queue[i], queue[j]] = [queue[j], queue[i]] }
    if (!queue.length) throw new Error('There are no playable tracks in this collection.')
    await spotifyClient.command(`/me/player/play${current.playback.deviceId ? `?device_id=${encodeURIComponent(current.playback.deviceId)}` : ''}`, 'PUT', { uris: queue.map((track) => `spotify:track:${track.id}`) })
    playerStore.useSpotify()
    const playing = await spotifyPlayback.getCurrent()
    if (playing.playback) playerStore.applySpotifyPlayback(playing.playback, toMusicWallTrack(playing.playback))
  },
}
