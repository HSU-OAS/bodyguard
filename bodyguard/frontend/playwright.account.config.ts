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
    'nativeauth.spec.ts',
    'nativerecovery.spec.ts',
    'nativehead.spec.ts',
    'nativehands.spec.ts',
    'nativereference.spec.ts',
    'notifications.spec.ts',
    'alertdelivery.spec.ts',
    'ownedalert.spec.ts',
    'summaries.spec.ts',
    'minuteupload.spec.ts',
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
    ...(process.env.BODYGUARD_TEST_NATIVE_AUTH_PROBE ||
    process.env.BODYGUARD_TEST_NATIVE_RECOVERY_PROBE ||
    process.env.BODYGUARD_TEST_NATIVE_HEAD_PROBE ||
    process.env.BODYGUARD_TEST_NATIVE_HANDS_PROBE ||
    process.env.BODYGUARD_TEST_NATIVE_REFERENCE_PROBE
      ? {
          serviceWorkers: 'block' as const,
          permissions: ['camera'],
          launchOptions: {
            args: process.env.BODYGUARD_TEST_NATIVE_RECOVERY_PROBE
              ? ['--use-fake-device-for-media-stream']
              : ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
          },
        }
      : {}),
  },
  webServer: {
    command:
      process.env.BODYGUARD_TEST_NATIVE_HEAD_PROBE ||
      process.env.BODYGUARD_TEST_NATIVE_HANDS_PROBE ||
      process.env.BODYGUARD_TEST_NATIVE_REFERENCE_PROBE
        ? 'pnpm build && vite build --config e2e/fixtures/nativeHead.vite.ts && vite preview --host localhost'
        : process.env.BODYGUARD_TEST_NATIVE_RECOVERY_PROBE
          ? 'pnpm build && vite build --config e2e/fixtures/nativeRecovery.vite.ts && vite preview --host localhost'
          : process.env.BODYGUARD_TEST_NATIVE_AUTH_PROBE
            ? 'pnpm build && vite build --config e2e/fixtures/nativeAuth.vite.ts && vite preview --host localhost'
            : process.env.BODYGUARD_TEST_OWNED_ALERT_PROBE
              ? 'pnpm build && vite build --config e2e/fixtures/ownedAlert.vite.ts && vite preview --host localhost'
              : process.env.BODYGUARD_TEST_ALERT_DELIVERY_PROBE
                ? 'pnpm build && vite build --config e2e/fixtures/alertDelivery.vite.ts && vite preview --host localhost'
                : process.env.BODYGUARD_TEST_MINUTE_UPLOAD_PROBE
                  ? 'pnpm build && vite build --config e2e/fixtures/minuteUpload.vite.ts && vite preview --host localhost'
                  : process.env.BODYGUARD_TEST_COACHING_AUTH_PROBE
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
