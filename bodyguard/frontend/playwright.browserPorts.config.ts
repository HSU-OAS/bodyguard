// NFR-08: explicit local refusing proxy, installed Chrome, fake camera; no tracing/video/screenshots.
import { defineConfig } from '@playwright/test'

const proxy = process.env.BODYGUARD_TEST_BLOCKED_PROXY
if (!proxy || !/^http:\/\/127\.0\.0\.1:\d+$/.test(proxy))
  throw new Error('Run the browser ports harness')
export default defineConfig({
  testDir: 'e2e',
  testMatch: ['browserPorts.spec.ts', 'browserPortsPolicy.spec.ts'],
  workers: 1,
  reporter: [['list'], ['json', { outputFile: 'test-results/browser-ports-report.json' }]],
  timeout: 90_000,
  use: {
    baseURL: 'http://localhost:5184',
    channel: 'chrome',
    permissions: ['camera'],
    proxy: { server: proxy, bypass: 'localhost,127.0.0.1,[::1]' },
    launchOptions: {
      args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
    },
    screenshot: 'off',
    trace: 'off',
    video: 'off',
  },
  webServer: {
    command: 'vite --host localhost --port 5184 --strictPort',
    url: 'http://localhost:5184',
    reuseExistingServer: false,
    timeout: 30_000,
  },
})
