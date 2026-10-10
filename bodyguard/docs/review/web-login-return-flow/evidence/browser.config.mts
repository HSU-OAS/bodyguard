// FR-U-04: original account browser policy; prebuilt actual production output only.
import base from "/Applications/학교 내부/2026-2학기/오픈소스 AI SW 융합 프로젝트/BODYGUARD-dashboard-client/bodyguard/frontend/playwright.account.config.ts"
export default {
  ...base,
  testDir: "/Applications/학교 내부/2026-2학기/오픈소스 AI SW 융합 프로젝트/BODYGUARD-dashboard-client/bodyguard/frontend/e2e",
  webServer: { ...base.webServer,
    command: 'exec /opt/homebrew/bin/node "/Applications/학교 내부/2026-2학기/오픈소스 AI SW 융합 프로젝트/BODYGUARD-dashboard-client/bodyguard/frontend/node_modules/vite/bin/vite.js" preview --config /private/tmp/bodyguard-login-return.hMIhQq/build.vite.mts --outDir /private/tmp/bodyguard-login-return.hMIhQq/dist --host localhost --port 4173 --strictPort'
  }
}
