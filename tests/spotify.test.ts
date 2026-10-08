import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'

const clientId = 'test-public-client-id'
const transactionKey = 'musicwall.spotify.pkce.v1'

function jsonResponse(body: unknown, status = 200, headers?: HeadersInit) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } })
}

beforeEach(() => {
  vi.resetModules()
  vi.stubEnv('VITE_SPOTIFY_CLIENT_ID', clientId)
  vi.stubEnv('VITE_SPOTIFY_REDIRECT_URI', 'http://127.0.0.1:5173/callback')
  sessionStorage.clear()
  localStorage.clear()
  window.history.replaceState(null, '', '/')
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('Spotify PKCE callback', () => {
  it('does not reuse tokens issued to a different Spotify app', async () => {
    sessionStorage.setItem('musicwall.spotify.tokens.v1', JSON.stringify({ clientId: 'other-app', accessToken: 'old-token', refreshToken: 'old-refresh', expiresAt: Date.now() + 3600_000, scope: 'user-read-playback-state' }))
    const { spotifyAuth } = await import('../src/services/spotify/auth')
    expect(spotifyAuth.getSnapshot()).toMatchObject({ status: 'disconnected', canControl: false })
  })

  it('builds an authorization request with only the required public PKCE fields', async () => {
    const { buildSpotifyAuthorizationUrl } = await import('../src/services/spotify/auth')
    const url = new URL(buildSpotifyAuthorizationUrl(clientId, 'http://127.0.0.1:5173/callback', 'random-state', 'sha256-challenge'))
    expect(url.origin).toBe('https://accounts.spotify.com')
    expect(url.searchParams.get('response_type')).toBe('code')
    expect(url.searchParams.get('code_challenge_method')).toBe('S256')
    expect(url.searchParams.get('scope')).toBe('user-read-playback-state user-modify-playback-state')
    expect(url.searchParams.has('client_secret')).toBe(false)
  })

  it('rejects a mismatched OAuth state without exchanging the code', async () => {
    sessionStorage.setItem(transactionKey, JSON.stringify({ verifier: 'verifier', state: 'expected', createdAt: Date.now() }))
    window.history.replaceState(null, '', '/callback?code=code-1&state=wrong')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const { spotifyAuth } = await import('../src/services/spotify/auth')
    await spotifyAuth.completeRedirect()
    expect(spotifyAuth.getSnapshot().status).toBe('error')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(window.location.search).toBe('')
  })

  it('exchanges a verified code without a client secret and refreshes the token', async () => {
    sessionStorage.setItem(transactionKey, JSON.stringify({ verifier: 'test-verifier', state: 'safe-state', createdAt: Date.now() }))
    window.history.replaceState(null, '', '/callback?code=code-1&state=safe-state')
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: 'access-1', refresh_token: 'refresh-1', expires_in: 1, scope: 'user-read-playback-state user-modify-playback-state' }))
      .mockResolvedValueOnce(jsonResponse({ access_token: 'access-2', expires_in: 3600 }))
    vi.stubGlobal('fetch', fetchMock)
    const { spotifyAuth } = await import('../src/services/spotify/auth')
    await spotifyAuth.completeRedirect()
    expect(spotifyAuth.getSnapshot()).toMatchObject({ status: 'connected', canControl: true })
    const firstBody = fetchMock.mock.calls[0][1].body as URLSearchParams
    expect(Object.fromEntries(firstBody)).toMatchObject({ client_id: clientId, code_verifier: 'test-verifier', grant_type: 'authorization_code' })
    expect(firstBody.has('client_secret')).toBe(false)
    expect(window.location.pathname).toBe('/')
    expect(await spotifyAuth.getAccessToken()).toBe('access-2')
    expect(fetchMock.mock.calls[1][1].body.get('refresh_token')).toBe('refresh-1')
  })
})

