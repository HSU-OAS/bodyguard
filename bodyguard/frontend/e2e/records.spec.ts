// FR-R-03/FR-U-04/NFR-08: real HTTP/SQL/production Chrome, synthetic summaries and mail.
import { randomUUID } from 'node:crypto'
import { readFileSync, renameSync, writeFileSync } from 'node:fs'
import { type BrowserContext, expect, type Page, test } from '@playwright/test'

const origin = 'http://localhost:4173'
const password = '기록 브라우저 시험 전용 비밀번호 12345'
const mailbox = process.env.BODYGUARD_TEST_MAILBOX
if (!mailbox?.startsWith('/private/tmp/bodyguard-browser-'))
  throw new Error('Isolated mailbox required')
let cameraCalls = 0
const requests: string[] = []
test.beforeEach(async ({ context }) => {
  cameraCalls = 0
  requests.length = 0
  context.on('request', (request) => requests.push(request.url()))
  await context.exposeBinding('__bodyguardTestCamera', () => {
    cameraCalls++
  })
  await context.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => {
      void (
        window as unknown as { __bodyguardTestCamera: () => Promise<void> }
      ).__bodyguardTestCamera()
      return Promise.reject(new Error('Unexpected camera request'))
    }
  })
})
test.afterEach(async ({ page }) => {
  expect(cameraCalls).toBe(0)
  expect(
    requests.some((url) => /\.glb|\.wasm|pose_landmarker|MeasureDemoPage|mediapipe/.test(url)),
  ).toBe(false)
  expect(requests.every((url) => ['localhost', '127.0.0.1'].includes(new URL(url).hostname))).toBe(
    true,
  )
  expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0])
})
async function post(context: BrowserContext, path: string, data?: unknown) {
  const csrf = await (await context.request.get('/api/v1/auth/csrf')).json()
  return context.request.post(`/api/v1${path}`, {
    headers: { Origin: origin, 'X-CSRF-Token': csrf.csrf_token },
    data,
  })
}
async function join(context: BrowserContext) {
  const email = `records-${randomUUID()}@example.com`
  const signup = await post(context, '/auth/signup', { email, password })
  expect(signup.status()).toBe(202)
  let code = ''
  await expect
    .poll(() => {
      code = JSON.parse(readFileSync(mailbox as string, 'utf8'))[email] ?? ''
      return code
    })
    .toMatch(/^[0-9]{6}$/)
  const verified = await post(context, '/auth/verify', {
    challenge_id: (await signup.json()).challenge_id,
    code,
  })
  expect(verified.status()).toBe(201)
  return email
}
async function seed(
  context: BrowserContext,
  index = 1,
  outcome: 'completed' | 'interrupted' | 'skipped' = 'interrupted',
  daysAgo = 0,
  long = false,
) {
  const end = new Date(Date.now() - daysAgo * 86400000 - index * 60000)
  const record = {
    id: randomUUID(),
    motion_id: long ? 'fixture-long-'.padEnd(64, 'a') : `fixture-${index}`,
    protocol_version: 'fixture-not-release',
    started_at: new Date(end.getTime() - 90000).toISOString(),
    ended_at: end.toISOString(),
    outcome,
    observed_ms: outcome === 'skipped' ? 0 : 65000,
    repetitions: outcome === 'skipped' ? 0 : 1,
  }
  const result = await post(context, '/records/stretch', record)
  expect(result.status()).toBe(201)
  expect((await result.json()).provenance).toBe('client-reported')
  return record
}
function day(date: Date) {
  return `${date.getFullYear().toString().padStart(4, '0')}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`
}

test('RD-05 record saved after preview is preserved even with an earlier end time', async ({
  page,
  context,
}, info) => {
  await join(context)
  await seed(context)
  await page.goto('/records')
  await page.getByRole('button', { name: '이 기간 기록 삭제', exact: true }).click()
  await expect(page.getByText('삭제 대상: 1건', { exact: true })).toBeVisible()
  const later = await seed(context, 2)
  await page.getByRole('button', { name: '기록 삭제', exact: true }).click()
  await expect(page.getByText('1건의 수행 기록을 삭제했습니다.', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: /^fixture-2 .*기록 상세/ })).toBeVisible()
  expect(
    (await (await context.request.get('/api/v1/records/stretch')).json()).items.map(
      (item: { id: string }) => item.id,
    ),
  ).toEqual([later.id])
  await page.screenshot({
    path: info.outputPath('deletion-new-record-preserved.png'),
    fullPage: true,
  })
})

