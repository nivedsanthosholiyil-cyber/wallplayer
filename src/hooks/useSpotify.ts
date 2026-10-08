import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { spotifyAuth } from '../services/spotify/auth'
import { SpotifyApiError } from '../services/spotify/client'
import { spotifyPlayback, toMusicWallTrack } from '../services/spotify/playback'
import { playerStore } from '../store/playerStore'

export type SpotifyCommand = 'play' | 'pause' | 'previous' | 'next' | 'seek' | 'volume'

function errorMessage(error: unknown) {
  if (error instanceof SpotifyApiError) {
    if (error.status === 403) return 'Spotify playback control needs Premium and an available device.'
    if (error.status === 404) return 'No active Spotify device. Start playback in Spotify first.'
    if (error.status === 429) return 'Spotify is rate limiting requests. Retrying shortly.'
    return error.message
  }
  return error instanceof Error ? error.message : 'Spotify is temporarily unavailable.'
}

export function useSpotify() {
  const auth = useSyncExternalStore(spotifyAuth.subscribe, spotifyAuth.getSnapshot, spotifyAuth.getSnapshot)
  const [connectError, setConnectError] = useState('')
  const scheduleRefresh = useRef<((delay?: number) => void) | null>(null)
  const abortPoll = useRef<(() => void) | null>(null)
  const rateLimitUntil = useRef(0)
  const commandQueue = useRef<Promise<boolean | void>>(Promise.resolve())

  useEffect(() => { void spotifyAuth.completeRedirect() }, [])

  useEffect(() => {
    if (auth.status !== 'connected') rateLimitUntil.current = 0
    if (auth.status === 'connected') playerStore.useSpotify()
    else if (auth.status === 'expired') {
      playerStore.useSpotify()
      playerStore.setSpotifyStatus('expired', auth.message)
    } else if (auth.status !== 'connecting') playerStore.useMock()
  }, [auth.status, auth.message])

  useEffect(() => {
    if (auth.status !== 'connected') return
    let disposed = false
    let timer: number | null = null
    let failureCount = 0
    let controller: AbortController | null = null

    function cancelPending() {
      if (timer !== null) window.clearTimeout(timer)
      timer = null
      controller?.abort()
      controller = null
    }

    function schedule(delay = 0) {
      if (timer !== null) window.clearTimeout(timer)
      timer = null
      if (!disposed && !document.hidden && navigator.onLine) {
        timer = window.setTimeout(poll, Math.max(delay, rateLimitUntil.current - Date.now()))
      }
    }

    async function poll() {
      if (disposed || document.hidden || !navigator.onLine) return
      controller?.abort()
      const requestController = new AbortController()
      controller = requestController
      try {
        const result = await spotifyPlayback.getCurrent(requestController.signal)
        if (disposed || requestController.signal.aborted) return
        const playback = result.playback
        playerStore.applySpotifyPlayback(playback, playback ? toMusicWallTrack(playback) : null)
        if (result.reason === 'no-device') playerStore.setSpotifyStatus('unavailable', 'No active Spotify device. Start playback in Spotify first.')
        if (result.reason === 'unsupported') playerStore.setSpotifyStatus('no-track', 'Only music tracks are supported right now.')
        failureCount = 0
        rateLimitUntil.current = 0
        schedule(playback?.isPlaying ? 5_000 : 15_000)
      } catch (error) {
        if (disposed || requestController.signal.aborted) return
        if (spotifyAuth.getSnapshot().status === 'expired') {
          playerStore.setSpotifyStatus('expired', 'Spotify session expired. Connect again.')
          return
        }
        failureCount += 1
        const retryAfter = error instanceof SpotifyApiError && error.status === 429 ? error.retryAfterSeconds * 1000 : 0
        const delay = Math.max(retryAfter, Math.min(60_000, 5_000 * 2 ** Math.min(failureCount - 1, 4)))
        if (error instanceof SpotifyApiError && error.status === 429) rateLimitUntil.current = Date.now() + delay
        const message = error instanceof SpotifyApiError && error.status === 403
          ? 'Spotify playback access was denied. Reconnect with playback permission.'
          : errorMessage(error)
        playerStore.setSpotifyStatus(error instanceof SpotifyApiError && error.status === 429 ? 'error' : 'unavailable', message)
        schedule(delay)
      }
    }

    function onVisibility() {
      if (document.hidden) {
        cancelPending()
      } else { cancelPending(); schedule(0) }
    }
    function onOnline() { cancelPending(); schedule(0) }
    function onOffline() {
      cancelPending()
      playerStore.setSpotifyStatus('unavailable', 'Waiting for an internet connection.')
    }

    scheduleRefresh.current = (delay = 0) => { cancelPending(); schedule(delay) }
    abortPoll.current = cancelPending
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    schedule()
    return () => {
      disposed = true
      cancelPending()
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      scheduleRefresh.current = null
      abortPoll.current = null
    }
  }, [auth.status])

  const connect = useCallback(async () => {
    setConnectError('')
    try { await spotifyAuth.connect() }
    catch (error) { setConnectError(errorMessage(error)) }
  }, [])

  const disconnect = useCallback(() => {
    spotifyAuth.disconnect()
    setConnectError('')
  }, [])

  const executeCommand = useCallback(async (action: SpotifyCommand, value?: number) => {
    const current = playerStore.getSnapshot()
    const playback = current.spotifyPlayback
    const currentAuth = spotifyAuth.getSnapshot()
    if (currentAuth.status !== 'connected' || !currentAuth.canControl) {
      playerStore.setSpotifyStatus('error', 'Spotify playback control is not authorized.')
      return false
    }
    if (Date.now() < rateLimitUntil.current) {
      playerStore.setSpotifyStatus('error', 'Spotify is rate limiting requests. Retrying shortly.')
      return false
    }
    if (!playback?.deviceAvailable || playback.deviceRestricted) {
      playerStore.setSpotifyStatus('unavailable', 'No controllable Spotify device is active.')
      return false
    }
    if (action === 'volume' && !playback.supportsVolume) {
      playerStore.setSpotifyStatus('error', 'This Spotify device does not support volume control.')
      return false
    }
    abortPoll.current?.()
    try {
      if (action === 'play') await spotifyPlayback.play()
      if (action === 'pause') await spotifyPlayback.pause()
      if (action === 'previous') await spotifyPlayback.previous()
      if (action === 'next') await spotifyPlayback.next()
      if (action === 'seek') { await spotifyPlayback.seek(value ?? 0); playerStore.seek(value ?? 0) }
      if (action === 'volume') { await spotifyPlayback.setVolume(value ?? 0); playerStore.setVolume(value ?? 0) }
      scheduleRefresh.current?.(800)
      return true
    } catch (error) {
      playerStore.setSpotifyStatus('error', errorMessage(error))
      const delay = error instanceof SpotifyApiError && error.status === 429 ? Math.max(5_000, error.retryAfterSeconds * 1000) : 5_000
      if (error instanceof SpotifyApiError && error.status === 429) rateLimitUntil.current = Date.now() + delay
      scheduleRefresh.current?.(delay)
      return false
    }
  }, [])

  const command = useCallback((action: SpotifyCommand, value?: number) => {
    const task = commandQueue.current.then(() => executeCommand(action, value))
    commandQueue.current = task.catch(() => {})
    return task
  }, [executeCommand])

  return { auth, connect, disconnect, connectError, command, setClientId: spotifyAuth.setClientId, redirectUri: spotifyAuth.redirectUri }
}
