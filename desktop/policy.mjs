export const DESKTOP_PORT = 4173
export const DESKTOP_ORIGIN = `http://127.0.0.1:${DESKTOP_PORT}`
export const DESKTOP_CALLBACK = `${DESKTOP_ORIGIN}/callback`

export function isAppUrl(value) {
  try { const url = new URL(value); return url.origin === DESKTOP_ORIGIN && !url.username && !url.password }
  catch { return false }
}
export function authorizationState(value) {
  try {
    const url = new URL(value), p = url.searchParams
    if (url.origin !== 'https://accounts.spotify.com' || url.pathname !== '/authorize' || url.username || url.password || url.hash) return null
    if (p.get('redirect_uri') !== DESKTOP_CALLBACK || p.get('response_type') !== 'code' || p.get('code_challenge_method') !== 'S256') return null
    if (!/^[A-Za-z0-9_-]{43,128}$/.test(p.get('code_challenge') || '') || !/^[A-Za-z0-9_-]{16,128}$/.test(p.get('state') || '') || !p.get('client_id')) return null
    return p.get('state')
  } catch { return null }
}
export function isExternalLink(value) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password && !url.port && ['open.spotify.com', 'developer.spotify.com', 'www.pexels.com', 'pexels.com'].includes(url.hostname)
  } catch { return false }
}
// Codes travel only over the parent/child channel, never logs or disk.
export class OAuthCallbackBroker {
  pending = null
  begin(state, now = Date.now()) { this.pending = { state, expires: now + 10 * 60_000 } }
  cancel() { this.pending = null }
  accept(params, now = Date.now()) {
    if (!this.pending || now > this.pending.expires || params.getAll('state').length !== 1 || params.get('state') !== this.pending.state) return null
    const code = params.get('code'), error = params.get('error')
    if (Boolean(code) === Boolean(error) || (code || error).length > 4096 || params.getAll(code ? 'code' : 'error').length !== 1) return null
    const result = new URLSearchParams({ state: this.pending.state, ...(code ? { code } : { error }) })
    this.cancel()
    return result.toString()
  }
}
