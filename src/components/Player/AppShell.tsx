import type { CSSProperties, ReactNode } from 'react'
import type { AppearanceSettings } from '../../types/interfaceSettings'
import { themes } from '../../data/themes'
import { defaultAppearance } from '../../types/interfaceSettings'
import { MotionSettingsProvider, useMotionSettings } from '../../hooks/useMotionSettings'

interface AppShellProps {
  children: ReactNode
  appearance?: AppearanceSettings
}

export function AppShell({ children, appearance }: AppShellProps) {
  return <MotionSettingsProvider settings={appearance ?? defaultAppearance}><Shell appearance={appearance}>{children}</Shell></MotionSettingsProvider>
}
function Shell({ children, appearance }: AppShellProps) {
  const movement = useMotionSettings()
  const active = appearance ?? defaultAppearance
  const theme = themes[active.theme]
  const style = appearance ? {
    '--ui-rgb': theme.colors.surface,
    '--theme-background': theme.colors.background,
    '--theme-surface': theme.colors.surface,
    '--theme-elevated': theme.colors.surfaceElevated,
    '--theme-accent': theme.colors.accent,
    '--theme-accent-secondary': theme.colors.accentSecondary,
    '--theme-text': theme.colors.text,
    '--theme-muted': theme.colors.textMuted,
    '--theme-border': theme.colors.border,
    '--theme-glow': theme.colors.glow,
    '--theme-control': theme.colors.control,
    '--theme-font': theme.uiFont,
    '--theme-library-art': theme.assets.panelBackgrounds ? `url("${theme.assets.panelBackgrounds.library}")` : 'none',
    '--theme-settings-art': theme.assets.panelBackgrounds ? `url("${theme.assets.panelBackgrounds.settings}")` : 'none',
    '--ui-alpha': Math.min(.98, (.78 + appearance.glassIntensity / 500) * appearance.uiOpacity / 100),
    '--mobile-ui-alpha': .98 * appearance.uiOpacity / 100,
    '--settings-mobile-alpha': .96 * appearance.uiOpacity / 100,
    '--glass-blur': `${appearance.blurIntensity}px`,
    '--glass-saturation': `${105 + appearance.glassIntensity / 5}%`,
    '--accent-alpha': .15 + appearance.accentIntensity / 150,
    '--ui-radius': `${appearance.cornerRadius === defaultAppearance.cornerRadius ? theme.radius : appearance.cornerRadius}px`,
    '--ui-speed': `${appearance.animationSpeed / 100}`,
    '--control-scale': appearance.controlSize / 100,
    '--icon-scale': appearance.iconSize / 100,
    '--progress-thickness': `${appearance.progressThickness}px`,
  } as CSSProperties : undefined
  return <div className="app-shell" data-motion={movement.enabled ? 'on' : 'off'} data-ui-theme={active.theme} data-theme-control={theme.controlStyle} data-theme-progress={theme.progressStyle} data-theme-decor={theme.decorativeStyle} data-theme-icons={active.theme} data-ui-transition={active.transitionStyle} data-control-shape={appearance?.controlShape ?? 'round'} data-player-position={appearance?.playerPosition ?? 'low'} data-progress-style={appearance?.progressStyle ?? 'line'} style={{ ...style, '--motion-hover-scale': movement.hoverScale, '--motion-hover-rise': `${-movement.hoverRise}px`, '--motion-duration': `${movement.uiDuration}s`, '--motion-press-scale': movement.pressScale } as CSSProperties}>{children}</div>
}
