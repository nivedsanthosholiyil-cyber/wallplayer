import type { ReactNode } from 'react'
import { ArrowLeft, Expand, ListMusic, Pause, Play, Repeat2, Search, Settings2, Shuffle, SkipBack, SkipForward, Volume2, VolumeX, X, TextQuote } from 'lucide-react'
import { themes, type ThemeAsset, type ThemeControl } from '../../data/themes'
import type { UiTheme } from '../../types/interfaceSettings'
import { HelloKittyArtwork, KittyBow } from './HelloKittyArtwork'

const fallbackIcons: Record<ThemeControl, typeof Play> = {
  play: Play, pause: Pause, previous: SkipBack, next: SkipForward, volume: Volume2, settings: Settings2,
  queue: ListMusic, lyrics: TextQuote, search: Search, back: ArrowLeft, close: X, fullscreen: Expand, shuffle: Shuffle, repeat: Repeat2,
}

function pathFor(asset: ThemeAsset): ReactNode {
  if (asset.type === 'image') return <image href={asset.src} x="4" y="4" width="40" height="40" preserveAspectRatio="xMidYMid meet" />
  const id = asset.id
  if (id === 'hello-kitty-previous' || id === 'hello-kitty-next') return <KittyBow direction={id === 'hello-kitty-previous' ? 'previous' : 'next'} />
  if (id === 'batman-silhouette') return <path className="theme-art__bat-emblem" d="M3 22 10 15 17 18 24 11 31 18 38 15 45 22 41 32 35 27 30 35 24 30 18 35 13 27 7 32Z" />
  if (id === 'batman-signal') return <><circle cx="24" cy="24" r="19" fill="none" stroke="currentColor" strokeWidth="1.3" /><path d="M4 24h10m20 0h10M24 4v9m0 22v9" stroke="currentColor" strokeWidth="1.3" /><path d="M9 24 15 18l5 3 4-6 4 6 5-3 6 6-3 8-5-4-3 5-4-3-4 3-3-5-5 4Z" /></>
  if (id === 'spider-emblem') return <><path d="M24 7v34M8 13l32 22M40 13 8 35M13 24h22M17 15l14 18M31 15 17 33" fill="none" stroke="currentColor" strokeWidth="2.2" /><ellipse cx="24" cy="24" rx="6" ry="9" /><path d="m19 20-6-4m16 4 6-4m-16 11-6 5m16-5 6 5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></>
  if (id === 'cute-bow-face') return <><path d="M8 16c-5-7-4-12 1-11l13 7 4 0 13-7c5-1 6 4 1 11l-9 7-7-5-7 5Z" /><circle cx="24" cy="19" r="4" /><path d="M24 24c-8 0-14 5-14 12 0 5 6 7 14 7s14-2 14-7c0-7-6-12-14-12Z" fill="none" stroke="currentColor" strokeWidth="2.2" /><circle cx="19" cy="35" r="1.7" /><circle cx="29" cy="35" r="1.7" /><path d="M22 39h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></>
  if (id === 'speed-hedgehog') return <><path d="M6 28 14 25 9 17l12 4 2-13 7 12 11-7-4 13 7 4-13 3-7 10-5-9Z" /><path d="M2 18h10M1 25h8M4 32h8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><circle cx="30" cy="25" r="1.7" fill="var(--theme-secondary, currentColor)" /></>
  if (id === 'web-corner') return <><path d="M4 4v40M4 4h40M4 16l28 28M16 4 44 32M4 28 20 44M28 4 44 20" fill="none" stroke="currentColor" strokeWidth="1.4" /><path d="M4 16q12-1 12-12M4 28q24 0 24-24M4 40q36 0 36-36" fill="none" stroke="currentColor" strokeWidth="1.1" /></>
  if (id === 'tiny-bow') return <><path d="M7 24c-5-12-1-17 7-11l10 7 10-7c8-6 12-1 7 11l-11 8-6-5-6 5Z" fill="none" stroke="currentColor" strokeWidth="2" /><circle cx="24" cy="24" r="3" /></>
  if (id === 'speed-streak') return <><path d="M2 12h27M1 20h21M4 28h28M1 36h19" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" /></>
  if (id === 'gold-ring') return <><ellipse cx="25" cy="24" rx="13" ry="18" fill="none" stroke="currentColor" strokeWidth="3" /><path d="M7 24h7m22 0h7" stroke="currentColor" strokeWidth="2" /></>
  if (id === 'batman-previous' || id === 'batman-next') return <g transform={id === 'batman-next' ? 'translate(48 0) scale(-1 1)' : undefined}>
    <path className="theme-art__batwing" d="M47 7c-7 2-13-1-19-5-4 4-8 7-14 10L2 27c7-4 13-4 19 3 6-6 13-5 18 2 3-7 6-12 9-15Z" />
    <path className="theme-art__batwing-vein" d="m28 2-7 28M28 2 17 12 3 26m14-14 7 17m2-27 18 19M34 9l11 7" />
  </g>
  if (id.endsWith('-logo') || id === 'default-orbit') return <><circle cx="24" cy="24" r="15" fill="none" stroke="currentColor" strokeWidth="2" /><circle cx="24" cy="24" r="5" /><path d="M7 24h34M24 7v34" fill="none" stroke="currentColor" strokeWidth="1.5" opacity=".65" /></>
  if (id.startsWith('batman-')) {
    const hero = id.endsWith('-play') || id.endsWith('-pause')
    if (hero) return <path className="theme-art__bat-emblem" d="M3 9H33C33 16 36 19 42 19L46 16 47 5 49 12H51L53 5 54 16 58 19C64 19 67 16 67 9H97C86 12 81 20 81 28C69 24 59 28 50 37C41 28 31 24 19 28C19 20 14 12 3 9Z" />
    return <><path className={hero ? 'theme-art__bat-emblem' : 'theme-art__ornament'} d="M3 22 10 15 17 18 24 11 31 18 38 15 45 22 41 32 35 27 30 35 24 30 18 35 13 27 7 32Z" /><g className="theme-art__control">{controlGlyph(id)}</g></>
  }
  if (id === 'spider-man-previous' || id === 'spider-man-next') {
    const Icon = id === 'spider-man-previous' ? SkipBack : SkipForward
    return <>
      <g className="theme-art__skip-web" transform={id === 'spider-man-next' ? 'translate(48 0) scale(-1 1)' : undefined}>
        <path d="M-2 0v13M-2 0h13M-2 0l9 9M-2 6q6 0 6-6M-2 12q12 0 12-12" />
      </g>
      <Icon className="theme-art__skip-symbol" x="4" y="4" width="40" height="40" strokeWidth="1.5" fill="currentColor" />
    </>
  }
  if (id.startsWith('spider-man-')) return <><circle cx="24" cy="24" r="20" fill="none" stroke="currentColor" strokeWidth="1.4" opacity=".55" /><path d="M24 5v38M5 13l38 22M43 13 5 35M8 24h32M13 8l22 32M35 8 13 40" fill="none" stroke="currentColor" strokeWidth="1" opacity=".38" />{controlGlyph(id)}</>
  if (id.startsWith('hello-kitty-')) return <><path d="M8 12C3 4 6 2 13 6l8 5m6 0 8-5c7-4 10-2 5 6l-7 7-9-5-9 5Z" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" /><circle cx="24" cy="12" r="2.2" />{controlGlyph(id)}</>
  if (id.startsWith('sonic-')) return <><circle cx="25" cy="24" r="16" fill="none" stroke="currentColor" strokeWidth="1.8" opacity=".75" /><path d="M3 14h10M1 22h8M4 30h8" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />{controlGlyph(id)}</>
  return controlGlyph(id)
}

