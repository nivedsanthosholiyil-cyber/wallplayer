import { useCallback, useEffect, useRef, useState } from 'react'
import { mockTrack } from '../data/mockTrack'
import type { Track } from '../types/music'
import { describeAudioFile, isSupportedAudioFile, localMusicDatabase, type LocalMusicRecord } from '../services/localMusic/localMusic'

const localArtwork = '/artwork/local-music.svg'

function toTrack(record: LocalMusicRecord, audioSrc?: string): Track {
  const singer = { id: 'artist-a' as const, name: record.artist }
  return {
    id: `local-${record.id}`,
    title: record.title,
    artist: record.artist,
    album: record.album,
    artwork: localArtwork,
    duration: record.duration,
    visual: mockTrack.visual,
    audioSrc,
    localFileName: record.fileName,
    singers: [singer, { id: 'artist-b', name: record.artist }],
    lyrics: [],
  }
}

function createId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

export function useLocalMusic() {
  const [tracks, setTracks] = useState<Track[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const objectUrls = useRef(new Map<string, string>())
  const mounted = useRef(false)

  const materialize = useCallback((record: LocalMusicRecord) => {
    if (!record.file || record.file.size === 0) return toTrack(record)
    let url = objectUrls.current.get(record.id)
    if (!url) {
      if (typeof URL.createObjectURL !== 'function') return toTrack(record)
      url = URL.createObjectURL(record.file)
      objectUrls.current.set(record.id, url)
    }
    return toTrack(record, url)
  }, [])

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const records = await localMusicDatabase.list()
      if (!mounted.current) return
      const nextIds = new Set(records.map((record) => record.id))
      for (const [id, url] of objectUrls.current) {
        if (!nextIds.has(id)) { URL.revokeObjectURL(url); objectUrls.current.delete(id) }
      }
      setTracks(records.map(materialize))
      setError('')
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : 'Could not load local music.')
    } finally {
      if (mounted.current) setLoading(false)
    }
  }, [materialize])

  useEffect(() => {
    mounted.current = true
    void refresh()
    return () => {
      mounted.current = false
      for (const url of objectUrls.current.values()) URL.revokeObjectURL(url)
      objectUrls.current.clear()
    }
  }, [refresh])

  const addFiles = useCallback(async (files: FileList | File[]) => {
    const audioFiles = Array.from(files).filter(isSupportedAudioFile)
    if (audioFiles.length === 0) { setError('Choose MP3, WAV, OGG, M4A, AAC, or FLAC audio files.'); return }
    setError('')
    const added: Track[] = []
    for (const file of audioFiles) {
      try {
        const description = await describeAudioFile(file)
        const record: LocalMusicRecord = {
          id: createId(), fileName: file.name, ...description, mimeType: file.type || 'application/octet-stream',
          addedAt: Date.now(), file,
        }
        await localMusicDatabase.save(record)
        if (mounted.current) added.push(materialize(record))
      } catch (cause) {
        if (mounted.current) setError(cause instanceof Error ? cause.message : `Could not add ${file.name}.`)
      }
    }
    if (mounted.current && added.length) setTracks((current) => [...current, ...added])
  }, [materialize])

  const relinkFile = useCallback(async (trackId: string, file: File) => {
    const id = trackId.replace(/^local-/, '')
    try {
      if (!isSupportedAudioFile(file)) throw new Error('Choose a supported audio file to relink this track.')
      const records = await localMusicDatabase.list()
      const existing = records.find((record) => record.id === id)
      if (!existing) throw new Error('This local track is no longer in the library.')
      const description = await describeAudioFile(file)
      const record = { ...existing, ...description, fileName: file.name, mimeType: file.type || existing.mimeType, file }
      await localMusicDatabase.save(record)
      const previousUrl = objectUrls.current.get(id)
      if (previousUrl) URL.revokeObjectURL(previousUrl)
      objectUrls.current.delete(id)
      if (mounted.current) {
        const nextTrack = materialize(record)
        setTracks((current) => current.map((track) => track.id === trackId ? nextTrack : track))
        setError('')
      }
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : 'Could not relink this audio file.')
    }
  }, [materialize])

  return { tracks, loading, error, addFiles, relinkFile }
}
