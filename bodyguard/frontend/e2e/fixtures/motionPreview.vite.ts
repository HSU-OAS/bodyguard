// FR-S-04: private fixture build; never writes to public dist or replaces earlier evidence.
import { existsSync, mkdirSync, realpathSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const directory = process.env.BODYGUARD_MOTION_PREVIEW_PROOF
const label = process.env.BODYGUARD_MOTION_PREVIEW_LABEL
if (
  !directory ||
  !/^\/private\/tmp\/bodyguard-motion-preview-proof\.[A-Za-z0-9]+$/.test(directory) ||
  realpathSync(directory) !== directory
)
  throw new Error('Private motion preview proof directory required')
if (!label || !/^[a-z0-9-]+$/.test(label)) throw new Error('Private preview build label required')
const outDir = `${directory}/probe-${label}`
if (existsSync(outDir)) throw new Error('Existing preview evidence must be preserved')
mkdirSync(outDir)
export default defineConfig({
  publicDir: false,
  build: {
    outDir,
    emptyOutDir: false,
    lib: {
      entry: fileURLToPath(new URL('./motionPreviewProbe.ts', import.meta.url)),
      formats: ['es'],
      fileName: () => 'probe.js',
    },
    minify: false,
    sourcemap: false,
  },
})
