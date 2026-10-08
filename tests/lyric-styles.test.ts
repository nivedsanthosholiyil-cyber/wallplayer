import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, expect, it } from 'vitest'
import { effectiveLyricStyle, fontCss, lyricPresets, lyricStyleVariables, presetValues } from '../src/data/lyricStyles'
import { defaultPreferences } from '../src/types/preferences'
import { useLyricsPreferences } from '../src/hooks/useLyricsPreferences'
import type { LyricPreferences, LyricPreset } from '../src/types/preferences'

beforeEach(() => localStorage.clear())

it('uses seven distinct bundled font families and independent duet overrides', () => {
  const families = (Object.keys(lyricPresets) as LyricPreset[]).map((preset) =>
    fontCss({ ...defaultPreferences.style, ...presetValues(preset) }),
  )
  expect(new Set(families).size).toBe(7)

  const preferences: LyricPreferences = {
    ...defaultPreferences,
    singerStyles: {
      'artist-a': presetValues('street'),
      'artist-b': presetValues('editorial'),
    },
  }
  expect(fontCss(effectiveLyricStyle(preferences, 'artist-a'))).toContain('Rubik Spray Paint')
  expect(fontCss(effectiveLyricStyle(preferences, 'artist-b'))).toContain('Cormorant Garamond')
  expect(effectiveLyricStyle(preferences, 'artist-a').fontSize).toBe(defaultPreferences.style.fontSize)
})

it('maps appearance controls to the lyric rendering variables', () => {
  const style = { ...defaultPreferences.style, fontSize: 125, letterSpacing: .08, lineHeight: 1.3, textOpacity: 80, adjacentOpacity: 50, activeBrightness: 90, glow: 40, blur: 2 }
  const variables = lyricStyleVariables(style, defaultPreferences) as Record<string, unknown>
  expect(variables).toMatchObject({
    '--lyric-scale': 1.25,
    '--lyric-spacing': '0.08em',
    '--lyric-leading': 1.3,
    '--adjacent-opacity': .4,
    '--current-opacity': .72,
    '--lyric-glow': .4,
    '--adjacent-blur': '2px',
  })
})

it('migrates the existing lyric layout and appearance preferences', async () => {
  localStorage.setItem('musicwall.lyrics.preferences.v1', JSON.stringify({
    layout: 'duet', fontStyle: 'serif', fontSize: 120, lyricOpacity: 45,
    currentBrightness: 85, position: 'lower', portableWidth: 500,
  }))
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  let loaded: LyricPreferences | undefined
  function Probe() { loaded = useLyricsPreferences().preferences; return null }
  await act(async () => { root.render(createElement(Probe)) })
  expect(loaded).toMatchObject({
    layout: 'duet', position: 'lower', portableWidth: 500,
    style: { preset: 'editorial', fontSize: 120, adjacentOpacity: 45, activeBrightness: 85 },
  })
  expect(localStorage.getItem('musicwall.lyrics.preferences.v2')).not.toBeNull()
  await act(async () => { root.unmount() })
  container.remove()
})
