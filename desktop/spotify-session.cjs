const { readFile, writeFile, rename, unlink } = require('node:fs/promises')
const { join } = require('node:path')

function validRecord(value) {
  return value && ['clientId', 'accessToken', 'refreshToken', 'scope'].every(key => typeof value[key] === 'string' && value[key].length <= 8192)
    && value.clientId && value.accessToken && value.refreshToken && Number.isFinite(value.expiresAt)
}

class SpotifySession {
  constructor({ directory, safeStorage, ipcMain, getWindow, isAppUrl }) {
    this.file = join(directory, 'spotify-session.bin'); this.safeStorage = safeStorage; this.queue = Promise.resolve()
    this.ipcMain = ipcMain
    for (const action of ['read', 'write', 'clear']) {
      ipcMain.handle(`musicwall:spotify-session:${action}`, (event, value) => {
        const window = getWindow()
        if (!window || window.isDestroyed() || event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame || !isAppUrl(event.senderFrame.url))
          throw new Error('Spotify session access denied.')
        return this.enqueue(() => this[action](value))
      })
    }
  }
  enqueue(task) {
    const result = this.queue.then(task); this.queue = result.catch(() => {}); return result
  }
  async encryptionReady() {
    if (!await this.safeStorage.isAsyncEncryptionAvailable()) throw new Error('Windows credential protection is unavailable. Try connecting again.')
  }
  async read() {
    let encrypted
    try { encrypted = await readFile(this.file) } catch (error) { if (error.code === 'ENOENT') return null; throw new Error('Could not read the saved Spotify connection.') }
    if (encrypted.length > 65536) throw new Error('The saved Spotify connection is invalid. Connect again.')
    await this.encryptionReady()
    let value, decoded
    try { decoded = await this.safeStorage.decryptStringAsync(encrypted); value = JSON.parse(decoded.result) }
    catch { throw new Error('Could not unlock the saved Spotify connection. Connect again.') }
    if (!validRecord(value)) throw new Error('The saved Spotify connection is invalid. Connect again.')
    if (decoded.shouldReEncrypt) await this.write(value)
    return value
  }
  async write(value) {
    if (!validRecord(value)) throw new Error('Invalid Spotify credentials.')
    // Only this fixed credential file is writable; ignore arbitrary extra fields.
    const record = Object.fromEntries(['clientId', 'accessToken', 'refreshToken', 'expiresAt', 'scope'].map(key => [key, value[key]]))
    await this.encryptionReady()
    try {
      const encrypted = await this.safeStorage.encryptStringAsync(JSON.stringify(record))
      await writeFile(this.file + '.tmp', encrypted, { mode: 0o600 })
      await rename(this.file + '.tmp', this.file)
    } catch { throw new Error('Could not securely save the Spotify connection.') }
  }
  async clear() {
    try { await unlink(this.file) } catch (error) { if (error.code !== 'ENOENT') throw new Error('Could not remove the saved Spotify connection.') }
  }
  async close() {
    for (const action of ['read', 'write', 'clear']) this.ipcMain.removeHandler(`musicwall:spotify-session:${action}`)
    await this.queue
  }
}
module.exports = { SpotifySession }
