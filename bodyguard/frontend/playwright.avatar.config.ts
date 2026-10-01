import { defineConfig } from '@playwright/test'

// FR-A-02/03: actual Chrome GLB rendering, no camera, SMTP, account or user data.
export default defineConfig({
  testDir: 'e2e',
  testMatch: 'avatar.spec.ts',
  timeout: 90_000,
  use: {
    baseURL: 'http://localhost:5182',
    channel: 'chrome',
    viewport: { width: 1440, height: 1080 },
  },
  webServer: {
    command: 'vite --host localhost --port 5182',
    url: 'http://localhost:5182',
    reuseExistingServer: false,
    timeout: 60_000,
  },
})
