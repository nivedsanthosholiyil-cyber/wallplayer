import { act, createElement } from 'react'
import { createRoot as reactCreateRoot, type Root } from 'react-dom/client'
import App from '../src/App'
import { playerStore } from '../src/store/playerStore'
import { useSpotify } from '../src/hooks/useSpotify'
import { useTrackLyrics } from '../src/hooks/useTrackLyrics'
import { lyricWindow } from '../src/hooks/useLyrics'
import { spotifyPlayback, toMusicWallTrack } from '../src/services/spotify/playback'
import { SpotifyApiError } from '../src/services/spotify/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getCurrent: vi.fn(),
  pause: vi.fn().mockResolvedValue(undefined),
  completeRedirect: vi.fn().mockResolvedValue(undefined),
  getLyrics: vi.fn().mockResolvedValue(null),
  authSnapshot: { status: 'connected', message: '', canControl: true, clientId: 'test', configuredByEnv: true },
}))

vi.mock('../src/services/lyrics/LyricsService', () => ({ lyricsService: { getLyrics: mocks.getLyrics } }))
vi.mock('../src/services/visuals/VisualLibrary', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/services/visuals/VisualLibrary')>()
  return { ...actual, visualLibrary: { ...actual.visualLibrary, getVisual: vi.fn().mockResolvedValue(null) } }
})

vi.mock('../src/services/spotify/auth', () => ({
  spotifyAuth: {
    getSnapshot: () => mocks.authSnapshot,
    subscribe: () => () => {},
    completeRedirect: mocks.completeRedirect,
    redirectUri: 'http://127.0.0.1:5173/callback',
    setClientId: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
  },
}))

vi.mock('../src/services/spotify/playback', () => ({
  spotifyPlayback: { getCurrent: mocks.getCurrent, pause: mocks.pause, play: vi.fn(), next: vi.fn(), previous: vi.fn(), seek: vi.fn(), setVolume: vi.fn() },
  toMusicWallTrack: (playback: { trackId: string; title: string; duration: number }) => ({
    id: playback.trackId, title: playback.title, artist: 'Artist', duration: playback.duration,
    visual: { kind: 'image', src: '/images/afterglow-night.png' },
    singers: [{ id: 'artist-a', name: 'Artist' }, { id: 'artist-b', name: 'Artist B' }], lyrics: [],
  }),
}))

// Load the application before the timed tests and before fake timers are installed.
// Every root is registered so an assertion failure cannot leak a poller/act scope.
const mounted = new Map<Root, Element>()
function createRoot(container: Element) {
  const root = reactCreateRoot(container)
  const unmount = root.unmount.bind(root)
  root.unmount = () => { unmount(); mounted.delete(root); container.remove() }
  mounted.set(root, container)
  return root
}

beforeEach(() => {
  vi.useFakeTimers()
  mocks.pause.mockReset().mockResolvedValue(undefined)
  mocks.getLyrics.mockReset().mockResolvedValue(null)
  playerStore.useMock()
  mocks.getCurrent.mockReset().mockResolvedValue({ playback: {
    trackId: 'track-one', title: 'Track One', artists: [], album: 'Album', artwork: null,
    duration: 180, position: 12, isPlaying: true, deviceAvailable: true, deviceId: 'device-one',
    deviceRestricted: false, supportsVolume: true, volume: 0.5,
  }, reason: 'track' })
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
})

it('renders normalized Spotify timing in the existing player without inventing lyrics', async () => {
  playerStore.useMock()
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)

  await act(async () => { root.render(createElement(App)) })
  await act(async () => { await vi.advanceTimersByTimeAsync(0) })
  expect(container.textContent).toContain('LYRICS UNAVAILABLE')
  expect(container.querySelector<HTMLInputElement>('input[aria-label="Seek through track"]')?.max).toBe('180')
  expect(container.querySelector('button[aria-label="Pause"]')).not.toBeNull()

  await act(async () => { container.querySelector<HTMLButtonElement>('button[aria-label="Pause"]')?.click() })
  expect(mocks.pause).toHaveBeenCalledTimes(1)
  await act(async () => { root.unmount() })
  container.remove()
})

