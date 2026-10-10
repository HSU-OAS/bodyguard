// FR-M-02/NFR-07/08: private comparison only, no public page or avatar assets.
import { defineConfig } from 'vite'

const outDir = process.env.BODYGUARD_TEST_INFERENCE_THREAD
if (!outDir || !/^\/private\/tmp\/bodyguard-inference-thread\.[A-Za-z0-9]+\/probe$/.test(outDir))
  throw new Error('Owned inference comparison required')
export default defineConfig({
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  build: {
    outDir,
    emptyOutDir: false,
    minify: false,
    lib: {
      entry: 'e2e/fixtures/inferenceThreadProbe.ts',
      formats: ['es'],
      fileName: () => 'probe.js',
    },
  },
})
