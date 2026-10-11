// FR-M-03/FR-U-04: TEST ONLY adapter; no clinical calculation or product UI.

import { prepareBaselines } from '../../src/api/baselines'
import type { ReadyAccount } from '../../src/auth'

export async function baselineClientProbe(authority: ReadyAccount) {
  let current = authority
  const context = await prepareBaselines({
    authority,
    readAuthority: () => current,
    signal: new AbortController().signal,
  })
  return {
    ...context,
    replace() {
      current = { ...authority }
    },
  }
}
