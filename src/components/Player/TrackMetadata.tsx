import { motion } from 'framer-motion'
import type { Track } from '../../types/music'
import { useMotionSettings } from '../../hooks/useMotionSettings'

export function TrackMetadata({ track, children }: { track: Track; children: React.ReactNode }) {
  const movement = useMotionSettings()
  return <motion.div key={track.id} className="spotify-track-meta" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: movement.uiDuration }}>{children}</motion.div>
}
