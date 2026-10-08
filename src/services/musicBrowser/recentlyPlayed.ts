const KEY = 'musicwall.recentlyPlayed.v1'
const EVENT = 'musicwall:recently-played'
const LIMIT = 12

export function getRecentlyPlayed(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string').slice(0, LIMIT) : []
  } catch { return [] }
}

export function recordRecentlyPlayed(trackId: string) {
  if (!trackId) return
  const next = [trackId, ...getRecentlyPlayed().filter((id) => id !== trackId)].slice(0, LIMIT)
  try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* browsing still works without storage */ }
  window.dispatchEvent(new Event(EVENT))
}

export function subscribeRecentlyPlayed(listener: () => void) {
  window.addEventListener(EVENT, listener)
  window.addEventListener('storage', listener)
  return () => {
    window.removeEventListener(EVENT, listener)
    window.removeEventListener('storage', listener)
  }
}
