import type { Track, VisualSource } from '../../types/music'
export interface VisualFile { id: number; width: number; height: number; quality: string; fileType: string; link: string }
export interface PexelsVideo { id: number; width: number; height: number; duration: number; thumbnail: string; url: string; creator: string; creatorUrl: string; videoFiles: VisualFile[] }
export interface SavedVisual { spotifyTrackId: string; title: string; artist: string; source: 'pexels'; pexelsId: number; downloadedAt: string; src: string; width: number; height: number; duration: number; bytes: number }
export interface VisualSearch { videos: PexelsVideo[]; page: number; hasNext: boolean; totalResults: number }
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/visuals${path}`, options)
  if (!response.ok) {
    let message = `Visual request failed (${response.status}).`
    try { message = (await response.json() as { error?: string }).error || message } catch { /* Server may return a non-JSON failure. */ }
    throw new Error(message)
  }
  return response.json() as Promise<T>
}
export function chooseVideoFile(video: PexelsVideo): VisualFile | undefined {
  const files = video.videoFiles.filter((file) => file.fileType === 'video/mp4')
  // Prefer HD up to 1080p, avoiding expensive 4K downloads for a background.
  return files.sort((a, b) => Number(b.width <= 1920 && b.height <= 1920) - Number(a.width <= 1920 && a.height <= 1920) || Math.abs(Math.max(a.width, a.height) - 1280) - Math.abs(Math.max(b.width, b.height) - 1280))[0]
}
export const visualLibrary = {
  search(query: string, orientation: string, page = 1, signal?: AbortSignal) {
    const params = new URLSearchParams({ q: query, orientation, page: String(page), per_page: '12' })
    return request<VisualSearch>(`/search?${params}`, { signal })
  },
  getVisual(trackId: string, signal?: AbortSignal) { return request<SavedVisual | null>(`/library/${encodeURIComponent(trackId)}`, { signal }) },
  async hasVisual(trackId: string) { return Boolean(await this.getVisual(trackId)) },
  listVisuals() { return request<SavedVisual[]>('/library') },
  saveVisual(track: Track, video: PexelsVideo, file: VisualFile, signal?: AbortSignal) {
    return request<SavedVisual>(`/library/${encodeURIComponent(track.id)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: track.title, artist: track.artist, pexelsId: video.id, fileId: file.id }), signal })
  },
  removeVisual(trackId: string) { return request<{ removed: boolean }>(`/library/${encodeURIComponent(trackId)}`, { method: 'DELETE' }) },
}
export function resolveTrackVisual(track: Track | null, saved: SavedVisual | null, mode: 'auto' | 'album-art' | 'track-visual', fallback: VisualSource): VisualSource {
  if (mode !== 'album-art' && track && saved?.spotifyTrackId === track.id) return { kind: 'video', src: saved.src }
  if (track?.artwork) return { kind: 'image', src: track.artwork }
  return fallback
}
