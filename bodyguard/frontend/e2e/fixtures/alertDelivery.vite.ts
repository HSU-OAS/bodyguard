// FR-N-04/05: owned test-only library, never a production route.
import assert from 'node:assert/strict'
import { realpathSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const scratch = process.env.BODYGUARD_TEST_ALERT_DELIVERY_PROBE
assert(
  scratch &&
    /^\/private\/tmp\/bodyguard-alert-delivery-proof\.[A-Za-z0-9]+\/browser-probe$/.test(scratch),
)
assert.equal(realpathSync(dirname(scratch)), dirname(scratch))
export default defineConfig({
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  build: {
    outDir: scratch,
    emptyOutDir: false,
    minify: false,
    lib: {
      entry: join(dirname(fileURLToPath(import.meta.url)), 'alertDeliveryProbe.ts'),
      formats: ['es'],
      fileName: () => 'probe.js',
      cssFileName: 'probe',
    },
  },
})
