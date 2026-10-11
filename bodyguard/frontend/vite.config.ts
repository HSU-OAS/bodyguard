import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import { buildNoticePlugin } from './scripts/check-build-notices.ts'
import { devInferenceWorkerPlugin } from './scripts/dev-inference-worker.ts'
import {
  SDK_DEV_POLICY,
  SDK_NETWORK_POLICY,
  sdkNetworkPolicyPlugin,
} from './scripts/sdk-network-policy.ts'

export default defineConfig({
  plugins: [
    sdkNetworkPolicyPlugin(),
    devInferenceWorkerPlugin(),
    react(),
    tailwindcss(),
    buildNoticePlugin(fileURLToPath(new URL('./', import.meta.url))),
  ],
  // NFR-08 / Q-11: 실제 bundled JS 고지. CSS 제작 경로는 별도 원문 고지로 보완한다.
  build: { license: { fileName: 'licenses/bundled-js.json' } },
  server: {
    port: 5173,
    strictPort: true,
    headers: { 'Content-Security-Policy': SDK_DEV_POLICY },
    proxy: { '/api': 'http://127.0.0.1:8000' },
  },
  preview: {
    port: 4173,
    strictPort: true,
    headers: { 'Content-Security-Policy': SDK_NETWORK_POLICY },
    proxy: { '/api': 'http://127.0.0.1:8000' },
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'node',
  },
})
