// UtilityProcess adapter kept independent of Electron for lifecycle regression tests.
function waitForReady(child, origin, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const finish = (error) => {
      clearTimeout(timer)
      child.off('message', message)
      child.off('exit', exit)
      error ? reject(error) : resolve()
    }
    const message = (data) => {
      if (data?.type === 'startup-error') finish(new Error(data.message))
      if (data?.type === 'ready') finish(data.origin === origin ? null : new Error('Unexpected local server origin'))
    }
    const exit = () => finish(new Error('The local server exited before it was ready.'))
    const timer = setTimeout(() => finish(new Error('The local server did not start within 15 seconds.')), timeoutMs)
    child.on('message', message)
    child.once('exit', exit)
  })
}
const shutdowns = new WeakMap()
function stopServer(child, timeoutMs = 3500) {
  if (!child?.pid) return Promise.resolve({ exited: true, forced: false })
  if (shutdowns.has(child)) return shutdowns.get(child)
  const result = new Promise((resolve) => {
    let forced = false, exited = false, timer
    const finish = () => { clearTimeout(timer); child.off('exit', onExit); resolve({ exited, forced }) }
    const onExit = () => { exited = true; finish() }
    const force = () => {
      forced = true
      // A successful kill() is a request, not proof the process/port has gone away.
      timer = setTimeout(finish, 1000)
      try { child.kill() } catch { finish() }
    }
    child.once('exit', onExit)
    timer = setTimeout(force, timeoutMs)
    try { child.postMessage({ type: 'shutdown' }) } catch { clearTimeout(timer); force() }
  })
  shutdowns.set(child, result)
  return result
}
module.exports = { waitForReady, stopServer }
