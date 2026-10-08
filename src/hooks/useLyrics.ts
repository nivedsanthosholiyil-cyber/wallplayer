import { useMemo } from 'react'
import type { Singer, TimedLyric, Track } from '../types/music'

export interface LyricWindow {
  lines: TimedLyric[]
  activeIndex: number
  previous?: TimedLyric
  current?: TimedLyric
  next?: TimedLyric
}

export function lyricWindow(lines: TimedLyric[], time: number): LyricWindow {
  const activeIndex = lines.findIndex((line) => time >= line.start && time < line.end)
  const nextIndex = lines.findIndex((line) => line.start > time)
  return {
    lines,
    activeIndex,
    previous: activeIndex >= 0 ? lines[activeIndex - 1] : nextIndex > 0 ? lines[nextIndex - 1] : undefined,
    current: activeIndex >= 0 ? lines[activeIndex] : undefined,
    next: activeIndex >= 0 ? lines[activeIndex + 1] : nextIndex >= 0 ? lines[nextIndex] : undefined,
  }
}

export interface LyricsState {
  main: LyricWindow
  streams: { singer: Singer; view: LyricWindow }[]
  activeSinger?: Singer
}

export function useLyrics(track: Track, currentTime: number): LyricsState {
  return useMemo(() => {
    const main = lyricWindow(track.lyrics, currentTime)
    const streams = track.singers.map((singer) => {
      const singerLines = track.lyrics.filter((line) => line.singer === singer.id)
      const continuousLines = singerLines.map((line, index) => ({
        ...line,
        end: singerLines[index + 1]?.start ?? track.duration,
      }))
      return { singer, view: lyricWindow(continuousLines, currentTime) }
    })
    return { main, streams, activeSinger: track.singers.find((singer) => singer.id === main.current?.singer) }
  }, [track, currentTime])
}
