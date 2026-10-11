// release-plan5/Q-11: pinned source evidence, not installed/binary distribution approval.
import assert from 'node:assert/strict'
import { constants } from 'node:fs'
import { mkdir, open, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  entries,
  readPublic,
  sha256,
  validateMetadata,
  validateTag,
  verify as verifyBase,
} from './license-source-proof.mjs'

const maathCommit = '626d198fbae28ba82f2f1b184db7fcafd4d23846'
const maathTag = '18ea482a52d544b2bd72a3c1142c5b642ecedf01'
// Actual fixed-commit upstream bytes, independent of a replaceable evidence manifest.
const rolldownNoticeHash = 'a877291d800ed43692f3f9ae09d8e01cc6f7293ad39d43896059c188ffbb8b7c'
const base = fileURLToPath(new URL('../docs/review/upstream-license-evidence/', import.meta.url))
const lockPath = fileURLToPath(new URL('../frontend/pnpm-lock.yaml', import.meta.url))
const object = (v) => ({ sha: v.sha, type: v.type })
const registry = (v) => ({
  name: v.name,
  version: v.version,
  license: v.license,
  gitHead: v.gitHead ?? null,
  repository: v.repository ?? null,
  dist: { integrity: v.dist?.integrity },
})
export const requests = [
  ...[4, 5, 7].map((i) => ({
    name: `registry-${i}.json`,
    url: `https://registry.npmjs.org/${encodeURIComponent(entries[i].name)}/${entries[i].version}`,
    select: registry,
  })),
  {
    name: 'maath-ref.json',
    url: 'https://api.github.com/repos/pmndrs/math/git/ref/tags/maath%400.10.8',
    select: (v) => ({ ref: v.ref, object: object(v.object) }),
  },
  {
    name: 'maath-tag.json',
    url: `https://api.github.com/repos/pmndrs/math/git/tags/${maathTag}`,
    select: (v) => ({ sha: v.sha, tag: v.tag, object: object(v.object) }),
  },
  ...[
    ['maath', 'pmndrs/math', maathCommit],
    ['stats', entries[5].repository, entries[5].commit],
  ].flatMap(([id, repository, commit]) => [
    {
      name: `${id}-tree.json`,
      url: `https://api.github.com/repos/${repository}/git/trees/${commit}?recursive=1`,
      select: (v) => ({
        sha: v.sha,
        truncated: v.truncated,
        tree: v.tree.map((x) => ({ path: x.path, sha: x.sha, type: x.type })),
      }),
    },
    {
      name: `${id}-package.json`,
      url: `https://raw.githubusercontent.com/${repository}/${commit}/${id === 'maath' ? 'packages/maath/' : ''}package.json`,
      select: (v) => ({ name: v.name, version: v.version, license: v.license }),
    },
  ]),
  {
    name: 'rolldown-ref.json',
    url: `https://api.github.com/repos/${entries[7].repository}/git/ref/tags/${entries[7].tag}`,
    select: (v) => ({ ref: v.ref, object: object(v.object) }),
  },
  {
    name: 'rolldown-THIRD-PARTY-LICENSE.txt',
    url: `https://raw.githubusercontent.com/${entries[7].repository}/${entries[7].commit}/THIRD-PARTY-LICENSE`,
  },
]
const flags = {
  distributionApproved: false,
  completeArtifactNoticesVerified: false,
  npmArtifactSourceEquivalenceProven: false,
}
export function evaluate(values, lock) {
  for (const i of [4, 5, 7]) validateMetadata(entries[i], values[`registry-${i}.json`], lock)
  assert.deepEqual(values['maath-ref.json'], {
    ref: 'refs/tags/maath@0.10.8',
    object: { type: 'tag', sha: maathTag },
  })
  assert.deepEqual(values['maath-tag.json'], {
    sha: maathTag,
    tag: 'maath@0.10.8',
    object: { type: 'commit', sha: maathCommit },
  })
  assert.deepEqual(values['maath-package.json'], {
    name: 'maath',
    version: '0.10.8',
    license: 'MIT',
  })
  // Actual pinned npm gitHead source differs from the requested package. Never substitute it.
  assert.deepEqual(values['stats-package.json'], {
    name: 'stats-gl',
    version: '2.3.1',
    license: 'MIT',
  })
  validateTag(entries[7], values['rolldown-ref.json'])
  const paths = {}
  for (const id of ['maath', 'stats']) {
    const tree = values[`${id}-tree.json`]
    assert.equal(tree.truncated, false)
    assert(/^[0-9a-f]{40}$/.test(tree.sha))
    assert(Array.isArray(tree.tree) && tree.tree.length > 0)
    const unique = new Set()
    for (const entry of tree.tree) {
      assert(typeof entry.path === 'string' && entry.path.length > 0)
      assert(!entry.path.startsWith('/') && !entry.path.split('/').includes('..'))
      assert(!unique.has(entry.path))
      unique.add(entry.path)
      assert(/^[0-9a-f]{40}$/.test(entry.sha))
      assert(['blob', 'tree', 'commit'].includes(entry.type))
    }
    paths[id] = tree.tree.filter((x) => /license|notice/i.test(x.path)).map((x) => x.path)
    assert.deepEqual(paths[id], [])
  }
  const notice = values['rolldown-THIRD-PARTY-LICENSE.txt']
  assert(Buffer.isBuffer(notice) && notice.length > 0 && notice.length <= 1048576)
  assert.equal(sha256(notice), rolldownNoticeHash)
  assert(
    notice.toString().includes('Copyright (c) 2017') &&
      notice.toString().includes('Copyright (c) 2020 Evan Wallace'),
  )
  return {
    maathTagAndSourcePackageMatched: true,
    statsPinnedSourceVersion: '2.3.1',
    statsRequestedPackageVersion: '2.4.2',
    statsSourceVersionMatchesRequestedPackage: false,
    namedLicenseOrNoticePaths: paths,
    allRepositoryBlobContentsRead: false,
    rolldownSourceCompanionRecovered: true,
    ...flags,
  }
}
async function safeRead(directory, name) {
  const handle = await open(join(directory, name), constants.O_RDONLY | constants.O_NOFOLLOW)
  try {
    const stat = await handle.stat()
    assert(stat.isFile() && stat.size > 0 && stat.size <= 1048576)
    return await handle.readFile()
  } finally {
    await handle.close()
  }
}
export async function collect(privateParent, destination) {
  await verifyBase(base)
  const lock = await readFile(lockPath)
  const baseProof = await readFile(join(base, 'proof.json'))
  assert((await readFile(join(base, '7-LICENSE.txt'), 'utf8')).includes('THIRD-PARTY-LICENSE'))
  await mkdir(join(privateParent, 'raw'))
  await mkdir(destination)
  const proof = {
    schema: 1,
    lockSha256: sha256(lock),
    baseProofSha256: sha256(baseProof),
    ...flags,
    files: [],
    errors: [],
    findings: null,
  }
  const values = {}
  try {
    for (const request of requests) {
      const raw = await readPublic(request.url)
      await writeFile(join(privateParent, 'raw', request.name), raw, { flag: 'wx' })
      const value = request.select ? request.select(JSON.parse(raw)) : raw
      const selected = request.select ? Buffer.from(`${JSON.stringify(value, null, 2)}\n`) : raw
      await writeFile(join(destination, request.name), selected, { flag: 'wx' })
      values[request.name] = value
      proof.files.push({
        path: request.name,
        url: request.url,
        representation: request.select ? 'selected-source-fields' : 'original-bytes',
        bytes: selected.length,
        sha256: sha256(selected),
        originalResponse: { bytes: raw.length, sha256: sha256(raw), preservedPrivately: true },
      })
    }
    proof.findings = evaluate(values, lock.toString('utf8'))
  } catch (error) {
    proof.errors.push({ error: String(error) })
  }
  await writeFile(join(destination, 'proof.json'), `${JSON.stringify(proof, null, 2)}\n`, {
    flag: 'wx',
  })
  return proof
}
export async function verify(destination) {
  await verifyBase(base)
  const lock = await readFile(lockPath)
  const proof = JSON.parse(await safeRead(destination, 'proof.json'))
  assert.equal(proof.schema, 1)
  assert.equal(proof.lockSha256, sha256(lock))
  assert.equal(proof.baseProofSha256, sha256(await readFile(join(base, 'proof.json'))))
  for (const [key, value] of Object.entries(flags)) assert.equal(proof[key], value)
  assert.deepEqual(proof.errors, [])
  assert.equal(proof.files.length, requests.length)
  const values = {}
  for (const [i, request] of requests.entries()) {
    const file = proof.files[i]
    assert.equal(file.path, request.name)
    assert.equal(file.url, request.url)
    assert.equal(file.representation, request.select ? 'selected-source-fields' : 'original-bytes')
    const bytes = await safeRead(destination, request.name)
    assert.equal(file.bytes, bytes.length)
    assert.equal(file.sha256, sha256(bytes))
    assert(file.originalResponse.bytes > 0 && file.originalResponse.bytes <= 1048576)
    assert(/^[0-9a-f]{64}$/.test(file.originalResponse.sha256))
    assert.equal(file.originalResponse.preservedPrivately, true)
    if (!request.select) {
      assert.equal(file.originalResponse.bytes, file.bytes)
      assert.equal(file.originalResponse.sha256, file.sha256)
    }
    values[request.name] = request.select ? JSON.parse(bytes) : bytes
  }
  const findings = evaluate(values, lock.toString('utf8'))
  assert.deepEqual(proof.findings, findings)
  return findings
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [mode, first, second] = process.argv.slice(2)
  try {
    assert(first?.startsWith('/') && ['--collect', '--verify'].includes(mode))
    if (mode === '--collect') assert(second?.startsWith('/'))
    const result = mode === '--collect' ? await collect(first, second) : await verify(first)
    console.log(JSON.stringify(result, null, 2))
    if (result.errors?.length) process.exitCode = 1
  } catch (error) {
    console.error(String(error))
    process.exitCode = 1
  }
}
