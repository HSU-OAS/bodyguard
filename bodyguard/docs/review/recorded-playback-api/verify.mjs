// FR-U-04/FR-R-03/NFR-08: actual gates, raw failures and isolated ownership receipts.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { constants, copyFileSync, existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { gzipSync, gunzipSync } from 'node:zlib'

const [first, final, priorProduct, finalReport, gateRun] = process.argv.slice(2)
assert(/^[a-z][a-z0-9-]*$/.test(gateRun))
assert(/^test-results\/authcoaching-[0-9]{8}T[0-9]+Z$/.test(finalReport))
for (const path of [first, final]) assert(/^\/private\/tmp\/bodyguard-coaching-auth-proof\.[A-Za-z0-9]+$/.test(path))
assert(/^\/private\/tmp\/bodyguard-camera-preparation\.[A-Za-z0-9]+$/.test(priorProduct))
const root = resolve('../docs/review/recorded-playback-api'), hash = (data) => createHash('sha256').update(data).digest('hex')
const artifacts = []
function preserve(name, data) {
  const target = `${root}/${name}.gz`, compressed = gzipSync(data)
  if (existsSync(target)) assert(readFileSync(target).equals(compressed))
  else writeFileSync(target, compressed, { flag: 'wx' })
  assert(gunzipSync(readFileSync(target)).equals(data))
  artifacts.push({ name, bytes: data.length, sha256: hash(data) })
}
preserve('first-verifier.mjs', gunzipSync(readFileSync(`${root}/first-verifier.mjs.gz`)))
preserve('second-verifier.mjs', gunzipSync(readFileSync(`${root}/second-verifier.mjs.gz`)))
const firstReport = 'test-results/authcoaching-20261011T093853317269Z'
const secondReport = 'test-results/authcoaching-20261011T094130814440Z'
const second = '/private/tmp/bodyguard-coaching-auth-proof.GpKFi3'
for (const [name, path] of [['browser-first-report.json', `${firstReport}/report.json`], ['browser-final-report.json', `${secondReport}/report.json`], ['browser-third-report.json', `${finalReport}/report.json`]]) preserve(name, readFileSync(path))
for (const [prefix, path] of [['first', first], ['final', second], ['third', final]]) {
  for (const name of ['browser.stdout', 'browser.stderr', 'browser-exit.json', 'db-init.log', 'db-start.log', 'db-create.log', 'db-identity.log', 'db-stop.log', 'db-stop-receipt.json']) preserve(`${prefix}-${name}`, readFileSync(`${path}/${name}`))
  const stop = JSON.parse(readFileSync(`${path}/db-stop-receipt.json`))
  assert.equal(stop.exit, 0); assert.equal(stop.dataPreserved, true)
}
for (const name of ['first-authcoaching.spec.ts', 'first-authCoachingProbe.ts', 'first-run_browser.py', 'first-run-browser.mjs', 'first-serve-recorded-api-proof.mjs', 'first-playwright-config.ts']) preserve(name, gunzipSync(readFileSync(`${first}/${name}.gz`)))
for (const path of readdirSync(firstReport, { recursive: true }).filter((p) => p.endsWith('error-context.md'))) preserve(`first-${path.replaceAll('/', '-')}`, readFileSync(`${firstReport}/${path}`))
const firstBrowser = JSON.parse(readFileSync(`${firstReport}/report.json`)), finalBrowser = JSON.parse(readFileSync(`${finalReport}/report.json`))
assert.equal(firstBrowser.stats.expected, 6); assert.equal(firstBrowser.stats.unexpected, 2)
assert.equal(finalBrowser.stats.expected, 8); assert.equal(finalBrowser.stats.unexpected, 0)
assert.equal(finalBrowser.stats.skipped, 0); assert.equal(finalBrowser.stats.flaky, 0); assert.equal(finalBrowser.errors.length, 0)
assert.equal(JSON.parse(readFileSync(`${final}/browser-exit.json`)).exit, 0)
preserve('unit-full.json', readFileSync(`${second}/unit-full.json`))
const full = JSON.parse(readFileSync(`${second}/unit-full.json`))
assert.equal(full.success, true); assert.equal(full.numFailedTests, 0); assert.equal(full.numPendingTests, 0)
const source = [
  'e2e/authcoaching.spec.ts', 'e2e/fixtures/authCoachingProbe.ts', 'e2e/fixtures/authCoaching.vite.ts',
  'playwright.coaching-record-api.config.ts', 'scripts/serve-recorded-api-proof.mjs',
  '../backend/tests/run_browser.py', '../backend/app/records.py', '../backend/app/main.py', '../backend/tests/conftest.py',
  'src/auth.tsx', 'src/coaching/useRecordedPlayback.ts', 'src/coaching/useRecordedCoaching.ts',
  'src/coaching/recordedSession.ts', 'src/coaching/recordOwner.ts', 'src/coaching/resultRecord.ts',
  'scripts/check-selection-production.mjs', '../docs/review/recorded-playback-api/run-browser.mjs',
].map((file) => { const data = readFileSync(file); preserve(`verified-source-${file.replaceAll('../', 'parent-').replaceAll('/', '-')}`, data); return { file, sha256: hash(data) } })
const commands = []
function run(name, command, args, expected = 0, cwd) {
  const r = spawnSync(command, args, { encoding: 'utf8', timeout: 90000, cwd })
  preserve(`${gateRun}-${name}.stdout`, Buffer.from(r.stdout ?? '')); preserve(`${gateRun}-${name}.stderr`, Buffer.from(r.stderr ?? ''))
  commands.push({ name, command, args: args.map((a) => a.length > 512 ? { length: a.length, sha256: hash(a) } : a), exit: r.status, expected, signal: r.signal })
  assert.equal(r.status, expected, `${name} exit mismatch`)
  return r
}
run('typecheck', 'pnpm', ['exec', 'tsc', '--noEmit'])
run('scope-biome', 'pnpm', ['exec', 'biome', 'check', 'e2e/authcoaching.spec.ts', 'e2e/fixtures/authCoachingProbe.ts', 'playwright.coaching-record-api.config.ts', 'scripts/serve-recorded-api-proof.mjs'])
// Use the installed locked venv; uv's user cache is outside the file sandbox.
run('harness-ruff', '.venv/bin/ruff', ['check', 'tests/run_browser.py'], 0, '../backend')
run('harness-format', '.venv/bin/ruff', ['format', '--check', 'tests/run_browser.py'], 0, '../backend')
run('backend-mypy', '.venv/bin/mypy', ['app'], 0, '../backend')
const rejected = run('harness-negative-config', '.venv/bin/python', ['-m', 'tests.run_browser', 'records', '--config', 'playwright.coaching-record-api.config.ts'], 2, '../backend')
assert(rejected.stderr.includes('The isolated coaching configuration requires the authcoaching suite'))
run('node-harness-syntax', process.execPath, ['--check', '../docs/review/recorded-playback-api/run-browser.mjs'])
run('node-serve-syntax', process.execPath, ['--check', 'scripts/serve-recorded-api-proof.mjs'])
const product = `${final}/product`
let guard = readFileSync('scripts/check-selection-production.mjs', 'utf8')
const oldRoot = "const root = fileURLToPath(new URL('../dist/assets/', import.meta.url))"
assert.equal(guard.split(oldRoot).length, 2)
guard = guard.replace(oldRoot, `const root = ${JSON.stringify(`${product}/assets`)}`)
run('private-guard', process.execPath, ['--input-type=module', '-e', guard])
for (const [name, port] of [['api', '8000'], ['preview', '4173']]) {
  const closed = run(`${name}-closed`, 'lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN'], 1)
  assert.equal(closed.stdout, ''); assert.equal(closed.stderr, '')
}
for (const [prefix, db] of [['first', '/private/tmp/bodyguard-auth-test.4sNp6Z'], ['second', '/private/tmp/bodyguard-auth-test.F5dUvm'], ['third', '/private/tmp/bodyguard-auth-test.V8nhgp']]) {
  const closed = run(`${prefix}-db-status`, '/opt/homebrew/opt/postgresql@18/bin/pg_ctl', ['-D', `${db}/data`, 'status'], 3)
  assert(closed.stdout.includes('no server running')); assert.equal(closed.stderr, '')
}
run('diff-check', 'git', ['diff', '--check'])
const publicAssets = readdirSync(`${product}/assets`).filter((n) => /\.(js|css)$/.test(n)).map((name) => {
  const data = readFileSync(`${product}/assets/${name}`), ext = name.endsWith('.js') ? '.js' : '.css'
  const old = readdirSync(`${priorProduct}/product/assets`).filter((n) => n.endsWith(ext)); assert.equal(old.length, 1)
  assert(data.equals(readFileSync(`${priorProduct}/product/assets/${old[0]}`)))
  return { name, bytes: data.length, sha256: hash(data), byteIdenticalToPR134: true }
})
assert.equal(publicAssets.length, 2)
for (const [name, build] of [['second-public.css', `${second}/product`], ['pr134-public.css', `${priorProduct}/product`]]) {
  const css = readdirSync(`${build}/assets`).filter((n) => n.endsWith('.css'))
  assert.equal(css.length, 1); preserve(name, readFileSync(`${build}/assets/${css[0]}`))
}
assert(!readdirSync(product, { recursive: true }).some((p) => p.endsWith('.glb')))
const html = readFileSync(`${product}/index.html`, 'utf8').replaceAll('&#39;', "'")
assert(html.includes("connect-src 'self'")); assert(!html.includes("'unsafe-eval'"))
JSON.parse(readFileSync(`${product}/licenses/bundled-js.json`)); JSON.parse(readFileSync(`${product}/licenses/bundled-packages.json`))
assert(readFileSync(`${product}/licenses/tailwindcss.txt`).length > 100)
const screenshots = readdirSync(finalReport, { recursive: true }).filter((p) => p.endsWith('auth-coaching-record.png'))
assert.equal(screenshots.length, 1)
const png = `${root}/record-detail.png`, input = `${finalReport}/${screenshots[0]}`
if (existsSync(png)) assert(readFileSync(png).equals(readFileSync(input)))
else copyFileSync(input, png, constants.COPYFILE_EXCL)
// Include unsuccessful verifier logs without overwriting their original bytes.
for (const name of readdirSync(root).filter((n) => n.endsWith('.gz')).sort()) {
  const stem = name.slice(0, -3)
  if (!artifacts.some((a) => a.name === stem)) preserve(stem, gunzipSync(readFileSync(`${root}/${name}`)))
}
writeFileSync(`${root}/verification.json`, JSON.stringify({ baseMain: '67c18dde067c10fb8188a92839239ce06d14af7b', source,
  sourceHashKind: 'post-execution source snapshots, not a pre/post browser-run hash receipt', gateRun, artifacts, commands, publicAssets,
  checks: { fullPassed: full.numPassedTests, fullFiles: full.testResults.length, failed: 0, skipped: 0,
    actualBrowserAPIandSQLCases: 8, actualBrowserDurationMs: finalBrowser.stats.duration,
    originalBrowserPassed: 6, originalBrowserFailed: 2, correctedSecondBrowserPassed: 8,
    ownedDBsStoppedDataPreserved: true, cspNoticesAndNoGLB: true },
  screenshotSHA256: hash(readFileSync(png)),
  preservedFailures: ['H06 expected outer playback close at engine completion; resource ports had already disposed, outer lifecycle closes on unmount',
    'H07 expected closed instead of the existing failed/session-expired record state; actual server rejected old proof; no policy change',
    'First verifier stopped at uv cache permission denial (exit 2); raw logs and verifier preserved; final gates use the installed locked venv',
    'Second verifier rejected a 27-byte unused CSS rule generated from a test-config comment; original CSS/verifier/gate logs preserved; comment removed and actual browser rerun in a new owned DB'],
  notProven: ['native SDK/physical webcam/person/3D/clinical classifier or eligible motion', 'real Gmail/Google/Docker/HTTPS/deployment/whole1-6', 'original startup P2 or old native timeout resolution', 'whole backend pytest suite or default browser config in this Story'],
}, null, 2), { flag: 'wx' })
console.log(JSON.stringify({ artifacts: artifacts.length, source: source.length, actualCommands: commands.length, browserAPIandSQLCases: 8, publicByteIdentical: true }))
