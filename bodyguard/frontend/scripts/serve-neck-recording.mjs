// FR-R-03/FR-U-04: actual API/SQL runner; generated capture only, loopback and owned scratch.
import assert from 'node:assert/strict'
import { readFileSync, realpathSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { createServer, mergeConfig } from 'vite'
import config from '../vite.config.ts'

const scratch = process.env.BODYGUARD_TEST_NECK_RECORDING
assert(/^\/private\/tmp\/bodyguard-neck-recording\.[A-Za-z0-9]+$/.test(scratch))
assert.equal(realpathSync(scratch), scratch)
assert.equal(statSync(scratch).uid, process.getuid())
assert(process.env.BODYGUARD_TEST_MAILBOX?.startsWith('/private/tmp/bodyguard-browser-'))
const replacements = new Set(
  ['src/pose/camera.ts', 'src/pose/workerInference.ts', 'src/pose/videoPoseSource.ts'].map((f) =>
    resolve(f),
  ),
)
const server = await createServer(
  mergeConfig(config, {
    configFile: false,
    envDir: scratch,
    plugins: [
      {
        name: 'isolated-neck-recording-input',
        enforce: 'pre',
        resolveId(id, importer) {
          if (id === './pages/CoachingPage' && importer?.split('?')[0] === resolve('src/App.tsx'))
            return resolve('e2e/fixtures/neckRecordingEntry.tsx')
        },
        load(id) {
          if (replacements.has(id.split('?')[0]))
            return readFileSync('e2e/fixtures/neckWorkspaceSource.ts', 'utf8').replace(
              "'./neckCandidate'",
              JSON.stringify(resolve('e2e/fixtures/neckCandidate.ts')),
            )
        },
      },
    ],
    server: { host: 'localhost', port: 4173, strictPort: true, open: false, hmr: false },
  }),
)
await server.listen()
let closing = false
async function close() {
  if (closing) return
  closing = true
  await server.close()
}
process.once('SIGINT', () => void close())
process.once('SIGTERM', () => void close())
