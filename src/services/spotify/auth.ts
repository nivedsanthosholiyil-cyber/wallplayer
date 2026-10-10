const tokenKey = 'musicwall.spotify.tokens.v1'
const transactionKey = 'musicwall.spotify.pkce.v1'
const scopes = 'user-read-playback-state user-read-currently-playing streaming user-modify-playback-state'
const libraryScopes = 'playlist-read-private playlist-read-collaborative user-read-recently-played user-library-read'

interface TokenRecord {
  clientId: string
  accessToken: string
  refreshToken: string
  expiresAt: number
  scope: string
}

interface AuthTransaction {
  verifier: string
  state: string
  createdAt: number
}

export interface SpotifyAuthState {
  status: 'unconfigured' | 'disconnected' | 'connecting' | 'connected' | 'expired' | 'error'
  message: string
  canControl: boolean
  clientId: string
  configuredByEnv: boolean
}

const configuredClientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID?.trim() ?? ''
function savedClientId() {
  try { return localStorage.getItem('musicwall.spotify.client-id.v1')?.trim() || '' }
  catch { return '' }
}
let clientId = configuredClientId || savedClientId()
const redirectUri = import.meta.env.VITE_SPOTIFY_REDIRECT_URI?.trim() || `${window.location.origin}/callback`
const listeners = new Set<() => void>()

function readStorage<T>(key: string, storage: Storage = sessionStorage): T | null {
  try {
    const raw = storage.getItem(key)
    return raw ? JSON.parse(raw) as T : null
  } catch { return null }
}

function validTokens(value: unknown): value is TokenRecord {
  const record = value as TokenRecord | null
  return Boolean(record && typeof record.clientId === 'string' && record.clientId.trim()
    && typeof record.accessToken === 'string' && record.accessToken
    && typeof record.refreshToken === 'string' && record.refreshToken && Number.isFinite(record.expiresAt) && typeof record.scope === 'string')
}
function usableTokens(value: unknown): value is TokenRecord {
  return validTokens(value) && value.clientId === clientId
}
const credentialStore = window.musicwallSpotifySession
const desktopBuild = import.meta.env.MODE === 'desktop'
const storedTokens = readStorage<unknown>(tokenKey, credentialStore || desktopBuild ? sessionStorage : localStorage)
const legacyTokens = readStorage<unknown>(tokenKey)
let tokens: TokenRecord | null = usableTokens(storedTokens) ? storedTokens : usableTokens(legacyTokens) ? legacyTokens : null
if (!credentialStore && !desktopBuild && tokens) {
  // Preserve existing browser sessions, while moving credentials out of tab-only storage.
  try { localStorage.setItem(tokenKey, JSON.stringify(tokens)); sessionStorage.removeItem(tokenKey) } catch { /* Current session still works. */ }
}
let authRevision = 0
let authState: SpotifyAuthState = {
  status: !clientId ? 'unconfigured' : credentialStore ? 'connecting' : tokens ? 'connected' : 'disconnected',
  message: !clientId ? 'Add a Spotify Client ID to connect.' : '',
  canControl: Boolean(tokens?.scope.split(' ').includes('user-modify-playback-state')),
  clientId,
  configuredByEnv: Boolean(configuredClientId),
}
let callbackPromise: Promise<void> | null = null
let refreshPromise: Promise<string> | null = null
let restorePromise: Promise<void> | null = null

function setAuthState(next: Pick<SpotifyAuthState, 'status' | 'message' | 'canControl'>) {
  authState = { ...next, clientId, configuredByEnv: Boolean(configuredClientId) }
  listeners.forEach((listener) => listener())
}

async function saveTokens(payload: { access_token: string; refresh_token?: string; expires_in: number; scope?: string }, previousRefresh?: string, revision = authRevision) {
  if (revision !== authRevision) throw new Error('Spotify connection changed during authorization.')
  if (!payload.access_token || !(payload.refresh_token || previousRefresh) || !Number.isFinite(payload.expires_in) || payload.expires_in <= 0) throw new Error('Spotify did not return usable credentials.')
  const nextTokens: TokenRecord = {
    clientId,
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token || previousRefresh!,
    expiresAt: Date.now() + payload.expires_in * 1000,
    scope: payload.scope ?? tokens?.scope ?? '',
  }
  if (credentialStore) await credentialStore.write(nextTokens)
  else {
    if (desktopBuild) throw new Error('Windows credential protection is unavailable. Restart MusicWall and connect again.')
    localStorage.setItem(tokenKey, JSON.stringify(nextTokens))
  }
  if (revision !== authRevision) throw new Error('Spotify connection changed during authorization.')
  sessionStorage.removeItem(tokenKey)
  tokens = nextTokens
  setAuthState({ status: 'connected', message: '', canControl: tokens.scope.split(' ').includes('user-modify-playback-state') })
}

