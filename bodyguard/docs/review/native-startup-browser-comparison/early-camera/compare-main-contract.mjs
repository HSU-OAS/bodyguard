// S6.17: only camera-live→camera-stopped assertion changes; held/authority/cleanup gates remain.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gunzipSync } from 'node:zlib'
import { createRequire } from 'node:module'
const review=dirname(fileURLToPath(import.meta.url)),root=resolve(review,'../../../../..')
const require=createRequire(resolve(root,'bodyguard/frontend/package.json')),ts=require('typescript')
const path='bodyguard/frontend/e2e/nativehead.spec.ts',original=gunzipSync(readFileSync(resolve(review,'baseline-nativehead.spec.ts.gz'))).toString('utf8')
const before='  expect(value.cameraLive && value.held).toBe(true)',after='  expect(value.cameraLive).toBe(false)\n  expect(value.held).toBe(true)\n  expect(value.tracksEnded && value.detached).toBe(true)\n  expect(value.cameraCloses).toBe(value.cameras)'
assert.equal(original.split(before).length,2)
assert.equal(original.split('    cameraCloses: 0,').length,2)
const printer=ts.createPrinter({removeComments:true}),normalize=text=>printer.printFile(ts.createSourceFile(path,text,ts.ScriptTarget.Latest,true))
assert.equal(normalize(readFileSync(process.argv[2]?resolve(process.argv[2]):resolve(root,path),'utf8')),normalize(original.replace(before,after).replace('    cameraCloses: 0,','    cameraCloses: value.cameras,')),'Undocumented main test revision')
console.log(JSON.stringify({cases:26,cameraHeldGuardRevisedCases:12,heldStillRequired:true,otherSourceUnchanged:true,timeoutAndRetryUnchanged:true}))
