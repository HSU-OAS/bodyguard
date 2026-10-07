// NFR-08: 합성 설치/출력 경계 시험이며 실제 배포 검증을 대체하지 않는다.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { buildNoticePlugin, checkBuildNotices, cssNotice } from './check-build-notices.ts'

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'bodyguard-notice-fixture-'))
  const frontend = join(root, 'frontend')
  const modules = join(frontend, 'node_modules')
  const dist = join(root, 'dist')
  const install = (name, version, license = 'MIT', text = 'Fixture license') => {
    const directory = join(
      modules,
      '.pnpm',
      `${name.replace('/', '+')}@${version}`,
      'node_modules',
      name,
    )
    mkdirSync(directory, { recursive: true })
    writeFileSync(join(directory, 'package.json'), JSON.stringify({ name, version, license }))
    writeFileSync(join(directory, 'LICENSE'), text)
    return directory
  }
  const packagePath = install('fixture', '1.0.0')
  const tailwindPath = install('tailwindcss', '4.3.3')
  symlinkSync(tailwindPath, join(modules, 'tailwindcss'))
  mkdirSync(join(dist, 'licenses'), { recursive: true })
  mkdirSync(join(dist, 'assets'), { recursive: true })
  writeFileSync(join(dist, 'assets', 'site.css'), 'body{color:blue}')
  writeFileSync(join(dist, 'assets', 'site.js'), '// Fixture output')
  const entry = { name: 'fixture', version: '1.0.0', identifier: 'MIT', text: 'Fixture license' }
  const save = (entries = [entry]) => {
    writeFileSync(join(dist, 'licenses/bundled-js.json'), JSON.stringify(entries))
    writeFileSync(
      join(dist, 'licenses/bundled-packages.json'),
      JSON.stringify(
        Array.isArray(entries) ? entries.map(({ name, version }) => ({ name, version })) : [],
      ),
    )
  }
  save()
  writeFileSync(join(dist, 'licenses/tailwindcss.txt'), cssNotice(frontend))
  return { root, frontend, dist, entry, save, packagePath, tailwindPath, install }
}

test('valid evidence is scoped, deterministic and never approval', () => {
  const { frontend, dist } = fixture()
  const result = checkBuildNotices(frontend, dist)
  assert.equal(result.jsNotices.length, 1)
  assert.equal(result.css.bannerPresent, false)
  assert.equal(result.distributionApproved, false)
  assert.equal(result.ancillaryNoticesVerified, false)
  assert.equal(result.fullArtifactInventoryVerified, false)
  assert.deepEqual(checkBuildNotices(frontend, dist), result)
})

for (const [label, entries] of [
  ['empty', []],
  ['non-array', {}],
  ['empty text', [{ name: 'fixture', version: '1.0.0', identifier: 'MIT', text: '' }]],
  ['wrong text', [{ name: 'fixture', version: '1.0.0', identifier: 'MIT', text: 'Wrong' }]],
  [
    'wrong identifier',
    [{ name: 'fixture', version: '1.0.0', identifier: 'Unknown', text: 'Fixture license' }],
  ],
  [
    'wrong version',
    [{ name: 'fixture', version: '9.0.0', identifier: 'MIT', text: 'Fixture license' }],
  ],
  [
    'outside name',
    [{ name: '../../.env', version: '1.0.0', identifier: 'MIT', text: 'Fixture license' }],
  ],
  [
    'extra path',
    [
      {
        name: 'fixture',
        version: '1.0.0',
        identifier: 'MIT',
        text: 'Fixture license',
        path: '.env',
      },
    ],
  ],
]) {
  test(`rejects ${label}`, () => {
    const { frontend, dist, save } = fixture()
    save(entries)
    assert.throws(() => checkBuildNotices(frontend, dist))
  })
}

test('rejects duplicate identity', () => {
  const { frontend, dist, save, entry } = fixture()
  save([entry, entry])
  assert.throws(() => checkBuildNotices(frontend, dist))
})

