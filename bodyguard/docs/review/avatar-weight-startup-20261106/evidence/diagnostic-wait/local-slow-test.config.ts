import { mergeConfig } from 'vite'
import original from '../vite.config'
export default mergeConfig(original, { test: { setupFiles: ['scripts/local-slow-test-setup.ts'], testTimeout: 20000 } })
