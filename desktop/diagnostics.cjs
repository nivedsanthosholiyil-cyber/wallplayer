const { randomUUID } = require('node:crypto')
const { writeFileSync, renameSync, appendFileSync, statSync } = require('node:fs')
const { setTimeout: wait } = require('node:timers/promises')
const pendingWrites = new Map()

function redact(value) {
  return String(value).replace(/(?:https?:|file:|blob:)[^\s"'<>]+/gi, '[url]')
    .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
    .replace(/((?:token|secret|cookie|password|code|state|authorization|verifier|client_id)\s*[=:]\s*)[^\s,;&"']+/gi, '$1[redacted]').slice(0, 1200)
}
function safe(value, depth = 0) {
  if (depth > 5) return '[bounded]'
  if (value instanceof Error) return { name: redact(value.name), message: redact(value.message), stack: redact(value.stack) }
  if (typeof value === 'string') return redact(value)
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'boolean' || value === null) return value
  if (Array.isArray(value)) return value.slice(0, 32).map(v => safe(v, depth + 1))
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).slice(0, 48)
    .filter(([k]) => !/token|secret|cookie|password|oauth|authorization|verifier|url|lyrics|track|account|client.?id/i.test(k))
    .map(([k, v]) => [k, safe(v, depth + 1)]))
  return null
}
function atomicJson(path, value) {
  const contents = JSON.stringify(value, null, 2)
  const replace = () => {
    writeFileSync(path + '.tmp', contents)
    try { renameSync(path + '.tmp', path); return Promise.resolve() }
    catch (error) {
      if (!['EPERM', 'EACCES', 'EBUSY'].includes(error.code)) throw error
      // Windows readers can temporarily hold the destination without delete
      // sharing. Yield so they can close it; never fall back to truncating it.
      return (async () => {
        for (let attempt = 0; attempt < 10; attempt++) {
          await wait(5)
          try { renameSync(path + '.tmp', path); return }
          catch (retry) { if (!['EPERM', 'EACCES', 'EBUSY'].includes(retry.code) || attempt === 9) throw retry }
        }
      })()
    }
  }
  const previous = pendingWrites.get(path)
  const operation = previous ? previous.catch(() => {}).then(replace) : replace()
  pendingWrites.set(path, operation)
  const cleanup = () => { if (pendingWrites.get(path) === operation) pendingWrites.delete(path) }
  operation.then(cleanup, cleanup)
  return operation
}
class Diagnostics {
  constructor({ enabled = false, capacity = 240, now = Date.now, sessionId = randomUUID() } = {}) {
    Object.assign(this, { enabled, capacity, now, sessionId }); this.events = []; this.last = new Map()
  }
  record(subsystem, event, details = {}, interval = 0) {
    if (!this.enabled) return
    const timestamp = this.now(), key = `${subsystem}:${event}`
    if (interval && timestamp - (this.last.get(key) ?? -Infinity) < interval) return
    this.last.set(key, timestamp)
    this.events.push({ timestamp: new Date(timestamp).toISOString(), sessionId: this.sessionId, subsystem, event, details: safe(details) })
    if (this.events.length > this.capacity) this.events.splice(0, this.events.length - this.capacity)
  }
  snapshot() { return { sessionId: this.sessionId, events: this.events.slice() } }
  export(path) { return this.enabled ? atomicJson(path, this.snapshot()) : Promise.resolve() }
}
function boundedLog(path, message, maxBytes = 1024 * 1024) {
  const line = `${new Date().toISOString()} ${redact(message)}\n`
  try { if (statSync(path).size + Buffer.byteLength(line) > maxBytes) renameSync(path, path + '.previous') }
  catch (error) { if (error.code !== 'ENOENT') throw error }
  appendFileSync(path, line)
}
module.exports = { Diagnostics, atomicJson, boundedLog }
