import { defineConfig } from '@playwright/test'

// 설치된 크롬과 가짜 카메라로 측정 흐름을 확인한다.
// 가짜 카메라 화면에는 사람이 없어서, 인식 여부가 아니라 카메라 → 추론 루프가 에러 없이 도는지만 본다
export default defineConfig({
  testDir: 'e2e',
  testMatch: 'demo.spec.ts',
  timeout: 90_000,
  use: {
    baseURL: 'http://localhost:5181',
    channel: 'chrome',
    permissions: ['camera'],
    launchOptions: {
      args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
    },
  },
  webServer: {
    command: 'node scripts/prepare-assets.mjs && vite --host localhost --port 5181',
    url: 'http://localhost:5181',
    reuseExistingServer: false,
    timeout: 180_000,
  },
})
