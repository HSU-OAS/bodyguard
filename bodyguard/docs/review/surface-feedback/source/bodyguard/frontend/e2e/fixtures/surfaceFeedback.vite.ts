// FR-A-01/03: test-only avatar surface probe, never a public route.
import assert from 'node:assert/strict'
import { realpathSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const scratch = process.env.BODYGUARD_TEST_SURFACE_FEEDBACK
assert(
  scratch &&
    /^\/private\/tmp\/bodyguard-surface-feedback-proof\.[A-Za-z0-9]+\/probe-[a-z][a-z0-9-]*$/.test(
      scratch,
    ),
)
assert.equal(realpathSync(dirname(scratch)), dirname(scratch))
export default defineConfig({
  build: {
    outDir: scratch,
    emptyOutDir: false,
    minify: false,
    lib: {
      entry: join(dirname(fileURLToPath(import.meta.url)), 'surfaceFeedbackProbe.ts'),
      formats: ['es'],
      fileName: () => 'probe.js',
    },
  },
})
