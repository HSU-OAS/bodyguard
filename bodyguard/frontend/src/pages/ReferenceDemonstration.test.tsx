// @vitest-environment happy-dom
// FR-A-02·NFR-08: controlled resource ownership; not real WebGL or clinical proof.
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { prepareReferenceStage, type ReferenceCommand } from '../avatar/referenceStage'
import { ResourceCleanupError } from '../coaching/resources'
import { ReferenceDemonstration } from './ReferenceDemonstration'

vi.mock('../avatar/referenceStage', () => ({ prepareReferenceStage: vi.fn() }))
const command: ReferenceCommand = {
  phase: 'waiting-start',
  stepId: 'left',
  playing: false,
  revision: 0,
  view: 'full',
}
let frames: Map<number, FrameRequestCallback>, next: number
function port() {
  return {
    render: vi.fn(),
    dispose: vi.fn(),
    beginObservation: vi.fn(() => true),
    observe: vi.fn(() => true),
    updateFeedback: vi.fn(() => false),
    getObservationCoverage: vi.fn(() => null),
    suspendObservation: vi.fn(),
    alignObservation: vi.fn(() => true),
  }
}
function open(onStatus = vi.fn()) {
  return render(
    <ReferenceDemonstration
      motion="neck-side"
      gender="male"
      command={command}
      onStatus={onStatus}
    />,
  )
}
beforeEach(() => {
  vi.spyOn(performance, 'now').mockReturnValue(100)
  frames = new Map()
  next = 0
  vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => {
    frames.set(++next, fn)
    return next
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id))
  vi.mocked(prepareReferenceStage).mockReset()
})
afterEach(async () => {
  cleanup()
  await act(async () => {})
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})
it('renders the latest command and releases its owner and RAF on unmount', async () => {
  const stage = port(),
    status = vi.fn()
  vi.mocked(prepareReferenceStage).mockResolvedValueOnce(stage)
  const view = open(status)
  await screen.findByText('시범 후보 · 자동 판정 없음')
  const updated = { ...command, phase: 'seeking-target' as const, playing: true }
  view.rerender(
    <ReferenceDemonstration motion="neck-side" gender="male" command={updated} onStatus={status} />,
  )
  act(() => {
    const batch = [...frames.values()]
    frames.clear()
    for (const fn of batch) fn(1) // Frame-start timestamp intentionally older than current input.
  })
  expect(stage.render).toHaveBeenCalledWith(100, 0, updated)
  const signal = vi.mocked(prepareReferenceStage).mock.calls[0][0].signal
  view.unmount()
  expect(signal.aborted).toBe(true)
  expect(stage.dispose).toHaveBeenCalledTimes(1)
  expect(frames.size).toBe(0)
})
it('waits for pending old preparation to retire before acquiring a new canvas', async () => {
  const old = port(),
    fresh = port()
  let resolve!: (stage: typeof old) => void
  vi.mocked(prepareReferenceStage)
    .mockReturnValueOnce(
      new Promise((yes) => {
        resolve = yes
      }),
    )
    .mockResolvedValueOnce(fresh)
  const first = open()
  await waitFor(() => expect(prepareReferenceStage).toHaveBeenCalledTimes(1))
  first.unmount()
  const second = open()
  await act(async () => {})
  expect(prepareReferenceStage).toHaveBeenCalledTimes(1)
  await act(async () => {
    resolve(old)
  })
  await screen.findByText('시범 후보 · 자동 판정 없음')
  expect(old.dispose).toHaveBeenCalledTimes(1)
  expect(old.render).not.toHaveBeenCalled()
  expect(prepareReferenceStage).toHaveBeenCalledTimes(2)
  second.unmount()
  expect(fresh.dispose).toHaveBeenCalledTimes(1)
})
it('requires explicit retry with a fresh canvas after preparation failure', async () => {
  vi.mocked(prepareReferenceStage)
    .mockRejectedValueOnce(new Error('PRIVATE_PATH'))
    .mockResolvedValueOnce(port())
  open()
  const original = screen.getByRole('img', { name: '3D 시범 후보' })
  await screen.findByRole('alert')
  expect(document.body.textContent).not.toContain('PRIVATE_PATH')
  expect(prepareReferenceStage).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByRole('button', { name: '시범 다시 불러오기' }))
  await screen.findByText('시범 후보 · 자동 판정 없음')
  expect(screen.getByRole('img', { name: '3D 시범 후보' })).not.toBe(original)
})
// Last case deliberately poisons this module's native ownership barrier until page reload.
it('requires a page reload after cleanup failure rather than reusing an uncertain GPU owner', async () => {
  const stage = port()
  stage.dispose.mockImplementation(() => {
    throw new ResourceCleanupError()
  })
  vi.mocked(prepareReferenceStage).mockResolvedValueOnce(stage)
  open()
  await screen.findByText('시범 후보 · 자동 판정 없음')
  act(() => {
    vi.mocked(prepareReferenceStage).mock.calls.at(-1)?.[1].onFailure()
  })
  await screen.findByRole('button', { name: '화면 새로고침' })
  expect(screen.queryByRole('button', { name: '시범 다시 불러오기' })).toBeNull()
  expect(prepareReferenceStage).toHaveBeenCalledTimes(1)
})
