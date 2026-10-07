import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {gunzipSync} from 'node:zlib'
import {execFileSync} from 'node:child_process'
const [work,proof,runtime]=process.argv.slice(2)
const root=path.join(work,'bodyguard/docs/review/native-camera-recovery'),r=JSON.parse(fs.readFileSync(root+'/summary.json'))
const sha=b=>createHash('sha256').update(b).digest('hex')
assert.equal(r.runtime,runtime);assert.equal(r.frontend,939);assert.equal(r.adapterUnit,13);assert.equal(r.sources.length,40)
for(const [suite,total]of [['nativerecovery',8],['nativeauth',12]]){
 assert.equal(r.browsers[suite].expected,total)
 for(const k of ['unexpected','skipped','flaky'])assert.equal(r.browsers[suite][k],0)
}
assert(r.checks.every(c=>c.exit===0&&c.signal===null))
assert.equal(r.scopedUnresolvedP1+r.scopedUnresolvedP2,0)
assert.equal(r.allStagesPassed,false);assert.equal(r.actualHuman,false)
assert.equal(r.publicGlb,0);assert.equal(r.qualifiedReleaseMotions,0)
assert.equal(r.testDatabaseStopped,true);assert.equal(r.cameraCaptureScreenshots,0)
for(const s of r.sources){
 const b=fs.readFileSync(path.join(work,s.name));assert.equal(sha(b),s.sha256,s.name)
 assert(b.equals(execFileSync('git',['show',r.runtime+':'+s.name],{cwd:work})))
}
for(const a of r.artifacts){
 assert.equal(sha(fs.readFileSync(root+'/'+a.name)),a.sha256,a.name)
 const gz=fs.readFileSync(root+'/'+a.raw);assert.equal(sha(gz),a.compressedSha256,a.name)
 const b=gunzipSync(gz);assert.equal(b.length,a.rawBytes);assert.equal(sha(b),a.rawSha256,a.name)
}
for(const b of r.publicOutput)assert.equal(sha(fs.readFileSync(path.join(work,'bodyguard/frontend/dist/assets',b.name))),b.sha256)
const staged=execFileSync('git',['diff','--cached','--name-only','-z'],{cwd:work}).toString().split('\0').filter(Boolean)
assert(!staged.some(n=>/(^|\/)\.env($|\.)|node_modules|(^|\/)docs\/research\/|\.glb$|\.blend$|(^|\/)\.github\//.test(n)))
const receipt={runtime:r.runtime,sources:r.sources.length,artifacts:r.artifacts.length,rawExact:true,publicUnchanged:true,
 scopedUnresolvedP1P2:0,independentReview:false,allStagesPassed:false}
fs.writeFileSync(proof+'/local-verified.json',JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(receipt))
