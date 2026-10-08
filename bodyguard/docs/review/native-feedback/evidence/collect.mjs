import assert from 'node:assert/strict'
import fs from 'node:fs'
import {execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {gzipSync,gunzipSync} from 'node:zlib'
const work="/Applications/학교 내부/2026-2학기/오픈소스 AI SW 융합 프로젝트/BODYGUARD-native-feedback",proof="/private/tmp/bodyguard-native-feedback-proof.QfzMIt",baseline='3190c4ed9182a62e40d7052e4f461248f03ceeed'
const runtime=process.argv[2];assert(/^[a-f0-9]{40}$/.test(runtime??''))
const git=(...a)=>execFileSync('git',a,{cwd:work,maxBuffer:64*1024*1024})
assert.equal(git('rev-parse','HEAD').toString().trim(),runtime)
const dest=work+'/bodyguard/docs/review/native-feedback';assert(!fs.existsSync(dest));fs.mkdirSync(dest,{recursive:true})
const sha=b=>createHash('sha256').update(b).digest('hex'),files=[]
function archive(name,bytes,metadata={}){
 const packed=!name.endsWith('.png')&&(bytes.length>8192||name.endsWith('.stdout')||name.endsWith('.stderr')||name.endsWith('.log'))
 const data=packed?gzipSync(bytes):bytes,target=name+(packed?'.gz':'')
 const path=dest+'/'+target;fs.mkdirSync(path.substring(0,path.lastIndexOf('/')),{recursive:true});fs.writeFileSync(path,data,{flag:'wx'})
 assert((packed?gunzipSync(fs.readFileSync(path)):fs.readFileSync(path)).equals(bytes))
 files.push({path:target,bytes:data.length,sha256:sha(data),originalBytes:bytes.length,originalSha256:sha(bytes),...metadata})
}
const changed=git('diff','--name-only','-z',baseline,runtime).toString().split('\0').filter(Boolean)
const related=['bodyguard/frontend/src/avatar/ownedAvatarPair.ts','bodyguard/frontend/src/avatar/observedPoseRig.ts','bodyguard/frontend/src/avatar/surfaceFeedback.ts','bodyguard/frontend/src/avatar/ownedPosePlayback.ts','bodyguard/frontend/src/avatar/referencePlayback.ts','bodyguard/frontend/src/coaching/ownedPlaybackResources.ts','bodyguard/frontend/src/coaching/useRecordedCoaching.ts','bodyguard/frontend/src/coaching/recordedSession.ts','bodyguard/frontend/src/coaching/session.ts','bodyguard/frontend/src/stretch/progression.ts','bodyguard/backend/tests/conftest.py']
for(const n of new Set([...changed,...related]))archive('source/'+n,git('show',runtime+':'+n),{kind:'source',commit:runtime,sourcePath:n})
const final=JSON.parse(fs.readFileSync(proof+'/browser-committed.json'))
assert.equal(final.exit,0);assert.equal(final.head,runtime);assert.deepEqual(final.sourceBefore,final.sourceAfter)
const units=JSON.parse(fs.readFileSync(proof+'/frontend-committed.json'));assert.equal(units.numFailedTests,0);assert.equal(units.numPendingTests,0)
for(const label of ['unit','types','biome','assets','build','guard','ruff','diff']){const r=JSON.parse(fs.readFileSync(proof+'/'+label+'-committed.json'));assert.equal(r.exit,0);assert.equal(r.head,runtime);assert.deepEqual(r.sourceBefore,r.sourceAfter)}
const binaries=[]
function walk(root,prefix=''){
 for(const e of fs.readdirSync(root,{withFileTypes:true})){const n=prefix+e.name,path=root+'/'+e.name
  if(e.isDirectory()&&prefix===''&&e.name.startsWith('probe-')){archive('evidence/'+n+'/probe.js',fs.readFileSync(path+'/probe.js'),{kind:'evidence'});continue}
  if(e.isDirectory())walk(path,n+'/')
  else if(e.isFile()){
   if(n==='male.glb'||n==='female.glb'){const b=fs.readFileSync(path);binaries.push({path:n,bytes:b.length,sha256:sha(b),gitSource:'25a9bd6c7392890e3b5d5d6ae1046bb7087d56ad',preservedAt:path});continue}
   archive('evidence/'+n,fs.readFileSync(path),{kind:'evidence'})
  }
 }
}
walk(proof)
const publicAssets=fs.readdirSync(work+'/bodyguard/frontend/dist/assets').filter(n=>/\.(js|css)$/.test(n)).map(n=>{
 const b=fs.readFileSync(work+'/bodyguard/frontend/dist/assets/'+n)
 const original=gunzipSync(git('show',baseline+':bodyguard/docs/review/surface-feedback/evidence/public-final/'+n+'.gz'))
 assert(b.equals(original));archive('evidence/public-final/'+n,b,{kind:'evidence'});return {name:n,bytes:b.length,sha256:sha(b),unchanged:true}
});assert.equal(publicAssets.length,2)
archive('notices/three-MIT.txt',fs.readFileSync(work+'/bodyguard/frontend/node_modules/three/LICENSE'),{kind:'notice'})
const summary={baseline,runtime,status:'private native feedback integration verified; release stages incomplete',frontend:{passed:units.numPassedTests,failed:0,skipped:0},actualHuman:false,actualPhysicalCamera:false,actualNativePositiveBody:false,syntheticFinalBodyResultReplacement:true,qualifiedReleaseMotions:0,finalAvatarApproved:false,publicDesignChanged:false,productSdkEgressApproved:false,publicAssets,binaries,blender:{reopened:false,sculpted:false,reexported:false},sourceCount:files.filter(f=>f.kind==='source').length,evidenceCount:files.filter(f=>f.kind==='evidence').length,files}
fs.writeFileSync(dest+'/summary.json',JSON.stringify(summary,null,2)+'\n',{flag:'wx'})
console.log(JSON.stringify({runtime,files:files.length,bytes:files.reduce((sum,f)=>sum+f.bytes,0),publicAssets,frontend:summary.frontend}))
