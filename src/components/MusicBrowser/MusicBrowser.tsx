import { useEffect, useMemo, useRef, useState, type DragEvent, type ChangeEvent } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { mockMusicBrowserProvider as catalog } from '../../data/mockCatalog'
import { getRecentlyPlayed, subscribeRecentlyPlayed } from '../../services/musicBrowser/recentlyPlayed'
import type { DiscoverySection, MediaItem } from '../../services/musicBrowser/types'
import type { Track } from '../../types/music'
import type { AppearanceSettings } from '../../types/interfaceSettings'
import type { UiTheme } from '../../types/interfaceSettings'
import { ThemeGlyph } from '../Settings/ThemeArtwork'

interface MusicBrowserProps {
  open: boolean
  onOpen: () => void
  onClose: () => void
  onPlayTrack: (trackId: string) => boolean
  localTracks: Track[]
  localLoading: boolean
  localError: string
  onAddLocalFiles: (files: FileList | File[]) => void
  onRelinkLocalFile: (trackId: string, file: File) => void
  onPlayLocalTrack: (trackId: string, queue: Track[]) => boolean
  appearance?: AppearanceSettings
}

function MediaTile({ item, onSelect, onPlay, theme }: { item: MediaItem; onSelect: (item: MediaItem) => void; onPlay: (item: MediaItem) => void; theme: UiTheme }) {
  const [active, setActive] = useState(false)
  const reducedMotion = useReducedMotion()
  return (
    <motion.div
      className="music-browser__tile"
      data-active={active}
      layout={!reducedMotion}
      animate={{ width: active ? 150 : 126, y: active ? -3 : 0 }}
      transition={{ type: 'spring', stiffness: 290, damping: 32, mass: .8 }}
      onHoverStart={() => setActive(true)}
      onHoverEnd={() => setActive(false)}
      onFocus={() => setActive(true)}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setActive(false) }}
    >
      <button className="music-browser__art-button" onClick={() => onSelect(item)} aria-label={`Open ${item.title}`}>
        <img src={item.artwork} alt="" loading="lazy" />
        <motion.span className="music-browser__art-info" initial={false} animate={{ opacity: active ? 1 : 0 }} transition={{ duration: .24 }}>
          <strong>{item.title}</strong><small>{item.subtitle}</small>
        </motion.span>
      </button>
      <motion.button className="music-browser__tile-play" onClick={() => onPlay(item)} aria-label={`Play ${item.title}`} tabIndex={active ? 0 : -1} initial={false} animate={{ opacity: active ? 1 : 0, y: active ? 0 : 5 }} transition={{ duration: .22 }}><ThemeGlyph theme={theme} name="play" size={14} /></motion.button>
      <span className="music-browser__tile-caption">{item.title}</span>
    </motion.div>
  )
}

function MediaRow({ section, onSelect, onPlay, theme }: { section: DiscoverySection; onSelect: (item: MediaItem) => void; onPlay: (item: MediaItem) => void; theme: UiTheme }) {
  const rowRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const row = rowRef.current
    if (!row) return
    function onWheel(event: WheelEvent) {
      if (!row || Math.abs(event.deltaY) <= Math.abs(event.deltaX) || row.scrollWidth <= row.clientWidth) return
      event.preventDefault()
      row.scrollLeft += event.deltaY
    }
    row.addEventListener('wheel', onWheel, { passive: false })
    return () => row.removeEventListener('wheel', onWheel)
  }, [])
  return (
    <section className="music-browser__section" aria-label={section.title}>
      <h2>{section.title}</h2>
      <div className="music-browser__row" ref={rowRef}>
        {section.items.map((item) => <MediaTile key={item.id} item={item} onSelect={onSelect} onPlay={onPlay} theme={theme} />)}
      </div>
    </section>
  )
}

function TrackRow({ track, index, onPlay, theme }: { track: Track; index: number; onPlay: (track: Track) => void; theme: UiTheme }) {
  return <button className="music-browser__track" onClick={() => onPlay(track)} aria-label={`Play ${track.title}`}><span className="music-browser__track-number">{String(index + 1).padStart(2, '0')}</span><span className="music-browser__track-text"><strong>{track.title}</strong><small>{track.artist}</small></span><ThemeGlyph theme={theme} name="play" className="music-browser__track-play" size={15} /></button>
}

