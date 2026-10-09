// S6.17·NFR-08: actual cancellation proof, initial failures retained; never release/clinical proof.
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { gunzipSync } from 'node:zlib'
import { dirname, resolve, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
const review=dirname(fileURLToPath(import.meta.url)),root=resolve(review,'../../../../..')
const supplied=process.argv.slice(2).filter(v=>!v.startsWith('--'));assert(supplied.length<=1)
const out=supplied[0]?resolve(supplied[0]):review
const read=p=>JSON.parse(readFileSync(p)),sha=b=>createHash('sha256').update(b).digest('hex'),m=read(resolve(out,'manifest.json')),entries=new Map()
const allowed=['src/coaching/ownedPlaybackResources.ts','src/coaching/nativePlaybackResources.ts','src/coaching/ownedPlaybackResources.test.ts','src/coaching/nativePlaybackResources.test.ts','e2e/nativeworker.spec.ts','e2e/nativehead.spec.ts','e2e/fixtures/workerBusyEntry.ts','e2e/fixtures/workerBusy.vite.ts'].map(p=>'bodyguard/frontend/'+p)
assert.deepEqual(m.sources.map(v=>v.path).sort(),allowed.sort())
for(const k of ['actualHuman','actualCamera','productPolicyApproved','allStagesComplete','startupP2Resolved','historicalRootCauseProven','mergeEligible','defaultThreadChanged'])assert.equal(m[k],false,k)
assert.equal(m.dbStopped,true)
assert.equal(m.sourceAnchor,'a59bf2b834f1b963446ffef60272236d7d0618b3')
assert.equal(m.earlierParallelManifestSha256,sha(readFileSync(resolve(review,'../parallel-preparation/manifest.json'))))
assert.equal(m.baselineWorkerSha256,sha(gunzipSync(readFileSync(resolve(out,'baseline-nativeworker.spec.ts.gz')))))
assert.equal(m.baselineWorkerSha256,'47a31fc7d55f6addded1b0f98edad3e71a06e9f26801afc21bc7efcde8ebfe62')
assert.equal(m.baselineMainSha256,sha(gunzipSync(readFileSync(resolve(out,'baseline-nativehead.spec.ts.gz')))))
assert.equal(m.baselineMainSha256,'0e66198ecb5f709b8857990ed4142d2b327d8dd031ab023d7279d5244e40cba2')
assert.deepEqual(m.inputs,[{gender:'male',bytes:12656976,sha256:'cc85bcd449f3f31347e4f7174986d41e4aca3067990f5d8a2e6ba3a099171927'},{gender:'female',bytes:12462848,sha256:'27c10902aa377e995bdbc115ab773cf22f8ea38582c49820304a33ad7685f25a'}])
for(const b of m.bundles){
 assert(/^[a-z0-9-]+\.json\.gz$/.test(b.file))
 const compressed=readFileSync(resolve(out,b.file)),raw=gunzipSync(compressed)
 assert.equal(sha(compressed),b.compressedSha256);assert.equal(compressed.length,b.compressedBytes);assert.equal(sha(raw),b.sha256);assert.equal(raw.length,b.bytes)
 const saved=JSON.parse(raw).entries;assert.equal(saved.length,b.entries.length);assert.equal(new Set(saved.map(v=>v.original)).size,saved.length)
 for(const[i,e]of saved.entries()){
  assert(e.original.startsWith('/private/tmp/bodyguard-worker-busy-proof.ViLOld/')||e.original.startsWith('/private/tmp/bodyguard-native-cold-stage.rrMOG8/')||/^\/private\/tmp\/bodyguard-native-feedback-proof\.[A-Za-z0-9]+\/probe-[a-z0-9-]+\//.test(e.original)||e.original.startsWith(root+'/bodyguard/frontend/'))
  assert(!e.original.split('/').includes('..'));assert.equal(e.original,b.entries[i].original)
  const bytes=Buffer.from(e.base64,'base64');assert.equal(bytes.length,e.bytes);assert.equal(e.bytes,b.entries[i].bytes);assert.equal(sha(bytes),e.sha256);assert.equal(e.sha256,b.entries[i].sha256)
  entries.set(b.file+'\0'+e.original,bytes)
 }
}
assert.equal(m.bundles.length,34);assert.equal(new Set(m.bundles.map(v=>v.file)).size,34)
const entry=(file,path)=>{const b=entries.get(file+'\0'+path);assert(b,'Missing original entry');return JSON.parse(b)}
function cases(s,parents=[]){const titles=[...parents,s.title];return[...(s.specs??[]).flatMap(v=>(v.tests??[]).map(test=>({title:v.title,file:v.file,titlePath:[...titles,v.title],test}))),...(s.suites??[]).flatMap(child=>cases(child,titles))]}
// Worker sidecars were not reporter attachments. Derive the exact path, never fabricate one.
// Installed Playwright 1.63.0 workerProcessEntry.js:900–911 / coreBundle.js:8383–8394.
function workerOutputDir(report,row){
 assert.equal(report.config.version,'1.63.0');assert.equal(report.config.projects.length,1)
 const project=report.config.projects[0];assert.equal(project.id,'');assert.equal(project.repeatEach,1)
 assert.equal(row.test.results.length,1);assert.equal(row.test.results[0].retry,0)
 const file=relative(project.testDir,resolve(report.config.rootDir,row.file).replace(/\.(spec|test)\.(js|ts|jsx|tsx|mjs|mts|cjs|cts)$/,''))
 const title=row.titlePath.slice(1).join(' ').replace(/[\x00-\x2C\x2E-\x2F\x3A-\x40\x5B-\x60\x7B-\x7F]+/g,'-')
 let name=file.replaceAll('/','-')+'-'+title
 if(name.length>60){const middle='-'+createHash('sha1').update(name).digest('hex').slice(0,5)+'-',start=Math.floor((60-middle.length)/2);name=name.slice(0,start)+middle+name.slice(-(60-middle.length-start))}
 return resolve(project.outputDir,name)
}
assert.equal(m.runs.length,15);assert.equal(new Set(m.runs.map(v=>v.label)).size,15)
const finalWorkers=[];const mainGroups={}
for(const run of m.runs){
 const report=entry(run.file,run.report),rows=report.suites.flatMap(s=>cases(s));assert.deepEqual(run.stats,report.stats);assert.deepEqual(run.titles,rows.map(v=>v.title).sort())
 const prefix=run.kind==='worker'?'/private/tmp/bodyguard-worker-busy-proof.ViLOld/':'/private/tmp/bodyguard-native-cold-stage.rrMOG8/'
 const receipt=entry(run.file,prefix+run.label+'-browser.receipt.json');assert.equal(run.receiptStatus,receipt.status)
 assert.equal(entry(run.file,prefix+run.label+'-db-stop.receipt.json').status,0)
 const before=entry(run.file,run.sourceBefore).sources;assert.deepEqual(before,entry(run.file,run.sourceAfter).sources)
 assert.equal(report.stats.skipped,0);assert.equal(report.stats.flaky,0)
 if(run.label==='regression-154-male'){
  assert.equal(rows.length,0);assert.equal(receipt.status,1);assert.equal(run.fixtureFile,null);assert(report.errors.length>0)
 }else{
  assert.deepEqual(report.errors,[]);assert(rows.every(v=>v.test.results.length===1))
  if(run.label==='early-camera-main-154-male'){
   assert.equal(rows.length,13);assert.equal(receipt.status,1);assert.equal(report.stats.expected,7);assert.equal(report.stats.unexpected,6)
  }else if(['initial-154-male','observed-154-male','protocol-fixed-control-154-male'].includes(run.label)){
   assert.equal(rows.length,1);assert.equal(receipt.status,1);assert.equal(report.stats.unexpected,1)
  }else{
   assert.equal(receipt.status,0);assert.equal(report.stats.unexpected,0);assert.equal(report.stats.expected,rows.length);assert.deepEqual(run.failed,[])
  }
 }
 const isFinal=run.label.startsWith('final-')
 assert.equal(new Set(run.summaries.map(v=>v.title)).size,run.summaries.length)
 if(run.kind==='worker')assert.deepEqual(run.summaries.map(v=>v.title).sort(),run.titles)
 if(run.label==='protocol-fixed-control-154-male'){
  assert.equal(run.timings.length,1)
  const t=entry(run.file,run.timings[0].original);assert.deepEqual(t,run.timings[0].value)
  assert.equal(t.markers,2);assert.equal(t.invalid,false);assert.equal(t.clean,true)
  assert(t.workerMs>0&&t.releaseMs>=t.workerMs-t.roundoffMs&&t.stopMs<t.workerMs)
 }
 if(isFinal||run.label.startsWith('early-camera-main-fixed'))for(const s of m.sources){
  // The worker spec never imports nativehead.spec; its completed runs preceded the camera guard revision.
  if(isFinal&&s.path==='bodyguard/frontend/e2e/nativehead.spec.ts')continue
  assert.equal(before[s.path],s.sha256)
 }
 if(isFinal){
  assert.equal(rows.length,6);assert.equal(run.summaries.length,6);assert.equal(run.timings.length,1)
  const t=entry(run.file,run.timings[0].original);assert.deepEqual(t,run.timings[0].value)
  assert.equal(run.timings[0].mapping,'playwright-1.63.0-output-dir')
  assert(run.timings[0].title.includes('actual worker inference'))
  assert.equal(rows.filter(v=>v.title===run.timings[0].title&&workerOutputDir(report,v)===dirname(run.timings[0].original)).length,1)
  assert.deepEqual(Object.keys(t).sort(),['markers','invalid','clean','inferenceCompleted','roundoffMs','workerMs','stopMs','releaseMs','settledMs'].sort())
  assert.equal(t.markers,2);assert.equal(t.invalid,false);assert.equal(t.clean,true);assert.equal(t.inferenceCompleted,true)
  assert([t.roundoffMs,t.workerMs,t.stopMs,t.releaseMs,t.settledMs].every(Number.isFinite));assert(t.roundoffMs>0&&t.roundoffMs<0.002)
  assert(t.workerMs>0);assert(t.stopMs>=-t.roundoffMs);assert(t.releaseMs>=t.stopMs);assert(t.releaseMs<t.workerMs-t.roundoffMs);assert(t.settledMs>=t.workerMs)
  finalWorkers.push(run.label)
 }
 if(run.label.startsWith('early-camera-main-fixed')){
  assert.equal(rows.length,13);assert.equal(run.summaries.length,13)
  const version=/main-fixed-(154|155)-/.exec(run.label)?.[1];assert(version);(mainGroups[version]??=[]).push(...run.titles)
 }
 for(const summary of run.summaries){
  const data=entry(run.file,summary.original)
  if(run.kind==='worker'){
   assert.equal(summary.mapping,'playwright-1.63.0-output-dir')
   assert.equal(rows.filter(v=>v.title===summary.title&&workerOutputDir(report,v)===dirname(summary.original)).length,1)
  }else assert(rows.some(v=>v.title===summary.title&&v.test.results[0].attachments.some(a=>a.path?.includes(dirname(summary.original)+'/'))))
  assert.equal(data.actualHuman,false);assert.equal(data.actualCamera,false);assert.equal(data.external,0);assert.deepEqual(data.errors,[])
  const f=data.final??data.stages.find(v=>v.name==='native-closed-before-public-record')?.snapshot;assert(f)
  assert(f.tracksEnded&&f.detached&&f.allFramesClosed);assert.equal(f.frameCloses,f.frames);assert.equal(f.frameErrors,0);assert.equal(f.models,0);assert.deepEqual(f.memory,f.baseline)
  if(run.kind==='worker'){
   assert.equal(data.workerStarts,data.workerCloses);assert.equal(f.nativeCalls,0);assert.equal(f.faceCalls,0);assert.equal(f.handCalls,0);assert.equal(f.verifiedMs,0)
   assert.equal(data.cleanupError,data.faultInjected)
   if(data.faultInjected)assert(f.failures.some(v=>v.reason==='cleanup-error'));else assert.deepEqual(f.failures,[])
   if(summary.title.includes('actual worker inference')){assert.equal(data.posts,0);assert.equal(data.workerStarts,1);assert.equal(f.feedbackEvaluations,0);assert.equal(f.capturedNeckChecks,0)}
  }else{
   assert.deepEqual(f.failures,[]);assert.equal(f.nativeCloses,f.nativeCalls)
   for(const field of ['detectorCloses','faceDetectorCloses','handDetectorCloses'])assert.equal(f[field],f.cameras)
  }
 }
}
assert.deepEqual(finalWorkers.sort(),['final-154-male','final-154-female','final-155-male','final-155-female'].sort())
assert.equal(mainGroups['154'].length,26);assert.deepEqual(mainGroups['154'].sort(),mainGroups['155'].sort())
assert.deepEqual(m.local.map(v=>v.label).sort(),['local-revised','local-final','local-camera-contract'].sort())
for(const local of m.local){
 assert.equal(local.passed,1439);assert.equal(local.failed,0)
 assert.deepEqual(local.steps,['type','unit','biome','main-contract','worker-contract','assets','build','public-guard'])
 for(const step of local.steps)assert.equal(entry(local.file,'/private/tmp/bodyguard-worker-busy-proof.ViLOld/'+local.label+'-'+step+'.receipt.json').status,0)
 const unit=entry(local.file,'/private/tmp/bodyguard-worker-busy-proof.ViLOld/'+local.label+'-unit.json');assert.equal(unit.numPassedTests,1439);assert.equal(unit.numFailedTests,0)
}
 const first=entry(m.auxiliary,'/private/tmp/bodyguard-worker-busy-proof.ViLOld/early-camera-first-unit.json');assert.equal(first.numPassedTests,116);assert.equal(first.numFailedTests,2)
assert.equal(entry(m.auxiliary,'/private/tmp/bodyguard-worker-busy-proof.ViLOld/type-first-recorded-type.receipt.json').status,2)
if(existsSync(resolve(out,'post-package-checks.json'))){
 const post=read(resolve(out,'post-package-checks.json'));assert.equal(post.actualBrowserRerun,false);assert.equal(post.actualHuman,false)
 const expectedFiles=['proof-gates.mjs','strengthened-gates.mjs','negative.mjs','negative-strengthened.mjs','negative-result.json','negative-strengthened-result.json',...['current','frozen-baseline','frozen-parallel','negative'].flatMap(label=>['receipt.json','stdout.txt','stderr.txt'].map(suffix=>'proof-'+label+'.'+suffix)),...['current','negative'].flatMap(label=>['receipt.json','stdout.txt','stderr.txt'].map(suffix=>'strengthened-'+label+'.'+suffix))]
 assert.deepEqual(post.entries.map(v=>v.file).sort(),expectedFiles.sort());assert.equal(new Set(post.entries.map(v=>v.file)).size,24)
 for(const e of post.entries){
  assert.equal(e.original,'/private/tmp/bodyguard-worker-busy-proof.ViLOld/'+e.file)
  const bytes=Buffer.from(e.base64,'base64');assert.equal(bytes.length,e.bytes);assert.equal(sha(bytes),e.sha256)
  if(e.file.endsWith('.receipt.json'))assert.equal(JSON.parse(bytes).status,0)
  if(e.file==='negative-result.json'||e.file==='negative-strengthened-result.json'){
   const result=JSON.parse(bytes);assert.equal(result.accepted.status,0);assert.equal(result.rejected.length,8)
   assert.equal(new Set(result.rejected.map(v=>v.name)).size,8);assert(result.rejected.every(v=>v.status===1));assert.equal(result.hashesRecomputedForSemanticMutations,true);assert.equal(result.actualBrowserRerun,false);assert.equal(result.actualHuman,false)
  }
 }
}
if(process.argv.includes('--current')){
 for(const s of m.sources)assert.equal(sha(readFileSync(resolve(root,s.path))),s.sha256)
 for(const a of m.publicAssets){assert(/^[A-Za-z0-9_.-]+\.(js|css)$/.test(a.name));const b=readFileSync(resolve(root,'bodyguard/frontend/dist/assets',a.name));assert.equal(b.length,a.bytes);assert.equal(sha(b),a.sha256);assert(!/test-only-worker-busy|BodyguardTestOnlyWorkerBusy/.test(b.toString('utf8')))}
 assert(!existsSync('/private/tmp/bodyguard-auth-test.oicSqH/data/postmaster.pid'))
 execFileSync(process.execPath,[resolve(review,'compare-worker-contract.mjs')],{stdio:'pipe'})
 execFileSync(process.execPath,[resolve(review,'compare-main-contract.mjs')],{stdio:'pipe'})
}
console.log(JSON.stringify({workerCases:24,mainCases:52,firstFailuresRetained:true,unit:1439,publicPolicyApproved:false,startupP2Resolved:false,allStagesComplete:false,mergeEligible:false}))
