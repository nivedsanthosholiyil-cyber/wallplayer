import { useState, type CSSProperties } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Check } from 'lucide-react'
import { themeList } from '../../data/themes'
import type { UiTheme } from '../../types/interfaceSettings'
import { ThemeMark } from './ThemeMark'
import { ThemeArtwork, ThemeGlyph } from './ThemeArtwork'

export function ThemeGallery({ selected, onSelect }: { selected: UiTheme; onSelect: (theme: UiTheme) => void }) {
  const reducedMotion = useReducedMotion()
  const [hovered, setHovered] = useState<UiTheme | null>(null)
  return <div className="theme-gallery" role="group" aria-label="Choose interface theme">
    {themeList.map((theme) => {
      const active = selected === theme.id
      const previewing = hovered === theme.id
      const style = {
        '--preview-background': theme.preview,
        '--preview-accent': theme.colors.accent,
        '--preview-secondary': theme.colors.accentSecondary,
        '--preview-surface': theme.colors.surface,
        '--preview-text': theme.colors.text,
        '--preview-glow': theme.colors.glow,
        '--preview-radius': `${theme.radius}px`,
      } as CSSProperties
      return <motion.button
        key={theme.id}
        type="button"
        className="theme-gallery__card"
        data-selected={active}
        aria-pressed={active}
        aria-label={`${theme.name} theme`}
        style={style}
        onClick={() => onSelect(theme.id)}
        onHoverStart={() => setHovered(theme.id)}
        onHoverEnd={() => setHovered(null)}
        onFocus={() => setHovered(theme.id)}
        onBlur={() => setHovered(null)}
        whileHover={reducedMotion ? undefined : { scale: 1.035, y: -2 }}
        transition={{ duration: .28, ease: [0.22, 1, 0.36, 1] }}
      >
        <span className="theme-gallery__stage" data-previewing={previewing}>
          <span className="theme-gallery__mini-tabs"><i /><i /></span>
          {theme.assets.decorations.map((asset, index) => <span key={`${theme.id}-decoration-${index}`} className="theme-gallery__decoration" style={{ left: `${7 + index * 18}px` }}><ThemeArtwork theme={theme.id} asset={asset} size={40} /></span>)}
          <ThemeMark theme={theme.id} />
          <span className="theme-gallery__transport"><ThemeGlyph theme={theme.id} name="previous" size={9} /><ThemeGlyph theme={theme.id} name="play" size={12} /><ThemeGlyph theme={theme.id} name="next" size={9} /></span>
          <span className="theme-gallery__rail"><motion.i initial={false} animate={{ width: previewing ? '68%' : '42%' }} transition={{ duration: reducedMotion ? 0 : .34, ease: 'easeOut' }} /></span>
          <span className="theme-gallery__accent-line" />
        </span>
        <span className="theme-gallery__name">{theme.name}</span>
        {active && <span className="theme-gallery__selected"><Check size={10} strokeWidth={2.4} /></span>}
      </motion.button>
    })}
  </div>
}
