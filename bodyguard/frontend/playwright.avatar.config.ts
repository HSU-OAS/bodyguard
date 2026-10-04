import { defineConfig } from '@playwright/test'

// FR-A-02/03: actual Chrome GLB rendering, no camera, SMTP, account or user data.
const proxy = process.env.BODYGUARD_TEST_BLOCKED_PROXY
if (!proxy || !/^http:\/\/127\.0\.0\.1:\d+$/.test(proxy))
  throw new Error('Run the isolated avatar browser harness with an owned closed-port proxy')
export default defineConfig({
  testDir: 'e2e',
  outputDir: 'test-results/avatar',
  testMatch: 'avatar.spec.ts',
  timeout: 90_000,
  use: {
    baseURL: 'http://localhost:5182',
    channel: 'chrome',
    viewport: { width: 1440, height: 1080 },
    proxy: { server: proxy, bypass: 'localhost,127.0.0.1,[::1]' },
  },
  webServer: {
    command: 'vite --host localhost --port 5182',
    url: 'http://localhost:5182',
    reuseExistingServer: false,
    timeout: 60_000,
  },
})
