import type { AppearanceSettings } from '../../types/interfaceSettings'
import type { motionTokens } from '../../hooks/useMotionSettings'

export function cinematicNavigation(movement: ReturnType<typeof motionTokens>, appearance?: AppearanceSettings) {
  const moving = movement.enabled && appearance?.transitionStyle !== 'instant'
  const immediate = appearance?.transitionStyle === 'instant'
  const amount = moving ? movement.intensity : 0
  return {
    moving, panel: immediate ? 0 : moving ? .35 + .15 * amount : .1,
    content: immediate ? 0 : moving ? .4 + .2 * amount : .1,
    view: immediate ? 0 : moving ? .3 + .15 * amount : .1,
    libraryTravel: moving ? 20 + 10 * amount : 0,
    settingsTravel: moving ? 12 + 8 * amount : 0, scale: 1 - .015 * amount,
    viewTravel: 16 * amount, stagger: moving ? .06 : 0,
    ease: [.22, 1, .36, 1] as const,
  }
}
