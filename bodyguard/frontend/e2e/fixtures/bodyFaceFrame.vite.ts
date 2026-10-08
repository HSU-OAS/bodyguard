// FR-M-02/07/NFR-07: isolated test build, never a public route or product policy.
import assert from 'node:assert/strict'
import { realpathSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const scratch = process.env.BODYGUARD_TEST_BODY_FACE
assert(scratch && /^\/private\/tmp\/bodyguard-body-face-proof\.[A-Za-z0-9]+\/probe$/.test(scratch))
assert.equal(realpathSync(dirname(scratch)), dirname(scratch))
export default defineConfig({
  build: {
    outDir: scratch,
    emptyOutDir: false,
    minify: false,
    lib: {
      entry: join(dirname(fileURLToPath(import.meta.url)), 'bodyFaceFrameProbe.ts'),
      formats: ['es'],
      fileName: () => 'probe.js',
    },
  },
})
