import { FilesetResolver, GestureRecognizer } from '@mediapipe/tasks-vision'

export async function compareHandImage() {
  const image = new Image()
  image.src = '/__bodyguard-test/hand.jpg'
  await image.decode()
  const vision = await FilesetResolver.forVisionTasks('/mediapipe/wasm')
  const results: Record<string, { frames: number; detected: number; counts: number[]; durations: number[]; points: number[][] }> = {}
  for (const delegate of ['GPU', 'CPU'] as const) {
    const model = await GestureRecognizer.createFromOptions(vision, {
      canvas: new OffscreenCanvas(1, 1),
      baseOptions: { modelAssetPath: '/models/gesture_recognizer.task', delegate },
      runningMode: 'VIDEO',
      numHands: 2,
    })
    const counts: number[] = [], durations: number[] = [], points: number[][] = []
    try {
      for (let index = 0; index < 20; index++) {
        const started = performance.now()
        const result = model.recognizeForVideo(image, index * 33 + 1)
        durations.push(performance.now() - started)
        counts.push(result.landmarks.length)
        if (result.landmarks.length === 1)
          points.push(result.landmarks[0].flatMap(({x, y, z}) => [x, y, z]))
      }
    } finally { model.close() }
    results[delegate] = { frames: counts.length, detected: counts.filter((n) => n === 1).length, counts, durations, points }
  }
  const gpu = results.GPU, cpu = results.CPU
  const comparable = gpu.points.length === 20 && cpu.points.length === 20
  const diffs = comparable ? gpu.points.flatMap((values, i) => values.map((n, j) => Math.abs(n - cpu.points[i][j]))) : []
  const summary = (data: typeof gpu) => ({ frames: data.frames, detected: data.detected, counts: data.counts, firstMs: data.durations[0], meanAfterFirstMs: data.durations.slice(1).reduce((a,b) => a + b, 0) / 19, maxMs: Math.max(...data.durations) })
  return { GPU: summary(gpu), CPU: summary(cpu), comparable, maxAbsoluteNormalizedCoordinateDifference: comparable ? Math.max(...diffs) : null }
}
