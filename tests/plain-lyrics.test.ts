import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it } from 'vitest'
import { PlainLyrics } from '../src/components/Lyrics/PlainLyrics'
import { defaultPreferences } from '../src/types/preferences'

it('keeps untimed lyrics readable, exposes all lines without fake synchronization, and resets for a new track', async () => {
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  const container = document.createElement('div'); document.body.append(container)
  const root = createRoot(container)
  const lines = Array.from({ length: 7 }, (_, index) => `Line ${index + 1}`)
  try {
    await act(async () => root.render(createElement(PlainLyrics, { key: 'one', lines, preferences: defaultPreferences })))
    expect(container.textContent).toContain('Synced lyrics unavailable')
    expect(container.querySelectorAll('.lyrics-plain__content p')).toHaveLength(3)
    expect(container.querySelector<HTMLElement>('.lyrics-plain')!.style.getPropertyValue('--lyric-font-family')).not.toBe('')
    expect(container.querySelector<HTMLButtonElement>('[aria-label="Previous lyric page"]')!.disabled).toBe(true)
    const seen = [...container.querySelectorAll('.lyrics-plain__content p')].map(line => line.textContent)
    for (let page = 1; page < 3; page++) {
      await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Next lyric page"]')!.click())
      seen.push(...[...container.querySelectorAll('.lyrics-plain__content p')].map(line => line.textContent))
    }
    expect(seen).toEqual(lines)
    expect(container.querySelector<HTMLButtonElement>('[aria-label="Next lyric page"]')!.disabled).toBe(true)
    await act(async () => root.render(createElement(PlainLyrics, { key: 'two', lines: ['New track'], preferences: defaultPreferences })))
    expect(container.querySelector('.lyrics-plain__content')!.textContent).toBe('New track')
    expect(container.querySelector('.lyrics-plain__pages')!.textContent).toContain('1 / 1')
  } finally { await act(async () => root.unmount()); container.remove() }
})