it('restores play state when Spotify rejects a playback command', async () => {
  mocks.pause.mockRejectedValueOnce(new Error('Command failed'))
  playerStore.useMock()
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  await act(async () => { root.render(createElement(App)) })
  await act(async () => { await vi.advanceTimersByTimeAsync(0) })
  expect(playerStore.getSnapshot().isPlaying).toBe(true)
  await act(async () => { container.querySelector<HTMLButtonElement>('button[aria-label="Pause"]')?.click() })
  expect(mocks.pause).toHaveBeenCalledTimes(1)
  expect(playerStore.getSnapshot()).toMatchObject({ isPlaying: true, status: 'error', message: 'Command failed' })
  await act(async () => { root.unmount() })
  container.remove()
})

afterEach(async () => {
  try {
    await act(async () => { for (const root of [...mounted.keys()]) root.unmount() })
  } finally {
    vi.clearAllTimers()
    vi.useRealTimers()
  }
})

it.each(['seek', 'volume'] as const)('does not apply a late Spotify %s result to local playback', async (action) => {
  playerStore.useMock()
  let finish!: () => void
  vi.mocked(action === 'seek' ? spotifyPlayback.seek : spotifyPlayback.setVolume).mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve }))
  let spotify!: ReturnType<typeof useSpotify>
  function Probe() { spotify = useSpotify(); return null }
  const container = document.createElement('div')
  const root = createRoot(container)
  try {
    await act(async () => { root.render(createElement(Probe)) })
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })
    let request!: Promise<boolean>
    await act(async () => { request = spotify.command(action, action === 'seek' ? 40 : .9) })
    const local = { ...toMusicWallTrack((await mocks.getCurrent()).playback), id: 'local-race', audioSrc: 'blob:local-race' }
    await act(async () => { playerStore.selectLocalTrack(local.id, [local]); playerStore.seek(7); playerStore.setVolume(.2); finish(); await request })
    expect(playerStore.getSnapshot()).toMatchObject({ source: 'local', currentTime: 7, volume: .2 })
  } finally {
    await act(async () => { root.unmount() })
    container.remove()
  }
})

it('polls Spotify while mounted, updates the player store, and stops after unmount', async () => {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  function Probe() { useSpotify(); return null }

  await act(async () => { root.render(createElement(Probe)) })
  await act(async () => { await vi.advanceTimersByTimeAsync(0) })
  expect(mocks.getCurrent).toHaveBeenCalledTimes(1)
  expect(playerStore.getSnapshot()).toMatchObject({ source: 'spotify', currentTime: 12, spotifyTrack: { id: 'track-one' } })

  await act(async () => { await vi.advanceTimersByTimeAsync(5_000) })
  expect(mocks.getCurrent).toHaveBeenCalledTimes(2)

  await act(async () => { root.unmount() })
  await vi.advanceTimersByTimeAsync(20_000)
  expect(mocks.getCurrent).toHaveBeenCalledTimes(2)
  container.remove()
})

it('ignores an older playback response after a refresh starts', async () => {
  let resolveFirst!: (value: unknown) => void
  mocks.getCurrent
    .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve }))
    .mockResolvedValueOnce({ playback: {
      trackId: 'new-track', title: 'New Track', artists: [], album: 'Album', artwork: null,
      duration: 90, position: 20, isPlaying: false, deviceAvailable: true, deviceId: null,
      deviceRestricted: false, supportsVolume: true, volume: 0.5,
    }, reason: 'track' })
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  function Probe() { useSpotify(); return null }
  await act(async () => { root.render(createElement(Probe)) })
  await act(async () => { await vi.advanceTimersByTimeAsync(0) })
  await act(async () => { window.dispatchEvent(new Event('online')); await vi.advanceTimersByTimeAsync(0) })
  expect(playerStore.getSnapshot().spotifyTrack?.id).toBe('new-track')
  await act(async () => {
    resolveFirst({ playback: {
      trackId: 'old-track', title: 'Old Track', artists: [], album: 'Album', artwork: null,
      duration: 90, position: 2, isPlaying: true, deviceAvailable: true, deviceId: 'device',
      deviceRestricted: false, supportsVolume: true, volume: 0.5,
    }, reason: 'track' })
  })
  expect(playerStore.getSnapshot().spotifyTrack?.id).toBe('new-track')
  await act(async () => { root.unmount() })
  container.remove()
})

