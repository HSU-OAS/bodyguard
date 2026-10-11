// FR-U-04/FR-R-03/NFR-08: test-only owned builds/server, no env/assets/SDK/avatar preparation.
import assert from 'node:assert/strict'
import { realpathSync, statSync } from 'node:fs'
import { dirname } from 'node:path'
import { build, mergeConfig, preview } from 'vite'
import probe from '../e2e/fixtures/authCoaching.vite.ts'
import config from '../vite.config.ts'

const bundle = process.env.BODYGUARD_TEST_COACHING_AUTH_PROBE
assert(/^\/private\/tmp\/bodyguard-coaching-auth-proof\.[A-Za-z0-9]+\/browser-probe$/.test(bundle))
const scratch = dirname(bundle)
assert.equal(realpathSync(scratch), scratch)
assert.equal(statSync(scratch).uid, process.getuid())
await build(
  mergeConfig(config, {
    configFile: false,
    envDir: scratch,
    build: { outDir: `${scratch}/product`, emptyOutDir: false },
  }),
)
await build(mergeConfig(probe, { configFile: false, envDir: scratch }))
const server = await preview(
  mergeConfig(config, {
    configFile: false,
    envDir: scratch,
    build: { outDir: `${scratch}/product` },
    preview: { host: 'localhost', port: 4173, strictPort: true, open: false },
  }),
)
let closing = false
function close() {
  if (closing) return
  closing = true
  server.httpServer.close((error) => {
    process.exitCode = error ? 1 : 0
  })
}
process.once('SIGINT', close)
process.once('SIGTERM', close)
