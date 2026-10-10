// @vitest-environment node
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { EventEmitter } from 'node:events'
import { JSDOM } from 'jsdom'
import { expect, it, vi } from 'vitest'

it('reports panel hit areas but leaves modal backdrops and desktop space to Explorer', () => {
  const dom = new JSDOM(`<button class="settings-layer__scrim"></button><button class="music-browser__scrim"></button><button class="visual-panel-scrim"></button><aside class="settings-panel"><input /></aside><button id="play" title="Play" aria-label="Play"></button><button id="hidden" style="display:none"></button>`)
  const { window } = dom, ipc = Object.assign(new EventEmitter(), { send: vi.fn() })
  for (const element of window.document.querySelectorAll('button,input,aside'))
    element.getBoundingClientRect = () => ({ x: 0, y: 0, width: 1920, height: 1080 })
  window.document.querySelector('.settings-panel').getBoundingClientRect = () => ({x:1400,y:0,width:400,height:1080})
  window.document.querySelector('#play').getBoundingClientRect = () => ({x:900,y:800,width:60,height:50})
  const setInterval = vi.fn(() => 1), clearInterval = vi.fn()
  runInNewContext(readFileSync(new URL('../desktop/wallpaper-preload.cjs', import.meta.url),'utf8'), {
    require: name => { if(name !== 'electron') throw new Error('Unexpected require'); return {ipcRenderer:ipc,contextBridge:{exposeInMainWorld:vi.fn()}} },
    window, document:window.document, getComputedStyle:window.getComputedStyle.bind(window), innerWidth:1920, innerHeight:1080, setInterval, clearInterval,
  })
  window.dispatchEvent(new window.Event('DOMContentLoaded'))
  ipc.emit('musicwall:wallpaper-input',{},true)
  expect(ipc.send).toHaveBeenLastCalledWith('musicwall:control-regions',[
    {x:1400,y:0,width:400,height:1080}, {x:900,y:800,width:60,height:50},
  ])
  expect(window.document.documentElement.hasAttribute('data-wallpaper-input')).toBe(true)
  expect(window.document.querySelector('#play').hasAttribute('title')).toBe(false)
  expect(window.document.querySelector('#play').getAttribute('aria-label')).toBe('Play')
  const pointer=vi.fn();window.addEventListener('musicwall:wallpaper-pointer',pointer)
  ipc.emit('musicwall:wallpaper-pointer',{}, {x:300,y:400,inside:true})
  expect(pointer).toHaveBeenCalledOnce()
  expect(pointer.mock.calls[0][0].detail).toEqual({x:300,y:400,inside:true})
  // React can subscribe after this first IPC sample, or re-enable parallax while
  // the mouse is still. It must receive the current sample without mouse movement.
  window.dispatchEvent(new window.Event('musicwall:request-wallpaper-pointer'))
  expect(pointer).toHaveBeenCalledTimes(2)
  ipc.emit('musicwall:wallpaper-input',{},false)
  expect(window.document.querySelector('#play').getAttribute('title')).toBe('Play')
  ipc.emit('musicwall:wallpaper-pointer',{}, {x:300,y:400,inside:true})
  expect(pointer).toHaveBeenCalledTimes(2)
  expect(window.document.documentElement.hasAttribute('data-wallpaper-input')).toBe(false)
  expect(clearInterval).toHaveBeenCalledWith(1)
  dom.window.close()
})

it('clears stuck player selection in wallpaper mode while preserving library/form selection', () => {
  const dom = new JSDOM('<main class="app-main"><span>Song title</span></main><div class="player-controls"><button>Next track</button></div><aside class="music-browser"><p>Library information</p><input value="Search" /></aside>')
  const { window } = dom, ipc = Object.assign(new EventEmitter(), { send: vi.fn() })
  runInNewContext(readFileSync(new URL('../desktop/wallpaper-preload.cjs', import.meta.url), 'utf8'), {
    require: () => ({ ipcRenderer: ipc, contextBridge: { exposeInMainWorld: vi.fn() } }),
    window, document: window.document, getComputedStyle: window.getComputedStyle.bind(window),
    innerWidth: 1920, innerHeight: 1080, setInterval: vi.fn(), clearInterval: vi.fn(),
  })
  window.dispatchEvent(new window.Event('DOMContentLoaded'))
  const selection = window.getSelection()
  function select(selector) {
    const range = window.document.createRange()
    range.selectNodeContents(window.document.querySelector(selector))
    selection.removeAllRanges(); selection.addRange(range)
  }
  select('.app-main span')
  expect(selection.toString()).toBe('Song title')
  ipc.emit('musicwall:wallpaper-input', {}, true)
  expect(selection.isCollapsed).toBe(true)
  select('.player-controls button')
  window.document.dispatchEvent(new window.Event('selectionchange'))
  expect(selection.isCollapsed).toBe(true)
  select('.music-browser p')
  window.document.dispatchEvent(new window.Event('selectionchange'))
  expect(selection.toString()).toBe('Library information')
  const input = window.document.querySelector('input'); input.focus(); input.setSelectionRange(0, 6)
  window.document.dispatchEvent(new window.Event('selectionchange'))
  expect([input.selectionStart, input.selectionEnd]).toEqual([0, 6])
  ipc.emit('musicwall:wallpaper-input', {}, false)
  select('.app-main span'); window.document.dispatchEvent(new window.Event('selectionchange'))
  expect(selection.toString()).toBe('Song title')
  dom.window.close()
})
