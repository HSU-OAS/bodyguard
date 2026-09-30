import { expect, test } from '@playwright/test'

test('측정을 시작하면 카메라와 추론 루프가 에러 없이 돈다', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))

  await page.goto('/')
  await expect(page.getByRole('button', { name: '현재 프레임 기록' })).toHaveCount(0)
  await page.getByRole('button', { name: '측정 시작' }).click()
  await expect(page.getByTestId('measuring-badge')).toBeVisible({ timeout: 60_000 })
  await expect
    .poll(async () => Number(await page.getByTestId('fps').textContent()), { timeout: 30_000 })
    .toBeGreaterThan(0)

  // 가짜 카메라 화면에는 사람이 없어서 자리를 맞추라는 안내가 떠야 한다 (FR-M-07)
  await expect(page.getByRole('status')).toHaveText('카메라 앞에 앉아 주세요', { timeout: 15_000 })

  await page.getByRole('button', { name: '측정 중지' }).click()
  await expect(page.getByRole('button', { name: '측정 시작' })).toBeVisible()
  expect(errors).toEqual([])
})
