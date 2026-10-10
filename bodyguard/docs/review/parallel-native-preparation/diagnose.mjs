// FR-M-02/07·NFR-02/07/08: real SDK, synthetic blank input, no camera/3D/clinical output.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { resolve, join } from 'node:path'
const [frontend, baseline, candidate, output] = process.argv.slice(2)
assert(/^\/private\/tmp\/bodyguard-preparation-diagnostic\.[A-Za-z0-9]+\/diagnostic-results\.json$/.test(output))
assert(!existsSync(output), 'Keep previous evidence')
const { chromium } = createRequire(join(frontend, 'package.json'))('@playwright/test')
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
function bundle(root) {
  assert(/^\/private\/tmp\/bodyguard-preparation-diagnostic\.[A-Za-z0-9]+\/(baseline|candidate)$/.test(root))
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
const server=createServer((req,res)=>{
  const path=new URL(req.url,'http://localhost').pathname
  requested.add(path)
  res.setHeader('Content-Security-Policy', "connect-src 'self'; worker-src 'self'")
  res.setHeader('Cache-Control','no-store')
  if(path==='/') {res.setHeader('Content-Type','text/html');res.end('<!doctype html><html lang="ko"><body><script type="module">import{mountInferenceThreadProbe}from"/probe.js";window.mount=mountInferenceThreadProbe</script></body></html>')}
  else {
    const data=active.get(path)??common.get(path)
    if(!data){res.writeHead(404).end();return}
    res.setHeader('Content-Type',data[1]);res.end(data[0])
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
  for(const mode of ['baseline','candidate','candidate','baseline']) {
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
        const observations=[]
        window.preparationDiagnostics=()=>observations.map(x=>({...x,attempts:x.attempts.map(y=>({...y}))}))
        const NativeWorker=Worker
        globalThis.Worker=class extends NativeWorker {
          constructor(...args){super(...args);workers++;this.addEventListener('message',event=>{
            const data=event.data
            if(!['ready','closed','error'].includes(data?.type)||!data.preparationDiagnostic)return
            const diagnostic=data.preparationDiagnostic
            observations.push({type:data.type,elapsedMs:diagnostic.elapsedMs,
              attempts:diagnostic.attempts.map(({task,requestedDelegate,startedMs,durationMs,outcome,closes})=>({task,requestedDelegate,startedMs,durationMs,outcome,closes}))})
          })}
          terminate(){terminations++;return super.terminate()}
        }
        window.ownership=()=>({cameras,workers,terminations,storageKeys:localStorage.length+sessionStorage.length})
      })
      const page=await context.newPage()
      page.on('pageerror',e=>pageErrors.push(e.name))
      await page.goto(origin)
      await page.waitForFunction(()=>typeof window.mount==='function',null,{timeout:5000})
      await page.evaluate(()=>{window.probe=window.mount('worker')})
      await bounded(page.evaluate(()=>window.probe.begin()))
      await bounded(page.evaluate(()=>window.probe.run()))
      item.result=await page.evaluate(()=>window.probe.snapshot())
      item.closed=await bounded(page.evaluate(()=>window.probe.close()))
      item.ownership=await page.evaluate(()=>window.ownership())
      item.diagnostics=await page.evaluate(()=>window.preparationDiagnostics())
      const ready=item.diagnostics.find(x=>x.type==='ready'),closed=item.diagnostics.find(x=>x.type==='closed')
      assert(ready&&closed,'Bounded factory observations required')
      assert.equal(ready.attempts.length,closed.attempts.length)
      assert(ready.attempts.length>=3&&ready.attempts.length<=6)
      for(const stage of closed.attempts){
        assert(['body','face','hands'].includes(stage.task));assert(['GPU','CPU'].includes(stage.requestedDelegate))
        assert(['fulfilled','rejected'].includes(stage.outcome));assert(Number.isFinite(stage.startedMs)&&stage.startedMs>=0)
        assert(Number.isFinite(stage.durationMs)&&stage.durationMs>0);assert.equal(stage.closes,stage.outcome==='fulfilled'?1:0)
      }
      assert.equal(item.result.state,'ready');assert.equal(item.closed.state,'closed')
      assert.equal(item.result.frames,3);assert.equal(item.result.closes,3)
      assert.equal(item.result.timings.length,3)
      assert.equal(item.ownership.cameras,0);assert.equal(item.ownership.storageKeys,0)
      assert.equal(item.ownership.workers,1);assert.equal(item.ownership.terminations,1)
      assert.equal(item.result.concurrentRejected,true)
      assert(item.result.timings.every(n=>Number.isFinite(n)&&n>0))
      assert(Number.isFinite(item.result.readyMs)&&item.result.readyMs>0)
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
  const technicalPassed=!failure&&results.length===4&&results.every(x=>x.passed)
  const bothPairsFaster=technicalPassed&&[[0,1],[3,2]].every(([b,c])=>results[c].preparePlusFirstMs<results[b].preparePlusFirstMs&&results[c].result.readyMs<results[b].result.readyMs)
  const report={method:'Test-only public SDK factory observers; fresh browser/profile ABBA, synthetic blank640x480; requested delegate and CPU retry only, NOT proof of actual GPU kernel execution; instrumented timings NOT original acceptance evidence',version,bundles:Object.fromEntries(Object.entries(bundles).map(([k,v])=>[k,{probeSha:v.probeSha,workerSha:v.workerSha}])),assetHashes:Object.fromEntries([...common].map(([k,[v]])=>[k,hash(v)])),results,requested:[...requested],proxyAttempts,proxySocketErrors,blocked,pageErrors,technicalPassed,bothPairsFaster,failure:failure??null}
  writeFileSync(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'})
  console.log(JSON.stringify({output,technicalPassed,bothPairsFaster,results:results.map(x=>({mode:x.mode,readyMs:x.result?.readyMs,firstMs:x.result?.firstMs,preparePlusFirstMs:x.preparePlusFirstMs,passed:x.passed,attempts:x.diagnostics?.find(d=>d.type==='closed')?.attempts})),failure:failure??null}))
  if(!technicalPassed)process.exitCode=1
}
