import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {gzipSync,gunzipSync} from 'node:zlib'
const [work,proof,previous]=process.argv.slice(2)
assert(work.endsWith('/BODYGUARD-head-orientation'))
assert(/^\/private\/tmp\/bodyguard-head-proof\.[A-Za-z0-9]+$/.test(proof))
const sha=b=>createHash('sha256').update(b).digest('hex')
const runtime=execFileSync('git',['rev-parse','HEAD'],{cwd:work,encoding:'utf8'}).trim()
const files=['src/avatar/headOrientationRig.ts','src/avatar/headOrientationRig.test.ts','e2e/fixtures/headOrientationProbe.ts','scripts/test-head-orientation-browser.mjs','scripts/check-selection-production.mjs','src/avatar/eightWeightSkin.ts','src/coaching/resources.ts','pnpm-lock.yaml']
const source=Object.fromEntries(files.map(f=>{
 const bytes=fs.readFileSync(path.join(work,'bodyguard/frontend',f))
 const committed=execFileSync('git',['show',runtime+':bodyguard/frontend/'+f],{cwd:work,maxBuffer:5*1024*1024})
 assert(bytes.equals(committed));return [f,sha(bytes)]
}))
const browser=JSON.parse(fs.readFileSync(proof+'/browser-final.json','utf8'))
assert.equal(browser.head,runtime);assert.equal(browser.samples.length,2);assert(browser.samples.every(s=>s.passed));assert.deepEqual(browser.sourceBefore,browser.sourceAfter)
for(const [f,h]of Object.entries(browser.sourceBefore))assert.equal(source[f],h)
const unit=JSON.parse(fs.readFileSync(proof+'/frontend-final.json','utf8'))
assert(unit.success&&unit.numPassedTests===960&&unit.numFailedTests===0&&unit.numPendingTests===0)
const checks=JSON.parse(fs.readFileSync(proof+'/final-checks.json','utf8'))
assert.equal(checks.head,runtime);assert.equal(checks.results.length,7);assert(checks.results.every(r=>r.exit===0))
const assets=dir=>Object.fromEntries(fs.readdirSync(dir).filter(f=>/\.(js|css)$/.test(f)).map(f=>[f,sha(fs.readFileSync(path.join(dir,f)))]))
const before=assets(path.join(previous,'bodyguard/frontend/dist/assets')),after=assets(path.join(work,'bodyguard/frontend/dist/assets'))
assert.deepEqual(before,after)
const models=JSON.parse(fs.readFileSync(proof+'/cached-assets.json','utf8'))
for(const m of models)assert.equal(sha(fs.readFileSync(path.join(work,'bodyguard/frontend/public/models',m.name))),m.sha256)
assert.equal(fs.readdirSync(path.join(work,'bodyguard/frontend/dist/models')).filter(f=>f.endsWith('.glb')).length,0)
const out=path.join(work,'bodyguard/docs/review/head-orientation')
assert(!fs.existsSync(out));fs.mkdirSync(out,{recursive:true})
const evidence=[]
for(const name of fs.readdirSync(proof).filter(f=>/\.(json|mjs|png)$/.test(f))){
 const bytes=fs.readFileSync(path.join(proof,name))
 const dest=name.startsWith('frontend-')&&name.endsWith('.json')?name+'.gz':name
 if(dest.endsWith('.gz')){const zipped=gzipSync(bytes);assert(gunzipSync(zipped).equals(bytes));fs.writeFileSync(path.join(out,dest),zipped,{flag:'wx'})}
 else fs.writeFileSync(path.join(out,dest),bytes,{flag:'wx'})
 evidence.push({name:dest,original:name,sha256:sha(bytes),bytes:bytes.length,storedSha256:sha(fs.readFileSync(path.join(out,dest)))})
}
const summary={baseline:'01b97dbecfe2a9a37ee7165e98c8f1e5730f7be4',runtime,source,unit:{passed:960,failed:0,pending:0},browser:{passed:2,failed:0,actualChrome:true,actualWebGL:true,actualCamera:false,nativeFaceInference:false,syntheticInput:true,boundary:browser.boundary},publicBytesUnchanged:after,modelBytesUnchanged:models,publicGlb:0,cameraScreenshots:0,assetCommit:browser.assetCommit,assetHashes:browser.assetHashes,checks,evidence}
fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify(summary,null,2),{flag:'wx'})
console.log(JSON.stringify({runtime,evidence:evidence.length,sources:files.length,publicByteIdentical:true}))
