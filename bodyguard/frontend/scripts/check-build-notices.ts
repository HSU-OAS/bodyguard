// NFR-08 / Q-11: 실제 JS 고지와 CSS 제작 경로를 대조한다. 법무·배포 승인은 아니다.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Plugin } from 'vite'

const MAX_BYTES = 8 * 1024 * 1024
const MAX_ENTRIES = 1000
const packageName = /^(?:@[a-z0-9_-]+\/)?[a-z0-9][a-z0-9._-]*$/
const packageVersion = /^[0-9][a-zA-Z0-9.+_-]{0,100}$/
const noticeName = /^(license|licence|copying)/i
const hash = (text: string) => createHash('sha256').update(text).digest('hex')
const safeParts = (path: string) =>
  path
    .split(/[\\/]/)
    .every(
      (part) =>
        part &&
        part !== '..' &&
        part !== '.' &&
        (!part.startsWith('.') || part === '.pnpm') &&
        !/^(credentials|secrets|auth\.json)$|\.(pem|key|p12|pfx)$/i.test(part),
    )

function readEvidence(root: string, path: string): string {
  assert(!isAbsolute(path), 'Absolute evidence path rejected')
  assert(safeParts(path), 'Invalid evidence path')
  const resolvedRoot = realpathSync(root)
  const target = realpathSync(join(resolvedRoot, path))
  const contained = relative(resolvedRoot, target)
  assert(
    contained && !contained.startsWith(`..${sep}`) && !isAbsolute(contained),
    'Outside evidence',
  )
  assert(safeParts(contained), 'Sensitive evidence target rejected')
  const stat = statSync(target)
  assert(stat.isFile() && stat.size <= MAX_BYTES, 'Invalid evidence file')
  return readFileSync(target, 'utf8')
}

function validateIdentity(name: unknown, version: unknown): asserts name is string {
  assert(typeof name === 'string' && name.length <= 214 && packageName.test(name), 'Invalid name')
  assert(typeof version === 'string' && packageVersion.test(version), 'Invalid version')
}

function installedEvidence(frontend: string, name: string, version: string) {
  validateIdentity(name, version)
  const modules = realpathSync(join(frontend, 'node_modules'))
  const store = join(modules, '.pnpm')
  const instances = readdirSync(store).filter((item) => !item.startsWith('.'))
  assert(instances.length <= MAX_ENTRIES, 'Too many installed instances')
  const matches: { identifier: string; texts: string[] }[] = []
  for (const instance of instances) {
    const directory = join(store, instance, 'node_modules', name)
    if (!existsSync(join(directory, 'package.json'))) continue
    const prefix = relative(modules, directory)
    const metadata = JSON.parse(readEvidence(modules, join(prefix, 'package.json')))
    if (metadata.name !== name || metadata.version !== version) continue
    assert(typeof metadata.license === 'string', 'Missing installed identifier')
    const paths = readdirSync(directory).filter((item) => noticeName.test(item))
    const texts = paths.map((item) => readEvidence(modules, join(prefix, item)).trim())
    matches.push({ identifier: metadata.license.trim(), texts })
  }
  assert(matches.length > 0, 'Installed version not found')
  return matches
}

function tailwindEvidence(frontend: string) {
  const modules = realpathSync(join(frontend, 'node_modules'))
  const metadata = JSON.parse(readEvidence(modules, 'tailwindcss/package.json'))
  assert(metadata.name === 'tailwindcss', 'Invalid CSS package')
  validateIdentity(metadata.name, metadata.version)
  assert(metadata.license === 'MIT', 'CSS identifier changed; review required')
  const text = readEvidence(modules, 'tailwindcss/LICENSE').trim()
  assert(text, 'Missing CSS license text')
  return { version: metadata.version as string, text }
}

export function cssNotice(frontend: string): string {
  const { version, text } = tailwindEvidence(frontend)
  return `tailwindcss ${version}\nCSS pipeline notice\n\n${text}\n`
}

