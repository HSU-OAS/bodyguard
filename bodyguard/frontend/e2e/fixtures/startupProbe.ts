// FR-V-03/NFR-07: injected by tests only, timings without account/DOM contents.
declare global {
  interface Window {
    __bodyguardStartup: {
      initMs: number
      headingMs: number | null
      twoRafMs: number | null
      cameraCalls: number
    }
  }
}

// Self-contained: Playwright serializes this function before product scripts run.
export function installStartupProbe({ heading }: { heading: string }): () => void {
  const result = {
    initMs: performance.now(),
    headingMs: null,
    twoRafMs: null,
    cameraCalls: 0,
  } as Window['__bodyguardStartup']
  window.__bodyguardStartup = result
  let stopped = false
  let raf: number | null = null
  const observer = new MutationObserver(check)
  const media = navigator.mediaDevices
  const original = media?.getUserMedia
  if (media)
    media.getUserMedia = () => {
      result.cameraCalls++
      return Promise.reject(new Error('Camera forbidden in startup harness'))
    }
  function check() {
    if (stopped || result.headingMs !== null) return
    const matches = [...document.querySelectorAll('main h1')].some(
      (element) => element.textContent?.trim() === heading,
    )
    if (!matches) return
    result.headingMs = performance.now()
    observer.disconnect()
    raf = requestAnimationFrame(() => {
      if (stopped) return
      raf = requestAnimationFrame(() => {
        if (stopped) return
        raf = null
        result.twoRafMs = performance.now()
      })
    })
  }
  observer.observe(document, { subtree: true, childList: true, characterData: true })
  check()
  return () => {
    if (stopped) return
    stopped = true
    observer.disconnect()
    if (raf !== null) cancelAnimationFrame(raf)
    if (media) media.getUserMedia = original
  }
}
