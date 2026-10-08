import type { ReactNode } from 'react'

export function Setting({ label, value = '', children }: { label: string; value?: string; children: ReactNode }) {
  return <label className="settings-field"><span className="settings-field__heading"><span>{label}</span><span>{value}</span></span>{children}</label>
}

export function RangeSetting({ label, value, unit = '', min, max, step = 1, onChange }: { label: string; value: number; unit?: string; min: number; max: number; step?: number; onChange: (value: number) => void }) {
  return <Setting label={label} value={`${Number.isInteger(value) ? value : value.toFixed(2)}${unit}`}><input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} /></Setting>
}