function forgetTokens() {
  authRevision++
  tokens = null
  sessionStorage.removeItem(tokenKey)
  localStorage.removeItem(tokenKey)
  if (credentialStore) void credentialStore.clear().catch(() => {
    setAuthState({ status: authState.status, message: 'Could not remove the saved Spotify connection. Try Disconnect again.', canControl: false })
  })
}

if (credentialStore) {
  const revision = authRevision
  restorePromise = (async () => {
    try {
      const saved = await credentialStore.read()
      if (revision !== authRevision) return
      // The encrypted record owns the connection, including the public Client ID.
      // A missing localStorage setting must not strand a valid refresh token at boot.
      // Keep an explicitly configured/edited ID authoritative for account changes.
      if (!clientId && validTokens(saved)) {
        clientId = saved.clientId
        try { localStorage.setItem('musicwall.spotify.client-id.v1', clientId) } catch { /* Protected credentials still restore this session. */ }
      }
      const restored = usableTokens(saved) ? saved : tokens
      if (restored) {
        // A protected read already handles cipher migration. Write only legacy
        // session credentials here, rather than rewriting every saved connection.
        if (restored !== saved) await credentialStore.write(restored)
        if (revision !== authRevision) return
        tokens = restored
        sessionStorage.removeItem(tokenKey); localStorage.removeItem(tokenKey)
      }
      setAuthState({ status: !clientId ? 'unconfigured' : tokens ? 'connected' : 'disconnected', message: '', canControl: Boolean(tokens?.scope.split(' ').includes('user-modify-playback-state')) })
    } catch {
      if (revision === authRevision) setAuthState({ status: 'error', message: 'Could not restore the saved Spotify connection. Connect again.', canControl: false })
    }
  })().finally(() => { restorePromise = null })
}

class TokenEndpointError extends Error {
  constructor(public reconnect: boolean) {
    super(reconnect ? 'Spotify authorization expired. Connect again.' : 'Spotify authorization is temporarily unavailable. Retrying when online.')
  }
}

async function requestToken(body: URLSearchParams) {
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!response.ok) {
    let invalidGrant = false
    try { invalidGrant = (await response.json() as { error?: string }).error === 'invalid_grant' } catch { /* Non-JSON service failures are temporary. */ }
    throw new TokenEndpointError(invalidGrant)
  }
  return response.json() as Promise<{ access_token: string; refresh_token?: string; expires_in: number; scope?: string }>
}

