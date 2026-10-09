// S6.17: original five templates/ten worker cases and hooks remain exact; two new cases only.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gunzipSync } from 'node:zlib'
import { createRequire } from 'node:module'
const review=dirname(fileURLToPath(import.meta.url)),root=resolve(review,'../../../../..')
const require=createRequire(resolve(root,'bodyguard/frontend/package.json')),ts=require('typescript')
const path='bodyguard/frontend/e2e/nativeworker.spec.ts',printer=ts.createPrinter({removeComments:true})
const original=gunzipSync(readFileSync(resolve(review,'baseline-nativeworker.spec.ts.gz'))).toString('utf8')
const revised=readFileSync(resolve(root,path),'utf8')
function calls(source){
 const ast=ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true),out=new Map()
 function visit(node){
  if(ts.isCallExpression(node)){
   const name=node.expression.getText(ast)
   if(name==='test'&&ts.isTemplateExpression(node.arguments[0]))out.set(node.arguments[0].getText(ast),printer.printNode(ts.EmitHint.Unspecified,node,ast))
   else if(['test.beforeEach','test.afterEach','test.setTimeout'].includes(name))out.set(name,printer.printNode(ts.EmitHint.Unspecified,node,ast))
  }ts.forEachChild(node,visit)
 }visit(ast);return out
}
const a=calls(original),b=calls(revised)
assert.equal(a.size,8);assert.equal(b.size,9)
for(const[name,body]of a)assert.equal(b.get(name),body,'Original worker contract changed: '+name)
assert.deepEqual([...b.keys()].filter(k=>!a.has(k)),['`${gender} actual worker inference→immediate stop→no late acceptance`'])
console.log(JSON.stringify({originalCases:10,originalHooksUnchanged:true,originalTimeoutUnchanged:true,additionalCases:2}))
