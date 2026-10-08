import { afterEach, expect, it, vi } from 'vitest'
import { LyricsService, LrclibProvider, parseLrc } from '../src/services/lyrics/LyricsService'
import { mockTrack } from '../src/data/mockTrack'
import { lyricWindow } from '../src/hooks/useLyrics'
import { playerStore } from '../src/store/playerStore'
import { toMusicWallTrack } from '../src/services/spotify/playback'
import type { NormalizedPlayback } from '../src/types/music'

afterEach(() => { vi.unstubAllGlobals(); playerStore.useMock() })

it('parses timestamps, duplicate tags, offsets and instrumental gaps', () => {
  const lines = parseLrc('[offset:100]\n[00:01.20][00:08.250]First\n[00:04.00]\n[00:09.00]Last', 12)
  expect(lines).toEqual([
    { startMs: 1300, endMs: 4100, text: 'First' },
    { startMs: 8350, endMs: 9100, text: 'First' },
    { startMs: 9100, endMs: 12000, text: 'Last' },
  ])
  const timed = lines.map((line, i) => ({ id: String(i), start: line.startMs! / 1000, end: line.endMs! / 1000, text: line.text, singer: 'artist-a' as const }))
  expect(lyricWindow(timed, 2).current?.text).toBe('First')
  expect(lyricWindow(timed, 5).current).toBeUndefined()
  expect(lyricWindow(timed, 10).current?.text).toBe('Last')
})

it('caches by track identity, supports plain lyrics, and clears the cache', async () => {
  const provider = { getLyrics: vi.fn().mockResolvedValue({ synced: false, lines: [{ text: 'Plain line' }] }) }
  const service = new LyricsService(provider)
  expect(await service.getLyrics(mockTrack)).toMatchObject({ synced: false })
  expect(await service.getSyncedLyrics(mockTrack)).toBeNull()
  expect(provider.getLyrics).toHaveBeenCalledTimes(1)
  service.clearCache()
  await service.getLyrics(mockTrack)
  expect(provider.getLyrics).toHaveBeenCalledTimes(2)
})

it('matches title, primary artist, album and duration and handles missing lyrics', async () => {
  const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ syncedLyrics: '[00:01.00]First' }))).mockResolvedValueOnce(new Response('', { status: 404 })).mockResolvedValueOnce(new Response('[]')).mockResolvedValueOnce(new Response(JSON.stringify({ plainLyrics: 'One\nTwo' }))).mockResolvedValueOnce(new Response('[]'))
  vi.stubGlobal('fetch', fetchMock)
  const provider = new LrclibProvider('https://lrclib.net/api')
  expect(await provider.getLyrics(mockTrack)).toMatchObject({ synced: true })
  const url = fetchMock.mock.calls[0][0] as URL
  expect(url.searchParams.get('track_name')).toBe(mockTrack.title)
  expect(url.searchParams.get('duration')).toBe(String(Math.round(mockTrack.duration)))
  expect(await provider.getLyrics(mockTrack)).toBeNull()
  expect(await provider.getLyrics(mockTrack)).toEqual({ synced: false, lines: [{ text: 'One' }, { text: 'Two' }] })
})

it('preserves lyrics through Spotify polls and rejects lyrics for the previous track', () => {
  const playback: NormalizedPlayback = { trackId: 'one', title: 'One', artists: [{ id: 'a', name: 'Artist' }], album: '', artwork: null, duration: 100, position: 1, isPlaying: true, deviceAvailable: true, deviceId: 'd', deviceRestricted: false, supportsVolume: true, volume: .5 }
  playerStore.useSpotify()
  playerStore.applySpotifyPlayback(playback, toMusicWallTrack(playback))
  const lines = [{ id: 'line', start: 0, end: 4, text: 'First', singer: 'artist-a' as const }]
  playerStore.setSpotifyLyrics('one', lines, [])
  playerStore.applySpotifyPlayback({ ...playback, position: 2 }, toMusicWallTrack(playback))
  expect(playerStore.getSnapshot().spotifyTrack?.lyrics).toEqual(lines)
  playerStore.applySpotifyPlayback({ ...playback, trackId: 'two' }, toMusicWallTrack({ ...playback, trackId: 'two' }))
  expect(playerStore.getSnapshot().spotifyTrack?.lyrics).toEqual([])
  playerStore.setSpotifyLyrics('one', lines, [])
  expect(playerStore.getSnapshot().spotifyTrack?.lyrics).toEqual([])
})


it('prefers synced lyrics on a matching alternate release and rejects wrong durations', async () => {
  vi.stubGlobal('fetch', vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ plainLyrics: 'Plain fallback' })))
    .mockResolvedValueOnce(new Response(JSON.stringify([
      { trackName: mockTrack.title, artistName: mockTrack.artist, duration: 2, syncedLyrics: '[00:01]Wrong' },
      { trackName: mockTrack.title, artistName: mockTrack.artist, duration: mockTrack.duration, syncedLyrics: '[00:01]Correct' },
    ]))))
  expect(await new LrclibProvider().getLyrics(mockTrack)).toMatchObject({ synced: true, lines: [{ text: 'Correct' }] })
})