test('RD-04 foreign proof cannot delete another account and late deletion cannot reopen private UI', async ({
  page,
  context,
}, info) => {
  const originalEmail = await join(context)
  const original = await seed(context)
  const preview = await post(context, '/records/stretch/delete-preview', {
    start: new Date(Date.parse(original.ended_at) - 1).toISOString(),
    end: new Date(Date.parse(original.ended_at) + 1).toISOString(),
  })
  expect(preview.status()).toBe(200)
  const proof = await preview.json()
  expect((await post(context, '/auth/logout')).status()).toBe(204)
  await join(context)
  const own = await seed(context, 2)
  const foreign = await post(context, '/records/stretch/delete', {
    ...proof,
    confirmation: 'delete-stretch-records',
  })
  expect(foreign.status()).toBe(403)
  expect(
    (await (await context.request.get('/api/v1/records/stretch')).json()).items.map(
      (item: { id: string }) => item.id,
    ),
  ).toEqual([own.id])
  await page.goto('/records')
  await page.getByRole('button', { name: '이 기간 기록 삭제', exact: true }).click()
  await expect(page.getByText('삭제 대상: 1건', { exact: true })).toBeVisible()
  let release: (() => void) | undefined
  const held = new Promise<void>((done) => {
    release = done
  })
  let processed = false
  await page.route('**/api/v1/records/stretch/delete', async (route) => {
    const response = await route.fetch()
    expect(response.status()).toBe(200)
    processed = true
    await held
    await route.fulfill({ response }).catch(() => {})
  })
  await page.getByRole('button', { name: '기록 삭제', exact: true }).click()
  await expect.poll(() => processed).toBe(true)
  expect((await (await context.request.get('/api/v1/records/stretch')).json()).items).toHaveLength(
    0,
  )
  try {
    expect((await post(context, '/auth/logout')).status()).toBe(204)
    await page.goto('/records')
    await expect(page.getByRole('heading', { name: '다시 만나 반갑습니다' })).toBeVisible()
    release?.()
    await expect(page.getByText('1건의 수행 기록을 삭제했습니다.', { exact: true })).toHaveCount(0)
    await page.screenshot({ path: info.outputPath('deletion-logout-boundary.png'), fullPage: true })
    expect((await post(context, '/auth/login', { email: originalEmail, password })).status()).toBe(
      200,
    )
    expect(
      (await (await context.request.get('/api/v1/records/stretch')).json()).items.map(
        (item: { id: string }) => item.id,
      ),
    ).toEqual([original.id])
    expect(
      (
        await post(context, '/records/stretch/delete', {
          ...proof,
          confirmation: 'delete-stretch-records',
        })
      ).status(),
    ).toBe(403)
  } finally {
    release?.()
  }
})

test('RD-03 server confirmation expiry preserves record without an automatic retry', async ({
  page,
  context,
}, info) => {
  const clockFile = process.env.BODYGUARD_TEST_RECORD_CLOCK
  if (
    !clockFile?.startsWith('/private/tmp/bodyguard-browser-') ||
    !clockFile.endsWith('/record-clock.json')
  )
    throw new Error('Owned test clock required')
  function offset(seconds: number) {
    writeFileSync(`${clockFile}.next`, JSON.stringify({ offset_seconds: seconds }), { mode: 0o600 })
    renameSync(`${clockFile}.next`, clockFile as string)
  }
  await join(context)
  await seed(context)
  await page.goto('/records')
  await page.getByRole('button', { name: '이 기간 기록 삭제', exact: true }).click()
  await expect(page.getByText('삭제 대상: 1건', { exact: true })).toBeVisible()
  try {
    offset(601)
    await page.getByRole('button', { name: '기록 삭제', exact: true }).click()
    await expect(page.getByText(/삭제 확인이 만료되었거나 대상이 바뀌었습니다/)).toBeVisible()
    expect(
      (await (await context.request.get('/api/v1/records/stretch')).json()).items,
    ).toHaveLength(1)
    await expect(page.getByRole('button', { name: '기록 삭제', exact: true })).toHaveCount(0)
    await page.screenshot({ path: info.outputPath('deletion-expired.png'), fullPage: true })
  } finally {
    offset(0)
  }
})

