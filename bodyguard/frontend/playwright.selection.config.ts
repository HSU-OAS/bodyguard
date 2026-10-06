import { defineConfig } from '@playwright/test'

// FR-V-03/NFR-08: test runner owns a refusing proxy; production has no auth bypass.
const proxy = process.env.BODYGUARD_TEST_BLOCKED_PROXY
if (!proxy || !/^http:\/\/127\.0\.0\.1:\d+$/.test(proxy))
  throw new Error('Run the selection browser harness')
const report = process.env.BODYGUARD_TEST_SELECTION_REPORT
if (!report || !/^test-results\/selection-[0-9TZ]+\/report\.json$/.test(report))
  throw new Error('Owned timestamped selection report required')
export default defineConfig({
  testDir: 'e2e',
  testMatch: 'selection.spec.ts',
  workers: 1,
  reporter: [
    ['list'],
    [
      'json',
      {
        outputFile: report,
      },
    ],
  ],
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:5182',
    channel: 'chrome',
    viewport: { width: 1440, height: 1000 },
    proxy: { server: proxy, bypass: 'localhost,127.0.0.1,[::1]' },
  },
  webServer: [
    {
      command: 'vite --host localhost --port 5182 --strictPort',
      url: 'http://localhost:5182',
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command: 'vite preview --host localhost --port 4182 --strictPort',
      url: 'http://localhost:4182',
      reuseExistingServer: false,
      timeout: 30_000,
    },
  ],
})
