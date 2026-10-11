// FR-M-02/07·NFR-08: a Blob worker inherits enforced CSP; a URL worker does not.
export function createPolicyWorker(scriptURL: string) {
  const unavailable = () => new Error('Worker inference unavailable')
  const script = new URL(scriptURL, location.href)
  if (
    !['https:', 'http:'].includes(script.protocol) ||
    script.origin !== location.origin ||
    script.username ||
    script.password
  )
    throw unavailable()
  let url: string | undefined
  try {
    url = URL.createObjectURL(
      new Blob([`importScripts(${JSON.stringify(script.href)});`], { type: 'text/javascript' }),
    )
    const worker = new Worker(url)
    let terminated = false
    return {
      worker,
      terminate() {
        if (terminated) return
        terminated = true
        try {
          worker.terminate()
        } finally {
          URL.revokeObjectURL(url as string)
        }
      },
    }
  } catch {
    if (url !== undefined) URL.revokeObjectURL(url)
    throw unavailable()
  }
}