test('RD-02 changed real SQL target requires another preview and preserves remaining record', async ({
  page,
  context,
}, info) => {
  await join(context)
  const first = await seed(context, 1)
  await seed(context, 2)
  await page.goto('/records')
  await expect(page.getByRole('table')).toBeVisible()
  await page.getByRole('button', { name: '이 기간 기록 삭제', exact: true }).click()
  await expect(page.getByText('삭제 대상: 2건', { exact: true })).toBeVisible()
  const partial = await post(context, '/records/stretch/delete-preview', {
    start: first.ended_at,
    end: new Date(Date.parse(first.ended_at) + 1).toISOString(),
  })
  expect(partial.status()).toBe(200)
  const proof = await partial.json()
  expect(proof.count).toBe(1)
  const removed = await post(context, '/records/stretch/delete', {
    ...proof,
    confirmation: 'delete-stretch-records',
  })
  expect(removed.status()).toBe(200)
  await page.getByRole('button', { name: '기록 삭제', exact: true }).click()
  await expect(page.getByText(/삭제 확인이 만료되었거나 대상이 바뀌었습니다/)).toBeVisible()
  await expect(page.getByRole('button', { name: '기록 삭제', exact: true })).toHaveCount(0)
  expect((await (await context.request.get('/api/v1/records/stretch')).json()).items).toHaveLength(
    1,
  )
  await page.screenshot({ path: info.outputPath('deletion-target-changed.png'), fullPage: true })
  await page.getByRole('button', { name: '삭제 대상 다시 확인', exact: true }).click()
  await expect(page.getByText('삭제 대상: 1건', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '취소', exact: true }).click()
  expect((await (await context.request.get('/api/v1/records/stretch')).json()).items).toHaveLength(
    1,
  )
})

test('RD-01 actual preview cancel and confirmed period deletion preserve outside records', async ({
  page,
  context,
}, info) => {
  await join(context)
  await seed(context)
  const outside = await seed(context, 2, 'interrupted', 14)
  await page.goto('/records')
  await expect(page.getByRole('table')).toBeVisible()
  await page.getByRole('button', { name: '이 기간 기록 삭제', exact: true }).click()
  await expect(page.getByText('삭제 대상: 1건', { exact: true })).toBeVisible()
  await page.screenshot({ path: info.outputPath('deletion-preview.png'), fullPage: true })
  await page.getByRole('button', { name: '취소', exact: true }).click()
  expect((await (await context.request.get('/api/v1/records/stretch')).json()).items).toHaveLength(
    2,
  )
  await expect(page.getByRole('button', { name: '이 기간 기록 삭제', exact: true })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByText('삭제 대상: 1건', { exact: true })).toBeVisible()
  await page.setViewportSize({ width: 700, height: 800 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('deletion-preview-narrow.png'), fullPage: true })
  await page.getByRole('button', { name: '기록 삭제', exact: true }).click()
  await expect(page.getByText('1건의 수행 기록을 삭제했습니다.', { exact: true })).toBeVisible()
  await expect(
    page.getByRole('heading', { name: '이 기간에는 수행 기록이 없습니다' }),
  ).toBeVisible()
  const remaining = (await (await context.request.get('/api/v1/records/stretch')).json()).items
  expect(remaining.map((item: { id: string }) => item.id)).toEqual([outside.id])
  await page.screenshot({ path: info.outputPath('deletion-result.png'), fullPage: true })
})
async function filter(page: Page, from: string, to: string) {
  await page.getByLabel('시작일', { exact: true }).fill(from)
  await page.getByLabel('종료일', { exact: true }).fill(to)
  await page.getByRole('button', { name: '기간 조회', exact: true }).click()
}

