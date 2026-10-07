import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {gzipSync,gunzipSync} from 'node:zlib'
import {execFileSync} from 'node:child_process'
const [work,proof,baseline,runtime]=process.argv.slice(2)
assert(/^\/private\/tmp\/bodyguard-native-auth-proof\.[A-Za-z0-9]+$/.test(proof))
assert.equal(fs.realpathSync(proof),proof)
const destination=path.join(work,'bodyguard/docs/review/native-auth-playback')
fs.mkdirSync(path.join(destination,'raw'),{recursive:true})
const sha=b=>createHash('sha256').update(b).digest('hex')
const git=(...args)=>execFileSync('git',args,{cwd:work,maxBuffer:30*1024*1024})
const tested=[
 'bodyguard/frontend/e2e/nativeauth.spec.ts','bodyguard/frontend/e2e/fixtures/nativeAuthProbe.ts',
 'bodyguard/frontend/e2e/fixtures/nativeAuth.vite.ts','bodyguard/frontend/playwright.account.config.ts',
 'bodyguard/frontend/scripts/check-selection-production.mjs','bodyguard/frontend/e2e/authcoaching.spec.ts',
 'bodyguard/frontend/e2e/fixtures/authCoachingProbe.ts','bodyguard/frontend/e2e/fixtures/authCoaching.vite.ts',
 'bodyguard/frontend/src/auth.tsx','bodyguard/frontend/src/api/auth.ts','bodyguard/frontend/src/api/records.ts',
 'bodyguard/frontend/src/coaching/useRecordedCoaching.ts','bodyguard/frontend/src/coaching/recordOwner.ts',
 'bodyguard/frontend/src/coaching/recordedSession.ts','bodyguard/frontend/src/coaching/lifecycle.ts',
 'bodyguard/frontend/src/coaching/session.ts','bodyguard/frontend/src/coaching/resources.ts',
 'bodyguard/frontend/src/coaching/ownedPlaybackResources.ts','bodyguard/frontend/src/avatar/ownedPosePlayback.ts',
 'bodyguard/frontend/src/avatar/ownedAvatarPair.ts','bodyguard/frontend/src/avatar/observedPoseRig.ts',
 'bodyguard/frontend/src/avatar/directionalRig.ts','bodyguard/frontend/src/pose/camera.ts',
 'bodyguard/frontend/src/pose/landmarker.ts','bodyguard/frontend/src/pose/ownedPoseFrame.ts',
 'bodyguard/frontend/src/pose/videoPoseSource.ts','bodyguard/frontend/src/stretch/progression.ts',
 'bodyguard/frontend/package.json','bodyguard/frontend/pnpm-lock.yaml',
 'bodyguard/backend/tests/run_browser.py','bodyguard/backend/tests/conftest.py',
 'bodyguard/backend/app/main.py','bodyguard/backend/app/records.py','bodyguard/backend/app/config.py','bodyguard/backend/app/db.py',
]
const sources=tested.map(name=>{
 const bytes=fs.readFileSync(path.join(work,name));assert(bytes.equals(git('show',runtime+':'+name)),name)
 return {name,sha256:sha(bytes),bytes:bytes.length}
})
const checks=JSON.parse(fs.readFileSync(proof+'/checks-runtime.json'))
assert.equal(checks.head,runtime);assert.equal(checks.results.length,9)
assert(checks.results.every(r=>r.exit===0&&r.signal===null))
const frontend=JSON.parse(fs.readFileSync(proof+'/frontend-runtime.json'))
assert.equal(frontend.numTotalTests,926);assert.equal(frontend.numPassedTests,926)
assert.equal(frontend.numFailedTests,0);assert.equal(frontend.numPendingTests,0);assert.equal(frontend.success,true)
function save(name,bytes){
 const target=path.join(destination,name)
 if(fs.existsSync(target))assert(fs.readFileSync(target).equals(bytes),'Preserve evidence: '+name)
 else fs.writeFileSync(target,bytes,{flag:'wx'})
}
const artifacts=[]
function collect(name,source){
 const stat=fs.lstatSync(source);assert(stat.isFile()&&!stat.isSymbolicLink()&&stat.nlink===1&&stat.size<15*1024*1024)
 const raw=fs.readFileSync(source),compressed=gzipSync(raw,{level:9})
 const normalized=name.endsWith('.png')?raw:Buffer.from(raw.toString('utf8').replaceAll(work,'[workspace]')
  .replaceAll(encodeURI(work),'[workspace-uri]')
  .replaceAll(/\/private\/tmp\/bodyguard-(?:native-auth-proof|auth-test|coaching-auth-proof)\.[A-Za-z0-9]+/g,'[owned-test-scratch]')
  .split('\n').map(l=>l.trimEnd()).join('\n').trimEnd()+'\n')
 save(name,normalized);save('raw/'+name+'.gz',compressed)
 assert(gunzipSync(fs.readFileSync(path.join(destination,'raw/'+name+'.gz'))).equals(raw))
 artifacts.push({name,bytes:normalized.length,sha256:sha(normalized),raw:'raw/'+name+'.gz',rawBytes:raw.length,rawSha256:sha(raw),compressedSha256:sha(compressed)})
}
for(const name of fs.readdirSync(proof).filter(n=>/\.(json|log|txt|mjs)$/.test(n)).sort())collect(name,proof+'/'+name)
collect('test-launcher.mjs',proof+'/bin/pnpm')
const results=path.join(work,'bodyguard/frontend/test-results'),browsers={}
const nativeSummaries=[]
for(const [suite,total]of [['nativeauth',12],['authcoaching',6]]){
 const folders=fs.readdirSync(results).filter(n=>new RegExp('^'+suite+'-\\d{8}T\\d{12}Z$').test(n)).sort()
 assert.equal(folders.length,suite==='nativeauth'?2:3,suite)
 for(let i=0;i<folders.length;i++){
  const folder=path.join(results,folders[i]),phase=i===0?'accepted':i===folders.length-1?'runtime':'launcher-capture-failed'
  const report=JSON.parse(fs.readFileSync(folder+'/report.json'))
  for(const[k,v]of Object.entries({expected:total,unexpected:0,skipped:0,flaky:0}))assert.equal(report.stats[k],v,suite+'/'+phase)
  collect(suite+'-'+phase+'-report.json',folder+'/report.json')
  if(i===folders.length-1)browsers[suite]=report.stats
  for(const entry of fs.readdirSync(folder)){
   const dir=path.join(folder,entry);if(!fs.statSync(dir).isDirectory())continue
   for(const name of ['native-summary.json','avatar-male.png','avatar-female.png','native-record-male.png','native-record-female.png','auth-coaching-record.png']){
    const file=path.join(dir,name);if(!fs.existsSync(file))continue
    if(name==='native-summary.json'&&i===1){
     const r=JSON.parse(fs.readFileSync(file));assert.equal(r.external,0);assert.deepEqual(r.errors,[])
     const last=r.final??r.stages.find(s=>s.name==='native-closed-before-public-record')?.snapshot
     assert(last?.tracksEnded&&last.detached&&last.allFramesClosed)
     assert.equal(last.frameCloses,last.frames);assert.equal(last.nativeCloses,last.nativeCalls)
     assert.equal(last.nativePeopleMax,0);assert.deepEqual(last.memory,last.baseline)
     nativeSummaries.push({case:entry,browser:r.browser,cameras:last.cameras,frames:last.frames,cspAttempts:r.counters.cspAttempts,posts:r.posts})
    }
    collect(suite+'-'+phase+'-'+entry+'-'+name,file)
   }
  }
 }
}
assert.equal(nativeSummaries.length,12)
const publicOutput=fs.readdirSync(path.join(work,'bodyguard/frontend/dist/assets')).filter(n=>/^index-.*\.(js|css)$/.test(n)).sort().map(name=>{
 const bytes=fs.readFileSync(path.join(work,'bodyguard/frontend/dist/assets',name))
 assert.equal(sha(bytes),name.endsWith('.js')?'b5d4f81164c8d3c196e853b3404382bc15077986aa626cd0c3c72571b6325ac0':'043cb9bdb5d82a3baa9a8463c7a641cbe92ace213303f20c6c7f91e9a14ac82e')
 return {name,bytes:bytes.length,sha256:sha(bytes)}
})
assert.equal(publicOutput.length,2)
assert(!fs.readdirSync(path.join(work,'bodyguard/frontend/dist'),{recursive:true}).some(n=>String(n).endsWith('.glb')))
const models=JSON.parse(fs.readFileSync(proof+'/asset-receipt.json'))
for(const model of models){
 const file=model.gender?proof+'/'+model.gender+'.glb':path.join(work,'bodyguard/frontend/public/models',model.name)
 assert.equal(sha(fs.readFileSync(file)),model.sha256)
}
const summary={version:1,baseline,runtime,sources,artifacts,checks:checks.results,frontend:926,browsers,nativeSummaries,publicOutput,models,
 actualApiAndNativeSdkGlbTogether:true,actualAuthProviderApiIsolatedPostgresChrome:true,
 fakeCameraAndMailAndMotionGates:true,nativeAlreadyReturnedResultHeldBySyntheticWrapper:true,
 actualHuman:false,actualPhysicalWebcam:false,actualPermissionPopup:false,actualPositivePoseAccuracy:false,
 cameraCaptureScreenshots:0,avatarOrPublicDesignChanged:false,productSdkPolicyApproved:false,
 cspBlockedAttemptsObserved:true,fullGpuWorkerOrLongDurationProof:false,publicGlb:0,qualifiedReleaseMotions:0,
 authorReviewOnly:true,scopedUnresolvedP1:0,scopedUnresolvedP2:0,allStagesPassed:false,productionMigrationOrDeployment:false,
 unresolvedOutsideScope:['D2-A/M/T/R/I/P','actual-participants-notebooks','approved-public-design-flow','B09-SDK-policy','external-provider-HTTPS-ops','startup-cause-P2']}
save('summary.json',Buffer.from(JSON.stringify(summary,null,2)+'\n'))
console.log(JSON.stringify({artifacts:artifacts.length,sources:sources.length,native:12,regression:6,frontend:926,publicBytesUnchanged:true,allStagesPassed:false}))
