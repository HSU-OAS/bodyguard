// FR-U-04/FR-V-03/NFR-07: real Chrome UI, explicitly synthetic /me, timing diagnostics only.

import { createServer } from 'node:http'
import { expect, test } from '@playwright/test'
import { installStartupProbe } from './fixtures/startupProbe'
import { startupHeadingVisible } from './fixtures/startupVisibility'

// Public API: close owned pages before context teardown can collect a failure ARIA snapshot.
test.afterEach(async ({ context }) => {
  await Promise.all(context.pages().map((page) => page.close({ runBeforeUnload: false })))
})

// FR-V-03/NFR-08: intentional failure is exit 1, never counted as product success.
if (process.env.BODYGUARD_STARTUP_NEGATIVE_ARTIFACTS === '1')
  test('startup negative: closed pages omit failure DOM artifacts', async ({ page }) => {
    await page.setContent(negativeMarkup())
    expect(await startupHeadingVisible(page, '내 몸을 위한 시작')).toBe(true)
  })

test('startup boundary: only owned ports and exact fixture API', async ({ page }, info) => {
  const origin = process.env.BODYGUARD_STARTUP_PRODUCTION
  if (!origin) throw new Error('Owned startup origin required')
  let trapConnections = 0
  const trap = createServer((_request, response) => response.end('test-owned trap'))
  trap.on('connection', () => trapConnections++)
  await new Promise<void>((resolve, reject) => {
    trap.once('error', reject)
    trap.listen(0, '127.0.0.1', resolve)
  })
  const address = trap.address()
  if (!address || typeof address === 'string') throw new Error('Owned trap missing')
  try {
    await page.goto(`${origin}/data`, { timeout: 15_000 })
    const result = await page.evaluate(async (port) => {
      let httpConnected = false
      try {
        await fetch(`http://127.0.0.1:${port}/trap`, {
          mode: 'no-cors',
          signal: AbortSignal.timeout(1500),
        })
        httpConnected = true
      } catch {
        // Proxy refusal is verified against the independent test-owned trap counter.
      }
      const ws = await new Promise<{ connected: boolean; timedOut: boolean }>((resolve) => {
        const socket = new WebSocket(`ws://127.0.0.1:${port}/trap`)
        const timeout = setTimeout(() => {
          socket.close()
          resolve({ connected: false, timedOut: true })
        }, 1500)
        socket.onopen = () => {
          clearTimeout(timeout)
          socket.close()
          resolve({ connected: true, timedOut: false })
        }
        socket.onerror = () => {
          clearTimeout(timeout)
          resolve({ connected: false, timedOut: false })
        }
      })
      const apiStatuses = await Promise.all(
        ['/api', '/api?x=1', '/apix', '/api/v1/me?x=1'].map(async (path) => {
          const response = await fetch(path, { cache: 'no-store' })
          return response.status
        }),
      )
      const me = await fetch('/api/v1/me', { cache: 'no-store' })
      const wrongMethod = await fetch('/api/v1/me', { method: 'POST' })
      return {
        httpConnected,
        ws,
        apiStatuses,
        meStatus: me.status,
        wrongMethod: wrongMethod.status,
      }
    }, address.port)
    await info.attach('boundary-observations.json', {
      contentType: 'application/json',
      body: Buffer.from(JSON.stringify({ ...result, trapConnections, actualAuth: false })),
    })
    expect(result.httpConnected).toBe(false)
    expect(result.ws).toEqual({ connected: false, timedOut: false })
    expect(trapConnections).toBe(0)
    expect(result.apiStatuses).toEqual([403, 403, 403, 403])
    expect(result.meStatus).toBe(200)
    expect(result.wrongMethod).toBe(403)
  } finally {
    trap.closeAllConnections()
    await new Promise<void>((resolve) => trap.close(() => resolve()))
  }
})

