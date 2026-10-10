// Main-process diagnostics: deliberately select fields, never renderer/OAuth data.
const errors = []
function desktopStatus({ event, mode, desiredMode, changingMode, quitting, recovering, host, server, serverReady, error, input }) {
  const time = new Date().toISOString()
  if (error) { errors.push({ time, event, message: String(error).slice(0, 1000) }); if (errors.length > 8) errors.shift() }
  const native = host?.details
  return {
    time, event, mode, desiredMode, changingMode: !!changingMode, quitting: !!quitting, recovering: !!recovering,
    attachment: host?.windowLost ? 'window-lost' : host?.failed ? 'failed' : host?.recovering ? 'recovering' : native?.Verified ? 'verified' : 'inactive',
    native: native ? Object.fromEntries(['Window', 'Parent', 'Kind', 'Child', 'Visible', 'BehindIcons', 'Verified', 'X', 'Y', 'Width', 'Height', 'ExpectedX', 'ExpectedY', 'ExpectedWidth', 'ExpectedHeight'].filter(key => key in native).map(key => [key, native[key]])) : null,
    helper: { pid: host?.child?.pid ?? null, running: !!host?.child && !host.closed, stopping: !!host?.stopping, heartbeat: host?.lastHeartbeat ?? null },
    server: { pid: server?.pid ?? null, ready: !!serverReady },
    input: input ? { active: !!input.active, regionCount: input.regionCount, routedEvents: input.routedEvents, pointerSamples: input.pointerSamples } : null,
    errors: errors.map(entry => ({ ...entry })),
  }
}
module.exports = { desktopStatus }
