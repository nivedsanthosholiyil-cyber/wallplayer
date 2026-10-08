import type { Track } from '../../types/music'
import type { MediaItem } from './types'
export interface LocalPlaylist { id: string; name: string; trackIds: string[] }
export interface RecentTrack { source: 'spotify' | 'local' | 'mock'; track: Track }
const PLAYLISTS = 'musicwall.local-playlists.v1'
const RECENT = 'musicwall.browser-recent.v1'
function read<T>(key: string): T[] { try { const data: unknown = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(data) ? data : [] } catch { return [] } }
export function getLocalPlaylists() { return read<LocalPlaylist>(PLAYLISTS).filter((item) => typeof item.id === 'string' && typeof item.name === 'string' && Array.isArray(item.trackIds)) }
export function saveLocalPlaylists(playlists: LocalPlaylist[]) { localStorage.setItem(PLAYLISTS, JSON.stringify(playlists)) }
export function localPlaylistItem(playlist: LocalPlaylist, tracks: Track[]): MediaItem { return { id: playlist.id, type: 'playlist', title: playlist.name, subtitle: `${playlist.trackIds.filter((id) => tracks.some((track) => track.id === id)).length} local tracks`, artwork: tracks.find((track) => playlist.trackIds.includes(track.id))?.artwork || '/artwork/local-music.svg', trackIds: playlist.trackIds, source: 'local' } }
export function getBrowserRecent() { return read<RecentTrack>(RECENT).filter((item) => ['spotify','local','mock'].includes(item.source) && item.track && typeof item.track.id === 'string').slice(0, 12) }
export function recordBrowserRecent(track: Track, source: RecentTrack['source']) {
  const { audioSrc: _audioSrc, lyrics: _lyrics, plainLyrics: _plainLyrics, ...metadata } = track
  const next = [{ source, track: { ...metadata, lyrics: [] } }, ...getBrowserRecent().filter((entry) => entry.track.id !== track.id || entry.source !== source)].slice(0, 12)
  try { localStorage.setItem(RECENT, JSON.stringify(next)) } catch { /* Browser history remains optional. */ }
}
