// FR-U-04/NFR-08: export current published web only; preserve all original/dev evidence.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import {
  constants,
  copyFileSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
} from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { checkProductionScripts } from './check-selection-production.mjs'

const iconHash = '2bc2ae8e4c67de66d74bf1deed12cd8f22981270266a487576b671b0b4df361c'

function regular(path, directory = false) {
  const stat = lstatSync(path)
  assert(
    !stat.isSymbolicLink() && (directory ? stat.isDirectory() : stat.isFile()),
    'Non-regular package input',
  )
}

export function exportWebRuntime(source, target) {
  const input = resolve(source)
  const output = resolve(target)
  assert(
    input !== output &&
      !output.startsWith(`${input}${sep}`) &&
      !input.startsWith(`${output}${sep}`),
    'Input/output must be separate',
  )
  assert(!lstatSync(output, { throwIfNoEntry: false }), 'Package destination already exists')
  regular(input, true)
  let ancestor = dirname(output)
  while (!lstatSync(ancestor, { throwIfNoEntry: false })) ancestor = dirname(ancestor)
  const canonicalInput = realpathSync(input)
  const canonicalOutput = resolve(realpathSync(ancestor), relative(ancestor, output))
  assert(
    canonicalInput !== canonicalOutput &&
      !canonicalOutput.startsWith(`${canonicalInput}${sep}`) &&
      !canonicalInput.startsWith(`${canonicalOutput}${sep}`),
    'Input/output must be separate',
  )
  regular(join(input, 'index.html'))
  regular(join(input, 'assets'), true)
  regular(join(input, 'brand'), true)
  regular(join(input, 'brand/google-icon.png'))
  const files = ['index.html', 'brand/google-icon.png']
  for (const entry of readdirSync(join(input, 'assets'), { withFileTypes: true })) {
    assert(
      entry.isFile() && /^[A-Za-z0-9_-]+\.(?:js|css)$/.test(entry.name),
      'Unapproved build asset',
    )
    files.push(`assets/${entry.name}`)
  }
  const html = readFileSync(join(input, 'index.html'), 'utf8')
  const refs = [...html.matchAll(/(?:src|href)\s*=\s*["']([^"']+)["']/g)].map((match) => match[1])
  assert(
    refs.some((ref) => ref.endsWith('.js')) && refs.some((ref) => ref.endsWith('.css')),
    'Incomplete web entry',
  )
  for (const ref of refs) {
    assert(
      /^\/assets\/[A-Za-z0-9_-]+\.(?:js|css)$/.test(ref) && files.includes(ref.slice(1)),
      'Unapproved web entry reference',
    )
  }
  assert(
    createHash('sha256')
      .update(readFileSync(join(input, 'brand/google-icon.png')))
      .digest('hex') === iconHash,
    'Google brand source changed',
  )
  checkProductionScripts(join(input, 'assets'))
  // Validation finishes before output exists. Exclusive copies never replace user artifacts.
  mkdirSync(dirname(output), { recursive: true })
  mkdirSync(output)
  mkdirSync(join(output, 'assets'))
  mkdirSync(join(output, 'brand'))
  for (const relative of files) {
    copyFileSync(join(input, relative), join(output, relative), constants.COPYFILE_EXCL)
  }
  return files.sort()
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  assert(
    process.argv.length <= 3,
    'Usage: node scripts/export-web-runtime.mjs [new-output-directory]',
  )
  const root = fileURLToPath(new URL('../', import.meta.url))
  const files = exportWebRuntime(
    join(root, 'dist'),
    process.argv[2] ?? join(root, 'build/web-runtime'),
  )
  console.log(JSON.stringify({ exportedFiles: files }))
}
