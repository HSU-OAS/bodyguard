// FR-A-01/03: private synthetic GLB diagnostic, never a public route.
import assert from 'node:assert/strict'
import { realpathSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const scratch = process.env.BODYGUARD_TEST_OBSERVED_RIG
assert(
  scratch && /^\/private\/tmp\/bodyguard-observed-rig-proof\.[A-Za-z0-9]+\/probe$/.test(scratch),
)
assert.equal(realpathSync(dirname(scratch)), dirname(scratch))
export default defineConfig({
  build: {
    outDir: scratch,
    emptyOutDir: false,
    minify: false,
    lib: {
      entry: join(dirname(fileURLToPath(import.meta.url)), 'observedPoseRigProbe.ts'),
      formats: ['es'],
      fileName: () => 'probe.js',
    },
  },
})
