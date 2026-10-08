import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getCurrent: vi.fn(),
  pause: vi.fn().mockResolvedValue(undefined),
  completeRedirect: vi.fn().mockResolvedValue(undefined),
  authSnapshot: { status: 'connected', message: '', canControl: true, clientId: 'test', configuredByEnv: true },
}))

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

beforeEach(() => {
  vi.useFakeTimers()
  mocks.pause.mockClear()
  mocks.getCurrent.mockReset().mockResolvedValue({ playback: {
    trackId: 'track-one', title: 'Track One', artists: [], album: 'Album', artwork: null,
    duration: 180, position: 12, isPlaying: true, deviceAvailable: true, deviceId: 'device-one',
    deviceRestricted: false, supportsVolume: true, volume: 0.5,
  }, reason: 'track' })
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
})

it('renders normalized Spotify timing in the existing player without inventing lyrics', async () => {
  const { default: App } = await import('../src/App')
  const { playerStore } = await import('../src/store/playerStore')
  playerStore.useMock()
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)

  await act(async () => { root.render(createElement(App)) })
  await act(async () => { await vi.advanceTimersByTimeAsync(0) })
  expect(container.textContent).toContain('Lyrics unavailable for this track')
  expect(container.querySelector<HTMLInputElement>('input[aria-label="Seek through track"]')?.max).toBe('180')
  expect(container.querySelector('button[aria-label="Pause"]')).not.toBeNull()

  await act(async () => { container.querySelector<HTMLButtonElement>('button[aria-label="Pause"]')?.click() })
  expect(mocks.pause).toHaveBeenCalledTimes(1)
  await act(async () => { root.unmount() })
  container.remove()
})

it('restores play state when Spotify rejects a playback command', async () => {
  mocks.pause.mockRejectedValueOnce(new Error('Command failed'))
  const { default: App } = await import('../src/App')
  const { playerStore } = await import('../src/store/playerStore')
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

afterEach(() => {
  vi.useRealTimers()
})

it('polls Spotify while mounted, updates the player store, and stops after unmount', async () => {
  const { useSpotify } = await import('../src/hooks/useSpotify')
  const { playerStore } = await import('../src/store/playerStore')
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
  const { useSpotify } = await import('../src/hooks/useSpotify')
  const { playerStore } = await import('../src/store/playerStore')
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

it('keeps the retry window after Spotify rate limits polling', async () => {
  const { SpotifyApiError } = await import('../src/services/spotify/client')
  mocks.getCurrent.mockRejectedValueOnce(new SpotifyApiError(429, 'Too many requests', 12))
  const { useSpotify } = await import('../src/hooks/useSpotify')
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
