import type { Track } from '../../types/music'

export type MediaType = 'album' | 'playlist' | 'artist' | 'track'

export interface MediaItem {
  id: string
  type: MediaType
  title: string
  subtitle: string
  artwork: string
  description?: string
  trackIds: string[]
  source?: 'spotify' | 'local' | 'mock'
  uri?: string
  sourceUrl?: string
}

export interface DiscoverySection {
  id: string
  title: string
  items: MediaItem[]
  note?: string
}

export interface MusicSearchResults {
  songs: Track[]
  artists: MediaItem[]
  albums: MediaItem[]
  playlists: MediaItem[]
}

// A future Spotify catalog can implement this interface without changing the browser UI.
export interface MusicBrowserProvider {
  getHome(recentIds: string[]): DiscoverySection[]
  getItem(id: string): MediaItem | undefined
  getTracks(item: MediaItem): Track[]
  search(query: string): MusicSearchResults
}
