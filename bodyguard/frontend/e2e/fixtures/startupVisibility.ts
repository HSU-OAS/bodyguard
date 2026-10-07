// FR-V-03/NFR-07/08: same visible heading and 5000ms deadline, boolean errors only.
import type { Page } from '@playwright/test'

export async function startupHeadingVisible(page: Page, heading: string): Promise<boolean> {
  try {
    await page.getByRole('heading', { name: heading, level: 1 }).waitFor({
      state: 'visible',
      timeout: 5000,
    })
    return true
  } catch {
    // Locator assertion errors retain ARIA contents; don't pass them to the reporter.
    return false
  }
}
