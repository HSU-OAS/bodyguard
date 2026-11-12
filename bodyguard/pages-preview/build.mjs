// Isolated public test preview; does not enable production coaching or account APIs.
import {build} from '../frontend/node_modules/vite/dist/node/index.js'
import {patchHeadOnlyVisibility} from './headOnlyVisibility.ts'
import {copyFile,mkdir,readFile,writeFile} from 'node:fs/promises'
import {execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {dirname,resolve} from 'node:path'
import {fileURLToPath} from 'node:url'

const here=dirname(fileURLToPath(import.meta.url))
const frontend=resolve(here,'../frontend')
const repo=resolve(here,'../..')
const output=process.argv[2]
if(!output||!output.startsWith('/'))throw Error('An absolute new output directory is required')
await mkdir(output)
const base='/bodyguard'
const workerFile=resolve(frontend,'src/pose/workerNativeEngine.ts')
const observationFile=resolve(frontend,'src/avatar/observedComparison.ts')
const stageFile=resolve(frontend,'src/avatar/referenceStage.ts')
const inferenceFile=resolve(frontend,'src/pose/inferenceWorker.ts')
const runtimeFile=resolve(frontend,'src/pose/workerInference.ts')
const constantsFile=resolve(frontend,'src/pose/constants.ts')
const referenceFile=resolve(frontend,'src/avatar/referenceContentAssets.ts')
const avatarFile=resolve(frontend,'src/avatar/reviewAvatarAssets.ts')
const verifyFile=resolve(frontend,'src/avatar/verifiedReferenceAsset.ts')
const assetsFile=resolve(frontend,'src/pose/ownedModelAssets.ts')
function one(s,needle,replacement){
 if(s.split(needle).length!==2)throw Error('Preview source binding mismatch')
 return s.replace(needle,replacement)
}
function withBase(source){
 return source.replaceAll('/__bodyguard/',base+'/__bodyguard/')
  .replaceAll('/models/',base+'/models/')
  .replaceAll('/mediapipe/wasm',base+'/mediapipe/wasm')
}
function transforms(kind){
 return {name:'pages-preview-policy',enforce:'pre',transform(source,id){
  const file=id.split('?')[0]
  if(file===observationFile)return patchHeadOnlyVisibility(source)
  if(file===stageFile){
   source=one(source,'renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2))','renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5))')
   return one(source,'updateFeedback: (frame: FeedbackFrame) => feedback?.update(frame) ?? false,',"updateFeedback: (frame: FeedbackFrame) => feedback?.update(frame) ?? false,\n      getObservationCoverage: () => observed?.getCoverage() ?? null,")
  }
  if(file===inferenceFile){
   return one(source,
    "if (import.meta.env.DEV) {",
    "if (import.meta.env.DEV) return createPolicyWorker('/bodyguard/__bodyguard/inference-worker.js'); if (false) {")
  }
  if(file===runtimeFile){
   source=one(source,'function awaitResponse() {','function awaitResponse(limit = RESPONSE_LIMIT_MS) {')
   source=one(source,'responseDeadline = performance.now() + RESPONSE_LIMIT_MS','responseDeadline = performance.now() + limit')
   source=one(source,'    }, RESPONSE_LIMIT_MS)','    }, limit)')
   return one(source,'    awaitResponse()\n    await boot','    awaitResponse(20000)\n    await boot')
  }
  if(file===workerFile&&kind==='worker')return one(source,"return await create('GPU')","return await create('CPU')")
  if([constantsFile,referenceFile,avatarFile,verifyFile,assetsFile].includes(file))return withBase(source)
 }}
}
const shared={configFile:false,root:frontend,publicDir:false,mode:'development',
 define:{'import.meta.env.DEV':'true','import.meta.env.PROD':'false'},
 build:{emptyOutDir:false,copyPublicDir:false,minify:true}}
await build({...shared,plugins:[transforms('page')],build:{...shared.build,outDir:output,
 lib:{entry:resolve(here,'src/live.ts'),formats:['es'],fileName:()=> 'inspection.js'},
 rollupOptions:{output:{inlineDynamicImports:true}}}})
await mkdir(resolve(output,'__bodyguard'),{recursive:true})
await build({...shared,plugins:[transforms('worker')],build:{...shared.build,outDir:resolve(output,'__bodyguard'),
 lib:{entry:resolve(frontend,'src/pose/nativeInference.worker.ts'),formats:['iife'],name:'BodyguardPreviewWorker',fileName:()=> 'inference-worker.js'}}})
await copyFile(resolve(here,'index.html'),resolve(output,'index.html'))
await writeFile(resolve(output,'.nojekyll'),'')
async function save(rel,bytes,expectedHash){
 if(expectedHash&&createHash('sha256').update(bytes).digest('hex')!==expectedHash)throw Error('Preview asset hash mismatch: '+rel)
 const file=resolve(output,rel)
 if(!file.startsWith(output+'/'))throw Error('Output path')
 await mkdir(dirname(file),{recursive:true})
 await writeFile(file,bytes,{flag:'wx'})
}
const referenceRoot=resolve(here,'../docs/review/blender-reference-content/animations')
for(const gender of ['male','female']){
 const hash=gender==='male'?'8c3d34b9d12c1d40f2c842c0167bff2c2d6ee72a427162b4c44d62e80bbf59bf':'a9bca83ca4dad075aaef8df8f49be17bba488883485847f6c034114a663e147b'
 const body=execFileSync('git',['show','2be0ebebe731d4b2e44cd93f453ddbf76b6b581f:bodyguard/docs/review/avatar-final-refinement/continuous-20261014/models/bodyguard-'+gender+'-candidate.glb'],{cwd:repo,maxBuffer:16000000})
 await save('__bodyguard/review-avatar/'+gender+'.glb',body,hash)
 await save('__bodyguard/reference-content/'+gender+'/arm-overhead.glb',await readFile(resolve(referenceRoot,gender+'-arm-overhead.glb')))
}
const modelHashes={
 'pose_landmarker_lite.task':'59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a',
 'face_landmarker.task':'64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff',
 'gesture_recognizer.task':'97952348cf6a6a4915c2ea1496b4b37ebabc50cbbf80571435643c455f2b0482',
}
for(const [name,hash] of Object.entries(modelHashes))
 await save('models/'+name,await readFile(resolve(frontend,'public/models',name)),hash)
for(const name of ['vision_wasm_internal.js','vision_wasm_internal.wasm','vision_wasm_module_internal.js','vision_wasm_module_internal.wasm','vision_wasm_nosimd_internal.js','vision_wasm_nosimd_internal.wasm'])
 await save('mediapipe/wasm/'+name,await readFile(resolve(frontend,'public/mediapipe/wasm',name)))
await save('THIRD_PARTY.md',await readFile(resolve(here,'THIRD_PARTY.md')))
await save('licenses/three-LICENSE.txt',await readFile(resolve(frontend,'node_modules/three/LICENSE')))
await save('licenses/APACHE-2.0.txt',await readFile(resolve(here,'../docs/review/upstream-license-evidence/6-LICENSE-APACHE.txt')))
await save('licenses/mediapipe-partial-notice.txt',await readFile(resolve(here,'../docs/review/embedded-package-notices/verified-evidence/mediapipe-101-NOTICE.txt')))
console.log('Isolated webcam preview built:',output)