test('RW-01 protected entry and genuine empty record period', async ({ page, context }, info) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/records')
  await expect(page.getByRole('heading', { name: '다시 만나 반갑습니다' })).toBeVisible()
  expect((await context.request.get('/api/v1/records/stretch')).status()).toBe(401)
  await join(context)
  await page.goto('/start')
  await page.getByRole('link', { name: '내 수행 기록 확인' }).click()
  await expect(page.getByRole('heading', { name: '내 수행 기록' })).toBeFocused()
  await expect(
    page.getByRole('heading', { name: '이 기간에는 수행 기록이 없습니다' }),
  ).toBeVisible()
  await expect(page.getByRole('table')).toHaveCount(0)
  await page.screenshot({ path: info.outputPath('records-empty.png'), fullPage: true })
  await page.getByRole('link', { name: '스트레칭 시작 경로 선택' }).click()
  await expect(page.getByRole('heading', { name: '스트레칭 시작 경로' })).toBeVisible()
  expect(errors).toEqual([])
})
test('RW-02 actual summaries, detail, Back period and long record narrow layout', async ({
  page,
  context,
}, info) => {
  await join(context)
  const record = await seed(context, 1, 'completed', 0, true)
  await seed(context, 2, 'skipped')
  await seed(context, 3, 'interrupted')
  await page.goto('/records')
  await expect(page.getByRole('table')).toBeVisible()
  await expect(page.getByRole('row')).toHaveCount(4)
  await expect(page.getByText('완료', { exact: true })).toBeVisible()
  await expect(page.getByText('건너뜀', { exact: true })).toBeVisible()
  await expect(page.getByText('중단', { exact: true })).toBeVisible()
  const original = await page.getByLabel('시작일').inputValue()
  await page.screenshot({ path: info.outputPath('records-list.png'), fullPage: true })
  await page.setViewportSize({ width: 700, height: 800 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('records-list-narrow.png'), fullPage: true })
  await page.getByRole('link', { name: new RegExp(`^${record.motion_id}.*기록 상세$`) }).click()
  await expect(page.getByRole('heading', { name: '수행 기록 상세' })).toBeFocused()
  await expect(page.getByText('fixture-not-release', { exact: true })).toBeVisible()
  await expect(page.getByText('1분 5초', { exact: true })).toBeVisible()
  await expect(page.getByText('1회', { exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('record-detail-narrow.png'), fullPage: true })
  await page.getByRole('link', { name: '기록 목록으로 돌아가기' }).click()
  await expect(page.getByLabel('시작일')).toHaveValue(original)
  await expect(page.getByRole('table')).toBeVisible()
  await page.goBack()
  await expect(page.getByRole('heading', { name: '수행 기록 상세' })).toBeVisible()
})
test('RW-03 actual period filter and invalid input recovery', async ({ page, context }, info) => {
  await join(context)
  const historical = await seed(context, 7, 'interrupted', 14)
  await seed(context)
  await page.goto('/records')
  await expect(page.getByRole('link', { name: /^fixture-1 .*기록 상세/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /^fixture-7 .*기록 상세/ })).toHaveCount(0)
  const old = day(new Date(historical.ended_at))
  await filter(page, old, old)
  await expect(page.getByRole('link', { name: /^fixture-7 .*기록 상세/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /^fixture-1 .*기록 상세/ })).toHaveCount(0)
  await page.screenshot({ path: info.outputPath('records-period.png'), fullPage: true })
  const tomorrowFromOld = new Date(historical.ended_at)
  tomorrowFromOld.setDate(tomorrowFromOld.getDate() + 1)
  await filter(page, day(tomorrowFromOld), old)
  await expect(page.getByRole('alert')).toHaveText(
    '오늘까지의 날짜로 시작일·종료일 순서를 확인해 주세요.',
  )
  await filter(page, old, old)
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.getByRole('link', { name: /^fixture-7 .*기록 상세/ })).toBeVisible()
})
test('RW-04 actual bounded pagination uses one cutoff and keyboard', async ({
  page,
  context,
}, info) => {
  await join(context)
  for (let i = 1; i <= 21; i++) await seed(context, i)
  await page.goto('/records')
  await expect(page.getByRole('row')).toHaveCount(21)
  const first = await page
    .locator('tbody a')
    .evaluateAll((links) => links.map((link) => link.getAttribute('href')))
  const firstRequest = requests.find((url) => url.includes('/api/v1/records/stretch?'))
  await page.getByRole('button', { name: '다음 페이지' }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('row')).toHaveCount(2)
  await expect(page.locator('.records-results h2')).toBeFocused()
  await expect(page.getByRole('button', { name: '다음 페이지' })).toBeDisabled()
  const next = await page.locator('tbody a').getAttribute('href')
  expect(first).not.toContain(next)
  const secondRequest = requests.find((url) => url.includes('offset=20'))
  expect(new URL(firstRequest as string).searchParams.get('end')).toBe(
    new URL(secondRequest as string).searchParams.get('end'),
  )
  await page.screenshot({ path: info.outputPath('records-page-two.png'), fullPage: true })
  await page.getByRole('button', { name: '이전 페이지' }).click()
  await expect(page.getByRole('row')).toHaveCount(21)
})
test('RW-05 read failure recovery and cancelled late response after real logout', async ({
  page,
  context,
}, info) => {
  await join(context)
  await seed(context)
  await page.route('**/api/v1/records/stretch?**', (route) => route.abort('failed'))
  await page.goto('/records')
  await expect(page.getByRole('heading', { name: '기록을 불러오지 못했습니다' })).toBeVisible()
  await expect(page.getByRole('table')).toHaveCount(0)
  await page.screenshot({ path: info.outputPath('records-read-error.png'), fullPage: true })
  await page.unroute('**/api/v1/records/stretch?**')
  await page.getByRole('button', { name: '다시 조회' }).click()
  await expect(page.getByRole('table')).toBeVisible()
  let release: () => void = () => {}
  let actualRead = false
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route('**/api/v1/records/stretch?**', async (route) => {
    const response = await route.fetch()
    actualRead = true
    await held
    try {
      await route.fulfill({ response })
    } catch {
      /* aborted by account recheck */
    }
  })
  try {
    await page.reload()
    await expect.poll(() => actualRead).toBe(true)
    await expect(page.getByText('기록을 불러오고 있습니다.')).toBeVisible()
    await page.screenshot({ path: info.outputPath('records-loading.png'), fullPage: true })
    expect((await post(context, '/auth/logout')).status()).toBe(204)
    await page.evaluate(() => window.dispatchEvent(new Event('focus')))
    await expect(page.getByRole('heading', { name: '다시 만나 반갑습니다' })).toBeVisible()
    release()
    await expect(page.getByRole('table')).toHaveCount(0)
  } finally {
    release()
  }
})
test('RW-06 own-only detail, second account and Back after logout', async ({
  page,
  context,
}, info) => {
  await join(context)
  const record = await seed(context)
  await page.goto(`/records/${record.id}`)
  await expect(page.getByText('fixture-not-release', { exact: true })).toBeVisible()
  expect((await post(context, '/auth/logout')).status()).toBe(204)
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(page.getByRole('heading', { name: '다시 만나 반갑습니다' })).toBeVisible()
  await page.goBack()
  await expect(page.getByText('fixture-not-release', { exact: true })).toHaveCount(0)
  await join(context)
  await page.goto('/records')
  await expect(
    page.getByRole('heading', { name: '이 기간에는 수행 기록이 없습니다' }),
  ).toBeVisible()
  const foreign = await context.request.get(`/api/v1/records/stretch/${record.id}`)
  expect(foreign.status()).toBe(404)
  await page.goto(`/records/${record.id}`)
  await expect(page.getByRole('heading', { name: '기록을 찾을 수 없습니다' })).toBeVisible()
  await expect(page.getByText('fixture-not-release', { exact: true })).toHaveCount(0)
  await page.screenshot({ path: info.outputPath('record-unavailable.png'), fullPage: true })
  await page.goto('/records/not-an-id')
  await expect(page.getByRole('heading', { name: '기록을 찾을 수 없습니다' })).toBeVisible()
})
