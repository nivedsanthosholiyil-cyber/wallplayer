import type { SingerId } from './music'
import { defaultLyricStyle } from '../data/lyricStyles'

export type LyricLayout = 'centered' | 'duet' | 'minimal' | 'cinematic'
export type PortableLayout = 'centered' | 'duet' | 'minimal'
export type LyricPreset = 'cinematic' | 'minimal' | 'editorial' | 'bubble' | 'street' | 'futuristic' | 'handwritten'
export type LyricFontFamily = 'preset' | 'inter' | 'manrope' | 'cormorant' | 'nunito' | 'spray' | 'orbitron' | 'caveat' | 'mono'
export type AnimationStyle = 'float' | 'fade' | 'none'
export type LyricPosition = 'upper' | 'center' | 'lower'
export type TextAlignment = 'left' | 'center' | 'right'

export interface LyricStyle {
  preset: LyricPreset
  fontFamily: LyricFontFamily
  fontSize: number
  fontWeight: 400 | 500 | 600 | 700
  letterSpacing: number
  lineHeight: number
  textOpacity: number
  adjacentOpacity: number
  activeBrightness: number
  glow: number
  blur: number
  animationStyle: AnimationStyle
  animationSpeed: number
}

export interface LyricPreferences {
  layout: LyricLayout
  style: LyricStyle
  singerStyles: Partial<Record<SingerId, Partial<LyricStyle>>>
  backgroundBlur: number
  position: LyricPosition
  maxVisibleLines: 1 | 3 | 5
  textAlignment: TextAlignment
  portableLayout: PortableLayout
  portableWidth: number
  portableOpacity: number
}

export const defaultPreferences: LyricPreferences = {
  layout: 'centered',
  style: defaultLyricStyle,
  singerStyles: {},
  backgroundBlur: 0,
  position: 'center',
  maxVisibleLines: 3,
  textAlignment: 'center',
  portableLayout: 'centered',
  portableWidth: 420,
  portableOpacity: 0.72,
}
