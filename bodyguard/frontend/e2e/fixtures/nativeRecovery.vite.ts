// FR-M-07/FR-S-04/NFR-08: private native adapter fixture, never a public entry.
import assert from 'node:assert/strict'
import { realpathSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const scratch = process.env.BODYGUARD_TEST_NATIVE_RECOVERY_PROBE
assert(
  scratch && /^\/private\/tmp\/bodyguard-native-recovery-proof\.[A-Za-z0-9]+\/probe$/.test(scratch),
)
assert.equal(realpathSync(dirname(scratch)), dirname(scratch))
export default defineConfig({
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  build: {
    outDir: scratch,
    emptyOutDir: false,
    minify: false,
    lib: {
      entry: join(dirname(fileURLToPath(import.meta.url)), 'nativeRecoveryProbe.ts'),
      formats: ['es'],
      fileName: () => 'probe.js',
    },
  },
})
