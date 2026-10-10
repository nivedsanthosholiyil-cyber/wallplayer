const { EventEmitter } = require('node:events')
const { spawn } = require('node:child_process')
const { createInterface } = require('node:readline')
const { copyFileSync, mkdirSync } = require('node:fs')
const { join } = require('node:path')

function verified(message) {
  return ['window', 'wallpaper'].includes(message.mode) && message.details?.Verified === true
}

// Trusted main-process-only protocol. No renderer IPC or arbitrary executable paths.
class WallpaperController extends EventEmitter {
  constructor({ source, runtime, handle, inputHandle, parentPid = process.pid, spawnImpl = spawn, timeoutMs = 20000 }) {
    super()
    Object.assign(this, { source, runtime, handle, inputHandle, parentPid, spawnImpl, timeoutMs })
    this.mode = 'window'; this.pending = new Map(); this.sequence = 0; this.stopping = false
  }
  start(mode = 'wallpaper') {
    if (this.child) throw new Error('Wallpaper helper already started')
    this.initialMode = mode
    mkdirSync(this.runtime, { recursive: true })
    for (const name of ['wallpaper-host.ps1', 'wallpaper-native.cs']) copyFileSync(join(this.source, name), join(this.runtime, name))
    const shell = join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => this.fail(new Error('Windows wallpaper helper did not confirm attachment within 20 seconds.')), this.timeoutMs)
      this.starting = { resolve, reject, timer }
      try {
        this.child = this.spawnImpl(shell, ['-NoLogo', '-NoProfile', '-NonInteractive', '-File', join(this.runtime, 'wallpaper-host.ps1'),
          '-WindowHandle', this.handle, '-ParentPid', String(this.parentPid), '-InitialMode', mode, ...(this.inputHandle ? ['-InputHandle', this.inputHandle] : [])],
        { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] })
      } catch (error) { this.fail(error); return }
      this.stderr = ''
      this.child.stderr.on('data', chunk => { this.stderr = (this.stderr + chunk).slice(-4000) })
      this.child.stdin.on('error', error => { if (!this.stopping) this.fail(error) })
      this.reader = createInterface({ input: this.child.stdout })
      this.reader.on('line', line => {
        if (line.length > 16000) { this.fail(new Error('Wallpaper helper sent an oversized message')); return }
        try { this.receive(JSON.parse(line)) } catch (error) { this.fail(error) }
      })
      this.child.once('error', error => this.fail(error))
      this.child.once('close', code => {
        this.closed = true
        this.reader.close(); clearInterval(this.watchdog)
        if (!this.stopping && !this.windowLost) this.fail(new Error(`Wallpaper helper exited (${code}). ${this.stderr.trim()}`))
        this.emit('closed')
      })
    })
  }
  receive(message) {
    if (this.stopping) return
    if (message.type === 'error') { this.fail(new Error(message.message || 'Wallpaper helper failed')); return }
    if (message.type === 'window-lost') {
      this.windowLost = true; clearInterval(this.watchdog)
      this.emit('window-lost'); return
    }
    if (message.type === 'recovering') {
      this.recovering = true; this.lastHeartbeat = Date.now(); this.emit('recovering'); return
    }
    if (!['ready', 'mode', 'heartbeat'].includes(message.type)) throw new Error('Invalid wallpaper helper response')
    if (!verified(message)) throw new Error('Wallpaper attachment was not verified by Windows')
    if (message.type === 'ready' && message.mode !== this.initialMode) throw new Error('Unexpected initial wallpaper mode')
    if (message.type === 'heartbeat' && message.mode !== this.mode) throw new Error('Unexpected wallpaper heartbeat mode')
    if (message.type === 'mode') {
      const request = this.pending.get(message.id)
      if (!request || request.mode !== message.mode) throw new Error('Unexpected wallpaper mode acknowledgement')
    }
    this.recovering = false
    this.lastHeartbeat = Date.now()
    this.mode = message.mode
    this.details = message.details
    this.emit('status', { mode: this.mode, details: this.details })
    if (message.type === 'ready' && this.starting) {
      clearTimeout(this.starting.timer); this.starting.resolve(message); this.starting = null
      this.watchdog = setInterval(() => {
        if (Date.now() - this.lastHeartbeat > 15000) this.fail(new Error('Windows wallpaper helper stopped responding'))
      }, 1000)
      this.watchdog.unref()
    }
    if (message.type === 'mode') {
      const pending = this.pending.get(message.id)
      if (pending) {
        if (pending.mode !== message.mode) { this.fail(new Error('Unexpected wallpaper mode acknowledgement')); return }
        clearTimeout(pending.timer); this.pending.delete(message.id); pending.resolve(message)
      }
    }
  }
  setMode(mode) {
    if (!['wallpaper', 'window'].includes(mode)) return Promise.reject(new Error('Invalid wallpaper mode'))
    if (this.stopping || this.closed || this.failed || this.starting || !this.child) return Promise.reject(new Error('Wallpaper helper is not ready'))
    const id = ++this.sequence
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => this.fail(new Error('Windows wallpaper mode change timed out')), this.timeoutMs)
      this.pending.set(id, { resolve, reject, timer, mode })
      try { this.child.stdin.write(JSON.stringify({ type: 'mode', id, mode }) + '\n') }
      catch (error) { this.fail(error) }
    })
  }
  fail(error) {
    if (this.failed || this.stopping) return
    this.failed = true
    clearInterval(this.watchdog)
    if (this.starting) { clearTimeout(this.starting.timer); this.starting.reject(error); this.starting = null }
    else this.emit('failure', error)
    for (const pending of this.pending.values()) { clearTimeout(pending.timer); pending.reject(error) }
    this.pending.clear()
  }
  stop(timeoutMs = 5000) {
    if (this.stopPromise) return this.stopPromise
    this.stopping = true; clearInterval(this.watchdog)
    if (this.starting) { clearTimeout(this.starting.timer); this.starting.reject(new Error('Wallpaper helper stopped')); this.starting = null }
    for (const pending of this.pending.values()) { clearTimeout(pending.timer); pending.reject(new Error('Wallpaper helper stopped')) }
    this.pending.clear()
    if (!this.child || this.closed) return Promise.resolve({ exited: true, forced: false })
    this.stopPromise = new Promise(resolve => {
      let forced = false, timer
      const finish = () => { clearTimeout(timer); this.off('closed', finish); resolve({ exited: !!this.closed, forced }) }
      const force = () => {
        forced = true
        // kill() requests termination; wait for close before reporting exit.
        timer = setTimeout(finish, 1000)
        try { this.child.kill() } catch { finish() }
      }
      timer = setTimeout(force, timeoutMs)
      this.once('closed', finish)
      try { this.child.stdin.end(JSON.stringify({ type: 'stop' }) + '\n') } catch { clearTimeout(timer); force() }
    })
    return this.stopPromise
  }
}
module.exports = { WallpaperController, verified }
