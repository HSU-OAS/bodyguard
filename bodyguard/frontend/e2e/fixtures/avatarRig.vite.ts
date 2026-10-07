// FR-A-01/03: private diagnostic bundle; not a product route or exercise guide.
import assert from 'node:assert/strict'
import { realpathSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const scratch = process.env.BODYGUARD_TEST_RIG_PROBE
assert(scratch && /^\/private\/tmp\/bodyguard-rig-proof\.[A-Za-z0-9]+\/probe$/.test(scratch))
assert.equal(realpathSync(dirname(scratch)), dirname(scratch))
export default defineConfig({
  build: {
    outDir: scratch,
    emptyOutDir: false,
    minify: false,
    lib: {
      entry: join(dirname(fileURLToPath(import.meta.url)), 'avatarRigProbe.ts'),
      formats: ['es'],
      fileName: () => 'probe.js',
    },
  },
})
