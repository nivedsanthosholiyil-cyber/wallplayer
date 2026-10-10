// @vitest-environment node
import { EventEmitter } from 'node:events'
import { createRequire } from 'node:module'
import { expect, it, vi } from 'vitest'
const { WallpaperInput } = createRequire(import.meta.url)('../desktop/wallpaper-input.cjs')
it('reactivates a reloaded renderer with a fresh cursor sample without duplicating polling', () => {
  vi.useFakeTimers()
  const f = fixture({ getCursorScreenPoint: () => ({ x: 100, y: 200 }) })
  try {
    f.bridge.setActive(true)
    f.target.webContents.send.mockClear()
    f.target.webContents.emit('did-finish-load')
    expect(f.target.webContents.send).toHaveBeenCalledWith('musicwall:wallpaper-input', true)
    expect(f.target.webContents.send).toHaveBeenCalledWith('musicwall:wallpaper-pointer', { x: 100, y: 200, inside: true })
    expect(vi.getTimerCount()).toBe(1)
    f.bridge.setActive(false)
    f.target.webContents.send.mockClear()
    f.target.webContents.emit('did-finish-load')
    expect(f.target.webContents.send).toHaveBeenCalledWith('musicwall:wallpaper-input', false)
    expect(vi.getTimerCount()).toBe(0)
    f.bridge.destroy()
    expect(f.target.webContents.listenerCount('did-finish-load')).toBe(0)
  } finally { f.bridge.destroy(); vi.useRealTimers() }
})
function fixture(screen, bounds = { x:0,y:0,width:1920,height:1080 }) {
  const ipcMain = new EventEmitter()
  const contents=() => Object.assign(new EventEmitter(), { mainFrame:{url:'http://127.0.0.1:4173/'}, focus:vi.fn(), sendInputEvent:vi.fn(), send:vi.fn(), setWindowOpenHandler:vi.fn() })
  const target={webContents:contents(), getContentBounds:()=>bounds, isDestroyed:()=>false}
  let options
  class Surface {
    constructor(value){ options=value; this.webContents=contents() }
    setMenu(){} loadFile(){return Promise.resolve()} getNativeWindowHandle(){return Buffer.from([2,0,0,0,0,0,0,0])}
    hide=vi.fn(); showInactive=vi.fn(); focus=vi.fn(); setBounds=vi.fn(); setShape=vi.fn(); destroy=vi.fn(); isDestroyed(){return false} isVisible(){return false}
  }
  const bridge=new WallpaperInput({target,BrowserWindow:Surface,ipcMain,isAppUrl:url=>url==='http://127.0.0.1:4173/',screen})
  const event=w=>({sender:w.webContents,senderFrame:w.webContents.mainFrame})
  const regions=[{x:900,y:800,width:60,height:50}]
  ipcMain.emit('musicwall:control-regions',event(target),regions)
  return {bridge,target,ipcMain,event,options,regions}
}
it('normalizes negative desktop origins and resends a stationary cursor when wallpaper bounds change', () => {
  const bounds = { x: -1920, y: -200, width: 3840, height: 1280 }
  const f = fixture({ getCursorScreenPoint: () => ({ x: -1200, y: 300 }) }, bounds)
  try {
    f.bridge.setActive(true)
    expect(f.target.webContents.send).toHaveBeenLastCalledWith('musicwall:wallpaper-pointer', { x: 720, y: 500, inside: true })
    f.target.webContents.send.mockClear()
    bounds.width = 1920
    f.bridge.pollPointer()
    expect(f.target.webContents.send).toHaveBeenCalledWith('musicwall:wallpaper-pointer', { x: 720, y: 500, inside: true })
    expect(f.target.webContents.focus).not.toHaveBeenCalled()
    expect(f.target.webContents.sendInputEvent).not.toHaveBeenCalled()
  } finally { f.bridge.destroy() }
})
it('creates an isolated sandboxed surface and clips it to controls without a full desktop hit area',()=>{
  const f=fixture(); f.bridge.setActive(true)
  expect(f.options).toMatchObject({transparent:true,frame:false,show:false,skipTaskbar:true,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false,webSecurity:true}})
  expect(f.bridge.surface.setShape).toHaveBeenLastCalledWith(f.regions)
  expect(f.bridge.surface.showInactive).toHaveBeenCalledOnce()
  f.bridge.destroy()
})
it('reports passive cursor movement without routing clicks, changing hit areas or focusing, and stops on mode exit',()=>{
  vi.useFakeTimers()
  let point={x:100,y:200}
  const screen={getCursorScreenPoint:vi.fn(()=>point)}, f=fixture(screen)
  try {
    f.bridge.setActive(true)
    expect(f.target.webContents.send).toHaveBeenLastCalledWith('musicwall:wallpaper-pointer',{x:100,y:200,inside:true})
    point={x:20,y:50}; vi.advanceTimersByTime(50)
    expect(f.target.webContents.send).toHaveBeenLastCalledWith('musicwall:wallpaper-pointer',{x:20,y:50,inside:true})
    expect(f.target.webContents.focus).not.toHaveBeenCalled()
    expect(f.target.webContents.sendInputEvent).not.toHaveBeenCalled()
    expect(f.bridge.surface.setShape).toHaveBeenLastCalledWith(f.regions)
    point={x:-20,y:1100};vi.advanceTimersByTime(50)
    expect(f.target.webContents.send).toHaveBeenLastCalledWith('musicwall:wallpaper-pointer',{x:-20,y:1100,inside:false})
    f.bridge.setActive(false)
    const count=screen.getCursorScreenPoint.mock.calls.length
    vi.advanceTimersByTime(1000)
    expect(screen.getCursorScreenPoint).toHaveBeenCalledTimes(count)
    f.bridge.setActive(true);f.bridge.destroy()
    expect(vi.getTimerCount()).toBe(0)
  } finally {f.bridge.destroy();vi.useRealTimers()}
})
it('routes real control clicks to the existing player and ignores desktop space and other senders',()=>{
  const f=fixture(); f.bridge.setActive(true)
  const packet={type:'mouseDown',x:910,y:810,button:'left'}
  f.ipcMain.emit('musicwall:control-input',f.event(f.target),packet)
  f.ipcMain.emit('musicwall:control-input',f.event(f.bridge.surface),{...packet,x:10})
  expect(f.target.webContents.sendInputEvent).not.toHaveBeenCalled()
  f.ipcMain.emit('musicwall:control-input',f.event(f.bridge.surface),packet)
  expect(f.target.webContents.sendInputEvent).toHaveBeenCalledWith({...packet,clickCount:1})
  expect(f.bridge.surface.focus).toHaveBeenCalledOnce()
  expect(f.bridge.surface.webContents.focus).toHaveBeenCalledOnce()
  f.bridge.setActive(false)
  f.ipcMain.emit('musicwall:control-input',f.event(f.bridge.surface),packet)
  expect(f.target.webContents.sendInputEvent).toHaveBeenCalledOnce()
  f.bridge.destroy()
})
it('ignores subframe region reports and clamps shape rectangles to the actual viewport',()=>{
  const f=fixture()
  f.ipcMain.emit('musicwall:control-regions',{...f.event(f.target),senderFrame:{url:'http://127.0.0.1:4173/'}},[{x:0,y:0,width:1900,height:1000}])
  expect(f.bridge.rects).toEqual(f.regions)
  f.ipcMain.emit('musicwall:control-regions',f.event(f.target),[{x:1900,y:1000,width:9000,height:9000},{x:NaN,y:0,width:30,height:30}])
  expect(f.bridge.rects).toEqual([{x:1900,y:1000,width:20,height:80}])
  f.bridge.destroy()
})
it('supports slider drags outside their original hit region and removes listeners on cleanup',()=>{
  const f=fixture();f.bridge.setActive(true)
  for(const packet of [{type:'mouseDown',x:910,y:810,button:'left'},{type:'mouseMove',x:1000,y:810,button:'left'},{type:'mouseUp',x:1000,y:810,button:'left'}])
    f.ipcMain.emit('musicwall:control-input',f.event(f.bridge.surface),packet)
  expect(f.target.webContents.sendInputEvent).toHaveBeenCalledTimes(3)
  expect(f.target.webContents.sendInputEvent).toHaveBeenNthCalledWith(2,expect.objectContaining({modifiers:['leftButtonDown']}))
  expect(f.bridge.dragging).toBe(false)
  f.bridge.destroy()
  expect(f.ipcMain.listenerCount('musicwall:control-input')).toBe(0)
  expect(f.ipcMain.listenerCount('musicwall:control-regions')).toBe(0)
  expect(f.bridge.surface.destroy).toHaveBeenCalledOnce()
})
it('releases captured drags outside the viewport so later desktop moves are not routed',()=>{
  const f=fixture();f.bridge.setActive(true)
  const send=packet=>f.ipcMain.emit('musicwall:control-input',f.event(f.bridge.surface),packet)
  send({type:'mouseDown',x:910,y:810,button:'left'})
  send({type:'mouseUp',x:2000,y:1200,button:'left'})
  expect(f.bridge.dragging).toBe(false)
  expect(f.target.webContents.sendInputEvent).toHaveBeenLastCalledWith(expect.objectContaining({type:'mouseUp',x:1919,y:1079}))
  send({type:'mouseMove',x:10,y:10,button:'left'})
  expect(f.bridge.status.routedEvents).toBe(2)
  f.bridge.destroy()
})
it('routes panel scrolling and native keyboard input without accepting renderer key packets',()=>{
  const f=fixture();f.bridge.setActive(true)
  const send=packet=>f.ipcMain.emit('musicwall:control-input',f.event(f.bridge.surface),packet)
  send({type:'keyDown',x:910,y:810,key:'x'})
  expect(f.target.webContents.sendInputEvent).not.toHaveBeenCalled()
  send({type:'mouseWheel',x:910,y:810,deltaX:0,deltaY:-4000})
  expect(f.target.webContents.sendInputEvent).toHaveBeenLastCalledWith(expect.objectContaining({type:'mouseWheel',deltaY:-1000}))
  const event={preventDefault:vi.fn()}
  f.bridge.surface.webContents.emit('before-input-event',event,{type:'keyDown',key:'x'})
  expect(event.preventDefault).toHaveBeenCalledOnce()
  expect(f.target.webContents.sendInputEvent).toHaveBeenLastCalledWith({type:'char',keyCode:'x',modifiers:[]})
  expect(f.bridge.surface.webContents.focus).toHaveBeenCalledTimes(2)
  expect(f.bridge.status.routedKeys).toBe(1)
  f.bridge.destroy()
})

