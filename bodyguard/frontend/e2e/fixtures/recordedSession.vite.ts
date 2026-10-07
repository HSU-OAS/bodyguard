// FR-R-03/NFR-08: owned test-only output, no production entry.
import assert from 'node:assert/strict'
import { realpathSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const scratch = process.env.BODYGUARD_TEST_RECORDED_PROBE
assert(
  scratch &&
    /^\/private\/tmp\/bodyguard-recorded-session-proof\.[A-Za-z0-9]+\/browser-probe$/.test(scratch),
)
assert(realpathSync(dirname(scratch)) === dirname(scratch))
export default defineConfig({
  build: {
    outDir: scratch,
    emptyOutDir: false,
    minify: false,
    lib: {
      entry: join(dirname(fileURLToPath(import.meta.url)), 'recordedSessionProbe.ts'),
      formats: ['es'],
      fileName: () => 'probe.js',
    },
  },
})
