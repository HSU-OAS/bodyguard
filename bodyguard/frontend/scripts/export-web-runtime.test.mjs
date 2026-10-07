// FR-U-04/NFR-08: actual filesystem boundary; not Docker/HTTPS/runtime evidence.
import assert from 'node:assert/strict'
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { cssNotice } from './check-build-notices.ts'
import { exportWebRuntime } from './export-web-runtime.mjs'

function fixture(t) {
  const owned = mkdtempSync(join(tmpdir(), 'bodyguard-web-export-'))
  t.after(() => rmSync(owned, { recursive: true }))
  const source = join(owned, 'dist')
  const target = join(owned, 'package')
  mkdirSync(join(source, 'assets'), { recursive: true })
  mkdirSync(join(source, 'brand'))
  mkdirSync(join(source, 'licenses'))
  writeFileSync(
    join(source, 'index.html'),
    '<script type="module" src="/assets/index-abc.js"></script><link rel="stylesheet" href="/assets/index-def.css">',
  )
  writeFileSync(join(source, 'assets/index-abc.js'), 'console.log("synthetic web")')
  writeFileSync(join(source, 'assets/index-def.css'), 'body { background: white; }')
  writeFileSync(
    join(source, 'brand/google-icon.png'),
    readFileSync(new URL('../public/brand/google-icon.png', import.meta.url)),
  )
  // 합성 JS fixture에 현재 설치 고지 원문만 사용한다. 실제 bundle 증거는 아니다.
  const metadata = JSON.parse(
    readFileSync(new URL('../node_modules/react/package.json', import.meta.url), 'utf8'),
  )
  const entry = {
    name: metadata.name,
    version: metadata.version,
    identifier: metadata.license,
    text: readFileSync(new URL('../node_modules/react/LICENSE', import.meta.url), 'utf8').trim(),
  }
  writeFileSync(join(source, 'licenses/bundled-js.json'), JSON.stringify([entry]))
  writeFileSync(
    join(source, 'licenses/bundled-packages.json'),
    JSON.stringify([{ name: entry.name, version: entry.version }]),
  )
  writeFileSync(
    join(source, 'licenses/tailwindcss.txt'),
    cssNotice(fileURLToPath(new URL('../', import.meta.url))),
  )
  return { owned, source, target }
}

test('exports only current web files and preserves unselected source evidence', (t) => {
  const { source, target } = fixture(t)
  mkdirSync(join(source, 'models'))
  writeFileSync(join(source, 'models/prototype.glb'), 'preserved synthetic prototype')
  writeFileSync(join(source, 'private.env'), 'synthetic-never-a-secret')
  const expected = [
    'assets/index-abc.js',
    'assets/index-def.css',
    'brand/google-icon.png',
    'index.html',
    'licenses/bundled-js.json',
    'licenses/bundled-packages.json',
    'licenses/tailwindcss.txt',
  ]
  assert.deepEqual(exportWebRuntime(source, target), expected)
  assert.deepEqual(
    readdirSync(target, { recursive: true })
      .filter((name) => name.includes('.'))
      .sort(),
    expected,
  )
  for (const file of expected)
    assert.deepEqual(readFileSync(join(target, file)), readFileSync(join(source, file)))
  assert.equal(
    readFileSync(join(source, 'models/prototype.glb'), 'utf8'),
    'preserved synthetic prototype',
  )
  assert.equal(readFileSync(join(source, 'private.env'), 'utf8'), 'synthetic-never-a-secret')
})

test('never overwrites an existing destination', (t) => {
  const { source, target } = fixture(t)
  mkdirSync(target)
  writeFileSync(join(target, 'kept.txt'), 'keep existing artifact')
  assert.throws(() => exportWebRuntime(source, target))
  assert.equal(readFileSync(join(target, 'kept.txt'), 'utf8'), 'keep existing artifact')
  assert.deepEqual(readdirSync(target), ['kept.txt'])
})

for (const relative of ['index.html', 'assets/index-abc.js', 'brand/google-icon.png']) {
  test(`rejects a symlink before creating output: ${relative}`, (t) => {
    const { owned, source, target } = fixture(t)
    const outside = join(owned, 'outside')
    writeFileSync(outside, 'do not export this')
    rmSync(join(source, relative))
    symlinkSync(outside, join(source, relative))
    assert.throws(() => exportWebRuntime(source, target))
    assert(!readdirSync(owned).includes('package'))
  })
}

