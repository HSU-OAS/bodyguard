import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {gzipSync} from 'node:zlib'
const work="/Applications/학교 내부/2026-2학기/오픈소스 AI SW 융합 프로젝트/BODYGUARD-adaptive-reference",proof="/private/tmp/bodyguard-adaptive-reference-proof.UYNLTU",runtime="3c8ce1a8b0a78276d81b6d56ae0307892fafe001"
const review=work+'/bodyguard/docs/review/adaptive-reference'
assert.equal(execFileSync('git',['rev-parse','HEAD'],{cwd:work,encoding:'utf8'}).trim(),runtime)
assert(!fs.existsSync(review));fs.mkdirSync(review,{recursive:true})
const manifest=[]
const digest=b=>createHash('sha256').update(b).digest('hex')
function store(name,b,compressed=false){
 const file=path.join(review,name+(compressed?'.gz':''))
 fs.mkdirSync(path.dirname(file),{recursive:true})
 const bytes=compressed?gzipSync(b):b;fs.writeFileSync(file,bytes,{flag:'wx'})
 manifest.push({path:path.relative(review,file),bytes:bytes.length,sha256:digest(bytes),...(compressed?{uncompressedBytes:b.length,uncompressedSha256:digest(b)}:{})})
}
for(const name of fs.readdirSync(proof)){
 const file=path.join(proof,name);if(!fs.statSync(file).isFile()||! /\.(json|stdout|stderr|log|mjs|ts)$/.test(name))continue
 const b=fs.readFileSync(file);store('evidence/local/'+name,b,b.length>60000)
}
const git=(...args)=>execFileSync('git',args,{cwd:work,maxBuffer:64*1024*1024})
const source=git('diff','--name-only','-z','origin/main',runtime).toString().split('\0').filter(Boolean)
for(const name of source)store('source/'+name,git('show',runtime+':'+name))
const flow=[]
for(const label of ['first','committed']){
 const receipt=JSON.parse(fs.readFileSync(proof+'/browser-'+label+'.json'))
 assert.equal(receipt.exit,0);assert.deepEqual(receipt.sourceBefore,receipt.sourceAfter)
 if(label==='committed')assert.equal(receipt.head,runtime)
 const folders=fs.readdirSync(proof+'/browser-'+label+'-outputs')
 assert.equal(folders.length,1)
 const out=proof+'/browser-'+label+'-outputs/'+folders[0]
 store('evidence/browser-'+label+'/report.json',fs.readFileSync(out+'/report.json'),true)
 for(const name of fs.readdirSync(out)){
  if(!fs.statSync(out+'/'+name).isDirectory())continue
  for(const file of ['before-close.json','native-hands-summary.json','feedback-pixels.json']){
   if(fs.existsSync(out+'/'+name+'/'+file))store('evidence/browser-'+label+'/'+name+'/'+file,fs.readFileSync(out+'/'+name+'/'+file))
  }
  if(label!=='committed'||!name.endsWith('n→different-cause→occlusion'))continue
  const gender=name.startsWith('nativefeedback-male-')?'male':'female'
  for(const code of ['raised','direction'])store('preview/'+gender+'-'+code+'.png',fs.readFileSync(out+'/'+name+'/adaptive-'+gender+'-'+code+'.png'))
  const stages=JSON.parse(fs.readFileSync(out+'/'+name+'/before-close.json')).stages
  flow.push({gender,stages:stages.map(({name,snapshot:s})=>({name,phase:s.phase,session:s.session,fixtureIntendedCorrection:s.expectedCorrectionId,actualReferenceTargetError:s.referenceTargetError,highlighted:s.highlighted,verifiedMs:s.verifiedMs,models:s.models,tracksEnded:s.tracksEnded,nativePeopleMax:s.nativePeopleMax,nativeFacesMax:s.nativeFacesMax,nativeHandsMax:s.nativeHandsMax}))})
 }
}
const production=[]
const old=work.replace('BODYGUARD-adaptive-reference','BODYGUARD-native-feedback')+'/bodyguard/frontend/dist/assets'
for(const name of fs.readdirSync(work+'/bodyguard/frontend/dist/assets')){
 const b=fs.readFileSync(work+'/bodyguard/frontend/dist/assets/'+name),baseline=fs.readFileSync(old+'/'+name)
 assert(b.equals(baseline));production.push({name,bytes:b.length,sha256:digest(b),byteEqualPr83:true})
}
for(const label of ['frontend-committed','types-committed','biome-committed','assets-committed','build-committed','guard-committed']){
 const receipt=JSON.parse(fs.readFileSync(proof+'/'+label+'.json'))
 assert.equal(receipt.exit,0);assert.equal(receipt.head,runtime);assert.deepEqual(receipt.sourceBefore,receipt.sourceAfter)
}
const fe=JSON.parse(fs.readFileSync(proof+'/frontend-committed.report.json'))
assert.equal(fe.numPassedTests,1169);assert.equal(fe.numFailedTests,0);assert.equal(fe.numPendingTests,0)
store('evidence/flow.json',Buffer.from(JSON.stringify(flow,null,2)))
store('evidence/production.json',Buffer.from(JSON.stringify(production,null,2)))
const summary={runtime,base:'36ed81463418a3749d026cba8aa579db8ef07fbe',actual:{frontendPassed:1169,frontendFailed:0,frontendSkipped:0,chromePassed:18,chromeFailed:0,sourceStable:true,publicByteEqual:true,actualAuthApiIsolatedDb:true,actualSdk:true,fakeCamera:true,fakeMail:true,syntheticBodyAndError:true,actualHuman:false,actualPhysicalCamera:false,qualifiedMotions:0,finalAppearanceApproved:false,stages1to6Complete:false},preservedOriginalProof:proof,privateBundlePreserved:"/private/tmp/bodyguard-native-feedback-proof.rA4Lb7",excludedFromManifest:['Compiled SDK/React/Three probe bundles','Large model/GLB/Blender source duplicates','Auth cookies, actual video/frame/pose pixels or human coordinates','Later README/status/PR/commit/merge records'],manifest}
fs.writeFileSync(review+'/summary.json',JSON.stringify(summary,null,2),{flag:'wx'})
for(const row of manifest){
 const b=fs.readFileSync(review+'/'+row.path);assert.equal(b.length,row.bytes);assert.equal(digest(b),row.sha256)
}
console.log(JSON.stringify({files:manifest.length,bytes:manifest.reduce((n,r)=>n+r.bytes,0),source:source.length,production,flow}))
