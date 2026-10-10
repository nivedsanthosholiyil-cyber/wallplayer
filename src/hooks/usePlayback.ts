import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react'
import { mockTracks } from '../data/mockTrack'
import { playerStore } from '../store/playerStore'
import { useSpotify } from './useSpotify'

function reportLocalPlayError(error: unknown, trackId: string | undefined) {
  // Source changes intentionally interrupt play(); a stale promise must not pause the new track.
  if (error instanceof DOMException && error.name === 'AbortError') return
  const current = playerStore.getSnapshot()
  if (current.source === 'local' && current.localTrack?.id === trackId) playerStore.setLocalPlaybackError('This audio file could not be played in this browser.')
}

export function usePlayback() {
  const state = useSyncExternalStore(playerStore.subscribe, playerStore.getSnapshot, playerStore.getSnapshot)
  const spotify = useSpotify()
  const seekTimer = useRef<number | null>(null)
  const volumeTimer = useRef<number | null>(null)
  const localAudio = useRef<HTMLAudioElement | null>(null)
  const isTestDom = typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent)
  if (!localAudio.current && typeof Audio !== 'undefined' && !isTestDom) localAudio.current = new Audio()

  useEffect(() => () => {
    if (seekTimer.current !== null) window.clearTimeout(seekTimer.current)
    if (volumeTimer.current !== null) window.clearTimeout(volumeTimer.current)
  }, [state.source, state.spotifyTrack?.id])

  useEffect(() => {
    if (!state.isPlaying || state.source === 'local') return
    let previous = performance.now()
    const timer = window.setInterval(() => {
      const now = performance.now()
      playerStore.tick((now - previous) / 1000)
      previous = now
    }, 50)
    return () => window.clearInterval(timer)
  }, [state.isPlaying, state.source, state.spotifyPlayback])

  useEffect(() => {
    const audio = localAudio.current
    const track = state.localTrack
    if (!audio) return
    if (state.source !== 'local' || !track?.audioSrc) {
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
      return
    }
    audio.pause()
    audio.src = track.audioSrc
    audio.currentTime = 0
    audio.volume = state.volume
    audio.muted = state.isMuted
    audio.load()
    if (state.isPlaying) void audio.play().catch((error) => reportLocalPlayError(error, track.id))
    return () => {
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
    }
  }, [state.source, state.localTrack?.id, state.localTrack?.audioSrc])

  useEffect(() => {
    const audio = localAudio.current
    if (!audio || state.source !== 'local') return
    audio.volume = state.volume
    audio.muted = state.isMuted
  }, [state.source, state.volume, state.isMuted])

  useEffect(() => {
    const audio = localAudio.current
    if (!audio || state.source !== 'local') return
    if (state.isPlaying) void audio.play().catch((error) => reportLocalPlayError(error, state.localTrack?.id))
    else audio.pause()
  }, [state.source, state.isPlaying])

  useEffect(() => {
    const audio = localAudio.current
    if (!audio) return
    const onTime = () => playerStore.setLocalPosition(audio.currentTime)
    const onDuration = () => playerStore.setLocalDuration(audio.duration)
    const onEnded = () => playerStore.advanceLocalAfterEnd()
    const onError = () => playerStore.setLocalPlaybackError('This audio file could not be played in this browser.')
    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('durationchange', onDuration)
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('error', onError)
    return () => {
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('durationchange', onDuration)
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('error', onError)
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
    }
  }, [])

  const togglePlay = useCallback(() => {
    if (state.source === 'mock') playerStore.togglePlay()
    else if (state.source === 'local') {
      if (state.isPlaying) { localAudio.current?.pause(); playerStore.pause() }
      else {
        const audio = localAudio.current
        if (audio) void audio.play().catch((error) => reportLocalPlayError(error, state.localTrack?.id))
        playerStore.play()
      }
    }
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
  }, [state.source, state.isPlaying, state.localTrack?.id, spotify.command])
  const previous = useCallback(() => {
    if (state.source !== 'spotify') {
      const before = playerStore.getSnapshot()
      playerStore.previous()
      // Restarting the current local track does not reload its source effect.
      if (before.source === 'local' && before.localTrack?.id === playerStore.getSnapshot().localTrack?.id && localAudio.current) {
        localAudio.current.currentTime = 0
      }
    }
    else void spotify.command('previous')
  }, [state.source, spotify.command])
  const next = useCallback(() => {
    if (state.source !== 'spotify') {
      const before = playerStore.getSnapshot()
      playerStore.next()
      if (before.source === 'local' && before.localTrack?.id === playerStore.getSnapshot().localTrack?.id && localAudio.current) localAudio.current.currentTime = 0
    }
    else void spotify.command('next')
  }, [state.source, spotify.command])
  const seek = useCallback((time: number) => {
    if (!Number.isFinite(time)) return
    if (state.source === 'mock') playerStore.seek(time)
    else if (state.source === 'local') {
      const audio = localAudio.current
      if (audio) audio.currentTime = Math.max(0, Math.min(state.localTrack?.duration ?? time, time))
      playerStore.seek(time)
    }
    else {
      playerStore.seek(time)
      if (seekTimer.current !== null) window.clearTimeout(seekTimer.current)
      seekTimer.current = window.setTimeout(() => { void spotify.command('seek', time) }, 300)
    }
  }, [state.source, state.localTrack?.duration, spotify.command])
  const setVolume = useCallback((volume: number) => {
    if (!Number.isFinite(volume)) return
    if (state.source !== 'spotify') playerStore.setVolume(volume)
    else {
      playerStore.setVolume(volume)
      if (volumeTimer.current !== null) window.clearTimeout(volumeTimer.current)
      volumeTimer.current = window.setTimeout(() => { void spotify.command('volume', volume) }, 300)
    }
  }, [state.source, spotify.command])
  const toggleMute = useCallback(() => {
    if (state.source === 'mock') playerStore.toggleMute()
    else if (state.source === 'local') playerStore.toggleMute()
    else void spotify.command('volume', state.isMuted ? state.volume || 0.7 : 0)
  }, [state.source, state.isMuted, state.volume, spotify.command])
  const playMockTrack = useCallback((trackId: string) => playerStore.selectMockTrack(trackId), [])
  const playLocalTrack = useCallback((trackId: string, queue: typeof state.localQueue) => {
    const track = queue.find((entry) => entry.id === trackId && entry.audioSrc)
    if (!track) return false
    const pauseSpotify = state.source === 'spotify' && state.isPlaying
    const audio = localAudio.current
    if (audio) {
      audio.pause()
      audio.src = track.audioSrc!
      audio.currentTime = 0
      audio.volume = state.volume || .7
      audio.muted = false
      void audio.play().catch(() => {})
    }
    const selected = playerStore.selectLocalTrack(trackId, queue)
    if (selected && pauseSpotify) void spotify.command('pause')
    return selected
  }, [state.source, state.isPlaying, state.volume, spotify.command])

  const track = state.source === 'mock' ? mockTracks[state.trackIndex] : state.source === 'local' ? state.localTrack : state.spotifyTrack
  const canControl = state.source !== 'spotify' || Boolean(
    spotify.auth.canControl && state.spotifyPlayback?.deviceAvailable && !state.spotifyPlayback.deviceRestricted,
  )
  const canControlVolume = state.source !== 'spotify' || Boolean(canControl && state.spotifyPlayback?.supportsVolume)

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
    playLocalTrack,
  }
}
