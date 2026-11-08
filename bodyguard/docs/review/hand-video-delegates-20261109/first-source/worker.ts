// Local test only. The input is a public prerecorded hand clip, never a user camera.
import { FilesetResolver, GestureRecognizer } from '@mediapipe/tasks-vision'

type Point = { x: number; y: number }
type Stats = { values: number[] }
const cpuGpu: Stats = { values: [] },
  cpuReference: Stats = { values: [] },
  gpuReference: Stats = { values: [] }
const timings = { CPU: [] as number[], GPU: [] as number[] }
const counts = { frames: 0, both: 0, cpuOnly: 0, gpuOnly: 0, neither: 0 }
let cpu: GestureRecognizer | undefined, gpu: GestureRecognizer | undefined
const valid = (points: readonly Point[] | undefined) =>
  Array.isArray(points) &&
  points.length === 21 &&
  points.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
function addPair(
  stats: Stats,
  a: readonly Point[],
  b: readonly Point[],
  width: number,
  height: number,
) {
  for (let i = 0; i < 21; i++)
    stats.values.push(Math.hypot((a[i].x - b[i].x) * width, (a[i].y - b[i].y) * height))
}
function addReference(
  stats: Stats,
  actual: readonly Point[],
  reference: readonly number[][],
  width: number,
  height: number,
) {
  if (
    reference.length !== 21 ||
    reference.some((p) => !Number.isFinite(p[0]) || !Number.isFinite(p[1]))
  )
    throw new Error('Invalid reference')
  for (let i = 0; i < 21; i++)
    stats.values.push(
      Math.hypot(actual[i].x * width - reference[i][0], actual[i].y * height - reference[i][1]),
    )
}
function summarize(stats: Stats) {
  const values = stats.values.toSorted((a, b) => a - b)
  if (!values.length) return null
  return {
    count: values.length,
    meanPixels: values.reduce((sum, n) => sum + n, 0) / values.length,
    p95Pixels: values[Math.ceil(values.length * 0.95) - 1],
    maxPixels: values.at(-1),
  }
}
function summarizeTime(values: number[]) {
  const sorted = values.toSorted((a, b) => a - b)
  return sorted.length
    ? {
        count: sorted.length,
        medianMs: sorted[Math.floor(sorted.length / 2)],
        p95Ms: sorted[Math.ceil(sorted.length * 0.95) - 1],
      }
    : null
}
self.onmessage = async (event: MessageEvent) => {
  const data = event.data
  try {
    if (data.type === 'init') {
      const vision = await FilesetResolver.forVisionTasks('/mediapipe/wasm')
      const response = await fetch('/models/gesture_recognizer.task')
      if (!response.ok) throw new Error('Model unavailable')
      const model = await response.arrayBuffer()
      const create = (delegate: 'GPU' | 'CPU') =>
        GestureRecognizer.createFromOptions(vision, {
          canvas: new OffscreenCanvas(1, 1),
          baseOptions: { modelAssetBuffer: new Uint8Array(model.slice(0)), delegate },
          runningMode: 'VIDEO',
          numHands: 1,
        })
      gpu = await create('GPU')
      cpu = await create('CPU')
      self.postMessage({ type: 'ready' })
    } else if (data.type === 'frame') {
      const bitmap: ImageBitmap = data.bitmap
      try {
        if (!gpu || !cpu) throw new Error('Not ready')
        let cpuResult: ReturnType<GestureRecognizer['recognizeForVideo']> | undefined
        let gpuResult: ReturnType<GestureRecognizer['recognizeForVideo']> | undefined
        for (const delegate of data.index % 2 ? ['CPU', 'GPU'] : ['GPU', 'CPU']) {
          const start = performance.now()
          if (delegate === 'GPU') gpuResult = gpu.recognizeForVideo(bitmap, data.at)
          else cpuResult = cpu.recognizeForVideo(bitmap, data.at)
          timings[delegate as 'CPU' | 'GPU'].push(performance.now() - start)
        }
        const a = cpuResult?.landmarks[0],
          b = gpuResult?.landmarks[0]
        const ca = valid(a),
          gb = valid(b)
        counts.frames++
        if (ca && gb) counts.both++
        else if (ca) counts.cpuOnly++
        else if (gb) counts.gpuOnly++
        else counts.neither++
        if (ca && gb) addPair(cpuGpu, a as Point[], b as Point[], data.width, data.height)
        if (ca) addReference(cpuReference, a as Point[], data.reference, data.width, data.height)
        if (gb) addReference(gpuReference, b as Point[], data.reference, data.width, data.height)
        self.postMessage({ type: 'frame-done', index: data.index })
      } finally {
        bitmap.close()
      }
    } else if (data.type === 'close') {
      self.postMessage({
        type: 'summary',
        counts,
        cpuGpu: summarize(cpuGpu),
        cpuReference: summarize(cpuReference),
        gpuReference: summarize(gpuReference),
        timings: { CPU: summarizeTime(timings.CPU), GPU: summarizeTime(timings.GPU) },
      })
      let clean = true
      try {
        cpu?.close()
      } catch {
        clean = false
      }
      try {
        gpu?.close()
      } catch {
        clean = false
      }
      self.postMessage({ type: 'closed', clean })
    }
  } catch {
    self.postMessage({ type: 'error', stage: data?.type ?? 'unknown' })
  }
}