it('keeps Spotify reconciliation alive for desktop wallpaper even when Chromium reports hidden', async () => {
  const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
  const container = document.createElement('div'), root = createRoot(container)
  function Probe() { useSpotify(); return null }
  try {
    await act(async () => { root.render(createElement(Probe)); await vi.advanceTimersByTimeAsync(0) })
    expect(mocks.getCurrent).not.toHaveBeenCalled()
    await act(async () => { document.documentElement.setAttribute('data-wallpaper-input','') })
    await act(async () => { await vi.advanceTimersByTimeAsync(5000) })
    expect(mocks.getCurrent).toHaveBeenCalledTimes(2)
    await act(async () => { document.documentElement.removeAttribute('data-wallpaper-input') })
    await act(async () => { await vi.advanceTimersByTimeAsync(15000) })
    expect(mocks.getCurrent).toHaveBeenCalledTimes(2)
  } finally { await act(async () => root.unmount()); hidden.mockRestore(); document.documentElement.removeAttribute('data-wallpaper-input') }
})

it('keeps the retry window after Spotify rate limits polling', async () => {
  mocks.getCurrent.mockRejectedValueOnce(new SpotifyApiError(429, 'Too many requests', 12))
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  function Probe() { useSpotify(); return null }
  await act(async () => { root.render(createElement(Probe)) })
  await act(async () => { await vi.advanceTimersByTimeAsync(0) })
  expect(mocks.getCurrent).toHaveBeenCalledTimes(1)
  await act(async () => { window.dispatchEvent(new Event('online')) })
  await act(async () => { await vi.advanceTimersByTimeAsync(11_000) })
  expect(mocks.getCurrent).toHaveBeenCalledTimes(1)
  await act(async () => { await vi.advanceTimersByTimeAsync(1_000) })
  expect(mocks.getCurrent).toHaveBeenCalledTimes(2)
  await act(async () => { root.unmount() })
  container.remove()
})

it('loads lyrics once per track and follows Spotify seeking without refetching', async () => {
  mocks.getLyrics.mockResolvedValueOnce({ synced: true, lines: [{ startMs: 0, endMs: 15000, text: 'First lyric' }, { startMs: 15000, endMs: 180000, text: 'Second lyric' }] })
  playerStore.useMock()
  const callsBefore = mocks.getLyrics.mock.calls.length
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  try {
    await act(async () => { root.render(createElement(App)); await vi.advanceTimersByTimeAsync(0) })
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })
    expect(container.querySelector('.lyrics__current')?.textContent).toBe('First lyric')
    await act(async () => { playerStore.seek(20); await vi.advanceTimersByTimeAsync(1200) })
    const snapshot = playerStore.getSnapshot()
    expect(lyricWindow(snapshot.spotifyTrack!.lyrics, snapshot.currentTime).current?.text).toBe('Second lyric')
    expect(mocks.getLyrics.mock.calls.length - callsBefore).toBe(1)
  } finally {
    await act(async () => { root.unmount() })
    container.remove()
  }
})


it('aborts old lyrics lookup and never applies its late result to a new track', async () => {
  let resolveOld!: (result: unknown) => void
  mocks.getLyrics.mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve })).mockResolvedValueOnce({ synced: true, lines: [{ startMs: 0, endMs: 90000, text: 'New track lyric' }] })
  const playback = (await mocks.getCurrent()).playback
  playerStore.useSpotify()
  playerStore.applySpotifyPlayback(playback, toMusicWallTrack(playback))
  const container = document.createElement('div')
  const root = createRoot(container)
  function Probe({ track }: { track: ReturnType<typeof toMusicWallTrack> }) { useTrackLyrics(track, true); return null }
  try {
    await act(async () => { root.render(createElement(Probe, { track: toMusicWallTrack(playback) })) })
    const signal = mocks.getLyrics.mock.calls.at(-1)![1] as AbortSignal
    const next = { ...playback, trackId: 'next-track', title: 'Next' }
    playerStore.applySpotifyPlayback(next, toMusicWallTrack(next))
    await act(async () => { root.render(createElement(Probe, { track: toMusicWallTrack(next) })) })
    expect(signal.aborted).toBe(true)
    await act(async () => { resolveOld({ synced: true, lines: [{ startMs: 0, endMs: 90000, text: 'Old lyric' }] }) })
    expect(playerStore.getSnapshot().spotifyTrack?.lyrics[0].text).toBe('New track lyric')
  } finally { await act(async () => { root.unmount() }); container.remove() }
})
