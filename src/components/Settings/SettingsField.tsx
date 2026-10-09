import { Children, cloneElement, isValidElement, type CSSProperties, type ReactNode } from 'react'

export function Setting({ label, value = '', children }: { label: string; value?: string; children: ReactNode }) {
  const controls = Children.map(children, (child) => {
    if (!isValidElement<{ type?: string; value?: string | number; min?: string | number; max?: string | number; style?: CSSProperties; 'aria-label'?: string }>(child) || (child.type !== 'input' && child.type !== 'select')) return child
    const props = child.props
    const min = Number(props.min ?? 0), max = Number(props.max ?? 100)
    const fill = max > min ? Math.max(0, Math.min(100, (Number(props.value) - min) / (max - min) * 100)) : 0
    return cloneElement(child, { 'aria-label': props['aria-label'] ?? label, ...(props.type === 'range' ? { style: { ...props.style, '--setting-progress': `${fill}%` } as CSSProperties } : {}) })
  })
  return <label className="settings-field"><span className="settings-field__heading"><span>{label}</span><span aria-hidden="true">{value}</span></span>{controls}</label>
}

export function RangeSetting({ label, value, unit = '', min, max, step = 1, onChange }: { label: string; value: number; unit?: string; min: number; max: number; step?: number; onChange: (value: number) => void }) {
  return <Setting label={label} value={`${Number.isInteger(value) ? value : value.toFixed(2)}${unit}`}><input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} /></Setting>
}
