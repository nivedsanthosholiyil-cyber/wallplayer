export type SingerId = 'artist-a' | 'artist-b'

export interface Singer {
  id: SingerId
  name: string
}

export interface TimedLyric {
  id: string
  start: number
  end: number
  text: string
  singer: SingerId
}

export type VisualSource =
  | { kind: 'image'; src: string }
  | { kind: 'video'; src: string; poster?: string }

export interface Track {
  id: string
  title: string
  artist: string
  artists?: { id: string | null; name: string }[]
  album?: string
  artwork?: string | null
  duration: number
  visual: VisualSource
  /** Object URL for a local audio file. It is never sent to a service. */
  audioSrc?: string
  localFileName?: string
  singers: readonly [Singer, Singer]
  lyrics: TimedLyric[]
}

export interface NormalizedPlayback {
  trackId: string
  title: string
  artists: { id: string | null; name: string }[]
  album: string
  artwork: string | null
  duration: number
  position: number
  isPlaying: boolean
  deviceAvailable: boolean
  deviceId: string | null
  deviceRestricted: boolean
  supportsVolume: boolean
  volume: number | null
}
