import { defaultAppearance, defaultWallpaper } from '../types/interfaceSettings'
import { defaultPreferences } from '../types/preferences'
import { defaultLyricStyle } from './lyricStyles'
import { normalizeTheme } from './themes'

type Rule = readonly [number, number] | readonly (string | number)[]
type Rules<T> = Partial<Record<keyof T, Rule>>
function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}
function restore<T extends object>(defaults: T, saved: unknown, rules: Rules<T>): T {
  const values = record(saved)
  const result = { ...defaults }
  for (const key of Object.keys(defaults) as (keyof T)[]) {
    const value = values[key as string], fallback = defaults[key], rule = rules[key]
    if (typeof fallback === 'boolean') { if (typeof value === 'boolean') result[key] = value as T[typeof key] }
    else if (typeof fallback === 'number' && typeof value === 'number' && Number.isFinite(value)) {
      if (rule?.length === 2 && rule.every((bound) => typeof bound === 'number')) result[key] = Math.max(Number(rule[0]), Math.min(Number(rule[1]), value)) as T[typeof key]
      else if (!rule || rule.includes(value)) result[key] = value as T[typeof key]
    } else if (typeof fallback === 'string' && typeof value === 'string' && (!rule || (rule as readonly unknown[]).includes(value))) result[key] = value as T[typeof key]
  }
  return result
}
const appearanceRules: Rules<typeof defaultAppearance> = {
  motionIntensity: [0, 100], uiOpacity: [55, 100], glassIntensity: [0, 100], blurIntensity: [0, 45], accentIntensity: [0, 100],
  playerVisibility: ['auto', 'always', 'hidden'], controlSize: [70, 140], controlOpacity: [10, 100], progressStyle: ['line', 'soft', 'glow'], progressThickness: [1, 6],
  playerAnimationIntensity: [0, 100], playerPosition: ['edge', 'low', 'raised'], cornerRadius: [0, 24], controlShape: ['round', 'soft', 'square'], iconSize: [70, 140], animationSpeed: [50, 160], transitionStyle: ['smooth', 'dissolve', 'instant'],
  logoSize: [12, 36], logoOpacity: [10, 100], logoPosition: ['top-left', 'top-center', 'bottom-left'], logoStyle: ['wordmark', 'monogram', 'symbol'],
}
const wallpaperRules: Rules<typeof defaultWallpaper> = {
  motionStyle: ['parallax', 'ambient', 'both'],
  backgroundMode: ['auto', 'album-art', 'track-visual'], source: ['current', 'static', 'video', 'custom'], preset: ['cinematic', 'midnight', 'noir', 'dream', 'neon', 'minimal'],
  brightness: [50, 150], contrast: [50, 160], saturation: [0, 180], blur: [0, 16], vignette: [0, 100], overlayOpacity: [0, 140], colorTemperature: [-100, 100], backgroundOpacity: [30, 100], motionIntensity: [0, 100], videoSpeed: [.5, 2], position: ['cover', 'fill', 'center', 'custom'], customX: [0, 100], customY: [0, 100],
}
const styleRules: Rules<typeof defaultLyricStyle> = {
  preset: ['cinematic', 'minimal', 'editorial', 'bubble', 'street', 'futuristic', 'handwritten'], fontFamily: ['preset', 'inter', 'manrope', 'cormorant', 'nunito', 'spray', 'orbitron', 'caveat', 'mono'], fontSize: [75, 145], fontWeight: [400, 500, 600, 700], letterSpacing: [-.06, .14], lineHeight: [1, 1.6], textOpacity: [40, 100], adjacentOpacity: [15, 70], activeBrightness: [65, 100], glow: [0, 70], blur: [0, 4], animationStyle: ['float', 'fade', 'none'], animationSpeed: [.2, 1.2],
}
export function restoreInterfaceSettings(saved: unknown) {
  const values = record(saved)
  const appearance = restore(defaultAppearance, values.appearance, appearanceRules)
  appearance.theme = normalizeTheme(record(values.appearance).theme)
  return { appearance, wallpaper: restore(defaultWallpaper, values.wallpaper, wallpaperRules) }
}
export function restoreLyricPreferences(saved: unknown) {
  const values = record(saved)
  const preferences = restore(defaultPreferences, values, {
    layout: ['centered', 'duet', 'minimal', 'cinematic'], backgroundBlur: [0, 16], position: ['upper', 'center', 'lower'], maxVisibleLines: [1, 3, 5], textAlignment: ['left', 'center', 'right'], portableLayout: ['centered', 'duet', 'minimal'], portableWidth: [300, 640], portableOpacity: [.25, .95],
  })
  preferences.style = restore(defaultLyricStyle, values.style, styleRules)
  preferences.singerStyles = {}
  const singers = record(values.singerStyles)
  for (const singer of ['artist-a', 'artist-b'] as const) {
    if (!(singer in singers)) continue
    const raw = record(singers[singer]), valid = restore(defaultLyricStyle, raw, styleRules)
    // Keep partial overrides partial, so later main-style adjustments still propagate.
    preferences.singerStyles[singer] = Object.fromEntries(Object.keys(raw).filter((key) => key in defaultLyricStyle).map((key) => [key, valid[key as keyof typeof valid]]))
  }
  return preferences
}
