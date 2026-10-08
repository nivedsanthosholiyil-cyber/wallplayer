import type { Singer, TimedLyric, Track } from '../types/music'

const visual = { kind: 'image' as const, src: '/images/afterglow-night.png' }

const singers: readonly [Singer, Singer] = [
  { id: 'artist-a', name: 'ARTIST A' },
  { id: 'artist-b', name: 'ARTIST B' },
]

function makeTrack(details: { id: string; title: string; artist: string; duration: number; lyrics: { time: number; text: string }[] }): Track {
  const lyrics: TimedLyric[] = details.lyrics.map((line, index) => ({
    id: `${details.id}-line-${String(index + 1).padStart(2, '0')}`,
    start: line.time,
    end: details.lyrics[index + 1]?.time ?? details.duration,
    text: line.text,
    singer: index % 2 === 0 ? 'artist-a' : 'artist-b',
  }))
  return { id: details.id, title: details.title, artist: details.artist, album: details.title, artwork: `/artwork/${details.id === 'blue-hour' ? 'blue-hour' : details.id === 'undertow' ? 'undertow' : 'afterglow'}.svg`, duration: details.duration, visual, singers, lyrics }
}

// Original sample lines. Every song shares the existing local visual in this offline prototype.
const afterglow = [
  { time: 0, text: 'Let the city fall behind' },
  { time: 13, text: 'Follow where the water goes' },
  { time: 26, text: 'Every light we left behind' },
  { time: 39, text: 'Turns to stars beneath the road' },
  { time: 52, text: 'And if the world is moving fast' },
  { time: 65, text: 'We can let the moment last' },
  { time: 78, text: 'Stay here in the afterglow' },
  { time: 91, text: 'Where the quiet feels like home' },
  { time: 104, text: 'All the waves beneath the moon' },
  { time: 117, text: 'Carry us into the blue' },
  { time: 130, text: 'Nothing left for us to chase' },
  { time: 143, text: 'Only time enough to stay' },
  { time: 156, text: 'Stay here in the afterglow' },
  { time: 169, text: 'Where the quiet feels like home' },
  { time: 182, text: 'When the morning finds the shore' },
  { time: 195, text: 'We will be here a little more' },
]

const blueHour = [
  { time: 0, text: 'The sky remembers every shade' },
  { time: 15, text: 'Before the daylight slips away' },
  { time: 30, text: 'I hear your voice across the tide' },
  { time: 45, text: 'A silver thread against the night' },
  { time: 60, text: 'Hold the blue a little longer' },
  { time: 75, text: 'Let the distant lights grow softer' },
  { time: 90, text: 'We are somewhere in between' },
  { time: 105, text: 'What is real and what we dream' },
  { time: 120, text: 'There is nothing we must say' },
  { time: 135, text: 'To keep the darkness far away' },
  { time: 150, text: 'Hold the blue a little longer' },
  { time: 165, text: 'Till the morning comes to find us' },
  { time: 180, text: 'And the water turns to gold' },
]

const undertow = [
  { time: 0, text: 'Underneath the quiet waves' },
  { time: 15, text: 'A thousand echoes know our names' },
  { time: 30, text: 'The shoreline fades into the blue' },
  { time: 45, text: 'And every road leads back to you' },
  { time: 60, text: 'We drift beneath the open sky' },
  { time: 75, text: 'With constellations in our eyes' },
  { time: 90, text: 'Let the undertow carry me' },
  { time: 105, text: 'Somewhere the night can set us free' },
  { time: 120, text: 'No more turning toward the shore' },
  { time: 135, text: 'We have all we came here for' },
  { time: 150, text: 'Let the undertow carry me' },
  { time: 165, text: 'Beyond the place we used to be' },
  { time: 180, text: 'The stars are fading into dawn' },
  { time: 195, text: 'But we will keep the feeling on' },
]

export const mockTracks: Track[] = [
  makeTrack({ id: 'afterglow', title: 'Afterglow', artist: 'The Quiet Hours', duration: 212, lyrics: afterglow }),
  makeTrack({ id: 'blue-hour', title: 'Blue Hour', artist: 'The Quiet Hours', duration: 198, lyrics: blueHour }),
  makeTrack({ id: 'undertow', title: 'Undertow', artist: 'The Quiet Hours', duration: 210, lyrics: undertow }),
]

export const mockTrack = mockTracks[0]
