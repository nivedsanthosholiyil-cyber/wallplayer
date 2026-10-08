import { useCallback, useEffect, useState } from 'react'
import { AppShell } from './components/Player/AppShell'
import { LyricsDisplay } from './components/Lyrics/LyricsDisplay'
import { PlayerControls } from './components/Controls/PlayerControls'
import { PortableLyricsWindow } from './components/PortableLyrics/PortableLyricsWindow'
import { SettingsPanel } from './components/Settings/SettingsPanel'
import { VideoBackground } from './components/Background/VideoBackground'
import { useLyrics } from './hooks/useLyrics'
import { useLyricsPreferences } from './hooks/useLyricsPreferences'
import { usePlayback } from './hooks/usePlayback'
import { usePlayerControls } from './hooks/usePlayerControls'
import { mockTrack } from './data/mockTrack'
import { MusicBrowser } from './components/MusicBrowser/MusicBrowser'
import { recordRecentlyPlayed } from './services/musicBrowser/recentlyPlayed'
import { useInterfaceSettings } from './hooks/useInterfaceSettings'
import type { VisualSource } from './types/music'
import { ThemeMark } from './components/Settings/ThemeMark'
import { ThemeGlyph } from './components/Settings/ThemeArtwork'
import { useLocalMusic } from './hooks/useLocalMusic'
import { useTrackLyrics } from './hooks/useTrackLyrics'
import { useTrackVisual } from './hooks/useTrackVisual'
import { resolveTrackVisual } from './services/visuals/VisualLibrary'
import { SetVisualPanel } from './components/Visuals/SetVisualPanel'
import { TrackVisualMenu } from './components/Visuals/TrackVisualMenu'
import type { Track } from './types/music'