function controlGlyph(id: string, y = 0): ReactNode {
  const control = id.split('-').at(-1)
  if (control === 'play') return <path d={`m20 ${18 + y} 13 7-13 7Z`} />
  if (control === 'pause') return <><path d={`M19 ${18 + y}v14m10-14v14`} fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" /></>
  if (control === 'previous') return <><path d="M13 15v18" stroke="currentColor" strokeWidth="2.8" /><path d="m32 15-14 9 14 9Zm10 0-14 9 14 9Z" /></>
  if (control === 'next') return <><path d="M35 15v18" stroke="currentColor" strokeWidth="2.8" /><path d="m16 15 14 9-14 9Zm-10 0 14 9-14 9Z" /></>
  if (control === 'volume') return <><path d="M8 20h7l9-7v22l-9-7H8Z" /><path d="M29 19q8 5 0 10m4-15q13 10 0 20" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" /></>
  if (control === 'settings') return <><path d="M8 13h31M8 24h31M8 35h31" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><circle cx="19" cy="13" r="3.5" /><circle cx="31" cy="24" r="3.5" /><circle cx="16" cy="35" r="3.5" /></>
  if (control === 'queue' || control === 'lyrics') return <><path d="M8 12h31M8 20h31M8 28h22M8 36h22" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" /><path d={control === 'queue' ? 'm33 30 8 5-8 5Z' : 'M31 29h10v10H31z'} /></>
  if (control === 'search') return <><circle cx="21" cy="21" r="11" fill="none" stroke="currentColor" strokeWidth="3" /><path d="m29 29 11 11" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></>
  if (control === 'back') return <><path d="M38 24H10m0 0 11-11M10 24l11 11" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></>
  if (control === 'close') return <path d="m13 13 22 22m0-22L13 35" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
  if (control === 'fullscreen') return <path d="M19 7H7v12m22-12h12v12M7 29v12h12m22-12v12H29" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
  if (control === 'shuffle') return <path d="M8 14h5c8 0 14 20 22 20h5m0 0-6-6m6 6-6 6M8 34h5c4 0 7-5 10-10s6-10 12-10h5m0 0-6-6m6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  if (control === 'repeat') return <path d="M35 17a12 12 0 0 0-10-5H14a7 7 0 0 0-7 7v2m0 0 6-5m-6 5 6 5m0 5a12 12 0 0 0 10 5h11a7 7 0 0 0 7-7v-2m0 0-6 5m6-5-6-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  return null
}

