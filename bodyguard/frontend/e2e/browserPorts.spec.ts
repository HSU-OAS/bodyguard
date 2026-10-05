// FR-M-01/02/07/NFR-08: actual Chrome API with synthetic device; not human posture or performance proof.
import { expect, test } from '@playwright/test'

test('B-08 actual browser native three-task initialization and close APIs with fake camera', async ({
  page,
}, info) => {
  let external = 0
  let outbound = 0
  let errors = 0
  const blockedProtocols: { protocol: string; origin: string }[] = []
  page.on('pageerror', () => {
    errors++
  })
  await page.route('**/*', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (url.hostname !== 'localhost' || url.port !== '5184') {
      external++
      blockedProtocols.push({ protocol: url.protocol, origin: url.origin })
      await route.abort('blockedbyclient')
    } else if (request.method() !== 'GET') {
      outbound++
      await route.abort('blockedbyclient')
    } else if (url.pathname.startsWith('/api/')) {
      await route.fulfill({ status: 401, contentType: 'application/json', body: '{}' })
    } else await route.continue()
  })
  await page.goto('/')
  const result = await page.evaluate(async () => {
    const path = '/e2e/fixtures/browserPortsProbe.ts'
    const module = (await import(path)) as typeof import('./fixtures/browserPortsProbe')
    return module.probeNativePorts()
  })
  await info.attach('native-ports-observations.json', {
    contentType: 'application/json',
    body: Buffer.from(
      JSON.stringify(
        {
          ...result,
          external_requests: external,
          blocked_protocols: blockedProtocols,
          uploads: outbound,
          page_errors: errors,
          video_screenshots: 0,
        },
        null,
        2,
      ),
    ),
  })
  expect(result.fake_camera_live).toBe(true)
  expect(result.tracks_ended).toBe(true)
  expect(result.video_detached).toBe(true)
  expect(result.initialized_native_tasks).toBe(3)
  expect(result.native_close_api_calls).toBe(3)
  expect(result.native_close_api_errors).toBe(0)
  expect(result.notices).toBe(0)
  expect(result.storage_unchanged).toBe(true)
  expect(result.real_human_test).toBe(false)
  expect(external).toBe(0)
  expect(outbound).toBe(0)
  expect(errors).toBe(0)
})
