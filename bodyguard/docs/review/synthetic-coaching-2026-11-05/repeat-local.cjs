const { chromium } = require('@playwright/test')

;(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: [
      '--no-sandbox',
      '--enable-unsafe-swiftshader',
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
      '--use-file-for-fake-video-capture=/private/tmp/bodyguard-synthetic-neck.y4m',
    ],
  })
  for (let trial = 1; trial <= 3; trial++) {
    const context = await browser.newContext({ viewport: { width: 1366, height: 768 }, permissions: ['camera'] })
    const page = await context.newPage()
    await page.addInitScript(() => {
      window.__bgTrialEvents = []
      const Original = window.Worker
      window.Worker = class extends Original {
        constructor(...args) {
          super(...args)
          this.addEventListener('message', event => {
            if (window.__bgTrialEvents.length < 12)
              window.__bgTrialEvents.push({ direction: 'in', type: event.data?.type, time: performance.now() })
          })
        }
        postMessage(...args) {
          if (window.__bgTrialEvents.length < 12)
            window.__bgTrialEvents.push({ direction: 'out', type: args[0]?.type, time: performance.now() })
          return super.postMessage(...args)
        }
      }
    })
    await page.route('**/api/v1/me', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{"id":"fixture","email":"test@example.com"}' }))
    try {
      await page.goto('http://127.0.0.1:5197/dev/coaching?motion=neck-side', { waitUntil: 'networkidle' })
      await page.getByRole('button', { name: '시범 미리보기' }).click()
      await page.getByText('시범 후보 · 자동 판정 없음').waitFor({ timeout: 30000 })
      await page.getByRole('button', { name: '카메라 확인' }).click()
      await page.waitForFunction(() => {
        const value = document.querySelector('.camera-preparation')?.innerText || ''
        return value.includes('카메라·분석 연결 확인됨') || value.includes('다시 확인')
      }, { timeout: 45000 })
      const ready = await page.getByRole('button', { name: '입력 확인' }).isVisible()
      let avatar = false
      if (ready) {
        await page.getByRole('button', { name: '입력 확인' }).click()
        try {
          await page.getByText('내 움직임 · 관찰 표시').waitFor({ timeout: 12000 })
          avatar = true
        } catch {}
      }
      const events = await page.evaluate(() => window.__bgTrialEvents)
      const sent = events.find(event => event.direction === 'out' && event.type === 'frame')
      const received = events.find(event => event.direction === 'in' && event.type === 'result')
      console.log(JSON.stringify({ trial, ready, avatar, warmupResponseMs: sent && received ? Math.round(received.time - sent.time) : null }))
    } catch (error) {
      console.log(JSON.stringify({ trial, failure: error.name }))
    } finally {
      await context.close()
    }
  }
  await browser.close()
})().catch(error => { console.error(error.message); process.exit(1) })
