import { spotifyAuth } from './auth'

export class SpotifyApiError extends Error {
  constructor(public status: number, message: string, public retryAfterSeconds = 0) {
    super(message)
    this.name = 'SpotifyApiError'
  }
}

type RequestOptions = { method?: 'GET' | 'PUT' | 'POST'; signal?: AbortSignal; body?: unknown; onTiming?: (sentAt: number, receivedAt: number) => void }

async function authorizedFetch(path: string, options: RequestOptions, retryAuth: boolean): Promise<Response> {
  const accessToken = await spotifyAuth.getAccessToken()
  const sentAt = performance.now()
  const response = await fetch(`https://api.spotify.com/v1${path}`, {
    method: options.method ?? 'GET',
    headers: { Authorization: `Bearer ${accessToken}`, ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    signal: options.signal,
  })
  const receivedAt = performance.now()
  if (response.status === 401 && retryAuth) {
    await spotifyAuth.getAccessToken(true)
    return authorizedFetch(path, options, false)
  }
  if (response.status === 401) spotifyAuth.invalidate()
  if (!response.ok) {
    let detail = ''
    try { detail = (await response.json() as { error?: { message?: string } }).error?.message ?? '' } catch { /* Some errors have no JSON body. */ }
    const retryAfter = Number(response.headers.get('Retry-After') ?? 0)
    throw new SpotifyApiError(response.status, detail || `Spotify request failed (${response.status}).`, Number.isFinite(retryAfter) ? retryAfter : 0)
  }
  options.onTiming?.(sentAt, receivedAt)
  return response
}

export const spotifyClient = {
  async request<T>(path: string, options: RequestOptions = {}): Promise<T | null> {
    const response = await authorizedFetch(path, options, true)
    if (response.status === 204) return null
    return response.json() as Promise<T>
  },
  async command(path: string, method: 'PUT' | 'POST', body?: unknown) {
    await authorizedFetch(path, { method, body }, true)
  },
}
