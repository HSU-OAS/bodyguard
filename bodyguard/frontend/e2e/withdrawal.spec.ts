// FR-U-04/05/NFR-08: real production Chrome + HTTP/SQL, synthetic test-only mail/clock.

import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { readFileSync, renameSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { type BrowserContext, expect, type Locator, type Page, test } from '@playwright/test'

const origin = 'http://localhost:4173'
const password = '격리된 계정 웹 시험 비밀번호 12345'
const mailbox = process.env.BODYGUARD_TEST_MAILBOX
const clock = process.env.BODYGUARD_TEST_RECORD_CLOCK
if (
  !mailbox?.startsWith('/private/tmp/bodyguard-browser-') ||
  !clock?.startsWith('/private/tmp/bodyguard-browser-')
)
  throw new Error('Isolated mailbox/clock required')
let requests: string[] = [],
  cameraCalls = 0,
  errors: string[] = []
test.beforeEach(async ({ context, page }) => {
  requests = []
  cameraCalls = 0
  errors = []
  writeFileSync(clock as string, '{"offset_seconds":0}')
  context.on('request', (request) => requests.push(request.url()))
  page.on('pageerror', (error) => errors.push(error.message))
  await context.exposeBinding('__accountWebCamera', () => {
    cameraCalls++
  })
  await context.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => {
      void (window as unknown as { __accountWebCamera: () => Promise<void> }).__accountWebCamera()
      return Promise.reject(new Error('Unexpected camera request'))
    }
  })
})
test.afterEach(async ({ page }) => {
  writeFileSync(clock as string, '{"offset_seconds":0}')
  expect(cameraCalls).toBe(0)
  expect(errors).toEqual([])
  expect(requests.every((url) => new URL(url).origin === origin)).toBe(true)
  expect(requests.some((url) => /\.glb|\.task|\.wasm|mediapipe/.test(url))).toBe(false)
  expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0])
})
async function post(context: BrowserContext, path: string, data?: unknown) {
  const csrf = await (await context.request.get(`${origin}/api/v1/auth/csrf`)).json()
  return context.request.post(`${origin}/api/v1${path}`, {
    headers: { Origin: origin, 'X-CSRF-Token': csrf.csrf_token },
    data,
  })
}
async function mailCode(email: string) {
  let code = ''
  await expect
    .poll(() => {
      code = JSON.parse(readFileSync(mailbox as string, 'utf8'))[email] ?? ''
      return code
    })
    .toMatch(/^[0-9]{6}$/)
  return code
}
async function join(context: BrowserContext) {
  const email = `account-web-${randomUUID()}@example.com`
  const result = await post(context, '/auth/signup', { email, password })
  expect(result.status()).toBe(202)
  const verified = await post(context, '/auth/verify', {
    challenge_id: (await result.json()).challenge_id,
    code: await mailCode(email),
  })
  expect(verified.status()).toBe(201)
  return email
}
async function seed(context: BrowserContext) {
  const end = new Date(Date.now() - 1000)
  const row = {
    id: randomUUID(),
    motion_id: 'synthetic-withdrawal',
    protocol_version: 'fixture-not-release',
    started_at: new Date(end.getTime() - 40000).toISOString(),
    ended_at: end.toISOString(),
    outcome: 'interrupted',
    observed_ms: 12000,
    repetitions: 0,
  }
  expect((await post(context, '/records/stretch', row)).status()).toBe(201)
  return row.id
}
async function begin(page: Page, email: string) {
  await page.goto('/account')
  await expect(page.getByText(email, { exact: true })).toBeVisible()
  await page.getByRole('link', { name: '회원 탈퇴 안내' }).click()
  await page.getByRole('button', { name: '탈퇴 인증 코드 받기' }).click()
  await expect(page.getByLabel('탈퇴 인증 코드')).toBeVisible()
  return mailCode(email)
}
async function consent(page: Page, code: string) {
  await page.getByLabel('탈퇴 인증 코드').fill(code)
  await page.getByLabel('확인문').fill('탈퇴')
  await page.getByRole('button', { name: '계정과 기록 삭제', exact: true }).click()
}

