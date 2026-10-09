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
function stopServer(child, timeoutMs = 3500) {
  if (!child?.pid) return Promise.resolve()
  return new Promise((resolve) => {
    const timer = setTimeout(() => { child.kill(); finish() }, timeoutMs)
    const finish = () => { clearTimeout(timer); child.off('exit', finish); resolve() }
    child.once('exit', finish)
    try { child.postMessage({ type: 'shutdown' }) } catch { child.kill(); finish() }
  })
}
module.exports = { waitForReady, stopServer }
