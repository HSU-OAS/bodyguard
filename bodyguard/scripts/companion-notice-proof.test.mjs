// Q-11: synthetic corruption is not publisher clarification or distribution approval.
import assert from 'node:assert/strict'
import { copyFile, mkdtemp, readFile, symlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { collect, evaluate, requests, verify } from './companion-notice-proof.mjs'

const source = fileURLToPath(
  new URL('../docs/review/pinned-companion-notices/evidence/', import.meta.url),
)
async function copy() {
  const directory = await mkdtemp('/private/tmp/bodyguard-companion-test.')
  for (const name of ['proof.json', ...requests.map((r) => r.name)])
    await copyFile(join(source, name), join(directory, name))
  return directory
}
test('actual saved source companion verifies offline; source mismatch and release flags remain false', async () => {
  const result = await verify(source)
  assert.equal(result.maathTagAndSourcePackageMatched, true)
  assert.equal(result.statsSourceVersionMatchesRequestedPackage, false)
  assert.equal(result.statsPinnedSourceVersion, '2.3.1')
  assert.equal(result.distributionApproved, false)
  assert.equal(result.completeArtifactNoticesVerified, false)
  assert.equal(result.npmArtifactSourceEquivalenceProven, false)
})
test('synthetic altered registry/tag/source identity or truncated tree is rejected even after rehashing', async () => {
  const lock = await readFile(
    fileURLToPath(new URL('../frontend/pnpm-lock.yaml', import.meta.url)),
    'utf8',
  )
  const values = {}
  for (const request of requests) {
    const bytes = await readFile(join(source, request.name))
    values[request.name] = request.select ? JSON.parse(bytes) : bytes
  }
  for (const mutate of [
    (v) => {
      v['registry-5.json'].gitHead = 'a'.repeat(40)
    },
    (v) => {
      v['registry-4.json'].dist.integrity = 'sha512-other'
    },
    (v) => {
      v['maath-tag.json'].object.sha = 'a'.repeat(40)
    },
    (v) => {
      v['rolldown-ref.json'].object.type = 'tag'
    },
    (v) => {
      v['maath-package.json'].version = '0.10.7'
    },
    (v) => {
      v['stats-package.json'].version = '2.4.2'
    },
    (v) => {
      v['maath-tree.json'].truncated = true
    },
    (v) => {
      v['rolldown-THIRD-PARTY-LICENSE.txt'] = Buffer.from(
        'Copyright (c) 2017\nCopyright (c) 2020 Evan Wallace',
      )
    },
  ]) {
    const changed = structuredClone(values)
    changed['rolldown-THIRD-PARTY-LICENSE.txt'] = values['rolldown-THIRD-PARTY-LICENSE.txt']
    mutate(changed)
    assert.throws(() => evaluate(changed, lock))
  }
})
test('raw notice byte tampering fails; original evidence is unchanged', async () => {
  const directory = await copy()
  await writeFile(join(directory, 'rolldown-THIRD-PARTY-LICENSE.txt'), 'synthetic tamper')
  await assert.rejects(verify(directory))
  await verify(source)
})
test('unlisted source/path, shortened tree and forged approval are not valid receipts', async () => {
  for (const mutate of [
    (p) => {
      p.files[0].path = '../outside'
    },
    (p) => {
      p.files[0].url = 'https://elsewhere.test/license'
    },
    (p) => {
      p.distributionApproved = true
    },
    (p) => {
      p.findings.statsSourceVersionMatchesRequestedPackage = true
    },
    (p) => {
      p.files.pop()
    },
  ]) {
    const directory = await copy(),
      proof = JSON.parse(await readFile(join(directory, 'proof.json')))
    mutate(proof)
    await writeFile(join(directory, 'proof.json'), JSON.stringify(proof))
    await assert.rejects(verify(directory))
  }
})
test('symlink input and existing publication destination are rejected without source writes', async () => {
  const directory = await mkdtemp('/private/tmp/bodyguard-companion-symlink.')
  await symlink(join(source, 'proof.json'), join(directory, 'proof.json'))
  await assert.rejects(verify(directory))
  const privateParent = await mkdtemp('/private/tmp/bodyguard-companion-destination.')
  const before = await readFile(join(source, 'proof.json'))
  await assert.rejects(collect(privateParent, source), /EEXIST/)
  assert.deepEqual(await readFile(join(source, 'proof.json')), before)
})
