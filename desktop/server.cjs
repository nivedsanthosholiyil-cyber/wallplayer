const { resolve } = require('node:path')
const { pathToFileURL } = require('node:url')

async function run() {
  const { readEnvironment, startProductionServer } = await import(pathToFileURL(resolve(__dirname, '../server/production.mjs')))
  const { DESKTOP_PORT, OAuthCallbackBroker } = await import('./policy.mjs')
  const parent = process.parentPort
  if (!parent) throw new Error('Desktop server requires its Electron parent.')
  const broker = new OAuthCallbackBroker()
  const env = await readEnvironment([process.env.MUSICWALL_SERVER_CONFIG])
  const runtime = await startProductionServer({
    root: resolve(__dirname, '../dist-desktop'), port: DESKTOP_PORT, env,
    onCallback(params) {
      const query = broker.accept(params)
      if (!query) return false
      parent.postMessage({ type: 'oauth-callback', query })
      return true
    },
  })
  let stopping = false
  async function stop() {
    if (stopping) return
    stopping = true
    broker.cancel()
    await runtime.close()
    process.exit(0)
  }
  parent.on('message', ({ data }) => {
    if (data?.type === 'shutdown') void stop()
    if (data?.type === 'oauth-begin' && /^[A-Za-z0-9_-]{16,128}$/.test(data.state)) {
      broker.begin(data.state)
      parent.postMessage({ type: 'oauth-ready', state: data.state })
    }
    if (data?.type === 'oauth-cancel') broker.cancel()
  })
  // Parent death must not leave the port occupied.
  const parentPid = process.ppid
  setInterval(() => { try { process.kill(parentPid, 0) } catch { void stop() } }, 2000).unref()
  for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => { void stop() })
  parent.postMessage({ type: 'ready', origin: runtime.origin })
}
run().catch((error) => {
  const message = error.code === 'EADDRINUSE'
    ? 'Port 4173 is already in use. Close the other MusicWall/server instance, then reopen MusicWall.'
    : `MusicWall could not start its local server: ${error.message}`
  process.parentPort?.postMessage({ type: 'startup-error', message })
  process.exitCode = 1
})
