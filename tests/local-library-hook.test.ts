import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  list: vi.fn().mockResolvedValue([] as unknown[]),
  save: vi.fn().mockResolvedValue('saved'),
  describe: vi.fn(async (file: File) => ({ title: file.name.replace(/\.[^.]+$/, ''), artist: 'Local artist', album: 'Local Music', duration: 42 })),
}))

vi.mock('../src/services/localMusic/localMusic', () => ({
  localMusicDatabase: { list: mocks.list, save: mocks.save },
  describeAudioFile: mocks.describe,
  isSupportedAudioFile: (file: File) => /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(file.name),
}))

import { useLocalMusic } from '../src/hooks/useLocalMusic'
import { playerStore } from '../src/store/playerStore'
;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

afterEach(() => {
  mocks.list.mockClear().mockResolvedValue([])
  mocks.save.mockClear().mockResolvedValue('saved')
  mocks.describe.mockClear()
  vi.restoreAllMocks()
  playerStore.useMock()
})

it('replaces the active queue source when a local file is relinked', async () => {
  const createUrl = vi.fn().mockReturnValueOnce('blob:original').mockReturnValueOnce('blob:replacement')
  const revokeUrl = vi.fn()
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createUrl })
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeUrl })
  const file = new File(['old audio'], 'old.mp3', { type: 'audio/mpeg' })
  mocks.list.mockResolvedValue([{ id: 'relink', file, fileName: file.name, title: 'Old track', artist: 'Artist', album: 'Album', duration: 42, mimeType: file.type, addedAt: 0 }])
  let library!: ReturnType<typeof useLocalMusic>
  function Probe() { library = useLocalMusic(); return null }
  const container = document.createElement('div'); document.body.append(container)
  const root = createRoot(container)
  try {
    await act(async () => root.render(createElement(Probe)))
    playerStore.selectLocalTrack('local-relink', library.tracks)
    playerStore.seek(10)
    playerStore.pause()
    const replacement = new File(['new audio'], 'replacement.mp3', { type: 'audio/mpeg' })
    await act(async () => { await library.relinkFile('local-relink', replacement) })
    expect(library.tracks[0].audioSrc).toBe('blob:replacement')
    expect(playerStore.getSnapshot()).toMatchObject({ localTrack: { audioSrc: 'blob:replacement' }, localQueue: [{ audioSrc: 'blob:replacement' }], isPlaying: false, currentTime: 0 })
    expect(revokeUrl).toHaveBeenCalledWith('blob:original')
  } finally { await act(async () => root.unmount()); container.remove() }
})

it('keeps imported file data local and revokes its playback URL when the library unmounts', async () => {
  const createUrl = vi.fn(() => 'blob:local-test-track')
  const revokeUrl = vi.fn()
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createUrl })
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeUrl })

  let library!: ReturnType<typeof useLocalMusic>
  function Probe() { library = useLocalMusic(); return null }
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  await act(async () => { root.render(createElement(Probe)) })
  const file = new File(['private audio bytes'], 'night-drive.mp3', { type: 'audio/mpeg' })
  await act(async () => { await library.addFiles([file]) })

  expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ file, fileName: 'night-drive.mp3', title: 'night-drive' }))
  expect(library.tracks[0]).toMatchObject({ title: 'night-drive', artist: 'Local artist', audioSrc: 'blob:local-test-track' })
  expect(mocks.save.mock.calls[0][0]).not.toHaveProperty('url')

  await act(async () => { root.unmount() })
  expect(revokeUrl).toHaveBeenCalledWith('blob:local-test-track')
  container.remove()
})