it('retains the native keyboard receiver across successive characters and editing keys without focusing on passive cursor movement',()=>{
  const f=fixture();f.bridge.setActive(true)
  const send=packet=>f.ipcMain.emit('musicwall:control-input',f.event(f.bridge.surface),packet)
  send({type:'mouseDown',x:910,y:810,button:'left'})
  send({type:'mouseUp',x:910,y:810,button:'left'})
  const event={preventDefault:vi.fn()}
  for(const key of ['r','a','Backspace','d','Enter'])
    f.bridge.surface.webContents.emit('before-input-event',event,{type:'keyDown',key})
  const sent=f.target.webContents.sendInputEvent.mock.calls.map(([input])=>input)
  expect(sent.filter(input=>input.type==='char').map(input=>input.keyCode)).toEqual(['r','a','d'])
  expect(sent.filter(input=>input.type==='keyDown').map(input=>input.keyCode)).toEqual(['r','a','Backspace','d','Enter'])
  expect(f.bridge.status.routedKeys).toBe(5)
  expect(f.bridge.surface.focus).toHaveBeenCalledOnce()
  expect(f.bridge.surface.webContents.focus).toHaveBeenCalledTimes(7)
  f.bridge.setActive(false)
  f.bridge.surface.webContents.emit('before-input-event',event,{type:'keyDown',key:'q'})
  expect(f.bridge.status.routedKeys).toBe(5)
  f.bridge.destroy()
})
