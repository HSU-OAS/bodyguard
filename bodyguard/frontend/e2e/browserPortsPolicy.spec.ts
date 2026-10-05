// NFR-08: TEST-ONLY enforced CSP diagnostic, not an approved/shipped product privacy policy.
import { expect, test } from '@playwright/test'

test('diagnostic local CSP blocks SDK telemetry while native tasks initialize and close', async ({
  page,
}, info) => {
  let outgoing = 0
  let errors = 0
  page.on('pageerror', () => {
    errors++
  })
  page.on('request', (request) => {
    const url = new URL(request.url())
    if (url.protocol !== 'blob:' && (url.hostname !== 'localhost' || url.port !== '5184'))
      outgoing++
  })
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    if (url.hostname !== 'localhost' || url.port !== '5184') await route.abort('blockedbyclient')
    else if (url.pathname.startsWith('/api/'))
      await route.fulfill({ status: 401, contentType: 'application/json', body: '{}' })
    else if (route.request().isNavigationRequest()) {
      const response = await route.fetch()
      await route.fulfill({
        response,
        headers: { ...response.headers(), 'Content-Security-Policy': "connect-src 'self'" },
      })
    } else await route.continue()
  })
  await page.addInitScript(() => {
    Object.assign(window, { __bodyguardPolicyViolations: 0 })
    document.addEventListener('securitypolicyviolation', (event) => {
      if (event.effectiveDirective === 'connect-src') {
        const counters = window as unknown as { __bodyguardPolicyViolations: number }
        counters.__bodyguardPolicyViolations++
      }
    })
  })
  await page.goto('/')
  const result = await page.evaluate(async () => {
    const path = '/e2e/fixtures/browserPortsProbe.ts'
    const module = (await import(path)) as typeof import('./fixtures/browserPortsProbe')
    const result = await module.probeNativePorts()
    await new Promise((resolve) => setTimeout(resolve, 250))
    return {
      ...result,
      csp_blocked_attempts: (window as unknown as { __bodyguardPolicyViolations: number })
        .__bodyguardPolicyViolations,
    }
  })
  await info.attach('test-only-policy-observations.json', {
    contentType: 'application/json',
    body: Buffer.from(
      JSON.stringify(
        {
          ...result,
          outgoing_requests: outgoing,
          page_errors: errors,
          product_policy_approved: false,
          deployment_tested: false,
        },
        null,
        2,
      ),
    ),
  })
  expect(result.initialized_native_tasks).toBe(3)
  expect(result.native_close_api_calls).toBe(3)
  expect(result.native_close_api_errors).toBe(0)
  expect(result.tracks_ended).toBe(true)
  expect(result.video_detached).toBe(true)
  expect(result.storage_unchanged).toBe(true)
  expect(result.csp_blocked_attempts).toBeGreaterThan(0)
  expect(outgoing).toBe(0)
  expect(errors).toBe(0)
})