export function ThemeArtwork({ asset, theme, className = '', size = 24, playing, muted }: { asset: ThemeAsset; theme: UiTheme; className?: string; size?: number; playing?: boolean; muted?: boolean }) {
  if (asset.type === 'vector' && asset.id === 'hello-kitty-face') return <HelloKittyArtwork size={size} playing={playing} className={className} />
  if (asset.type === 'image' && asset.playingSrc) return <span className={`theme-art-image theme-art-image--state ${className}`} data-playing={Boolean(playing)} style={{ width: size, height: size }} aria-hidden="true">
    <img className="theme-art-image__paused" src={asset.src} alt="" />
    <img className="theme-art-image__playing" src={asset.playingSrc} alt="" />
  </span>
  if (asset.type === 'image') return <img className={`theme-art-image ${className}`} src={asset.src} alt={asset.alt ?? ''} width={size} height={size} style={asset.mirrorX ? { transform: 'scaleX(-1)' } : undefined} />
  const id = asset.id
  const themeId = theme
  const logoIds = ['batman-silhouette', 'spider-emblem', 'cute-bow-face', 'speed-hedgehog', 'default-orbit']
  const isControl = !logoIds.includes(id) && !id.includes('signal') && !id.includes('corner') && !id.includes('tiny-bow') && !id.includes('streak') && !id.includes('ring')
  if (themeId === 'default' && isControl) {
    const key = id.slice('default-'.length) as ThemeControl
    const Icon = key === 'volume' && muted ? VolumeX : fallbackIcons[key] ?? Play
    return <Icon className={className} size={size} strokeWidth={1.55} fill={key === 'play' || key === 'pause' || key === 'previous' || key === 'next' ? 'currentColor' : 'none'} aria-hidden="true" />
  }
  const heroBat = themeId === 'batman' && (id === 'batman-play' || id === 'batman-pause' || id === 'batman-silhouette')
  const transportBat = themeId === 'batman' && (id === 'batman-play' || id === 'batman-pause')
  const batwing = themeId === 'batman' && (id === 'batman-previous' || id === 'batman-next')
  return <svg className={`theme-art theme-art--${themeId} ${isControl ? 'theme-art--control' : 'theme-art--logo'} ${heroBat ? 'theme-art--bat-emblem' : ''} ${batwing ? 'theme-art--batwing' : ''} ${className}`} data-playing={playing} data-muted={muted} width={batwing ? size * 1.7 : transportBat ? size * 1.4 : size} height={batwing ? size * .76 : transportBat ? size * .56 : heroBat ? size * .76 : size} viewBox={batwing ? '0 0 48 32' : transportBat ? '0 0 100 40' : heroBat ? '0 0 48 34' : '0 0 48 48'} fill="currentColor" aria-hidden="true">{pathFor(asset)}{muted && <path d="m8 8 32 32" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />}</svg>
}

export function ThemeGlyph({ theme, name, size = 24, playing, muted, className = '' }: { theme: UiTheme; name: ThemeControl; size?: number; playing?: boolean; muted?: boolean; className?: string }) {
  return <ThemeArtwork theme={theme} asset={themes[theme].assets.controls[name]} size={size} playing={playing} muted={muted} className={className} />
}