// FR-U-05: process-private read-only SQL oracle; never exposed to the browser.
function storedCounts(owners: Record<string, string>) {
  const python = process.env.BODYGUARD_TEST_BACKEND_PYTHON
  if (!python?.startsWith('/')) throw new Error('Owned backend interpreter required')
  return JSON.parse(
    execFileSync(python, ['-m', 'tests.withdrawal_data_probe'], {
      cwd: fileURLToPath(new URL('../../backend/', import.meta.url)),
      input: JSON.stringify(owners),
      encoding: 'utf8',
      timeout: 5000,
      maxBuffer: 4096,
    }),
  ) as Record<string, Record<string, number>>
}
const preferenceDefaults = {
  posture_enabled: true,
  posture_minutes: 5,
  sitting_enabled: true,
  sitting_minutes: 50,
  sound_enabled: false,
}
async function readOwned(context: BrowserContext, path: string) {
  const response = await context.request.get(`${origin}/api/v1${path}`)
  expect(response.status()).toBe(200)
  return response.json()
}
async function seedAll(context: BrowserContext, deviation: number) {
  const owner = (await readOwned(context, '/me')).id as string
  const record = await seed(context)
  const baselines: string[] = []
  for (const value of [deviation, deviation + 1]) {
    const id = randomUUID()
    expect(
      (
        await post(context, '/baselines', {
          id,
          client_version: 'Fixture+V1',
          neck: null,
          trunk: null,
          shoulder: { method: 'fixture-shoulder', unit: 'deg', value },
        })
      ).status(),
    ).toBe(201)
    baselines.push(id)
  }
  const empty = { unit: 'deg', dev_mean: null, measured_sec: 0, bad_sec: 0 }
  expect(
    (
      await post(context, '/summaries/batch', {
        items: [
          {
            minute_start: new Date(
              Math.floor(Date.now() / 60000) * 60000 - 5 * 60000,
            ).toISOString(),
            baseline_id: baselines[0],
            client_version: 'Fixture+V1',
            coverage_sec: 60,
            measured_sec: 30,
            unmeasurable_sec: 20,
            present_sec: 45,
            background_sec: 10,
            any_bad_sec: 15,
            neck: { ...empty, method: 'fixture-neck' },
            trunk: { ...empty, method: 'fixture-trunk' },
            shoulder: {
              ...empty,
              method: 'fixture-shoulder',
              dev_mean: deviation,
              measured_sec: 30,
              bad_sec: 15,
            },
          },
        ],
      })
    ).status(),
  ).toBe(201)
  const preferences = {
    ...preferenceDefaults,
    posture_enabled: false,
    posture_minutes: 15,
    sitting_minutes: deviation === 1.25 ? 90 : 75,
    sound_enabled: true,
  }
  expect((await post(context, '/settings/notifications', preferences)).status()).toBe(200)
  return { owner, record, baselines, preferences }
}
async function snapshotAll(context: BrowserContext, ids: Awaited<ReturnType<typeof seedAll>>) {
  return {
    records: await readOwned(context, '/records/stretch'),
    summaries: await readOwned(context, '/summaries'),
    active: await readOwned(context, '/baselines/active'),
    past: await readOwned(context, `/baselines/${ids.baselines[0]}`),
    current: await readOwned(context, `/baselines/${ids.baselines[1]}`),
    preferences: await readOwned(context, '/settings/notifications'),
  }
}
async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
}
async function contrast(element: Locator, property: 'color' | 'borderTopColor' | 'outlineColor') {
  return element.evaluate((node, prop) => {
    let parent: Element | null = node,
      background = 'rgb(255, 255, 255)'
    while (parent) {
      const value = getComputedStyle(parent).backgroundColor
      if (value !== 'rgba(0, 0, 0, 0)' && value !== 'transparent') {
        background = value
        break
      }
      parent = parent.parentElement
    }
    const luminance = (color: string) => {
      const values = color
        .match(/[\d.]+/g)
        ?.slice(0, 3)
        .map(Number)
        .map((v) => {
          const n = v / 255
          return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4
        })
      if (values?.length !== 3) throw new Error('Unsupported rendered color')
      return (values[0] ?? 0) * 0.2126 + (values[1] ?? 0) * 0.7152 + (values[2] ?? 0) * 0.0722
    }
    const front = luminance(getComputedStyle(node)[prop]),
      back = luminance(background)
    return (Math.max(front, back) + 0.05) / (Math.min(front, back) + 0.05)
  }, property)
}

