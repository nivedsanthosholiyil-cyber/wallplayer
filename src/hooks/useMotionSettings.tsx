import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { AppearanceSettings } from '../types/interfaceSettings'

export function motionTokens(enabled = true, value = 50, reduced = false) {
  const intensity = Math.round(Math.max(0, Math.min(100, Number.isFinite(value) ? value : 50)) / 25) / 4
  const moving = enabled && !reduced && intensity > 0
  const amount = moving ? intensity : 0
  return {
    enabled: moving, intensity, reduced,
    backgroundScale: 1 + .05 * amount, backgroundDrift: -.5 * amount,
    backgroundDuration: 120 - 60 * amount,
    parallax: 12 * amount,
    lyricY: 16 * amount, lyricScale: 1 - .02 * amount,
    panelSlide: moving ? 12 + 8 * amount : 0,
    playerRise: 12 * amount, hoverScale: 1 + .03 * amount, hoverRise: 4 * amount,
    pressScale: 1 - .025 * amount,
    uiDuration: moving ? .2 + .3 * amount : .1,
    crossfade: moving ? .3 + .6 * amount : .15,
  }
}
const MotionContext = createContext(motionTokens())
export function MotionSettingsProvider({ settings, children }: { settings: AppearanceSettings; children: ReactNode }) {
  const [reduced, setReduced] = useState(() => typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const change = () => setReduced(query.matches)
    query.addEventListener('change', change)
    return () => query.removeEventListener('change', change)
  }, [])
  const tokens = useMemo(() => motionTokens(settings.motionEnabled, settings.motionIntensity, reduced), [settings.motionEnabled, settings.motionIntensity, reduced])
  return <MotionContext.Provider value={tokens}>{children}</MotionContext.Provider>
}
export function useMotionSettings() { return useContext(MotionContext) }
