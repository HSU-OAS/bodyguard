import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
const [label, cwd, command, ...args] = process.argv.slice(2)
if (!/^[a-z][a-z0-9-]*$/.test(label) || !cwd || !command) throw new Error('Invalid run')
const root = new URL('.', import.meta.url).pathname
const path = join(root, label + '.json')
if (existsSync(path)) throw new Error('Evidence exists')
const start = Date.now()
const child = spawn(command, args, { cwd, env: process.env, stdio: ['ignore','pipe','pipe'] })
let stdout='', stderr=''
child.stdout.on('data', b => { stdout+=b; process.stdout.write(b) })
child.stderr.on('data', b => { stderr+=b; process.stderr.write(b) })
child.on('error', e => { stderr+=e.name })
child.on('close', code => {
  const source = ['src/avatar/headOrientationRig.ts','src/avatar/headOrientationRig.test.ts','e2e/fixtures/headOrientationProbe.ts','scripts/test-head-orientation-browser.mjs']
  const sha = Object.fromEntries(source.map(p => { const f=join(cwd,p); return [p, existsSync(f) ? createHash('sha256').update(readFileSync(f)).digest('hex'): null] }))
  writeFileSync(path, JSON.stringify({label,cwd,command,args,exit:code,elapsedMs:Date.now()-start,stdout,stderr,source:sha},null,2), {flag:'wx'})
  process.exitCode=code ?? 1
})
