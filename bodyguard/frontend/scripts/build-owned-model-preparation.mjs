// FR-M-02/NFR-08: actual product keeps notice/privacy guards; fixture is non-releasable.
import assert from 'node:assert/strict'
import { build, mergeConfig } from 'vite'
import config from '../vite.config.ts'

const [scratch] = process.argv.slice(2)
assert(/^\/private\/tmp\/bodyguard-owned-models\.[A-Za-z0-9]+$/.test(scratch))
await build(
  mergeConfig(config, {
    configFile: false,
    envDir: scratch,
    build: { outDir: `${scratch}/product`, emptyOutDir: false },
  }),
)
await build({
  configFile: false,
  envDir: scratch,
  publicDir: false,
  plugins: config.plugins.filter((plugin) => plugin?.name === 'bodyguard-sdk-network-policy'),
  worker: { format: 'iife' },
  build: {
    outDir: `${scratch}/probe`,
    emptyOutDir: false,
    rollupOptions: { input: 'e2e/fixtures/ownedModelProbe.html' },
  },
})
