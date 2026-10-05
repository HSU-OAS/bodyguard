// NFR-07/08: copy only this worktree's test output; preserve originals and failures.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const output = dirname(fileURLToPath(import.meta.url))
const workspace = realpathSync(resolve(output, '../../../..'))
assert(workspace.endsWith('/BODYGUARD-stage6-web-security'), 'Owned story worktree required')
const source = join(workspace, 'bodyguard/frontend/test-results')
for (const name of readdirSync(source).sort()) {
  if (!/^(security|integration)-20261005T[0-9]+Z$/.test(name)) continue
  const run = join(source, name)
  const destination = join(output, name)
  const existing = existsSync(destination)
  const files = []
  function walk(directory) {
    assert(!lstatSync(directory).isSymbolicLink(), 'No output links')
    for (const entry of readdirSync(directory).sort()) {
      const path = join(directory, entry)
      const stat = lstatSync(path)
      assert(!stat.isSymbolicLink(), 'No output links')
      if (stat.isDirectory()) walk(path)
      else {
        assert(stat.isFile() && stat.size < 2_000_000, 'Bounded regular proof only')
        files.push(path)
        assert(files.length <= 100, 'Bounded proof count')
      }
    }
  }
  walk(run)
  if (!existing) mkdirSync(destination)
  const originals = []
  for (const file of files) {
    const bytes = readFileSync(file)
    const path = relative(run, file)
    originals.push(createHash('sha256').update(bytes).digest('hex') + '  ' + path)
    const target = join(destination, path)
    mkdirSync(dirname(target), { recursive: true })
    // Public copies: replace exact worktree path and normalize Markdown trailing blanks.
    let text = bytes.toString('utf8').replaceAll(workspace, '<workspace>')
    if (path.endsWith('.md')) text = text.replace(/[ \t]+$/gm, '').replace(/\n?$/, '\n')
    const copy = /\.(json|md)$/.test(path) ? Buffer.from(text) : bytes
    if (existsSync(target)) {
      assert(lstatSync(target).isFile() && !lstatSync(target).isSymbolicLink(), 'Regular copied proof')
      assert(readFileSync(target).equals(copy), 'Earlier proof differs; refuse overwrite')
    } else writeFileSync(target, copy, { flag: 'wx' })
  }
  const manifest = join(destination, 'raw-files.sha256')
  const hashes = originals.join('\n') + '\n'
  if (existsSync(manifest)) assert(readFileSync(manifest, 'utf8') === hashes, 'Original proof changed')
  else writeFileSync(manifest, hashes, { flag: 'wx' })
  const report = JSON.parse(readFileSync(join(destination, 'report.json'), 'utf8'))
  console.log(JSON.stringify({ run: name, stats: report.stats, originalFiles: files.length, existingVerified: existing }))
}
const scratch = process.argv[2]
if (scratch) {
  assert(/^\/private\/tmp\/bodyguard-stage6-security\.[A-Za-z0-9]+$/.test(scratch), 'Owned proof scratch only')
  assert(realpathSync(scratch) === scratch, 'No scratch links')
  for (const name of ['browser-first.stdout', 'browser-corrected.stdout', 'browser-accepted.stdout', 'integration-regression.stdout']) {
    const file = join(scratch, name)
    const target = join(output, name)
    if (existsSync(target)) continue
    const stat = lstatSync(file)
    assert(stat.isFile() && !stat.isSymbolicLink() && stat.size < 2_000_000, 'Bounded stdout only')
    const bytes = readFileSync(file)
    writeFileSync(target, bytes.toString('utf8').replaceAll(workspace, '<workspace>'), { flag: 'wx' })
    writeFileSync(target + '.raw.sha256', createHash('sha256').update(bytes).digest('hex') + '  ' + name + '\n', { flag: 'wx' })
  }
}
