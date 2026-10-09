// FR-M-07/FR-A-03/NFR-08: only a temporary private technical probe, never the public bundle.
import { defineConfig } from 'vite'

const outDir = process.env.BODYGUARD_TEST_WARMUP_PROBE
if (
  !outDir ||
  !/^\/private\/tmp\/bodyguard-inference-warmup-proof\.[A-Za-z0-9]+\/probe$/.test(outDir)
)
  throw new Error('Owned warmup probe required')
export default defineConfig({
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  build: {
    outDir,
    emptyOutDir: false,
    minify: false,
    lib: {
      entry: 'e2e/fixtures/nativeContentionProbe.ts',
      formats: ['es'],
      fileName: () => 'probe.js',
    },
  },
})
