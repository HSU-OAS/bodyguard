// NFR-08: same production config/rights helper, new output; no prepare-assets or avatar cycle.
import config from "/Applications/학교 내부/2026-2학기/오픈소스 AI SW 융합 프로젝트/BODYGUARD-dashboard-client/bodyguard/frontend/vite.config.ts"
export default {
  ...config,
  root: "/Applications/학교 내부/2026-2학기/오픈소스 AI SW 융합 프로젝트/BODYGUARD-dashboard-client/bodyguard/frontend",
  envDir: "/private/tmp/bodyguard-login-return.hMIhQq",
  build: { ...config.build, outDir: "/private/tmp/bodyguard-login-return.hMIhQq/dist", emptyOutDir: false }
}
