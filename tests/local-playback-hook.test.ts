import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ command: vi.fn().mockResolvedValue(true) }))

vi.mock('../src/hooks/useSpotify', () => ({
  useSpotify: () => ({
    auth: { status: 'disconnected', message: '', canControl: false, clientId: '', configuredByEnv: false },
    connect: vi.fn(), disconnect: vi.fn(), connectError: '', command: mocks.command,
    setClientId: vi.fn(), redirectUri: 'http://127.0.0.1:5173/callback',
  }),
}))

import { usePlayback } from '../src/hooks/usePlayback'
import { playerStore } from '../src/store/playerStore'
import type { Track } from '../src/types/music'

const originalUserAgent = navigator.userAgent
;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const localTrack: Track = {
  id: 'local-test', title: 'Test track', artist: 'Test artist', album: 'Local Music', artwork: '/artwork/afterglow.svg',
  duration: 20, visual: { kind: 'image', src: '/images/afterglow-night.png' }, audioSrc: 'blob:test-track',
  singers: [{ id: 'artist-a', name: 'Test artist' }, { id: 'artist-b', name: 'Test artist' }], lyrics: [],
}

afterEach(() => {
  Object.defineProperty(navigator, 'userAgent', { configurable: true, value: originalUserAgent })
  vi.unstubAllGlobals()
  playerStore.useMock()
  mocks.command.mockClear()
})

it('routes local seek, volume, and mute through local playback instead of Spotify', async () => {
  let playback!: ReturnType<typeof usePlayback>
  function Probe() { playback = usePlayback(); return null }
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  await act(async () => { root.render(createElement(Probe)) })
  await act(async () => { playerStore.selectLocalTrack(localTrack.id, [localTrack]) })

  expect(playback.canControl).toBe(true)
  expect(playback.canControlVolume).toBe(true)
  await act(async () => {
    playback.seek(6)
    playback.setVolume(.35)
    playback.toggleMute()
  })
  expect(playerStore.getSnapshot()).toMatchObject({ source: 'local', currentTime: 6, volume: .35, isMuted: true })
  expect(mocks.command).not.toHaveBeenCalled()

  await act(async () => { root.unmount() })
  container.remove()
})

it('drives local audio playback, seek, volume, and automatic next-track changes', async () => {
  class AudioStub extends EventTarget {
    static instances: AudioStub[] = []
    src = ''
    currentTime = 0
    duration = 12
    volume = 1
    muted = false
    paused = true
    preload = 'metadata'
    constructor() { super(); AudioStub.instances.push(this) }
    play() { this.paused = false; return Promise.resolve() }
    pause() { this.paused = true }
    load() {}
    removeAttribute(name: string) { if (name === 'src') this.src = '' }
  }
  AudioStub.instances = []
  vi.stubGlobal('Audio', AudioStub)
  Object.defineProperty(navigator, 'userAgent', { configurable: true, value: 'MusicWall test browser' })

  let playback!: ReturnType<typeof usePlayback>
  function Probe() { playback = usePlayback(); return null }
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  await act(async () => { root.render(createElement(Probe)) })
  const secondTrack = { ...localTrack, id: 'local-second', title: 'Second track', audioSrc: 'blob:second-track' }
  const queue = [localTrack, secondTrack]
  await act(async () => { playback.playLocalTrack(localTrack.id, queue) })
  const audio = AudioStub.instances[0]
  expect(audio.src).toBe('blob:test-track')
  expect(audio.paused).toBe(false)

  await act(async () => { playback.seek(6); playback.setVolume(.4) })
  expect(audio.currentTime).toBe(6)
  expect(audio.volume).toBe(.4)
  await act(async () => { audio.currentTime = 7; audio.dispatchEvent(new Event('timeupdate')) })
  expect(playerStore.getSnapshot().currentTime).toBe(7)

  await act(async () => { audio.dispatchEvent(new Event('ended')) })
  expect(playerStore.getSnapshot()).toMatchObject({ localIndex: 1, localTrack: secondTrack, isPlaying: true })
  expect(audio.src).toBe('blob:second-track')
  await act(async () => { audio.dispatchEvent(new Event('ended')) })
  expect(playerStore.getSnapshot()).toMatchObject({ localIndex: 1, isPlaying: false, currentTime: 20 })

  await act(async () => { root.unmount() })
  container.remove()
})

it('pauses an active Spotify track when switching the shared player to a local file', async () => {
  let playback!: ReturnType<typeof usePlayback>
  function Probe() { playback = usePlayback(); return null }
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  await act(async () => { root.render(createElement(Probe)) })
  const spotifyTrack: Track = { ...localTrack, id: 'spotify-track', audioSrc: undefined }
  await act(async () => {
    playerStore.useSpotify()
    playerStore.applySpotifyPlayback({
      trackId: 'spotify-track', title: 'Spotify track', artists: [], album: 'Album', artwork: null,
      duration: 180, position: 14, isPlaying: true, deviceAvailable: true, deviceId: 'device',
      deviceRestricted: false, supportsVolume: true, volume: .5,
    }, spotifyTrack)
  })

  await act(async () => { playback.playLocalTrack(localTrack.id, [localTrack]) })
  expect(mocks.command).toHaveBeenCalledWith('pause')
  expect(playerStore.getSnapshot()).toMatchObject({ source: 'local', isPlaying: true, spotifyPlayback: { trackId: 'spotify-track' } })

  await act(async () => { root.unmount() })
  container.remove()
})
