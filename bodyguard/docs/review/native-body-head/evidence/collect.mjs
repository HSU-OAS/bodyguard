import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {gzipSync} from 'node:zlib'
const [work,proof,recovery,runtime]=process.argv.slice(2)
assert(work.endsWith('/BODYGUARD-native-body-head'))
assert(/^\/private\/tmp\/bodyguard-native-body-head-proof\.[A-Za-z0-9]+$/.test(proof))
const review=path.join(work,'bodyguard/docs/review/native-body-head'), dst=path.join(review,'evidence')
assert(!fs.existsSync(dst));fs.mkdirSync(dst,{recursive:true})
const sha=b=>createHash('sha256').update(b).digest('hex'),json=p=>JSON.parse(fs.readFileSync(p)), evidence=[]
function add(name,bytes,original){const file=path.join(dst,name);fs.writeFileSync(file,bytes,{flag:'wx'});evidence.push({file:name,bytes:bytes.length,sha256:sha(bytes),...(original?{originalSha256:sha(original)}:{})})}
function copy(dir,name,out=name){const b=fs.readFileSync(path.join(dir,name));if(name.endsWith('.js')||name.endsWith('.json')&&name.startsWith('frontend-')||name.startsWith('unit-'))add(out+'.gz',gzipSync(b),b);else add(out,b)}
for(const name of fs.readdirSync(proof).filter(n=>/\.(json|log|mjs)$/.test(n)).sort()) copy(proof,name)
copy(proof+'/probe-initial','probe.js','native-head-initial-probe.js')
copy(proof+'/probe','probe.js','native-head-runtime-probe.js')
copy(recovery+'/probe-initial','probe.js','body-only-reviewed-probe.js')
copy(recovery+'/probe','probe.js','body-only-runtime-probe.js')
const results=path.join(work,'bodyguard/frontend/test-results'), browsers=[]
for(const folder of fs.readdirSync(results).filter(n=>n.startsWith('nativehead-')||n.startsWith('nativerecovery-')).sort()) {
 const dir=path.join(results,folder),report=json(path.join(dir,'report.json'))
 add(folder+'-report.json',Buffer.from(JSON.stringify(report,null,2)+'\n'))
 assert.equal(report.stats.unexpected,0);assert.equal(report.stats.skipped,0)
 const flows=[]
 for(const flow of fs.readdirSync(dir).sort()){
  const sub=path.join(dir,flow);if(!fs.statSync(sub).isDirectory())continue
  const names=fs.readdirSync(sub)
  const summary=names.find(n=>n==='native-head-summary.json'||n==='native-recovery-summary.json')
  if(!summary)continue
  const value=json(path.join(sub,summary));assert.equal(value.external,0);assert.deepEqual(value.errors,[])
  copy(sub,summary,folder+'-'+flow+'-'+summary)
  for(const image of names.filter(n=>/^avatar-(male|female)\.png$/.test(n)||/^native-record-(male|female)\.png$/.test(n)||/avatar-only\.png$/.test(n)))copy(sub,image,folder+'-'+flow+'-'+image)
  const closed=value.final??value.stages.find(s=>s.name==='native-closed-before-public-record')?.snapshot
  if(folder.startsWith('nativehead-')){
   assert(closed);assert.equal(closed.productionAdapter,true);assert.equal(closed.sameInput,true)
   assert.equal(closed.faceCalls,closed.nativeCalls);assert.equal(closed.faceDetectorCloses,closed.cameras)
   assert.equal(closed.nativeFacesMax,0);assert.equal(closed.nativePeopleMax,0);assert.equal(closed.verifiedMs,0)
   assert(closed.tracksEnded&&closed.detached&&closed.allFramesClosed)
  }
  flows.push({name:flow,stages:value.stages.length,posts:value.posts,external:value.external,
   ...(closed?{bodyCalls:closed.nativeCalls,faceCalls:closed.faceCalls,sameInput:closed.sameInput,physicalCamera:closed.actualCamera}:{}),
   observedCspAttemptsInRetainedCounters:value.counters?.cspAttempts??value.native?.cspAttempts??null})
 }
 browsers.push({folder,stats:report.stats,browser:report.config?.projects?.[0]?.use?.channel,flows})
}
assert.equal(browsers.filter(b=>b.folder.startsWith('nativehead-')).length,2)
assert.equal(browsers.filter(b=>b.folder.startsWith('nativerecovery-')).length,2)
const sourceNames=[
 'bodyguard/frontend/src/coaching/nativePlaybackResources.ts','bodyguard/frontend/src/coaching/nativePlaybackResources.test.ts',
 'bodyguard/frontend/src/coaching/ownedPlaybackResources.ts','bodyguard/frontend/src/coaching/resources.ts',
 'bodyguard/frontend/src/coaching/useRecordedCoaching.ts','bodyguard/frontend/src/avatar/ownedPosePlayback.ts',
 'bodyguard/frontend/src/avatar/headOrientationRig.ts','bodyguard/frontend/src/avatar/observedPoseRig.ts','bodyguard/frontend/src/avatar/ownedAvatarPair.ts',
 'bodyguard/frontend/src/pose/bodyFaceVideoSource.ts','bodyguard/frontend/src/pose/videoPoseSource.ts','bodyguard/frontend/src/pose/ownedPoseFrame.ts',
 'bodyguard/frontend/src/pose/face.ts','bodyguard/frontend/src/pose/landmarker.ts','bodyguard/frontend/src/pose/camera.ts',
 'bodyguard/frontend/e2e/fixtures/nativeHeadAuthProbe.ts','bodyguard/frontend/e2e/fixtures/nativeHead.vite.ts','bodyguard/frontend/e2e/nativehead.spec.ts',
 'bodyguard/frontend/e2e/fixtures/nativeRecoveryProbe.ts','bodyguard/frontend/e2e/nativerecovery.spec.ts',
 'bodyguard/frontend/playwright.account.config.ts','bodyguard/frontend/scripts/check-selection-production.mjs',
 'bodyguard/backend/tests/run_browser.py','bodyguard/backend/tests/conftest.py',
]
const source={}
for(const name of sourceNames){const b=execFileSync('git',['show',runtime+':'+name],{cwd:work,maxBuffer:10*1024*1024});assert.equal(sha(fs.readFileSync(path.join(work,name))),sha(b));source[name]=sha(b)}
const checks=json(proof+'/final-checks-runtime.json');assert(checks.results.every(r=>r.exit===0))
const unit=json(proof+'/frontend-runtime.json');assert.equal(unit.numFailedTests,0);assert.equal(unit.numPendingTests,0)
const native=json(proof+'/browser-runtime-receipt.json');assert.equal(native.exit,0);assert.equal(native.head,runtime);assert.deepEqual(native.sourceBefore,native.sourceAfter)
const reg=json(proof+'/browser-recovery-runtime-receipt.json');assert.equal(reg.exit,0);assert.equal(reg.head,runtime);assert.equal(reg.nativeAdapterBefore,reg.nativeAdapterAfter)
const files=fs.readdirSync(path.join(work,'bodyguard/frontend/dist/assets')).filter(n=>/\.(js|css)$/.test(n)), publicAssets=[]
const expected={js:'b5d4f81164c8d3c196e853b3404382bc15077986aa626cd0c3c72571b6325ac0',css:'043cb9bdb5d82a3baa9a8463c7a641cbe92ace213303f20c6c7f91e9a14ac82e'}
assert.equal(files.length,2)
for(const name of files){const b=fs.readFileSync(path.join(work,'bodyguard/frontend/dist/assets',name)),hash=sha(b);assert.equal(hash,expected[name.split('.').at(-1)]);publicAssets.push({name,bytes:b.length,sha256:hash})}
const notices=path.join(review,'notices');fs.mkdirSync(notices,{recursive:true})
for(const name of ['Apache-2.0.txt','three-MIT.txt'])fs.copyFileSync(path.join(work,'bodyguard/docs/review/observed-body-head/notices',name),path.join(notices,name),fs.constants.COPYFILE_EXCL)
const summary={runtime,baseline:'7f3c8bcd88b1a77cf3b872a240f73ecbad0b1bb8',source,evidence,browsers,
 frontend:{passed:unit.numPassedTests,failed:0,pending:0},checks:checks.results,publicAssets,
 unfinishedA37:true,newSculptOrGlb:false,publicUiChanged:false,productionSdkPolicyChanged:false,
 nativeBlankInput:true,actualNativePositive:false,actualHuman:false,actualPhysicalCamera:false,
 heldFaceResultIsTestWrapper:true,clinicalThresholdsChanged:false,qualifiedReleaseMotions:0,stagesComplete:false}
fs.writeFileSync(path.join(review,'summary.json'),JSON.stringify(summary,null,2)+'\n',{flag:'wx'})
console.log(JSON.stringify({sources:sourceNames.length,evidence:evidence.length,browsers:browsers.map(b=>({folder:b.folder,stats:b.stats})),unit:summary.frontend,publicAssets}))
