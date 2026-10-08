import { useEffect, useRef, useState } from 'react'
import { MoreHorizontal } from 'lucide-react'
import type { Track } from '../../types/music'
export function TrackVisualMenu({ track, onSetVisual }: { track: Track; onSetVisual: (track: Track) => void }) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const close = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false) }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    window.addEventListener('pointerdown', close)
    window.addEventListener('keydown', escape)
    return () => { window.removeEventListener('pointerdown', close); window.removeEventListener('keydown', escape) }
  }, [])
  useEffect(() => setOpen(false), [track.id])
  return <div ref={root} className="track-visual-menu">
    <button aria-label="Open track menu" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}><MoreHorizontal size={17} /></button>
    {open && <div role="menu" aria-label="Track actions"><button role="menuitem" onClick={() => { setOpen(false); onSetVisual(track) }}>Set Visual</button></div>}
  </div>
}
