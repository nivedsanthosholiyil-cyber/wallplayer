import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useMotionSettings } from '../../hooks/useMotionSettings'
import { mockMusicBrowserProvider as catalog } from '../../data/mockCatalog'
import { mockTracks } from '../../data/mockTrack'
import type { DiscoverySection, MediaItem } from '../../services/musicBrowser/types'
import { getBrowserRecent, getLocalPlaylists, localPlaylistItem, recordBrowserRecent, saveLocalPlaylists, type RecentTrack } from '../../services/musicBrowser/localCollections'
import { spotifyMusicBrowser, libraryError } from '../../services/musicBrowser/spotifyBrowser'
import { useMusicBrowser } from '../../hooks/useMusicBrowser'
import { spotifyAuth } from '../../services/spotify/auth'
import type { Track } from '../../types/music'
import type { AppearanceSettings, UiTheme } from '../../types/interfaceSettings'
import { ThemeGlyph } from '../Settings/ThemeArtwork'
import { LocalTrackRow } from './LocalTrackRow'

interface MusicBrowserProps {
  open: boolean; onOpen: () => void; onClose: () => void; onPlayTrack: (trackId: string) => boolean
  localTracks: Track[]; localLoading: boolean; localError: string
  onAddLocalFiles: (files: FileList | File[]) => void; onRelinkLocalFile: (trackId: string, file: File) => void
  onPlayLocalTrack: (trackId: string, queue: Track[]) => boolean
  onRemoveLocalTrack: (trackId: string) => Promise<void>; onSetLocalVisual: (trackId: string, file: File) => Promise<void>
  spotifyConnected: boolean; onConnectSpotify: () => void
  currentTrack: Track | null; playbackSource: 'spotify' | 'local' | 'mock'; isPlaying: boolean
  appearance?: AppearanceSettings
}
function SourceLink({ item }: { item: MediaItem }) { return item.sourceUrl ? <a className="music-browser__spotify-link" href={item.sourceUrl} target="_blank" rel="noreferrer" aria-label={`View ${item.title} on Spotify`}>Spotify ↗</a> : null }
function MediaRow({ section, onSelect, onPlay, theme }: { section: DiscoverySection; onSelect: (item: MediaItem) => void; onPlay: (item: MediaItem) => void; theme: UiTheme }) {
  const row = useRef<HTMLDivElement>(null)
  const movement = useMotionSettings()
  const [edges, setEdges] = useState({ left: true, right: true })
  function measure() {
    const element = row.current
    if (element) setEdges({ left: element.scrollLeft <= 1, right: element.scrollLeft + element.clientWidth >= element.scrollWidth - 1 })
  }
  useEffect(() => {
    measure()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    if (row.current) observer?.observe(row.current)
    window.addEventListener('resize', measure)
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure) }
  }, [section.items.length])
  function shift(direction: number) {
    const element = row.current
    if (!element) return
    const card = element.querySelector<HTMLElement>('.music-browser__tile')
    const step = (card?.getBoundingClientRect().width || 102) + 12
    element.scrollBy({ left: direction * step * Math.max(1, Math.floor(element.clientWidth / step)), behavior: movement.enabled ? 'smooth' : 'instant' })
  }
  return <section className="music-browser__section" aria-label={section.title}><div className="music-browser__section-heading"><h2>{section.title}</h2>{section.items.length > 0 && <div className="music-browser__carousel-arrows"><button aria-label={`Scroll ${section.title} left`} disabled={edges.left} onClick={() => shift(-1)}>‹</button><button aria-label={`Scroll ${section.title} right`} disabled={edges.right} onClick={() => shift(1)}>›</button></div>}</div>{section.note && <p className="music-browser__section-note">{section.note}</p>}<div ref={row} className="music-browser__row" onScroll={measure} onKeyDown={(event) => { if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); shift(event.key === 'ArrowRight' ? 1 : -1) } }}>{section.items.map((item) => <div className="music-browser__tile" key={`${item.source}:${item.type}:${item.id}`}>
    <button className="music-browser__art-button" onClick={() => onSelect(item)} aria-label={`${item.type === 'track' ? 'Play' : 'Open'} ${item.title}`}><img src={item.artwork} alt="" loading="lazy" /></button>
    <button className="music-browser__tile-play" onClick={() => onPlay(item)} aria-label={`Play ${item.title}`}><ThemeGlyph theme={theme} name="play" size={14} /></button>
    <span className="music-browser__tile-caption">{item.title}</span><small className="music-browser__tile-artist">{item.subtitle}</small><SourceLink item={item} />
  </div>)}</div>{!section.items.length && <p className="music-browser__section-note">{section.id === 'recent' ? 'Your played tracks will appear here.' : 'Add local tracks to a playlist from their menu.'}</p>}</section>
}
function TrackRow({ track, index, onPlay, theme, spotify = false }: { track: Track; index: number; onPlay: (track: Track) => void; theme: UiTheme; spotify?: boolean }) {
  return <div className="music-browser__result-row"><button className="music-browser__track" onClick={() => onPlay(track)} aria-label={`Play ${track.title}`}><span className="music-browser__track-number">{String(index + 1).padStart(2,'0')}</span><img className="music-browser__track-art" src={track.artwork || '/artwork/local-music.svg'} alt="" loading="lazy" /><span className="music-browser__track-text"><strong>{track.title}</strong><small>{track.artist}</small></span><ThemeGlyph theme={theme} name="play" className="music-browser__track-play" size={14} /></button>{spotify && <a href={`https://open.spotify.com/track/${track.id}`} target="_blank" rel="noreferrer" aria-label={`View ${track.title} on Spotify`}>↗</a>}</div>
}
const trackItem = (track: Track, source: RecentTrack['source']): MediaItem => ({ id: track.id, type: 'track', title: track.title, subtitle: track.artist, artwork: track.artwork || '/artwork/local-music.svg', trackIds: [track.id], source, sourceUrl: source === 'spotify' ? `https://open.spotify.com/track/${track.id}` : undefined })

