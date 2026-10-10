// FR-M-02/07·NFR-07/08: test-only public factory observations, not product diagnostics.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
const frontend = process.env.BODYGUARD_DIAGNOSTIC_FRONTEND
const mode = process.env.BODYGUARD_DIAGNOSTIC_MODE
const root = process.env.BODYGUARD_DIAGNOSTIC_ROOT
if (!frontend || !['baseline', 'candidate'].includes(mode ?? '') ||
    !root || !/^\/private\/tmp\/bodyguard-preparation-diagnostic\.[A-Za-z0-9]+$/.test(root))
  throw new Error('Owned diagnostic required')
const enginePath = resolve(frontend, 'src/pose/workerNativeEngine.ts')
const workerPath = resolve(frontend, 'src/pose/nativeInference.worker.ts')
const beforePath = '/private/tmp/bodyguard-parallel-preparation.iTBTUe/before-engine.ts'
const diagnosticWorker = `
import { PoseLandmarker, FaceLandmarker, GestureRecognizer } from '@mediapipe/tasks-vision'
import { createWorkerInferenceRuntime } from './workerInferenceRuntime'
import { prepareWorkerNativeEngine } from './workerNativeEngine'
const began = performance.now(), attempts = []
function observe(Task, task) {
  const original = Task.createFromOptions
  Task.createFromOptions = function(vision, options) {
    if (attempts.length >= 6) throw new Error('Diagnostic bound exceeded')
    const attempt = {
      task, requestedDelegate: options.baseOptions.delegate,
      startedMs: performance.now() - began,
      durationMs: null, outcome: 'pending', closes: 0
    }
    attempts.push(attempt)
    const at = performance.now()
    let pending
    try { pending = original.call(this, vision, options) }
    catch (error) { attempt.outcome = 'rejected'; attempt.durationMs = performance.now() - at; throw error }
    return pending.then(
      loaded => {
        attempt.durationMs = performance.now() - at
        attempt.outcome = 'fulfilled'
        const close = loaded.close
        loaded.close = function(...args) {
          attempt.closes++
          return close.apply(this, args)
        }
        return loaded
      },
      error => { attempt.outcome = 'rejected'; attempt.durationMs = performance.now() - at; throw error }
    )
  }
}
observe(PoseLandmarker, 'body')
observe(FaceLandmarker, 'face')
observe(GestureRecognizer, 'hands')
const runtime = createWorkerInferenceRuntime({
  prepare: prepareWorkerNativeEngine,
  send: message => self.postMessage(
    ['ready', 'closed', 'error'].includes(message.type)
      ? { ...message, preparationDiagnostic: {
          elapsedMs: performance.now() - began, attempts: attempts.map(x => ({ ...x }))
        } }
      : message
  )
})
self.addEventListener('message', event => runtime.receive(event.data))
`
function diagnosticPlugin() {
  return {
    name: 'private-preparation-observations',
    enforce: 'pre',
    load(id) {
      const path = id.split('?')[0]
      if (path === workerPath) return diagnosticWorker
      if (path === enginePath && mode === 'baseline') return readFileSync(beforePath, 'utf8')
    }
  }
}
export default {
  root: frontend,
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  worker: { plugins: () => [diagnosticPlugin()] },
  build: {
    outDir: resolve(root, mode), emptyOutDir: false, minify: false,
    lib: {
      entry: resolve(frontend, 'e2e/fixtures/inferenceThreadProbe.ts'),
      formats: ['es'], fileName: () => 'probe.js'
    }
  }
}
