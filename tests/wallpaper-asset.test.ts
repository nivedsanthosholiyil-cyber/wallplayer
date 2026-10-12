import { afterEach, expect, it, vi } from 'vitest'
import { wallpaperAsset } from '../src/services/wallpaperAsset'

afterEach(() => vi.unstubAllGlobals())

function databaseFixture() {
  const request = { result: 'custom', error: null, onsuccess: null as null | (() => void), onerror: null as null | (() => void) }
  const tx = { error: null as null | Error, objectStore: () => ({ put: () => request }), oncomplete: null as null | (() => void), onerror: null as null | (() => void), onabort: null as null | (() => void) }
  const database = { transaction: () => tx, close: vi.fn() }
  const open = { result: database, onsuccess: null as null | (() => void) }
  vi.stubGlobal('indexedDB', { open: () => open })
  return { request, tx, database, open }
}

it('does not report a wallpaper saved when its transaction aborts after the write request succeeds', async () => {
  const fixture = databaseFixture()
  const saved = wallpaperAsset.save(new Blob(['image']))
  const settled = vi.fn()
  void saved.then(settled, settled)
  fixture.open.onsuccess?.()
  await Promise.resolve()
  fixture.request.onsuccess?.()
  await Promise.resolve()
  expect(settled).not.toHaveBeenCalled()
  fixture.tx.error = new Error('Storage transaction interrupted')
  fixture.tx.onabort?.()
  await expect(saved).rejects.toThrow('Storage transaction interrupted')
  expect(fixture.database.close).toHaveBeenCalledOnce()
})

it('reports a saved wallpaper only after its transaction commits', async () => {
  const fixture = databaseFixture()
  const saved = wallpaperAsset.save(new Blob(['image']))
  fixture.open.onsuccess?.()
  await Promise.resolve()
  fixture.request.onsuccess?.()
  fixture.tx.oncomplete?.()
  await expect(saved).resolves.toBe('custom')
  expect(fixture.database.close).toHaveBeenCalledOnce()
})
