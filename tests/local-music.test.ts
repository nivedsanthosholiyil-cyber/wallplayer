import { beforeEach, expect, it } from 'vitest'
import { playerStore } from '../src/store/playerStore'
import type { Track } from '../src/types/music'
import { describeAudioFile, isSupportedAudioFile } from '../src/services/localMusic/localMusic'

const track = (id: string): Track => ({
  id: `local-${id}`, title: id, artist: 'Local artist', album: 'Local Music', artwork: '/artwork/afterglow.svg',
  duration: 12, visual: { kind: 'image', src: '/images/afterglow-night.png' }, audioSrc: `blob:${id}`,
  singers: [{ id: 'artist-a', name: 'Local artist' }, { id: 'artist-b', name: 'Local artist' }], lyrics: [],
})

beforeEach(() => {
  playerStore.useMock()
  playerStore.pause()
})

it('accepts supported audio formats by MIME type or filename extension', () => {
  expect(['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'].every((extension) => isSupportedAudioFile(new File(['audio'], `song.${extension}`)))).toBe(true)
  expect(isSupportedAudioFile(new File(['text'], 'notes.txt', { type: 'text/plain' }))).toBe(false)
})

it('reads common ID3 title, artist, and album tags while keeping a filename fallback', async () => {
  const frame = (id: string, encoding: number, text: string) => {
    const body = encoding === 1
      ? new Uint8Array([1, 0xff, 0xfe, ...Array.from(text, (char) => char.charCodeAt(0)), 0, 0].flatMap((value, index, values) => index >= 3 && index < values.length - 2 ? [value, 0] : [value]))
      : new Uint8Array([0, ...new TextEncoder().encode(text)])
    const frameBytes = new Uint8Array(10 + body.length)
    frameBytes.set(new TextEncoder().encode(id))
    new DataView(frameBytes.buffer).setUint32(4, body.length)
    frameBytes.set(body, 10)
    return frameBytes
  }
  const frames = [frame('TIT2', 0, 'Night Walk'), frame('TPE1', 0, 'The Quiet Hours'), frame('TALB', 1, 'Blue Hour')]
  const frameLength = frames.reduce((sum, entry) => sum + entry.length, 0)
  const header = new Uint8Array([0x49, 0x44, 0x33, 3, 0, 0, (frameLength >> 21) & 0x7f, (frameLength >> 14) & 0x7f, (frameLength >> 7) & 0x7f, frameLength & 0x7f])
  const bytes = new Uint8Array(header.length + frameLength)
  bytes.set(header)
  let offset = header.length
  for (const entry of frames) { bytes.set(entry, offset); offset += entry.length }
  const file = new File([bytes], 'fallback-name.mp3', { type: 'audio/mpeg' })
  await expect(describeAudioFile(file)).resolves.toMatchObject({ title: 'Night Walk', artist: 'The Quiet Hours', album: 'Blue Hour' })
  await expect(describeAudioFile(new File(['audio'], 'simple-name.wav'))).resolves.toMatchObject({ title: 'simple-name', artist: 'Unknown artist' })
})

it('plays local tracks through the shared store with the imported queue', () => {
  const queue = [track('one'), track('two')]
  expect(playerStore.selectLocalTrack('local-one', queue)).toBe(true)
  expect(playerStore.getSnapshot()).toMatchObject({ source: 'local', localIndex: 0, localTrack: queue[0], isPlaying: true, currentTime: 0, isMuted: false })

  playerStore.seek(5)
  expect(playerStore.getSnapshot().currentTime).toBe(5)
  playerStore.next()
  expect(playerStore.getSnapshot()).toMatchObject({ localIndex: 1, localTrack: queue[1], isPlaying: true, currentTime: 0 })
  playerStore.previous()
  expect(playerStore.getSnapshot()).toMatchObject({ localIndex: 0, localTrack: queue[0], currentTime: 0 })
})

it('advances when a local file ends and stops at the end of the queue', () => {
  const queue = [track('one'), track('two')]
  playerStore.selectLocalTrack('local-one', queue)
  playerStore.advanceLocalAfterEnd()
  expect(playerStore.getSnapshot()).toMatchObject({ localIndex: 1, localTrack: queue[1], isPlaying: true, currentTime: 0 })
  playerStore.advanceLocalAfterEnd()
  expect(playerStore.getSnapshot()).toMatchObject({ localIndex: 1, localTrack: queue[1], isPlaying: false, currentTime: 12 })
})