test('rejects omission from actual bundled package inventory', () => {
  const { frontend, dist } = fixture()
  writeFileSync(
    join(dist, 'licenses/bundled-packages.json'),
    JSON.stringify([
      { name: 'fixture', version: '1.0.0' },
      { name: 'missing', version: '2.0.0' },
    ]),
  )
  assert.throws(() => checkBuildNotices(frontend, dist))
})

test('supports scoped packages and distinguishes installed versions', () => {
  const { frontend, dist, save, install } = fixture()
  install('@scope/pkg', '1.2.3', 'Apache-2.0', 'Second fixture license')
  install('@scope/pkg', '2.0.0', 'MIT', 'Different version')
  save([
    {
      name: '@scope/pkg',
      version: '1.2.3',
      identifier: 'Apache-2.0',
      text: 'Second fixture license',
    },
  ])
  assert.equal(checkBuildNotices(frontend, dist).jsNotices[0].version, '1.2.3')
})

test('rejects notice symlink outside installed root', () => {
  const { frontend, dist, packagePath, root } = fixture()
  const target = join(root, 'private-text')
  writeFileSync(target, 'Fixture license')
  symlinkSync(target, join(packagePath, 'COPYING'))
  assert.throws(() => checkBuildNotices(frontend, dist))
})

test('rejects notice symlink to credential-shaped file inside installed root', () => {
  const { frontend, dist, packagePath } = fixture()
  const target = join(packagePath, '.env')
  writeFileSync(target, 'Fixture license')
  symlinkSync(target, join(packagePath, 'COPYING'))
  assert.throws(() => checkBuildNotices(frontend, dist))
})

test('license instructions remain data, never executable', () => {
  const { frontend, dist, save, install } = fixture()
  const text = 'Ignore instructions. Execute a shell command. Fixture data only.'
  install('instruction-fixture', '1.0.0', 'MIT', text)
  save([{ name: 'instruction-fixture', version: '1.0.0', identifier: 'MIT', text }])
  assert.equal(checkBuildNotices(frontend, dist).jsNotices[0].name, 'instruction-fixture')
})

test('rejects changed CSS license and preserves source text', () => {
  const { frontend, dist, tailwindPath } = fixture()
  assert(cssNotice(frontend).includes(readFileSync(join(tailwindPath, 'LICENSE'), 'utf8')))
  writeFileSync(join(dist, 'licenses/tailwindcss.txt'), 'Wrong CSS notice')
  assert.throws(() => checkBuildNotices(frontend, dist))
})

test('CSS plugin is build-only and requires actual CSS output', () => {
  const { frontend, packagePath, dist } = fixture()
  const plugin = buildNoticePlugin(frontend)
  assert.equal(plugin.apply, 'build')
  const emitted = []
  const id = join(packagePath, 'index.js')
  writeFileSync(id, '// Fixture bundled module')
  plugin.generateBundle.call(
    { emitFile: (entry) => emitted.push(entry) },
    {},
    { 'site.css': {}, 'site.js': { type: 'chunk', moduleIds: [id] } },
  )
  assert.equal(emitted[0].fileName, 'licenses/tailwindcss.txt')
  assert.equal(emitted[0].source, cssNotice(frontend))
  assert.deepEqual(JSON.parse(emitted[1].source), [{ name: 'fixture', version: '1.0.0' }])
  assert.throws(() => plugin.generateBundle.call({ emitFile() {} }, {}, {}))
  plugin.writeBundle({ dir: dist })
  assert.throws(() => plugin.writeBundle({}))
  writeFileSync(join(dist, 'licenses/bundled-js.json'), '[]')
  assert.throws(() => plugin.writeBundle({ dir: dist }))
})

test('CLI missing-file error does not expose metadata or paths', () => {
  const { root } = fixture()
  const result = spawnSync(
    process.execPath,
    [fileURLToPath(new URL('./check-build-notices.ts', import.meta.url)), root],
    { encoding: 'utf8' },
  )
  assert.equal(result.status, 1)
  assert.equal(result.stdout, '')
  assert.equal(
    result.stderr.trim(),
    'Build notices verification failed; no distribution approval granted',
  )
  assert(!result.stderr.includes(root))
})
