import { beforeEach, expect, it } from 'vitest'
import { mockMusicBrowserProvider } from '../src/data/mockCatalog'
import { getRecentlyPlayed, recordRecentlyPlayed } from '../src/services/musicBrowser/recentlyPlayed'
import { playerStore } from '../src/store/playerStore'

beforeEach(() => localStorage.clear())

it('starts from artwork discovery and searches music by category', () => {
  const sections = mockMusicBrowserProvider.getHome([])
  expect(sections.map((section) => section.title)).toEqual(['Recently Played', 'Made For You', 'Your Playlists', 'Recommended', 'New Releases'])
  expect(sections[0].items.every((item) => item.type === 'album')).toBe(true)
  const results = mockMusicBrowserProvider.search('blue')
  expect(results.songs.map((track) => track.id)).toContain('blue-hour')
  expect(results.albums.map((item) => item.id)).toContain('album-blue-hour')
})

it('plays a selected mock track through the existing store and keeps unique recent history', () => {
  expect(playerStore.selectMockTrack('blue-hour')).toBe(true)
  expect(playerStore.getSnapshot()).toMatchObject({ source: 'mock', trackIndex: 1, currentTime: 0, isPlaying: true })
  recordRecentlyPlayed('afterglow')
  recordRecentlyPlayed('blue-hour')
  recordRecentlyPlayed('afterglow')
  expect(getRecentlyPlayed()).toEqual(['afterglow', 'blue-hour'])
  expect(mockMusicBrowserProvider.getHome(getRecentlyPlayed())[0].items.map((item) => item.id)).toEqual(['album-afterglow', 'album-blue-hour'])
  playerStore.pause()
})
