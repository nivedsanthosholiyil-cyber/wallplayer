import { afterEach, expect, it, vi } from 'vitest'
import { normalizeSdkState, startSpotifySdk, type SdkState } from '../src/services/spotify/sdk'

const sample: SdkState = { paused: false, position: 12000, duration: 100000, track_window: { current_track: { id: 'track', name: 'Song', duration_ms: 100000, artists: [{ name: 'Artist', uri: 'spotify:artist:artist-id' }], album: { name: 'Album', images: [{ url: 'https://example.com/art' }] } } } }
afterEach(() => { delete (window as Window & { Spotify?: unknown }).Spotify })

it('normalizes SDK timestamps and artist IDs for the shared store', () => {
  expect(normalizeSdkState(sample, 'browser-device')).toMatchObject({ trackId: 'track', artists: [{ id: 'artist-id', name: 'Artist' }], duration: 100, position: 12, isPlaying: true, deviceId: 'browser-device' })
})

it('handles SDK readiness, events, failure and cleanup without emitting after disposal', async () => {
  const listeners: Record<string, (value: unknown) => void> = {}
  const disconnect = vi.fn()
  class Player {
    connect = vi.fn().mockResolvedValue(true)
    disconnect = disconnect
    getCurrentState = vi.fn().mockResolvedValue(null)
    addListener(event: string, listener: (value: unknown) => void) { listeners[event] = listener; return true }
  }
  Object.assign(window, { Spotify: { Player } })
  const onState = vi.fn(), onReady = vi.fn(), onError = vi.fn()
  const stop = startSpotifySdk(onState, onReady, onError)
  await Promise.resolve(); await Promise.resolve()
  listeners.ready({ device_id: 'browser-device' })
  listeners.player_state_changed(sample)
  expect(onState).toHaveBeenCalledWith(expect.objectContaining({ position: 12, isPlaying: true }))
  listeners.account_error({ message: 'Premium required' })
  expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'Premium required' }))
  listeners.not_ready({ device_id: 'browser-device' })
  expect(onReady).toHaveBeenLastCalledWith(false)
  stop()
  const count = onState.mock.calls.length
  listeners.player_state_changed(sample)
  expect(onState).toHaveBeenCalledTimes(count)
  expect(disconnect).toHaveBeenCalledOnce()
})
