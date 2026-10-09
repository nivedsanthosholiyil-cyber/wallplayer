import { act, createElement, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, expect, it, vi } from 'vitest'
import { SettingsPanel } from '../src/components/Settings/SettingsPanel'
import { AppShell } from '../src/components/Player/AppShell'
import { useInterfaceSettings } from '../src/hooks/useInterfaceSettings'
import { useLyricsPreferences } from '../src/hooks/useLyricsPreferences'
import { defaultAppearance, defaultWallpaper } from '../src/types/interfaceSettings'
import { defaultPreferences } from '../src/types/preferences'
import { restoreInterfaceSettings, restoreLyricPreferences } from '../src/data/settingsValidation'

vi.mock('../src/services/wallpaperAsset', () => ({ wallpaperAsset: { get: vi.fn(async () => undefined), save: vi.fn(async () => {}), remove: vi.fn(async () => {}) } }))
;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
beforeEach(() => { localStorage.clear(); Object.defineProperty(HTMLElement.prototype, 'scrollTo', { configurable: true, value: vi.fn() }) })

it('keeps categories, previews, focus and persisted settings independent', async () => {
  localStorage.setItem('musicwall.interface.settings.v1', JSON.stringify({ appearance: { ...defaultAppearance, transitionStyle: 'instant', motionEnabled: false }, wallpaper: { ...defaultWallpaper, source: 'static', brightness: 84 } }))
  const container = document.createElement('div'); document.body.append(container)
  let root = createRoot(container)
  function Harness() {
    const settings = useInterfaceSettings(), lyrics = useLyricsPreferences()
    const [open, setOpen] = useState(true)
    return createElement(AppShell, { appearance: settings.appearance }, createElement(SettingsPanel, {
      open, preferences: lyrics.preferences, onChange: lyrics.updatePreference, onClose: () => setOpen(false),
      portableOpen: false, onTogglePortable: vi.fn(),
      spotify: { auth: { status: 'disconnected', message: '', canControl: false, clientId: '', configuredByEnv: true }, connect: vi.fn(async () => {}), disconnect: vi.fn(), connectError: '', setClientId: vi.fn(), redirectUri: 'http://127.0.0.1:5173/callback' },
      playbackMessage: '', appearance: settings.appearance, wallpaper: settings.wallpaper,
      onAppearanceChange: settings.updateAppearance, onWallpaperChange: settings.updateWallpaper, onWallpaperPreset: settings.selectWallpaperPreset,
      currentVisual: { kind: 'image', src: '/images/afterglow-night.png' }, customWallpaper: null, wallpaperError: '', onUploadWallpaper: settings.uploadWallpaper, onRemoveWallpaper: settings.removeWallpaper,
    }))
  }
  const click = async (label: string) => {
    const button = [...container.querySelectorAll('button')].find((node) => node.textContent?.trim() === label || node.getAttribute('aria-label') === label)!
    expect(button).toBeTruthy()
    await act(async () => { button.click(); await new Promise((resolve) => setTimeout(resolve, 30)) })
  }
  const select = async (label: string, value: string) => {
    const input = container.querySelector<HTMLSelectElement>(`select[aria-label="${label}"]`)!
    await act(async () => { input.value = value; input.dispatchEvent(new Event('change', { bubbles: true })) })
  }
  const range = async (label: string, value: string) => {
    const input = container.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })) })
    return input
  }
  try {
    await act(async () => root.render(createElement(Harness)))
    expect(container.querySelector('.settings-panel__body [role="tabpanel"]')).not.toBeNull()
    await select('Font family', 'mono')
    await select('Position', 'upper')
    await select('Text alignment', 'right')
    expect(container.querySelector<HTMLElement>('.settings-lyric-preview')!.style.getPropertyValue('--lyric-font-family')).toContain('Consolas')
    expect(container.querySelector('.settings-lyric-preview')!.getAttribute('data-position')).toBe('upper')
    await click('Dual Split')
    expect(container.querySelector('.settings-lyric-preview')!.getAttribute('data-layout')).toBe('duet')
    expect(container.querySelector('.settings-lyric-preview__partner')).not.toBeNull()
    await select('Style target', 'artist-a')
    await select('Font preset', 'bubble')
    await click('Use main style for Artist A')
    expect(JSON.parse(localStorage.getItem('musicwall.lyrics.preferences.v2')!).singerStyles).toEqual({})
    const lyricSaved = localStorage.getItem('musicwall.lyrics.preferences.v2')
    await click('Appearance')
    const motion = container.querySelector<HTMLInputElement>('input[aria-label="Motion"]')!
    await act(async () => motion.click())
    for (const intensity of ['25', '50', '75', '0']) {
      await range('Motion intensity', intensity)
      expect(container.querySelector('.app-shell')!.getAttribute('data-motion')).toBe(intensity === '0' ? 'off' : 'on')
    }
    await act(async () => motion.click())
    for (const theme of ['Batman', 'Sanrio', 'Spider-Man', 'Sonic', 'Default']) {
      await click(`${theme} theme`)
      expect(container.querySelector(`button[aria-label="${theme} theme"]`)!.getAttribute('aria-pressed')).toBe('true')
      expect(localStorage.getItem('musicwall.lyrics.preferences.v2')).toBe(lyricSaved)
      expect(JSON.parse(localStorage.getItem('musicwall.interface.settings.v1')!).wallpaper.brightness).toBe(84)
    }
    const tab = container.querySelector<HTMLButtonElement>('[role="tab"][aria-selected="true"]')!
    await act(async () => { tab.focus(); tab.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })); await new Promise((resolve) => setTimeout(resolve, 30)) })
    expect(document.activeElement?.textContent).toBe('Wallpaper')
    const image = container.querySelector<HTMLImageElement>('.settings-wallpaper-preview img')!
    expect(image.style.filter).toContain('brightness(84%)')
    const slider = await range('Brightness', '110')
    expect(image.style.filter).toContain('brightness(110%)')
    expect(slider.style.getPropertyValue('--setting-progress')).toBe('60%')
    await select('Visual preset', 'dream')
    expect(image.style.filter).toContain('contrast(94%)')
    await select('Image fit', 'custom')
    expect(container.querySelector('input[aria-label="Horizontal"]')).not.toBeNull()
    expect(container.querySelector('video[autoplay]')).toBeNull()
    await click('Music & Lyrics')
    expect(container.querySelector<HTMLElement>('.settings-lyric-preview')!.style.textAlign).toBe('right')
    await act(async () => root.unmount())
    root = createRoot(container)
    await act(async () => root.render(createElement(Harness)))
    expect(container.querySelector('.settings-lyric-preview')!.getAttribute('data-layout')).toBe('duet')
    expect(container.querySelector<HTMLElement>('.settings-lyric-preview')!.style.getPropertyValue('--lyric-font-family')).toContain('Consolas')
  } finally { await act(async () => root.unmount()); container.remove() }
})

it('repairs invalid persisted settings and keeps singer overrides partial', () => {
  const settings = restoreInterfaceSettings({ appearance: { theme: 'hello-kitty', motionEnabled: 'no', blurIntensity: 999, controlSize: 'huge' }, wallpaper: { source: 'unknown', brightness: null, position: 'invalid', videoSpeed: 100 } })
  expect(settings.appearance).toMatchObject({ theme: 'hello-kitty', motionEnabled: true, blurIntensity: 45, controlSize: 100 })
  expect(settings.wallpaper).toMatchObject({ source: 'current', brightness: 100, position: 'cover', videoSpeed: 2 })
  const preferences = restoreLyricPreferences({ layout: 'broken', style: { preset: 'missing', fontWeight: 501, fontSize: 500 }, singerStyles: { 'artist-a': { glow: 12 } } })
  expect(preferences.layout).toBe(defaultPreferences.layout)
  expect(preferences.style).toMatchObject({ preset: 'cinematic', fontWeight: 600, fontSize: 145 })
  expect(preferences.singerStyles['artist-a']).toEqual({ glow: 12 })
})
