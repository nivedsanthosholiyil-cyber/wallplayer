import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import { chooseVideoFile, resolveTrackVisual, type SavedVisual } from '../src/services/visuals/VisualLibrary'
import { VideoBackground } from '../src/components/Background/VideoBackground'
import { mockTrack } from '../src/data/mockTrack'
import { defaultWallpaper } from '../src/types/interfaceSettings'

const saved: SavedVisual = { spotifyTrackId: mockTrack.id, title: mockTrack.title, artist: mockTrack.artist, source: 'pexels', pexelsId: 42, downloadedAt: '', src: '/api/visuals/library/test/file', width: 1280, height: 720, duration: 12, bytes: 1000 }
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })
it('resolves track-ID associations before artwork, then the existing fallback', () => {
  const track = { ...mockTrack, artwork: '/cover.jpg' }
  expect(resolveTrackVisual(track, saved, 'auto', mockTrack.visual)).toEqual({ kind: 'video', src: saved.src })
  expect(resolveTrackVisual(track, saved, 'album-art', mockTrack.visual)).toEqual({ kind: 'image', src: '/cover.jpg' })
  expect(resolveTrackVisual(track, { ...saved, spotifyTrackId: 'another-track' }, 'auto', mockTrack.visual)).toEqual({ kind: 'image', src: '/cover.jpg' })
  expect(resolveTrackVisual({ ...mockTrack, artwork: null }, null, 'track-visual', mockTrack.visual)).toEqual(mockTrack.visual)
})
it('chooses a modest MP4 instead of downloading 4K or unsupported video formats', () => {
  const files = [{ id: 1, width: 3840, height: 2160, quality: 'hd', fileType: 'video/mp4', link: '4k' }, { id: 2, width: 1280, height: 720, quality: 'hd', fileType: 'video/mp4', link: 'hd' }]
  expect(chooseVideoFile({ id: 1, width: 3840, height: 2160, duration: 10, thumbnail: '', url: '', creator: '', creatorUrl: '', videoFiles: files })?.id).toBe(2)
})
it('retains the previous background until the new video loads and forces ambient mute/loop while paused', async () => {
  vi.useFakeTimers()
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {})
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  const container = document.createElement('div')
  const root = createRoot(container)
  const props = { isPlaying: false, isMuted: false, volume: 1, ambient: true, settings: { ...defaultWallpaper, loopVideo: false } }
  try {
    await act(async () => root.render(createElement(VideoBackground, { ...props, visual: { kind: 'image', src: '/album.jpg' } })))
    const album = container.querySelector<HTMLImageElement>('img[src="/album.jpg"]')!
    await act(async () => { album.dispatchEvent(new Event('load')); await vi.advanceTimersByTimeAsync(700) })
    await act(async () => root.render(createElement(VideoBackground, { ...props, visual: { kind: 'video', src: '/local.mp4' } })))
    expect(container.querySelector('img[src="/album.jpg"]')).not.toBeNull()
    const video = container.querySelector('video')!
    expect(video.muted).toBe(true)
    expect(video.loop).toBe(true)
    expect(video.autoplay).toBe(true)
    expect(video.volume).toBe(0)
    await act(async () => { video.dispatchEvent(new Event('loadeddata')); await vi.advanceTimersByTimeAsync(700) })
    expect(container.querySelector('img[src="/album.jpg"]')).toBeNull()
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalled()
    await act(async () => root.render(createElement(VideoBackground, { ...props, visual: { kind: 'image', src: '/next-album.jpg' } })))
    expect(container.querySelector('video')).not.toBeNull()
    await act(async () => { container.querySelector('img[src="/next-album.jpg"]')!.dispatchEvent(new Event('load')); await vi.advanceTimersByTimeAsync(700) })
    expect(container.querySelector('video')).toBeNull()
  } finally { await act(async () => root.unmount()); container.remove() }
})
