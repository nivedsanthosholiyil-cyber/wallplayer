import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import type { Track } from '../../types/music'
import type { WallpaperSettings } from '../../types/interfaceSettings'
import { chooseVideoFile, visualLibrary, type PexelsVideo, type SavedVisual, type VisualSearch } from '../../services/visuals/VisualLibrary'
import { useMotionSettings } from '../../hooks/useMotionSettings'

export function SetVisualPanel({ track, settings, onClose, onSaved }: { track: Track; settings: WallpaperSettings; onClose: () => void; onSaved: (message: string) => void }) {
  const movement = useMotionSettings()
  const [viewportRatio, setViewportRatio] = useState(window.innerWidth / window.innerHeight)
  const [query, setQuery] = useState(`${track.artist} ${track.title}`)
  const [orientation, setOrientation] = useState('landscape')
  const [result, setResult] = useState<VisualSearch | null>(null)
  const [searchedQuery, setSearchedQuery] = useState('')
  const [searchedOrientation, setSearchedOrientation] = useState('landscape')
  const [preview, setPreview] = useState<PexelsVideo | null>(null)
  const [saved, setSaved] = useState<SavedVisual | null>(null)
  const [checking, setChecking] = useState(true)
  const [busy, setBusy] = useState<'search' | 'save' | 'remove' | null>(null)
  const [error, setError] = useState('')
  const controller = useRef<AbortController | null>(null)
  const panel = useRef<HTMLDivElement>(null)
  const field = useRef<HTMLInputElement>(null)
  const mounted = useRef(true)
  useEffect(() => {
    const resize = () => setViewportRatio(window.innerWidth / window.innerHeight)
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])
  useEffect(() => {
    mounted.current = true
    const abort = new AbortController()
    const previous = document.activeElement as HTMLElement | null
    field.current?.focus()
    void visualLibrary.getVisual(track.id, abort.signal).then((visual) => { if (!abort.signal.aborted) setSaved(visual) }).catch((error: unknown) => { if (!abort.signal.aborted) setError(error instanceof Error ? error.message : 'Could not read saved visual.') }).finally(() => { if (!abort.signal.aborted) setChecking(false) })
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.stopImmediatePropagation(); onClose() }
      if (event.key === 'Tab' && panel.current) {
        const items = Array.from(panel.current.querySelectorAll<HTMLElement>('button:not([disabled]), input, select, a[href]'))
        const first = items[0], last = items.at(-1)
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => { mounted.current = false; abort.abort(); controller.current?.abort(); window.removeEventListener('keydown', onKey, true); previous?.focus() }
  }, [track.id, onClose])
  async function search(page = 1) {
    controller.current?.abort()
    const abort = new AbortController()
    controller.current = abort
    setBusy('search'); setError(''); setPreview(null)
    const phrase = page === 1 ? query.trim() : searchedQuery
    const direction = page === 1 ? orientation : searchedOrientation
    try {
      const results = await visualLibrary.search(phrase, direction, page, abort.signal)
      if (abort.signal.aborted || !mounted.current) return
      setResult(results); setSearchedQuery(phrase); setSearchedOrientation(direction)
    } catch (error) { if (!abort.signal.aborted && mounted.current) setError(error instanceof Error ? error.message : 'Search failed.') }
    finally { if (!abort.signal.aborted && mounted.current) setBusy(null) }
  }
  async function save(video: PexelsVideo) {
    const file = chooseVideoFile(video)
    if (!file) { setError('No compatible MP4 is available.'); return }
    controller.current?.abort()
    const abort = new AbortController(); controller.current = abort
    setBusy('save'); setError('')
    try { await visualLibrary.saveVisual(track, video, file, abort.signal); if (mounted.current && !abort.signal.aborted) onSaved('Visual saved') }
    catch (error) { if (mounted.current && !abort.signal.aborted) setError(error instanceof Error ? error.message : 'Download failed.') }
    finally { if (mounted.current && !abort.signal.aborted) setBusy(null) }
  }
  async function remove() {
    setBusy('remove'); setError('')
    try { await visualLibrary.removeVisual(track.id); if (mounted.current) onSaved('Visual removed') }
    catch (error) { if (mounted.current) setError(error instanceof Error ? error.message : 'Could not remove visual.') }
    finally { if (mounted.current) setBusy(null) }
  }
  const previewFile = preview && chooseVideoFile(preview)
  return <div className="visual-panel-layer">
    <button className="visual-panel-scrim" aria-label="Close visual search" onClick={onClose} tabIndex={-1} />
    <motion.div ref={panel} className="visual-panel" role="dialog" aria-modal="true" aria-labelledby="visual-panel-title" initial={{ opacity: 0, y: movement.panelSlide }} animate={{ opacity: 1, y: 0 }} transition={{ duration: movement.uiDuration, ease: 'easeOut' }}>
      <header><div><h2 id="visual-panel-title">Set Background Visual</h2><p>{track.artist} — {track.title}</p></div><button aria-label="Close visual search" onClick={onClose}><X size={18} /></button></header>
      <form onSubmit={(event) => { event.preventDefault(); void search() }}>
        <input ref={field} aria-label="Search Pexels videos" value={query} onChange={(event) => setQuery(event.target.value)} maxLength={200} placeholder="Search Pexels" />
        <select aria-label="Video orientation" value={orientation} onChange={(event) => setOrientation(event.target.value)}><option value="landscape">Landscape</option><option value="portrait">Portrait</option><option value="square">Square</option><option value="">Any</option></select>
        <button disabled={!query.trim() || Boolean(busy)} type="submit">{busy === 'search' ? 'Searching…' : 'Search Pexels'}</button>
      </form>
      {!checking && saved && <div className="visual-saved"><span>Saved visual · {saved.width} × {saved.height}</span><button disabled={Boolean(busy)} onClick={() => { setResult(null); field.current?.focus() }}>Replace Visual</button><button disabled={Boolean(busy)} onClick={() => { void remove() }}>Remove Visual</button></div>}
      {busy === 'save' && <p role="status">Downloading to your local visual library…</p>}
      {busy === 'remove' && <p role="status">Removing visual…</p>}
      {error && <p className="visual-panel-error" role="alert">{error}</p>}
      {preview && previewFile && <div className="visual-preview"><div className="visual-preview-scene" style={{ width: 260 * viewportRatio, aspectRatio: viewportRatio }}><video key={preview.id} src={previewFile.link} poster={preview.thumbnail} autoPlay muted loop playsInline onLoadedData={(event) => { event.currentTarget.playbackRate = settings.videoSpeed }} onError={() => setError('Preview could not load. Try another video.')} style={{ filter: `brightness(${settings.brightness}%) contrast(${settings.contrast}%) saturate(${settings.saturation}%) blur(${settings.blur}px)`, opacity: settings.backgroundOpacity / 100, objectPosition: settings.position === 'custom' ? `${settings.customX}% ${settings.customY}%` : 'center' }} /><div className="video-background__temperature" style={{ background: settings.colorTemperature >= 0 ? `rgba(255, 164, 92, ${settings.colorTemperature / 100 * .36})` : `rgba(88, 155, 255, ${-settings.colorTemperature / 100 * .36})` }} /><div className="visual-preview-wash" style={{ opacity: settings.overlayOpacity / 100 }} /><div className="visual-preview-vignette" style={{ opacity: settings.vignette / 40 }} /><div className="video-background__grain" /></div><button disabled={Boolean(busy)} onClick={() => { void save(preview) }}>Use Visual</button></div>}
      {result && <>
        {!result.videos.length && <p className="settings-note">No videos found. Try a broader phrase such as “ocean” or “neon rain”.</p>}
        <div className="visual-results">{result.videos.map((video) => { const file = chooseVideoFile(video); return <article key={video.id}>
          <button className="visual-thumbnail" onClick={() => { setError(''); setPreview(video) }} disabled={Boolean(busy)} aria-label={`Preview video ${video.id}`}><img src={video.thumbnail} alt={`Video by ${video.creator}`} loading="lazy" /><span>{Math.round(video.duration)}s · {file?.width} × {file?.height}</span></button>
          <div className="visual-result-actions"><button disabled={Boolean(busy)} onClick={() => { setError(''); setPreview(video) }}>Preview</button><button disabled={Boolean(busy) || !file} onClick={() => { void save(video) }}>Use Visual</button></div>
          <a href={video.creatorUrl} target="_blank" rel="noreferrer">{video.creator}</a>
        </article> })}</div>
        <nav className="visual-pagination" aria-label="Video result pages"><button disabled={result.page <= 1 || Boolean(busy)} onClick={() => { void search(result.page - 1) }}>Previous</button><span>{result.page}</span><button disabled={!result.hasNext || Boolean(busy)} onClick={() => { void search(result.page + 1) }}>Next</button></nav>
      </>}
      <footer><a href="https://www.pexels.com" target="_blank" rel="noreferrer">Videos provided by Pexels</a><span>Downloaded only when you choose Use Visual.</span></footer>
    </motion.div>
  </div>
}
