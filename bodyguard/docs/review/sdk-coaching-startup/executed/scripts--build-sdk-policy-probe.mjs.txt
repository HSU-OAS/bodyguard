// Build artifacts only, no assets preparation/avatar manufacturing or env loading.
import assert from 'node:assert/strict'
import { build, mergeConfig } from 'vite'
import config from '../vite.config.ts'

const [scratch] = process.argv.slice(2)
assert(/^\/private\/tmp\/bodyguard-sdk-policy\.[A-Za-z0-9]+$/.test(scratch))
await build(
  mergeConfig(config, {
    configFile: false,
    envDir: scratch,
    build: { outDir: `${scratch}/product`, emptyOutDir: false },
  }),
)
await build(
  // Private fixture is not releasable; the actual product above keeps its strict notices.
  mergeConfig(
    {
      ...config,
      plugins: config.plugins.filter((plugin) => plugin?.name !== 'bodyguard-build-notices'),
    },
    {
      configFile: false,
      envDir: scratch,
      publicDir: false,
      build: {
        outDir: `${scratch}/probe`,
        emptyOutDir: false,
        rollupOptions: { input: 'e2e/fixtures/sdkNetworkProbe.html' },
      },
    },
  ),
)
