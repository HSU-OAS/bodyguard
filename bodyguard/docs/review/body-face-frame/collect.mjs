import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {gzipSync,gunzipSync} from 'node:zlib'
const [work,proof,previous]=process.argv.slice(2)
assert(work.endsWith('/BODYGUARD-body-face-frame'))
assert(/^\/private\/tmp\/bodyguard-body-face-proof\.[A-Za-z0-9]+$/.test(proof))
const sha=b=>createHash('sha256').update(b).digest('hex')
const run=(...args)=>execFileSync('git',args,{cwd:work,maxBuffer:5*1024*1024})
const runtime=run('rev-parse','HEAD').toString().trim()
const browser=JSON.parse(fs.readFileSync(proof+'/browser-ready.json','utf8'))
assert.equal(browser.head,runtime);assert.equal(browser.passed,true);assert.equal(browser.stages.length,9)
assert.deepEqual(browser.sourceBefore,browser.sourceAfter)
const source=Object.fromEntries(Object.keys(browser.sourceBefore).map(f=>{const bytes=fs.readFileSync(path.join(work,'bodyguard/frontend',f));assert(bytes.equals(run('show',runtime+':bodyguard/frontend/'+f)));assert.equal(sha(bytes),browser.sourceBefore[f]);return[f,sha(bytes)]}))
assert.equal(Object.keys(source).length,16)
assert.equal(browser.externalRoutes,0);assert.deepEqual(browser.pageErrorNames,[])
assert.equal(browser.actualSDK,true);assert.equal(browser.actualHuman,false);assert.equal(browser.positiveHeadVerified,false);assert.equal(browser.identityVerified,false);assert.equal(browser.cameraScreenshots,0)
assert.deepEqual(browser.proxyResetInjection,{synthetic:true,refused:true,handled:true});assert.equal(browser.injectedResetHandled,1)
const checks=JSON.parse(fs.readFileSync(proof+'/final-checks-ready.json','utf8'))
assert.equal(checks.head,runtime);assert.equal(checks.results.length,7);assert(checks.results.every(r=>r.exit===0))
for(const label of ['probe-build-ready','launch-browser-ready']){const r=JSON.parse(fs.readFileSync(proof+'/'+label+'.json'));assert.equal(r.exit,0);for(const[f,h]of Object.entries(r.sourceAfter))assert.equal(source[f],h)}
assert.equal(sha(fs.readFileSync(proof+'/probe/probe.js')),browser.resources['/probe.js'].sha256)
const unit=JSON.parse(fs.readFileSync(proof+'/frontend-ready.json','utf8'))
assert(unit.success&&unit.numPassedTests===976&&unit.numTotalTests===976&&unit.numFailedTests===0&&unit.numPendingTests===0)
const assets=dir=>Object.fromEntries(fs.readdirSync(dir).filter(f=>/\.(js|css)$/.test(f)).map(f=>[f,sha(fs.readFileSync(path.join(dir,f)))]))
const before=assets(path.join(previous,'bodyguard/frontend/dist/assets')),after=assets(path.join(work,'bodyguard/frontend/dist/assets'))
assert.deepEqual(before,after)
const models=JSON.parse(fs.readFileSync(proof+'/cached-assets.json','utf8'))
for(const m of models)assert.equal(sha(fs.readFileSync(path.join(work,'bodyguard/frontend/dist/models',m.name))),m.sha256)
assert.equal(fs.readdirSync(path.join(work,'bodyguard/frontend/dist/models')).filter(f=>f.endsWith('.glb')).length,0)
const red=JSON.parse(fs.readFileSync(proof+'/guard-leak-red.json'));assert.equal(red.exit,1)
const green=JSON.parse(fs.readFileSync(proof+'/guard-leak-restored.json'));assert.equal(green.exit,0)
const out=path.join(work,'bodyguard/docs/review/body-face-frame')
assert(!fs.existsSync(out));fs.mkdirSync(out,{recursive:true})
const evidence=[]
function save(name,bytes,compress){const dest=compress?name+'.gz':name,stored=compress?gzipSync(bytes):bytes;if(compress)assert(gunzipSync(stored).equals(bytes));fs.writeFileSync(path.join(out,dest),stored,{flag:'wx'});evidence.push({name:dest,original:name,sha256:sha(bytes),bytes:bytes.length,storedSha256:sha(stored)})}
for(const name of fs.readdirSync(proof).filter(f=>/\.(json|mjs)$/.test(f)))save(name,fs.readFileSync(path.join(proof,name)),name.startsWith('frontend-'))
save('probe.js',fs.readFileSync(proof+'/probe/probe.js'),true)
const summary={baseline:'62b837539833f177e66b96d5bfc4fbab57fa148c',runtime,source,unit:{passed:976,failed:0,pending:0},browser:{passed:true,stages:9,actualChrome:true,actualSDK:true,fakeCamera:true,actualHuman:false,identityVerified:false,positiveHeadVerified:false,cameraScreenshots:0,browser:browser.browser,sdk:browser.sdk,cspBlockedAttempts:browser.cspBlockedAttempts,proxyDenied:browser.proxyDenied,externalRoutes:browser.externalRoutes},publicBytesUnchanged:after,modelBytesUnchanged:models,publicGlb:0,cameraScreenshots:0,checks,evidence}
fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify(summary,null,2),{flag:'wx'})
console.log(JSON.stringify({runtime,evidence:evidence.length,sources:16,publicByteIdentical:true,allStagesPassed:false}))
