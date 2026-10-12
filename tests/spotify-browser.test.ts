import { beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => {
  const subscribers = new Set<() => void>()
  return { request: vi.fn(), command: vi.fn(), current: vi.fn(), subscribers,
    subscribe: vi.fn((listener: () => void) => { subscribers.add(listener); return () => subscribers.delete(listener) }), snapshot: { canControl: true } }
})
vi.mock('../src/services/spotify/client', () => ({ spotifyClient: { request: mocks.request, command: mocks.command }, SpotifyApiError: class extends Error { constructor(public status: number, message: string, public retryAfterSeconds = 0) { super(message) } } }))
vi.mock('../src/services/spotify/auth', () => ({ spotifyAuth: { subscribe: mocks.subscribe, getSnapshot: () => mocks.snapshot } }))
vi.mock('../src/services/spotify/playback', async (original) => ({ ...await original<typeof import('../src/services/spotify/playback')>(), spotifyPlayback: { getCurrent: mocks.current } }))
import { normalizeLibraryTrack, spotifyMusicBrowser } from '../src/services/musicBrowser/spotifyBrowser'
import { mockTrack } from '../src/data/mockTrack'
import { playerStore } from '../src/store/playerStore'
import { SpotifyApiError } from '../src/services/spotify/client'
const raw = { id: 'track-one', type: 'track', name: 'Song', duration_ms: 200000, artists: [{ id: 'artist-one', name: 'Singer' }], album: { name: 'Album', images: [{ url: 'cover.jpg' }] } }
const currentPlayback = { trackId: raw.id, title: raw.name, artists: [{ id: 'artist-one', name: 'Singer' }], album: 'Album', artwork: 'cover', duration: 200, position: 0, isPlaying: true, deviceAvailable: true, deviceId: 'device-one', deviceRestricted: false, supportsVolume: true, volume: .7 }
beforeEach(() => { mocks.request.mockReset(); mocks.command.mockReset(); mocks.current.mockReset(); for (const subscriber of mocks.subscribers) subscriber() })
it('uses bounded search pages and filters null/restricted results', async () => {
  mocks.request.mockResolvedValue({ tracks: { items: [raw, null, { ...raw, id: null }], next: 'next' }, playlists: { items: [null, { id: 'playlist-one', name: 'Playlist' }] } })
  const results = await spotifyMusicBrowser.search('Singer & Friends')
  expect(mocks.request.mock.calls[0][0]).toContain('limit=8')
  expect(mocks.request.mock.calls[0][0]).toContain('q=Singer+%26+Friends')
  expect(results.songs).toHaveLength(1)
  expect(results.playlists[0].source).toBe('spotify')
  expect(results.hasNext).toBe(true)
  await spotifyMusicBrowser.search('Singer & Friends')
  expect(mocks.request).toHaveBeenCalledTimes(1)
})
it('supports modern playlist items and preserves album art for album track responses', async () => {
  mocks.request.mockResolvedValue({ items: [{ item: raw }, { track: raw }, { item: { ...raw, type: 'episode' } }, { item: null }] })
  const playlist = { id: 'playlist-test', type: 'playlist' as const, title: 'My Playlist', subtitle: '', artwork: 'art', trackIds: [], source: 'spotify' as const }
  expect((await spotifyMusicBrowser.detail(playlist)).tracks).toHaveLength(2)
  expect(mocks.request.mock.calls[0][0]).toContain('/items?limit=40')
  expect(normalizeLibraryTrack({ ...raw, album: undefined }, { name: 'Album', images: [{ url: 'album-art' }] })?.artwork).toBe('album-art')
})
it('paginates artist albums within Spotify search-era limits', async () => {
  mocks.request.mockResolvedValue({ items: [{ id: 'album-one', name: 'Album', artists: raw.artists }], next: 'next' })
  const artist = { id: 'artist-one', type: 'artist' as const, title: 'Singer', subtitle: '', artwork: 'art', trackIds: [], source: 'spotify' as const }
  expect((await spotifyMusicBrowser.detail(artist, 8)).items).toHaveLength(1)
  expect(mocks.request.mock.calls[0][0]).toContain('/artists/artist-one/albums?limit=8&offset=8')
})
it('plays through the existing Spotify client/store and leaves playback untouched on no-device errors', async () => {
  playerStore.useMock()
  mocks.current.mockResolvedValue({ playback: { deviceAvailable: false } })
  await expect(spotifyMusicBrowser.play([mockTrack])).rejects.toThrow('No controllable Spotify device')
  expect(mocks.command).not.toHaveBeenCalled()
  expect(playerStore.getSnapshot().source).toBe('mock')
  const playback = { trackId: raw.id, title: raw.name, artists: [{ id: 'artist-one', name: 'Singer' }], album: 'Album', artwork: 'cover', duration: 200, position: 0, isPlaying: true, deviceAvailable: true, deviceId: 'device-one', deviceRestricted: false, supportsVolume: true, volume: .7 }
  mocks.current.mockResolvedValue({ playback })
  await spotifyMusicBrowser.play([normalizeLibraryTrack(raw)!])
  expect(mocks.command).toHaveBeenCalledWith('/me/player/play?device_id=device-one','PUT',{ uris: ['spotify:track:track-one'] })
  expect(playerStore.getSnapshot()).toMatchObject({ source: 'spotify', spotifyTrack: { id: 'track-one' } })
  playerStore.useMock()
})