function randomBase64Url(bytes = 48) {
  const values = crypto.getRandomValues(new Uint8Array(bytes))
  return btoa(String.fromCharCode(...values)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

async function codeChallenge(verifier: string) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return btoa(String.fromCharCode(...new Uint8Array(hash))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

function clearCallbackUrl() {
  if (window.location.pathname === '/callback') window.history.replaceState(null, '', '/')
  else window.history.replaceState(null, '', window.location.pathname)
}

export function buildSpotifyAuthorizationUrl(publicClientId: string, callback: string, state: string, challenge: string, includeLibrary = false) {
  const url = new URL('https://accounts.spotify.com/authorize')
  url.search = new URLSearchParams({
    client_id: publicClientId,
    response_type: 'code',
    redirect_uri: callback,
    scope: includeLibrary ? `${scopes} ${libraryScopes}` : scopes,
    state,
    code_challenge_method: 'S256',
    code_challenge: challenge,
  }).toString()
  return url.toString()
}

export const spotifyAuth = {
  ready: () => restorePromise ?? Promise.resolve(),
  connectLibrary: () => spotifyAuth.connect(true),
  hasScope: (scope: string) => Boolean(tokens?.scope.split(' ').includes(scope)),
  canStream: () => Boolean(tokens?.scope.split(' ').includes('streaming')),
  redirectUri,
  getSnapshot: () => authState,
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => { listeners.delete(listener) }
  },
  setClientId(value: string) {
    if (configuredClientId || authState.status === 'connected') return
    authRevision++
    clientId = value.trim()
    if (clientId) localStorage.setItem('musicwall.spotify.client-id.v1', clientId)
    else localStorage.removeItem('musicwall.spotify.client-id.v1')
    setAuthState({ status: clientId ? 'disconnected' : 'unconfigured', message: clientId ? '' : 'Add a Spotify Client ID to connect.', canControl: false })
  },
  async connect(includeLibrary = false) {
    if (restorePromise) await restorePromise
    if (!clientId) throw new Error('Add a Spotify Client ID in Settings to connect.')
    const destination = new URL(redirectUri)
    if (destination.origin !== window.location.origin) throw new Error(`Open MusicWall at ${destination.origin} before connecting.`)
    const verifier = randomBase64Url()
    const state = randomBase64Url(24)
    sessionStorage.setItem(transactionKey, JSON.stringify({ verifier, state, createdAt: Date.now() } satisfies AuthTransaction))
    setAuthState({ status: 'connecting', message: '', canControl: false })
    window.location.assign(buildSpotifyAuthorizationUrl(clientId, redirectUri, state, await codeChallenge(verifier), includeLibrary))
  },
  completeRedirect() {
    if (callbackPromise) return callbackPromise
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const error = params.get('error')
    if (!code && !error) return Promise.resolve()
    callbackPromise = (async () => {
      if (restorePromise) await restorePromise
      const revision = authRevision
      const transaction = readStorage<AuthTransaction>(transactionKey)
      sessionStorage.removeItem(transactionKey)
      clearCallbackUrl()
      if (!transaction || transaction.state !== params.get('state') || Date.now() - transaction.createdAt > 10 * 60_000) {
        setAuthState({ status: 'error', message: 'Spotify connection could not be verified. Try again.', canControl: false })
        return
      }
      if (error) {
        setAuthState({ status: 'disconnected', message: error === 'access_denied' ? 'Spotify access was declined.' : 'Spotify connection failed.', canControl: false })
        return
      }
      if (!clientId || !code) {
        setAuthState({ status: 'unconfigured', message: 'Spotify client ID is missing.', canControl: false })
        return
      }
      setAuthState({ status: 'connecting', message: '', canControl: false })
      try {
        const result = await requestToken(new URLSearchParams({
          client_id: clientId, grant_type: 'authorization_code', code,
          redirect_uri: redirectUri, code_verifier: transaction.verifier,
        }))
        await saveTokens(result, undefined, revision)
      } catch (cause) {
        if (revision === authRevision) setAuthState({ status: 'error', message: cause instanceof Error ? cause.message : 'Spotify connection failed.', canControl: false })
      }
    })().finally(() => { callbackPromise = null })
    return callbackPromise
  },
  async getAccessToken(forceRefresh = false): Promise<string> {
    if (restorePromise) await restorePromise
    if (!tokens) throw new Error('Spotify is not connected.')
    if (!forceRefresh && tokens.expiresAt - Date.now() > 60_000) return tokens.accessToken
    if (refreshPromise) return refreshPromise
    const previousRefresh = tokens.refreshToken
    const refreshingTokens = tokens
    refreshPromise = (async () => {
      try {
        const result = await requestToken(new URLSearchParams({
          client_id: clientId, grant_type: 'refresh_token', refresh_token: previousRefresh,
        }))
        if (tokens !== refreshingTokens) throw new Error('Spotify connection changed during refresh.')
        await saveTokens(result, previousRefresh)
        return result.access_token
      } catch (cause) {
        if (tokens !== refreshingTokens) throw new Error('Spotify connection changed during refresh.')
        if (cause instanceof TokenEndpointError && cause.reconnect) {
          forgetTokens()
          setAuthState({ status: 'expired', message: 'Spotify session expired. Connect again.', canControl: false })
          throw new Error('Spotify session expired. Connect again.')
        }
        // Startup can precede network availability. Keep the refresh token on
        // offline/5xx/rate-limit failures so the existing poller can retry.
        throw new Error('Spotify could not reconnect right now. Retrying when online.')
      } finally { refreshPromise = null }
    })()
    return refreshPromise
  },
  disconnect() {
    forgetTokens()
    sessionStorage.removeItem(transactionKey)
    setAuthState({ status: clientId ? 'disconnected' : 'unconfigured', message: '', canControl: false })
  },
  invalidate() {
    forgetTokens()
    setAuthState({ status: 'expired', message: 'Spotify session expired. Connect again.', canControl: false })
  },
}
