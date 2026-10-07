// FR-V-03/NFR-08: loopback diagnostic runner only; no changed legacy test deadline.
import { defineConfig } from '@playwright/test'

for (const key of [
  'BODYGUARD_STARTUP_DEV',
  'BODYGUARD_STARTUP_PRODUCTION',
  'BODYGUARD_TEST_BLOCKED_PROXY',
])
  if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(process.env[key] ?? ''))
    throw new Error('Run the owned startup browser harness')
const report = process.env.BODYGUARD_STARTUP_REPORT
if (!report || !/^test-results\/startup-[0-9TZ]+\/report\.json$/.test(report))
  throw new Error('Owned timestamped startup report required')
// Chromium implicitly bypasses loopback; subtract it before allowing only our ports.
const ownedBypass = [
  '<-loopback>',
  ...['BODYGUARD_STARTUP_DEV', 'BODYGUARD_STARTUP_PRODUCTION'].map(
    (key) => `127.0.0.1:${new URL(process.env[key] ?? '').port}`,
  ),
].join(',')

export default defineConfig({
  testDir: 'e2e',
  testMatch: 'startup.spec.ts',
  workers: 1,
  retries: 0,
  timeout: 30_000,
  expect: { timeout: 5000 },
  reporter: [['list'], ['json', { outputFile: report }]],
  use: {
    channel: 'chrome',
    viewport: { width: 1440, height: 1000 },
    serviceWorkers: 'block',
    proxy: {
      server: process.env.BODYGUARD_TEST_BLOCKED_PROXY ?? '',
      bypass: ownedBypass,
    },
    trace: 'off',
    video: 'off',
  },
})
