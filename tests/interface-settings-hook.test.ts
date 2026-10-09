import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { useInterfaceSettings } from '../src/hooks/useInterfaceSettings'

vi.mock('../src/services/wallpaperAsset', () => ({ wallpaperAsset: { get: vi.fn(async () => undefined), save: vi.fn(async () => {}), remove: vi.fn(async () => {}) } }))
;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

it('releases uploaded wallpaper URLs on replacement and unmount', async () => {
  const create = vi.fn().mockReturnValueOnce('blob:first-upload').mockReturnValueOnce('blob:second-upload')
  const revoke = vi.fn()
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: create })
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revoke })
  let settings!: ReturnType<typeof useInterfaceSettings>
  function Probe() { settings = useInterfaceSettings(); return null }
  const container = document.createElement('div'); document.body.append(container)
  const root = createRoot(container)
  try {
    await act(async () => root.render(createElement(Probe)))
    await act(async () => settings.uploadWallpaper(new File(['image'], 'first.png', { type: 'image/png' })))
    await act(async () => settings.uploadWallpaper(new File(['image'], 'second.png', { type: 'image/png' })))
    expect(revoke).toHaveBeenCalledWith('blob:first-upload')
    expect(settings.customWallpaper?.url).toBe('blob:second-upload')
  } finally { await act(async () => root.unmount()); container.remove() }
  expect(revoke).toHaveBeenCalledWith('blob:second-upload')
})
