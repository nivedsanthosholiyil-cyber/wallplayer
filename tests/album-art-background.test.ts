import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { VideoBackground } from '../src/components/Background/VideoBackground'
import { defaultWallpaper } from '../src/types/interfaceSettings'

it('reports rejected video playback without leaking media URLs and releases the failed media', async () => {
  const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockRejectedValue(new DOMException('https://private.test/video?token=private', 'NotAllowedError'))
  const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
  const load = vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {})
  const warning = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const container = document.createElement('div'), root = createRoot(container)
  try {
    await act(async () => root.render(createElement(VideoBackground, { visual: {kind:'video',src:'/video.mp4'}, ambient:true, isPlaying:true, isMuted:true, volume:0, settings:defaultWallpaper })))
    expect(play).toHaveBeenCalled()
    expect(warning).toHaveBeenCalledWith('[MusicWall video] Playback rejected:', 'NotAllowedError')
    expect(JSON.stringify(warning.mock.calls)).not.toContain('private')
    const video = container.querySelector('video')!
    await act(async () => root.unmount())
    expect(video.hasAttribute('src')).toBe(false)
    expect(load).toHaveBeenCalled()
  } finally { await act(async () => root.unmount()); play.mockRestore(); pause.mockRestore(); load.mockRestore(); warning.mockRestore() }
})

it('keeps loaded ambient video playing on a visible attached desktop and releases it on unmount', async () => {
  vi.useFakeTimers()
  const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
  const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
  const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
  const load = vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {})
  const container = document.createElement('div'), root = createRoot(container)
  try {
    await act(async () => root.render(createElement(VideoBackground, { visual: {kind:'video',src:'/background.mp4'}, ambient:true, isPlaying:false, isMuted:true, volume:0, settings:defaultWallpaper })))
    const video = container.querySelector('video')!
    await act(async () => { video.dispatchEvent(new Event('loadeddata')); await vi.advanceTimersByTimeAsync(700) })
    expect(play).not.toHaveBeenCalled()
    await act(async () => document.documentElement.setAttribute('data-wallpaper-input', ''))
    expect(play).toHaveBeenCalled()
    expect(video.muted).toBe(true)
    await act(async () => document.documentElement.removeAttribute('data-wallpaper-input'))
    expect(pause).toHaveBeenCalled()
    await act(async () => root.unmount())
    expect(video.hasAttribute('src')).toBe(false)
    expect(load).toHaveBeenCalled()
  } finally { await act(async () => root.unmount()); document.documentElement.removeAttribute('data-wallpaper-input'); hidden.mockRestore(); play.mockRestore(); pause.mockRestore(); load.mockRestore(); vi.useRealTimers() }
})

it('waits for decoded artwork, ignores stale loads, survives pause, and falls back on image errors', async () => {
  vi.useFakeTimers()
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  const container = document.createElement('div')
  const root = createRoot(container)
  const props = { isPlaying: true, isMuted: true, volume: 0, ambient: true, settings: defaultWallpaper }
  const render = (id: string, src: string, playing = true) => act(async () => root.render(createElement(VideoBackground, { ...props, trackId: id, visual: { kind: 'image', src }, artwork: src, isPlaying: playing })))
  const finish = async (image: HTMLImageElement) => act(async () => { image.dispatchEvent(new Event('load')); await vi.advanceTimersByTimeAsync(700) })
  try {
    await render('one', '/one.jpg')
    await finish(container.querySelector('img[src="/one.jpg"]')!)
    const first = container.querySelector('img[src="/one.jpg"]')!
    expect((first as HTMLImageElement).style.objectFit).toBe('cover')
    expect((first as HTMLImageElement).style.objectPosition).toContain('var(--album-x, 50%)')
    expect((first as HTMLImageElement).style.getPropertyValue('--ambient-scale')).toBe('1')
    expect(first.getAttribute('data-moving')).toBe('true')
    const duration = (first as HTMLImageElement).style.animationDuration
    const idle = container.querySelector<HTMLElement>('.video-background__idle')!
    const idleDuration = idle.style.animationDuration
    expect(idle.dataset.moving).toBe('true')
    await render('one', '/one.jpg', false)
    expect(container.querySelector('img[src="/one.jpg"]')).toBe(first)
    expect(first.getAttribute('data-moving')).toBe('true')
    expect((first as HTMLImageElement).style.animationDuration).toBe(duration)
    expect(container.querySelector('.video-background__idle')).toBe(idle)
    expect(idle.style.animationDuration).toBe(idleDuration)
    expect(idle.style.animationPlayState).toBe('running')
    await render('two', '/two.jpg')
    const second = container.querySelector<HTMLImageElement>('img[src="/two.jpg"]')!
    let decoded!: () => void
    Object.defineProperty(second, 'decode', { value: () => new Promise<void>((resolve) => { decoded = resolve }) })
    await act(async () => { second.dispatchEvent(new Event('load')); await vi.advanceTimersByTimeAsync(1000) })
    expect(container.querySelector('img[src="/one.jpg"]')).toBe(first)
    await act(async () => { decoded(); await vi.advanceTimersByTimeAsync(700) })
    expect(container.querySelector('img[src="/one.jpg"]')).toBeNull()
    await render('three', '/three.jpg')
    const stale = container.querySelector<HTMLImageElement>('img[src="/three.jpg"]')!
    await render('four', '/four.jpg')
    await finish(stale)
    expect(container.querySelector('img[src="/two.jpg"]')).not.toBeNull()
    await act(async () => { container.querySelector('img[src="/four.jpg"]')!.dispatchEvent(new Event('error')) })
    const fallback = container.querySelector<HTMLImageElement>('img[src="/images/afterglow-night.png"]')!
    expect(fallback).not.toBeNull()
    await finish(fallback)
    expect(container.querySelector('img[src="/two.jpg"]')).toBeNull()
    // Tracks with a shared album still get a fresh motion layer.
    await render('five', '/shared.jpg')
    await finish(container.querySelector('img[src="/shared.jpg"]')!)
    const shared = container.querySelector('img[src="/shared.jpg"]')!
    await render('six', '/shared.jpg')
    expect(container.querySelectorAll('img[src="/shared.jpg"]')).toHaveLength(2)
    expect(container.querySelectorAll('img[src="/shared.jpg"]')[0]).toBe(shared)
  } finally { await act(async () => root.unmount()); vi.useRealTimers(); container.remove() }
})

it('pauses an inactive browser scene but keeps attached desktop wallpaper animation running', async () => {
  const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
  const container = document.createElement('div'), root = createRoot(container)
  try {
    await act(async () => root.render(createElement(VideoBackground, {visual:{kind:'image',src:'/scene.jpg'},ambient:true,isPlaying:false,isMuted:true,volume:0,settings:defaultWallpaper})))
    const image = container.querySelector<HTMLImageElement>('img[src="/scene.jpg"]')!
    expect(image.style.animationPlayState).toBe('paused')
    const idle = container.querySelector<HTMLElement>('.video-background__idle')!
    expect(idle.style.animationPlayState).toBe('paused')
    await act(async () => document.documentElement.setAttribute('data-wallpaper-input',''))
    expect(image.style.animationPlayState).toBe('running')
    expect(idle.style.animationPlayState).toBe('running')
    await act(async () => document.documentElement.removeAttribute('data-wallpaper-input'))
    expect(image.style.animationPlayState).toBe('paused')
  } finally {await act(async () => root.unmount());hidden.mockRestore();document.documentElement.removeAttribute('data-wallpaper-input')}
})
