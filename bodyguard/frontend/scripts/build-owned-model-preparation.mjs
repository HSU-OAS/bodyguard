// FR-M-02/NFR-08: actual product keeps notice/privacy guards; fixture is non-releasable.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { build, mergeConfig } from 'vite'
import config from '../vite.config.ts'

const [scratch, originalModelSource] = process.argv.slice(2)
assert(/^\/private\/tmp\/bodyguard-owned-models\.[A-Za-z0-9]+$/.test(scratch))
if (originalModelSource)
  assert(
    /^\/private\/tmp\/bodyguard-model-download\.[A-Za-z0-9]+\/original-ownedModelAssets\.ts$/.test(
      originalModelSource,
    ),
  )
await build(
  mergeConfig(config, {
    configFile: false,
    envDir: scratch,
    build: { outDir: `${scratch}/product`, emptyOutDir: false },
  }),
)
let originalTransforms = 0
await build({
  configFile: false,
  envDir: scratch,
  publicDir: false,
  plugins: [
    ...config.plugins.filter((plugin) => plugin?.name === 'bodyguard-sdk-network-policy'),
    ...(originalModelSource
      ? [
          {
            name: 'private-original-model-reader-comparison',
            enforce: 'pre',
            transform(_code, id) {
              if (id !== resolve('src/pose/ownedModelAssets.ts')) return null
              originalTransforms++
              return readFileSync(originalModelSource, 'utf8')
            },
          },
        ]
      : []),
  ],
  worker: { format: 'iife' },
  build: {
    outDir: `${scratch}/probe`,
    emptyOutDir: false,
    rollupOptions: { input: 'e2e/fixtures/ownedModelProbe.html' },
  },
})
if (originalModelSource) assert.equal(originalTransforms, 1)
writeFileSync(
  `${scratch}/model-reader-provenance.json`,
  `${JSON.stringify(
    {
      privateProbeOnlyOverride: Boolean(originalModelSource),
      originalTransforms,
      readerSource: originalModelSource ?? resolve('src/pose/ownedModelAssets.ts'),
      readerSha256: createHash('sha256')
        .update(readFileSync(originalModelSource ?? 'src/pose/ownedModelAssets.ts'))
        .digest('hex'),
      probeInputSha256: createHash('sha256')
        .update(readFileSync('e2e/fixtures/ownedModelProbe.ts'))
        .digest('hex'),
      productOverrides: 0,
    },
    null,
    2,
  )}\n`,
  { flag: 'wx' },
)
