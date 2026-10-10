import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { createServer } from 'node:http'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { join, resolve } from 'node:path'
const [frontend, input, output] = process.argv.slice(2)
const { chromium } = createRequire(join(frontend, 'package.json'))('@playwright/test')
await mkdir(output)
const server = createServer(async (req, res) => {
  try {
    const path = new URL(req.url, 'http://127.0.0.1').pathname
    let file = 'index.html'
    if (path.startsWith('/assets/')) {
      assert(/^\/assets\/[A-Za-z0-9_-]+\.(?:js|css)$/.test(path))
      file = path.slice(1)
    } else if (path === '/brand/google-icon.png') file = path.slice(1)
    else assert(!/\.(?:wasm|task|glb|blend|map)$/.test(path))
    const bytes = await readFile(join(input, file))
    res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.png') ? 'image/png' : 'text/html')
    res.setHeader('Cache-Control', 'no-store')
    res.end(bytes)
  } catch { res.writeHead(404).end() }
})
await new Promise(done => server.listen(0, '127.0.0.1', done))
const origin = 'http://127.0.0.1:' + server.address().port
const browser = await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true})
const result = {browser:browser.version(),kind:'real production Chrome, controlled account responses; not actual API/SQL/TLS',screens:[],pageErrors:[],blockedRequests:[],cameraCalls:0}
try {
  for (const width of [1440,1024]) {
    const context = await browser.newContext({viewport:{width,height:900}})
    const page = await context.newPage()
    page.on('pageerror', e => result.pageErrors.push(String(e)))
    await context.addInitScript(() => {
      window.__cameraCalls = 0
      const media = navigator.mediaDevices ?? {}
      Object.defineProperty(media,'getUserMedia',{value:async () => {window.__cameraCalls++;throw new Error('camera not allowed')}})
      if (!navigator.mediaDevices) Object.defineProperty(navigator,'mediaDevices',{value:media})
    })
    await context.route('**/*', async route => {
      const url = new URL(route.request().url())
      if (url.origin !== origin || /\.(?:glb|blend|wasm|task)(?:$|\?)/.test(url.pathname)) {result.blockedRequests.push(url.origin + url.pathname);return route.abort()}
      if (url.pathname.startsWith('/api/')) {
        const me = url.pathname === '/api/v1/me'
        return route.fulfill({status:me?401:200,contentType:'application/json',body:JSON.stringify(me?{}:url.pathname.endsWith('/csrf')?{csrf_token:'a'.repeat(64)}:{configured:false})})
      }
      return route.continue()
    })
    await page.goto(origin + '/missing-private-fixture?token=fixture#private')
    await page.getByRole('heading',{level:1,name:'페이지를 찾을 수 없습니다'}).waitFor()
    const capture = async (name,expected) => {
      const title = await page.title()
      const body = await page.locator('body').innerText()
      const screenshot = name + '-' + width + '.png'
      await page.screenshot({path:join(output,screenshot),fullPage:true})
      result.screens.push({name,width,expected,title,passed:title===expected,bodySha256:createHash('sha256').update(body).digest('hex'),screenshot})
      result.cameraCalls += await page.evaluate(() => window.__cameraCalls)
    }
    await capture('missing','페이지를 찾을 수 없습니다 · BODYGUARD')
    await page.getByRole('link',{name:'서비스 소개로 돌아가기'}).click()
    await page.getByRole('heading',{name:'내 몸을 이해하는 스트레칭'}).waitFor()
    await capture('home','서비스 소개 · BODYGUARD')
    await page.getByRole('link',{name:'로그인',exact:true}).click()
    await page.getByRole('heading',{name:'다시 만나 반갑습니다'}).waitFor()
    await capture('login','로그인 · BODYGUARD')
    await page.goto(origin + '/HELP///')
    await page.getByRole('heading',{level:1,name:'도움말'}).waitFor()
    assert.equal(await page.getByRole('link',{name:'도움말',exact:true}).getAttribute('aria-current'),'page')
    await capture('help-case-slash','도움말 · BODYGUARD')
    await page.goto(origin + '/LOGIN/')
    await page.getByRole('heading',{name:'다시 만나 반갑습니다'}).waitFor()
    await capture('login-case-slash','로그인 · BODYGUARD')
    await context.close()
  }
  result.passed = result.screens.every(x=>x.passed) && !result.pageErrors.length && !result.blockedRequests.length && result.cameraCalls===0
  await writeFile(join(output,'report.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'})
  console.log(JSON.stringify(result,null,2))
  if (!result.passed) process.exitCode=1
} finally { await browser.close();await new Promise(done=>server.close(done)) }
