import assert from 'node:assert/strict'
import fs from 'node:fs'
import {execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {gzipSync,gunzipSync} from 'node:zlib'
import path from 'node:path'
const work="/Applications/학교 내부/2026-2학기/오픈소스 AI SW 융합 프로젝트/BODYGUARD-avatar-surface-feedback",proof="/private/tmp/bodyguard-surface-feedback-proof.ozUgBj",runtime="e61870a3983b293f8aa71390b8b5758b27c55c19",baseline="b9eb40bd11c25269e1ae2b9e82ade1af97fc669b"
const dest=work+'/bodyguard/docs/review/surface-feedback',sha=b=>createHash('sha256').update(b).digest('hex'),files=[]
assert(!fs.existsSync(dest+'/summary.json'))
function archive(name,bytes,kind,extra={}){
 const compressed=bytes.length>8192 && !name.endsWith('.png'),data=compressed?gzipSync(bytes):bytes,target=name+(compressed?'.gz':'')
 fs.mkdirSync(path.dirname(dest+'/'+target),{recursive:true});fs.writeFileSync(dest+'/'+target,data,{flag:'wx'})
 assert((compressed?gunzipSync(data):data).equals(bytes));files.push({path:target,kind,bytes:bytes.length,sha256:sha(bytes),storedBytes:data.length,storedSHA256:sha(data),compressed,...extra})
}
for(const rel of execFileSync('git',['diff','--name-only','-z',baseline+'..'+runtime],{cwd:work,encoding:'utf8'}).split('\0').filter(Boolean)){
 const bytes=execFileSync('git',['show',runtime+':'+rel],{cwd:work,maxBuffer:8*1024*1024});archive('source/'+rel,bytes,'source',{commit:runtime,gitPath:rel})
 if(!rel.startsWith('bodyguard/docs/'))assert(fs.readFileSync(work+'/'+rel).equals(bytes))
}
function walk(dir,prefix=''){
 for(const name of fs.readdirSync(dir).sort()){
  const rel=prefix+name,entry=dir+'/'+name,stat=fs.lstatSync(entry)
  if(prefix==='' && ['collection-first','collection-bounded-incomplete'].includes(name))continue
  if(/^probe-[a-z][a-z0-9-]*\/(?:models|mediapipe|fonts|licenses)\//.test(rel+'/'))continue
  assert(!stat.isSymbolicLink())
  if(stat.isDirectory())walk(entry,rel+'/')
  else if(!['male.glb','female.glb'].includes(rel))archive('evidence/'+rel,fs.readFileSync(entry),'evidence')
 }
}
walk(proof)
const publicAssets=[]
for(const name of fs.readdirSync(work+'/bodyguard/frontend/dist/assets').filter(n=>/\.(js|css)$/.test(n)).sort()){
 const bytes=fs.readFileSync(work+'/bodyguard/frontend/dist/assets/'+name),previous=gunzipSync(execFileSync('git',['show',baseline+':bodyguard/docs/review/native-reference/evidence/public-final/'+name+'.gz'],{cwd:work,maxBuffer:4*1024*1024}))
 assert(bytes.equals(previous));archive('evidence/public-final/'+name,bytes,'evidence');publicAssets.push({name,bytes:bytes.length,sha256:sha(bytes),baselineUnchanged:true})
}
const blend=fs.readFileSync('/private/tmp/bodyguard-hand-proof.UXNzqK/a37.blend'),originalBlend=execFileSync('git',['show','25a9bd6c7392890e3b5d5d6ae1046bb7087d56ad:bodyguard/assets/blender/bodyguard_avatar_candidate_a37.blend'],{cwd:work,maxBuffer:35*1024*1024});assert(blend.equals(originalBlend))
const licence=fs.readFileSync("/Applications/학교 내부/2026-2학기/오픈소스 AI SW 융합 프로젝트/BODYGUARD-owned-alert-lifecycle/bodyguard/frontend/node_modules/three/LICENSE");assert(licence.equals(fs.readFileSync(proof+'/collection-first/THREE-LICENSE.txt')));archive('THREE-LICENSE.txt',licence,'notice')
const browser=JSON.parse(fs.readFileSync(proof+'/browser-committed.json'));assert.equal(browser.head,runtime);assert(browser.samples.every(sample=>sample.passed));assert.deepEqual(browser.sourceBefore,browser.sourceAfter)
for(const label of ['committed-all-tests','committed-types-final','committed-biome-final','committed-prepare-final','committed-public-build-final','committed-guard-final','committed-diff-final','probe-build-committed','browser-exec-committed','guard-restored']){const receipt=JSON.parse(fs.readFileSync(proof+'/'+label+'.json'));assert.equal(receipt.head,runtime);assert.equal(receipt.exit,0);assert.deepEqual(receipt.sourceBefore,receipt.sourceAfter)}
for(const label of ['unit-red','boundary-red','sparse-boundary-red','format-first','types-probe','browser-first','browser-first-local','guard-injection-red'])assert.notEqual(JSON.parse(fs.readFileSync(proof+'/'+label+'.json')).exit,0)
const summary={baseline,runtime,actualWebGL:true,actualCamera:false,actualSDK:false,actualParticipant:false,syntheticObservation:true,syntheticError:true,qualifiedReleaseMotions:0,allStagesComplete:false,publicAssets,blend:{sha256:sha(blend),bytes:blend.length,unchanged:true,reopened:false,reexported:false},files,collectionNote:'Collection output and later commit/PR/merge receipts are not part of this manifest; initial uncommitted source snapshots are incomplete.'}
fs.writeFileSync(dest+'/summary.json',JSON.stringify(summary,null,2)+'\n',{flag:'wx'})
console.log(JSON.stringify({files:files.length,source:files.filter(f=>f.kind==='source').length,evidence:files.filter(f=>f.kind==='evidence').length,publicUnchanged:true,blendUnchanged:true,allStagesComplete:false}))
