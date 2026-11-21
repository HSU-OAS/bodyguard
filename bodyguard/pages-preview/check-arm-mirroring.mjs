import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { extname, isAbsolute, resolve } from 'node:path'

// Use real GLBs and WebGL with synthetic inputs. Never open a physical camera.
const require = createRequire(new URL('../frontend/package.json', import.meta.url))
const { chromium } = require('@playwright/test')
assert.ok(process.argv[2] && isAbsolute(process.argv[2]), 'Pass the absolute preview build path')
const output = resolve(process.argv[2])
const mount = resolve(output, '..')
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost')
    const file = resolve(mount, '.' + url.pathname)
    if (!file.startsWith(output + '/')) throw new Error('Not a preview path')
    const types = { '.js': 'text/javascript', '.html': 'text/html', '.wasm': 'application/wasm' }
    res.setHeader('Content-Type', types[extname(file)] ?? 'application/octet-stream')
    res.end(await readFile(file))
  } catch {
    res.writeHead(404).end()
  }
})
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
let browser
let failed = false
try {
  browser = await chromium.launch({
    channel: 'chrome',
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
  })
  const page = await browser.newPage({ viewport: { width: 1280, height: 930 } })
  const imagePage = await browser.newPage()
  const pageErrors = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page.addInitScript(() => {
    window.lift = 'none'
    window.Worker = class extends EventTarget {
      send(data) {
        queueMicrotask(() => this.dispatchEvent(new MessageEvent('message', { data })))
      }
      constructor() {
        super()
        this.send({ type: 'boot' })
      }
      terminate() {}
      postMessage({ type, id, generation, at, frame }) {
        if (type === 'init') return this.send({ type: 'ready', id, generation })
        if (type === 'close') return this.send({ type: 'closed', generation, clean: true })
        frame.close()
        // Raw front-facing image: subject's right shoulder is at x < .5.
        const landmarks = Array.from({ length: 33 }, () => ({
          x: 0.5,
          y: 0.18,
          z: 0,
          visibility: 0.99,
          presence: 0.99,
        }))
        const locations = {
          11: [0.62, 0.31],
          12: [0.38, 0.31],
          13: [0.65, 0.46],
          14: [0.35, 0.46],
          15: [0.66, 0.6],
          16: [0.34, 0.6],
          23: [0.58, 0.59],
          24: [0.42, 0.59],
          25: [0.58, 0.75],
          26: [0.42, 0.75],
          27: [0.58, 0.92],
          28: [0.42, 0.92],
        }
        if (window.lift === 'right') {
          locations[14] = [0.22, 0.24]
          locations[16] = [0.16, 0.09]
        }
        if (window.lift === 'left') {
          locations[13] = [0.78, 0.24]
          locations[15] = [0.84, 0.09]
        }
        for (const [index, [x, y]] of Object.entries(locations))
          Object.assign(landmarks[index], { x, y })
        const worldLandmarks = landmarks.map((p) => ({ ...p, x: p.x - 0.5, y: p.y - 0.59 }))
        this.send({
          type: 'result',
          generation,
          id,
          at,
          result: {
            landmarks: [landmarks],
            worldLandmarks: [worldLandmarks],
            headOrientation: [0, 0, 0, 1],
          },
        })
      }
    }
  })
  const origin = 'http://127.0.0.1:' + server.address().port
  for (const gender of ['male', 'female']) {
    await page.goto(origin + '/bodyguard/inspection.html?motion=neck-side')
    await page.selectOption('#gender', gender)
    await page.click('#start')
    await page.waitForFunction(() => window.bodyguardLivePreview.snapshot().tracked === 9)
    assert.equal(
      await page.locator('#camera').evaluate((el) => getComputedStyle(el).transform),
      'matrix(-1, 0, 0, 1, 0, 0)',
    )
    for (const view of ['full', 'upper', 'detail']) {
      await page.selectOption('#view', view)
      const capture = async (side) => {
        const frames = await page.evaluate((side) => {
          window.lift = side
          return window.bodyguardLivePreview.snapshot().frames
        }, side)
        await page.waitForFunction(
          (frames) => window.bodyguardLivePreview.snapshot().frames >= frames + 12,
          frames,
        )
        return (await page.locator('#avatar').screenshot()).toString('base64')
      }
      const neutral = await capture('none')
      for (const side of ['right', 'left']) {
        const raised = await capture(side)
        const counts = await imagePage.evaluate(
          async ({ neutral, raised }) => {
            async function pixels(data) {
              const image = new Image()
              image.src = 'data:image/png;base64,' + data
              await image.decode()
              const canvas = document.createElement('canvas')
              canvas.width = image.width
              canvas.height = image.height
              const ctx = canvas.getContext('2d')
              ctx.drawImage(image, 0, 0)
              return ctx.getImageData(0, 0, image.width, image.height)
            }
            const a = await pixels(neutral),
              b = await pixels(raised)
            const left = [0, 0],
              right = [0, 0]
            let guideChanged = 0,
              guidePixels = 0
            for (let y = 20; y < a.height; y++)
              for (let x = 0; x < a.width; x++) {
                const i = (y * a.width + x) * 4
                if (x > a.width / 2 + 2) {
                  if (Math.abs(a.data[i] - b.data[i]) > 10) guideChanged++
                  if (a.data[i] < 235) guidePixels++
                  continue
                }
                const bucket = x < a.width / 4 ? left : right
                if (a.data[i] > 248 && b.data[i] < 229) bucket[0]++
                if (a.data[i] < 229 && b.data[i] > 248) bucket[1]++
              }
            return { left, right, guidePixels, guideChanged }
          },
          { neutral, raised },
        )
        console.log(gender, view, side, JSON.stringify(counts))
        try {
          const other = side === 'right' ? 'left' : 'right'
          assert.ok(
            counts[side][0] > 200 && counts[side][0] > 3 * counts[other][0],
            'Raised arm must add its silhouette on the same screen side as the mirrored camera',
          )
          assert.ok(
            counts[side][1] > 200 && counts[side][1] > 3 * counts[other][1],
            'The matching shoulder must lose its resting arm',
          )
          // Upper-body framing can zoom both models to keep the raised hand on screen.
          assert.ok(
            counts.guidePixels > 1000 && (view === 'upper' || counts.guideChanged < 25),
            'The reference guide must remain visible and independent',
          )
        } catch (error) {
          console.error(error.message)
          failed = true
        }
      }
    }
    const stop = async () => {
      await page.click('#stop')
      await page.waitForFunction(() => {
        const state = window.bodyguardLivePreview.snapshot()
        return state.phase === 'idle' && !state.cameraLive && state.error === null
      })
    }
    await stop()
    await page.click('#start')
    await page.waitForFunction(() => {
      const state = window.bodyguardLivePreview.snapshot()
      return state.generation === 2 && state.cameraLive && state.tracked === 9
    })
    await stop()

    await page.goto(origin + '/bodyguard/inspection.html?motion=shoulder-shrug')
    await page.selectOption('#gender', gender)
    const step = page.locator('#reference-step')
    assert.equal(await step.isDisabled(), true)
    await page.click('#start')
    await page.waitForFunction(() => window.bodyguardLivePreview.snapshot().tracked === 9)
    const bounds = await page.locator('#avatar').boundingBox()
    assert.ok(bounds)
    const { x, y, width, height } = bounds
    const left = { x, y, width: Math.floor(width / 2), height }
    const right = { x: x + left.width, y, width: width - left.width, height }
    const settled = async (phase) => {
      await step.selectOption(phase)
      // The authored lift/return clips run once and hold their last pose.
      await page.waitForTimeout(1600)
      return page.screenshot({ clip: right })
    }
    const ready = await page.screenshot({ clip: right })
    const userReady = await page.screenshot({ clip: left })
    const lifted = await settled('seeking-target')
    assert.ok(!ready.equals(lifted), 'The guide must lift its shoulders')
    assert.ok(lifted.equals(await page.screenshot({ clip: right })), 'The guide must not loop')
    assert.ok(userReady.equals(await page.screenshot({ clip: left })), 'The user stays independent')
    const returned = await settled('waiting-return')
    assert.ok(!lifted.equals(returned), 'The guide must return from the lift')
    await stop()
  }
  assert.deepEqual(pageErrors, [])
} finally {
  await browser?.close()
  server.close()
}
if (failed) process.exitCode = 1
