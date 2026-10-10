// FR-R-03/06, FR-U-04: TEST ONLY lease control, actual same-origin reader; no UI/credentials export.

import { ApiError } from '../../src/api/auth'
import { type DashboardQuery, readDashboard } from '../../src/api/dashboard'
import type { ReadyAccount } from '../../src/auth'

export function createDashboardProbe(authority: ReadyAccount) {
  let current = authority
  const operation = new AbortController()
  return {
    async read(query: DashboardQuery) {
      try {
        const result = await readDashboard(
          { authority, readAuthority: () => current, signal: operation.signal },
          query,
        )
        return {
          status: 200,
          minutes: result.totals.minutes,
          measured: result.totals.measured_sec,
          notificationsMissing: result.notifications === null,
          clientReported: result.provenance === 'client-reported',
          partitions: result.metrics.length,
        }
      } catch (error) {
        return { status: error instanceof ApiError ? error.status : -1 }
      }
    },
    replace() {
      current = { ...authority, user: { ...authority.user } }
    },
    rebind(owner: string) {
      authority.user.id = owner
    },
    close() {
      operation.abort()
    },
  }
}
