// FR-M-02/07: private SDK lifecycle metadata only, no raw input/output diagnostics.
import { FaceLandmarker, GestureRecognizer, PoseLandmarker } from '@mediapipe/tasks-vision'
import { createWorkerInferenceRuntime } from '../../src/pose/workerInferenceRuntime'
import { prepareWorkerNativeEngine } from '../../src/pose/workerNativeEngine'

let port: MessagePort | undefined
function note(task: string, phase: string, delegate?: unknown, error?: unknown) {
  const name =
    error instanceof Error &&
    ['Error', 'TypeError', 'RuntimeError', 'AbortError'].includes(error.name)
      ? error.name
      : 'other'
  port?.postMessage({
    task,
    phase,
    delegate: delegate === 'GPU' || delegate === 'CPU' ? delegate : null,
    error: error === undefined ? null : name,
    at: performance.timeOrigin + performance.now(),
  })
}
type Task = { close(): void }
for (const [name, kind] of [
  ['body', PoseLandmarker],
  ['face', FaceLandmarker],
  ['hands', GestureRecognizer],
] as const) {
  const create = kind.createFromOptions
  const target = kind as unknown as { createFromOptions(...args: unknown[]): Promise<Task> }
  target.createFromOptions = async (...args) => {
    const delegate = (args[1] as { baseOptions?: { delegate?: unknown } })?.baseOptions?.delegate
    note(name, 'create-begin', delegate)
    try {
      const task = (await Reflect.apply(create, kind, args)) as Task
      note(name, 'create-done', delegate)
      const close = task.close.bind(task)
      task.close = () => {
        note(name, 'close-begin', delegate)
        try {
          close()
          note(name, 'close-done', delegate)
        } catch (error) {
          note(name, 'close-error', delegate, error)
          throw error
        }
      }
      return task
    } catch (error) {
      note(name, 'create-error', delegate, error)
      throw error
    }
  }
}
const runtime = createWorkerInferenceRuntime({
  prepare: prepareWorkerNativeEngine,
  send(message) {
    const data = message as { type?: string; clean?: boolean }
    if (data.type === 'ready' || data.type === 'closed' || data.type === 'error')
      note('runtime', data.type)
    self.postMessage(message)
  },
})
self.addEventListener('message', (event) => {
  if (event.data?.type === 'init' && event.data.probePort instanceof MessagePort)
    port = event.data.probePort
  if (['init', 'frame', 'close'].includes(event.data?.type))
    note('runtime', `receive-${event.data.type}`)
  runtime.receive(event.data)
})
self.postMessage({ type: 'boot' })