test('AW-B07 전체 데이터 취소·본인만 탈퇴·동일 이메일 웹 재가입', async ({
  page,
  context,
  browser,
}, info) => {
  const email = await join(context)
  const owner = await seedAll(context, 1.25)
  const other = await browser.newContext({ baseURL: origin })
  const oldSession = await browser.newContext({ baseURL: origin })
  other.on('request', (request) => requests.push(request.url()))
  oldSession.on('request', (request) => requests.push(request.url()))
  try {
    await join(other)
    const otherData = await seedAll(other, 2.5)
    expect((await post(oldSession, '/auth/login', { email, password })).status()).toBe(200)
    const identities = { owner: owner.owner, other: otherData.owner }
    const before = storedCounts(identities)
    const expectedData = {
      users: 1,
      stretch_records: 1,
      baselines: 2,
      minute_summaries: 1,
      notification_preferences: 1,
    }
    expect(before.owner).toEqual({ ...expectedData, sessions: 2 })
    expect(before.other).toEqual({ ...expectedData, sessions: 1 })
    const ownerSnapshot = await snapshotAll(context, owner)
    const otherSnapshot = await snapshotAll(other, otherData)
    expect(ownerSnapshot.preferences).toEqual(owner.preferences)
    expect(otherSnapshot.preferences).toEqual(otherData.preferences)
    expect(ownerSnapshot.past.is_active).toBe(false)
    expect(ownerSnapshot.current.is_active).toBe(true)
    await begin(page, email)
    await page.getByRole('link', { name: '탈퇴 취소하고 돌아가기' }).click()
    await expect(page.getByRole('heading', { name: '내 계정' })).toBeVisible()
    expect(requests.filter((url) => url.endsWith('/me/delete/confirm'))).toHaveLength(0)
    const cancelled = storedCounts(identities)
    expect(cancelled).toEqual(before)
    expect(await snapshotAll(context, owner)).toEqual(ownerSnapshot)
    expect(await snapshotAll(other, otherData)).toEqual(otherSnapshot)

    const code = await begin(page, email)
    const confirmation = page.waitForResponse((response) =>
      response.url().endsWith('/me/delete/confirm'),
    )
    await consent(page, code)
    expect((await confirmation).status()).toBe(204)
    await expect(page.getByRole('heading', { name: '회원 탈퇴가 완료되었습니다' })).toBeVisible()
    await page.screenshot({
      path: info.outputPath('all-data-withdrawal-complete.png'),
      fullPage: true,
    })
    expect((await oldSession.request.get(`${origin}/api/v1/me`)).status()).toBe(401)
    const removed = storedCounts(identities)
    const zero = {
      users: 0,
      sessions: 0,
      stretch_records: 0,
      baselines: 0,
      minute_summaries: 0,
      notification_preferences: 0,
    }
    expect(removed.owner).toEqual(zero)
    expect(removed.other).toEqual(before.other)
    expect(await snapshotAll(other, otherData)).toEqual(otherSnapshot)

    // Actual unchanged signup web, not a simulated login or direct verify response.
    await page.goto('/signup')
    await page.getByLabel('이메일', { exact: true }).fill(email)
    await page.getByLabel('비밀번호', { exact: true }).fill(password)
    await page.getByRole('button', { name: '인증 코드 받기', exact: true }).click()
    await expect(page.getByRole('heading', { name: '이메일을 확인해 주세요' })).toBeVisible()
    await page.getByLabel('인증 코드', { exact: true }).fill(await mailCode(email))
    await page.getByRole('button', { name: '인증하고 시작하기' }).click()
    await expect(page.getByText(email, { exact: true })).toBeVisible()
    const fresh = (await readOwned(context, '/me')).id as string
    expect(fresh).not.toBe(owner.owner)
    expect((await readOwned(context, '/records/stretch')).items).toEqual([])
    expect((await readOwned(context, '/summaries')).items).toEqual([])
    expect(await readOwned(context, '/baselines/active')).toBeNull()
    for (const id of owner.baselines)
      expect((await context.request.get(`${origin}/api/v1/baselines/${id}`)).status()).toBe(404)
    expect(
      (await context.request.get(`${origin}/api/v1/records/stretch/${owner.record}`)).status(),
    ).toBe(404)
    expect(await readOwned(context, '/settings/notifications')).toEqual(preferenceDefaults)
    const rejoined = storedCounts({ ...identities, fresh })
    expect(rejoined.owner).toEqual(zero)
    expect(rejoined.fresh).toEqual({ ...zero, users: 1, sessions: 1 })
    expect(rejoined.other).toEqual(before.other)
    expect(await snapshotAll(other, otherData)).toEqual(otherSnapshot)
    await page.goto('/records')
    await expect(
      page.getByRole('heading', { name: '이 기간에는 수행 기록이 없습니다' }),
    ).toBeVisible()
    await page.screenshot({ path: info.outputPath('rejoined-stretch-empty.png'), fullPage: true })
    await page.goto('/posture-records')
    await expect(
      page.getByRole('heading', { name: '이 기간에는 자세 기록이 없습니다' }),
    ).toBeVisible()
    await page.screenshot({ path: info.outputPath('rejoined-minutes-empty.png'), fullPage: true })
    const storage = await page.evaluate(() => [localStorage.length, sessionStorage.length])
    expect(storage).toEqual([0, 0])
    expect(cameraCalls).toBe(0)
    expect(errors).toEqual([])
    expect(requests.every((url) => new URL(url).origin === origin)).toBe(true)
    expect(requests.some((url) => /\.glb|\.task|\.wasm|mediapipe/.test(url))).toBe(false)
    await info.attach('all-data-private-sql-boundary', {
      body: JSON.stringify({
        before,
        cancelled,
        removed,
        rejoined,
        browser: browser.version(),
        cameraCalls,
        storage,
        pageErrors: errors.length,
        allRequestsLocal: true,
        modelRequests: 0,
        cancelDeleteRequests: 0,
        confirmedDeleteRequests: 1,
        actualSqlReadOnly: true,
        synthetic: ['accounts', 'mailbox', 'summaries', 'baselines', 'preferences'],
        actual: ['browser', 'HTTP', 'FastAPI', 'PostgreSQL', 'signup-web', 'withdrawal-web'],
      }),
      contentType: 'application/json',
    })
    expect(requests.filter((url) => url.endsWith('/me/delete/confirm'))).toHaveLength(1)
  } finally {
    await oldSession.close()
    await other.close()
  }
})

