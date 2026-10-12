import { afterEach, expect, it, vi } from 'vitest'
import { playerStore } from '../src/store/playerStore'
import { normalizePlayback, toMusicWallTrack, spotifyPlayback } from '../src/services/spotify/playback'
import { lyricWindow } from '../src/hooks/useLyrics'

vi.mock('../src/services/spotify/auth', () => ({ spotifyAuth: { getAccessToken: vi.fn().mockResolvedValue('test') } }))
const raw = { is_playing: true, progress_ms: 14900, item: { type: 'track', id: 'clock', name: 'Clock', duration_ms: 120000 } }
afterEach(() => { playerStore.useMock(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

it('applies sub-second Spotify corrections at the lyric boundary and catches up after a delayed timer', () => {
  const sample = normalizePlayback(raw)!
  playerStore.useSpotify()
  playerStore.applySpotifyPlayback(sample, toMusicWallTrack(sample))
  playerStore.tick(.1)
  const corrected = { ...sample, position: 15.2 }
  playerStore.applySpotifyPlayback(corrected, toMusicWallTrack(corrected))
  expect(playerStore.getSnapshot().currentTime).toBe(15.2)
  const lines = [{ id: 'one', start: 0, end: 15.1, text: 'Old', singer: 'artist-a' as const }, { id: 'two', start: 15.1, end: 120, text: 'New', singer: 'artist-a' as const }]
  expect(lyricWindow(lines, playerStore.getSnapshot().currentTime).current?.id).toBe('two')
  playerStore.tick(4.5)
  expect(playerStore.getSnapshot().currentTime).toBe(19.7)
  playerStore.tick(NaN)
  expect(playerStore.getSnapshot().currentTime).toBe(19.7)
  const paused = { ...sample, position: 40, isPlaying: false, sampledAt: performance.now() - 3000 }
  playerStore.applySpotifyPlayback(paused, toMusicWallTrack(paused))
  playerStore.tick(20)
  expect(playerStore.getSnapshot().currentTime).toBe(40)
})

it('compensates the playback response journey and sample delivery without using the last-change timestamp', async () => {
  let clock = 1000
  vi.spyOn(performance, 'now').mockImplementation(() => clock)
  vi.stubGlobal('fetch', vi.fn(async () => {
    clock = 1800
    return new Response(JSON.stringify({ ...raw, timestamp: 1 }))
  }))
  const { playback } = await spotifyPlayback.getCurrent()
  expect(playback?.position).toBeCloseTo(15.3)
  expect(playback?.sampledAt).toBe(1800)
  clock = 2000
  playerStore.useSpotify()
  playerStore.applySpotifyPlayback(playback, toMusicWallTrack(playback!))
  expect(playerStore.getSnapshot().currentTime).toBeCloseTo(15.5)
  // Paused progress does not advance due to network/delivery latency.
  clock = 1000
  vi.stubGlobal('fetch', vi.fn(async () => { clock = 1800; return new Response(JSON.stringify({ ...raw, is_playing: false })) }))
  const paused = (await spotifyPlayback.getCurrent()).playback!
  expect(paused.position).toBe(14.9)
})
