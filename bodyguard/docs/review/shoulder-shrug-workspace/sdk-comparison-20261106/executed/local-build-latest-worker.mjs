import { build } from 'vite'
import { writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
const pkg='/private/tmp/bodyguard-sdk-compare-122/package/vision_bundle.mjs'
const result=await build({configFile:false,publicDir:false,logLevel:'error',resolve:{alias:{'@mediapipe/tasks-vision':pkg}},build:{write:false,minify:false,lib:{entry:'src/pose/nativeInference.worker.ts',name:'BodyguardInferenceWorker',formats:['iife']}}})
const chunks=(Array.isArray(result)?result:[result]).flatMap((item)=>item.output).filter((item)=>item.type==='chunk')
if(chunks.length!==1) throw Error('worker bundle unavailable')
writeFileSync('/private/tmp/bodyguard-sdk-compare-122/worker-122.js',chunks[0].code)
console.log(createHash('sha256').update(chunks[0].code).digest('hex'))
