import type { AppearanceSettings } from '../../types/interfaceSettings'
import { RangeSetting, Setting } from './SettingsField'
import { ThemeGallery } from './ThemeGallery'

type Update = <K extends keyof AppearanceSettings>(key: K, value: AppearanceSettings[K]) => void

export function AppearanceSettingsPage({ settings, onChange }: { settings: AppearanceSettings; onChange: Update }) {
  return <>
    <section className="settings-section"><h3>Theme</h3>
      <ThemeGallery selected={settings.theme} onSelect={(theme) => onChange('theme', theme)} />
      <RangeSetting label="UI opacity" value={settings.uiOpacity} unit="%" min={55} max={100} onChange={(value) => onChange('uiOpacity', value)} />
      <RangeSetting label="Glass intensity" value={settings.glassIntensity} unit="%" min={0} max={100} onChange={(value) => onChange('glassIntensity', value)} />
      <RangeSetting label="Blur intensity" value={settings.blurIntensity} unit="px" min={0} max={45} onChange={(value) => onChange('blurIntensity', value)} />
      <RangeSetting label="Accent intensity" value={settings.accentIntensity} unit="%" min={0} max={100} onChange={(value) => onChange('accentIntensity', value)} />
    </section>
    <section className="settings-section"><h3>Player</h3>
      <Setting label="Player visibility"><select value={settings.playerVisibility} onChange={(event) => onChange('playerVisibility', event.target.value as AppearanceSettings['playerVisibility'])}><option value="auto">Auto</option><option value="always">Always visible</option><option value="hidden">Hidden</option></select></Setting>
      <RangeSetting label="Control size" value={settings.controlSize} unit="%" min={70} max={140} step={5} onChange={(value) => onChange('controlSize', value)} />
      <RangeSetting label="Resting control opacity" value={settings.controlOpacity} unit="%" min={10} max={100} step={5} onChange={(value) => onChange('controlOpacity', value)} />
      <Setting label="Progress bar style"><select value={settings.progressStyle} onChange={(event) => onChange('progressStyle', event.target.value as AppearanceSettings['progressStyle'])}><option value="line">Line</option><option value="soft">Soft</option><option value="glow">Glow</option></select></Setting>
      <RangeSetting label="Progress thickness" value={settings.progressThickness} unit="px" min={1} max={6} onChange={(value) => onChange('progressThickness', value)} />
      <RangeSetting label="Player animation intensity" value={settings.playerAnimationIntensity} unit="%" min={0} max={100} step={5} onChange={(value) => onChange('playerAnimationIntensity', value)} />
      <label className="settings-toggle"><span>Auto-hide controls</span><input type="checkbox" checked={settings.autoHideControls} onChange={(event) => onChange('autoHideControls', event.target.checked)} /></label>
      <Setting label="Player position"><select value={settings.playerPosition} onChange={(event) => onChange('playerPosition', event.target.value as AppearanceSettings['playerPosition'])}><option value="edge">Near edge</option><option value="low">Low</option><option value="raised">Raised</option></select></Setting>
    </section>
    <section className="settings-section"><h3>UI Style</h3>
      <RangeSetting label="Corner radius" value={settings.cornerRadius} unit="px" min={0} max={24} onChange={(value) => onChange('cornerRadius', value)} />
      <Setting label="Control shape"><select value={settings.controlShape} onChange={(event) => onChange('controlShape', event.target.value as AppearanceSettings['controlShape'])}><option value="round">Round</option><option value="soft">Soft</option><option value="square">Square</option></select></Setting>
      <RangeSetting label="Icon size" value={settings.iconSize} unit="%" min={70} max={140} step={5} onChange={(value) => onChange('iconSize', value)} />
      <RangeSetting label="Animation speed" value={settings.animationSpeed} unit="%" min={50} max={160} step={5} onChange={(value) => onChange('animationSpeed', value)} />
      <Setting label="UI transition style"><select value={settings.transitionStyle} onChange={(event) => onChange('transitionStyle', event.target.value as AppearanceSettings['transitionStyle'])}><option value="smooth">Smooth</option><option value="dissolve">Dissolve</option><option value="instant">Instant</option></select></Setting>
    </section>
    <section className="settings-section"><h3>Logo / Branding</h3>
      <label className="settings-toggle"><span>Show logo</span><input type="checkbox" checked={settings.showLogo} onChange={(event) => onChange('showLogo', event.target.checked)} /></label>
      <RangeSetting label="Logo size" value={settings.logoSize} unit="px" min={12} max={36} onChange={(value) => onChange('logoSize', value)} />
      <RangeSetting label="Logo opacity" value={settings.logoOpacity} unit="%" min={10} max={100} step={5} onChange={(value) => onChange('logoOpacity', value)} />
      <Setting label="Logo position"><select value={settings.logoPosition} onChange={(event) => onChange('logoPosition', event.target.value as AppearanceSettings['logoPosition'])}><option value="top-left">Top left</option><option value="top-center">Top center</option><option value="bottom-left">Bottom left</option></select></Setting>
      <Setting label="Logo style"><select value={settings.logoStyle} onChange={(event) => onChange('logoStyle', event.target.value as AppearanceSettings['logoStyle'])}><option value="wordmark">Wordmark</option><option value="monogram">Monogram</option><option value="symbol">Symbol</option></select></Setting>
    </section>
  </>
}