for (const surface of ['production', 'dev'] as const)
  for (const transport of ['http', 'route'] as const)
    test(`startup ${surface} ${transport}: first and repeat navigation`, async ({
      context,
      page,
    }, info) => {
      const origin =
        process.env[
          surface === 'production' ? 'BODYGUARD_STARTUP_PRODUCTION' : 'BODYGUARD_STARTUP_DEV'
        ]
      if (!origin) throw new Error('Owned startup origin required')
      const heading = surface === 'production' ? '내 몸을 위한 시작' : '원하는 동작을 골라보세요'
      const path = surface === 'production' ? '/start' : '/dev/select'
      const samples: unknown[] = []
      let pageErrors = 0
      let externalRequests = 0
      let unexpectedApi = 0
      let modelRequests = 0
      page.on('pageerror', () => pageErrors++)
      page.on('request', (request) => {
        const url = new URL(request.url())
        if (url.origin !== origin) externalRequests++
        if (
          url.pathname.startsWith('/api') &&
          (url.pathname !== '/api/v1/me' || url.search !== '' || request.method() !== 'GET')
        )
          unexpectedApi++
        if (/\.task$|\.wasm$|\.glb$|\/models\/|\/mediapipe\//.test(url.pathname)) modelRequests++
      })
      await context.addInitScript(installStartupProbe, { heading })
      if (transport === 'route')
        await context.route('**/*', async (route) => {
          const url = new URL(route.request().url())
          if (url.origin !== origin) return route.abort('blockedbyclient')
          if (
            url.pathname === '/api/v1/me' &&
            url.search === '' &&
            route.request().method() === 'GET'
          )
            return route.fulfill({
              status: 200,
              contentType: 'application/json',
              headers: { 'Cache-Control': 'no-store' },
              body: '{"id":"startup-fixture","email":"fixture@example.com"}',
            })
          if (url.pathname.startsWith('/api'))
            return route.fulfill({ status: 403, contentType: 'application/json', body: '{}' })
          return route.continue()
        })
      try {
        for (const visit of ['first', 'repeat'] as const) {
          const before = performance.now()
          await page.goto(`${origin}${path}`, { timeout: 15_000 })
          const afterGoto = performance.now()
          const selectorPassed = await startupHeadingVisible(page, heading)
          const afterSelector = performance.now()
          let twoRafObserved = false
          try {
            // Diagnostic collection only: does not change the prior 5000ms pass/fail.
            await page.waitForFunction(
              () => window.__bodyguardStartup.twoRafMs !== null,
              undefined,
              { timeout: 1000 },
            )
            twoRafObserved = true
          } catch {
            // Null timing remains missing, never replaced with an invented paint timestamp.
          }
          const observed = await page.evaluate(() => {
            const timing = performance.getEntriesByType('navigation')[0] as
              | PerformanceNavigationTiming
              | undefined
            const resources = performance.getEntriesByType(
              'resource',
            ) as PerformanceResourceTiming[]
            const me = resources.filter((entry) => new URL(entry.name).pathname === '/api/v1/me')
            return {
              probe: window.__bodyguardStartup,
              navigation: timing
                ? {
                    responseEndMs: timing.responseEnd,
                    domContentLoadedMs: timing.domContentLoadedEventEnd,
                    loadMs: timing.loadEventEnd,
                  }
                : null,
              me: me.map((entry) => ({ startMs: entry.startTime, endMs: entry.responseEnd })),
              resourceCount: resources.length,
              visible: document.visibilityState === 'visible',
              localStorageCount: localStorage.length,
              sessionStorageCount: sessionStorage.length,
            }
          })
          samples.push({
            visit,
            selectorPassed,
            twoRafObserved,
            gotoWallMs: afterGoto - before,
            selectorWallMs: afterSelector - afterGoto,
            observed,
          })
          expect.soft(selectorPassed, `${visit} unchanged 5000ms heading visibility`).toBe(true)
          expect.soft(twoRafObserved, `${visit} complete two-RAF diagnostic`).toBe(true)
          expect.soft(observed.probe.cameraCalls).toBe(0)
          expect.soft(observed.localStorageCount).toBe(0)
          expect.soft(observed.sessionStorageCount).toBe(0)
          expect.soft(observed.visible).toBe(true)
        }
        if (surface === 'production' && transport === 'http')
          await page.screenshot({ path: info.outputPath('production-start.png'), fullPage: true })
      } finally {
        await info.attach('startup-observations.json', {
          contentType: 'application/json',
          body: Buffer.from(
            JSON.stringify({
              actualBrowser: true,
              actualAuth: false,
              actualCameraOrHuman: false,
              productPerformanceGatePassed: false,
              browserVersion: context.browser()?.version(),
              surface,
              transport,
              routingDisablesHttpCache: transport === 'route',
              samples,
              pageErrors,
              externalRequests,
              unexpectedApi,
              modelRequests,
            }),
          ),
        })
        expect(pageErrors).toBe(0)
        expect(externalRequests).toBe(0)
        expect(unexpectedApi).toBe(0)
        expect(modelRequests).toBe(0)
      }
    })

function negativeMarkup(): string {
  return '<main><h1>계정 확인 중</h1><p>SYNTHETIC_PRIVATE_DOM_SENTINEL</p></main>'
}