test('AW-B01 계정·취소·기록 보존·좁은 웹·키보드·대비', async ({ page, context }, info) => {
  const email = await join(context),
    id = await seed(context)
  await page.goto('/account')
  await expect(page.getByRole('heading', { name: '내 계정' })).toBeVisible()
  await expect(page.getByRole('link', { name: '내 계정', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  )
  await expect(page.getByRole('link', { name: '수행 기록 관리' })).toHaveCSS(
    'background-color',
    'rgb(30, 90, 168)',
  )
  await page.screenshot({ path: info.outputPath('account-desktop.png'), fullPage: true })
  for (const width of [768, 375]) {
    await page.setViewportSize({ width, height: 1000 })
    await noOverflow(page)
    await page.screenshot({ path: info.outputPath(`account-${width}.png`), fullPage: true })
  }
  await page.getByRole('link', { name: '회원 탈퇴 안내' }).click()
  await page.screenshot({ path: info.outputPath('withdrawal-intro-375.png'), fullPage: true })
  expect(await contrast(page.locator('.member-lead'), 'color')).toBeGreaterThanOrEqual(4.5)
  await page.getByRole('button', { name: '탈퇴 인증 코드 받기' }).click()
  const code = page.getByLabel('탈퇴 인증 코드')
  await expect(code).toBeFocused()
  await expect(page.locator('.withdrawal-form')).toHaveCSS('margin-top', '32px')
  expect(await contrast(code, 'borderTopColor')).toBeGreaterThanOrEqual(3)
  await page.keyboard.press('Tab')
  await expect(page.getByLabel('확인문')).toBeFocused()
  await expect(page.getByLabel('확인문')).toHaveCSS('outline-width', '3px')
  expect(await contrast(page.getByLabel('확인문'), 'outlineColor')).toBeGreaterThanOrEqual(3)
  await page.getByLabel('탈퇴 인증 코드').fill(await mailCode(email))
  await expect(page.getByRole('button', { name: '계정과 기록 삭제', exact: true })).toBeDisabled()
  await page.getByLabel('확인문').fill('탈퇴')
  const final = page.getByRole('button', { name: '계정과 기록 삭제', exact: true })
  await page.mouse.move(0, 0)
  await expect(final).toHaveCSS('background-color', 'rgb(148, 58, 50)')
  expect(await contrast(final, 'color')).toBeGreaterThanOrEqual(4.5)
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' })
  await expect(final).toHaveCSS('transition-duration', '0s')
  await expect(page.locator('.website')).toHaveCSS('color-scheme', 'light')
  await noOverflow(page)
  await page.screenshot({
    path: info.outputPath('withdrawal-confirm-375.png'),
    fullPage: true,
    mask: [code],
  })
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.screenshot({
    path: info.outputPath('withdrawal-confirm-desktop.png'),
    fullPage: true,
    mask: [code],
  })
  await page.locator('.website').evaluate((node) => {
    ;(node as HTMLElement).style.zoom = '2'
  })
  await noOverflow(page)
  await page.screenshot({
    path: info.outputPath('withdrawal-css-zoom-200.png'),
    fullPage: true,
    mask: [code],
  })
  await page.locator('.website').evaluate((node) => {
    ;(node as HTMLElement).style.zoom = ''
  })
  await page.getByRole('link', { name: '탈퇴 취소하고 돌아가기' }).click()
  await expect(page.getByRole('heading', { name: '내 계정' })).toBeVisible()
  expect(
    (await (await context.request.get(`${origin}/api/v1/records/stretch`)).json()).items.map(
      (row: { id: string }) => row.id,
    ),
  ).toEqual([id])
  expect(requests.filter((url) => url.endsWith('/me/delete/confirm'))).toHaveLength(0)
})

test('AW-B02 오답·최종 동의·204·기존 세션 이탈·타 계정 보존', async ({
  page,
  context,
  browser,
}, info) => {
  const email = await join(context),
    id = await seed(context)
  const oldSession = await browser.newContext({ baseURL: origin })
  const other = await browser.newContext({ baseURL: origin })
  const otherTab = await context.newPage()
  otherTab.on('pageerror', (error) => errors.push(error.message))
  try {
    await otherTab.goto('/account')
    await expect(otherTab.getByText(email, { exact: true })).toBeVisible()
    expect((await post(oldSession, '/auth/login', { email, password })).status()).toBe(200)
    await join(other)
    const otherId = await seed(other)
    const code = await begin(page, email)
    await consent(page, `${(Number(code[0]) + 1) % 10}${code.slice(1)}`)
    await expect(page.getByRole('alert')).toContainText('인증 코드를 확인')
    expect(
      (await (await context.request.get(`${origin}/api/v1/records/stretch`)).json()).items.map(
        (row: { id: string }) => row.id,
      ),
    ).toEqual([id])
    await page.screenshot({ path: info.outputPath('withdrawal-wrong-code.png'), fullPage: true })
    let release: (() => void) | undefined
    const held = new Promise<void>((done) => {
      release = done
    })
    await page.route('**/api/v1/me/delete/confirm', async (route) => {
      const actual = await route.fetch()
      expect(actual.status()).toBe(204)
      await held
      await route.fulfill({ response: actual })
    })
    try {
      await consent(page, code)
      await expect(page.getByRole('button', { name: '삭제 결과 확인 중…' })).toBeDisabled()
      await expect(page.getByRole('link', { name: '내 계정', exact: true })).toHaveCount(0)
      await page.screenshot({
        path: info.outputPath('withdrawal-pending.png'),
        fullPage: true,
        mask: [page.getByLabel('탈퇴 인증 코드')],
      })
    } finally {
      release?.()
    }
    await expect(page.getByRole('heading', { name: '회원 탈퇴가 완료되었습니다' })).toBeVisible()
    await expect(page.getByRole('heading', { name: '회원 탈퇴가 완료되었습니다' })).toBeFocused()
    await expect(otherTab.getByRole('heading', { name: '다시 만나 반갑습니다' })).toBeVisible()
    await page.setViewportSize({ width: 375, height: 900 })
    await noOverflow(page)
    await page.screenshot({ path: info.outputPath('withdrawal-completed-375.png'), fullPage: true })
    expect((await context.request.get(`${origin}/api/v1/me`)).status()).toBe(401)
    expect((await oldSession.request.get(`${origin}/api/v1/records/stretch/${id}`)).status()).toBe(
      401,
    )
    expect(
      (await (await other.request.get(`${origin}/api/v1/records/stretch`)).json()).items.map(
        (row: { id: string }) => row.id,
      ),
    ).toEqual([otherId])
    await page.goto('/account')
    await expect(page.getByRole('heading', { name: '다시 만나 반갑습니다' })).toBeVisible()
    expect((await post(context, '/auth/login', { email, password })).status()).toBe(401)
    expect(requests.filter((url) => url.endsWith('/me/delete/confirm'))).toHaveLength(2)
  } finally {
    await otherTab.close()
    await oldSession.close()
    await other.close()
  }
})

test('AW-B03 실제10분 확인 만료·새 발송·이전 확인 거부·기록 보존', async ({
  page,
  context,
}, info) => {
  const email = await join(context),
    id = await seed(context)
  let first = ''
  page.on('response', async (response) => {
    if (response.url().endsWith('/me/delete/start') && response.status() === 202 && !first)
      first = (await response.json()).challenge_id
  })
  const oldCode = await begin(page, email)
  const next = `${clock}.next`
  writeFileSync(next, '{"offset_seconds":601}')
  renameSync(next, clock as string)
  await consent(page, oldCode)
  await expect(page.getByRole('alert')).toContainText('만료')
  expect(
    (await (await context.request.get(`${origin}/api/v1/records/stretch`)).json()).items.map(
      (row: { id: string }) => row.id,
    ),
  ).toEqual([id])
  await page.screenshot({ path: info.outputPath('withdrawal-expired.png'), fullPage: true })
  await page.getByRole('button', { name: '인증 코드 다시 받기' }).click()
  await expect(page.getByLabel('탈퇴 인증 코드')).toBeVisible()
  expect(
    (
      await post(context, '/me/delete/confirm', {
        challenge_id: first,
        code: oldCode,
        confirmation: 'delete-my-account',
      })
    ).status(),
  ).toBe(400)
  await consent(page, await mailCode(email))
  await expect(page.getByRole('heading', { name: '회원 탈퇴가 완료되었습니다' })).toBeVisible()
})

test('AW-B04 서버 삭제 후 응답 단절은 완료 추정·자동 삭제 재시도0', async ({
  page,
  context,
}, info) => {
  const email = await join(context)
  await seed(context)
  const code = await begin(page, email)
  await page.route('**/api/v1/me/delete/confirm', async (route) => {
    const actual = await route.fetch()
    expect(actual.status()).toBe(204)
    await route.abort('failed')
  })
  await consent(page, code)
  await expect(page.getByRole('heading', { name: '계정 상태를 다시 확인해 주세요' })).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCSS('color', 'rgb(156, 44, 35)')
  expect(await contrast(page.getByRole('alert'), 'color')).toBeGreaterThanOrEqual(4.5)
  await expect(page.getByRole('heading', { name: '회원 탈퇴가 완료되었습니다' })).toHaveCount(0)
  await page.screenshot({ path: info.outputPath('withdrawal-response-lost.png'), fullPage: true })
  await page.getByRole('button', { name: '계정 상태 확인' }).click()
  await expect(page.getByRole('link', { name: '로그인하여 계정 확인' })).toBeVisible()
  expect((await context.request.get(`${origin}/api/v1/me`)).status()).toBe(401)
  expect(requests.filter((url) => url.endsWith('/me/delete/confirm'))).toHaveLength(1)
})

test('AW-B05 서버 전 미전송 실패·결과 불확실 복구는 실제 계정·기록 보존', async ({
  page,
  context,
}, info) => {
  const email = await join(context),
    id = await seed(context)
  const code = await begin(page, email)
  await page.route('**/api/v1/me/delete/confirm', (route) => route.abort('failed'))
  await consent(page, code)
  await expect(page.getByRole('heading', { name: '계정 상태를 다시 확인해 주세요' })).toBeVisible()
  await page.getByRole('button', { name: '계정 상태 확인' }).click()
  await page.getByRole('link', { name: '계정 관리로 돌아가기' }).click()
  await expect(page.getByText(email, { exact: true })).toBeVisible()
  expect(
    (await (await context.request.get(`${origin}/api/v1/records/stretch`)).json()).items.map(
      (row: { id: string }) => row.id,
    ),
  ).toEqual([id])
  await page.screenshot({
    path: info.outputPath('withdrawal-failure-restored-account.png'),
    fullPage: true,
  })
  expect(requests.filter((url) => url.endsWith('/me/delete/confirm'))).toHaveLength(1)
})

test('AW-B06 429·메일 실패 응답 UI는 전송 완료·삭제로 표시하지 않음', async ({
  page,
  context,
}, info) => {
  const email = await join(context),
    id = await seed(context)
  await page.goto('/account/delete')
  await expect(page.getByText(email, { exact: true })).toBeVisible()
  // Fault responses are injected here; real mail rejection/quota are API tests, not SMTP.
  await page.route('**/api/v1/me/delete/start', (route) =>
    route.fulfill({ status: 503, body: '{}' }),
  )
  await page.getByRole('button', { name: '탈퇴 인증 코드 받기' }).click()
  await expect(page.getByRole('alert')).toContainText('전송을 확인하지 못했습니다')
  await page.screenshot({ path: info.outputPath('withdrawal-send-error.png'), fullPage: true })
  await page.unroute('**/api/v1/me/delete/start')
  await page.route('**/api/v1/me/delete/start', (route) =>
    route.fulfill({ status: 429, headers: { 'Retry-After': '20' }, body: '{}' }),
  )
  await page.getByRole('button', { name: '탈퇴 인증 코드 받기' }).click()
  await expect(page.getByText(/다시 요청까지 \d+초/)).toBeVisible()
  await expect(page.getByRole('button', { name: '탈퇴 인증 코드 받기' })).toBeDisabled()
  await expect(page.getByLabel('탈퇴 인증 코드')).toHaveCount(0)
  await page.setViewportSize({ width: 375, height: 900 })
  await noOverflow(page)
  await page.screenshot({
    path: info.outputPath('withdrawal-rate-limited-375.png'),
    fullPage: true,
  })
  expect(
    (await (await context.request.get(`${origin}/api/v1/records/stretch`)).json()).items.map(
      (row: { id: string }) => row.id,
    ),
  ).toEqual([id])
})
