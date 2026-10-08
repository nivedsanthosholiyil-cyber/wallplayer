import type { TimedLyric, Track } from '../../types/music'

/** The lyric engine consumes this data shape regardless of its eventual provider. */
export interface LyricsService {
  getTimedLyrics(track: Track): Promise<TimedLyric[]>
}
