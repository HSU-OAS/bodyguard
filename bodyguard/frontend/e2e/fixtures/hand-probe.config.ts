import { realpathSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const directory = process.env.BODYGUARD_HAND_PROOF
if (
  !directory ||
  !/^\/private\/tmp\/bodyguard-hand-proof\.[A-Za-z0-9]+$/.test(directory) ||
  realpathSync(directory) !== directory
)
  throw new Error('Private hand proof directory required')
export default defineConfig({
  publicDir: false,
  build: {
    outDir: `${directory}/probe`,
    emptyOutDir: false,
    lib: {
      entry: fileURLToPath(new URL('./observedHandsProbe.ts', import.meta.url)),
      formats: ['es'],
      fileName: () => 'probe.js',
    },
    sourcemap: false,
    minify: false,
  },
})
