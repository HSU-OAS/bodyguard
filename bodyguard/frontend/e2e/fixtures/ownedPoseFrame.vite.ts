// FR-M-02/07·FR-A-03: isolated native diagnostic; never a product route.
import assert from 'node:assert/strict'
import { realpathSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const scratch = process.env.BODYGUARD_TEST_POSE_FRAME
assert(scratch && /^\/private\/tmp\/bodyguard-pose-frame-proof\.[A-Za-z0-9]+\/probe$/.test(scratch))
assert.equal(realpathSync(dirname(scratch)), dirname(scratch))
export default defineConfig({
  build: {
    outDir: scratch,
    emptyOutDir: false,
    minify: false,
    lib: {
      entry: join(dirname(fileURLToPath(import.meta.url)), 'ownedPoseFrameProbe.ts'),
      formats: ['es'],
      fileName: () => 'probe.js',
    },
  },
})