it('keeps the selected search song first and queues unique playable recommendations', async () => {
  mocks.current.mockResolvedValue({ playback: currentPlayback })
  mocks.request.mockResolvedValue({ tracks: [raw, { ...raw, id: 'next' }, { ...raw, id: 'next' }, { ...raw, id: 'restricted', is_playable: false }] })
  expect(await spotifyMusicBrowser.playSingle(normalizeLibraryTrack(raw)!)).toBe(1)
  expect(mocks.command).toHaveBeenCalledWith('/me/player/play?device_id=device-one', 'PUT', { uris: ['spotify:track:track-one', 'spotify:track:next'] })
  playerStore.useMock()
})

it('uses bounded artist searches when recommendations are restricted, without repeating the deprecated request', async () => {
  mocks.current.mockResolvedValue({ playback: currentPlayback })
  mocks.request.mockRejectedValueOnce(new SpotifyApiError(403, 'restricted')).mockResolvedValue({ tracks: { items: [raw, { ...raw, id: 'related' }], next: null } })
  expect(await spotifyMusicBrowser.playSingle(normalizeLibraryTrack(raw)!)).toBe(1)
  expect(new URLSearchParams(mocks.request.mock.calls[1][0].split('?')[1]).get('q')).toBe('artist:"Singer"')
  expect(mocks.command.mock.calls[0][2].uris).toEqual(['spotify:track:track-one', 'spotify:track:related'])
  await spotifyMusicBrowser.playSingle(normalizeLibraryTrack(raw)!)
  expect(mocks.request.mock.calls.filter(([path]) => path.startsWith('/recommendations'))).toHaveLength(1)
  playerStore.useMock()
})

it('still starts the requested song and available search queue if continuation is rate limited', async () => {
  mocks.current.mockResolvedValue({ playback: currentPlayback })
  mocks.request.mockRejectedValue(new SpotifyApiError(429, 'busy', 10))
  const warning = vi.spyOn(console, 'warn').mockImplementation(() => {})
  try {
    expect(await spotifyMusicBrowser.playSingle(normalizeLibraryTrack(raw)!, [normalizeLibraryTrack(raw)!, normalizeLibraryTrack({ ...raw, id: 'fallback' })!])).toBe(1)
    expect(mocks.request).toHaveBeenCalledTimes(1)
    expect(mocks.command.mock.calls[0][2].uris).toEqual(['spotify:track:track-one', 'spotify:track:fallback'])
    expect(warning).toHaveBeenCalledWith('[Spotify] Continuation unavailable:', 429)
  } finally { warning.mockRestore(); playerStore.useMock() }
})

it('uses the search queue when artist lookup returns only the selected song', async () => {
  mocks.current.mockResolvedValue({ playback: currentPlayback })
  mocks.request.mockResolvedValueOnce({ tracks: [] }).mockResolvedValue({ tracks: { items: [raw], next: null } })
  expect(await spotifyMusicBrowser.playSingle(normalizeLibraryTrack(raw)!, [normalizeLibraryTrack({ ...raw, id: 'fallback' })!])).toBe(1)
  expect(mocks.command.mock.calls[0][2].uris).toEqual(['spotify:track:track-one', 'spotify:track:fallback'])
  playerStore.useMock()
})
