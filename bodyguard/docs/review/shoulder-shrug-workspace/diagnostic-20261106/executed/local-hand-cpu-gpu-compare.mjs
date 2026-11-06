import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { chromium } from '@playwright/test'
import { createServer, mergeConfig } from 'vite'
import config from '../vite.config.ts'
const scratch = '/private/tmp/bodyguard-shrug-workspace.kDf9Sm'
const data = readFileSync(`${scratch}/official-thumb.jpg`)
const sha = createHash('sha256').update(data).digest('hex')
assert.equal(sha, '5d673c081ab13b8a1812269ff57047066f9c33c07db5f4178089e8cb3fdc0291')
const server = await createServer(mergeConfig(config, {configFile:false, cacheDir:`${scratch}/hand-cache`, server:{host:'127.0.0.1',port:0}}))
let browser
try {
  await server.listen()
  const origin=server.resolvedUrls.local[0]
  browser=await chromium.launch({channel:'chrome',headless:true,proxy:{server:'http://127.0.0.1:1',bypass:`<-loopback>,${new URL(origin).host}`}})
  const context=await browser.newContext({serviceWorkers:'block'})
  let external=0
  await context.route('**/*', async route => {
    const url=new URL(route.request().url())
    if(url.origin!==new URL(origin).origin){external++; return route.abort()}
    if(url.pathname==='/__bodyguard-test/hand.jpg')return route.fulfill({status:200,contentType:'image/jpeg',body:data})
    return route.continue()
  })
  const page=await context.newPage()
  const errors=[]
  page.on('pageerror', error => errors.push(error.name))
  await page.goto(origin)
  const result=await page.evaluate(async()=> (await import('/e2e/fixtures/local-hand-cpu-gpu-compare.ts')).compareHandImage())
  const report={source:'Google MediaPipe test thumb_up.jpg, generation 1662650667349746',sha256:sha, browser:browser.version(),method:'single static hand image, 20 repeated VIDEO-mode frames; aggregate landmark comparison, no webcam',result,external,errors}
  writeFileSync(`${scratch}/hand-static-cpu-gpu.json`,JSON.stringify(report,null,2))
  console.log(JSON.stringify(report))
} finally {await browser?.close(); await server.close()}
