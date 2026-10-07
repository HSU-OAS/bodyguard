// FR-S-04/FR-U-04/NFR-07/08: explicitly owned listeners, no background exercise/restart.
import type { createCoachingSession } from './session'

export function bindCoachingLifecycle(
  session: Pick<ReturnType<typeof createCoachingSession>, 'close'>,
  page: Pick<Document, 'addEventListener' | 'removeEventListener' | 'visibilityState'>,
  windowTarget: Pick<Window, 'addEventListener' | 'removeEventListener'>,
) {
  let detached = false
  const stop = () => {
    if (detached) return
    detached = true
    page.removeEventListener('visibilitychange', visibility)
    windowTarget.removeEventListener('pagehide', stop)
    void session.close('page-hidden')
  }
  const visibility = () => {
    if (page.visibilityState === 'hidden') stop()
  }
  page.addEventListener('visibilitychange', visibility)
  windowTarget.addEventListener('pagehide', stop)
  visibility()
  return stop
}
