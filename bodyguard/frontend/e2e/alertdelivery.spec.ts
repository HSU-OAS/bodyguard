// FR-N-04/05/NFR-08: actual production React/Chrome native denied state; triggers/CDP policy synthetic.
import { readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import type { Socket } from 'node:net'
import { type CDPSession, expect, type Page, test } from '@playwright/test'
import type { mountAlertDeliveryProbe } from './fixtures/alertDeliveryProbe'

type ProbeWindow = Window & { alertDeliveryProbe: ReturnType<typeof mountAlertDeliveryProbe> }
const bundle = process.env.BODYGUARD_TEST_ALERT_DELIVERY_PROBE
if (
  !bundle ||
  !/^\/private\/tmp\/bodyguard-alert-delivery-proof\.[A-Za-z0-9]+\/browser-probe$/.test(bundle)
)
  throw new Error('Owned alert delivery probe required')
let unexpected = 0
let pageErrors = 0
let permissionCdp: CDPSession | null = null
test.beforeEach(async ({ context, page }) => {
  unexpected = 0
  pageErrors = 0
  page.on('pageerror', () => {
    pageErrors++
  })
  context.on('request', (request) => {
    const url = new URL(request.url())
    if (
      !['localhost', '127.0.0.1'].includes(url.hostname) ||
      /\.task|\.wasm|\.glb/.test(url.pathname) ||
      request.method() === 'POST'
    )
      unexpected++
  })
  await context.exposeBinding('__unexpectedCamera', () => {
    unexpected++
  })
  await context.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => {
      void (window as unknown as { __unexpectedCamera(): Promise<void> }).__unexpectedCamera()
      return Promise.reject(new Error('Unexpected camera'))
    }
  })
  const cdp = await context.newCDPSession(page)
  permissionCdp = cdp
  const { targetInfo } = await cdp.send('Target.getTargetInfo')
  expect(targetInfo.browserContextId).toBeTruthy()
  await cdp.send('Browser.setPermission', {
    permission: { name: 'notifications' },
    setting: 'denied',
    origin: 'http://localhost:4173',
    browserContextId: targetInfo.browserContextId,
  })
  await page.route('**/__private-alert-delivery-probe.js', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: readFileSync(`${bundle}/probe.js`, 'utf8'),
    }),
  )
})
test.afterEach(async ({ page }) => {
  try {
    expect(unexpected).toBe(0)
    expect(pageErrors).toBe(0)
    if (page.url() !== 'about:blank')
      expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([
        0, 0,
      ])
  } finally {
    await permissionCdp?.detach()
    permissionCdp = null
  }
})
async function mount(page: Page, closureSignalUrl?: string) {
  await page.goto('/')
  await expect(page.getByRole('link', { name: 'BODYGUARD 서비스 소개', exact: true })).toBeVisible()
  expect(
    await page.evaluate(() => ({ secure: isSecureContext, permission: Notification.permission })),
  ).toEqual({ secure: true, permission: 'denied' })
  await page.addStyleTag({ content: readFileSync(`${bundle}/probe.css`, 'utf8') })
  await page.evaluate(async (signalUrl) => {
    const path = '/__private-alert-delivery-probe.js'
    const module = (await import(path)) as {
      mountAlertDeliveryProbe: typeof mountAlertDeliveryProbe
    }
    ;(window as unknown as ProbeWindow).alertDeliveryProbe = module.mountAlertDeliveryProbe(
      signalUrl
        ? () => {
            void fetch(signalUrl, {
              method: 'GET',
              credentials: 'omit',
              cache: 'no-store',
              keepalive: true,
            }).catch(() => {})
          }
        : undefined,
    )
  }, closureSignalUrl)
  await expect.poll(() => page.getByRole('region', { name: '스트레칭 알림' }).count()).toBe(1)
}
test('D05/06 actual denied permission keeps screen actions without grabbing focus', async ({
  page,
}, info) => {
  await mount(page)
  const trigger = page.getByRole('button', { name: '합성 자세 안내' })
  await trigger.focus()
  await trigger.press('Enter')
  await expect(page.getByRole('group', { name: '자세 스트레칭 안내' })).toBeVisible()
  await expect(trigger).toBeFocused()
  await page.evaluate(() =>
    (window as unknown as ProbeWindow).alertDeliveryProbe.receive('sitting'),
  )
  await expect(page.getByRole('status')).toHaveText('안내 2개')
  await expect(page.getByText(/다른 창에서는 알림이 보이지/)).toBeVisible()
  await page.screenshot({ path: info.outputPath('delivery-desktop.png'), fullPage: true })
  await page.getByRole('button', { name: '자세 안내 닫기' }).click()
  await expect(page.getByRole('group', { name: '자세 스트레칭 안내' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '장시간 안내 스트레칭 살펴보기' })).toBeFocused()
  await page.getByRole('button', { name: '장시간 안내 스트레칭 살펴보기' }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: '스트레칭 알림', exact: true })).toBeFocused()
  expect(
    await page.evaluate(() => (window as unknown as ProbeWindow).alertDeliveryProbe.state()),
  ).toMatchObject({ alerts: [], chosen: 'sitting', syntheticTriggersAuthority: true })
  await page.screenshot({ path: info.outputPath('delivery-empty.png'), fullPage: true })
})
test('D05/06 actual white blue style/contrast, narrow laptop/zoom and reduced motion', async ({
  page,
}, info) => {
  await mount(page)
  await page.getByRole('button', { name: '합성 자세 안내' }).click()
  const values = await page
    .getByRole('button', { name: '자세 안내 스트레칭 살펴보기' })
    .evaluate((node) => {
      const s = getComputedStyle(node)
      const rgb = (value: string) => (value.match(/\d+/g) ?? []).slice(0, 3).map(Number)
      const lum = (v: number[]) =>
        v.reduce((sum, c, i) => {
          const x = c / 255
          return (
            sum +
            (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4) *
              ([0.2126, 0.7152, 0.0722][i] ?? 0)
          )
        }, 0)
      const a = lum(rgb(s.color))
      const b = lum(rgb(s.backgroundColor))
      const panel = node.closest('.alert-delivery')
      if (!panel) throw new Error('Expected owned alert panel')
      return {
        contrast: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
        height: node.getBoundingClientRect().height,
        radius: s.borderRadius,
        blue: s.backgroundColor,
        surface: getComputedStyle(panel).backgroundColor,
      }
    })
  expect(values).toMatchObject({
    radius: '8px',
    blue: 'rgb(30, 90, 168)',
    surface: 'rgb(255, 255, 255)',
  })
  expect(values.height).toBeGreaterThanOrEqual(48)
  expect(values.contrast).toBeGreaterThanOrEqual(4.5)
  await page.setViewportSize({ width: 920, height: 1000 })
  await page.getByRole('button', { name: '자세 안내 닫기' }).focus()
  expect(
    await page
      .getByRole('button', { name: '자세 안내 닫기' })
      .evaluate((n) => getComputedStyle(n).outlineWidth),
  ).toBe('3px')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('delivery-920.png'), fullPage: true })
  await page.evaluate(() => {
    document.documentElement.style.zoom = '2'
  })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('delivery-zoom.png'), fullPage: true })
  await page.evaluate(() => {
    document.documentElement.style.zoom = ''
  })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  expect(
    await page
      .getByRole('button', { name: '자세 안내 닫기' })
      .evaluate((n) => getComputedStyle(n).transitionDuration),
  ).toBe('0s')
})
test('D04/06 synthetic pagehide in Chrome reclaims panel and rejects late synthetic events', async ({
  page,
}, info) => {
  await mount(page)
  await page.getByRole('button', { name: '합성 자세 안내' }).click()
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide')))
  await expect(page.getByRole('region', { name: '스트레칭 알림' })).toHaveCount(0)
  expect(
    await page.evaluate(() =>
      (window as unknown as ProbeWindow).alertDeliveryProbe.receive('posture'),
    ),
  ).toBe(false)
  expect(
    await page.evaluate(() => (window as unknown as ProbeWindow).alertDeliveryProbe.state()),
  ).toMatchObject({ closed: true, alerts: [], chosen: null })
  await page.screenshot({ path: info.outputPath('delivery-closed.png'), fullPage: true })
})
test('D06 public website has no incomplete alert panel or automatic permissions', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.getByRole('link', { name: 'BODYGUARD 서비스 소개', exact: true })).toBeVisible()
  await expect(page.getByRole('region', { name: '스트레칭 알림' })).toHaveCount(0)
  expect(await page.evaluate(() => 'alertDeliveryProbe' in window)).toBe(false)
})
test('D04/06 actual document navigation closes the prior owned delivery', async ({ page }) => {
  let closedSignals = 0
  let rejectedSignals = 0
  const sockets = new Set<Socket>()
  // Test-only fixed, empty GET; no account/body data, cookies, storage or public endpoint.
  const signal = createServer((request, response) => {
    response.setHeader('Access-Control-Allow-Origin', 'http://localhost:4173')
    if (
      request.method === 'GET' &&
      request.url === '/closed' &&
      request.headers.cookie === undefined &&
      request.headers.authorization === undefined &&
      (request.headers['content-length'] === undefined || request.headers['content-length'] === '0')
    ) {
      closedSignals++
      response.writeHead(204)
    } else {
      rejectedSignals++
      response.writeHead(404)
    }
    response.end()
  })
  signal.on('connection', (socket) => {
    sockets.add(socket)
    socket.on('close', () => sockets.delete(socket))
  })
  try {
    await new Promise<void>((resolve, reject) => {
      signal.once('error', reject)
      signal.listen(0, '127.0.0.1', resolve)
    })
    const address = signal.address()
    if (!address || typeof address === 'string') throw new Error('Expected owned loopback sink')
    await mount(page, `http://127.0.0.1:${address.port}/closed`)
    await page.getByRole('button', { name: '합성 자세 안내' }).click()
    expect(closedSignals).toBe(0)
    await page.goto('/help')
    await expect(page.getByRole('heading', { name: '도움말', exact: true })).toBeVisible()
    await expect.poll(() => closedSignals).toBe(1)
    expect(rejectedSignals).toBe(0)
    expect(await page.evaluate(() => 'alertDeliveryProbe' in window)).toBe(false)
  } finally {
    for (const socket of sockets) socket.destroy()
    await new Promise<void>((resolve, reject) => {
      signal.close((error) => (error ? reject(error) : resolve()))
    })
  }
})
