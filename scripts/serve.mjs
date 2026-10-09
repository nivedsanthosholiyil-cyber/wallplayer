import { resolve } from 'node:path'
import { projectRoot, readEnvironment, startProductionServer } from '../server/production.mjs'

try {
  const env = await readEnvironment(['.env', '.env.local', '.env.production', '.env.production.local'].map((name) => resolve(projectRoot, name)))
  const runtime = await startProductionServer({ port: Number(env.PORT || 4173), env })
  console.log(`MusicWall: ${runtime.origin}`)
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { void runtime.close().then(() => process.exit(0)) })
} catch (error) {
  console.error(`MusicWall server could not start: ${error.code === 'EADDRINUSE' ? 'The requested loopback port is already in use.' : error.message}`)
  process.exitCode = 1
}
