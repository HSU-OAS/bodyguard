import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createServer} from 'node:http'
import {pathToFileURL} from 'node:url'
const [work,proof,label]=process.argv.slice(2)
assert(/^\/private\/tmp\/bodyguard-native-recovery-proof\.[A-Za-z0-9]+$/.test(proof))
const file=proof+'/permission-'+label+'.json'
assert(!fs.existsSync(file))
const {chromium}=await import(pathToFileURL(work+'/bodyguard/frontend/node_modules/@playwright/test/index.mjs'))
const server=createServer((_,res)=>res.end('<!doctype html><title>Private permission test</title>'))
await new Promise(r=>server.listen(0,'127.0.0.1',r))
const origin='http://127.0.0.1:'+server.address().port
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-fake-device-for-media-stream']})
const results=[]
try{
 for(const mode of ['cdp','cdp-clear','cdp-ptz','cdp-no-ptz','grant-empty','clear-empty']){
  const context=await browser.newContext({permissions:['camera']})
  try{
   const page=await context.newPage();await page.goto(origin)
   const cdp=await context.newCDPSession(page)
   const {targetInfo}=await cdp.send('Target.getTargetInfo')
   assert(targetInfo.browserContextId)
   if(mode==='cdp-clear'||mode==='clear-empty')await context.clearPermissions()
   if(mode==='grant-empty'||mode==='clear-empty')await context.grantPermissions([],{origin})
   else await cdp.send('Browser.setPermission',{permission:{name:'camera',...(mode==='cdp-ptz'?{panTiltZoom:true}:mode==='cdp-no-ptz'?{panTiltZoom:false}:{})},setting:'denied',origin,browserContextId:targetInfo.browserContextId})
   const state=await page.evaluate(async()=>({camera:(await navigator.permissions.query({name:'camera'})).state,ptz:(await navigator.permissions.query({name:'camera',panTiltZoom:true})).state}))
   let native='not-requested-prompt'
   if(state.camera!=='prompt')native=await page.evaluate(async()=>{try{const s=await navigator.mediaDevices.getUserMedia({video:true});s.getTracks().forEach(t=>t.stop());return 'granted-then-stopped'}catch(e){return e instanceof DOMException?e.name:'unknown'}})
   await cdp.detach()
   const afterDetach=await page.evaluate(async()=>(await navigator.permissions.query({name:'camera'})).state)
   results.push({mode,state,native,afterDetach,actualCamera:false,actualPopup:false})
  }finally{await context.close()}
 }
}finally{await browser.close();await new Promise(r=>server.close(r))}
const receipt={browser:'chrome',results,actualHuman:false,physicalCamera:false,rawFramesExported:0}
fs.writeFileSync(file,JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(receipt))
