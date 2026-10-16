// @vitest-environment happy-dom
// FR-S-06·NFR-08: synthetic media methods, not decoded motion/3D/clinical evidence.
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { MotionPreview } from './MotionPreview'

const media = { poster: '/test-poster.png', video: '/test-video.webm' }
let reduced = false
beforeEach(() => {
  vi.stubGlobal('matchMedia', () => ({
    matches: reduced,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(false)
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  reduced = false
})
it.each([
  '//external.invalid/v',
  '/\n/external.invalid/v',
  '/\\external.invalid/v',
  'https://external.invalid/v',
])('absent or unowned media remains unavailable: %s', (video) => {
  const page = render(<MotionPreview title="시험" />)
  expect(screen.getByText('미리보기 준비 중')).toBeTruthy()
  page.rerender(<MotionPreview title="시험" media={{ ...media, video }} />)
  expect(document.querySelector('video')).toBeNull()
})
it('hover plays, leave stops, and a late play cannot reactivate a retired preview', async () => {
  let resolve!: () => void
  vi.mocked(HTMLMediaElement.prototype.play).mockReturnValueOnce(
    new Promise<void>((yes) => {
      resolve = yes
    }),
  )
  render(<MotionPreview title="시험" media={media} />)
  const group = screen.getByRole('group', { name: '시험 미리보기' })
  fireEvent.pointerEnter(group)
  fireEvent.pointerLeave(group)
  await act(async () => {
    resolve()
    await Promise.resolve()
  })
  expect(screen.getByRole('button', { name: '시험 미리보기 재생' })).toBeTruthy()
  expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled()
})
it('reduced motion prevents hover/focus autoplay but keeps explicit play/stop', async () => {
  reduced = true
  render(<MotionPreview title="시험" media={media} />)
  const group = screen.getByRole('group', { name: '시험 미리보기' })
  fireEvent.pointerEnter(group)
  fireEvent.focus(screen.getByRole('button', { name: '시험 미리보기 재생' }))
  expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: '시험 미리보기 재생' }))
  await screen.findByRole('button', { name: '시험 미리보기 정지' })
  fireEvent.click(screen.getByRole('button', { name: '시험 미리보기 정지' }))
  expect(screen.getByRole('button', { name: '시험 미리보기 재생' })).toBeTruthy()
})
it('source replacement clears error and reclaims earlier playback', async () => {
  const page = render(<MotionPreview title="시험" media={media} />)
  fireEvent.error(document.querySelector('video') as HTMLVideoElement)
  expect(screen.getByRole('status').textContent).toContain('불러오지 못했습니다')
  page.rerender(<MotionPreview title="새 시험" media={{ ...media, video: '/next-video.webm' }} />)
  await waitFor(() => expect(screen.queryByRole('status')).toBeNull())
  expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled()
})
it('hiding and unmounting pause without background playback', async () => {
  const page = render(<MotionPreview title="시험" media={media} />)
  fireEvent.click(screen.getByRole('button', { name: '시험 미리보기 재생' }))
  await screen.findByRole('button', { name: '시험 미리보기 정지' })
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
  fireEvent(document, new Event('visibilitychange'))
  expect(screen.getByRole('button', { name: '시험 미리보기 재생' })).toBeTruthy()
  page.unmount()
  expect(HTMLMediaElement.prototype.pause).toHaveBeenCalledTimes(2)
})

it('shows a poster failure and remounts only its owned probe on explicit retry', () => {
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {})
  render(<MotionPreview title="시험" media={media} />)
  const old = document.querySelector('img')
  if (!old) throw new Error('Poster probe missing')
  fireEvent.error(old)
  expect(screen.getByText('미리보기를 불러오지 못했습니다')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '다시 불러오기' }))
  expect(document.querySelector('img')).not.toBe(old)
  expect(HTMLMediaElement.prototype.load).toHaveBeenCalledTimes(1)
})
