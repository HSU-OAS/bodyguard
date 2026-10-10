import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {gzipSync,gunzipSync} from 'node:zlib'
import {execFileSync} from 'node:child_process'
const [work,proof,baseline,runtime]=process.argv.slice(2)
assert(/^\/private\/tmp\/bodyguard-native-recovery-proof\.[A-Za-z0-9]+$/.test(proof))
assert.equal(fs.realpathSync(proof),proof)
const destination=path.join(work,'bodyguard/docs/review/native-camera-recovery')
fs.mkdirSync(path.join(destination,'raw'),{recursive:true})
const sha=b=>createHash('sha256').update(b).digest('hex')
const git=(...args)=>execFileSync('git',args,{cwd:work,maxBuffer:30*1024*1024})
const previous=JSON.parse(fs.readFileSync(path.join(work,'bodyguard/docs/review/native-auth-playback/summary.json')))
const tested=[...previous.sources.map(s=>s.name),
 'bodyguard/frontend/src/coaching/nativePlaybackResources.ts',
 'bodyguard/frontend/src/coaching/nativePlaybackResources.test.ts',
 'bodyguard/frontend/e2e/nativerecovery.spec.ts',
 'bodyguard/frontend/e2e/fixtures/nativeRecoveryProbe.ts',
 'bodyguard/frontend/e2e/fixtures/nativeRecovery.vite.ts',
]
assert.equal(new Set(tested).size,40)
const sources=tested.map(name=>{
 const bytes=fs.readFileSync(path.join(work,name));assert(bytes.equals(git('show',runtime+':'+name)),name)
 return {name,bytes:bytes.length,sha256:sha(bytes)}
})
const checks=JSON.parse(fs.readFileSync(proof+'/checks-runtime.json'))
assert.equal(checks.head,runtime);assert.equal(checks.results.length,9)
assert(checks.results.every(r=>r.exit===0&&r.signal===null))
for(const [name,total]of [['frontend-runtime',939],['unit-runtime',13]]){
 const r=JSON.parse(fs.readFileSync(proof+'/'+name+'.json'))
 assert.equal(r.numTotalTests,total);assert.equal(r.numPassedTests,total)
 assert.equal(r.numFailedTests,0);assert.equal(r.numPendingTests,0);assert.equal(r.success,true)
}
for(const label of ['runtime-recovery','runtime-nativeauth']){
 const r=JSON.parse(fs.readFileSync(proof+'/browser-'+label+'-receipt.json'))
 assert.equal(r.head,runtime);assert.equal(r.exit,0);assert.equal(r.signal,null);assert.equal(r.nativeSdkOrGlb,true)
 assert.equal(r.launcherSha256,sha(fs.readFileSync(proof+'/run-browser.mjs')))
}
const stop=JSON.parse(fs.readFileSync(proof+'/db-stop-receipt.json'))
assert.equal(stop.exit,0);assert.equal(stop.testOnly,true);assert.equal(stop.dataPreserved,true)
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
  .replaceAll(/\/private\/tmp\/bodyguard-(?:native-recovery-proof|native-auth-proof|auth-test)\.[A-Za-z0-9]+/g,'[owned-test-scratch]')
  .split('\n').map(l=>l.trimEnd()).join('\n').trimEnd()+'\n')
 save(name,normalized);save('raw/'+name+'.gz',compressed)
 assert(gunzipSync(fs.readFileSync(path.join(destination,'raw/'+name+'.gz'))).equals(raw))
 artifacts.push({name,bytes:normalized.length,sha256:sha(normalized),raw:'raw/'+name+'.gz',rawBytes:raw.length,rawSha256:sha(raw),compressedSha256:sha(compressed)})
}
for(const name of fs.readdirSync(proof).filter(n=>/\.(json|log|txt|mjs)$/.test(n)).sort())collect(name,proof+'/'+name)
collect('test-launcher.mjs',proof+'/bin/pnpm')
const results=path.join(work,'bodyguard/frontend/test-results'),browsers={},attempts=[],nativeSummaries=[]
for(const [suite,total]of [['nativerecovery',8],['nativeauth',12]]){
 const folders=fs.readdirSync(results).filter(n=>new RegExp('^'+suite+'-\\d{8}T\\d{12}Z$').test(n)).sort()
 assert.equal(folders.length,suite==='nativerecovery'?4:1,suite)
 for(let i=0;i<folders.length;i++){
  const phase=suite==='nativeauth'?'runtime':i===0?'initial-failed':i===1?'cdp-detached-failed':i===2?'accepted':'runtime'
  const folder=path.join(results,folders[i]),report=JSON.parse(fs.readFileSync(folder+'/report.json'))
  if(phase==='runtime'||phase==='accepted'){
   for(const[k,v]of Object.entries({expected:total,unexpected:0,skipped:0,flaky:0}))assert.equal(report.stats[k],v,suite+'/'+phase)
  }else{
   assert.equal(report.stats.expected,i===0?4:6);assert.equal(report.stats.unexpected,i===0?4:2)
  }
  attempts.push({suite,folder:folders[i],phase,stats:report.stats})
  collect(suite+'-'+phase+'-report.json',folder+'/report.json')
  if(phase==='runtime')browsers[suite]=report.stats
  for(const entry of fs.readdirSync(folder)){
   const dir=path.join(folder,entry);if(!fs.statSync(dir).isDirectory())continue
   for(const name of ['native-recovery-summary.json','native-summary.json','error-context.md',
    'male-restarted-avatar-only.png','female-restarted-avatar-only.png',
    'avatar-male.png','avatar-female.png','native-record-male.png','native-record-female.png']){
    const file=path.join(dir,name);if(!fs.existsSync(file))continue
    if(phase==='runtime'&&name.endsWith('summary.json')){
     const r=JSON.parse(fs.readFileSync(file));assert.equal(r.external,0);assert.deepEqual(r.errors,[])
     if(suite==='nativerecovery'){
      assert(r.final.allFramesClosed&&r.native.tracksEnded&&r.native.detached&&r.native.hidden)
      assert.equal(r.native.connected,false);assert.equal(r.posts,0);assert.equal(r.final.models,0)
      assert.equal(r.final.frameCloses,r.final.frames);assert.deepEqual(r.final.memory,r.final.baseline)
      assert(r.stages.some(s=>s.name==='explicit-native-restart'&&s.state.session==='running'&&s.state.models===2&&s.state.frames>=4))
      nativeSummaries.push({suite,case:entry,browser:r.browser,cameras:r.native.calls,frames:r.final.frames,cspAttempts:r.native.cspAttempts,posts:r.posts})
     }else{
      const last=r.final??r.stages.find(s=>s.name==='native-closed-before-public-record')?.snapshot
      assert(last?.tracksEnded&&last.detached&&last.allFramesClosed)
      assert.equal(last.frameCloses,last.frames);assert.equal(last.nativeCloses,last.nativeCalls)
      assert.equal(last.nativePeopleMax,0);assert.deepEqual(last.memory,last.baseline)
      nativeSummaries.push({suite,case:entry,browser:r.browser,cameras:last.cameras,frames:last.frames,cspAttempts:r.counters.cspAttempts,posts:r.posts})
     }
    }
    collect(suite+'-'+phase+'-'+entry+'-'+name,file)
   }
  }
 }
}
assert.equal(nativeSummaries.length,20)
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
const summary={version:1,baseline,runtime,sources,artifacts,checks:checks.results,frontend:939,adapterUnit:13,browsers,attempts,nativeSummaries,publicOutput,models,
 actualReusableNativeAdapter:true,actualAuthProviderApiIsolatedPostgresChrome:true,
 fakeCameraAndMailAndMotionGates:true,actualBrowserPermissionSetting:true,delayedCameraReturnAndEndedEventSynthetic:true,
 actualHuman:false,actualPhysicalWebcam:false,actualPermissionPopup:false,actualPhysicalUnplug:false,actualPositivePoseAccuracy:false,
 cameraCaptureScreenshots:0,avatarOrPublicDesignChanged:false,productSdkPolicyApproved:false,
 cspBlockedAttemptsObserved:true,fullGpuWorkerOrLongDurationProof:false,publicGlb:0,qualifiedReleaseMotions:0,
 authorReviewOnly:true,scopedUnresolvedP1:0,scopedUnresolvedP2:0,allStagesPassed:false,productionMigrationOrDeployment:false,
 initialReceiptNativeSdkMetadataIncorrectPreserved:true,testDatabaseStopped:true,testDataPreserved:true,
 unresolvedOutsideScope:['D2-A/M/T/R/I/P','actual-participants-notebooks','approved-public-design-flow','B09-SDK-policy','external-provider-HTTPS-ops','startup-cause-P2']}
save('summary.json',Buffer.from(JSON.stringify(summary,null,2)+'\n'))
console.log(JSON.stringify({artifacts:artifacts.length,sources:sources.length,nativeRecovery:8,nativeAuthRegression:12,frontend:939,publicBytesUnchanged:true,allStagesPassed:false}))
