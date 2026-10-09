// FR-M-01/07/NFR-08: retained actual failures + bounded startup ownership evidence, not release proof.
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { gunzipSync } from 'node:zlib'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
const review=dirname(fileURLToPath(import.meta.url)), root=resolve(review,'../../../..')
const supplied=process.argv.slice(2).filter(v=>!v.startsWith('--'))
assert(supplied.length<=1)
const out=supplied[0]?resolve(supplied[0]):resolve(review,'parallel-preparation')
const read=p=>JSON.parse(readFileSync(p)), sha=b=>createHash('sha256').update(b).digest('hex')
const m=read(resolve(out,'manifest.json')), entries=new Map()
const allowedSources=['resources','ownedPlaybackResources','nativePlaybackResources'].flatMap(name=>
  ['bodyguard/frontend/src/coaching/'+name+'.ts','bodyguard/frontend/src/coaching/'+name+'.test.ts'])
  .concat(['bodyguard/frontend/e2e/nativehead.spec.ts','bodyguard/frontend/e2e/fixtures/nativeHeadAuthProbe.ts',
    'bodyguard/docs/review/native-startup-browser-comparison/compare-parallel-contract.mjs'])
assert.deepEqual(m.sources.map(v=>v.path).sort(),allowedSources.sort())
for(const name of ['actualHuman','actualCamera','productPolicyApproved','allStagesComplete','startupP2Resolved','historicalRootCauseProven','mergeEligible'])
  assert.equal(m[name],false,name)
assert.equal(m.dbStopped,true)
assert.equal(m.earlierManifestSha256,sha(readFileSync(resolve(review,'manifest.json'))))
for(const item of m.bundles){
  assert(/^[a-z0-9-]+\.json\.gz$/.test(item.file))
  const compressed=readFileSync(resolve(out,item.file)), raw=gunzipSync(compressed)
  assert.equal(sha(compressed),item.compressedSha256);assert.equal(compressed.length,item.compressedBytes)
  assert.equal(sha(raw),item.sha256);assert.equal(raw.length,item.bytes)
  const saved=JSON.parse(raw).entries
  assert.equal(saved.length,item.entries.length)
  assert.equal(new Set(saved.map(v=>v.original)).size,saved.length)
  for(const [i,value] of saved.entries()){
    assert.equal(value.original,item.entries[i].original)
    assert(value.original.startsWith('/private/tmp/bodyguard-native-cold-stage.rrMOG8/')||
      value.original.startsWith(root+'/bodyguard/frontend/test-results/nativefeedback-'))
    assert(!value.original.split('/').includes('..'))
    const b=Buffer.from(value.base64,'base64')
    assert.equal(b.length,value.bytes);assert.equal(value.bytes,item.entries[i].bytes)
    assert.equal(sha(b),value.sha256);assert.equal(value.sha256,item.entries[i].sha256)
    entries.set(item.file+'\0'+value.original,b)
  }
}
const entry=(file,path)=>{const b=entries.get(file+'\0'+path);assert(b,'Missing original evidence: '+path);return JSON.parse(b)}
function cases(s){return[...(s.specs??[]).flatMap(v=>(v.tests??[]).map(test=>({title:v.title,test}))),...(s.suites??[]).flatMap(cases)]}
const stages=['camera','body-sdk','face-sdk','hands-sdk','avatar','render','body','face','hands','result']
function closed(final,timed,renderer){
  assert(final.tracksEnded&&final.detached&&final.allFramesClosed)
  assert.equal(final.models,0);assert.equal(final.frameErrors,0)
  assert.equal(final.nativeCloses,final.nativeCalls);assert.equal(final.frameCloses,final.frames)
  assert.deepEqual(final.memory,final.baseline);assert.deepEqual(final.failures,[])
  if(renderer){for(const [close,init] of [['detectorCloses','detectorInitializations'],
    ['faceDetectorCloses','faceDetectorInitializations'],['handDetectorCloses','handDetectorInitializations']]){
      assert(Number.isSafeInteger(final[init])&&final[init]>=0&&final[init]<=final.cameras)
      assert.equal(final[close],final[init])
    }
    assert.equal(final.nativeCalls,0);assert.equal(final.renderFrames,0);assert.equal(final.gpuPreparationDraws,0)
    assert.equal(final.rendererReady,0)
  }else{
    assert.equal(final.detectorCloses,final.cameras);assert.equal(final.faceDetectorCloses,final.cameras)
    assert.equal(final.handDetectorCloses,final.cameras)
  }
  if(timed){const t=final.startupTiming;assert(t&&t.closed&&!t.invalid)
    assert(t.events.length>0&&t.events.length<=30)
    for(const stage of stages)assert(t.events.filter(v=>v.stage===stage).length<=3)
    for(const e of t.events){assert.deepEqual(Object.keys(e).sort(),['endMs','stage','startMs'])
      assert(stages.includes(e.stage)&&Number.isFinite(e.startMs)&&e.startMs>=0)
      assert(e.endMs===null||(Number.isFinite(e.endMs)&&e.endMs>=e.startMs))}
  }
}
assert.equal(m.runs.length,12)
assert.equal(new Set(m.runs.map(v=>v.label)).size,12)
const counts={}
for(const run of m.runs){
  const prefix='/private/tmp/bodyguard-native-cold-stage.rrMOG8/'+run.label
  const report=entry(run.file,'/private/tmp/bodyguard-native-cold-stage.rrMOG8/test-results/'+run.reportName+'/report.json')
  const receipt=entry(run.file,prefix+'-browser.receipt.json'), rows=report.suites.flatMap(cases)
  assert.deepEqual(run.stats,report.stats);assert.equal(run.receiptStatus,receipt.status)
  assert.equal(report.stats.skipped,0);assert.equal(report.stats.flaky,0);assert.deepEqual(report.errors,[])
  assert(rows.every(v=>v.test.results.length===1));assert.deepEqual(run.titles,rows.map(v=>v.title).sort())
  assert.deepEqual(entry(run.file,prefix+'-source-before.json').sources,entry(run.file,prefix+'-source-after.json').sources)
  assert.equal(entry(run.file,prefix+'-db-stop.receipt.json').status,0)
  if(run.phase==='old-serial-timing-failure'){
    assert.equal(rows.length,13);assert.equal(report.stats.expected,12);assert.equal(report.stats.unexpected,1);assert.equal(receipt.status,1)
    assert.deepEqual(run.failures,[{title:'male native first-start stage timing without raw input',status:'unexpected'}])
  }else if(run.phase==='old-all-sdk-assumption-failure'){
    assert.equal(rows.length,2);assert.equal(report.stats.expected,0);assert.equal(report.stats.unexpected,2);assert.equal(receipt.status,1)
    assert.equal(run.summaries.length,0,'Failed hook must not fabricate final summaries')
  }else{
    const expected=['cache-control','cache-off','renderer-revocation'].includes(run.phase)?2:13
    assert.equal(rows.length,expected);assert.equal(report.stats.expected,expected);assert.equal(report.stats.unexpected,0)
    assert.equal(receipt.status,0);assert.equal(run.summaries.length,expected);assert.deepEqual(run.failures,[])
  }
  for(const summary of run.summaries){
    const data=entry(run.file,summary.original), final=data.final??data.stages.find(v=>v.name==='native-closed-before-public-record')?.snapshot
    assert.deepEqual(summary.final,final);assert.equal(summary.external,data.external);assert.deepEqual(summary.errors,data.errors)
    assert.equal(data.external,0);assert.deepEqual(data.errors,[]);assert.equal(data.actualHuman,false);assert.equal(data.actualCamera,false)
    assert(rows.some(v=>v.title===summary.title&&v.test.results[0].attachments.some(a=>a.path?.includes(dirname(summary.original)+'/'))))
    closed(final,run.timed,run.phase==='renderer-revocation')
  }
  counts[run.phase]=(counts[run.phase]??0)+rows.length
}
assert.deepEqual(counts,{'cache-control':2,'cache-off':2,'old-serial-timing-failure':13,
  'old-all-sdk-assumption-failure':2,'renderer-revocation':4,'default-154':26,'default-155':26,'timed-154':26})
