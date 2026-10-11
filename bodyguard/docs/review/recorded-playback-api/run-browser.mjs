// FR-U-04/FR-R-03/NFR-08: execute actual isolated HTTP/SQL/Chrome, preserve raw outputs.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { accessSync, constants, existsSync, realpathSync, statSync, writeFileSync } from 'node:fs'

const [scratch, db, executable] = process.argv.slice(2)
assert(/^\/private\/tmp\/bodyguard-coaching-auth-proof\.[A-Za-z0-9]+$/.test(scratch))
assert(/^\/private\/tmp\/bodyguard-auth-test\.[A-Za-z0-9]+$/.test(db))
for (const path of [scratch, db]) {
  assert.equal(realpathSync(path), path)
  assert.equal(statSync(path).uid, process.getuid())
}
assert(!existsSync(`${scratch}/browser.stdout`))
assert(executable?.startsWith('/') && statSync(executable).isFile())
accessSync(executable, constants.X_OK)
const command = ['run', '--no-sync', 'python', '-m', 'tests.run_browser', 'authcoaching',
  '--config', 'playwright.coaching-record-api.config.ts']
const child = spawn('uv', command, {
  cwd: '../backend',
  env: { ...process.env,
    BODYGUARD_TEST_DATABASE_URL: `postgresql+psycopg://bodyguard_test@/bodyguard_test?host=${db}`,
    BODYGUARD_TEST_COACHING_AUTH_PROBE: `${scratch}/browser-probe`,
    BODYGUARD_TEST_BROWSER_EXECUTABLE: executable,
  },
  stdio: ['ignore', 'pipe', 'pipe'],
})
const stdout = [], stderr = []
child.stdout.on('data', (data) => { stdout.push(data); process.stdout.write(data) })
child.stderr.on('data', (data) => { stderr.push(data); process.stderr.write(data) })
child.once('error', () => { process.exitCode = 1 })
child.once('close', (exit, signal) => {
  writeFileSync(`${scratch}/browser.stdout`, Buffer.concat(stdout), { flag: 'wx' })
  writeFileSync(`${scratch}/browser.stderr`, Buffer.concat(stderr), { flag: 'wx' })
  writeFileSync(`${scratch}/browser-exit.json`, JSON.stringify({ command: ['uv', ...command],
    exit, signal, actualHTTPandSQL: true, mailClockGatesPortsAndFramesSynthetic: true,
  }, null, 2), { flag: 'wx' })
  process.exitCode = exit ?? 1
})
