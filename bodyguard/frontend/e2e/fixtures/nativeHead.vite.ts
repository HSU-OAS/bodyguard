import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const outDir = process.env.BODYGUARD_TEST_NATIVE_HEAD_PROBE
if (
  !outDir ||
  !/^\/private\/tmp\/bodyguard-native-body-head-proof\.[A-Za-z0-9]+\/probe$/.test(outDir)
)
  throw new Error('Owned native head auth harness required')
export default defineConfig({
  plugins: [react()],
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  build: {
    outDir,
    emptyOutDir: false,
    minify: false,
    lib: {
      entry: 'e2e/fixtures/nativeHeadAuthProbe.ts',
      formats: ['es'],
      fileName: () => 'probe.js',
    },
  },
})