export function MusicBrowser({ open, onOpen, onClose, onPlayTrack, localTracks, localLoading, localError, onAddLocalFiles, onRelinkLocalFile, onPlayLocalTrack, appearance }: MusicBrowserProps) {
  const theme = appearance?.theme ?? 'default'
  const reducedMotion = useReducedMotion()
  const duration = reducedMotion || appearance?.transitionStyle === 'instant' ? 0 : (appearance?.animationSpeed ?? 100) / 100
  const offset = appearance?.transitionStyle === 'dissolve' ? 0 : -38
  const [selected, setSelected] = useState<MediaItem | null>(null)
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [recentIds, setRecentIds] = useState<string[]>(getRecentlyPlayed)
  const [draggingFiles, setDraggingFiles] = useState(false)
  const [relinkingId, setRelinkingId] = useState<string | null>(null)
  const addInput = useRef<HTMLInputElement>(null)
  const relinkInput = useRef<HTMLInputElement>(null)

  useEffect(() => subscribeRecentlyPlayed(() => setRecentIds(getRecentlyPlayed())), [])
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 220)
    return () => window.clearTimeout(timer)
  }, [query])
  useEffect(() => {
    if (!open) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        if (selected) setSelected(null)
        else onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose, selected])

  const home = useMemo(() => catalog.getHome(recentIds), [recentIds])
  const results = useMemo(() => catalog.search(debouncedQuery), [debouncedQuery])
  const hasResults = results.songs.length + results.artists.length + results.albums.length + results.playlists.length > 0
  const panelView = selected ? `detail-${selected.id}` : debouncedQuery ? 'search' : 'home'
  const visibleLocalTracks = useMemo(() => {
    const term = debouncedQuery.toLocaleLowerCase()
    return localTracks.filter((track) => !term || `${track.title} ${track.artist} ${track.album ?? ''}`.toLocaleLowerCase().includes(term))
  }, [debouncedQuery, localTracks])

  function openBrowser() {
    setSelected(null)
    setQuery('')
    setDebouncedQuery('')
    onOpen()
  }
  function playTrack(track: Track) {
    if (onPlayTrack(track.id)) onClose()
  }
  function playItem(item: MediaItem) {
    const first = catalog.getTracks(item)[0]
    if (first) playTrack(first)
  }

  function handleDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault()
    setDraggingFiles(false)
    if (event.dataTransfer.files.length) onAddLocalFiles(event.dataTransfer.files)
  }

  function handleRelinkChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]
    if (file && relinkingId) onRelinkLocalFile(relinkingId, file)
    setRelinkingId(null)
    event.currentTarget.value = ''
  }

  function playLocal(track: Track) {
    if (track.audioSrc && onPlayLocalTrack(track.id, localTracks.filter((entry) => Boolean(entry.audioSrc)))) onClose()
  }

  return <>
    {!open && <button className="music-browser__trigger" onClick={openBrowser} aria-label="Open music browser" title="Browse music"><ThemeGlyph theme={theme} name="queue" size={18} /></button>}
    <AnimatePresence>
      {open && <>
        <motion.button className="music-browser__scrim" aria-label="Close music browser" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: .45 * duration }} />
        <motion.aside className="music-browser" aria-label="Music browser" initial={{ x: reducedMotion ? 0 : offset, opacity: 0, filter: reducedMotion ? 'none' : 'blur(8px)' }} animate={{ x: 0, opacity: 1, filter: 'blur(0px)' }} exit={{ x: reducedMotion ? 0 : offset, opacity: 0, filter: reducedMotion ? 'none' : 'blur(8px)' }} transition={{ duration: .5 * duration, ease: [0.22, 1, 0.36, 1] }}>
          <div className="music-browser__top">
            <div className="music-browser__search"><ThemeGlyph theme={theme} name="search" size={17} /><input type="search" value={query} onChange={(event) => { setQuery(event.target.value); setSelected(null) }} placeholder="Search music..." aria-label="Search music" /></div>
            <button className="music-browser__close" onClick={onClose} aria-label="Close music browser"><ThemeGlyph theme={theme} name="close" size={19} /></button>
          </div>
          <div className="music-browser__scroll">
            <section
              className="music-browser__local"
              aria-label="Local Music"
              data-dragging={draggingFiles}
              onDragEnter={(event) => { event.preventDefault(); setDraggingFiles(true) }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDraggingFiles(false) }}
              onDrop={handleDrop}
            >
              <div className="music-browser__local-heading">
                <h2>LOCAL MUSIC</h2>
                <button className="music-browser__add-local" onClick={() => addInput.current?.click()}><span aria-hidden="true">+</span> Add Music</button>
              </div>
              <input ref={addInput} className="music-browser__file-input" type="file" multiple accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac" aria-label="Add local music files" onChange={(event) => { if (event.currentTarget.files?.length) onAddLocalFiles(event.currentTarget.files); event.currentTarget.value = '' }} />
              <input ref={relinkInput} className="music-browser__file-input" type="file" accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac" aria-label="Relink local music file" onChange={handleRelinkChange} />
              {visibleLocalTracks.length > 0 ? <div className="music-browser__track-list music-browser__local-list">
                {visibleLocalTracks.map((track, index) => <div className="music-browser__local-row" key={track.id}>
                  <button className="music-browser__track" disabled={!track.audioSrc} onClick={() => playLocal(track)} aria-label={track.audioSrc ? `Play ${track.title}` : `${track.title} file unavailable`}>
                    <span className="music-browser__track-number">{String(index + 1).padStart(2, '0')}</span>
                    <span className="music-browser__track-text"><strong>{track.title}</strong><small>{track.artist}{track.album && track.album !== 'Local Music' ? ` · ${track.album}` : ''}</small></span>
                    {track.audioSrc && <ThemeGlyph theme={theme} name="play" className="music-browser__track-play" size={15} />}
                  </button>
                  {!track.audioSrc && <button className="music-browser__relink" onClick={() => { setRelinkingId(track.id); relinkInput.current?.click() }}>Relink file</button>}
                </div>)}
              </div> : <p className="music-browser__local-empty">{localLoading ? 'Loading your local music…' : debouncedQuery ? 'No local tracks match this search.' : 'Add audio files or drop them here.'}</p>}
              {localError && <p className="music-browser__local-error" role="status">{localError}</p>}
            </section>
            <AnimatePresence mode="wait">
              <motion.div key={panelView} className="music-browser__content" initial={{ opacity: 0, x: reducedMotion || appearance?.transitionStyle !== 'smooth' ? 0 : 13 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: reducedMotion || appearance?.transitionStyle !== 'smooth' ? 0 : -12 }} transition={{ duration: .28 * duration, ease: 'easeOut' }}>
                {selected ? <>
                  <button className="music-browser__back" onClick={() => setSelected(null)}><ThemeGlyph theme={theme} name="back" size={17} /> Back</button>
                  <div className="music-browser__detail-hero"><img src={selected.artwork} alt="" /><div><span className="music-browser__eyebrow">{selected.type}</span><h1>{selected.title}</h1><p>{selected.subtitle}</p><button className="music-browser__hero-play" onClick={() => playItem(selected)}><ThemeGlyph theme={theme} name="play" size={15} /> Play</button></div></div>
                  {selected.description && <p className="music-browser__description">{selected.description}</p>}
                  <div className="music-browser__track-list">{catalog.getTracks(selected).map((track, index) => <TrackRow key={track.id} track={track} index={index} onPlay={playTrack} theme={theme} />)}</div>
                </> : debouncedQuery ? <div className="music-browser__results">
                  {results.songs.length > 0 && <section className="music-browser__section"><h2>Songs</h2><div className="music-browser__track-list">{results.songs.map((track, index) => <TrackRow key={track.id} track={track} index={index} onPlay={playTrack} theme={theme} />)}</div></section>}
                  {(['artists', 'albums', 'playlists'] as const).map((type) => results[type].length > 0 && <MediaRow key={type} section={{ id: type, title: type[0].toUpperCase() + type.slice(1), items: results[type] }} onSelect={setSelected} onPlay={playItem} theme={theme} />)}
                  {!hasResults && <p className="music-browser__empty">No matches in the local music collection.</p>}
                </div> : <div className="music-browser__home">{home.map((section, index) => <motion.div key={section.id} initial={{ opacity: 0, y: reducedMotion || appearance?.transitionStyle !== 'smooth' ? 0 : 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .4 * duration, delay: duration ? (.06 + index * .045) * duration : 0 }}><MediaRow section={section} onSelect={setSelected} onPlay={playItem} theme={theme} /></motion.div>)}</div>}
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.aside>
      </>}
    </AnimatePresence>
  </>
}
