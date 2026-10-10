import { useLayoutEffect, useRef, useState } from 'react'
import { effectiveLyricStyle, lyricStyleVariables } from '../../data/lyricStyles'
import type { LyricPreferences } from '../../types/preferences'

// Untimed lyrics cannot drive Dual Split or follow a playback clock reliably.
// Keep every line available in small, manually advanced pages instead of clipping
// the entire song or inventing timestamps.
export function PlainLyrics({ lines, preferences }: { lines: string[]; preferences: LyricPreferences }) {
  const [page, setPage] = useState(0)
  const pages = Math.ceil(lines.length / 3)
  const content = useRef<HTMLDivElement>(null)
  const style = effectiveLyricStyle(preferences)
  useLayoutEffect(() => {
    const element = content.current
    if (!element) return
    const fit = () => {
      element.style.fontSize = ''
      const size = parseFloat(getComputedStyle(element).fontSize)
      if (!size || !element.clientHeight || !element.clientWidth) return
      let low = Math.min(12, size), high = size
      for (let step = 0; step < 10; step++) {
        const candidate = (low + high) / 2
        element.style.fontSize = `${candidate}px`
        if (element.scrollHeight <= element.clientHeight && element.scrollWidth <= element.clientWidth) low = candidate
        else high = candidate
      }
      element.style.fontSize = `${low}px`
    }
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null
    observer?.observe(element)
    fit()
    let disposed = false
    void document.fonts?.ready.then(() => { if (!disposed) fit() })
    return () => { disposed = true; observer?.disconnect() }
  }, [page, lines, preferences])
  return <section className={`lyrics lyrics-plain lyrics--preset-${style.preset}`} style={lyricStyleVariables(style, preferences)} aria-label="Unsynchronized lyrics">
    <p className="lyrics-plain__notice">Synced lyrics unavailable · Read lyrics</p>
    <div ref={content} className="lyrics-plain__content" aria-live="polite">{lines.slice(page * 3, page * 3 + 3).map((line, index) => <p key={`${page}-${index}`}>{line}</p>)}</div>
    <nav className="lyrics-plain__pages" aria-label="Lyric pages">
      <button aria-label="Previous lyric page" disabled={page === 0} onClick={() => setPage(page - 1)}>‹</button>
      <span>{page + 1} / {pages}</span>
      <button aria-label="Next lyric page" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>›</button>
    </nav>
  </section>
}
