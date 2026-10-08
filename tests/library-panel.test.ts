import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { MusicBrowser } from '../src/components/MusicBrowser/MusicBrowser'
import { mockTrack } from '../src/data/mockTrack'
import { defaultAppearance } from '../src/types/interfaceSettings'
import { getBrowserRecent, getLocalPlaylists, recordBrowserRecent } from '../src/services/musicBrowser/localCollections'

it('creates a persistent local playlist, opens its tracks, plays its queue, and returns to the library', async () => {
  localStorage.clear()
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  const track = { ...mockTrack, id: 'local-test', title: 'Private local song', audioSrc: 'blob:private' }
  const playLocal = vi.fn(() => true)
  const props = { open: true, onOpen: vi.fn(), onClose: vi.fn(), onPlayTrack: vi.fn(() => true), localTracks: [track], localLoading: false, localError: '', onAddLocalFiles: vi.fn(), onRelinkLocalFile: vi.fn(), onPlayLocalTrack: playLocal, onRemoveLocalTrack: vi.fn(async () => {}), onSetLocalVisual: vi.fn(async () => {}), spotifyConnected: false, onConnectSpotify: vi.fn(), currentTrack: null, playbackSource: 'mock' as const, isPlaying: false, appearance: { ...defaultAppearance, transitionStyle: 'instant' as const } }
  const click = async (text: string) => { const button = [...container.querySelectorAll('button')].find((button) => button.textContent?.trim() === text || button.getAttribute('aria-label') === text); expect(button).toBeTruthy(); await act(async () => button!.click()) }
  try {
    await act(async () => root.render(createElement(MusicBrowser, props)))
    await click('Track menu for Private local song')
    await click('Add to playlist')
    const name = container.querySelector<HTMLInputElement>('input[aria-label="New playlist name"]')!
    await act(async () => { const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!; setter.call(name,'Night Files'); name.dispatchEvent(new Event('input',{ bubbles: true })) })
    await act(async () => container.querySelector('.music-browser__track-menu form')!.dispatchEvent(new Event('submit',{ bubbles: true, cancelable: true })))
    expect(getLocalPlaylists()[0]).toMatchObject({ name: 'Night Files', trackIds: ['local-test'] })
    await click('Open Night Files')
    expect(container.querySelector('h1')?.textContent).toBe('Night Files')
    expect(container.querySelector('.music-browser__local')).toBeNull()
    await click('Shuffle')
    expect(playLocal).toHaveBeenCalledWith('local-test',[track])
    await click('Back')
    expect(container.querySelector('.music-browser__local')).not.toBeNull()
    await click('Track menu for Private local song')
    await click('Track information')
    expect(container.querySelector('.music-browser__track-menu')?.textContent).toContain(track.artist)
  } finally { await act(async () => root.unmount()); container.remove(); localStorage.clear() }
})
it('stores recent metadata without private object URLs or lyric payloads', () => {
  localStorage.clear()
  recordBrowserRecent({ ...mockTrack, audioSrc: 'blob:private', localFileName: 'song.mp3' }, 'local')
  expect(getBrowserRecent()[0].track).not.toHaveProperty('audioSrc')
  expect(getBrowserRecent()[0].track.lyrics).toEqual([])
  recordBrowserRecent(mockTrack,'local')
  expect(getBrowserRecent()).toHaveLength(1)
  localStorage.clear()
})
