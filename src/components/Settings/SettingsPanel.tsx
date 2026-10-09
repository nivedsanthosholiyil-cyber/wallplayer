import { useEffect, useId, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { SingerId, VisualSource, Track } from '../../types/music'
import type { LyricFontFamily, LyricLayout, LyricPreferences, LyricPreset, LyricStyle, PortableLayout } from '../../types/preferences'
import { effectiveLyricStyle, fontFamilies, lyricPresets, presetValues } from '../../data/lyricStyles'
import type { AppearanceSettings, WallpaperPreset, WallpaperSettings } from '../../types/interfaceSettings'
import type { CustomWallpaper } from '../../hooks/useInterfaceSettings'
import { Setting } from './SettingsField'
import { AppearanceSettingsPage } from './AppearanceSettingsPage'
import { WallpaperSettingsPage } from './WallpaperSettingsPage'
import { ThemeGlyph } from './ThemeArtwork'
import { ThemeArtwork } from './ThemeArtwork'
import { themes } from '../../data/themes'
import { useMotionSettings } from '../../hooks/useMotionSettings'
import { cinematicNavigation } from '../Player/cinematicNavigation'
import { LyricSettingsPreview } from './LyricSettingsPreview'

type UpdatePreference = <K extends keyof LyricPreferences>(key: K, value: LyricPreferences[K]) => void

interface SettingsPanelProps {
  open: boolean
  preferences: LyricPreferences
  onChange: UpdatePreference
  onClose: () => void
  portableOpen: boolean
  onTogglePortable: () => void
  spotify: {
    auth: { status: 'unconfigured' | 'disconnected' | 'connecting' | 'connected' | 'expired' | 'error'; message: string; canControl: boolean; clientId: string; configuredByEnv: boolean }
    connect: () => Promise<void>
    disconnect: () => void
    connectError: string
    setClientId: (value: string) => void
    redirectUri: string
  }
  playbackMessage: string
  appearance: AppearanceSettings
  wallpaper: WallpaperSettings
  onAppearanceChange: <K extends keyof AppearanceSettings>(key: K, value: AppearanceSettings[K]) => void
  onWallpaperChange: <K extends keyof WallpaperSettings>(key: K, value: WallpaperSettings[K]) => void
  onWallpaperPreset: (preset: WallpaperPreset) => void
  currentVisual: VisualSource
  customWallpaper: CustomWallpaper | null
  wallpaperError: string
  onUploadWallpaper: (file: File) => Promise<void>
  onRemoveWallpaper: () => Promise<void>
  spotifyTrack?: Track | null
  onSetVisual?: (track: Track) => void
}

const layouts: { id: LyricLayout; label: string }[] = [
  { id: 'centered', label: 'Centered' },
  { id: 'duet', label: 'Dual Split' },
  { id: 'minimal', label: 'Minimal' },
  { id: 'cinematic', label: 'Cinematic' },
]

export function SettingsPanel({ open, preferences, onChange, onClose, portableOpen, onTogglePortable, spotify, playbackMessage, appearance, wallpaper, onAppearanceChange, onWallpaperChange, onWallpaperPreset, currentVisual, customWallpaper, wallpaperError, onUploadWallpaper, onRemoveWallpaper, spotifyTrack, onSetVisual }: SettingsPanelProps) {
  const closeButton = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLElement>(null)
  const body = useRef<HTMLDivElement>(null)
  const tabsId = useId()
  const [styleTarget, setStyleTarget] = useState<'all' | SingerId>('all')
  const [page, setPage] = useState<'music' | 'appearance' | 'wallpaper'>('music')
  const movement = useMotionSettings()
  const navigation = cinematicNavigation(movement, appearance)
  const [direction, setDirection] = useState(1)
  const target = preferences.layout === 'duet' ? styleTarget : 'all'
  const style = effectiveLyricStyle(preferences, target === 'all' ? undefined : target)

  function updateStyle(patch: Partial<LyricStyle>) {
    if (target === 'all') onChange('style', { ...preferences.style, ...patch })
    else onChange('singerStyles', { ...preferences.singerStyles, [target]: { ...preferences.singerStyles[target], ...patch } })
  }

  function selectPreset(preset: LyricPreset) { updateStyle(presetValues(preset)) }

  function resetSingerStyle() {
    if (target === 'all') return
    const singerStyles = { ...preferences.singerStyles }
    delete singerStyles[target]
    onChange('singerStyles', singerStyles)
  }

  function selectPage(next: typeof page) {
    if (next === page) return
    const pages = ['music', 'appearance', 'wallpaper']
    setDirection(pages.indexOf(next) > pages.indexOf(page) ? 1 : -1)
    setPage(next)
    body.current?.scrollTo({ top: 0, behavior: 'instant' })
  }

  useEffect(() => {
    if (!open) return
    const previousFocus = document.activeElement
    closeButton.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
        return
      }
      if (event.key !== 'Tab' || !panel.current) return
      const focusable = Array.from(panel.current.querySelectorAll<HTMLElement>('button:not([disabled]):not([tabindex="-1"]), input:not([disabled]), select:not([disabled])'))
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (!first || !last) return
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => { window.removeEventListener('keydown', onKeyDown); if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus() }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="settings-layer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: navigation.panel + (navigation.moving ? .16 : 0), ease: navigation.ease }}>
          <button className="settings-layer__scrim" onClick={onClose} aria-label="Close settings" tabIndex={-1} />
          <motion.aside ref={panel} className="settings-panel" role="dialog" aria-modal="true" aria-label="Settings" initial={{ opacity: 0, y: navigation.settingsTravel }} animate={{ opacity:1, y:0 }} exit={{ opacity:0,y:navigation.settingsTravel,transition:{duration:navigation.panel,ease:navigation.ease} }} transition={{ duration: navigation.panel, ease: navigation.ease }}>
            <header className="settings-panel__header"><h2>Settings</h2>{appearance.theme === 'batman' && <ThemeArtwork className="settings-panel__theme-decoration" asset={themes.batman.assets.decorations[0]} theme="batman" size={56} />}<button ref={closeButton} className="settings-panel__close" onClick={onClose} aria-label="Close settings"><ThemeGlyph theme={appearance.theme} name="close" size={18} /></button></header>
            <nav className="settings-tabs" aria-label="Settings pages" role="tablist">
              {([['music', 'Music & Lyrics'], ['appearance', 'Appearance'], ['wallpaper', 'Wallpaper']] as const).map(([id, label]) => <button key={id} id={`${tabsId}-${id}`} role="tab" aria-controls={`${tabsId}-content`} aria-selected={page === id} tabIndex={page === id ? 0 : -1} className={page === id ? 'is-selected' : ''} onClick={() => selectPage(id)} onKeyDown={(event) => {
                const pages = ['music', 'appearance', 'wallpaper'] as const
                const index = pages.indexOf(id)
                const next = event.key === 'ArrowRight' ? pages[(index + 1) % 3] : event.key === 'ArrowLeft' ? pages[(index + 2) % 3] : event.key === 'Home' ? pages[0] : event.key === 'End' ? pages[2] : null
                if (next) { event.preventDefault(); selectPage(next); document.getElementById(`${tabsId}-${next}`)?.focus() }
              }}>{label}</button>)}
            </nav>
            <div ref={body} className="settings-panel__body">
            <AnimatePresence mode="wait" initial={false} custom={direction}>
              <motion.div key={page} id={`${tabsId}-content`} className="settings-panel__content" role="tabpanel" aria-labelledby={`${tabsId}-${page}`} custom={direction} variants={{enter:(direction:number)=>({opacity:0,y:direction * Math.min(12, navigation.viewTravel)}),show:{opacity:1,y:0},leave:(direction:number)=>({opacity:0,y:-direction * Math.min(12, navigation.viewTravel)})}} initial="enter" animate="show" exit="leave" transition={{ duration: Math.min(.4, navigation.view) / 2, ease: navigation.ease }}>
            {page === 'music' && <>

            <section className="settings-section" aria-labelledby="layout-heading">
              <h3 id="layout-heading">Lyrics Layout</h3>
              <div className="settings-layouts" role="group" aria-label="Lyric layout">
                {layouts.map(({ id, label }) => <button key={id} className={`settings-layouts__option ${preferences.layout === id ? 'is-selected' : ''}`} onClick={() => onChange('layout', id)} aria-pressed={preferences.layout === id}>{label}</button>)}
              </div>
            </section>

            <section className="settings-section" aria-labelledby="appearance-heading">
              <h3 id="appearance-heading">Lyric Appearance</h3>
              {preferences.layout === 'duet' && <>
                <Setting label="Style target" value="">
                  <select value={styleTarget} onChange={(event) => setStyleTarget(event.target.value as 'all' | SingerId)}>
                    <option value="all">Both singers</option><option value="artist-a">Artist A</option><option value="artist-b">Artist B</option>
                  </select>
                </Setting>
                {target !== 'all' && preferences.singerStyles[target] && <button className="settings-style-reset" onClick={resetSingerStyle}>Use main style for {target === 'artist-a' ? 'Artist A' : 'Artist B'}</button>}
              </>}
              <Setting label="Font preset" value="">
                <select value={style.preset} onChange={(event) => selectPreset(event.target.value as LyricPreset)}>
                  {Object.entries(lyricPresets).map(([id, preset]) => <option key={id} value={id}>{preset.label}</option>)}
                </select>
              </Setting>
              <Setting label="Font family" value="">
                <select value={style.fontFamily} onChange={(event) => updateStyle({ fontFamily: event.target.value as LyricFontFamily })}>
                  <option value="preset">Preset default</option>
                  {Object.entries(fontFamilies).map(([id, family]) => <option key={id} value={id}>{family.label}</option>)}
                </select>
              </Setting>
              <LyricSettingsPreview preferences={preferences} style={style} />
              <Setting label="Font size" value={`${style.fontSize}%`}><input type="range" min="75" max="145" step="5" value={style.fontSize} onChange={(event) => updateStyle({ fontSize: Number(event.target.value) })} /></Setting>
              <Setting label="Font weight" value="">
                <select value={style.fontWeight} onChange={(event) => updateStyle({ fontWeight: Number(event.target.value) as LyricStyle['fontWeight'] })}>
                  <option value="400">Regular</option><option value="500">Medium</option><option value="600">Semibold</option><option value="700">Bold</option>
                </select>
              </Setting>
              <Setting label="Letter spacing" value={`${style.letterSpacing.toFixed(2)}em`}><input type="range" min="-0.06" max="0.14" step="0.005" value={style.letterSpacing} onChange={(event) => updateStyle({ letterSpacing: Number(event.target.value) })} /></Setting>
              <Setting label="Line height" value={style.lineHeight.toFixed(2)}><input type="range" min="1" max="1.6" step="0.01" value={style.lineHeight} onChange={(event) => updateStyle({ lineHeight: Number(event.target.value) })} /></Setting>
              <Setting label="Text opacity" value={`${style.textOpacity}%`}><input type="range" min="40" max="100" step="5" value={style.textOpacity} onChange={(event) => updateStyle({ textOpacity: Number(event.target.value) })} /></Setting>
              <Setting label="Other-line opacity" value={`${style.adjacentOpacity}%`}><input type="range" min="15" max="70" step="5" value={style.adjacentOpacity} onChange={(event) => updateStyle({ adjacentOpacity: Number(event.target.value) })} /></Setting>
              <Setting label="Active lyric brightness" value={`${style.activeBrightness}%`}><input type="range" min="65" max="100" step="5" value={style.activeBrightness} onChange={(event) => updateStyle({ activeBrightness: Number(event.target.value) })} /></Setting>
              <Setting label="Text glow" value={`${style.glow}%`}><input type="range" min="0" max="70" step="1" value={style.glow} onChange={(event) => updateStyle({ glow: Number(event.target.value) })} /></Setting>
              <Setting label="Other-line blur" value={`${style.blur.toFixed(1)}px`}><input type="range" min="0" max="4" step="0.1" value={style.blur} onChange={(event) => updateStyle({ blur: Number(event.target.value) })} /></Setting>
              <Setting label="Background blur" value={`${preferences.backgroundBlur}px`}><input type="range" min="0" max="16" step="1" value={preferences.backgroundBlur} onChange={(event) => onChange('backgroundBlur', Number(event.target.value))} /></Setting>
              <Setting label="Animation style" value="">
                <select value={style.animationStyle} onChange={(event) => updateStyle({ animationStyle: event.target.value as LyricStyle['animationStyle'] })}>
                  <option value="float">Float</option><option value="fade">Soft fade</option><option value="none">None</option>
                </select>
              </Setting>
              <Setting label="Animation speed" value={`${style.animationSpeed.toFixed(2)}s`}><input type="range" min="0.2" max="1.2" step="0.05" value={style.animationSpeed} onChange={(event) => updateStyle({ animationSpeed: Number(event.target.value) })} /></Setting>
              <Setting label="Visible lines" value=""><select value={preferences.maxVisibleLines} onChange={(event) => onChange('maxVisibleLines', Number(event.target.value) as 1 | 3 | 5)}><option value="1">1 line</option><option value="3">3 lines</option><option value="5">5 lines</option></select></Setting>
              <Setting label="Position" value=""><select value={preferences.position} onChange={(event) => onChange('position', event.target.value as LyricPreferences['position'])}><option value="upper">Upper</option><option value="center">Center</option><option value="lower">Lower</option></select></Setting>
              <Setting label="Text alignment" value=""><select value={preferences.textAlignment} onChange={(event) => onChange('textAlignment', event.target.value as LyricPreferences['textAlignment'])}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></Setting>
            </section>

            <section className="settings-section" aria-labelledby="portable-heading">
              <h3 id="portable-heading">Portable Lyrics Window</h3>
              <Setting label="Window layout" value="">
                <select value={preferences.portableLayout} onChange={(event) => onChange('portableLayout', event.target.value as PortableLayout)}>
                  <option value="centered">Centered</option><option value="duet">Duet / Split</option><option value="minimal">Minimal</option>
                </select>
              </Setting>
              <Setting label="Window width" value={`${preferences.portableWidth}px`}><input type="range" min="300" max="640" step="10" value={preferences.portableWidth} onChange={(event) => onChange('portableWidth', Number(event.target.value))} /></Setting>
              <Setting label="Glass opacity" value={`${Math.round(preferences.portableOpacity * 100)}%`}><input type="range" min="0.25" max="0.95" step="0.01" value={preferences.portableOpacity} onChange={(event) => onChange('portableOpacity', Number(event.target.value))} /></Setting>
              <button className="settings-portable-action" onClick={onTogglePortable}>{portableOpen ? 'Close portable lyrics' : 'Open portable lyrics'}</button>
            </section>

            <section className="settings-section" aria-labelledby="spotify-heading">
              <h3 id="spotify-heading">Spotify</h3>
              {!spotify.auth.configuredByEnv && spotify.auth.status !== 'connected' && <Setting label="Client ID" value="">
                <input className="settings-text-input" type="text" value={spotify.auth.clientId} onChange={(event) => spotify.setClientId(event.target.value)} autoComplete="off" spellCheck={false} placeholder="Spotify app Client ID" />
              </Setting>}
              {spotify.auth.status !== 'connected' && <p className="settings-note">Register <span className="settings-note__uri">{spotify.redirectUri}</span> as a redirect URI in your Spotify app.</p>}
              <button
                className="settings-portable-action"
                disabled={!spotify.auth.clientId || spotify.auth.status === 'connecting'}
                onClick={spotify.auth.status === 'connected' ? spotify.disconnect : () => { void spotify.connect() }}
              >{spotify.auth.status === 'connected' ? 'Disconnect Spotify' : spotify.auth.status === 'connecting' ? 'Connecting…' : 'Connect Spotify'}</button>
              <p className="settings-note" role="status">{spotify.connectError || spotify.auth.message || playbackMessage || (spotify.auth.status === 'connected' ? spotify.auth.canControl ? 'Connected to Spotify' : 'Connected. Playback controls were not authorized.' : 'Use the mock player until you connect.')}</p>
            </section>
            </>}
            {page === 'appearance' && <AppearanceSettingsPage settings={appearance} onChange={onAppearanceChange} />}
            {page === 'wallpaper' && <WallpaperSettingsPage settings={wallpaper} onChange={onWallpaperChange} onPreset={onWallpaperPreset} currentVisual={currentVisual} customWallpaper={customWallpaper} error={wallpaperError} onUpload={onUploadWallpaper} onRemove={onRemoveWallpaper} spotifyTrack={spotifyTrack} onSetVisual={onSetVisual} />}
              </motion.div>
            </AnimatePresence>
            </div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
