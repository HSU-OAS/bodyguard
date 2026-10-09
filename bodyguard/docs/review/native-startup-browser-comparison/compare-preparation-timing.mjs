// NFR-07/08: observed retained stage intervals, not a controlled causal or human benchmark.
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
const review=dirname(fileURLToPath(import.meta.url)), read=p=>JSON.parse(readFileSync(p))
const old=read(resolve(review,'manifest.json')), next=read(resolve(review,'parallel-preparation/manifest.json'))
function values(title,final){
  const t=final.startupTiming
  assert(t&&t.closed&&!t.invalid)
  const first=stage=>{const row=t.events.find(v=>v.stage===stage);assert(row&&row.endMs!==null,stage);return row}
  const camera=first('camera'), sdk=first('body-sdk'), hands=first('hands-sdk'), avatar=first('avatar'), render=first('render')
  const results=t.events.filter(v=>v.stage==='result');assert.equal(results.length,3)
  assert(results.every(v=>v.endMs!==null))
  return{title,sdkChainMs:hands.endMs-sdk.startMs,avatarMs:avatar.endMs-avatar.startMs,
    overlapMs:Math.max(0,Math.min(avatar.endMs,hands.endMs)-Math.max(avatar.startMs,sdk.startMs)),
    cameraReadyToRenderMs:render.startMs-camera.endMs,cameraReadyToThirdResultMs:results[2].endMs-camera.endMs,
    firstResultMs:results[0].endMs-results[0].startMs}
}
const before=old.runs.filter(v=>v.fullTiming).flatMap(run=>run.snapshots.filter(v=>v.kind==='native-hands-summary.json').map(item=>{
  const data=JSON.parse(gunzipSync(readFileSync(resolve(review,item.file))))
  return values(item.title,data.final??data.stages.find(v=>v.name==='native-closed-before-public-record')?.snapshot)
}))
const after=next.runs.filter(v=>v.phase==='timed-154').flatMap(run=>run.summaries.map(item=>values(item.title,item.final)))
assert.equal(before.length,26);assert.equal(after.length,26)
assert.deepEqual(before.map(v=>v.title).sort(),after.map(v=>v.title).sort())
const fields=['sdkChainMs','avatarMs','overlapMs','cameraReadyToRenderMs','cameraReadyToThirdResultMs','firstResultMs']
function aggregate(rows){return Object.fromEntries(fields.map(field=>{
  const sorted=rows.map(v=>v[field]).sort((a,b)=>a-b),round=v=>Math.round(v*10)/10
  return[field,{min:round(sorted[0]),median:round((sorted[12]+sorted[13])/2),max:round(sorted.at(-1))}]
}))}
const result={beforeCases:26,afterCases:26,before:aggregate(before),after:aggregate(after),
  observedOverlapCasesBefore:before.filter(v=>v.overlapMs>0).length,
  observedOverlapCasesAfter:after.filter(v=>v.overlapMs>0).length,
  timingInstrumented:true,controlledCausalComparison:false,actualCamera:false,actualHuman:false,
  modelQualityChanged:false,historicalRootCauseProven:false,startupP2Resolved:false,rows:{before,after}}
if(process.argv.includes('--save'))writeFileSync(resolve(review,'parallel-preparation/timing-comparison.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'})
console.log(JSON.stringify({...result,rows:undefined}))
