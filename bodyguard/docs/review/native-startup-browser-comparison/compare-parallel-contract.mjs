// FR-M-01/07/NFR-08: exactly one timing template revision; all other contracts unchanged.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gunzipSync } from 'node:zlib'

const out = dirname(fileURLToPath(import.meta.url)), root = resolve(out, '../../../..')
const ts = createRequire(resolve(root, 'bodyguard/frontend/package.json'))('typescript')
const path = 'bodyguard/frontend/e2e/nativehead.spec.ts'
const historical = '884700e3cebfce2b1c0c51fdca2cce4788e6dc4b'
const oldFile = resolve(out, '../native-neck-full-regression/original-nativehead.spec.ts.gz')
const original = existsSync(oldFile) ? gunzipSync(readFileSync(oldFile)) : execFileSync('git', ['show', historical + ':' + path], { cwd: root })
const current = readFileSync(process.argv[2] ? resolve(process.argv[2]) : resolve(root, path))
const serial = "expect(first('avatar')?.startMs).toBeGreaterThanOrEqual(first('hands-sdk')?.endMs ?? Infinity)"
const parallel = "expect(first('avatar')?.startMs).toBeGreaterThanOrEqual(first('camera')?.endMs ?? Infinity)\n      expect(first('render')?.startMs).toBeGreaterThanOrEqual(first('hands-sdk')?.endMs ?? Infinity)"
assert.equal(original.toString().split(serial).length, 2, 'One original timing template only')
const revisedOriginal = Buffer.from(original.toString().replace(serial, parallel))
const baselineHead = 'be358fd115546d2d32c5e5c29d116add1a28207b'
const baselineFile = resolve(out, 'parallel-preparation/baseline-nativehead.spec.ts.gz')
const baseline = existsSync(baselineFile) ? gunzipSync(readFileSync(baselineFile)) :
  execFileSync('git', ['show', baselineHead + ':' + path], { cwd: root })
function replaceOnce(text, before, after) {
  assert.equal(text.split(before).length, 2, 'Exactly one documented replacement: ' + before)
  return text.replace(before, after)
}
let expected = replaceOnce(baseline.toString(), serial, parallel)
for (const [before, after] of [
  ['expect(final.faceDetectorCloses).toBe(final.cameras)',
    'expect(final.faceDetectorCloses).toBe(withRenderPreparation ? final.faceDetectorInitializations : final.cameras)'],
  ['expect(final.handDetectorCloses).toBe(withHands ? final.cameras : 0)',
    'expect(final.handDetectorCloses).toBe(withRenderPreparation ? final.handDetectorInitializations : withHands ? final.cameras : 0)'],
  ['expect(final.detectorCloses).toBe(final.cameras)',
    'expect(final.detectorCloses).toBe(withRenderPreparation ? final.detectorInitializations : final.cameras)'],
  ['            detectorCloses: 1,\n            faceDetectorCloses: 1,\n            handDetectorCloses: 1,\n', ''],
]) expected = replaceOnce(expected, before, after)
const sha = b => createHash('sha256').update(b).digest('hex')
const printer = ts.createPrinter({ removeComments: true, newLine: ts.NewLineKind.LineFeed })
const flags = { withNeck: true, withFeedback: true, withReference: true, withHands: true, withRenderPreparation: false }
function inspect(bytes) {
  const source = ts.createSourceFile('nativehead.spec.ts', bytes.toString(), ts.ScriptTarget.Latest, true)
  const print = node => printer.printNode(ts.EmitHint.Unspecified, node, source)
  const rows = [], titles = []
  function visit(node) {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'test') {
      assert.equal(node.arguments.length, 2)
      const [title, body] = node.arguments, guards = [], bindings = {}
      let enabled = true
      for (let parent = node.parent; parent; parent = parent.parent) {
        if (ts.isIfStatement(parent)) {
          const guard = print(parent.expression)
          assert(Object.hasOwn(flags, guard), 'Unknown test guard: ' + guard)
          guards.push(guard)
          enabled &&= flags[guard]
        }
        if (ts.isForOfStatement(parent)) {
          const name = parent.initializer.declarations[0].name.text
          let values = parent.expression
          if (ts.isAsExpression(values)) values = values.expression
          assert(ts.isArrayLiteralExpression(values))
          bindings[name] = values.elements.map(value => { assert(ts.isStringLiteral(value)); return value.text })
        }
      }
      const row = { title: print(title), guards: guards.sort(), bindings, bodySha256: sha(print(body)) }
      rows.push(row)
      if (enabled) {
        let variants = [{ }]
        for (const [name, values] of Object.entries(bindings))
          variants = variants.flatMap(variant => values.map(value => ({ ...variant, [name]: value })))
        for (const variant of variants) {
          assert(ts.isTemplateExpression(title))
          let value = title.head.text
          for (const span of title.templateSpans) {
            assert(ts.isIdentifier(span.expression) && Object.hasOwn(variant, span.expression.text))
            value += variant[span.expression.text] + span.literal.text
          }
          titles.push(value)
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return { rows, titles: titles.sort() }
}
const old = inspect(original), revised = inspect(revisedOriginal), next = inspect(current)
assert.equal(next.rows.length, inspect(baseline).rows.length, 'No unreported test addition/removal')
const printFile = bytes => printer.printFile(ts.createSourceFile('nativehead.spec.ts', bytes.toString(), ts.ScriptTarget.Latest, true))
assert.equal(printFile(current), printFile(Buffer.from(expected)), 'Only documented timing + additional renderer cleanup contract changes')
const changed = old.rows.filter(row => revised.rows.find(value => value.title === row.title)?.bodySha256 !== row.bodySha256)
assert.equal(changed.length, 1)
assert.equal(changed[0].title, '`${gender} native first-start stage timing without raw input`')
for (const row of revised.rows) {
  const restored = next.rows.find(value => value.title === row.title)
  assert(restored, 'Missing original test: ' + row.title)
  assert.deepEqual(restored, row, 'Undocumented body/guard/loop change: ' + row.title)
}
assert.equal(old.titles.length, 26)
assert.equal(new Set(old.titles).size, 26)
assert.deepEqual(next.titles, old.titles)
for (const bytes of [original, current]) {
  assert(bytes.toString().includes('expect.poll(async () => (await state(page)).nativeCloses).toBeGreaterThanOrEqual(3)'))
  assert(bytes.toString().includes('test.setTimeout(60_000)'))
}
console.log(JSON.stringify({ historical, baselineHead, baselineSourceSha256: sha(baseline), historicalSourceSha256: sha(original), currentSourceSha256: sha(current), expandedCases: old.titles, templates: next.rows, unchangedBodiesGuardsBindings: false, unchangedCases: 24, revisedTimingCases: 2, revisedAdditionalRendererCases: 4, sharedCleanupUsesActualAcquiredCounts: true, exactDocumentedRevisionOnly: true, timeoutAndPollUnchanged: true, historicalFailureResolved: false }, null, 2))
