import type { SpotifyPlaybackResult } from './playback'

/** Provider boundary consumed by the synchronization hook. */
export interface SpotifyPlaybackService {
  getCurrent(signal?: AbortSignal): Promise<SpotifyPlaybackResult>
  play(): Promise<void>
  pause(): Promise<void>
  previous(): Promise<void>
  next(): Promise<void>
  seek(seconds: number): Promise<void>
  setVolume(volume: number): Promise<void>
}
