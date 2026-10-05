// FR-S-01/06, FR-V-03: actual production output must not contain unvalidated candidate UI.
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export function checkProductionScripts(root) {
  const files = readdirSync(root, { recursive: true }).filter((name) =>
    String(name).endsWith('.js'),
  )
  assert(files.length > 0, 'Build the production app first')
  for (const file of files) {
    const text = readFileSync(join(root, String(file)), 'utf8')
    for (const forbidden of [
      'neck-side',
      'chin-retraction',
      'cross-body-shoulder',
      'lateral-trunk',
      'seated-trunk-rotation',
      '안내만 후보 · 자동 판정 없음',
      '목 옆으로 기울이기',
      'MotionSelectionPage',
      '동작 선택 개발 검수',
      'pending-validation',
      '/dev/select',
      '/dev/measure',
      '/dev/avatar',
      'synthetic-algebra-only',
      'fixture-not-release',
      'An explicit validated coaching plan is required',
      'Step duration and repetition count must be explicitly valid',
    ]) {
      assert(!text.includes(forbidden), `Development candidate leaked into ${String(file)}`)
    }
  }
  return {
    production_JS_files_checked: files.length,
    development_catalog_strings: 0,
    unconnected_coaching_engine_strings: 0,
  }
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  console.log(
    JSON.stringify(
      checkProductionScripts(fileURLToPath(new URL('../dist/assets/', import.meta.url))),
    ),
  )
}
