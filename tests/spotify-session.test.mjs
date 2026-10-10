// @vitest-environment node
import { EventEmitter } from 'node:events'
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createRequire } from 'node:module'
import { afterEach, expect, it, vi } from 'vitest'
const { SpotifySession } = createRequire(import.meta.url)('../desktop/spotify-session.cjs')
const roots=[], stores=[]
const record={clientId:'fixture-client',accessToken:'fixture-access',refreshToken:'fixture-refresh',expiresAt:123456,scope:'user-read-playback-state'}
async function fixture() {
  const directory=await mkdtemp(join(tmpdir(),'musicwall-credential-test-')); roots.push(directory)
  const handlers=new Map(), ipcMain={handle:(name,handler)=>handlers.set(name,handler),removeHandler:name=>handlers.delete(name)}
  const contents=Object.assign(new EventEmitter(),{mainFrame:{url:'http://127.0.0.1:4173/'}}), window={webContents:contents,isDestroyed:()=>false}
  // Unit fixture cipher only; the separate Electron test exercises real Windows DPAPI.
  const safeStorage={isAsyncEncryptionAvailable:vi.fn().mockResolvedValue(true),encryptStringAsync:vi.fn(async text=>Buffer.from(Buffer.from(text).toString('base64'))),decryptStringAsync:vi.fn(async bytes=>({result:Buffer.from(bytes.toString(),'base64').toString(),shouldReEncrypt:false}))}
  const store=new SpotifySession({directory,ipcMain,safeStorage,getWindow:()=>window,isAppUrl:url=>url==='http://127.0.0.1:4173/'})
  stores.push(store)
  const event={sender:contents,senderFrame:contents.mainFrame}
  return {store,directory,handlers,safeStorage,event}
}
afterEach(async()=>{
  for(const store of stores.splice(0)) await store.close()
  for(const root of roots.splice(0)) { if(!root.startsWith(join(tmpdir(),'musicwall-credential-test-'))) throw new Error('Unsafe test cleanup'); await rm(root,{recursive:true,force:true}) }
})
it('persists encrypted credentials, excludes arbitrary fields and removes them on disconnect',async()=>{
  const f=await fixture()
  await expect(f.store.read()).resolves.toBeNull()
  await f.handlers.get('musicwall:spotify-session:write')(f.event,{...record,path:'other-file',password:'not-stored'})
  expect((await readFile(f.store.file)).toString()).not.toContain(record.refreshToken)
  expect(await f.store.read()).toEqual(record)
  await f.handlers.get('musicwall:spotify-session:clear')(f.event)
  expect(await f.store.read()).toBeNull()
})
it('rejects other windows, subframes, remote URLs and unusable credentials',async()=>{
  const f=await fixture(), read=f.handlers.get('musicwall:spotify-session:read')
  expect(()=>read({...f.event,sender:{}})).toThrow('denied')
  expect(()=>read({...f.event,senderFrame:{url:'http://127.0.0.1:4173/'}})).toThrow('denied')
  f.event.senderFrame.url='https://accounts.spotify.com/'
  expect(()=>read(f.event)).toThrow('denied')
  await expect(f.store.write({...record,refreshToken:''})).rejects.toThrow('Invalid')
})
it('fails closed when encryption is unavailable and never writes a plaintext fallback',async()=>{
  const f=await fixture();f.safeStorage.isAsyncEncryptionAvailable.mockResolvedValue(false)
  await expect(f.store.write(record)).rejects.toThrow('protection is unavailable')
  expect(await f.store.read()).toBeNull()
  expect(f.safeStorage.encryptStringAsync).not.toHaveBeenCalled()
})
it('serializes save and disconnect so an in-flight encrypted write cannot restore a cleared connection',async()=>{
  const f=await fixture()
  let release
  f.safeStorage.encryptStringAsync.mockImplementationOnce(text=>new Promise(resolve=>{release=()=>resolve(Buffer.from(Buffer.from(text).toString('base64')))}))
  const saved=f.handlers.get('musicwall:spotify-session:write')(f.event,record)
  await vi.waitFor(()=>expect(release).toBeTypeOf('function'))
  const cleared=f.handlers.get('musicwall:spotify-session:clear')(f.event)
  release();await Promise.all([saved,cleared])
  expect(await f.store.read()).toBeNull()
})
it.runIf(process.platform==='win32')('round-trips the real Electron Windows-protected store across store recreation',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'musicwall-credential-test-'));roots.push(directory)
  const entry=join(directory,'test.cjs'), modulePath=resolve('desktop/spotify-session.cjs')
  await writeFile(entry,`
    const {app,safeStorage}=require('electron');const {readFile}=require('node:fs/promises');
    const {SpotifySession}=require(${JSON.stringify(modulePath)});
    app.setPath('userData',${JSON.stringify(directory)});
    app.whenReady().then(async()=>{
      const options={directory:${JSON.stringify(directory)},safeStorage,ipcMain:{handle(){},removeHandler(){}},getWindow:()=>null,isAppUrl:()=>false};
      const record=${JSON.stringify(record)},first=new SpotifySession(options);
      await first.write(record);await first.close();
      const ciphertext=await readFile(first.file),second=new SpotifySession(options),restored=await second.read();
      await second.clear();await second.close();
      process.stdout.write(JSON.stringify({available:await safeStorage.isAsyncEncryptionAvailable(),matches:JSON.stringify(restored)===JSON.stringify(record),plaintext: ciphertext.includes(Buffer.from(record.refreshToken)),cleared:await second.read()===null}));app.quit();
    }).catch(()=>{process.stderr.write('Windows credential round-trip failed');app.exit(1)});
  `)
  const {stdout}=await promisify(execFile)(resolve('node_modules/electron/dist/electron.exe'),[entry],{windowsHide:true,timeout:20000})
  expect(JSON.parse(stdout.trim())).toEqual({available:true,matches:true,plaintext:false,cleared:true})
},25000)