assert.equal(m.originalContract.unchangedCases,24);assert.equal(m.originalContract.revisedTimingCases,2)
assert.equal(m.originalContract.revisedAdditionalRendererCases,4);assert.equal(m.originalContract.exactDocumentedRevisionOnly,true)
for(const phase of ['default-154','default-155','timed-154'])
  assert.deepEqual(m.runs.filter(v=>v.phase===phase).flatMap(v=>v.titles).sort(),m.originalContract.expandedCases)
for(const check of m.local){
  const prefix='/private/tmp/bodyguard-native-cold-stage.rrMOG8/'+check.label
  assert.equal(check.failed,0)
  for(const step of check.steps){assert.equal(step.status,0)
    assert.equal(entry(check.file,prefix+'-'+step.step+'.receipt.json').status,step.status)}
  const unit=entry(check.file,prefix+'-all-unit.json')
  assert.equal(unit.numPassedTests,check.passed);assert.equal(unit.numFailedTests,check.failed)
}
assert.equal(m.local.at(-1).passed,1432)
assert.deepEqual(m.initialUnit,{passed:156,failed:6,commandReceiptAvailable:false})
const auxiliary=m.bundles.find(v=>v.file==='initial-failures-and-drivers.json.gz')
assert(auxiliary)
const initial=entry(auxiliary.file,'/private/tmp/bodyguard-native-cold-stage.rrMOG8/parallel-unit-first.json')
assert.equal(initial.numPassedTests,156);assert.equal(initial.numFailedTests,6)
assert.deepEqual(m.environmentFailure,{label:'parallel-default-154-male',dbStart:1,browserCases:0})
assert.equal(entry(auxiliary.file,'/private/tmp/bodyguard-native-cold-stage.rrMOG8/parallel-default-154-male-db-start.receipt.json').status,1)
assert.equal(sha(gunzipSync(readFileSync(resolve(out,'baseline-nativehead.spec.ts.gz')))),m.baselineSourceSha256)
if(process.argv.includes('--current')){
  for(const source of m.sources){assert(source.path.startsWith('bodyguard/frontend/')||source.path==='bodyguard/docs/review/native-startup-browser-comparison/compare-parallel-contract.mjs')
    assert(!source.path.split('/').includes('..'));assert.equal(sha(readFileSync(resolve(root,source.path))),source.sha256)}
  execFileSync(process.execPath,[resolve(review,'compare-parallel-contract.mjs')],{stdio:'pipe'})
  for(const asset of m.publicAssets){assert(/^[A-Za-z0-9_.-]+\.(js|css)$/.test(asset.name))
    const b=readFileSync(resolve(root,'bodyguard/frontend/dist/assets',asset.name))
    assert.equal(sha(b),asset.sha256);assert.equal(b.length,asset.bytes)}
  assert(!existsSync('/private/tmp/bodyguard-auth-test.oicSqH/data/postmaster.pid'))
}
console.log(JSON.stringify({bundles:m.bundles.length,runs:12,counts,allStagesComplete:false,startupP2Resolved:false,mergeEligible:false}))
