// FR-S-04/NFR-07: private native lifecycle proof, never a product build.
import assert from 'node:assert/strict'
import { realpathSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const scratch = process.env.BODYGUARD_TEST_PLAYBACK_RESOURCES
assert(
  scratch &&
    /^\/private\/tmp\/bodyguard-playback-resources-proof\.[A-Za-z0-9]+\/probe$/.test(scratch),
)
assert.equal(realpathSync(dirname(scratch)), dirname(scratch))
export default defineConfig({
  build: {
    outDir: scratch,
    emptyOutDir: false,
    minify: false,
    lib: {
      entry: join(dirname(fileURLToPath(import.meta.url)), 'ownedPlaybackResourcesProbe.ts'),
      formats: ['es'],
      fileName: () => 'probe.js',
    },
  },
})
