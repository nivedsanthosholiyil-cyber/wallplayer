import type { Track } from '../../types/music'

export interface LyricLine { startMs?: number; endMs?: number; text: string }
export interface LyricsResult { synced: boolean; lines: LyricLine[] }
export interface LyricsProvider { getLyrics(track: Track, signal?: AbortSignal): Promise<LyricsResult | null> }
interface LyricsRecord { trackName?: string; artistName?: string; albumName?: string; duration?: number; syncedLyrics?: string; plainLyrics?: string; instrumental?: boolean }
const normalizedName = (name: string) => name.normalize('NFKC').toLocaleLowerCase().trim()

export function parseLrc(lrc: string, duration: number): LyricLine[] {
  const offset = Number(lrc.match(/\[offset:([+-]?\d+)\]/i)?.[1] ?? 0)
  const entries: { startMs: number; text: string }[] = []
  for (const row of lrc.split(/\r?\n/)) {
    const text = row.replace(/\[[^\]]*\]/g, '').trim()
    for (const match of row.matchAll(/\[(\d+):(\d{2})(?:[.:](\d{1,3}))?\]/g)) {
      const startMs = Math.max(0, Number(match[1]) * 60000 + Number(match[2]) * 1000 + Number((match[3] ?? '').padEnd(3, '0')) + offset)
      if (startMs < duration * 1000) entries.push({ startMs, text })
    }
  }
  entries.sort((a, b) => a.startMs - b.startMs)
  const grouped: typeof entries = []
  for (const entry of entries) {
    const previous = grouped.at(-1)
    if (previous?.startMs === entry.startMs) previous.text = [previous.text, entry.text].filter(Boolean).join(' / ')
    else grouped.push({ ...entry })
  }
  return grouped.map((entry, index) => ({ ...entry, endMs: grouped[index + 1]?.startMs ?? duration * 1000 })).filter((entry) => entry.text)
}

export class LrclibProvider implements LyricsProvider {
  constructor(private baseUrl = import.meta.env.VITE_LYRICS_API_URL?.trim() || 'https://lrclib.net/api') {}
  async getLyrics(track: Track, signal?: AbortSignal): Promise<LyricsResult | null> {
    const url = new URL(`${this.baseUrl.replace(/\/$/, '')}/get`, window.location.origin)
    url.search = new URLSearchParams({ track_name: track.title, artist_name: track.artists?.[0]?.name || track.artist, album_name: track.album || '', duration: String(Math.round(track.duration)) }).toString()
    const response = await fetch(url, { signal })
    if (!response.ok && response.status !== 404) throw new Error(`Lyrics lookup failed (${response.status})`)
    let record: LyricsRecord | null = response.status === 404 ? null : await response.json() as LyricsRecord
    if (record?.instrumental) return null
    let lines = record?.syncedLyrics ? parseLrc(record.syncedLyrics, track.duration) : []
    if (!lines.length) {
      // Different releases can have plain lyrics on the exact album and timed lyrics on another.
      // Accept only exact artist/title matches within two seconds of Spotify's duration.
      const searchUrl = new URL(url)
      searchUrl.pathname = searchUrl.pathname.replace(/\/get$/, '/search')
      searchUrl.searchParams.delete('album_name')
      searchUrl.searchParams.delete('duration')
      try {
        const search = await fetch(searchUrl, { signal })
        if (!search.ok) throw new Error(`Lyrics search failed (${search.status})`)
        const candidates = await search.json() as LyricsRecord[]
        const match = candidates.filter((candidate) =>
          normalizedName(candidate.trackName || '') === normalizedName(track.title) &&
          normalizedName(candidate.artistName || '') === normalizedName(track.artists?.[0]?.name || track.artist) &&
          typeof candidate.duration === 'number' && Math.abs(candidate.duration - track.duration) <= 2 &&
          candidate.syncedLyrics && !candidate.instrumental,
        ).sort((a, b) => Number(normalizedName(b.albumName || '') === normalizedName(track.album || '')) - Number(normalizedName(a.albumName || '') === normalizedName(track.album || '')) || Math.abs(a.duration! - track.duration) - Math.abs(b.duration! - track.duration))[0]
        if (match) { lines = parseLrc(match.syncedLyrics!, track.duration); if (lines.length) record = match }
      } catch (error) {
        if (signal?.aborted) throw error
        if (import.meta.env.DEV) console.warn('[Lyrics] Search fallback failed', error)
      }
    }
    if (lines.length) return { synced: true, lines }
    const plain = record?.plainLyrics?.split(/\r?\n/).map((text) => ({ text })).filter((line) => line.text.trim()) ?? []
    return plain.length ? { synced: false, lines: plain } : null
  }
}

export class LyricsService {
  private cache = new Map<string, LyricsResult | null>()
  constructor(private provider: LyricsProvider = new LrclibProvider()) {}
  async getLyrics(track: Track, signal?: AbortSignal): Promise<LyricsResult | null> {
    const key = `${track.id}|${track.artist}|${track.title}|${track.duration}`
    if (this.cache.has(key)) return this.cache.get(key)!
    const result = await this.provider.getLyrics(track, signal)
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    this.cache.set(key, result)
    if (this.cache.size > 100) this.cache.delete(this.cache.keys().next().value!)
    return result
  }
  async getSyncedLyrics(track: Track, signal?: AbortSignal) {
    const result = await this.getLyrics(track, signal)
    return result?.synced ? result : null
  }
  clearCache() { this.cache.clear() }
}
export const lyricsService = new LyricsService()