export function MusicBrowser(props: MusicBrowserProps) {
  const { open, onOpen, onClose, onPlayTrack, localTracks, localLoading, localError, onAddLocalFiles, onRelinkLocalFile, onPlayLocalTrack, onRemoveLocalTrack, onSetLocalVisual, spotifyConnected, onConnectSpotify, currentTrack, playbackSource, isPlaying, appearance } = props
  const theme = appearance?.theme ?? 'default'
  const movement = useMotionSettings()
  const reducedMotion = !movement.enabled
  const duration = appearance?.transitionStyle === 'instant' ? 0 : movement.uiDuration * (appearance?.animationSpeed ?? 100) / 100
  const [history, setHistory] = useState<MediaItem[]>([])
  const selected = history.at(-1) || null
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [searchOffset, setSearchOffset] = useState(0)
  const [detailOffset, setDetailOffset] = useState(0)
  const [recent, setRecent] = useState(getBrowserRecent)
  const [playlists, setPlaylists] = useState(getLocalPlaylists)
  const [notice, setNotice] = useState('')
  const [playing, setPlaying] = useState(false)
  const [dragging, setDragging] = useState(false)
  const addInput = useRef<HTMLInputElement>(null)
  const relinkInput = useRef<HTMLInputElement>(null)
  const relinkingId = useRef('')
  const scroll = useRef<HTMLDivElement>(null)
  const searchInput = useRef<HTMLInputElement>(null)
  const remote = useMusicBrowser(open, spotifyConnected, debouncedQuery, selected, searchOffset, detailOffset)
  useEffect(() => { const timer = window.setTimeout(() => { setDebouncedQuery(query.trim()); setSearchOffset(0) }, 300); return () => window.clearTimeout(timer) }, [query])
  useEffect(() => { if (currentTrack && isPlaying) { recordBrowserRecent(currentTrack, playbackSource); setRecent(getBrowserRecent()) } }, [currentTrack?.id, playbackSource, isPlaying])
  useEffect(() => {
    if (!open) return
    searchInput.current?.focus()
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { if (selected) back(); else onClose() } }
    window.addEventListener('keydown', escape)
    return () => window.removeEventListener('keydown', escape)
  }, [open, selected, onClose])
  function choose(item: MediaItem) { if (item.type === 'track') { void playItem(item); return }; setHistory((entries) => [...entries, item]); setDetailOffset(0); setNotice(''); if (scroll.current) scroll.current.scrollTop = 0 }
  function back() { setHistory((entries) => entries.slice(0,-1)); setDetailOffset(0); setNotice(''); if (scroll.current) scroll.current.scrollTop = 0 }
  const filteredLocal = localTracks.filter((track) => !debouncedQuery || `${track.title} ${track.artist} ${track.album || ''}`.toLowerCase().includes(debouncedQuery.toLowerCase()))
  const results = spotifyConnected ? remote.results : catalog.search(debouncedQuery)
  const detailTracks = selected?.source === 'spotify' ? remote.detail.tracks : selected?.source === 'local' ? selected.trackIds.map((id) => localTracks.find((track) => track.id === id)).filter((track): track is Track => Boolean(track)) : selected ? catalog.getTracks(selected) : []
  const seen = new Set<string>()
  const recentTracks = [...recent, ...remote.home.recent.map((track): RecentTrack => ({ track, source: 'spotify' }))].filter((entry) => { const key = `${entry.source}:${entry.track.id}`; if (seen.has(key) || entry.source === 'local' && !localTracks.some((track) => track.id === entry.track.id)) return false; seen.add(key); return true }).slice(0,12)
  const home: DiscoverySection[] = [
    { id: 'recent', title: 'RECENTLY PLAYED', items: recentTracks.map((entry) => trackItem(entry.track, entry.source)) },
    { id: 'made', title: 'MADE FOR YOU', items: remote.home.saved.length ? remote.home.saved.map((track) => trackItem(track,'spotify')) : catalog.getHome([])[1].items, note: remote.home.saved.length ? 'From your saved Spotify music' : 'MusicWall sample collection' },
    { id: 'playlists', title: 'YOUR PLAYLISTS', items: [...playlists.map((playlist) => localPlaylistItem(playlist, localTracks)), ...remote.home.playlists, ...(!spotifyConnected ? catalog.getHome([])[2].items : [])] },
  ]
  async function play(track: Track, source: RecentTrack['source'], queue?: Track[], shuffle = false) {
    if (playing) return
    setNotice(''); setPlaying(true)
    try {
      if (source === 'spotify') await spotifyMusicBrowser.play(queue || [track], shuffle)
      else if (source === 'local') { if (!onPlayLocalTrack(track.id, (queue || localTracks).filter((entry) => entry.audioSrc))) throw new Error('Relink this file before playing it.') }
      else if (!onPlayTrack(track.id)) throw new Error('This sample track is unavailable.')
      recordBrowserRecent(track, source); setRecent(getBrowserRecent())
    } catch (cause) { setNotice(libraryError(cause)) }
    finally { setPlaying(false) }
  }
  async function playItem(item: MediaItem) {
    if (item.type === 'track') {
      const track = item.source === 'local' ? localTracks.find((track) => track.id === item.id) : item.source === 'spotify' ? [...recentTracks.map((entry) => entry.track), ...remote.home.saved, ...results.songs].find((track) => track.id === item.id) : mockTracks.find((track) => track.id === item.id)
      if (track) await play(track, item.source || 'mock'); return
    }
    if (item.source === 'spotify') {
      if (item.type === 'artist') { choose(item); return }
      try {
        const page = await spotifyMusicBrowser.detail(item)
        if (page.tracks[0]) await play(page.tracks[0], 'spotify', page.tracks)
        else { choose(item); setNotice('Spotify did not return playable tracks for this collection.') }
      } catch (cause) { setNotice(libraryError(cause)) }
      return
    }
    const tracks = item.source === 'local' ? item.trackIds.map((id) => localTracks.find((track) => track.id === id)).filter((track): track is Track => Boolean(track)) : catalog.getTracks(item)
    if (tracks[0]) await play(tracks[0], item.source || 'mock', tracks)
  }
  function playCollection(shuffle: boolean) {
    const tracks = [...detailTracks].filter((track) => selected?.source !== 'local' || track.audioSrc)
    if (!tracks.length) return
    if (shuffle && selected?.source !== 'spotify') for (let i = tracks.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i+1)); [tracks[i],tracks[j]] = [tracks[j],tracks[i]] }
    void play(tracks[0], selected?.source || 'mock', tracks, shuffle)
  }
  function addToPlaylist(track: Track, playlistId: string | null, name: string) {
    const next = playlistId ? playlists.map((playlist) => playlist.id === playlistId ? { ...playlist, trackIds: [...new Set([...playlist.trackIds, track.id])] } : playlist) : [...playlists, { id: `local-playlist-${crypto.randomUUID()}`, name, trackIds: [track.id] }]
    try { saveLocalPlaylists(next); setPlaylists(next); setNotice('Added to local playlist') } catch { setNotice('Playlist storage is unavailable.') }
  }
  const tracks = (list: Track[], source: RecentTrack['source']) => <div className="music-browser__track-list">{list.map((track,index) => <TrackRow key={`${track.id}:${index}`} track={track} index={index} theme={theme} spotify={source === 'spotify'} onPlay={(track) => { void play(track,source,selected ? list.slice(index) : undefined) }} />)}</div>
  return <>
    {!open && <button className="music-browser__trigger" onClick={() => { setHistory([]); setQuery(''); setDebouncedQuery(''); onOpen() }} aria-label="Open music browser" title="Browse music"><ThemeGlyph theme={theme} name="queue" size={18} /></button>}
    <AnimatePresence>{open && <>
      <motion.button className="music-browser__scrim" aria-label="Close music browser" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration }} />
      <motion.aside className="music-browser" aria-label="Music browser" initial={{ x: reducedMotion ? 0 : -movement.panelSlide, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: reducedMotion ? 0 : -movement.panelSlide, opacity: 0 }} transition={{ duration, ease: 'easeOut' }}>
        <div className="music-browser__top"><div className="music-browser__search"><ThemeGlyph theme={theme} name="search" size={15} /><input ref={searchInput} type="search" value={query} onChange={(event) => { setQuery(event.target.value); setHistory([]); setNotice('') }} placeholder="Search music..." aria-label="Search music" /></div><button className="music-browser__close" onClick={onClose} aria-label="Close music browser"><ThemeGlyph theme={theme} name="close" size={18} /></button></div>
        <div ref={scroll} className="music-browser__scroll">
          <input ref={addInput} className="music-browser__file-input" type="file" multiple accept="audio/*,.mp3,.wav,.flac,.m4a,.ogg,.aac" aria-label="Add local music files" onChange={(event) => { if (event.currentTarget.files?.length) onAddLocalFiles(event.currentTarget.files); event.currentTarget.value = '' }} />
          <input ref={relinkInput} className="music-browser__file-input" type="file" accept="audio/*,.mp3,.wav,.flac,.m4a,.ogg,.aac" aria-label="Relink local music file" onChange={(event) => { const file = event.currentTarget.files?.[0]; if (file) onRelinkLocalFile(relinkingId.current,file); event.currentTarget.value = '' }} />
          {notice && <p className="music-browser__notice" role="status">{notice}</p>}
          {selected ? <div className="music-browser__content">
            <button className="music-browser__back" onClick={back}><ThemeGlyph theme={theme} name="back" size={16} /> Back</button>
            <div className="music-browser__detail-hero"><img src={selected.artwork} alt="" loading="lazy" /><div><span className="music-browser__eyebrow">{selected.source === 'local' ? 'Local playlist' : selected.type}</span><h1>{selected.title}</h1><p>{selected.subtitle}</p><SourceLink item={selected} /></div></div>
            {selected.description && <p className="music-browser__description">{selected.description}</p>}
            {selected.type !== 'artist' && <div className="music-browser__detail-actions"><button disabled={playing || !detailTracks.length} onClick={() => playCollection(false)}><ThemeGlyph theme={theme} name="play" size={14} /> Play</button><button disabled={playing || !detailTracks.length} onClick={() => playCollection(true)}>Shuffle</button></div>}
            {remote.loading && <p className="music-browser__notice" role="status">Loading collection…</p>}{remote.error && <p className="music-browser__notice" role="status">{remote.error}</p>}
            {tracks(detailTracks,selected.source || 'mock')}
            {remote.detail.items.length > 0 && selected.source === 'spotify' && <MediaRow section={{ id: 'artist-albums', title: 'ALBUMS', items: remote.detail.items }} theme={theme} onSelect={choose} onPlay={playItem} />}
            {!remote.loading && !remote.error && !detailTracks.length && !(selected.source === 'spotify' && remote.detail.items.length) && <p className="music-browser__notice">No playable tracks in this collection.</p>}
            {selected.source === 'spotify' && remote.detail.hasNext && <button className="music-browser__load-more" disabled={remote.loading} onClick={() => setDetailOffset((offset) => offset + (selected.type === 'artist' ? 8 : 40))}>Load more</button>}
          </div> : <>
            {debouncedQuery && <button className="music-browser__back" onClick={() => { setQuery(''); setDebouncedQuery('') }}><ThemeGlyph theme={theme} name="back" size={16} /> Library</button>}
            <section className="music-browser__local" aria-label="Local Music" data-dragging={dragging} onDragEnter={(event) => { event.preventDefault(); setDragging(true) }} onDragOver={(event) => event.preventDefault()} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false) }} onDrop={(event) => { event.preventDefault(); setDragging(false); if (event.dataTransfer.files.length) onAddLocalFiles(event.dataTransfer.files) }}>
              <div className="music-browser__local-heading"><h2>LOCAL MUSIC</h2><button className="music-browser__add-local" onClick={() => addInput.current?.click()}><span aria-hidden="true">+</span> Add Music</button></div>
              <div className="music-browser__track-list music-browser__local-list">{filteredLocal.map((track,index) => <LocalTrackRow key={track.id} track={track} index={index} theme={theme} playlists={playlists} onPlay={() => { void play(track,'local') }} onRelink={() => { relinkingId.current = track.id; relinkInput.current?.click() }} onRemove={async () => { await onRemoveLocalTrack(track.id); const next = playlists.map((playlist) => ({ ...playlist, trackIds: playlist.trackIds.filter((id) => id !== track.id) })); try { saveLocalPlaylists(next); setPlaylists(next) } catch { setNotice('Could not update playlists.') } }} onVisual={(file) => onSetLocalVisual(track.id,file)} onAddPlaylist={(id,name) => addToPlaylist(track,id,name)} />)}</div>
              {!filteredLocal.length && <p className="music-browser__local-empty">{localLoading ? 'Loading local music…' : debouncedQuery ? 'No local matches.' : 'Add audio files or drop them here.'}</p>}{localError && <p className="music-browser__local-error" role="status">{localError}</p>}
            </section>
            {debouncedQuery ? <div className="music-browser__results">
              {remote.loading && <p className="music-browser__notice" role="status">Searching Spotify…</p>}{remote.error && <p className="music-browser__notice" role="status">{remote.error}</p>}
              {results.songs.length > 0 && <section className="music-browser__section"><h2>SONGS</h2>{tracks(results.songs,spotifyConnected ? 'spotify' : 'mock')}</section>}
              {(['artists','albums','playlists'] as const).map((type) => results[type].length > 0 && <section className="music-browser__section" key={type}><h2>{type.toUpperCase()}</h2><div className="music-browser__track-list">{results[type].map((item) => <div className="music-browser__result-row" key={item.id}><button className="music-browser__track" onClick={() => choose(item)} aria-label={`Open ${item.title}`}><img className="music-browser__track-art" src={item.artwork} alt="" loading="lazy" /><span className="music-browser__track-text"><strong>{item.title}</strong><small>{item.subtitle}</small></span></button><SourceLink item={item} /></div>)}</div></section>)}
              {!remote.loading && !remote.error && !Object.values(results).some((value) => Array.isArray(value) && value.length) && <p className="music-browser__notice">No matches. Try another search.</p>}
              {spotifyConnected && <div className="music-browser__pagination"><button disabled={!searchOffset || remote.loading} onClick={() => setSearchOffset((offset) => Math.max(0,offset-8))}>Previous</button><span>{searchOffset / 8 + 1}</span><button disabled={!remote.results.hasNext || remote.loading} onClick={() => setSearchOffset((offset) => offset+8)}>Next</button></div>}
            </div> : <div className="music-browser__home">{home.map((section) => <MediaRow key={section.id} section={section} theme={theme} onSelect={choose} onPlay={playItem} />)}{spotifyConnected && remote.homeNote && <p className="music-browser__notice">{remote.homeNote}</p>}{spotifyConnected && (!spotifyAuth.hasScope('user-read-recently-played') || !spotifyAuth.hasScope('user-library-read')) && <button className="music-browser__load-more" onClick={onConnectSpotify}>Reconnect for library access</button>}</div>}
          </>}
        </div>
      </motion.aside>
    </>}</AnimatePresence>
  </>
}
