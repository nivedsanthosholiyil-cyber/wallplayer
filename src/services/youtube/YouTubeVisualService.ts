import type { Track, VisualSource } from '../../types/music'

/** Resolves a track to a visual without coupling the background component to a provider. */
export interface YouTubeVisualService {
  getVisual(track: Track): Promise<VisualSource | null>
}
