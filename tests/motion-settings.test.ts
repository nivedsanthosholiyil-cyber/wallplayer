import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { motionTokens } from '../src/hooks/useMotionSettings'
import { useInterfaceSettings } from '../src/hooks/useInterfaceSettings'
import { AppShell } from '../src/components/Player/AppShell'
import { AppearanceSettingsPage } from '../src/components/Settings/AppearanceSettingsPage'
import { VideoBackground } from '../src/components/Background/VideoBackground'
import { defaultWallpaper } from '../src/types/interfaceSettings'
import { defaultAppearance } from '../src/types/interfaceSettings'

it('responds to OS reduced-motion changes without changing the selected theme', async () => {
  const container = document.createElement('div'); const root = createRoot(container)
  const previous = Object.getOwnPropertyDescriptor(window, 'matchMedia')
  let reduced = false
  let notify = () => {}
  Object.defineProperty(window,'matchMedia',{configurable:true,value:() => ({ get matches() { return reduced }, addEventListener: (_:string, listener:() => void) => { notify = listener }, removeEventListener: vi.fn() })})
  try {
    await act(async () => { root.render(createElement(AppShell,{appearance:{...defaultAppearance,theme:'batman',motionEnabled:true,motionIntensity:100}},'Scene')) })
    expect(container.querySelector('.app-shell')?.getAttribute('data-motion')).toBe('on')
    await act(async () => { reduced = true; notify() })
    expect(container.querySelector('.app-shell')?.getAttribute('data-motion')).toBe('off')
    expect(container.querySelector('.app-shell')?.getAttribute('data-ui-theme')).toBe('batman')
    await act(async () => { reduced = false; notify() })
    expect(container.querySelector('.app-shell')?.getAttribute('data-motion')).toBe('on')
  } finally { await act(async () => root.unmount()); if (previous) Object.defineProperty(window,'matchMedia',previous); else Reflect.deleteProperty(window,'matchMedia') }
})

it('bounds motion and eliminates movement for OFF, zero intensity, and reduced motion', () => {
  for (const value of [0,25,50,75,100,1000]) {
    const tokens = motionTokens(true,value)
    expect(tokens.backgroundScale).toBeLessThanOrEqual(1.05)
    expect(tokens.parallax).toBeLessThanOrEqual(12)
    expect(tokens.backgroundDuration).toBeGreaterThanOrEqual(60)
  }
  for (const tokens of [motionTokens(false,100), motionTokens(true,100,true), motionTokens(true,0)]) {
    expect(tokens).toMatchObject({ enabled:false, backgroundScale:1, parallax:0, lyricY:0, playerRise:0, panelSlide:0, hoverScale:1 })
    expect(tokens.crossfade).toBeLessThanOrEqual(.15)
  }
})

it('persists Motion OFF through remount and cancels background pointer movement', async () => {
  localStorage.removeItem('musicwall.interface.settings.v1')
  const container = document.createElement('div'); document.body.append(container)
  const root = createRoot(container)
  let settings!: ReturnType<typeof useInterfaceSettings>
  let renders = 0
  const frames: FrameRequestCallback[] = []
  const frame = vi.spyOn(window,'requestAnimationFrame').mockImplementation((callback) => { frames.push(callback); return frames.length })
  const cancel = vi.spyOn(window,'cancelAnimationFrame')
  function Probe() {
    renders++
    settings = useInterfaceSettings()
    return createElement(AppShell, { appearance:settings.appearance },
      createElement(AppearanceSettingsPage,{ settings:settings.appearance,onChange:settings.updateAppearance }),
      createElement(VideoBackground,{ visual:{kind:'image',src:'/scene.jpg'},ambient:true,isPlaying:true,isMuted:true,volume:0,settings:defaultWallpaper }))
  }
  try {
    await act(async () => { root.render(createElement(Probe)) })
    await act(async () => { settings.updateAppearance('motionIntensity',100) })
    const before = renders
    const pointer = new Event('pointermove'); Object.assign(pointer,{pointerType:'mouse',clientX:0,clientY:0})
    window.dispatchEvent(pointer)
    frames.at(-1)?.(0)
    expect(container.querySelector<HTMLElement>('.video-background__scene')!.style.transform).toContain('translate3d(-12px')
    expect(renders).toBe(before)
    await act(async () => { container.querySelector<HTMLInputElement>('input[aria-label="Motion"]')!.click() })
    expect(container.querySelector('.app-shell')?.getAttribute('data-motion')).toBe('off')
    expect(container.querySelector<HTMLElement>('.video-background__scene')!.style.transform).toBe('none')
    expect(cancel).toHaveBeenCalled()
    const requestCount = frame.mock.calls.length
    window.dispatchEvent(pointer)
    expect(frame).toHaveBeenCalledTimes(requestCount)
    await act(async () => { root.render(null) })
    await act(async () => { root.render(createElement(Probe)) })
    expect(settings.appearance).toMatchObject({motionEnabled:false,motionIntensity:100})
  } finally {
    await act(async () => { root.unmount() }); container.remove(); frame.mockRestore(); cancel.mockRestore()
    localStorage.removeItem('musicwall.interface.settings.v1')
  }
})
