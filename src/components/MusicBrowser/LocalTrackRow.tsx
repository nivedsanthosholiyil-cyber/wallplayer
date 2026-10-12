import { useEffect, useRef, useState } from 'react'
import { MoreHorizontal } from 'lucide-react'
import type { Track } from '../../types/music'
import type { UiTheme } from '../../types/interfaceSettings'
import type { LocalPlaylist } from '../../services/musicBrowser/localCollections'
import { ThemeGlyph } from '../Settings/ThemeArtwork'

export function LocalTrackRow({ track, index, theme, playlists, onPlay, onRelink, onRemove, onVisual, onAddPlaylist }: {
  track: Track; index: number; theme: UiTheme; playlists: LocalPlaylist[]
  onPlay: () => void; onRelink: () => void; onRemove: () => Promise<void>; onVisual: (file: File) => Promise<void>; onAddPlaylist: (playlistId: string | null, name: string) => void
}) {
  const [menu, setMenu] = useState(false)
  const [action, setAction] = useState<'playlist' | 'info' | 'remove' | null>(null)
  const [name, setName] = useState('')
  const [playlistId, setPlaylistId] = useState('')
  const [busy, setBusy] = useState(false)
  const row = useRef<HTMLDivElement>(null)
  const visual = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (!menu) return
    const outside = (event: PointerEvent) => { if (!row.current?.contains(event.target as Node)) { setMenu(false); setAction(null) } }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.stopImmediatePropagation(); setMenu(false); setAction(null) } }
    window.addEventListener('pointerdown', outside); window.addEventListener('keydown', escape, true)
    return () => { window.removeEventListener('pointerdown', outside); window.removeEventListener('keydown', escape, true) }
  }, [menu])
  return <div ref={row} className="music-browser__local-row" data-menu-open={menu}>
    <button className="music-browser__track" disabled={!track.audioSrc} onClick={onPlay} aria-label={`Play ${track.title}`}>
      <span className="music-browser__track-number">{String(index + 1).padStart(2, '0')}</span><img className="music-browser__track-art" src={track.artwork || '/artwork/local-music.svg'} alt="" loading="lazy" />
      <span className="music-browser__track-text"><strong>{track.title}</strong><small>{track.artist}</small></span><ThemeGlyph theme={theme} name="play" className="music-browser__track-play" size={14} />
    </button>
    {!track.audioSrc && <button className="music-browser__relink" onClick={onRelink}>Relink file</button>}
    <button className="music-browser__track-menu-trigger" aria-label={`Track menu for ${track.title}`} aria-expanded={menu} onClick={() => { setMenu(!menu); setAction(null) }}><MoreHorizontal size={16} /></button>
    <input ref={visual} type="file" accept="image/*,video/*" className="music-browser__file-input" aria-label={`Set visual for ${track.title}`} onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; if (file) { setBusy(true); void onVisual(file).finally(() => { setBusy(false); setMenu(false) }) } }} />
    {menu && <div className="music-browser__track-menu" role="group" aria-label={`${track.title} actions`}>
      {!action ? <><button disabled={!track.audioSrc} onClick={onPlay}>Play</button><button onClick={() => setAction('playlist')}>Add to playlist</button><button onClick={() => setAction('remove')}>Remove from library</button><button disabled={busy} onClick={() => visual.current?.click()}>Set visual</button><button onClick={() => setAction('info')}>Track information</button></>
        : action === 'info' ? <><strong>{track.title}</strong><p>{track.artist}<br />{track.album}<br />{track.localFileName}<br />{Math.floor(track.duration / 60)}:{String(Math.floor(track.duration % 60)).padStart(2,'0')}</p><button onClick={() => setAction(null)}>Back</button></>
          : action === 'remove' ? <><p>Remove from Spontaneous? The original file stays on your computer.</p><button disabled={busy} onClick={() => { setBusy(true); void onRemove().finally(() => setBusy(false)) }}>Remove</button><button onClick={() => setAction(null)}>Cancel</button></>
            : <form onSubmit={(event) => { event.preventDefault(); onAddPlaylist(playlistId || null, name.trim()); setMenu(false); setAction(null); setName('') }}>
              <label>Playlist<select value={playlistId} onChange={(event) => setPlaylistId(event.target.value)}><option value="">New local playlist</option>{playlists.map((playlist) => <option key={playlist.id} value={playlist.id}>{playlist.name}</option>)}</select></label>
              {!playlistId && <input aria-label="New playlist name" placeholder="Playlist name" maxLength={80} value={name} onChange={(event) => setName(event.target.value)} />}
              <button type="submit" disabled={!playlistId && !name.trim()}>Add</button><button type="button" onClick={() => setAction(null)}>Cancel</button>
            </form>}
    </div>}
  </div>
}
