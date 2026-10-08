import { mockTracks } from './mockTrack'
import type { MusicBrowserProvider, MediaItem, MusicSearchResults } from '../services/musicBrowser/types'

const art = (name: string) => `/artwork/${name}.svg`

export const mockMedia: MediaItem[] = [
  { id: 'album-afterglow', type: 'album', title: 'Afterglow', subtitle: 'The Quiet Hours', artwork: art('afterglow'), description: 'A quiet journey across the water after dark.', trackIds: ['afterglow', 'blue-hour', 'undertow'] },
  { id: 'album-blue-hour', type: 'album', title: 'Blue Hour', subtitle: 'The Quiet Hours', artwork: art('blue-hour'), description: 'Songs for the moment daylight gives way.', trackIds: ['blue-hour', 'afterglow'] },
  { id: 'album-undertow', type: 'album', title: 'Undertow', subtitle: 'The Quiet Hours', artwork: art('undertow'), description: 'Slow tides and distant constellations.', trackIds: ['undertow', 'blue-hour'] },
  { id: 'album-silverline', type: 'album', title: 'Silverline', subtitle: 'The Quiet Hours', artwork: art('silverline'), description: 'A late-night collection of reflected light.', trackIds: ['blue-hour', 'undertow', 'afterglow'] },
  { id: 'album-stillwater', type: 'album', title: 'Stillwater', subtitle: 'The Quiet Hours', artwork: art('stillwater'), description: 'Minimal songs with room to breathe.', trackIds: ['undertow', 'afterglow'] },
  { id: 'playlist-night-drive', type: 'playlist', title: 'Night Drive', subtitle: 'MusicWall', artwork: art('night-drive'), description: 'For the long way home.', trackIds: ['afterglow', 'blue-hour', 'undertow'] },
  { id: 'playlist-slow-tides', type: 'playlist', title: 'Slow Tides', subtitle: 'MusicWall', artwork: art('slow-tides'), description: 'Let the room move a little slower.', trackIds: ['undertow', 'afterglow'] },
  { id: 'playlist-moonlit', type: 'playlist', title: 'Moonlit', subtitle: 'MusicWall', artwork: art('moonlit'), description: 'Soft lights after sunset.', trackIds: ['blue-hour', 'undertow', 'afterglow'] },
  { id: 'artist-quiet-hours', type: 'artist', title: 'The Quiet Hours', subtitle: 'Artist', artwork: art('artist'), description: 'Cinematic songs for the spaces between.', trackIds: ['afterglow', 'blue-hour', 'undertow'] },
]

const item = (id: string) => mockMedia.find((media) => media.id === id)!
const tracksById = new Map(mockTracks.map((track) => [track.id, track]))

export const mockMusicBrowserProvider: MusicBrowserProvider = {
  getHome(recentIds) {
    const recentAlbums = recentIds.map((trackId) => mockMedia.find((media) => media.id === `album-${trackId}`) ?? mockMedia.find((media) => media.type === 'album' && media.trackIds.includes(trackId))).filter((media): media is MediaItem => Boolean(media))
    const uniqueRecent = [...new Map(recentAlbums.map((media) => [media.id, media])).values()]
    return [
      { id: 'recent', title: 'Recently Played', items: uniqueRecent.length ? uniqueRecent : [item('album-afterglow'), item('album-blue-hour'), item('album-undertow')] },
      { id: 'made-for-you', title: 'Made For You', items: [item('playlist-night-drive'), item('playlist-slow-tides'), item('album-stillwater'), item('playlist-moonlit')] },
      { id: 'playlists', title: 'Your Playlists', items: [item('playlist-moonlit'), item('playlist-night-drive'), item('playlist-slow-tides')] },
      { id: 'recommended', title: 'Recommended', items: [item('album-blue-hour'), item('album-silverline'), item('album-afterglow'), item('album-undertow')] },
      { id: 'new', title: 'New Releases', items: [item('album-stillwater'), item('album-silverline'), item('album-undertow')] },
    ]
  },
  getItem(id) { return mockMedia.find((media) => media.id === id) },
  getTracks(media) { return media.trackIds.map((id) => tracksById.get(id)).filter((track): track is typeof mockTracks[number] => Boolean(track)) },
  search(query): MusicSearchResults {
    const term = query.trim().toLocaleLowerCase()
    if (!term) return { songs: [], artists: [], albums: [], playlists: [] }
    const matches = (value: string) => value.toLocaleLowerCase().includes(term)
    const media = mockMedia.filter((entry) => matches(`${entry.title} ${entry.subtitle} ${entry.description ?? ''}`))
    return {
      songs: mockTracks.filter((track) => matches(`${track.title} ${track.artist} ${track.album ?? ''}`)).slice(0, 8),
      artists: media.filter((entry) => entry.type === 'artist').slice(0, 5),
      albums: media.filter((entry) => entry.type === 'album').slice(0, 8),
      playlists: media.filter((entry) => entry.type === 'playlist').slice(0, 8),
    }
  },
}
