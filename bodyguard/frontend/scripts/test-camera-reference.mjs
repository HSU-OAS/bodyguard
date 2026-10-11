// Actual Chrome/React/client interaction with synthetic input and controlled API only.
import assert from 'node:assert/strict'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer as createHTTPServer } from 'node:http'
import { resolve } from 'node:path'
import { chromium } from '@playwright/test'
import { createServer, mergeConfig } from 'vite'
import config from '../vite.config.ts'

const [scratch, executable] = process.argv.slice(2)
assert(/^\/private\/tmp\/bodyguard-camera-reference\.[A-Za-z0-9]+$/.test(scratch))
assert(executable && !existsSync(`${scratch}/browser.json`))
const cases = [],
  errors = [],
  writes = []
let mode = 'normal',
  pending,
  browser,
  failure,
  camera = 0,
  external = 0
const api = createHTTPServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', 'no-store')
  if (req.url === '/api/v1/me')
    res.end('{"id":"00000000-0000-4000-8000-000000000001","email":"fixture@example.com"}')
  else if (req.url === '/api/v1/auth/csrf') res.end(JSON.stringify({ csrf_token: 'a'.repeat(64) }))
  else if (req.url === '/api/v1/baselines' && req.method === 'POST') {
    let body = ''
    for await (const chunk of req) {
      body += chunk
      assert(body.length < 4096)
    }
    const value = JSON.parse(body)
    assert.deepEqual(Object.keys(value).sort(), [
      'client_version',
      'id',
      'neck',
      'shoulder',
      'trunk',
    ])
    assert.deepEqual(value.shoulder, {
      method: 'image-plane-shoulder-axial-v1',
      unit: 'deg',
      value: 0,
    })
    assert.equal(value.neck, null)
    assert.equal(value.trunk, null)
    assert.equal(req.headers['x-account-id'], '00000000-0000-4000-8000-000000000001')
    assert.equal(req.headers['x-csrf-token'], 'a'.repeat(64))
    writes.push(value)
    const historical = mode === 'historical'
    const send = () => {
      if (res.destroyed) return
      res.writeHead(historical ? 200 : 201)
      res.end(
        JSON.stringify({
          ...value,
          is_active: !historical,
          provenance: 'client-reported',
          created_at: '2026-10-12T00:00:00Z',
        }),
      )
    }
    if (mode === 'hold') pending = send
    else if (mode === 'fail') {
      mode = 'normal'
      res.writeHead(503)
      res.end('{}')
    } else if (mode === 'authority') {
      res.writeHead(403)
      res.end('{}')
    } else send()
  } else {
    res.writeHead(404)
    res.end('{}')
  }
})
await new Promise((yes, no) => {
  api.once('error', no)
  api.listen(0, '127.0.0.1', yes)
})
const target = resolve('src/pose/cameraPreparation.ts')
const synthetic = readFileSync(resolve('e2e/fixtures/cameraReferenceSource.ts'), 'utf8')
const server = await createServer(
  mergeConfig(config, {
    configFile: false,
    envDir: scratch,
    plugins: [
      {
        name: 'isolated-camera-reference-fixture',
        enforce: 'pre',
        load(id) {
          if (id.split('?')[0] === target) return synthetic
        },
      },
    ],
    server: {
      host: '127.0.0.1',
      port: 0,
      open: false,
      proxy: { '/api': `http://127.0.0.1:${api.address().port}` },
    },
  }),
)
try {
  await server.listen()
  const origin = server.resolvedUrls.local[0]
  browser = await chromium.launch({
    executablePath: executable,
    proxy: { server: 'http://127.0.0.1:1', bypass: `<-loopback>,${new URL(origin).host}` },
  })
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1100 },
    reducedMotion: 'reduce',
    serviceWorkers: 'block',
  })
  await context.addInitScript(() => {
    window.referenceCameraCalls = 0
    navigator.mediaDevices.getUserMedia = async () => {
      window.referenceCameraCalls++
      throw new Error('Physical camera forbidden in synthetic reference test')
    }
  })
  context.on('request', (request) => {
    if (new URL(request.url()).origin !== new URL(origin).origin) external++
  })
  const page = await context.newPage()
  page.on('pageerror', (error) => errors.push(error.name))
  const open = async () => {
    await page.goto(`${origin}dev/coaching?motion=neck-side`)
    await page.getByRole('button', { name: '카메라 확인', exact: true }).click()
    await page.getByRole('button', { name: '입력 확인', exact: true }).click()
  }
  const collect = async () => {
    await page.getByRole('button', { name: '3초 기준 수집', exact: true }).click()
    await page.getByRole('checkbox').waitFor()
    assert.equal(
      await page.getByRole('button', { name: '기준 저장', exact: true }).isDisabled(),
      true,
    )
    assert.match(await page.getByText(/화면상 어깨선/).innerText(), /0\.0°/)
    await page.getByRole('checkbox').check()
  }
  await open()
  await collect()
  assert.equal(writes.length, 0)
  await page.getByRole('button', { name: '기준 저장', exact: true }).click()
  await page.getByRole('button', { name: '기준 저장됨', exact: true }).waitFor()
  assert.equal(writes.length, 1)
  assert.equal(
    await page
      .getByRole('button', { name: '기준 저장됨', exact: true })
      .evaluate((el) => el === document.activeElement),
    true,
  )
  await page.screenshot({ path: `${scratch}/reference-saved-1440.png`, fullPage: true })
  cases.push('explicit three-second synthetic input→review→consent→scalar save, focus retained')
  await page.getByRole('button', { name: '카메라 끄기', exact: true }).click()
  assert.equal(await page.getByRole('checkbox').count(), 0)
  cases.push('camera off drops the reference review')
  await open()
  await collect()
  mode = 'fail'
  await page.getByRole('button', { name: '기준 저장', exact: true }).click()
  await page.getByRole('button', { name: '기준 저장 다시 시도', exact: true }).waitFor()
  await page.screenshot({ path: `${scratch}/reference-retry-1440.png`, fullPage: true })
  await page.getByRole('button', { name: '기준 저장 다시 시도', exact: true }).click()
  await page.getByRole('button', { name: '기준 저장됨', exact: true }).waitFor()
  assert.deepEqual(writes[1], writes[2])
  cases.push('controlled503→explicit retry with exactly the same ID/values')
  await open()
  await collect()
  mode = 'historical'
  await page.getByRole('button', { name: '기준 저장', exact: true }).click()
  await page.getByText(/저장 이력은 확인했지만 현재 기준은 달라졌습니다/).waitFor()
  assert.equal(await page.getByRole('button', { name: '기준 저장됨', exact: true }).count(), 0)
  const historicalWrites = writes.length
  await page.getByRole('button', { name: '저장 이력 확인됨', exact: true }).focus()
  await page.keyboard.press('Enter')
  assert.equal(writes.length, historicalWrites)
  await page.screenshot({ path: `${scratch}/reference-historical-1440.png`, fullPage: true })
  cases.push(
    'historical200 preserves inactive history, no current replacement/success or extra write',
  )
  await open()
  await collect()
  mode = 'hold'
  await page.getByRole('button', { name: '기준 저장', exact: true }).click()
  await page.waitForFunction(() =>
    document.querySelector('.camera-reference')?.textContent.includes('기준 저장 중'),
  )
  for (let i = 0; i < 100 && typeof pending !== 'function'; i++)
    await new Promise((yes) => setTimeout(yes, 20))
  assert.equal(typeof pending, 'function', 'Held POST must arrive before testing cancellation')
  await page.getByRole('button', { name: '동작 변경', exact: true }).click()
  await page.getByRole('button', { name: '팔 위로 뻗기 화면에서 보기', exact: true }).click()
  await page.getByRole('button', { name: '카메라 확인', exact: true }).waitFor()
  pending()
  mode = 'normal'
  await page.waitForTimeout(100)
  assert.equal(await page.getByRole('button', { name: '기준 저장됨', exact: true }).count(), 0)
  assert.equal(await page.getByRole('checkbox').count(), 0)
  cases.push('motion switch cancels a held write; late response cannot publish')
  await open()
  await page.setViewportSize({ width: 800, height: 1000 })
  await page.evaluate(() => {
    window.referenceFixture.paused = true
  })
  await page.getByRole('button', { name: '3초 기준 수집', exact: true }).click()
  await page.getByRole('alert').filter({ hasText: '입력이 끊겼습니다' }).waitFor()
  assert.equal(await page.getByRole('checkbox').count(), 0)
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
  await page.screenshot({ path: `${scratch}/reference-gap-800.png`, fullPage: true })
  cases.push('one-second missing input→error/no review, notebook800px no horizontal overflow')
  await page.evaluate(() => {
    window.referenceFixture.paused = false
  })
  await page.getByRole('button', { name: '기준 다시 수집', exact: true }).click()
  await page.getByRole('checkbox').waitFor()
  await page.getByRole('checkbox').check()
  mode = 'authority'
  await page.getByRole('button', { name: '기준 저장', exact: true }).click()
  await page.getByText(/계정을 확인하지 못해 기준 저장을 중단/).waitFor()
  assert.equal(
    await page.getByRole('button', { name: '카메라 확인', exact: true }).isDisabled(),
    true,
  )
  await page.getByRole('button', { name: '동작 변경', exact: true }).click()
  await page.getByRole('button', { name: '팔 위로 뻗기 화면에서 보기', exact: true }).click()
  assert.equal(
    await page.getByRole('button', { name: '카메라 확인', exact: true }).isDisabled(),
    true,
  )
  cases.push('controlled403→camera closure/write rejection remains across motion remount')
  camera += await page.evaluate(() => window.referenceCameraCalls)
  assert.equal(camera, 0)
  assert.equal(external, 0)
  assert.deepEqual(errors, [])
  assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0)
  assert.equal(page.workers().length, 0)
} catch (error) {
  failure = `${error.name}: ${error.message}`
} finally {
  await browser?.close()
  await server.close()
  api.closeAllConnections()
  await new Promise((yes) => api.close(yes))
  writeFileSync(
    `${scratch}/browser.json`,
    JSON.stringify(
      {
        cases,
        failure: failure ?? null,
        physicalCameraCalls: camera,
        externalRequests: external,
        pageErrors: errors,
        boundary: 'actual Chrome/React/client; synthetic source and API; no SDK, people or SQL',
      },
      null,
      2,
    ),
    { flag: 'wx' },
  )
}
if (failure) throw new Error(failure)
console.log(`Camera reference browser: ${cases.length} flows passed (synthetic input/API)`)
