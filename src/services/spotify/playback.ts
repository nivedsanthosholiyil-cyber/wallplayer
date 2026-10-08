import type { NormalizedPlayback, Track } from '../../types/music'
import { spotifyClient } from './client'

interface SpotifyRawPlayback {
  is_playing: boolean
  progress_ms: number | null
  item: {
    type: string
    id: string | null
    name: string
    duration_ms: number
    artists?: { id: string | null; name: string }[]
    album?: { name: string; images: { url: string; width: number | null }[] }
  } | null
  device?: {
    id: string | null
    is_restricted: boolean
    supports_volume: boolean
    volume_percent: number | null
  } | null
}

export function normalizePlayback(raw: SpotifyRawPlayback | null): NormalizedPlayback | null {
  if (!raw?.item || raw.item.type !== 'track' || !raw.item.id) return null
  const item = raw.item
  const trackId = item.id
  const artwork = item.album?.images?.slice().sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0]?.url ?? null
  return {
    trackId: trackId!,
    title: item.name,
    artists: item.artists?.map(({ id, name }) => ({ id, name })) ?? [],
    album: item.album?.name ?? '',
    artwork,
    duration: Math.max(0, item.duration_ms / 1000),
    position: Math.max(0, Math.min((raw.progress_ms ?? 0) / 1000, item.duration_ms / 1000)),
    isPlaying: raw.is_playing,
    deviceAvailable: Boolean(raw.device),
    deviceId: raw.device?.id ?? null,
    deviceRestricted: raw.device?.is_restricted ?? false,
    supportsVolume: raw.device?.supports_volume ?? false,
    volume: raw.device?.volume_percent == null ? null : raw.device.volume_percent / 100,
  }
}

export function toMusicWallTrack(playback: NormalizedPlayback): Track {
  return {
    id: playback.trackId,
    title: playback.title,
    artist: playback.artists.map((artist) => artist.name).join(', '),
    artists: playback.artists,
    album: playback.album,
    artwork: playback.artwork,
    duration: playback.duration,
    // Keep the established scene. Artwork subtly colors it without creating an album panel.
    visual: { kind: 'image', src: '/images/afterglow-night.png' },
    singers: [
      { id: 'artist-a', name: playback.artists[0]?.name ?? 'ARTIST A' },
      { id: 'artist-b', name: playback.artists[1]?.name ?? 'ARTIST B' },
    ],
    // A lyrics provider is a later phase. Never assign unrelated mock lyrics to a Spotify track.
    lyrics: [],
  }
}

export interface SpotifyPlaybackResult {
  playback: NormalizedPlayback | null
  reason: 'track' | 'no-device' | 'no-track' | 'unsupported'
}

export const spotifyPlayback = {
  async getCurrent(signal?: AbortSignal): Promise<SpotifyPlaybackResult> {
    const raw = await spotifyClient.request<SpotifyRawPlayback>('/me/player', { signal })
    if (!raw) return { playback: null, reason: 'no-device' }
    if (!raw.item) return { playback: null, reason: raw.device ? 'no-track' : 'no-device' }
    const playback = normalizePlayback(raw)
    return playback ? { playback, reason: 'track' } : { playback: null, reason: 'unsupported' }
  },
  play: () => spotifyClient.command('/me/player/play', 'PUT'),
  pause: () => spotifyClient.command('/me/player/pause', 'PUT'),
  previous: () => spotifyClient.command('/me/player/previous', 'POST'),
  next: () => spotifyClient.command('/me/player/next', 'POST'),
  seek(seconds: number) {
    return spotifyClient.command(`/me/player/seek?position_ms=${Math.max(0, Math.round(seconds * 1000))}`, 'PUT')
  },
  setVolume(volume: number) {
    return spotifyClient.command(`/me/player/volume?volume_percent=${Math.round(Math.min(1, Math.max(0, volume)) * 100)}`, 'PUT')
  },
}