export function buildNoticePlugin(frontend: string): Plugin {
  return {
    name: 'bodyguard-build-notices',
    apply: 'build',
    generateBundle(_options, bundle) {
      assert(
        Object.keys(bundle).some((path) => path.endsWith('.css')),
        'CSS output missing',
      )
      this.emitFile({
        type: 'asset',
        fileName: 'licenses/tailwindcss.txt',
        source: cssNotice(frontend),
      })
      // 고지의 항목 누락도 비교할 수 있게 실제 chunk의 설치 package 식별자만 남긴다.
      // 절대 module 경로·사용자·환경 변수는 출력하지 않는다.
      const modules = realpathSync(join(frontend, 'node_modules'))
      const packages = new Map<string, { name: string; version: string }>()
      for (const chunk of Object.values(bundle)) {
        if (chunk.type !== 'chunk') continue
        for (const id of chunk.moduleIds) {
          if (id.startsWith('\0') || !id.includes('/node_modules/')) continue
          let directory = dirname(realpathSync(id))
          let found = false
          while (directory.startsWith(`${modules}${sep}`)) {
            const prefix = relative(modules, directory)
            if (existsSync(join(directory, 'package.json'))) {
              const metadata = JSON.parse(readEvidence(modules, join(prefix, 'package.json')))
              if (metadata.name !== undefined) {
                validateIdentity(metadata.name, metadata.version)
                packages.set(`${metadata.name}@${metadata.version}`, {
                  name: metadata.name,
                  version: metadata.version,
                })
                found = true
                break
              }
            }
            directory = dirname(directory)
          }
          assert(found, 'Bundled package metadata missing')
        }
      }
      assert(packages.size > 0 && packages.size <= MAX_ENTRIES, 'Bundled package inventory missing')
      this.emitFile({
        type: 'asset',
        fileName: 'licenses/bundled-packages.json',
        source: `${JSON.stringify(
          [...packages.values()].sort(
            (a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version),
          ),
          null,
          2,
        )}\n`,
      })
    },
    writeBundle(options) {
      assert(options.dir, 'Build output directory missing')
      checkBuildNotices(frontend, resolve(frontend, options.dir))
    },
  }
}

export function checkBuildNotices(frontend: string, dist: string) {
  const entries: unknown = JSON.parse(readEvidence(dist, 'licenses/bundled-js.json'))
  assert(
    Array.isArray(entries) && entries.length > 0 && entries.length <= MAX_ENTRIES,
    'Empty notices',
  )
  const identities = new Set<string>()
  const verified = []
  for (const entry of entries) {
    assert(entry && typeof entry === 'object' && !Array.isArray(entry), 'Invalid entry')
    assert(
      Object.keys(entry).sort().join(',') === 'identifier,name,text,version',
      'Invalid entry fields',
    )
    validateIdentity(entry.name, entry.version)
    const identity = `${entry.name}@${entry.version}`
    assert(!identities.has(identity), 'Duplicate notice')
    identities.add(identity)
    assert(typeof entry.identifier === 'string' && entry.identifier.trim(), 'Empty identifier')
    assert(typeof entry.text === 'string' && entry.text.trim(), 'Empty license text')
    const matches = installedEvidence(frontend, entry.name, entry.version)
    assert(
      matches.some(
        (item) => item.identifier === entry.identifier && item.texts.includes(entry.text),
      ),
      'License does not match installed evidence',
    )
    verified.push({
      name: entry.name,
      version: entry.version,
      identifier: entry.identifier,
      textSHA256: hash(entry.text),
    })
  }
  const packages: unknown = JSON.parse(readEvidence(dist, 'licenses/bundled-packages.json'))
  assert(
    Array.isArray(packages) && packages.length > 0 && packages.length <= MAX_ENTRIES,
    'Empty package inventory',
  )
  const expected = new Set<string>()
  for (const entry of packages) {
    assert(entry && typeof entry === 'object' && !Array.isArray(entry), 'Invalid package entry')
    assert(Object.keys(entry).sort().join(',') === 'name,version', 'Invalid package fields')
    validateIdentity(entry.name, entry.version)
    const identity = `${entry.name}@${entry.version}`
    assert(!expected.has(identity), 'Duplicate package entry')
    expected.add(identity)
  }
  assert.deepEqual(
    [...identities].sort(),
    [...expected].sort(),
    'Bundled package notice missing or extra',
  )
  const allAssets = readdirSync(join(dist, 'assets'))
  const javascript = allAssets.filter((path) => path.endsWith('.js'))
  assert(javascript.length > 0, 'JS output missing')
  for (const path of javascript)
    assert(readEvidence(dist, join('assets', path)).trim(), 'Empty JS output')
  const assets = allAssets.filter((path) => path.endsWith('.css'))
  assert(assets.length > 0, 'CSS output missing')
  const css = assets.map((path) => readEvidence(dist, join('assets', path)))
  const expectedCSS = cssNotice(frontend)
  assert(readEvidence(dist, 'licenses/tailwindcss.txt') === expectedCSS, 'CSS notice mismatch')
  return {
    jsNotices: verified,
    css: {
      package: 'tailwindcss',
      version: tailwindEvidence(frontend).version,
      noticeSHA256: hash(expectedCSS),
      bannerPresent: css.some((text) => /tailwindcss v[0-9]/.test(text)),
    },
    scope: 'Vite bundled-JS root license files and configured Tailwind CSS pipeline only',
    fullArtifactInventoryVerified: false,
    ancillaryNoticesVerified: false,
    distributionApproved: false,
  }
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  try {
    const frontend = fileURLToPath(new URL('../', import.meta.url))
    const dist = process.argv[2] ? resolve(process.argv[2]) : join(frontend, 'dist')
    console.log(JSON.stringify(checkBuildNotices(frontend, dist), null, 2))
  } catch {
    // metadata·오류의 경로/원문/인증 값을 로그에 넣지 않는다.
    console.error('Build notices verification failed; no distribution approval granted')
    process.exitCode = 1
  }
}
