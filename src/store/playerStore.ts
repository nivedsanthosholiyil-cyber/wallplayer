import { mockTracks } from '../data/mockTrack'
import type { NormalizedPlayback, Track } from '../types/music'

export type PlayerStatus = 'ready' | 'loading' | 'no-track' | 'unavailable' | 'expired' | 'error'
export type PlaybackSource = 'mock' | 'spotify' | 'local'

export interface PlayerState {
  source: PlaybackSource
  trackIndex: number
  localQueue: Track[]
  localIndex: number
  localTrack: Track | null
  spotifyTrack: Track | null
  spotifyPlayback: NormalizedPlayback | null
  currentTime: number
  isPlaying: boolean
  volume: number
  isMuted: boolean
  status: PlayerStatus
  message: string
}

let state: PlayerState = {
  source: 'mock', trackIndex: 0, localQueue: [], localIndex: -1, localTrack: null, spotifyTrack: null, spotifyPlayback: null,
  currentTime: 0, isPlaying: false, volume: 0.7, isMuted: true,
  status: 'ready', message: '',
}
const listeners = new Set<() => void>()

function setState(update: Partial<PlayerState>) {
  state = { ...state, ...update }
  listeners.forEach((listener) => listener())
}

export const playerStore = {
  getSnapshot: () => state,
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => { listeners.delete(listener) }
  },
  useSpotify() {
    if (state.source === 'spotify') return
    setState({ source: 'spotify', localQueue: [], localIndex: -1, localTrack: null, spotifyTrack: null, spotifyPlayback: null, currentTime: 0, isPlaying: false, status: 'loading', message: '' })
  },
  useMock() {
    if (state.source === 'mock') return
    setState({ source: 'mock', localQueue: [], localIndex: -1, localTrack: null, spotifyTrack: null, spotifyPlayback: null, currentTime: 0, isPlaying: false, volume: 0.7, isMuted: true, status: 'ready', message: '' })
  },
  selectMockTrack(trackId: string) {
    const index = mockTracks.findIndex((track) => track.id === trackId)
    if (index < 0) return false
    setState({ source: 'mock', trackIndex: index, localQueue: [], localIndex: -1, localTrack: null, spotifyTrack: null, spotifyPlayback: null, currentTime: 0, isPlaying: true, status: 'ready', message: '' })
    return true
  },
  selectLocalTrack(trackId: string, queue: Track[]) {
    const index = queue.findIndex((track) => track.id === trackId && Boolean(track.audioSrc))
    if (index < 0) return false
    const track = queue[index]
    setState({
      source: 'local', localQueue: queue, localIndex: index, localTrack: track,
      currentTime: 0, isPlaying: true,
      volume: state.volume || 0.7, isMuted: false, status: 'ready', message: '',
    })
    return true
  },
  applySpotifyPlayback(playback: NormalizedPlayback | null, track: Track | null) {
    if (state.source !== 'spotify') return
    if (!playback || !track) {
      setState({ spotifyPlayback: null, spotifyTrack: null, currentTime: 0, isPlaying: false, status: 'no-track', message: 'No track is playing on Spotify.' })
      return
    }
    const sameTrack = state.spotifyPlayback?.trackId === playback.trackId
    const syncedTime = sameTrack && state.isPlaying === playback.isPlaying && Math.abs(state.currentTime - playback.position) < 0.65
      ? state.currentTime : playback.position
    setState({
      spotifyPlayback: playback,
      spotifyTrack: track,
      currentTime: syncedTime,
      isPlaying: playback.isPlaying,
      volume: playback.volume ?? state.volume,
      isMuted: playback.volume === 0 ? true : playback.volume === null ? state.isMuted : false,
      status: 'ready', message: '',
    })
  },
  setSpotifyStatus(status: PlayerStatus, message: string) {
    if (state.source !== 'spotify') return
    setState({ status, message, ...(status === 'expired' ? { isPlaying: false } : {}) })
  },
  play: () => setState({ isPlaying: true }),
  pause: () => setState({ isPlaying: false }),
  togglePlay: () => setState({ isPlaying: !state.isPlaying }),
  seek(time: number) {
    const duration = state.source === 'spotify' ? state.spotifyTrack?.duration ?? 0 : state.source === 'local' ? state.localTrack?.duration ?? 0 : mockTracks[state.trackIndex].duration
    setState({ currentTime: Math.min(duration, Math.max(0, time)) })
  },
  setLocalPosition(time: number) {
    if (state.source !== 'local' || !Number.isFinite(time)) return
    setState({ currentTime: Math.max(0, Math.min(state.localTrack?.duration ?? time, time)) })
  },
  setLocalDuration(duration: number) {
    if (state.source !== 'local' || !Number.isFinite(duration) || duration <= 0 || !state.localTrack) return
    const localTrack = { ...state.localTrack, duration }
    const localQueue = state.localQueue.map((track, index) => index === state.localIndex ? localTrack : track)
    setState({ localTrack, localQueue })
  },
  advanceLocalAfterEnd() {
    if (state.source !== 'local') return
    if (state.localIndex >= 0 && state.localIndex < state.localQueue.length - 1) {
      const nextIndex = state.localIndex + 1
      setState({ localIndex: nextIndex, localTrack: state.localQueue[nextIndex], currentTime: 0, isPlaying: true, status: 'ready', message: '' })
    } else {
      setState({ currentTime: state.localTrack?.duration ?? state.currentTime, isPlaying: false })
    }
  },
  setLocalPlaybackError(message: string) {
    if (state.source === 'local') setState({ isPlaying: false, status: 'error', message })
  },
  next() {
    if (state.source === 'local') {
      const nextIndex = (state.localIndex + 1) % state.localQueue.length
      if (state.localQueue.length) setState({ localIndex: nextIndex, localTrack: state.localQueue[nextIndex], currentTime: 0, status: 'ready', message: '' })
      return
    }
    setState({ trackIndex: (state.trackIndex + 1) % mockTracks.length, currentTime: 0 })
  },
  previous() {
    if (state.source === 'local') {
      if (state.currentTime > 3) { setState({ currentTime: 0 }); return }
      if (state.localQueue.length) {
        const previousIndex = (state.localIndex - 1 + state.localQueue.length) % state.localQueue.length
        setState({ localIndex: previousIndex, localTrack: state.localQueue[previousIndex], currentTime: 0, status: 'ready', message: '' })
      }
      return
    }
    if (state.currentTime > 3) setState({ currentTime: 0 })
    else setState({ trackIndex: (state.trackIndex - 1 + mockTracks.length) % mockTracks.length, currentTime: 0 })
  },
  setVolume(volume: number) {
    const nextVolume = Math.min(1, Math.max(0, volume))
    setState({ volume: nextVolume, isMuted: nextVolume === 0 })
  },
  toggleMute: () => setState({ isMuted: !state.isMuted, volume: state.volume === 0 ? 0.7 : state.volume }),
  tick(delta: number) {
    if (!state.isPlaying || delta <= 0) return
    if (state.source === 'local') return
    if (state.source === 'spotify') {
      const duration = state.spotifyTrack?.duration ?? 0
      setState({ currentTime: Math.min(duration, state.currentTime + Math.min(delta, 1)) })
      return
    }
    const duration = mockTracks[state.trackIndex].duration
    const nextTime = state.currentTime + delta
    if (nextTime >= duration) {
      setState({ trackIndex: (state.trackIndex + 1) % mockTracks.length, currentTime: nextTime - duration })
    } else setState({ currentTime: nextTime })
  },
}
