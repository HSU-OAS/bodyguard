#!/opt/homebrew/bin/node
// Guarded test-only launcher: installed dependencies; no installs or registry.
import { spawnSync } from 'node:child_process'
const cwd = process.cwd()
if (!cwd.endsWith('/BODYGUARD-native-auth-playback/bodyguard/frontend')) throw Error('Unexpected test workspace')
const [command, ...args] = process.argv.slice(2)
const steps = command === 'build' && args.length === 0
  ? [['node', ['scripts/prepare-assets.mjs']], ['node_modules/.bin/tsc', ['--noEmit']], ['node_modules/.bin/vite', ['build']]]
  : command === 'exec' && args[0] === 'playwright'
    ? [['node_modules/.bin/playwright', args.slice(1)]] : null
if (!steps) throw Error('Unsupported test command')
for (const [binary, options] of steps) {
  const r = spawnSync(binary, options, {cwd, env:process.env, stdio:'inherit'})
  if (r.status !== 0) process.exit(r.status ?? 1)
}