for (const file of ['prototype.glb', 'private.json', 'index.js.map']) {
  test(`rejects unknown asset type: ${file}`, (t) => {
    const { owned, source, target } = fixture(t)
    writeFileSync(join(source, 'assets', file), 'synthetic disallowed asset')
    assert.throws(() => exportWebRuntime(source, target))
    assert(!readdirSync(owned).includes('package'))
  })
}

for (const ref of ['/assets/missing.js', '../private.js', 'https://example.invalid/external.js']) {
  test(`rejects missing or external index reference: ${ref}`, (t) => {
    const { owned, source, target } = fixture(t)
    writeFileSync(
      join(source, 'index.html'),
      `<script src="${ref}"></script><link href="/assets/index-def.css" rel="stylesheet">`,
    )
    assert.throws(() => exportWebRuntime(source, target), /Unapproved web entry reference/)
    assert(!readdirSync(owned).includes('package'))
  })
}

test('rejects unvalidated coaching code in the supplied build', (t) => {
  const { owned, source, target } = fixture(t)
  writeFileSync(join(source, 'assets/index-abc.js'), 'console.log("fixture-not-release")')
  assert.throws(() => exportWebRuntime(source, target))
  assert(!readdirSync(owned).includes('package'))
})

// FR-V-03/NFR-08: main's newer private producers stay excluded after package integration.
for (const token of [
  '/dev/measure',
  '/dev/avatar',
  'Invalid observation scheduler',
  'probeObservationLoop',
  'Invalid coaching result',
  'prepareResultProbe',
  'Unable to capture coaching account',
  'prepareOwnerProbe',
  'Invalid recorded coaching session',
  'prepareRecordedProbe',
  'mountAuthCoachingProbe',
  'Invalid minute aggregation',
  'Invalid owned minute upload',
  'prepareMinuteUploadProbe',
  'PRIVATE_RAW_FAILURE',
]) {
  test(`rejects integrated private producer before output exists: ${token}`, (t) => {
    const { owned, source, target } = fixture(t)
    const body = `console.log(${JSON.stringify(token)})`
    writeFileSync(join(source, 'assets/index-abc.js'), body)
    assert.throws(() => exportWebRuntime(source, target), /Development candidate leaked/)
    assert(!readdirSync(owned).includes('package'))
    assert.equal(readFileSync(join(source, 'assets/index-abc.js'), 'utf8'), body)
  })
}

test('rejects a substituted brand image before output exists', (t) => {
  const { owned, source, target } = fixture(t)
  writeFileSync(join(source, 'brand/google-icon.png'), 'not the approved brand source')
  assert.throws(() => exportWebRuntime(source, target), /Google brand source changed/)
  assert(!readdirSync(owned).includes('package'))
})

for (const directory of ['assets', 'brand']) {
  test(`rejects a directory symlink: ${directory}`, (t) => {
    const { owned, source, target } = fixture(t)
    const outside = join(owned, 'outside')
    mkdirSync(outside)
    rmSync(join(source, directory), { recursive: true })
    symlinkSync(outside, join(source, directory))
    assert.throws(() => exportWebRuntime(source, target), /Non-regular package input/)
    assert(!readdirSync(owned).includes('package'))
  })
}

test('rejects output nested inside input without changing it', (t) => {
  const { source } = fixture(t)
  assert.throws(
    () => exportWebRuntime(source, join(source, 'package')),
    /Input\/output must be separate/,
  )
  assert(!readdirSync(source).includes('package'))
})

test('rejects nesting through a parent directory alias', (t) => {
  const { owned, source } = fixture(t)
  const alias = join(owned, 'alias')
  symlinkSync(source, alias)
  assert.throws(
    () => exportWebRuntime(source, join(alias, 'package')),
    /Input\/output must be separate/,
  )
  assert(!readdirSync(source).includes('package'))
})

test('preserves a dangling destination symlink', (t) => {
  const { owned, source, target } = fixture(t)
  symlinkSync(join(owned, 'missing'), target)
  assert.throws(() => exportWebRuntime(source, target), /Package destination already exists/)
  assert(readdirSync(owned).includes('package'))
})
