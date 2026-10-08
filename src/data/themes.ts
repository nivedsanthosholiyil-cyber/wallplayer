import type { UiTheme } from '../types/interfaceSettings'

export interface ThemeConfig {
  id: UiTheme
  name: string
  colors: {
    background: string
    surface: string
    surfaceElevated: string
    accent: string
    accentSecondary: string
    text: string
    textMuted: string
    border: string
    glow: string
    control: string
  }
  preview: string
  controlStyle: 'glass' | 'sharp' | 'web' | 'soft' | 'speed'
  progressStyle: 'fine' | 'metallic' | 'pulse' | 'soft' | 'electric'
  radius: number
  logo: 'orbit' | 'wings' | 'web' | 'bow' | 'ring'
  decorativeStyle: 'none' | 'angled' | 'web' | 'bow' | 'streak'
  uiFont: string
  assets: ThemeAssets
}

export type ThemeControl = 'play' | 'pause' | 'previous' | 'next' | 'volume' | 'settings' | 'queue' | 'lyrics' | 'search' | 'back' | 'close' | 'fullscreen' | 'shuffle' | 'repeat'
export type ThemeAsset = { type: 'vector'; id: string } | { type: 'image'; src: string; playingSrc?: string; alt?: string; mirrorX?: boolean }
export interface ThemeAssets {
  logo: ThemeAsset
  controls: Record<ThemeControl, ThemeAsset>
  decorations: ThemeAsset[]
}

function vector(id: string): ThemeAsset { return { type: 'vector', id } }
function themeAssets(id: UiTheme, logo: string, decorations: string[] = [], controlOverrides: Partial<Record<ThemeControl, ThemeAsset>> = {}): ThemeAssets {
  const controls: ThemeControl[] = ['play', 'pause', 'previous', 'next', 'volume', 'settings', 'queue', 'lyrics', 'search', 'back', 'close', 'fullscreen', 'shuffle', 'repeat']
  return {
    logo: vector(logo),
    controls: { ...Object.fromEntries(controls.map((control) => [control, vector(`${id}-${control}`)])) as Record<ThemeControl, ThemeAsset>, ...controlOverrides },
    decorations: decorations.map(vector),
  }
}

export const themes: Record<UiTheme, ThemeConfig> = {
  default: {
    id: 'default', name: 'Default', colors: { background: '7 18 27', surface: '8 23 32', surfaceElevated: '23 43 54', accent: '199 236 240', accentSecondary: '154 198 207', text: '243 248 248', textMuted: '207 227 230', border: '231 250 251', glow: '214 248 250', control: '244 252 252' },
    preview: 'linear-gradient(145deg, #102635, #08121e 67%, #223d4d)', controlStyle: 'glass', progressStyle: 'fine', radius: 10, logo: 'orbit', decorativeStyle: 'none', uiFont: 'Inter, ui-sans-serif, sans-serif', assets: themeAssets('default', 'default-orbit'),
  },
  batman: {
    id: 'batman', name: 'Batman', colors: { background: '6 7 9', surface: '11 12 14', surfaceElevated: '27 28 29', accent: '188 157 76', accentSecondary: '125 119 100', text: '241 238 227', textMuted: '184 182 169', border: '191 184 157', glow: '180 148 68', control: '236 230 205' },
    preview: 'linear-gradient(145deg, #25231e, #08090b 62%, #3b321c)', controlStyle: 'sharp', progressStyle: 'metallic', radius: 4, logo: 'wings', decorativeStyle: 'angled', uiFont: '"Manrope Variable", Inter, sans-serif', assets: themeAssets('batman', 'batman-silhouette', ['batman-signal']),
  },
  'spider-man': {
    id: 'spider-man', name: 'Spider-Man', colors: { background: '9 10 16', surface: '20 14 23', surfaceElevated: '43 24 37', accent: '207 75 83', accentSecondary: '74 121 178', text: '247 241 243', textMuted: '207 192 202', border: '208 145 155', glow: '208 70 79', control: '247 233 237' },
    preview: 'linear-gradient(140deg, #641d2b, #121520 62%, #183959)', controlStyle: 'web', progressStyle: 'pulse', radius: 8, logo: 'web', decorativeStyle: 'web', uiFont: 'Inter, ui-sans-serif, sans-serif', assets: themeAssets('spider-man', 'spider-emblem', ['web-corner'], {
      play: { type: 'image', src: '/themes/spider-man/mask-paused.png', playingSrc: '/themes/spider-man/mask-playing.png' },
      pause: { type: 'image', src: '/themes/spider-man/mask-paused.png', playingSrc: '/themes/spider-man/mask-playing.png' },
    }),
  },
  'hello-kitty': {
    id: 'hello-kitty', name: 'Hello Kitty', colors: { background: '30 19 30', surface: '46 27 42', surfaceElevated: '68 39 59', accent: '245 174 199', accentSecondary: '227 115 139', text: '255 247 249', textMuted: '240 211 224', border: '245 196 216', glow: '248 172 201', control: '255 242 248' },
    preview: 'linear-gradient(145deg, #b2698f, #4b293e 62%, #f2b6cc)', controlStyle: 'soft', progressStyle: 'soft', radius: 18, logo: 'bow', decorativeStyle: 'bow', uiFont: '"Nunito Variable", Inter, sans-serif', assets: themeAssets('hello-kitty', 'cute-bow-face', ['tiny-bow']),
  },
  sonic: {
    id: 'sonic', name: 'Sonic', colors: { background: '5 17 38', surface: '8 27 56', surfaceElevated: '17 51 87', accent: '86 202 245', accentSecondary: '225 191 91', text: '241 249 255', textMuted: '193 219 239', border: '149 207 242', glow: '68 192 255', control: '231 247 255' },
    preview: 'linear-gradient(145deg, #125eaf, #071d42 62%, #32aee1)', controlStyle: 'speed', progressStyle: 'electric', radius: 7, logo: 'ring', decorativeStyle: 'streak', uiFont: 'Inter, ui-sans-serif, sans-serif', assets: themeAssets('sonic', 'speed-hedgehog', ['speed-streak', 'gold-ring']),
  },
}

export const themeList = Object.values(themes)

export function normalizeTheme(value: unknown): UiTheme {
  if (typeof value === 'string' && value in themes) return value as UiTheme
  if (value === 'noir') return 'batman'
  return 'default'
}
