// release-plan5 / Q-11 / FR-A-02·03: source evidence, never distribution approval.
import { createHash } from 'node:crypto'
import { constants } from 'node:fs'
import { mkdir, open, readFile, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

export const entries = [
  { name: '@mediapipe/tasks-vision', version: '0.10.17', license: 'Apache-2.0' },
  { name: '@mediapipe/tasks-vision', version: '1.0.1', license: 'Apache-2.0' },
  {
    name: '@react-three/fiber',
    version: '9.8.1',
    license: 'MIT',
    repository: 'pmndrs/react-three-fiber',
    commit: '53ec672ac4a7189711766b87ece18889abbb32d4',
    files: ['LICENSE'],
  },
  {
    name: 'draco3d',
    version: '1.5.7',
    license: 'Apache-2.0',
    repository: 'google/draco',
    commit: '8786740086a9f4d83f44aa83badfbea4dce7a1b5',
    files: ['LICENSE'],
  },
  { name: 'maath', version: '0.10.8', license: 'MIT' },
  {
    name: 'stats-gl',
    version: '2.4.2',
    license: 'MIT',
    repository: 'RenaudRohlinger/stats-gl',
    commit: 'c12b2e391d5a88616e0b30f3c7f0577966426239',
    files: [],
  },
  {
    name: '@biomejs/cli-darwin-arm64',
    version: '2.5.14',
    license: 'MIT OR Apache-2.0',
    repository: 'biomejs/biome',
    commit: 'af4365d2b80177d0e0434c0ed4fd2c9171afc56c',
    files: ['LICENSE-MIT', 'LICENSE-APACHE'],
  },
  {
    name: '@rolldown/binding-darwin-arm64',
    version: '1.2.11',
    license: 'MIT',
    repository: 'rolldown/rolldown',
    commit: '8df421985114ecfaf52cce038d4a5a6ea8c05408',
    files: ['LICENSE'],
    tag: 'v1.2.11',
  },
]
export const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')

async function readEvidence(destination, filename) {
  const handle = await open(
    new URL(filename, pathToFileURL(`${destination}/`)),
    constants.O_RDONLY | constants.O_NOFOLLOW,
  )
  try {
    const stat = await handle.stat()
    if (!stat.isFile() || stat.size > 1048576) throw new Error('invalid evidence file')
    return await handle.readFile()
  } finally {
    await handle.close()
  }
}

export function validateMetadata(entry, value, lock) {
  if (
    value.name !== entry.name ||
    value.version !== entry.version ||
    value.license !== entry.license
  )
    throw new Error('metadata identity/license mismatch')
  const key = `${entry.name}@${entry.version}`.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const matches = [
    ...lock.matchAll(
      new RegExp(
        `^  '?${key}'?:\\n    resolution: \\{integrity: (sha512-[A-Za-z0-9+/=]+)\\}`,
        'gm',
      ),
    ),
  ]
  if (matches.length !== 1 || matches[0][1] !== value.dist?.integrity)
    throw new Error('lock integrity mismatch')
  if (entry.commit && !entry.tag && value.gitHead !== entry.commit)
    throw new Error('registry commit mismatch')
  if (
    entry.repository &&
    value.repository?.url !== `git+https://github.com/${entry.repository}.git` &&
    value.repository?.url !== `https://github.com/${entry.repository}`
  )
    throw new Error('registry repository mismatch')
  return {
    name: value.name,
    version: value.version,
    license: value.license,
    integrity: value.dist.integrity,
    gitHead: value.gitHead ?? null,
    repository: value.repository ?? null,
  }
}

export function validateTag(entry, value) {
  if (
    value.ref !== `refs/tags/${entry.tag}` ||
    value.object?.type !== 'commit' ||
    value.object?.sha !== entry.commit
  )
    throw new Error('official tag commit mismatch')
}

export async function readPublic(url, fetcher = fetch) {
  const parsed = new URL(url)
  if (
    parsed.protocol !== 'https:' ||
    parsed.username ||
    parsed.password ||
    !['registry.npmjs.org', 'raw.githubusercontent.com', 'api.github.com'].includes(parsed.host)
  )
    throw new Error('non-public source rejected')
  const response = await fetcher(url, { redirect: 'error', signal: AbortSignal.timeout(15000) })
  if (!response.ok || response.redirected) throw new Error(`source HTTP ${response.status}`)
  if (!response.body) throw new Error('empty source')
  const reader = response.body.getReader()
  const chunks = []
  let size = 0
  try {
    while (true) {
      const next = await reader.read()
      if (next.done) break
      size += next.value.length
      if (size > 1048576) throw new Error('source exceeds 1 MiB')
      chunks.push(next.value)
    }
  } finally {
    await reader.cancel()
    reader.releaseLock()
  }
  if (!size) throw new Error('empty source')
  return Buffer.concat(chunks)
}

export async function collect(destination) {
  const lock = await readFile(new URL('../frontend/pnpm-lock.yaml', import.meta.url))
  await mkdir(destination) // Exclusive fresh directory; never overwrite prior evidence.
  const proof = {
    schema: 1,
    lockSha256: sha256(lock),
    distributionApproved: false,
    completeArtifactNoticesVerified: false,
    records: [],
    errors: [],
  }
  for (const [index, entry] of entries.entries()) {
    const record = {
      name: entry.name,
      version: entry.version,
      files: [],
      sourceKind: entry.tag
        ? 'official-tag-commit'
        : entry.commit
          ? 'registry-gitHead'
          : 'unresolved',
      upstreamTextRecovered: false,
    }
    const save = async (url, filename) => {
      const bytes = await readPublic(url)
      await writeFile(new URL(filename, pathToFileURL(`${destination}/`)), bytes, { flag: 'wx' })
      record.files.push({ path: filename, url, bytes: bytes.length, sha256: sha256(bytes) })
      return bytes
    }
    try {
      const registry = await save(
        `https://registry.npmjs.org/${encodeURIComponent(entry.name)}/${entry.version}`,
        `${index}-registry.json`,
      )
      record.metadata = validateMetadata(entry, JSON.parse(registry), lock.toString('utf8'))
      if (entry.tag) {
        const tag = await save(
          `https://api.github.com/repos/${entry.repository}/git/ref/tags/${entry.tag}`,
          `${index}-tag.json`,
        )
        validateTag(entry, JSON.parse(tag))
      }
      for (const file of entry.files ?? [])
        await save(
          `https://raw.githubusercontent.com/${entry.repository}/${entry.commit}/${file}`,
          `${index}-${file}.txt`,
        )
      record.upstreamTextRecovered = Boolean(entry.files?.length)
    } catch (error) {
      proof.errors.push({ name: entry.name, version: entry.version, error: String(error) })
    }
    proof.records.push(record)
  }
  await writeFile(
    new URL('proof.json', pathToFileURL(`${destination}/`)),
    `${JSON.stringify(proof, null, 2)}\n`,
    { flag: 'wx' },
  )
  return proof
}

export async function verify(destination) {
  const proof = JSON.parse(await readEvidence(destination, 'proof.json'))
  const lock = await readFile(new URL('../frontend/pnpm-lock.yaml', import.meta.url), 'utf8')
  if (
    proof.schema !== 1 ||
    proof.lockSha256 !== sha256(lock) ||
    proof.distributionApproved !== false ||
    proof.completeArtifactNoticesVerified !== false ||
    proof.errors.length ||
    proof.records.length !== entries.length
  )
    throw new Error('incomplete or mismatched proof')
  for (const [index, entry] of entries.entries()) {
    const record = proof.records[index]
    const expectedNames = [
      `${index}-registry.json`,
      ...(entry.tag ? [`${index}-tag.json`] : []),
      ...(entry.files ?? []).map((file) => `${index}-${file}.txt`),
    ]
    const expectedUrls = [
      `https://registry.npmjs.org/${encodeURIComponent(entry.name)}/${entry.version}`,
      ...(entry.tag
        ? [`https://api.github.com/repos/${entry.repository}/git/ref/tags/${entry.tag}`]
        : []),
      ...(entry.files ?? []).map(
        (file) => `https://raw.githubusercontent.com/${entry.repository}/${entry.commit}/${file}`,
      ),
    ]
    const expectedKind = entry.tag
      ? 'official-tag-commit'
      : entry.commit
        ? 'registry-gitHead'
        : 'unresolved'
    if (
      record.name !== entry.name ||
      record.version !== entry.version ||
      record.sourceKind !== expectedKind ||
      record.upstreamTextRecovered !== Boolean(entry.files?.length) ||
      record.files.length !== expectedNames.length
    )
      throw new Error('record mismatch')
    for (const [fileIndex, file] of record.files.entries()) {
      if (file.path !== expectedNames[fileIndex] || file.url !== expectedUrls[fileIndex])
        throw new Error('unlisted evidence path/source')
      const bytes = await readEvidence(destination, file.path)
      if (!bytes.length || bytes.length !== file.bytes || sha256(bytes) !== file.sha256)
        throw new Error('evidence hash mismatch')
      if (
        fileIndex === 0 &&
        JSON.stringify(validateMetadata(entry, JSON.parse(bytes), lock)) !==
          JSON.stringify(record.metadata)
      )
        throw new Error('record metadata mismatch')
      if (entry.tag && fileIndex === 1) validateTag(entry, JSON.parse(bytes))
    }
  }
  return {
    registryVersionsMatched: 8,
    upstreamVersionTextsRecovered: 4,
    unresolvedVersionTexts: 4,
    distributionApproved: false,
    completeArtifactNoticesVerified: false,
  }
}

export async function publishEvidence(source, destination) {
  await verify(source)
  const proof = JSON.parse(await readEvidence(source, 'proof.json'))
  await mkdir(destination)
  for (const record of proof.records) {
    for (const file of record.files) {
      let bytes = await readEvidence(source, file.path)
      if (file.path.endsWith('-registry.json')) {
        const raw = JSON.parse(bytes)
        file.originalResponse = { bytes: file.bytes, sha256: file.sha256, preservedPrivately: true }
        // Public package authors/account fields are unnecessary for this source proof.
        const selected = {
          name: raw.name,
          version: raw.version,
          license: raw.license,
          gitHead: raw.gitHead ?? null,
          repository: raw.repository ?? null,
          dist: { integrity: raw.dist.integrity },
        }
        bytes = Buffer.from(`${JSON.stringify(selected, null, 2)}\n`)
        file.representation = 'selected-registry-fields'
        file.bytes = bytes.length
        file.sha256 = sha256(bytes)
      }
      await writeFile(new URL(file.path, pathToFileURL(`${destination}/`)), bytes, { flag: 'wx' })
    }
  }
  await writeFile(
    new URL('proof.json', pathToFileURL(`${destination}/`)),
    `${JSON.stringify(proof, null, 2)}\n`,
    { flag: 'wx' },
  )
  return await verify(destination)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const [mode, destination, publishTarget] = process.argv.slice(2)
    if (
      !destination?.startsWith('/') ||
      !['--collect', '--verify', '--publish'].includes(mode) ||
      (mode === '--publish' && !publishTarget?.startsWith('/'))
    )
      throw new Error(
        'usage: --collect|--verify /absolute/evidence-directory OR --publish /absolute/private-source /absolute/new-destination',
      )
    const result =
      mode === '--collect'
        ? await collect(destination)
        : mode === '--publish'
          ? await publishEvidence(destination, publishTarget)
          : await verify(destination)
    console.log(JSON.stringify(result, null, 2))
    if (result.errors?.length) process.exitCode = 1
  } catch (error) {
    console.error(String(error))
    process.exitCode = 1
  }
}
