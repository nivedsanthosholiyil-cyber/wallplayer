import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve, join, dirname } from 'node:path'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

if (process.platform !== 'win32') throw new Error('The compiled installer hook tests require Windows.')
const root = fileURLToPath(new URL('../', import.meta.url))
const temporaryRoot = resolve(tmpdir())
const directory = await mkdtemp(join(temporaryRoot, 'spontaneous-installer-test-'))
if (dirname(resolve(directory)) !== temporaryRoot) throw new Error('Unexpected test directory; refusing cleanup outside the temporary root.')
const run = promisify(execFile)
const require = createRequire(import.meta.url)
const { getMakeNsisPath } = require('app-builder-lib/out/toolsets/windows.js')
try {
  const compiler = await getMakeNsisPath()
  const registryKey = `Software\\SpontaneousInstallerTests\\${randomUUID()}`
  await run(compiler.path, ['/V2', `/DPROJECT_DIR=${resolve(root)}`, `/DTEST_DIRECTORY=${directory}`, `/DTEST_RUN_KEY=${registryKey}`, join(root, 'build', 'test-startup.nsi')], { env: { ...process.env, ...compiler.env } })
  await run(join(directory, 'startup-test.exe'))
  const results = await readFile(join(directory, 'startup-test-result.txt'), 'utf8')
  if (results.includes('FAIL') || results.match(/PASS:/g)?.length !== 9) throw new Error(`Installer hook test failed:\n${results}`)
  console.log(results.trim())
} finally {
  // This exact temporary directory was created above, outside the application.
  await rm(directory, { recursive: true, force: true })
}