describe('Spotify playback normalization and MusicWall state', () => {
  it('maps track, artist, album, artwork, device and position into the player store', async () => {
    sessionStorage.setItem('musicwall.spotify.tokens.v1', JSON.stringify({ clientId, accessToken: 'test-token', refreshToken: 'test-refresh', expiresAt: Date.now() + 3600_000, scope: 'user-read-playback-state user-modify-playback-state' }))
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      is_playing: true,
      progress_ms: 42_000,
      item: { type: 'track', id: 'track-123', name: 'Night Drive', duration_ms: 205_000, artists: [{ id: 'artist-1', name: 'Artist One' }, { id: 'artist-2', name: 'Artist Two' }], album: { name: 'Moonlight', images: [{ url: 'https://example.com/cover.jpg', width: 640 }] } },
      device: { id: 'device-1', is_restricted: false, supports_volume: true, volume_percent: 62 },
    }))
    vi.stubGlobal('fetch', fetchMock)
    const { spotifyPlayback, toMusicWallTrack } = await import('../src/services/spotify/playback')
    const { playerStore } = await import('../src/store/playerStore')
    const result = await spotifyPlayback.getCurrent()
    expect(result.reason).toBe('track')
    expect(result.playback).toMatchObject({ trackId: 'track-123', title: 'Night Drive', album: 'Moonlight', duration: 205, position: 42, isPlaying: true, supportsVolume: true })
    const track = toMusicWallTrack(result.playback!)
    playerStore.useSpotify()
    playerStore.applySpotifyPlayback(result.playback, track)
    expect(playerStore.getSnapshot()).toMatchObject({ source: 'spotify', currentTime: 42, isPlaying: true, spotifyTrack: { id: 'track-123', artist: 'Artist One, Artist Two', artwork: 'https://example.com/cover.jpg' } })
    playerStore.tick(0.5)
    expect(playerStore.getSnapshot().currentTime).toBe(42.5)
    expect(track.lyrics).toEqual([])
  })

  it('honors Retry-After on rate limits and distinguishes an inactive device', async () => {
    sessionStorage.setItem('musicwall.spotify.tokens.v1', JSON.stringify({ clientId, accessToken: 'test-token', refreshToken: 'test-refresh', expiresAt: Date.now() + 3600_000, scope: 'user-read-playback-state' }))
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(jsonResponse({ error: { message: 'Too many requests' } }, 429, { 'Retry-After': '12' }))
    vi.stubGlobal('fetch', fetchMock)
    const { spotifyPlayback } = await import('../src/services/spotify/playback')
    const { SpotifyApiError } = await import('../src/services/spotify/client')
    expect(await spotifyPlayback.getCurrent()).toEqual({ playback: null, reason: 'no-device' })
    await expect(spotifyPlayback.getCurrent()).rejects.toMatchObject({ status: 429, retryAfterSeconds: 12 })
    expect(SpotifyApiError.name).toBe('SpotifyApiError')
  })

  it('refreshes after an API 401 and sends playback controls with the new token', async () => {
    sessionStorage.setItem('musicwall.spotify.tokens.v1', JSON.stringify({ clientId, accessToken: 'old-token', refreshToken: 'refresh-token', expiresAt: Date.now() + 3600_000, scope: 'user-read-playback-state user-modify-playback-state' }))
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ error: { message: 'Expired' } }, 401))
      .mockResolvedValueOnce(jsonResponse({ access_token: 'new-token', expires_in: 3600 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)
    const { spotifyPlayback } = await import('../src/services/spotify/playback')
    await spotifyPlayback.pause()
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.spotify.com/v1/me/player/pause')
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer old-token')
    expect(fetchMock.mock.calls[1][0]).toBe('https://accounts.spotify.com/api/token')
    expect(fetchMock.mock.calls[2][1].headers.Authorization).toBe('Bearer new-token')
  })

  it('updates the lyric target and timing when Spotify changes tracks', async () => {
    const { normalizePlayback, toMusicWallTrack } = await import('../src/services/spotify/playback')
    const { playerStore } = await import('../src/store/playerStore')
    const { lyricWindow } = await import('../src/hooks/useLyrics')
    const first = normalizePlayback({
      is_playing: true, progress_ms: 3_000,
      item: { type: 'track', id: 'first', name: 'First', duration_ms: 90_000, artists: [{ id: 'a', name: 'A' }], album: { name: 'Album A', images: [] } },
    })!
    const second = normalizePlayback({
      is_playing: false, progress_ms: 21_000,
      item: { type: 'track', id: 'second', name: 'Second', duration_ms: 120_000, artists: [{ id: 'b', name: 'B' }], album: { name: 'Album B', images: [] } },
    })!
    playerStore.useSpotify()
    playerStore.applySpotifyPlayback(first, toMusicWallTrack(first))
    playerStore.applySpotifyPlayback(second, toMusicWallTrack(second))
    expect(playerStore.getSnapshot()).toMatchObject({ currentTime: 21, isPlaying: false, spotifyTrack: { id: 'second', title: 'Second', album: 'Album B' } })
    const providerLines = [
      { id: 'line-1', start: 0, end: 20, text: 'Earlier', singer: 'artist-a' as const },
      { id: 'line-2', start: 20, end: 40, text: 'Current', singer: 'artist-a' as const },
    ]
    expect(lyricWindow(providerLines, playerStore.getSnapshot().currentTime).current?.text).toBe('Current')
  })
})
