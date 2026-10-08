import type { CSSProperties } from 'react'
import type { SingerId } from '../types/music'
import type { LyricFontFamily, LyricPreferences, LyricPreset, LyricStyle } from '../types/preferences'

interface PresetDefinition {
  label: string
  family: Exclude<LyricFontFamily, 'preset'>
  fontWeight: LyricStyle['fontWeight']
  letterSpacing: number
  lineHeight: number
  glow: number
}

export const lyricPresets: Record<LyricPreset, PresetDefinition> = {
  cinematic: { label: 'Cinematic', family: 'manrope', fontWeight: 600, letterSpacing: .005, lineHeight: 1.16, glow: 20 },
  minimal: { label: 'Minimal', family: 'inter', fontWeight: 400, letterSpacing: 0, lineHeight: 1.24, glow: 0 },
  editorial: { label: 'Editorial', family: 'cormorant', fontWeight: 600, letterSpacing: -.015, lineHeight: 1.07, glow: 10 },
  bubble: { label: 'Bubble', family: 'nunito', fontWeight: 700, letterSpacing: -.025, lineHeight: 1.16, glow: 10 },
  street: { label: 'Street / Grunge', family: 'spray', fontWeight: 400, letterSpacing: .025, lineHeight: 1.13, glow: 5 },
  futuristic: { label: 'Futuristic', family: 'orbitron', fontWeight: 600, letterSpacing: .065, lineHeight: 1.23, glow: 25 },
  handwritten: { label: 'Handwritten', family: 'caveat', fontWeight: 600, letterSpacing: .01, lineHeight: 1.05, glow: 10 },
}

export const fontFamilies: Record<Exclude<LyricFontFamily, 'preset'>, { label: string; css: string }> = {
  inter: { label: 'Inter', css: '"Inter Variable", ui-sans-serif, sans-serif' },
  manrope: { label: 'Manrope', css: '"Manrope Variable", ui-sans-serif, sans-serif' },
  cormorant: { label: 'Cormorant Garamond', css: '"Cormorant Garamond Variable", Georgia, serif' },
  nunito: { label: 'Nunito', css: '"Nunito Variable", ui-sans-serif, sans-serif' },
  spray: { label: 'Rubik Spray Paint', css: '"Rubik Spray Paint", Impact, sans-serif' },
  orbitron: { label: 'Orbitron', css: '"Orbitron Variable", ui-sans-serif, sans-serif' },
  caveat: { label: 'Caveat', css: '"Caveat Variable", cursive' },
  mono: { label: 'Monospaced', css: 'ui-monospace, "SFMono-Regular", Consolas, monospace' },
}

export const defaultLyricStyle: LyricStyle = {
  preset: 'cinematic',
  fontFamily: 'preset',
  fontSize: 100,
  fontWeight: lyricPresets.cinematic.fontWeight,
  letterSpacing: lyricPresets.cinematic.letterSpacing,
  lineHeight: lyricPresets.cinematic.lineHeight,
  textOpacity: 100,
  adjacentOpacity: 35,
  activeBrightness: 100,
  glow: lyricPresets.cinematic.glow,
  blur: 1.2,
  animationStyle: 'float',
  animationSpeed: .55,
}

export function presetValues(preset: LyricPreset): Partial<LyricStyle> {
  const definition = lyricPresets[preset]
  return { preset, fontFamily: 'preset', fontWeight: definition.fontWeight, letterSpacing: definition.letterSpacing, lineHeight: definition.lineHeight, glow: definition.glow }
}

export function effectiveLyricStyle(preferences: LyricPreferences, singer?: SingerId): LyricStyle {
  return { ...preferences.style, ...(singer ? preferences.singerStyles[singer] : {}) }
}

export function fontCss(style: LyricStyle) {
  const family = style.fontFamily === 'preset' ? lyricPresets[style.preset].family : style.fontFamily
  return fontFamilies[family].css
}

export function lyricStyleVariables(style: LyricStyle, preferences: LyricPreferences): CSSProperties {
  const alignment = preferences.textAlignment
  return {
    '--lyric-font-family': fontCss(style),
    '--lyric-scale': style.fontSize / 100,
    '--lyric-weight': style.fontWeight,
    '--lyric-spacing': `${style.letterSpacing}em`,
    '--lyric-leading': style.lineHeight,
    '--adjacent-opacity': style.textOpacity * style.adjacentOpacity / 10_000,
    '--current-opacity': style.textOpacity * style.activeBrightness / 10_000,
    '--lyric-glow': style.glow / 100,
    '--adjacent-blur': `${style.blur}px`,
    '--street-stroke': `${Math.max(0, (style.fontWeight - 400) / 600)}px`,
    '--background-blur': `${preferences.backgroundBlur}px`,
    '--line-alignment': alignment === 'left' ? 'flex-start' : alignment === 'right' ? 'flex-end' : 'center',
    textAlign: alignment,
  } as CSSProperties
}
