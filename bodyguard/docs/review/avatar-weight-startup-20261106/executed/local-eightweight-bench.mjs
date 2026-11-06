import {createServer, mergeConfig} from 'vite'
import {chromium} from '@playwright/test'
import {writeFileSync} from 'node:fs'
import config from '../vite.config.ts'
const server=await createServer(mergeConfig(config,{configFile:false,cacheDir:'/private/tmp/bodyguard-weight-bench-cache',server:{host:'127.0.0.1',port:0}}))
let browser
try {
 await server.listen()
 const origin=server.resolvedUrls.local[0]
 browser=await chromium.launch({channel:'chrome',headless:true,proxy:{server:'http://127.0.0.1:1',bypass:`<-loopback>,${new URL(origin).host}`}})
 const context=await browser.newContext({serviceWorkers:'block'})
 let external=0
 await context.route('**/*',route=>{if(new URL(route.request().url()).origin!==new URL(origin).origin){external++;return route.abort()}return route.continue()})
 const page=await context.newPage()
 await page.goto(origin)
 const result=await page.evaluate(async()=> (await import('/e2e/fixtures/local-eightweight-bench.ts')).runWeightBench())
 const report={browser:browser.version(),external,result}
 writeFileSync('/private/tmp/bodyguard-weight-bench.json',JSON.stringify(report,null,2))
 console.log(JSON.stringify(report))
}finally{await browser?.close();await server.close()}
