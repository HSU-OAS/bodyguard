import { defineConfig } from '@playwright/test'

// FR-U-02/03/04: launched by isolated backend/tests/run_browser.py, no auth stubs.
if (!process.env.BODYGUARD_TEST_MAILBOX) throw new Error('Run the isolated browser harness')
const proxy = process.env.BODYGUARD_TEST_BLOCKED_PROXY
if (!proxy || !/^http:\/\/127\.0\.0\.1:\d+$/.test(proxy))
  throw new Error('Owned closed-port egress proxy required')
export default defineConfig({
  testDir: 'e2e',
  testMatch: [
    'account.spec.ts',
    'password.spec.ts',
    'google.spec.ts',
    'records.spec.ts',
    'design.spec.ts',
    'withdrawal.spec.ts',
    'datahelp.spec.ts',
    'integration.spec.ts',
    'security.spec.ts',
    'resultrecord.spec.ts',
    'ownercapture.spec.ts',
    'recordedsession.spec.ts',
    'authcoaching.spec.ts',
  ],
  reporter: process.env.BODYGUARD_TEST_RECORDS_REPORT
    ? [['list'], ['json', { outputFile: process.env.BODYGUARD_TEST_RECORDS_REPORT }]]
    : 'list',
  workers: 1,
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:4173',
    channel: 'chrome',
    viewport: { width: 1440, height: 1000 },
    proxy: { server: proxy, bypass: 'localhost,127.0.0.1,[::1]' },
  },
  webServer: {
    command: process.env.BODYGUARD_TEST_COACHING_AUTH_PROBE
      ? 'pnpm build && vite build --config e2e/fixtures/authCoaching.vite.ts && vite preview --host localhost'
      : process.env.BODYGUARD_TEST_RECORDED_PROBE
        ? 'pnpm build && vite build --config e2e/fixtures/recordedSession.vite.ts && vite preview --host localhost'
        : process.env.BODYGUARD_TEST_OWNER_PROBE
          ? 'pnpm build && vite build --config e2e/fixtures/recordOwner.vite.ts && vite preview --host localhost'
          : process.env.BODYGUARD_TEST_RESULT_PROBE
            ? 'pnpm build && vite build --config e2e/fixtures/resultRecord.vite.ts && vite preview --host localhost'
            : 'pnpm build && vite preview --host localhost',
    url: 'http://localhost:4173',
    reuseExistingServer: false,
    timeout: 180_000,
  },
})
