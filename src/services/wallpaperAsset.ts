const DB_NAME = 'musicwall-wallpaper'
const STORE = 'assets'
const KEY = 'custom'

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function transaction<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const database = await openDatabase()
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE, mode)
    const request = operation(tx.objectStore(STORE))
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    tx.oncomplete = () => database.close()
    tx.onerror = () => { database.close(); reject(tx.error) }
  })
}

export const wallpaperAsset = {
  get: () => transaction<Blob | undefined>('readonly', (store) => store.get(KEY)),
  save: (blob: Blob) => transaction<IDBValidKey>('readwrite', (store) => store.put(blob, KEY)),
  remove: () => transaction<undefined>('readwrite', (store) => store.delete(KEY)),
}
