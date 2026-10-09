import { useEffect, useRef, useState } from 'react'
import { defaultAppearance, defaultWallpaper, wallpaperPresets, type AppearanceSettings, type WallpaperPreset, type WallpaperSettings } from '../types/interfaceSettings'
import { wallpaperAsset } from '../services/wallpaperAsset'
import { restoreInterfaceSettings } from '../data/settingsValidation'

const KEY = 'musicwall.interface.settings.v1'
export interface CustomWallpaper { url: string; kind: 'image' | 'video'; name: string }

function loadSettings(): { appearance: AppearanceSettings; wallpaper: WallpaperSettings } {
  try {
    return restoreInterfaceSettings(JSON.parse(localStorage.getItem(KEY) ?? '{}'))
  } catch { return { appearance: defaultAppearance, wallpaper: defaultWallpaper } }
}

export function useInterfaceSettings() {
  const [settings, setSettings] = useState(loadSettings)
  const [customWallpaper, setCustomWallpaper] = useState<CustomWallpaper | null>(null)
  const [wallpaperError, setWallpaperError] = useState('')
  const mounted = useRef(false)

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(settings)) } catch { /* Settings still work for this session. */ }
  }, [settings])

  useEffect(() => {
    mounted.current = true
    let disposed = false
    void wallpaperAsset.get().then((blob) => {
      if (!blob || disposed) return
      const url = URL.createObjectURL(blob)
      setCustomWallpaper({ url, kind: blob.type.startsWith('video/') ? 'video' : 'image', name: 'Saved wallpaper' })
    }).catch(() => {})
    return () => { disposed = true; mounted.current = false }
  }, [])

  useEffect(() => {
    const url = customWallpaper?.url
    return () => { if (url) URL.revokeObjectURL(url) }
  }, [customWallpaper?.url])

  function updateAppearance<K extends keyof AppearanceSettings>(key: K, value: AppearanceSettings[K]) {
    setSettings((current) => ({ ...current, appearance: { ...current.appearance, [key]: value } }))
  }
  function updateWallpaper<K extends keyof WallpaperSettings>(key: K, value: WallpaperSettings[K]) {
    setSettings((current) => ({ ...current, wallpaper: { ...current.wallpaper, [key]: value } }))
  }
  function selectWallpaperPreset(preset: WallpaperPreset) {
    setSettings((current) => ({ ...current, wallpaper: { ...current.wallpaper, ...wallpaperPresets[preset], preset } }))
  }
  async function uploadWallpaper(file: File) {
    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      setWallpaperError('Choose an image or video file.')
      return
    }
    try {
      await wallpaperAsset.save(file)
      if (!mounted.current) return
      const url = URL.createObjectURL(file)
      setCustomWallpaper({ url, kind: file.type.startsWith('video/') ? 'video' : 'image', name: file.name })
      setWallpaperError('')
    } catch { setWallpaperError('This browser could not save the wallpaper locally.') }
  }
  async function removeWallpaper() {
    try { await wallpaperAsset.remove() } catch { setWallpaperError('Could not remove the saved wallpaper.'); return }
    setCustomWallpaper(null)
    updateWallpaper('source', 'current')
    setWallpaperError('')
  }

  return { ...settings, updateAppearance, updateWallpaper, selectWallpaperPreset, customWallpaper, wallpaperError, uploadWallpaper, removeWallpaper }
}
