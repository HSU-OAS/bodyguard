// FR-V-03·NFR-08: actual production build without asset/avatar preparation or env files.
import assert from 'node:assert/strict'
import { build, mergeConfig } from 'vite'
import config from '../vite.config.ts'

const [scratch] = process.argv.slice(2)
assert(/^\/private\/tmp\/bodyguard-coaching-ui\.[A-Za-z0-9]+$/.test(scratch))
await build(
  mergeConfig(config, {
    configFile: false,
    envDir: scratch,
    build: { outDir: `${scratch}/product`, emptyOutDir: false },
  }),
)
