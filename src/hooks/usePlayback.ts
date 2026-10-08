import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react'
import { mockTracks } from '../data/mockTrack'
import { playerStore } from '../store/playerStore'
import { useSpotify } from './useSpotify'

export function usePlayback() {
  const state = useSyncExternalStore(playerStore.subscribe, playerStore.getSnapshot, playerStore.getSnapshot)
  const spotify = useSpotify()
  const seekTimer = useRef<number | null>(null)
  const volumeTimer = useRef<number | null>(null)

  useEffect(() => () => {
    if (seekTimer.current !== null) window.clearTimeout(seekTimer.current)
    if (volumeTimer.current !== null) window.clearTimeout(volumeTimer.current)
  }, [state.source])

  useEffect(() => {
    if (!state.isPlaying) return
    let previous = performance.now()
    const timer = window.setInterval(() => {
      const now = performance.now()
      playerStore.tick((now - previous) / 1000)
      previous = now
    }, 50)
    return () => window.clearInterval(timer)
  }, [state.isPlaying])

  const togglePlay = useCallback(() => {
    if (state.source === 'mock') playerStore.togglePlay()
    else {
      const before = playerStore.getSnapshot()
      const action = before.isPlaying ? 'pause' : 'play'
      playerStore.togglePlay()
      void spotify.command(action).then((succeeded) => {
        const current = playerStore.getSnapshot()
        if (!succeeded && current.source === 'spotify' && current.spotifyTrack?.id === before.spotifyTrack?.id && current.isPlaying !== before.isPlaying) {
          if (before.isPlaying) playerStore.play()
          else playerStore.pause()
        }
      })
    }
  }, [state.source, state.isPlaying, spotify.command])
  const previous = useCallback(() => {
    if (state.source === 'mock') playerStore.previous()
    else void spotify.command('previous')
  }, [state.source, spotify.command])
  const next = useCallback(() => {
    if (state.source === 'mock') playerStore.next()
    else void spotify.command('next')
  }, [state.source, spotify.command])
  const seek = useCallback((time: number) => {
    if (state.source === 'mock') playerStore.seek(time)
    else {
      playerStore.seek(time)
      if (seekTimer.current !== null) window.clearTimeout(seekTimer.current)
      seekTimer.current = window.setTimeout(() => { void spotify.command('seek', time) }, 300)
    }
  }, [state.source, spotify.command])
  const setVolume = useCallback((volume: number) => {
    if (state.source === 'mock') playerStore.setVolume(volume)
    else {
      playerStore.setVolume(volume)
      if (volumeTimer.current !== null) window.clearTimeout(volumeTimer.current)
      volumeTimer.current = window.setTimeout(() => { void spotify.command('volume', volume) }, 300)
    }
  }, [state.source, spotify.command])
  const toggleMute = useCallback(() => {
    if (state.source === 'mock') playerStore.toggleMute()
    else void spotify.command('volume', state.isMuted ? state.volume || 0.7 : 0)
  }, [state.source, state.isMuted, state.volume, spotify.command])
  const playMockTrack = useCallback((trackId: string) => playerStore.selectMockTrack(trackId), [])

  const track = state.source === 'mock' ? mockTracks[state.trackIndex] : state.spotifyTrack
  const canControl = state.source === 'mock' || Boolean(
    spotify.auth.canControl && state.spotifyPlayback?.deviceAvailable && !state.spotifyPlayback.deviceRestricted,
  )
  const canControlVolume = state.source === 'mock' || Boolean(canControl && state.spotifyPlayback?.supportsVolume)

  return {
    ...state,
    track,
    canControl,
    canControlVolume,
    spotify,
    togglePlay,
    previous,
    next,
    seek,
    setVolume,
    toggleMute,
    playMockTrack,
  }
}
