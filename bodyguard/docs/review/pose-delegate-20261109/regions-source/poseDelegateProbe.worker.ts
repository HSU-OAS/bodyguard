// Research only: compare SDK outputs, not clinical accuracy or a webcam.
import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision'

type Point = { x: number; y: number; z: number }
const counts = { frames: 0, both: 0, cpuOnly: 0, gpuOnly: 0, neither: 0, bothWorld: 0 }
const differences = { pixels: [] as number[], world: [] as number[] }
const regionIndices: Record<string, readonly number[]> = {
  head: [0, 7, 8],
  shoulders: [11, 12],
  elbows: [13, 14],
  wrists: [15, 16],
  hips: [23, 24],
  knees: [25, 26],
  ankles: [27, 28],
  feet: [29, 30, 31, 32],
}
const regionPixels: Record<string, number[]> = Object.fromEntries(
  Object.keys(regionIndices).map((name) => [name, []]),
)
const regionVisiblePixels: Record<string, number[]> = Object.fromEntries(
  Object.keys(regionIndices).map((name) => [name, []]),
)
const timings = { CPU: [] as number[], GPU: [] as number[] }
let cpu: PoseLandmarker | undefined, gpu: PoseLandmarker | undefined
const valid = (points: readonly Point[] | undefined) =>
  Array.isArray(points) &&
  points.length === 33 &&
  points.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z))
function summary(values: number[]) {
  if (!values.length) return null
  const sorted = values.toSorted((a, b) => a - b)
  return {
    count: sorted.length,
    mean: sorted.reduce((sum, n) => sum + n, 0) / sorted.length,
    median: sorted[Math.floor((sorted.length - 1) * 0.5)],
    p95: sorted[Math.ceil(sorted.length * 0.95) - 1],
    max: sorted[sorted.length - 1],
  }
}
self.onmessage = async (event: MessageEvent) => {
  const data = event.data
  try {
    if (data.type === 'init') {
      const vision = await FilesetResolver.forVisionTasks('/mediapipe/wasm')
      const response = await fetch('/models/pose_landmarker_lite.task')
      if (!response.ok) throw new Error('Model unavailable')
      const model = await response.arrayBuffer()
      const create = (delegate: 'GPU' | 'CPU') =>
        PoseLandmarker.createFromOptions(vision, {
          canvas: new OffscreenCanvas(1, 1),
          baseOptions: { modelAssetBuffer: new Uint8Array(model.slice(0)), delegate },
          runningMode: 'VIDEO',
          numPoses: 2,
        })
      gpu = await create('GPU')
      cpu = await create('CPU')
      self.postMessage({ type: 'ready' })
    } else if (data.type === 'frame') {
      const bitmap: ImageBitmap = data.bitmap
      let a: ReturnType<PoseLandmarker['detectForVideo']> | undefined
      let b: ReturnType<PoseLandmarker['detectForVideo']> | undefined
      let executionFailed = false,
        cleanupFailed = false
      try {
        if (!gpu || !cpu) throw new Error('Not ready')
        for (const delegate of data.index % 2 ? ['CPU', 'GPU'] : ['GPU', 'CPU']) {
          const start = performance.now()
          if (delegate === 'GPU') b = gpu.detectForVideo(bitmap, data.at)
          else a = cpu.detectForVideo(bitmap, data.at)
          timings[delegate as 'CPU' | 'GPU'].push(performance.now() - start)
        }
        const ca = a?.landmarks.length === 1 && valid(a.landmarks[0])
        const gb = b?.landmarks.length === 1 && valid(b.landmarks[0])
        counts.frames++
        if (ca && gb && a && b) {
          counts.both++
          const frameDistances = []
          for (let i = 0; i < 33; i++) {
            const distance = Math.hypot(
              (a.landmarks[0][i].x - b.landmarks[0][i].x) * data.width,
              (a.landmarks[0][i].y - b.landmarks[0][i].y) * data.height,
            )
            differences.pixels.push(distance)
            frameDistances.push(distance)
          }
          for (const [name, indices] of Object.entries(regionIndices)) {
            for (const i of indices) {
              regionPixels[name].push(frameDistances[i])
              if (
                (a.landmarks[0][i].visibility ?? 0) >= 0.5 &&
                (b.landmarks[0][i].visibility ?? 0) >= 0.5
              )
                regionVisiblePixels[name].push(frameDistances[i])
            }
          }
          if (
            a.worldLandmarks.length === 1 &&
            b.worldLandmarks.length === 1 &&
            valid(a.worldLandmarks[0]) &&
            valid(b.worldLandmarks[0])
          ) {
            counts.bothWorld++
            for (let i = 0; i < 33; i++)
              differences.world.push(
                Math.hypot(
                  a.worldLandmarks[0][i].x - b.worldLandmarks[0][i].x,
                  a.worldLandmarks[0][i].y - b.worldLandmarks[0][i].y,
                  a.worldLandmarks[0][i].z - b.worldLandmarks[0][i].z,
                ),
              )
          }
        } else if (ca) counts.cpuOnly++
        else if (gb) counts.gpuOnly++
        else counts.neither++
      } catch {
        executionFailed = true
      } finally {
        // Attempt every release even if a prior native cleanup fails.
        try {
          a?.close()
        } catch {
          cleanupFailed = true
        }
        try {
          b?.close()
        } catch {
          cleanupFailed = true
        }
        try {
          bitmap.close()
        } catch {
          cleanupFailed = true
        }
      }
      if (executionFailed || cleanupFailed) throw new Error('Frame failed')
      self.postMessage({ type: 'frame-done', index: data.index })
    } else if (data.type === 'close') {
      self.postMessage({
        type: 'summary',
        counts,
        imagePixels: summary(differences.pixels),
        worldModelUnits: summary(differences.world),
        imagePixelsByRegion: Object.fromEntries(
          Object.entries(regionPixels).map(([name, values]) => [name, summary(values)]),
        ),
        imagePixelsByRegionBothVisibilityAtLeastHalf: Object.fromEntries(
          Object.entries(regionVisiblePixels).map(([name, values]) => [name, summary(values)]),
        ),
        timingsMs: { CPU: summary(timings.CPU), GPU: summary(timings.GPU) },
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
