const tokenKey = 'musicwall.spotify.tokens.v1'
const transactionKey = 'musicwall.spotify.pkce.v1'
const scopes = 'user-read-playback-state user-modify-playback-state'

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

function readStorage<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key)
    return raw ? JSON.parse(raw) as T : null
  } catch { return null }
}

let tokens = readStorage<TokenRecord>(tokenKey)
if (tokens?.clientId !== clientId) tokens = null
let authState: SpotifyAuthState = {
  status: !clientId ? 'unconfigured' : tokens ? 'connected' : 'disconnected',
  message: !clientId ? 'Add a Spotify Client ID to connect.' : '',
  canControl: Boolean(tokens?.scope.split(' ').includes('user-modify-playback-state')),
  clientId,
  configuredByEnv: Boolean(configuredClientId),
}
let callbackPromise: Promise<void> | null = null
let refreshPromise: Promise<string> | null = null

function setAuthState(next: Pick<SpotifyAuthState, 'status' | 'message' | 'canControl'>) {
  authState = { ...next, clientId, configuredByEnv: Boolean(configuredClientId) }
  listeners.forEach((listener) => listener())
}

function saveTokens(payload: { access_token: string; refresh_token?: string; expires_in: number; scope?: string }, previousRefresh?: string) {
  if (!payload.access_token || !(payload.refresh_token || previousRefresh)) throw new Error('Spotify did not return usable credentials.')
  const nextTokens: TokenRecord = {
    clientId,
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token || previousRefresh!,
    expiresAt: Date.now() + payload.expires_in * 1000,
    scope: payload.scope ?? tokens?.scope ?? '',
  }
  sessionStorage.setItem(tokenKey, JSON.stringify(nextTokens))
  tokens = nextTokens
  setAuthState({ status: 'connected', message: '', canControl: tokens.scope.split(' ').includes('user-modify-playback-state') })
}

async function requestToken(body: URLSearchParams) {
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!response.ok) throw new Error(response.status === 400 ? 'Spotify authorization expired. Connect again.' : 'Spotify authorization is unavailable.')
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

export function buildSpotifyAuthorizationUrl(publicClientId: string, callback: string, state: string, challenge: string) {
  const url = new URL('https://accounts.spotify.com/authorize')
  url.search = new URLSearchParams({
    client_id: publicClientId,
    response_type: 'code',
    redirect_uri: callback,
    scope: scopes,
    state,
    code_challenge_method: 'S256',
    code_challenge: challenge,
  }).toString()
  return url.toString()
}

export const spotifyAuth = {
  redirectUri,
  getSnapshot: () => authState,
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => { listeners.delete(listener) }
  },
  setClientId(value: string) {
    if (configuredClientId || authState.status === 'connected') return
    clientId = value.trim()
    if (clientId) localStorage.setItem('musicwall.spotify.client-id.v1', clientId)
    else localStorage.removeItem('musicwall.spotify.client-id.v1')
    setAuthState({ status: clientId ? 'disconnected' : 'unconfigured', message: clientId ? '' : 'Add a Spotify Client ID to connect.', canControl: false })
  },
  async connect() {
    if (!clientId) throw new Error('Add a Spotify Client ID in Settings to connect.')
    const destination = new URL(redirectUri)
    if (destination.origin !== window.location.origin) throw new Error(`Open MusicWall at ${destination.origin} before connecting.`)
    const verifier = randomBase64Url()
    const state = randomBase64Url(24)
    sessionStorage.setItem(transactionKey, JSON.stringify({ verifier, state, createdAt: Date.now() } satisfies AuthTransaction))
    setAuthState({ status: 'connecting', message: '', canControl: false })
    window.location.assign(buildSpotifyAuthorizationUrl(clientId, redirectUri, state, await codeChallenge(verifier)))
  },
  completeRedirect() {
    if (callbackPromise) return callbackPromise
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const error = params.get('error')
    if (!code && !error) return Promise.resolve()
    callbackPromise = (async () => {
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
        saveTokens(result)
      } catch (cause) {
        setAuthState({ status: 'error', message: cause instanceof Error ? cause.message : 'Spotify connection failed.', canControl: false })
      }
    })().finally(() => { callbackPromise = null })
    return callbackPromise
  },
  async getAccessToken(forceRefresh = false): Promise<string> {
    if (!tokens) throw new Error('Spotify is not connected.')
    if (!forceRefresh && tokens.expiresAt - Date.now() > 60_000) return tokens.accessToken
    if (refreshPromise) return refreshPromise
    const previousRefresh = tokens.refreshToken
    refreshPromise = (async () => {
      try {
        const result = await requestToken(new URLSearchParams({
          client_id: clientId, grant_type: 'refresh_token', refresh_token: previousRefresh,
        }))
        saveTokens(result, previousRefresh)
        return result.access_token
      } catch {
        tokens = null
        sessionStorage.removeItem(tokenKey)
        setAuthState({ status: 'expired', message: 'Spotify session expired. Connect again.', canControl: false })
        throw new Error('Spotify session expired. Connect again.')
      } finally { refreshPromise = null }
    })()
    return refreshPromise
  },
  disconnect() {
    tokens = null
    sessionStorage.removeItem(tokenKey)
    sessionStorage.removeItem(transactionKey)
    setAuthState({ status: clientId ? 'disconnected' : 'unconfigured', message: '', canControl: false })
  },
  invalidate() {
    tokens = null
    sessionStorage.removeItem(tokenKey)
    setAuthState({ status: 'expired', message: 'Spotify session expired. Connect again.', canControl: false })
  },
}
