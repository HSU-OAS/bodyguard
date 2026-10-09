// FR-M-07/NFR-08: compare original test bodies, guards and expanded titles, not clinical proof.
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
const oldFile = resolve(out, 'original-nativehead.spec.ts.gz')
const original = existsSync(oldFile) ? gunzipSync(readFileSync(oldFile)) : execFileSync('git', ['show', historical + ':' + path], { cwd: root })
const current = readFileSync(resolve(root, path))
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
const old = inspect(original), next = inspect(current)
for (const row of old.rows) {
  const restored = next.rows.find(value => value.title === row.title)
  assert(restored, 'Missing original test: ' + row.title)
  assert.deepEqual(restored, row, 'Changed original body/guard/loop bindings: ' + row.title)
}
assert.equal(old.titles.length, 26)
assert.equal(new Set(old.titles).size, 26)
assert.deepEqual(next.titles, old.titles)
for (const bytes of [original, current]) {
  assert(bytes.toString().includes('expect.poll(async () => (await state(page)).nativeCloses).toBeGreaterThanOrEqual(3)'))
  assert(bytes.toString().includes('test.setTimeout(60_000)'))
}
console.log(JSON.stringify({ historical, historicalSourceSha256: sha(original), currentSourceSha256: sha(current), expandedCases: old.titles, templates: old.rows, unchangedBodiesGuardsBindings: true, historicalFailureResolved: false }, null, 2))
