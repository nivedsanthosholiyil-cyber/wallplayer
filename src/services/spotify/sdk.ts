import { spotifyAuth } from './auth'
import type { NormalizedPlayback } from '../../types/music'

interface SdkTrack { id: string; name: string; duration_ms: number; artists: { name: string; uri?: string }[]; album: { name: string; images: { url: string }[] } }
export interface SdkState { paused: boolean; position: number; duration: number; track_window: { current_track: SdkTrack } }
interface SdkPlayer {
  addListener(event: string, listener: (value: never) => void): boolean
  connect(): Promise<boolean>
  disconnect(): void
  getCurrentState(): Promise<SdkState | null>
}
interface SdkWindow extends Window {
  Spotify?: { Player: new (options: { name: string; getOAuthToken: (callback: (token: string) => void) => void; volume: number }) => SdkPlayer }
  onSpotifyWebPlaybackSDKReady?: () => void
}
let loading: Promise<void> | null = null
function loadSdk() {
  const target = window as SdkWindow
  if (target.Spotify) return Promise.resolve()
  if (loading) return loading
  loading = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://sdk.scdn.co/spotify-player.js'
    const previous = target.onSpotifyWebPlaybackSDKReady
    const finish = (error?: Error) => {
      window.clearTimeout(timeout)
      target.onSpotifyWebPlaybackSDKReady = previous
      if (error) { script.remove(); reject(error) } else resolve()
    }
    const timeout = window.setTimeout(() => finish(new Error('Spotify SDK initialization timed out')), 15000)
    target.onSpotifyWebPlaybackSDKReady = () => { previous?.(); finish() }
    script.onerror = () => finish(new Error('Spotify SDK could not load'))
    document.head.append(script)
  }).catch((error) => { loading = null; throw error })
  return loading
}

export function normalizeSdkState(state: SdkState, deviceId: string): NormalizedPlayback {
  const track = state.track_window.current_track
  return {
    trackId: track.id, title: track.name,
    artists: track.artists.map((artist) => ({ id: artist.uri?.split(':').at(-1) ?? null, name: artist.name })),
    album: track.album.name, artwork: track.album.images[0]?.url ?? null,
    duration: state.duration / 1000, position: state.position / 1000, isPlaying: !state.paused,
    sampledAt: performance.now(),
    deviceAvailable: true, deviceId, deviceRestricted: false, supportsVolume: true, volume: null,
  }
}

// SDK events describe this browser's device. The Web API still reconciles other devices.
export function startSpotifySdk(onState: (state: NormalizedPlayback | null) => void, onReady: (ready: boolean) => void, onError: (error: unknown) => void) {
  let disposed = false
  let player: SdkPlayer | null = null
  let deviceId = ''
  void loadSdk().then(async () => {
    if (disposed) return
    player = new (window as SdkWindow).Spotify!.Player({ name: 'Spontaneous', volume: 0.7,
      getOAuthToken: (callback) => { void spotifyAuth.getAccessToken().then((token) => { if (!disposed) callback(token) }).catch(onError) },
    })
    player.addListener('ready', (data: { device_id: string }) => {
      deviceId = data.device_id
      if (!disposed) { onReady(true); void player?.getCurrentState().then((state) => { if (!disposed && state) onState(normalizeSdkState(state, deviceId)) }).catch(onError) }
    })
    player.addListener('not_ready', () => { if (!disposed) { onReady(false); onState(null) } })
    player.addListener('player_state_changed', (state: SdkState | null) => {
      if (!disposed) onState(state?.track_window.current_track.id && deviceId ? normalizeSdkState(state, deviceId) : null)
    })
    for (const event of ['initialization_error', 'authentication_error', 'account_error', 'playback_error']) {
      player.addListener(event, (error: { message: string }) => { if (!disposed) { onReady(false); onError(new Error(error.message)) } })
    }
    if (!await player.connect() && !disposed) { onReady(false); onError(new Error('Spotify SDK unavailable; using Web API playback state')) }
  }).catch((error) => { if (!disposed) { onReady(false); onError(error) } })
  return () => { disposed = true; player?.disconnect() }
}
