import { expect, type Page } from '@playwright/test'

export async function skipOptionalProfile(page: Page, destination = '/start') {
  const query = new URLSearchParams({ next: destination })
  await expect(page).toHaveURL(`/account/profile?${query}`)
  await expect(page.getByRole('heading', { name: '기본 정보', exact: true })).toBeVisible()
  await page.getByRole('link', { name: '나중에 하기', exact: true }).click()
  await expect(page).toHaveURL(destination)
}
