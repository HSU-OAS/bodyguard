// @vitest-environment happy-dom
// FR-S-06/NFR-08: synthetic media promises; no avatar/video/clinical validation.
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { MotionPreview } from './MotionPreview'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
function ports() {
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
  const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
  const play = vi.spyOn(HTMLMediaElement.prototype, 'play')
  return { pause, play }
}
it('does not leave an earlier autoplay running after the current explicit play fails', async () => {
  const { pause, play } = ports()
  let finishOld!: () => void
  play.mockImplementationOnce(
    () =>
      new Promise<void>((yes) => {
        finishOld = yes
      }),
  )
  play.mockRejectedValueOnce(new Error('synthetic media rejection'))
  render(
    <MotionPreview
      title="시험 동작"
      media={{ poster: '/test/poster.png', video: '/test/clip.webm' }}
    />,
  )
  fireEvent.pointerEnter(screen.getByRole('group', { name: '시험 동작 미리보기' }))
  fireEvent.click(screen.getByRole('button', { name: '시험 동작 미리보기 재생' }))
  await screen.findByText('미리보기를 불러오지 못했습니다')
  const before = pause.mock.calls.length
  finishOld()
  await new Promise((yes) => setTimeout(yes, 0))
  expect(pause.mock.calls.length).toBeGreaterThan(before)
})
it('does not load an external media URL in the preview', () => {
  ports()
  render(
    <MotionPreview
      title="시험 동작"
      media={{ poster: '//outside.invalid/p.png', video: '/test/clip.webm' }}
    />,
  )
  expect(document.querySelector('video')).toBeNull()
  expect(screen.getByText('미리보기 준비 중')).toBeTruthy()
})
it('retires the removed video without pausing a later valid preview', async () => {
  const { play, pause } = ports()
  let finishOld!: () => void
  play.mockImplementationOnce(
    () =>
      new Promise<void>((yes) => {
        finishOld = yes
      }),
  )
  play.mockResolvedValueOnce()
  const media = { poster: '/test/poster.png', video: '/test/clip.webm' }
  const page = render(<MotionPreview title="시험 동작" media={media} />)
  const old = document.querySelector('video') as HTMLVideoElement
  fireEvent.pointerEnter(screen.getByRole('group', { name: '시험 동작 미리보기' }))
  page.rerender(
    <MotionPreview title="시험 동작" media={{ ...media, poster: '//outside.invalid/p' }} />,
  )
  expect(document.querySelector('video')).toBeNull()
  page.rerender(<MotionPreview title="시험 동작" media={media} />)
  const current = document.querySelector('video') as HTMLVideoElement
  expect(current).not.toBe(old)
  fireEvent.click(screen.getByRole('button', { name: '시험 동작 미리보기 재생' }))
  await screen.findByRole('button', { name: '시험 동작 미리보기 정지' })
  const before = pause.mock.contexts.filter((node) => node === old).length
  const currentBefore = pause.mock.contexts.filter((node) => node === current).length
  finishOld()
  await new Promise((yes) => setTimeout(yes, 0))
  expect(pause.mock.contexts.filter((node) => node === old).length).toBeGreaterThan(before)
  expect(pause.mock.contexts.filter((node) => node === current).length).toBe(currentBefore)
})
it('retires playback when the poster becomes unavailable without changing the video URL', async () => {
  const { pause, play } = ports()
  play.mockResolvedValue()
  const page = render(
    <MotionPreview
      title="시험 동작"
      media={{ poster: '/test/poster.png', video: '/test/clip.webm' }}
    />,
  )
  fireEvent.click(screen.getByRole('button', { name: '시험 동작 미리보기 재생' }))
  await screen.findByRole('button', { name: '시험 동작 미리보기 정지' })
  const before = pause.mock.calls.length
  page.rerender(
    <MotionPreview
      title="시험 동작"
      media={{ poster: '//outside.invalid/p.png', video: '/test/clip.webm' }}
    />,
  )
  expect(document.querySelector('video')).toBeNull()
  expect(pause.mock.calls.length).toBeGreaterThan(before)
})

it('a different preview retires earlier intent and late play cannot replace the new owner', async () => {
  const { pause, play } = ports()
  let finishOld!: () => void
  play
    .mockReturnValueOnce(
      new Promise<void>((yes) => {
        finishOld = yes
      }),
    )
    .mockResolvedValueOnce()
  render(
    <>
      <MotionPreview title="첫 동작" media={{ poster: '/first.png', video: '/first.mp4' }} />
      <MotionPreview title="다음 동작" media={{ poster: '/next.png', video: '/next.mp4' }} />
    </>,
  )
  const [old, next] = document.querySelectorAll('video')
  fireEvent.pointerEnter(screen.getByRole('group', { name: '첫 동작 미리보기' }))
  fireEvent.click(screen.getByRole('button', { name: '다음 동작 미리보기 재생' }))
  await screen.findByRole('button', { name: '다음 동작 미리보기 정지' })
  const oldCount = pause.mock.contexts.filter((element) => element === old).length
  const nextCount = pause.mock.contexts.filter((element) => element === next).length
  finishOld()
  await new Promise((yes) => setTimeout(yes, 0))
  expect(pause.mock.contexts.filter((element) => element === old).length).toBeGreaterThan(oldCount)
  expect(pause.mock.contexts.filter((element) => element === next).length).toBe(nextCount)
  expect(screen.getByRole('button', { name: '첫 동작 미리보기 재생' })).toBeTruthy()
  expect(screen.getByRole('button', { name: '다음 동작 미리보기 정지' })).toBeTruthy()
})
