// @vitest-environment node
import { expect, it } from 'vitest'
import api from '../desktop/desktop-status.cjs'
it('reports bounded native/process diagnostics without copying arbitrary or authentication fields', () => {
  const input = { mode: 'wallpaper', desiredMode: 'wallpaper', event: 'native-status', serverReady: true,
    host: { details: { Verified: true, Parent: 101, X: -1920, Y: 0, Width: 3840, Height: 1080, token: 'secret' }, child: { pid: 1 }, lastHeartbeat: 100 },
    server: { pid: 2, token: 'secret' }, token: 'secret' }
  input.input = { active:true,regionCount:8,routedEvents:12,key:'secret', coordinates:'secret' }
  expect(api.desktopStatus(input)).toMatchObject({ attachment: 'verified', native: { Parent: 101, X: -1920, Width: 3840 }, helper: { pid: 1, running: true }, server: { pid: 2, ready: true } })
  expect(JSON.stringify(api.desktopStatus(input))).not.toContain('secret')
  expect(api.desktopStatus(input).input).toEqual({active:true,regionCount:8,routedEvents:12})
  input.host.recovering = true; expect(api.desktopStatus(input).attachment).toBe('recovering')
  input.host.windowLost = true; expect(api.desktopStatus(input).attachment).toBe('window-lost')
  for (let i = 0; i < 12; i++) api.desktopStatus({ ...input, error: `error ${i}` })
  const status = api.desktopStatus(input)
  expect(status.errors).toHaveLength(8); expect(status.errors.at(-1).message).toBe('error 11')
})
