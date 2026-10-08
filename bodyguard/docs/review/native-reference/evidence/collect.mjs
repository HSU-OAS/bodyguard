import assert from 'node:assert/strict'
import fs from 'node:fs'
import {execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {gzipSync,gunzipSync} from 'node:zlib'
const work="/Applications/학교 내부/2026-2학기/오픈소스 AI SW 융합 프로젝트/BODYGUARD-native-reference",proof="/private/tmp/bodyguard-native-reference-proof.nK3C3o",runtime="7dfc3bf3c6266543dc9a3d9ca61fcbfd2fcdb845"
const destination=work+'/bodyguard/docs/review/native-reference'
assert(!fs.existsSync(destination));fs.mkdirSync(destination,{recursive:true})
const sha=b=>createHash('sha256').update(b).digest('hex')
const records=[]
function archive(name,b,metadata={}){
 const packed=b.length>8192 && !name.endsWith('.png'),data=packed?gzipSync(b):b,target=name+(packed?'.gz':'')
 const path=destination+'/'+target;fs.mkdirSync(path.substring(0,path.lastIndexOf('/')),{recursive:true});fs.writeFileSync(path,data,{flag:'wx'})
 assert((packed?gunzipSync(fs.readFileSync(path)):fs.readFileSync(path)).equals(b))
 records.push({path:target,bytes:data.length,sha256:sha(data),originalBytes:b.length,originalSha256:sha(b),...metadata})
}
const changed=execFileSync('git',['diff','--name-only','72eebf2469e449f16e830db7ed997391bd7217ec',runtime],{cwd:work,encoding:'utf8'}).trim().split('\n')
const related=['bodyguard/frontend/src/avatar/ownedPosePlayback.ts','bodyguard/frontend/src/avatar/ownedAvatarPair.ts','bodyguard/frontend/src/avatar/referencePlayback.ts','bodyguard/frontend/src/avatar/eightWeightSkin.ts','bodyguard/frontend/src/coaching/session.ts','bodyguard/frontend/src/coaching/recordedSession.ts','bodyguard/frontend/src/coaching/useRecordedCoaching.ts','bodyguard/frontend/src/coaching/resources.ts','bodyguard/frontend/src/stretch/progression.ts','bodyguard/frontend/src/pose/bodyHandVideoSource.ts','bodyguard/frontend/src/pose/bodyFaceVideoSource.ts','bodyguard/frontend/src/pose/videoPoseSource.ts','bodyguard/backend/tests/conftest.py']
for(const name of [...new Set([...changed,...related])])archive('source/'+name,execFileSync('git',['show',runtime+':'+name],{cwd:work,maxBuffer:5*1024*1024}),{kind:'source',commit:runtime,sourcePath:name})
for(const name of changed)archive('initial-source/'+name,execFileSync('git',['show','8c24d5b16a9e60ecaa80748c10c3c5b8cb3620e4:'+name],{cwd:work,maxBuffer:5*1024*1024}),{kind:'failed-source',commit:'8c24d5b16a9e60ecaa80748c10c3c5b8cb3620e4',sourcePath:name})
const receipts={}
for(const label of ['fixed','regression-head','regression-hands']){
 const r=JSON.parse(fs.readFileSync(proof+'/browser-'+label+'.json'));assert.equal(r.exit,0);assert.equal(r.head,runtime);assert.deepEqual(r.sourceBefore,r.sourceAfter)
 receipts[label]=r
}
const units=JSON.parse(fs.readFileSync(proof+'/frontend-fixed-committed.json'))
assert.equal(units.numFailedTests,0);assert.equal(units.numPendingTests,0)
for(const label of ['unit','types','biome','assets','build','guard','ruff','diff']){const r=JSON.parse(fs.readFileSync(proof+'/'+label+'-fixed-committed.json'));assert.equal(r.exit,0);assert.equal(r.head,runtime);assert.deepEqual(r.sourceBefore,r.sourceAfter)}
const binaries=[]
function walk(root,prefix=''){
 for(const entry of fs.readdirSync(root,{withFileTypes:true})){const name=prefix+entry.name,path=root+'/'+entry.name
  if(entry.isDirectory() && prefix==='' && entry.name.startsWith('probe-')) {
   archive('evidence/'+name+'/probe.js',fs.readFileSync(path+'/probe.js'),{kind:'evidence'})
   continue
  }
  else if(entry.isDirectory())walk(path,name+'/')
  else if(entry.isFile()){
   if(name==='male.glb'||name==='female.glb'){const b=fs.readFileSync(path);binaries.push({path:name,bytes:b.length,sha256:sha(b),preservedAt:proof+'/'+name});continue}
   archive('evidence/'+name,fs.readFileSync(path),{kind:'evidence'})
  }
 }
}
walk(proof)
for(const[root,label]of[['/private/tmp/bodyguard-native-body-head-proof.kQhhIy','head'],['/private/tmp/bodyguard-native-hands-proof.iLR5n9','hands']])archive('evidence/regression-'+label+'-bundle.js',fs.readFileSync(root+'/probe/probe.js'),{kind:'evidence'})
const publicAssets=fs.readdirSync(work+'/bodyguard/frontend/dist/assets').filter(n=>/\.(js|css)$/.test(n)).map(n=>{const b=fs.readFileSync(work+'/bodyguard/frontend/dist/assets/'+n),expected=gunzipSync(execFileSync('git',['show','72eebf2469e449f16e830db7ed997391bd7217ec:bodyguard/docs/review/reference-playback/evidence/public-final/'+n+'.gz'],{cwd:work,maxBuffer:5*1024*1024}));assert(b.equals(expected));archive('evidence/public-final/'+n,b,{kind:'evidence'});return {name:n,bytes:b.length,sha256:sha(b),unchanged:true}})
assert.equal(publicAssets.length,2)
const blend=execFileSync('git',['show','25a9bd6c7392890e3b5d5d6ae1046bb7087d56ad:bodyguard/assets/blender/bodyguard_avatar_candidate_a37.blend'],{cwd:work,maxBuffer:35*1024*1024})
assert(blend.equals(fs.readFileSync('/private/tmp/bodyguard-hand-proof.UXNzqK/a37.blend')))
archive('notices/three-MIT.txt',fs.readFileSync(work+'/bodyguard/frontend/node_modules/three/LICENSE'),{kind:'notice'})
const summary={runtime,baseline:'72eebf2469e449f16e830db7ed997391bd7217ec',status:'private Story verified; stages1–6 incomplete',frontend:{passed:units.numPassedTests,failed:0,skipped:0},native:['14 reference (three SDKs)','12 head regression','12 hands regression'],actualHuman:false,actualPhysicalCamera:false,syntheticMotionObservations:true,qualifiedReleaseMotions:0,finalAvatarApproved:false,publicDesignChanged:false,productSdkEgressApproved:false,publicAssets,binaries,blend:{bytes:blend.length,sha256:sha(blend),unchanged:true,reopenedThisStory:false},sourceCount:records.filter(r=>r.kind==='source').length,evidenceCount:records.filter(r=>r.kind==='evidence').length,files:records}
fs.writeFileSync(destination+'/summary.json',JSON.stringify(summary,null,2)+'\n',{flag:'wx'})
console.log(JSON.stringify({frontend:summary.frontend,sourceCount:summary.sourceCount,evidenceCount:summary.evidenceCount,publicAssets}))
