export type UiTheme = 'default' | 'batman' | 'spider-man' | 'hello-kitty' | 'sonic'
export type PlayerVisibility = 'auto' | 'always' | 'hidden'
export type ProgressStyle = 'line' | 'soft' | 'glow'
export type PlayerPosition = 'edge' | 'low' | 'raised'
export type ControlShape = 'round' | 'soft' | 'square'
export type UiTransition = 'smooth' | 'dissolve' | 'instant'
export type LogoPosition = 'top-left' | 'top-center' | 'bottom-left'
export type LogoStyle = 'wordmark' | 'monogram' | 'symbol'
export type WallpaperSource = 'current' | 'static' | 'video' | 'custom'
export type WallpaperPreset = 'cinematic' | 'midnight' | 'noir' | 'dream' | 'neon' | 'minimal'
export type WallpaperPosition = 'cover' | 'fill' | 'center' | 'custom'

export interface AppearanceSettings {
  motionEnabled: boolean
  motionIntensity: number
  theme: UiTheme
  uiOpacity: number
  glassIntensity: number
  blurIntensity: number
  accentIntensity: number
  playerVisibility: PlayerVisibility
  controlSize: number
  controlOpacity: number
  progressStyle: ProgressStyle
  progressThickness: number
  playerAnimationIntensity: number
  autoHideControls: boolean
  playerPosition: PlayerPosition
  cornerRadius: number
  controlShape: ControlShape
  iconSize: number
  animationSpeed: number
  transitionStyle: UiTransition
  showLogo: boolean
  logoSize: number
  logoOpacity: number
  logoPosition: LogoPosition
  logoStyle: LogoStyle
}

export interface WallpaperSettings {
  backgroundMode: 'auto' | 'album-art' | 'track-visual'
  source: WallpaperSource
  preset: WallpaperPreset
  brightness: number
  contrast: number
  saturation: number
  blur: number
  vignette: number
  overlayOpacity: number
  colorTemperature: number
  backgroundOpacity: number
  motionStyle: 'parallax' | 'ambient' | 'both'
  motionIntensity: number
  videoSpeed: number
  loopVideo: boolean
  pauseWhenInactive: boolean
  position: WallpaperPosition
  customX: number
  customY: number
}

export const defaultAppearance: AppearanceSettings = {
  motionEnabled: true, motionIntensity: 50,
  theme: 'default', uiOpacity: 100, glassIntensity: 50, blurIntensity: 28, accentIntensity: 50,
  playerVisibility: 'auto', controlSize: 100, controlOpacity: 25, progressStyle: 'line', progressThickness: 2,
  playerAnimationIntensity: 50, autoHideControls: true, playerPosition: 'low', cornerRadius: 10,
  controlShape: 'round', iconSize: 100, animationSpeed: 100, transitionStyle: 'smooth',
  showLogo: false, logoSize: 20, logoOpacity: 45, logoPosition: 'top-left', logoStyle: 'wordmark',
}

export const defaultWallpaper: WallpaperSettings = {
  backgroundMode: 'auto',
  source: 'current', preset: 'cinematic', brightness: 100, contrast: 107, saturation: 103, blur: 0,
  vignette: 40, overlayOpacity: 100, colorTemperature: 0, backgroundOpacity: 100,
  motionStyle: 'both', motionIntensity: 50, videoSpeed: 1, loopVideo: true, pauseWhenInactive: true,
  position: 'cover', customX: 50, customY: 50,
}

export const wallpaperPresets: Record<WallpaperPreset, Partial<WallpaperSettings>> = {
  cinematic: { brightness: 100, contrast: 107, saturation: 103, blur: 0, vignette: 40, overlayOpacity: 100, colorTemperature: 0 },
  midnight: { brightness: 76, contrast: 115, saturation: 78, blur: 0, vignette: 62, overlayOpacity: 110, colorTemperature: -25 },
  noir: { brightness: 88, contrast: 128, saturation: 18, blur: 0, vignette: 60, overlayOpacity: 95, colorTemperature: -5 },
  dream: { brightness: 108, contrast: 94, saturation: 116, blur: 2, vignette: 22, overlayOpacity: 65, colorTemperature: 18 },
  neon: { brightness: 105, contrast: 119, saturation: 155, blur: 0, vignette: 42, overlayOpacity: 80, colorTemperature: -32 },
  minimal: { brightness: 96, contrast: 96, saturation: 82, blur: 0, vignette: 12, overlayOpacity: 60, colorTemperature: 0 },
}
