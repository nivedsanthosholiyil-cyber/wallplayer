/// <reference types="vite/client" />

interface Window {
  musicwallSpotifySession?: {
    read(): Promise<unknown>
    write(record: unknown): Promise<void>
    clear(): Promise<void>
  }
}
