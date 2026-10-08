import { themes } from '../../data/themes'
import type { UiTheme } from '../../types/interfaceSettings'
import { ThemeArtwork } from './ThemeArtwork'

export function ThemeMark({ theme, className = '' }: { theme: UiTheme; className?: string }) {
  return <ThemeArtwork asset={themes[theme].assets.logo} theme={theme} size={28} className={`theme-mark ${className}`} />
}
