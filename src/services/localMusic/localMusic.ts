export interface LocalMusicRecord {
  id: string
  fileName: string
  title: string
  artist: string
  album: string
  duration: number
  mimeType: string
  addedAt: number
  file?: Blob
}

const databaseName = 'musicwall-local-music'
const storeName = 'tracks'
let databasePromise: Promise<IDBDatabase> | null = null

function openDatabase() {
  if (databasePromise) return databasePromise
  databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('Local music storage is unavailable in this browser.'))
      return
    }
    const request = indexedDB.open(databaseName, 1)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(storeName)) database.createObjectStore(storeName, { keyPath: 'id' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Could not open local music storage.'))
    request.onblocked = () => reject(new Error('Close other MusicWall tabs to update local music storage.'))
  }).catch((error: unknown) => {
    databasePromise = null
    throw error
  })
  return databasePromise
}

async function transact<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const database = await openDatabase()
  return new Promise<T>((resolve, reject) => {
    const transaction = database.transaction(storeName, mode)
    const request = action(transaction.objectStore(storeName))
    let result: T
    request.onsuccess = () => { result = request.result }
    request.onerror = () => reject(request.error ?? new Error('Could not update local music storage.'))
    transaction.oncomplete = () => resolve(result)
    transaction.onerror = () => reject(transaction.error ?? new Error('Could not update local music storage.'))
    transaction.onabort = () => reject(transaction.error ?? new Error('Local music storage was interrupted.'))
  })
}

export const localMusicDatabase = {
  list: () => transact<LocalMusicRecord[]>('readonly', (store) => store.getAll()),
  save: (record: LocalMusicRecord) => transact<IDBValidKey>('readwrite', (store) => store.put(record)),
}

function decodeText(bytes: Uint8Array, encoding = 0) {
  let end = bytes.length
  if (encoding === 1 || encoding === 2) {
    for (let index = 0; index + 1 < bytes.length; index += 2) {
      if (bytes[index] === 0 && bytes[index + 1] === 0) { end = index; break }
    }
  } else {
    const terminator = bytes.indexOf(0)
    if (terminator >= 0) end = terminator
  }
  const content = bytes.subarray(0, end)
  try {
    if (encoding === 1) return new TextDecoder('utf-16').decode(content).replace(/^\uFEFF/, '').trim()
    if (encoding === 2) return new TextDecoder('utf-16be').decode(content).trim()
    if (encoding === 3) return new TextDecoder('utf-8').decode(content).trim()
    return new TextDecoder('windows-1252').decode(content).trim()
  } catch { return '' }
}

function readId3(bytes: Uint8Array): Partial<Pick<LocalMusicRecord, 'title' | 'artist' | 'album'>> {
  const tags: Partial<Pick<LocalMusicRecord, 'title' | 'artist' | 'album'>> = {}
  if (bytes.length >= 10 && String.fromCharCode(...bytes.subarray(0, 3)) === 'ID3') {
    const version = bytes[3]
    const size = ((bytes[6] & 0x7f) << 21) | ((bytes[7] & 0x7f) << 14) | ((bytes[8] & 0x7f) << 7) | (bytes[9] & 0x7f)
    let offset = 10 + ((bytes[5] & 0x40) ? (version === 2 ? 0 : 4) : 0)
    const end = Math.min(bytes.length, 10 + size)
    const fields: Record<string, 'title' | 'artist' | 'album'> = { TIT2: 'title', TPE1: 'artist', TALB: 'album', TT2: 'title', TP1: 'artist', TAL: 'album' }
    const frameHeaderSize = version === 2 ? 6 : 10
    const frameIdSize = version === 2 ? 3 : 4
    while (offset + frameHeaderSize <= end) {
      const id = String.fromCharCode(...bytes.subarray(offset, offset + frameIdSize))
      if (!/^[A-Z0-9]{3,4}$/.test(id) || id.startsWith('\0')) break
      const frameSize = version === 2
        ? (bytes[offset + 3] << 16) | (bytes[offset + 4] << 8) | bytes[offset + 5]
        : version === 4
        ? ((bytes[offset + 4] & 0x7f) << 21) | ((bytes[offset + 5] & 0x7f) << 14) | ((bytes[offset + 6] & 0x7f) << 7) | (bytes[offset + 7] & 0x7f)
        : (bytes[offset + 4] * 0x1000000) + (bytes[offset + 5] << 16) + (bytes[offset + 6] << 8) + bytes[offset + 7]
      if (frameSize <= 0 || offset + frameHeaderSize + frameSize > end) break
      const tag = fields[id]
      const frameStart = offset + frameHeaderSize
      if (tag && !tags[tag]) tags[tag] = decodeText(bytes.subarray(frameStart + 1, frameStart + frameSize), bytes[frameStart])
      offset += frameHeaderSize + frameSize
    }
  }
  if (bytes.length >= 128 && String.fromCharCode(...bytes.subarray(bytes.length - 128, bytes.length - 125)) === 'TAG') {
    const start = bytes.length - 125
    tags.title ||= decodeText(bytes.subarray(start, start + 30))
    tags.artist ||= decodeText(bytes.subarray(start + 30, start + 60))
    tags.album ||= decodeText(bytes.subarray(start + 60, start + 90))
  }
  return tags
}

function readDuration(file: Blob): Promise<number> {
  return new Promise((resolve) => {
    if (typeof Audio === 'undefined' || (typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent)) || typeof URL.createObjectURL !== 'function') { resolve(0); return }
    const audio = new Audio()
    const objectUrl = URL.createObjectURL(file)
    let settled = false
    const finish = (duration: number) => {
      if (settled) return
      settled = true
      window.clearTimeout(timeout)
      try { audio.removeAttribute('src'); audio.load() } catch { /* Metadata probing is optional. */ }
      URL.revokeObjectURL(objectUrl)
      resolve(Number.isFinite(duration) ? duration : 0)
    }
    const timeout = window.setTimeout(() => finish(0), 8_000)
    audio.preload = 'metadata'
    audio.onloadedmetadata = () => finish(audio.duration)
    audio.onerror = () => finish(0)
    audio.src = objectUrl
  })
}

export async function describeAudioFile(file: File) {
  const header = new Uint8Array(await file.slice(0, 256 * 1024).arrayBuffer())
  const footer = /\.mp3$/i.test(file.name) && file.size > 256 * 1024
    ? new Uint8Array(await file.slice(Math.max(0, file.size - 128)).arrayBuffer())
    : new Uint8Array()
  const bytes = new Uint8Array(header.length + footer.length)
  bytes.set(header)
  bytes.set(footer, header.length)
  // Keep the optional ID3v1 footer at the end where its fixed offset is expected.
  if (footer.length) bytes.set(footer, bytes.length - footer.length)
  const tags = /\.mp3$/i.test(file.name) ? readId3(bytes) : {}
  const titleFromName = file.name.replace(/\.[^.]+$/, '').trim()
  return {
    title: tags.title || titleFromName || file.name,
    artist: tags.artist || 'Unknown artist',
    album: tags.album || 'Local Music',
    duration: await readDuration(file),
  }
}

export function isSupportedAudioFile(file: File) {
  return file.type.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(file.name)
}
