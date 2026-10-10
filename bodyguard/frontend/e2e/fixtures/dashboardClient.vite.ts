// FR-R-03/FR-U-04: separate scratch bundle, no public application import or route.
import assert from 'node:assert/strict'
import { realpathSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const scratch = process.env.BODYGUARD_TEST_DASHBOARD_PROBE
assert(
  scratch &&
    /^\/private\/tmp\/bodyguard-dashboard-client\.[A-Za-z0-9]+\/browser-probe$/.test(scratch),
)
assert(realpathSync(dirname(scratch)) === dirname(scratch))
export default defineConfig({
  build: {
    outDir: scratch,
    emptyOutDir: false,
    minify: false,
    lib: {
      entry: join(dirname(fileURLToPath(import.meta.url)), 'dashboardClientProbe.ts'),
      formats: ['es'],
      fileName: () => 'probe.js',
    },
  },
})
