// FR-R-03/FR-U-04: private React integration bundle, not a public route.
import assert from 'node:assert/strict'
import { realpathSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const scratch = process.env.BODYGUARD_TEST_AUTH_DASHBOARD_PROBE
assert(
  scratch &&
    /^\/private\/tmp\/bodyguard-auth-dashboard\.[A-Za-z0-9]+\/browser-probe$/.test(scratch),
)
assert.equal(realpathSync(dirname(scratch)), dirname(scratch))
export default defineConfig({
  publicDir: false,
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  build: {
    outDir: scratch,
    emptyOutDir: false,
    minify: false,
    lib: {
      entry: join(dirname(fileURLToPath(import.meta.url)), 'authDashboardProbe.ts'),
      formats: ['es'],
      fileName: () => 'probe.js',
    },
  },
})
