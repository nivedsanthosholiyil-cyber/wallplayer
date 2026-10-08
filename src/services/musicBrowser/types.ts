import type { Track } from '../../types/music'

export type MediaType = 'album' | 'playlist' | 'artist'

export interface MediaItem {
  id: string
  type: MediaType
  title: string
  subtitle: string
  artwork: string
  description?: string
  trackIds: string[]
}

export interface DiscoverySection {
  id: string
  title: string
  items: MediaItem[]
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
