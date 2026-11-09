// Research-only paired comparison of identical decoded public-video frames.
export async function comparePoseDelegates(videoBase64: string) {
  const output: Record<string, unknown> = { processed: 0, cleanup: 'not-started', failure: null, summary: null }
  const bytes = Uint8Array.from(atob(videoBase64), (character) => character.charCodeAt(0))
  const url = URL.createObjectURL(new Blob([bytes], { type: 'video/mp4' }))
  const video = document.createElement('video')
  let worker: Worker | undefined
  try {
    video.src = url
    video.muted = true
    await new Promise<void>((resolve, reject) => {
      video.addEventListener('loadeddata', () => resolve(), { once: true })
      video.addEventListener('error', () => reject(new Error('Video unavailable')), { once: true })
      video.load()
    })
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const context = canvas.getContext('2d')
    if (!context || canvas.width !== 720 || canvas.height !== 1280 || video.duration < 12.8)
      throw new Error('Invalid public sample')
    worker = new Worker('/__bodyguard/test-pose-delegates.js')
    const active = worker
    function receive(expected: string, timeout = 5000): Promise<Record<string, unknown>> {
      return new Promise((resolve, reject) => {
        const done = (event: MessageEvent) => {
          if (event.data?.type !== expected && event.data?.type !== 'error') return
          clearTimeout(timer)
          active.removeEventListener('message', done)
          if (event.data.type === 'error') reject(new Error(`Worker ${event.data.stage}`))
          else resolve(event.data)
        }
        const timer = setTimeout(() => {
          active.removeEventListener('message', done)
          reject(new Error(`Worker ${expected} timeout`))
        }, timeout)
        active.addEventListener('message', done)
      })
    }
    const ready = receive('ready')
    active.postMessage({ type: 'init' })
    await ready
    for (let index = 0; index < 65; index++) {
      if (index > 0) await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Video seek timeout')), 5000)
        video.addEventListener('seeked', () => { clearTimeout(timer); resolve() }, { once: true })
        video.currentTime = index / 5
      })
      context.drawImage(video, 0, 0, canvas.width, canvas.height)
      const bitmap = await createImageBitmap(canvas)
      const done = receive('frame-done')
      active.postMessage({ type: 'frame', index, at: index * 200 + 1,
        width: canvas.width, height: canvas.height, bitmap }, [bitmap])
      const response = await done
      if (response.index !== index) throw new Error('Out-of-order frame')
      output.processed = index + 1
    }
    const summary = receive('summary'), closed = receive('closed')
    active.postMessage({ type: 'close' })
    output.summary = await summary
    const response = await closed
    output.cleanup = response.clean === true ? 'clean' : 'unclean'
  } catch (error) {
    output.failure = error instanceof Error ? error.message : 'Unexpected test failure'
  } finally {
    worker?.terminate()
    video.removeAttribute('src')
    video.load()
    URL.revokeObjectURL(url)
  }
  return output
}
