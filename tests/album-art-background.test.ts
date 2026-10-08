import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { VideoBackground } from '../src/components/Background/VideoBackground'
import { defaultWallpaper } from '../src/types/interfaceSettings'

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
    await render('one', '/one.jpg', false)
    expect(container.querySelector('img[src="/one.jpg"]')).toBe(first)
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