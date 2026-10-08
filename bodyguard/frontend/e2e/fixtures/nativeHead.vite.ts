import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const withHands = Boolean(process.env.BODYGUARD_TEST_NATIVE_HANDS_PROBE)
const outDir =
  process.env.BODYGUARD_TEST_NATIVE_HANDS_PROBE ?? process.env.BODYGUARD_TEST_NATIVE_HEAD_PROBE
if (
  !outDir ||
  !(
    withHands
      ? /^\/private\/tmp\/bodyguard-native-hands-proof\.[A-Za-z0-9]+\/probe$/
      : /^\/private\/tmp\/bodyguard-native-body-head-proof\.[A-Za-z0-9]+\/probe$/
  ).test(outDir)
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
