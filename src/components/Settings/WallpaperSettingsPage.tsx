import type { VisualSource } from '../../types/music'
import type { WallpaperPreset, WallpaperSettings } from '../../types/interfaceSettings'
import type { CustomWallpaper } from '../../hooks/useInterfaceSettings'
import { RangeSetting, Setting } from './SettingsField'

type Update = <K extends keyof WallpaperSettings>(key: K, value: WallpaperSettings[K]) => void
interface Props {
  settings: WallpaperSettings
  onChange: Update
  onPreset: (preset: WallpaperPreset) => void
  currentVisual: VisualSource
  customWallpaper: CustomWallpaper | null
  error: string
  onUpload: (file: File) => Promise<void>
  onRemove: () => Promise<void>
}

export function WallpaperSettingsPage({ settings, onChange, onPreset, currentVisual, customWallpaper, error, onUpload, onRemove }: Props) {
  const preview = customWallpaper ?? (currentVisual.kind === 'image' ? { url: currentVisual.src, kind: 'image' as const, name: 'Current wallpaper' } : { url: currentVisual.src, kind: 'video' as const, name: 'Current video' })
  return <>
    <section className="settings-section"><h3>Background Source</h3>
      <Setting label="Source"><select value={settings.source} onChange={(event) => onChange('source', event.target.value as WallpaperSettings['source'])}><option value="current">Current track visual</option><option value="static">Static image</option><option value="video" disabled={customWallpaper?.kind !== 'video'}>Uploaded video</option><option value="custom" disabled={!customWallpaper}>Custom upload</option></select></Setting>
      {!customWallpaper && <p className="settings-note">Upload a file below to enable custom image or video wallpaper.</p>}
    </section>
    <section className="settings-section"><h3>Wallpaper Presets</h3>
      <Setting label="Visual preset"><select value={settings.preset} onChange={(event) => onPreset(event.target.value as WallpaperPreset)}><option value="cinematic">Cinematic</option><option value="midnight">Midnight</option><option value="noir">Noir</option><option value="dream">Dream</option><option value="neon">Neon</option><option value="minimal">Minimal</option></select></Setting>
    </section>
    <section className="settings-section"><h3>Visual Adjustments</h3>
      <RangeSetting label="Brightness" value={settings.brightness} unit="%" min={50} max={150} onChange={(value) => onChange('brightness', value)} />
      <RangeSetting label="Contrast" value={settings.contrast} unit="%" min={50} max={160} onChange={(value) => onChange('contrast', value)} />
      <RangeSetting label="Saturation" value={settings.saturation} unit="%" min={0} max={180} onChange={(value) => onChange('saturation', value)} />
      <RangeSetting label="Blur" value={settings.blur} unit="px" min={0} max={16} onChange={(value) => onChange('blur', value)} />
      <RangeSetting label="Vignette" value={settings.vignette} unit="%" min={0} max={100} onChange={(value) => onChange('vignette', value)} />
      <RangeSetting label="Overlay opacity" value={settings.overlayOpacity} unit="%" min={0} max={140} onChange={(value) => onChange('overlayOpacity', value)} />
      <RangeSetting label="Color temperature" value={settings.colorTemperature} min={-100} max={100} step={5} onChange={(value) => onChange('colorTemperature', value)} />
      <RangeSetting label="Background opacity" value={settings.backgroundOpacity} unit="%" min={30} max={100} onChange={(value) => onChange('backgroundOpacity', value)} />
    </section>
    <section className="settings-section"><h3>Motion</h3>
      <RangeSetting label="Motion intensity" value={settings.motionIntensity} unit="%" min={0} max={100} step={5} onChange={(value) => onChange('motionIntensity', value)} />
      <RangeSetting label="Video playback speed" value={settings.videoSpeed} unit="×" min={0.5} max={2} step={0.05} onChange={(value) => onChange('videoSpeed', value)} />
      <label className="settings-toggle"><span>Loop video</span><input type="checkbox" checked={settings.loopVideo} onChange={(event) => onChange('loopVideo', event.target.checked)} /></label>
      <label className="settings-toggle"><span>Pause background when inactive</span><input type="checkbox" checked={settings.pauseWhenInactive} onChange={(event) => onChange('pauseWhenInactive', event.target.checked)} /></label>
    </section>
    <section className="settings-section"><h3>Position</h3>
      <Setting label="Image fit"><select value={settings.position} onChange={(event) => onChange('position', event.target.value as WallpaperSettings['position'])}><option value="cover">Cover</option><option value="fill">Fill</option><option value="center">Center</option><option value="custom">Custom position</option></select></Setting>
      {settings.position === 'custom' && <><RangeSetting label="Horizontal" value={settings.customX} unit="%" min={0} max={100} onChange={(value) => onChange('customX', value)} /><RangeSetting label="Vertical" value={settings.customY} unit="%" min={0} max={100} onChange={(value) => onChange('customY', value)} /></>}
    </section>
    <section className="settings-section"><h3>Custom Wallpaper</h3>
      <div className="settings-wallpaper-preview" aria-label="Wallpaper preview">{preview.kind === 'video' ? <video src={preview.url} muted autoPlay loop playsInline /> : <img src={preview.url} alt="Wallpaper preview" />}</div>
      <p className="settings-note">{preview.name}</p>
      <label className="settings-upload">Upload image or video<input type="file" accept="image/*,video/*" onChange={(event) => { const file = event.target.files?.[0]; if (file) void onUpload(file); event.target.value = '' }} /></label>
      {customWallpaper && <div className="settings-wallpaper-actions"><button onClick={() => onChange('source', 'custom')}>Apply custom wallpaper</button><button onClick={() => { void onRemove() }}>Remove</button></div>}
      {error && <p className="settings-note" role="alert">{error}</p>}
    </section>
  </>
}
