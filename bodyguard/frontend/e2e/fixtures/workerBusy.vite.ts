// S6.17·NFR-08: separate TEST ONLY classic worker bundle, never a public entry.
import { defineConfig } from 'vite'

const outDir = process.env.BODYGUARD_TEST_WORKER_BUSY_BUNDLE
if (!outDir || !/^\/private\/tmp\/bodyguard-worker-busy-proof\.[A-Za-z0-9]+\/bundle$/.test(outDir))
  throw new Error('Owned worker busy harness required')
export default defineConfig({
  build: {
    outDir,
    emptyOutDir: false,
    minify: false,
    lib: {
      entry: 'e2e/fixtures/workerBusyEntry.ts',
      formats: ['iife'],
      name: 'BodyguardTestOnlyWorkerBusy',
      fileName: () => 'worker-busy.js',
    },
  },
})
