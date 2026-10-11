// FR-M-03/NFR-08: private memory-only client bundle, no public route.
import assert from 'node:assert/strict'
import { realpathSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const scratch = process.env.BODYGUARD_TEST_BASELINE_PROBE
assert(scratch && /^\/private\/tmp\/bodyguard-baseline-client\.[A-Za-z0-9]+\/probe$/.test(scratch))
assert(realpathSync(dirname(scratch)) === dirname(scratch))
export default defineConfig({
  envDir: false,
  build: {
    outDir: scratch,
    emptyOutDir: false,
    minify: false,
    lib: {
      entry: join(dirname(fileURLToPath(import.meta.url)), 'baselineClientProbe.ts'),
      formats: ['es'],
      fileName: () => 'probe.js',
    },
  },
})
