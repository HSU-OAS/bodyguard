import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {gzipSync,gunzipSync} from 'node:zlib'
import {execFileSync} from 'node:child_process'
const [work,proof,baseline,runtime]=process.argv.slice(2)
assert(/^\/private\/tmp\/bodyguard-auth-playback-proof\.[A-Za-z0-9]+$/.test(proof))
assert.equal(fs.realpathSync(proof),proof)
const destination=path.join(work,'bodyguard/docs/review/owned-auth-playback')
fs.mkdirSync(destination,{recursive:true})
fs.mkdirSync(path.join(destination,'raw'),{recursive:true})
const sha=(bytes)=>createHash('sha256').update(bytes).digest('hex')
const git=(...args)=>execFileSync('git',args,{cwd:work})
const tested=[
 'bodyguard/frontend/src/coaching/useRecordedCoaching.ts',
 'bodyguard/frontend/src/coaching/useRecordedCoaching.test.tsx',
 'bodyguard/frontend/e2e/authcoaching.spec.ts',
 'bodyguard/frontend/e2e/fixtures/authCoachingProbe.ts',
 'bodyguard/frontend/e2e/fixtures/authCoaching.vite.ts',
 'bodyguard/frontend/playwright.account.config.ts',
 'bodyguard/frontend/scripts/check-selection-production.mjs',
 'bodyguard/frontend/src/auth.tsx',
 'bodyguard/frontend/src/api/auth.ts',
 'bodyguard/frontend/src/api/records.ts',
 'bodyguard/frontend/src/coaching/recordOwner.ts',
 'bodyguard/frontend/src/coaching/recordedSession.ts',
 'bodyguard/frontend/src/coaching/lifecycle.ts',
 'bodyguard/frontend/src/coaching/session.ts',
 'bodyguard/frontend/src/coaching/resources.ts',
 'bodyguard/frontend/src/coaching/ownedPlaybackResources.ts',
 'bodyguard/frontend/src/avatar/ownedPosePlayback.ts',
 'bodyguard/frontend/src/stretch/progression.ts',
 'bodyguard/frontend/package.json',
 'bodyguard/frontend/pnpm-lock.yaml',
 'bodyguard/backend/tests/run_browser.py',
 'bodyguard/backend/tests/conftest.py',
 'bodyguard/backend/app/main.py',
 'bodyguard/backend/app/records.py',
 'bodyguard/backend/app/config.py',
 'bodyguard/backend/app/db.py',
]
const sources=tested.map((name)=>{
 const bytes=fs.readFileSync(path.join(work,name))
 assert(bytes.equals(git('show',runtime+':'+name)),'Runtime source changed: '+name)
 return {name,sha256:sha(bytes),bytes:bytes.length}
})
const checks=JSON.parse(fs.readFileSync(path.join(proof,'checks-runtime.json')))
assert.equal(checks.head,runtime)
assert.equal(checks.results.length,7)
assert(checks.results.every(r=>r.exit===0&&r.signal===null))
const unit=JSON.parse(fs.readFileSync(path.join(proof,'unit-runtime.json')))
const frontend=JSON.parse(fs.readFileSync(path.join(proof,'frontend-runtime.json')))
for(const [report,total]of [[unit,40],[frontend,926]]){
 assert.equal(report.numTotalTests,total);assert.equal(report.numPassedTests,total)
 assert.equal(report.numFailedTests,0);assert.equal(report.numPendingTests,0);assert.equal(report.success,true)
}
function save(name,bytes){
 const file=path.join(destination,name)
 if(fs.existsSync(file))assert(fs.readFileSync(file).equals(bytes),'Preserve prior artifact: '+name)
 else fs.writeFileSync(file,bytes,{flag:'wx'})
}
const artifacts=[]
function collect(name,source){
 const stat=fs.lstatSync(source)
 assert(stat.isFile()&&!stat.isSymbolicLink()&&stat.nlink===1&&stat.size<15*1024*1024)
 const raw=fs.readFileSync(source),compressed=gzipSync(raw,{level:9})
 const normalized=name.endsWith('.png')?raw:Buffer.from(raw.toString('utf8')
  .replaceAll(work,'[workspace]')
  .replaceAll(encodeURI(work),'[workspace-uri]')
  .replaceAll(/\/private\/tmp\/bodyguard-(?:auth-playback-proof|auth-test|coaching-auth-proof)\.[A-Za-z0-9]+/g,'[owned-test-scratch]')
  .split('\n').map(line=>line.trimEnd()).join('\n'))
 save(name,normalized);save('raw/'+name+'.gz',compressed)
 assert(gunzipSync(fs.readFileSync(path.join(destination,'raw/'+name+'.gz'))).equals(raw))
 artifacts.push({name,bytes:normalized.length,sha256:sha(normalized),raw:'raw/'+name+'.gz',rawBytes:raw.length,rawSha256:sha(raw),compressedSha256:sha(compressed)})
}
for(const name of fs.readdirSync(proof).filter(n=>/\.(json|log|txt|mjs)$/.test(n)).sort()){
 collect(name,path.join(proof,name))
}
collect('test-launcher.mjs',path.join(proof,'bin/pnpm'))
const results=path.join(work,'bodyguard/frontend/test-results')
const folders=fs.readdirSync(results).filter(n=>/^authcoaching-\d{8}T\d{12}Z$/.test(n)).sort()
assert.equal(folders.length,3)
let browser
for(let index=0;index<folders.length;index++){
 const folder=folders[index],report=JSON.parse(fs.readFileSync(path.join(results,folder,'report.json')))
 const label=['initial-failed','accepted','runtime'][index]
 collect('browser-'+label+'-report.json',path.join(results,folder,'report.json'))
 if(index===2){browser=report.stats;for(const [key,value]of Object.entries({expected:6,unexpected:0,skipped:0,flaky:0}))assert.equal(browser[key],value)}
 for(const entry of fs.readdirSync(path.join(results,folder))){
  const directory=path.join(results,folder,entry)
  if(!fs.statSync(directory).isDirectory())continue
  for(const name of ['error-context.md','auth-coaching-record.png']){
   const source=path.join(directory,name)
   if(fs.existsSync(source))collect('browser-'+label+'-'+name,source)
  }
 }
}
const publicOutput=fs.readdirSync(path.join(work,'bodyguard/frontend/dist/assets'))
 .filter(n=>/^index-.*\.(js|css)$/.test(n)).sort().map(name=>{
 const bytes=fs.readFileSync(path.join(work,'bodyguard/frontend/dist/assets',name))
 const expected=name.endsWith('.js')?'b5d4f81164c8d3c196e853b3404382bc15077986aa626cd0c3c72571b6325ac0':'043cb9bdb5d82a3baa9a8463c7a641cbe92ace213303f20c6c7f91e9a14ac82e'
 assert.equal(sha(bytes),expected)
 return {name,bytes:bytes.length,sha256:sha(bytes)}
})
assert.equal(publicOutput.length,2)
const models=['pose_landmarker_lite','pose_landmarker_full','pose_landmarker_heavy','gesture_recognizer','face_landmarker']
 .map(name=>{
 const source='bodyguard/frontend/public/models/'+name+'.task'
 const bytes=fs.readFileSync(path.join(work,source))
 assert(bytes.equals(fs.readFileSync(path.join(path.dirname(work),'BODYGUARD-owned-playback-resources',source))))
 return {name,bytes:bytes.length,sha256:sha(bytes)}
})
assert(!fs.readdirSync(path.join(work,'bodyguard/frontend/dist'),{recursive:true}).some(n=>String(n).endsWith('.glb')))
const summary={version:1,baseline,runtime,sources,artifacts,publicOutput,models,
 checks:checks.results,unit:40,frontend:926,skipped:0,browser,
 actualAuthProviderApiIsolatedPostgresChrome:true, actualApiAndNativeSdkTogether:false,
 nativeResourceUnitTestsAreMocked:true, browserClockPortsFramesMailAreSynthetic:true,
 cameraCaptureScreenshots:0, avatarOrPublicDesignChanged:false, publicGlb:0,
 qualifiedReleaseMotions:0,allStagesPassed:false,productionMigrationOrDeployment:false,
 authorReviewOnly:true,scopedUnresolvedP1:0,scopedUnresolvedP2:0,
 unresolvedOutsideScope:['native-SDK-GLB-auth-integration','D2-A/M/T/R/I/P','approved-public-design-flow','B09-SDK-policy','actual-participants-notebooks','external-provider-HTTPS-ops','startup-cause-P2']}
save('summary.json',Buffer.from(JSON.stringify(summary,null,2)+'\n'))
console.log(JSON.stringify({artifacts:artifacts.length,sources:sources.length,unit:40,frontend:926,browser:6,publicBytesUnchanged:true,actualNativeAuthIntegration:false}))
