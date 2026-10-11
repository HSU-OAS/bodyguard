// Approved release mapping only; not a runtime or clinical test.
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
const docs = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const repo = resolve(docs, '../..')
const read = (name) => readFileSync(resolve(docs, name), 'utf8')
const rules = read('operating-rules.md')
const adr = read('adr/0019-first-release-core-scope.md')
assert.ok(rules.includes('“기존 기록 화면 연결 진행 승인”'))
assert.ok(rules.includes('“네 부가 기능은 출시 후로 이월”'))
for (const text of ['자세 알림', 'PDF', 'LLM', '변화 탐지']) assert.ok(adr.includes(text))
for (const text of ['추천', '직접 선택', '두 아바타', '계정', '기록', '데이터 관리']) {
  assert.ok(read('release-plan.md').includes(text))
}
assert.ok(!read('open-questions.md').includes('### Q-32'))
assert.ok(read('open-questions.md').includes('| Q-32 |'))
assert.ok(read('prd.md').includes('### 2.3 알림 (FR-N) — 출시 후'))
for (const fr of ['FR-R-04', 'FR-R-05', 'FR-R-07']) {
  assert.match(read('prd.md'), new RegExp(`#### ${fr}[^\\n]+출시 후`))
}
const changed = execFileSync('git', ['diff', '--name-only', 'origin/main'], {cwd: repo, encoding: 'utf8'}).trim().split('\n').filter(Boolean)
assert.ok(changed.every((name) => name.startsWith('bodyguard/docs/')))
for (const name of ['operating-rules.md', 'release-plan.md', 'prd.md', 'design.md', 'constitution.md', 'open-questions.md', 'release-readiness-gates.md', 'adr/README.md', 'adr/0019-first-release-core-scope.md', 'stories/first-release-core-scope.md']) {
  for (const match of read(name).matchAll(/\]\(([^)#]+)(?:#[^)]*)?\)/g)) {
    if (!/^[a-z]+:/i.test(match[1])) assert.ok(existsSync(resolve(dirname(resolve(docs, name)), match[1])), `${name}: ${match[1]}`)
  }
}
console.log('Approved release mapping, Q-32, relative links and tracked docs-only diff: PASS. No runtime/SQL/clinical/launch claim.')
