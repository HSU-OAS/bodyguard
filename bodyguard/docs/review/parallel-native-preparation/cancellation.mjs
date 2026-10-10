// FR-M-02/07·NFR-02/07/08: real SDK, synthetic blank input, no camera/3D/clinical output.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { resolve, join } from 'node:path'
const [frontend, baseline, candidate, output] = process.argv.slice(2)
assert(/^\/private\/tmp\/bodyguard-parallel-preparation\.[A-Za-z0-9]+\/comparison-[a-z0-9-]+\.json$/.test(output))
assert(!existsSync(output), 'Keep previous evidence')
const { chromium } = createRequire(join(frontend, 'package.json'))('@playwright/test')
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
function bundle(root) {
  assert(/^\/private\/tmp\/bodyguard-inference-thread\.[A-Za-z0-9]+\/probe$/.test(root))
  const probe = readFileSync(join(root,'probe.js'))
  const workers = [...new Set(probe.toString().match(/nativeInference\.worker-[\w-]+\.js/g) ?? [])]
  assert.equal(workers.length,1)
  const worker = readFileSync(join(root,'assets',workers[0]))
  return {map:new Map([['/probe.js',[probe,'application/javascript']],['/assets/'+workers[0],[worker,'application/javascript']]]),probeSha:hash(probe),workerSha:hash(worker)}
}
const bundles = {baseline:bundle(baseline),candidate:bundle(candidate)}
const common = new Map()
for (const name of ['vision_wasm_internal.js','vision_wasm_internal.wasm','vision_wasm_module_internal.js','vision_wasm_module_internal.wasm','vision_wasm_nosimd_internal.js','vision_wasm_nosimd_internal.wasm']) common.set('/mediapipe/wasm/'+name,[readFileSync(join(frontend,'public/mediapipe/wasm',name)),name.endsWith('.js')?'application/javascript':'application/wasm'])
for (const name of ['pose_landmarker_lite','face_landmarker','gesture_recognizer']) common.set('/models/'+name+'.task',[readFileSync(join(frontend,'public/models',name+'.task')),'application/octet-stream'])
let active = bundles.baseline.map, proxyAttempts=0, blocked=0, proxySocketErrors=0
const requested = new Set(), pageErrors=[], results=[]
let gestureRequested, releaseGesture
const gestureWaiting = new Promise(resolve => { gestureRequested = resolve })
const server=createServer((req,res)=>{
  const path=new URL(req.url,'http://localhost').pathname
  requested.add(path)
  res.setHeader('Content-Security-Policy', "connect-src 'self'; worker-src 'self'")
  res.setHeader('Cache-Control','no-store')
  if(path==='/') {res.setHeader('Content-Type','text/html');res.end('<!doctype html><html lang="ko"><body><script type="module">import{mountInferenceThreadProbe}from"/probe.js";window.mount=mountInferenceThreadProbe</script></body></html>')}
  else {
    const data=active.get(path)??common.get(path)
    if(!data){res.writeHead(404).end();return}
    res.setHeader('Content-Type',data[1]);
    if(path==='/models/gesture_recognizer.task') {releaseGesture=()=>res.end(data[0]);gestureRequested();return}
    res.end(data[0])
  }
})
const proxy=createServer((_req,res)=>{proxyAttempts++;res.writeHead(403).end()})
proxy.on('connect',(_req,socket)=>{proxyAttempts++;socket.on('error',()=>{proxySocketErrors++});socket.end('HTTP/1.1 403 Forbidden\r\n\r\n')})
const listen=s=>new Promise((yes,no)=>{s.once('error',no);s.listen(0,'127.0.0.1',yes)})
const stop=s=>new Promise(yes=>{s.closeAllConnections();s.close(yes)})
async function bounded(promise) {
  let timer
  try{return await Promise.race([promise,new Promise((_yes,no)=>{timer=setTimeout(()=>no(new Error('Existing 5000ms bound exceeded')),5000)})])}
  finally{clearTimeout(timer)}
}
let browser, version, failure
try {
  await listen(server);await listen(proxy)
  const host='127.0.0.1:'+server.address().port, origin='http://'+host
  const launch = {executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',proxy:{server:'http://127.0.0.1:'+proxy.address().port,bypass:'<-loopback>,'+host}}
  for(const mode of ['candidate']) {
    browser=await chromium.launch(launch)
    version=browser.version()
    active=bundles[mode].map
    const item={mode,passed:false}
    const context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'})
    try {
      await context.route('**/*',route=>{if(route.request().url().startsWith(origin+'/'))return route.continue();blocked++;return route.abort()})
      await context.addInitScript(()=>{
        let cameras=0,workers=0,terminations=0
        if(navigator.mediaDevices)navigator.mediaDevices.getUserMedia=async()=>{cameras++;throw new Error('No camera in comparison')}
        const NativeWorker=Worker
        globalThis.Worker=class extends NativeWorker {
          constructor(...args){super(...args);workers++}
          terminate(){terminations++;return super.terminate()}
        }
        window.ownership=()=>({cameras,workers,terminations,storageKeys:localStorage.length+sessionStorage.length})
      })
      const page=await context.newPage()
      page.on('pageerror',e=>pageErrors.push(e.name))
      await page.goto(origin)
      await page.waitForFunction(()=>typeof window.mount==='function',null,{timeout:5000})
      await page.evaluate(()=>{window.probe=window.mount('worker')})
      await page.evaluate(()=>{window.preparing=window.probe.begin().then(()=>({resolved:true}),()=>({resolved:false}))})
      await bounded(gestureWaiting)
      item.beforeAbort=await page.evaluate(()=>window.probe.snapshot())
      assert.equal(item.beforeAbort.state,'preparing')
      await page.evaluate(()=>{window.closing=window.probe.close()})
      releaseGesture()
      item.preparationOutcome=await bounded(page.evaluate(()=>window.preparing))
      item.closed=await bounded(page.evaluate(()=>window.closing))
      item.result=await page.evaluate(()=>window.probe.snapshot())
      item.ownership=await page.evaluate(()=>window.ownership())
      assert.equal(item.result.state,'closed');assert.equal(item.closed.state,'closed');assert.equal(item.preparationOutcome.resolved,false)
      assert.equal(item.result.frames,0);assert.equal(item.result.closes,0)
      assert.equal(item.result.timings.length,0)
      assert.equal(item.ownership.cameras,0);assert.equal(item.ownership.storageKeys,0)
      assert.equal(item.ownership.workers,1);assert.equal(item.ownership.terminations,1)
      assert.equal(item.result.concurrentRejected,false)
      assert(item.result.timings.every(n=>Number.isFinite(n)&&n>0))
      assert.equal(item.result.readyMs,null)
      item.preparePlusFirstMs=item.result.readyMs+item.result.firstMs
      item.passed=true
    } catch(e) {
      item.failure={name:e.name,message:e.message}
      throw e
    } finally {results.push(item);await context.close();await browser.close();browser=undefined}
  }
  assert.equal(pageErrors.length,0);assert.equal(blocked,0)
  assert(![...requested].some(path=>/^\/api(?:\/|$)|\.glb$|avatar/.test(path)))
} catch(e){failure={name:e.name,message:e.message}}
finally {
  try{await browser?.close()}catch{failure??={name:'CleanupError',message:'Browser close failed'}}
  await stop(server);await stop(proxy)
  const technicalPassed=!failure&&results.length===1&&results.every(x=>x.passed)
  const bothPairsFaster=null
  const report={method:'Real candidate Worker cancelled while gesture-model response held; response released after abort; no inference/camera/avatar; synthetic network delay is not a native hang',version,bundles:Object.fromEntries(Object.entries(bundles).map(([k,v])=>[k,{probeSha:v.probeSha,workerSha:v.workerSha}])),assetHashes:Object.fromEntries([...common].map(([k,[v]])=>[k,hash(v)])),results,requested:[...requested],proxyAttempts,proxySocketErrors,blocked,pageErrors,technicalPassed,bothPairsFaster,failure:failure??null}
  writeFileSync(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'})
  console.log(JSON.stringify({output,technicalPassed,bothPairsFaster,results:results.map(x=>({mode:x.mode,readyMs:x.result?.readyMs,firstMs:x.result?.firstMs,preparePlusFirstMs:x.preparePlusFirstMs,passed:x.passed})),failure:failure??null}))
  if(!technicalPassed)process.exitCode=1
}
