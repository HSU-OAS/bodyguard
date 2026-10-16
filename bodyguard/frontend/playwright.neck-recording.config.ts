// FR-R-03/FR-U-04: same real-account runner and egress block; no physical camera permission.
import { defineConfig } from '@playwright/test'
import config from './playwright.account.config'

export default defineConfig({
  ...config,
  testMatch: 'neckrecording.spec.ts',
  use: { ...config.use, serviceWorkers: 'block' },
  webServer: { ...config.webServer, command: 'node scripts/serve-neck-recording.mjs' },
})
