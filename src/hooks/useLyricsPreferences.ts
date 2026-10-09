import { useEffect, useState } from 'react'
import { defaultPreferences, type LyricPreferences } from '../types/preferences'
import { defaultLyricStyle, presetValues } from '../data/lyricStyles'
import { restoreLyricPreferences } from '../data/settingsValidation'

const storageKey = 'musicwall.lyrics.preferences.v2'
const legacyKey = 'musicwall.lyrics.preferences.v1'

function loadPreferences(): LyricPreferences {
  try {
    const saved = localStorage.getItem(storageKey)
    if (saved) {
      return restoreLyricPreferences(JSON.parse(saved))
    }
    const legacy = localStorage.getItem(legacyKey)
    if (!legacy) return defaultPreferences
    const parsed = JSON.parse(legacy) as Record<string, unknown>
    const preset = parsed.fontStyle === 'serif' ? 'editorial' : 'cinematic'
    return restoreLyricPreferences({
      ...defaultPreferences,
      layout: (parsed.layout as LyricPreferences['layout']) ?? defaultPreferences.layout,
      style: {
        ...defaultLyricStyle,
        ...presetValues(preset),
        fontFamily: parsed.fontStyle === 'mono' ? 'mono' : 'preset',
        fontSize: typeof parsed.fontSize === 'number' ? parsed.fontSize : defaultLyricStyle.fontSize,
        fontWeight: typeof parsed.fontWeight === 'number' ? parsed.fontWeight as LyricPreferences['style']['fontWeight'] : defaultLyricStyle.fontWeight,
        adjacentOpacity: typeof parsed.lyricOpacity === 'number' ? parsed.lyricOpacity : defaultLyricStyle.adjacentOpacity,
        activeBrightness: typeof parsed.currentBrightness === 'number' ? parsed.currentBrightness : defaultLyricStyle.activeBrightness,
        animationStyle: (parsed.animationStyle as LyricPreferences['style']['animationStyle']) ?? defaultLyricStyle.animationStyle,
        animationSpeed: typeof parsed.animationSpeed === 'number' ? parsed.animationSpeed : defaultLyricStyle.animationSpeed,
      },
      backgroundBlur: typeof parsed.backgroundBlur === 'number' ? parsed.backgroundBlur : defaultPreferences.backgroundBlur,
      position: (parsed.position as LyricPreferences['position']) ?? defaultPreferences.position,
      maxVisibleLines: (parsed.maxVisibleLines as LyricPreferences['maxVisibleLines']) ?? defaultPreferences.maxVisibleLines,
      textAlignment: (parsed.textAlignment as LyricPreferences['textAlignment']) ?? defaultPreferences.textAlignment,
      portableLayout: (parsed.portableLayout as LyricPreferences['portableLayout']) ?? defaultPreferences.portableLayout,
      portableWidth: typeof parsed.portableWidth === 'number' ? parsed.portableWidth : defaultPreferences.portableWidth,
      portableOpacity: typeof parsed.portableOpacity === 'number' ? parsed.portableOpacity : defaultPreferences.portableOpacity,
    })
  } catch { return defaultPreferences }
}

export function useLyricsPreferences() {
  const [preferences, setPreferences] = useState<LyricPreferences>(loadPreferences)

  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(preferences)) } catch { /* Private browsing may disable storage. */ }
  }, [preferences])

  function updatePreference<K extends keyof LyricPreferences>(key: K, value: LyricPreferences[K]) {
    setPreferences((current) => ({ ...current, [key]: value }))
  }

  return { preferences, updatePreference }
}
