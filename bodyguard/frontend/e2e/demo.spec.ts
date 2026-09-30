import { expect, test } from '@playwright/test'

const currentTracks = () => {
  const stream = document.querySelector('video')?.srcObject
  if (!(stream instanceof MediaStream) || stream.getTracks().length === 0)
    throw new Error('시험 카메라 트랙 없음')
  return stream.getTracks()
}

test('시작·중지·재시작·화면 이탈 시 가짜 카메라 트랙과 추론 루프를 정리한다', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))

  await page.goto('/dev/measure')
  await expect(page.getByRole('button', { name: '현재 프레임 기록' })).toBeDisabled()
  await page.getByRole('button', { name: '측정 시작' }).click()
  await expect(page.getByTestId('measuring-badge')).toBeVisible({ timeout: 60_000 })
  await expect
    .poll(async () => Number(await page.getByTestId('fps').textContent()), { timeout: 30_000 })
    .toBeGreaterThan(0)

  // 가짜 카메라 화면에는 사람이 없어서 자리를 맞추라는 안내가 떠야 한다 (FR-M-07)
  await expect(page.getByRole('status')).toHaveText('카메라 앞에 앉아 주세요', { timeout: 15_000 })

  const tracks = await page.evaluateHandle(currentTracks)
  await page.getByRole('button', { name: '측정 중지' }).click()
  await expect(page.getByRole('button', { name: '측정 시작' })).toBeVisible()
  await expect
    .poll(() => tracks.evaluate((values) => values.every((track) => track.readyState === 'ended')))
    .toBe(true)
  expect(
    await page.locator('video').evaluate((video: HTMLVideoElement) => video.srcObject),
  ).toBeNull()

  await page.getByRole('button', { name: '측정 시작' }).click()
  await expect(page.getByTestId('measuring-badge')).toBeVisible()
  await expect
    .poll(async () => Number(await page.getByTestId('fps').textContent()))
    .toBeGreaterThan(0)
  const restarted = await page.evaluateHandle(currentTracks)
  // 같은 문서의 라우트 이동: 브라우저 전체 종료가 아니라 훅의 이탈 정리를 검증한다.
  await page.getByRole('link', { name: '서비스로 돌아가기' }).click()
  await expect(page).toHaveURL('/')
  await expect
    .poll(() =>
      restarted.evaluate((values) => values.every((track) => track.readyState === 'ended')),
    )
    .toBe(true)
  await tracks.dispose()
  await restarted.dispose()
  expect(errors).toEqual([])
})
