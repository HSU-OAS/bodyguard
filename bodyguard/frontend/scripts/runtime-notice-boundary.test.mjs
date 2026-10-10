// NFR-08 / Q-11: 실제 filesystem 선별과 source 계약; Docker/NGINX 실행 증거는 아니다.
import assert from 'node:assert/strict'
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { cssNotice } from './check-build-notices.ts'
import { exportWebRuntime } from './export-web-runtime.mjs'

const frontend = fileURLToPath(new URL('../', import.meta.url))
const noticeFiles = ['bundled-js.json', 'bundled-packages.json', 'tailwindcss.txt']
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'bodyguard-notice-export-'))
  const source = join(root, 'dist'),
    target = join(root, 'package')
  for (const directory of ['assets', 'brand', 'licenses'])
    mkdirSync(join(source, directory), { recursive: true })
  writeFileSync(
    join(source, 'index.html'),
    '<script src="/assets/index-a.js"></script><link href="/assets/index-b.css" rel="stylesheet">',
  )
  writeFileSync(join(source, 'assets/index-a.js'), '// Synthetic web fixture')
  writeFileSync(join(source, 'assets/index-b.css'), 'body{color:blue}')
  writeFileSync(
    join(source, 'brand/google-icon.png'),
    readFileSync(join(frontend, 'public/brand/google-icon.png')),
  )
  const metadata = JSON.parse(
    readFileSync(join(frontend, 'node_modules/react/package.json'), 'utf8'),
  )
  const entry = {
    name: metadata.name,
    version: metadata.version,
    identifier: metadata.license,
    text: readFileSync(join(frontend, 'node_modules/react/LICENSE'), 'utf8').trim(),
  }
  writeFileSync(join(source, 'licenses/bundled-js.json'), JSON.stringify([entry]))
  writeFileSync(
    join(source, 'licenses/bundled-packages.json'),
    JSON.stringify([{ name: entry.name, version: entry.version }]),
  )
  writeFileSync(join(source, 'licenses/tailwindcss.txt'), cssNotice(frontend))
  return { root, source, target, entry }
}

test('includes and preserves all generated notice bytes', () => {
  const { source, target } = fixture()
  const files = exportWebRuntime(source, target)
  for (const file of noticeFiles) {
    assert(files.includes(`licenses/${file}`))
    assert.deepEqual(
      readFileSync(join(target, 'licenses', file)),
      readFileSync(join(source, 'licenses', file)),
    )
  }
})

test('Docker context includes only the required notice build helper', () => {
  const ignore = readFileSync(join(frontend, '.dockerignore'), 'utf8').split(/\r?\n/)
  assert(ignore.includes('!scripts/check-build-notices.ts'))
  assert(!ignore.includes('!scripts/**'))
  for (const excluded of [
    'check-build-notices.test.mjs',
    'runtime-notice-boundary.test.mjs',
    'test-runtime-notices-browser.mjs',
  ])
    assert(!ignore.includes(`!scripts/${excluded}`))
})

for (const file of noticeFiles)
  test(`NGINX exact notice path source: ${file}`, () => {
    const nginx = readFileSync(join(frontend, '../deploy/nginx.conf'), 'utf8')
    const type = file.endsWith('.json') ? 'application/json' : 'text/plain'
    assert(
      nginx.includes(`location = /licenses/${file} { default_type ${type}; try_files $uri =404; }`),
    )
  })

for (const file of noticeFiles)
  test(`rejects a notice symlink before output: ${file}`, () => {
    const { source, target, root } = fixture()
    const outside = join(root, 'outside')
    writeFileSync(outside, 'Outside fixture')
    // 별도 정상 source는 보존하며 다른 경로의 고지 symlink를 입력으로 사용한다.
    const selected = join(root, 'linked-dist')
    mkdirSync(selected)
    for (const directory of ['assets', 'brand', 'licenses']) mkdirSync(join(selected, directory))
    for (const item of [
      'index.html',
      'assets/index-a.js',
      'assets/index-b.css',
      'brand/google-icon.png',
    ])
      copyFileSync(join(source, item), join(selected, item))
    for (const item of noticeFiles) {
      if (item === file) symlinkSync(outside, join(selected, 'licenses', item))
      else copyFileSync(join(source, 'licenses', item), join(selected, 'licenses', item))
    }
    assert.throws(() => exportWebRuntime(selected, target), /Non-regular package input/)
    assert(!readdirSync(root).includes('package'))
  })

test('rejects malformed or tampered notice before output', () => {
  const { source, target, root } = fixture()
  writeFileSync(join(source, 'licenses/bundled-js.json'), '[]')
  assert.throws(() => exportWebRuntime(source, target))
  assert(!readdirSync(root).includes('package'))
})

for (const file of noticeFiles)
  test(`rejects missing notice before output: ${file}`, () => {
    const { source, target, root } = fixture()
    const selected = join(root, 'missing-dist')
    for (const directory of ['assets', 'brand', 'licenses'])
      mkdirSync(join(selected, directory), { recursive: true })
    for (const item of [
      'index.html',
      'assets/index-a.js',
      'assets/index-b.css',
      'brand/google-icon.png',
      ...noticeFiles.filter((name) => name !== file).map((name) => `licenses/${name}`),
    ])
      copyFileSync(join(source, item), join(selected, item))
    assert.throws(() => exportWebRuntime(selected, target), /ENOENT/)
    assert(!readdirSync(root).includes('package'))
    assert(readFileSync(join(source, 'licenses', file)).length > 0)
  })

test('rejects unregistered file in notice directory', () => {
  const { source, target, root } = fixture()
  writeFileSync(join(source, 'licenses/unregistered.html'), '<script>synthetic</script>')
  assert.throws(() => exportWebRuntime(source, target))
  assert(!readdirSync(root).includes('package'))
})