function App() {
  const player = usePlayback()
  const localMusic = useLocalMusic()
  const lyricsStatus = useTrackLyrics(player.track, player.source === 'spotify')
  const lyricsState = useLyrics(player.track ?? mockTrack, player.currentTime)
  const { preferences, updatePreference } = useLyricsPreferences()
  const interfaceSettings = useInterfaceSettings()
  const { appearance, wallpaper, customWallpaper } = interfaceSettings
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [portableOpen, setPortableOpen] = useState(false)
  const [browserOpen, setBrowserOpen] = useState(false)
  const [visualTrack, setVisualTrack] = useState<Track | null>(null)
  const [visualRevision, setVisualRevision] = useState(0)
  const [visualNotice, setVisualNotice] = useState('')
  const savedVisual = useTrackVisual(player.source === 'spotify' ? player.track?.id ?? null : null, visualRevision)
  const controlsVisible = usePlayerControls(player.togglePlay, settingsOpen, appearance.autoHideControls && appearance.playerVisibility === 'auto')
  const currentVisual = player.source === 'spotify'
    ? resolveTrackVisual(player.track, savedVisual.visual, wallpaper.backgroundMode, mockTrack.visual)
    : player.track?.visual ?? mockTrack.visual
  const visual: VisualSource = (wallpaper.source === 'custom' && customWallpaper) || (wallpaper.source === 'video' && customWallpaper?.kind === 'video')
    ? customWallpaper.kind === 'video' ? { kind: 'video', src: customWallpaper.url } : { kind: 'image', src: customWallpaper.url }
    : wallpaper.source === 'static' ? { kind: 'image', src: '/images/afterglow-night.png' } : currentVisual

  useEffect(() => {
    if (portableOpen && !player.track?.lyrics.length) setPortableOpen(false)
  }, [portableOpen, player.track])

  useEffect(() => {
    if (player.source === 'mock' && player.isPlaying && player.track) recordRecentlyPlayed(player.track.id)
  }, [player.source, player.isPlaying, player.track?.id])

  const closeSettings = useCallback(() => setSettingsOpen(false), [])
  const closeVisual = useCallback(() => setVisualTrack(null), [])
  const openVisual = useCallback((track: Track) => { setSettingsOpen(false); setVisualTrack(track) }, [])
  useEffect(() => {
    if (!visualNotice) return
    const timeout = window.setTimeout(() => setVisualNotice(''), 2800)
    return () => window.clearTimeout(timeout)
  }, [visualNotice])

  const togglePortable = useCallback(() => {
    setPortableOpen((open) => !open)
    setSettingsOpen(false)
  }, [])

  return (
    <AppShell appearance={appearance}>
      <VideoBackground
        visual={visual}
        trackId={player.source === 'spotify' ? player.track?.id : null}
        artwork={player.track?.artwork}
        isPlaying={player.isPlaying}
        isMuted={player.source === 'local' || player.isMuted}
        volume={player.source === 'local' ? 0 : player.volume}
        settings={wallpaper}
        ambient={player.source === 'spotify' && wallpaper.source === 'current'}
        hold={player.source === 'spotify' && wallpaper.source === 'current' && wallpaper.backgroundMode !== 'album-art' && savedVisual.loading}
      />
      {appearance.showLogo && <div className={`app-brand app-brand--${appearance.logoPosition} app-brand--${appearance.logoStyle}`} style={{ fontSize: appearance.logoSize, opacity: appearance.logoOpacity / 100 }} aria-label="MusicWall"><ThemeMark theme={appearance.theme} />{appearance.logoStyle !== 'symbol' && <span>{appearance.logoStyle === 'monogram' ? 'MW' : 'MusicWall'}</span>}</div>}
      <button className="settings-trigger" onClick={() => setSettingsOpen(true)} aria-label="Open settings" title="Settings"><ThemeGlyph theme={appearance.theme} name="settings" size={18} /></button>
      <main className={`app-main app-main--${preferences.position}`}>
        {player.source === 'spotify' && player.track && <div className="spotify-track-meta">
          {player.track.artwork && <img src={player.track.artwork} alt={`${player.track.album || player.track.title} artwork`} />}
          <div><span>{player.track.title}</span><small>{player.track.artist}</small></div>
          <TrackVisualMenu track={player.track} onSetVisual={openVisual} />
        </div>}
        {!portableOpen && (player.track?.lyrics.length
          ? <LyricsDisplay track={player.track} lyricsState={lyricsState} preferences={preferences} />
          : player.track?.plainLyrics?.length
            ? <div className="lyrics-plain" aria-label="Unsynchronized lyrics">{player.track.plainLyrics.map((line, index) => <p key={index}>{line}</p>)}</div>
            : <p className="lyric-status" role="status">{player.status === 'ready' ? lyricsStatus === 'loading' && player.source === 'spotify' ? 'Loading lyrics…' : 'LYRICS UNAVAILABLE' : player.message || 'Waiting for Spotify playback'}</p>)}
      </main>
      <PlayerControls
        currentTime={player.currentTime}
        duration={player.track?.duration ?? 0}
        isPlaying={player.isPlaying}
        isMuted={player.isMuted}
        volume={player.volume}
        isVisible={controlsVisible}
        canControl={player.canControl}
        canControlVolume={player.canControlVolume}
        onTogglePlay={player.togglePlay}
        onToggleMute={player.toggleMute}
        onVolumeChange={player.setVolume}
        onPrevious={player.previous}
        onNext={player.next}
        onSeek={player.seek}
        appearance={appearance}
      />
      <MusicBrowser
        open={browserOpen}
        onOpen={() => setBrowserOpen(true)}
        onClose={() => setBrowserOpen(false)}
        onPlayTrack={player.playMockTrack}
        localTracks={localMusic.tracks}
        localLoading={localMusic.loading}
        localError={localMusic.error}
        onAddLocalFiles={localMusic.addFiles}
        onRelinkLocalFile={localMusic.relinkFile}
        onPlayLocalTrack={player.playLocalTrack}
        appearance={appearance}
      />
      {portableOpen && player.track && player.track.lyrics.length > 0 && <PortableLyricsWindow track={player.track} lyricsState={lyricsState} preferences={preferences} />}
      <SettingsPanel
        open={settingsOpen}
        preferences={preferences}
        onChange={updatePreference}
        onClose={closeSettings}
        portableOpen={portableOpen}
        onTogglePortable={togglePortable}
        spotify={player.spotify}
        playbackMessage={player.source === 'spotify' ? player.message : ''}
        appearance={appearance}
        wallpaper={wallpaper}
        onAppearanceChange={interfaceSettings.updateAppearance}
        onWallpaperChange={interfaceSettings.updateWallpaper}
        onWallpaperPreset={interfaceSettings.selectWallpaperPreset}
        currentVisual={currentVisual}
        customWallpaper={customWallpaper}
        wallpaperError={interfaceSettings.wallpaperError}
        onUploadWallpaper={interfaceSettings.uploadWallpaper}
        onRemoveWallpaper={interfaceSettings.removeWallpaper}
        spotifyTrack={player.source === 'spotify' ? player.track : null}
        onSetVisual={openVisual}
      />
      {visualTrack && <SetVisualPanel track={visualTrack} settings={wallpaper} onClose={closeVisual} onSaved={(message) => {
        setVisualRevision((value) => value + 1)
        interfaceSettings.updateWallpaper('source', 'current')
        interfaceSettings.updateWallpaper('backgroundMode', 'auto')
        setVisualTrack(null)
        setVisualNotice(message)
      }} />}
      {visualNotice && <p className="visual-notice" role="status">{visualNotice}</p>}
    </AppShell>
  )
}

export default App
