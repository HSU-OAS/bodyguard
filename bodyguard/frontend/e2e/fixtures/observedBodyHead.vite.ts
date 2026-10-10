// FR-A-03/NFR-07: unique isolated build; not a product route.
import assert from 'node:assert/strict'
import { realpathSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const scratch = process.env.BODYGUARD_TEST_BODY_HEAD
assert(
  scratch &&
    /^\/private\/tmp\/bodyguard-body-head-proof\.[A-Za-z0-9]+\/probe-[a-z][a-z0-9-]*$/.test(
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
      entry: join(dirname(fileURLToPath(import.meta.url)), 'observedBodyHeadProbe.ts'),
      formats: ['es'],
      fileName: () => 'probe.js',
    },
  },
})
