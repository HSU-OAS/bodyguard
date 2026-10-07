// FR-U-04/NFR-08: isolated owned test-only build, no production entry.
import assert from 'node:assert/strict'
import { realpathSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const scratch = process.env.BODYGUARD_TEST_COACHING_AUTH_PROBE
assert(
  scratch &&
    /^\/private\/tmp\/bodyguard-coaching-auth-proof\.[A-Za-z0-9]+\/browser-probe$/.test(scratch),
)
assert(realpathSync(dirname(scratch)) === dirname(scratch))
export default defineConfig({
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  build: {
    outDir: scratch,
    emptyOutDir: false,
    minify: false,
    lib: {
      entry: join(dirname(fileURLToPath(import.meta.url)), 'authCoachingProbe.ts'),
      formats: ['es'],
      fileName: () => 'probe.js',
    },
  },
})
