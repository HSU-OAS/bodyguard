// FR-S-03/04: isolated proof output, not public product UI.
import { existsSync, mkdirSync, realpathSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const directory = process.env.BODYGUARD_REFERENCE_PROOF,
  label = process.env.BODYGUARD_REFERENCE_LABEL
if (
  !directory ||
  !/^\/private\/tmp\/bodyguard-reference-proof\.[A-Za-z0-9]+$/.test(directory) ||
  realpathSync(directory) !== directory ||
  !label ||
  !/^[a-z][a-z0-9-]*$/.test(label)
)
  throw new Error('Private reference proof directory required')
const outDir = `${directory}/probe-${label}`
if (existsSync(outDir)) throw new Error('Existing reference evidence must be preserved')
mkdirSync(outDir)
export default defineConfig({
  publicDir: false,
  build: {
    outDir,
    emptyOutDir: false,
    lib: {
      entry: fileURLToPath(new URL('./referenceProbe.ts', import.meta.url)),
      formats: ['es'],
      fileName: () => 'probe.js',
    },
    minify: false,
    sourcemap: false,
  },
})
