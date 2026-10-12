import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
const animations = vi.hoisted(() => ({ controls: [] as Array<{ pause:ReturnType<typeof vi.fn>; play:ReturnType<typeof vi.fn>; stop:ReturnType<typeof vi.fn>; finish:() => void; target:Record<string,unknown>; duration:number }> }))
vi.mock('framer-motion', async (original) => ({ ...await original<typeof import('framer-motion')>(), animate: (_:Element,target:Record<string,unknown>,options:{duration:number}) => {
  const control = {pause:vi.fn(),play:vi.fn(),stop:vi.fn(),finish:() => {},target,duration:options.duration,then:(resolve:() => void) => { control.finish = resolve; return Promise.resolve() }}
  animations.controls.push(control); return control
} }))
import { DualSplitLyrics, dualPositionForIndex } from '../src/components/Lyrics/DualSplitLyrics'
import { lyricWindow } from '../src/hooks/useLyrics'
import { mockTrack } from '../src/data/mockTrack'
import { defaultPreferences } from '../src/types/preferences'
import { defaultAppearance } from '../src/types/interfaceSettings'
import { AppShell } from '../src/components/Player/AppShell'

it('enters synchronized lines immediately, settles on pause, skips seeked lines, and resets on track changes', async () => {
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT:boolean }).IS_REACT_ACT_ENVIRONMENT = true
  animations.controls.length = 0
  const lines = Array.from({length:6},(_,index)=>({id:`line-${index}`,start:index*5,end:(index+1)*5,text:`Lyric ${index+1}`,singer:'artist-a' as const}))
  const container = document.createElement('div'); document.body.append(container); const root = createRoot(container)
  const render = async (time:number, playing=true, trackId='one', enabled=true) => act(async () => root.render(createElement(AppShell,{appearance:{...defaultAppearance,motionEnabled:enabled}},createElement(DualSplitLyrics,{track:{...mockTrack,id:trackId,lyrics:lines},lyricsState:{main:lyricWindow(lines,time),streams:[]},preferences:{...defaultPreferences,style:{...defaultPreferences.style,fontWeight:700}},currentTime:time,isPlaying:playing}))))
  const line = () => container.querySelector<HTMLElement>('.lyrics__dual-line')!
  try {
    await render(4.8)
    expect(line().dataset.dualPosition).toBe('top-left')
    expect(line().style.getPropertyValue('--lyric-weight')).toBe('700')
    const started = animations.controls.length
    await render(4.9)
    expect(animations.controls).toHaveLength(started)
    await render(5.1)
    // The synchronized line enters immediately; only the previous line is exiting.
    expect(container.querySelectorAll('.lyrics__dual-line[data-active="true"]')).toHaveLength(1)
    expect(container.querySelector('.lyrics__dual-line[data-active="true"]')?.textContent).toBe('Lyric 2')
    const exiting = animations.controls.findLast(control => control.target.opacity === 0)!
    await render(5.1,false)
    expect(exiting.stop).toHaveBeenCalled()
    expect(container.querySelectorAll('.lyrics__current')).toHaveLength(1)
    expect(line().dataset.dualPosition).toBe('bottom-right')
    expect(line().style.opacity).toBe('1')
    await render(5.1,true)
    expect(line().style.opacity).toBe('1')
    await act(async () => exiting.finish())
    expect(line().dataset.dualPosition).toBe('bottom-right')
    await render(10.1)
    await act(async () => animations.controls.findLast(control => control.target.opacity === 0)!.finish())
    expect(line().textContent).toBe('Lyric 3')
    expect(line().dataset.dualPosition).toBe('top-left')
    await render(15.1)
    await act(async () => animations.controls.findLast(control => control.target.opacity === 0)!.finish())
    expect(line().textContent).toBe('Lyric 4')
    expect(line().dataset.dualPosition).toBe('bottom-right')
    await render(21,false)
    expect(line().textContent).toBe('Lyric 5')
    expect(line().dataset.dualPosition).toBe('top-left')
    expect(container.querySelectorAll('.lyrics__current')).toHaveLength(1)
    expect(animations.controls.at(-1)?.duration).toBe(0)
    await render(4.2,true,'four')
    await render(5.1,true,'four')
    expect(line().textContent).toBe('Lyric 2')
    expect(animations.controls.at(-1)?.duration).toBe(0)
    await render(26,false)
    expect(line().dataset.dualPosition).toBe('bottom-right')
    await render(.1,false,'two')
    expect(line().textContent).toBe('Lyric 1')
    expect(line().dataset.dualPosition).toBe('top-left')
    await render(11,true,'two',false)
    expect(animations.controls.at(-1)?.target).toMatchObject({y:0,scale:1})
    expect(animations.controls.at(-1)!.duration).toBeLessThanOrEqual(.1)
    await render(4.9,false,'three')
    await render(5.1,false,'three')
    expect(line().textContent).toBe('Lyric 2')
    expect(line().dataset.dualPosition).toBe('bottom-right')
    expect(animations.controls.at(-1)?.duration).toBe(0)
    expect(Array.from({length:6},(_,index)=>dualPositionForIndex(index))).toEqual(['top-left','bottom-right','top-left','bottom-right','top-left','bottom-right'])
  } finally { await act(async () => root.unmount()); container.remove() }
})
