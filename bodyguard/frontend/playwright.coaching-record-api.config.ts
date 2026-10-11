// FR-U-04/FR-R-03/NFR-08: preserve existing gates, separate owned build/env/assets.
import { defineConfig } from '@playwright/test'
import config from './playwright.account.config'

const executablePath = process.env.BODYGUARD_TEST_BROWSER_EXECUTABLE
export default defineConfig({
  ...config,
  testMatch: 'authcoaching.spec.ts',
  use: {
    ...config.use,
    serviceWorkers: 'block',
    ...(executablePath ? { channel: undefined, launchOptions: { executablePath } } : {}),
  },
  webServer: {
    ...config.webServer,
    command: 'node scripts/serve-recorded-api-proof.mjs',
  },
})
