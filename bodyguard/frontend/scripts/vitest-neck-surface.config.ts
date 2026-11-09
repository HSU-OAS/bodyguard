// FR-A-01/03: fixed-GLB/all-vertex proof is a separate required integration gate.
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  root: fileURLToPath(new URL('../', import.meta.url)),
  test: {
    include: [
      'src/avatar/neckSurfaceFeedback.proof.ts',
      'src/avatar/shrugSurfaceFeedback.proof.ts',
    ],
    environment: 'node',
    maxWorkers: 1,
    // CPU GLB parsing/skin proof budget only; never a camera/SDK/clinical timeout.
    testTimeout: 15_000,
  },
})
