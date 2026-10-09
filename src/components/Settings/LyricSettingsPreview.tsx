import { motion } from 'framer-motion'
import { lyricStyleVariables, effectiveLyricStyle } from '../../data/lyricStyles'
import { useMotionSettings } from '../../hooks/useMotionSettings'
import type { LyricPreferences, LyricStyle } from '../../types/preferences'

/** An isolated sample using the live renderer's typography variables and line styles. */
export function LyricSettingsPreview({ preferences, style }: { preferences: LyricPreferences; style: LyricStyle }) {
  const movement = useMotionSettings()
  const dual = preferences.layout === 'duet'
  const firstStyle = dual ? effectiveLyricStyle(preferences, 'artist-a') : style
  const adjacent = preferences.layout !== 'minimal' && preferences.maxVisibleLines > 1 && !dual
  const moving = movement.enabled && style.animationStyle === 'float'
  return <figure className="settings-preview">
    <figcaption>Live lyrics <span>{dual ? 'Upper left / lower right' : preferences.position}</span></figcaption>
    <div className={`settings-lyric-preview lyrics--preset-${firstStyle.preset}`} data-layout={preferences.layout} data-position={preferences.position} style={lyricStyleVariables(firstStyle, preferences)} aria-label="Lyric style preview">
      <motion.div className="settings-lyric-preview__lines" key={`${preferences.layout}:${style.animationStyle}`} initial={style.animationStyle === 'none' ? false : { opacity: 0, y: moving ? 10 * movement.intensity : 0, filter: movement.enabled ? 'blur(2px)' : 'blur(0px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} transition={{ duration: style.animationStyle === 'none' ? 0 : movement.enabled ? style.animationSpeed : .1 }}>
        {adjacent && preferences.maxVisibleLines === 5 && <p className="lyrics__adjacent">Every light we left behind</p>}
        {adjacent && <p className="lyrics__adjacent">Where the quiet feels like home</p>}
        <p className="lyrics__current">Stay here in the afterglow</p>
        {adjacent && <p className="lyrics__adjacent">And the water turns to gold</p>}
        {adjacent && preferences.maxVisibleLines === 5 && <p className="lyrics__adjacent">Carry us into the blue</p>}
      </motion.div>
      {dual && <div className={`settings-lyric-preview__partner lyrics--preset-${effectiveLyricStyle(preferences, 'artist-b').preset}`} style={lyricStyleVariables(effectiveLyricStyle(preferences, 'artist-b'), preferences)}><p className="lyrics__current">Follow where the water goes</p></div>}
    </div>
  </figure>
}
