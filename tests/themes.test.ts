import { describe, expect, it } from 'vitest'
import { normalizeTheme, themeList, themes } from '../src/data/themes'

function luminance(rgb: string) {
  const values = rgb.split(' ').map((part) => Number(part) / 255)
  const [red, green, blue] = values.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
  return red * 0.2126 + green * 0.7152 + blue * 0.0722
}

describe('interface themes', () => {
  it('restores saved Hello Kitty selections as the renamed Sanrio theme', () => {
    const restored = themes[normalizeTheme('hello-kitty')]
    expect(restored.name).toBe('Sanrio')
    expect(themeList.filter((theme) => theme.name === 'Sanrio')).toHaveLength(1)
  })
  it('keeps panel text readable in every theme', () => {
    for (const theme of themeList) {
      const surface = luminance(theme.colors.surface)
      const text = luminance(theme.colors.text)
      const ratio = (Math.max(surface, text) + 0.05) / (Math.min(surface, text) + 0.05)
      expect(ratio, theme.name).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('restores supported themes and migrates older saved values', () => {
    for (const theme of themeList) expect(normalizeTheme(theme.id)).toBe(theme.id)
    expect(normalizeTheme('noir')).toBe('batman')
    expect(normalizeTheme('dark')).toBe('default')
    expect(normalizeTheme('midnight')).toBe('default')
    expect(normalizeTheme('unknown')).toBe('default')
  })
})
