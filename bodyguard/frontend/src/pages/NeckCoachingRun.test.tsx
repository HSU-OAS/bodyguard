// @vitest-environment happy-dom
// FR-S-02/04·FR-U-04: real auth/session/buttons, mocked playback; not camera/pose proof.
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { criteria } from '../../e2e/fixtures/neckCandidate'
import { AuthProvider } from '../auth'
import type { PlaybackInput } from '../coaching/useRecordedPlayback'
import { NeckCoachingRun, type NeckRunConfiguration } from './NeckCoachingRun'

const fixture = vi.hoisted(() => ({
  input: null as PlaybackInput | null,
  acquired: 0,
  disposed: 0,
  starts: 0,
  closes: 0,
  allow: true,
}))
vi.mock('../coaching/neckWorkspacePlayback', () => ({
  createNeckWorkspacePlayback(input: PlaybackInput) {
    fixture.input = input
    const resource = () => {
      fixture.acquired++
      return {
        dispose: () => {
          fixture.disposed++
        },
      }
    }
    return {
      ports: { camera: resource, inference: resource, avatars: resource },
      start: () => {
        fixture.starts++
        return true
      },
      synchronize: () => true,
      align: () => true,
      close: () => {
        fixture.closes++
      },
    }
  },
}))
let now = 100,
  sequence = 0,
  fetcher: ReturnType<typeof vi.fn>
const configuration = (): NeckRunConfiguration => {
  const review = criteria()
  return {
    scope: 'candidate-review-only',
    criteria: review,
    plan: {
      motionId: 'neck-side',
      version: review.version,
      source: 'direct',
      maxFrameAgeMs: review.maxFrameAgeMs,
      maxFrameGapMs: review.maxFrameGapMs,
      steps: [
        { id: 'left', kind: 'hold', targetMs: 50 },
        { id: 'right', kind: 'hold', targetMs: 50 },
      ],
    },
    readGates: () => ({
      authenticated: true,
      motionValidated: fixture.allow,
      referenceAvatarReady: true,
      userAvatarReady: true,
    }),
  }
}
beforeEach(() => {
  now = 100
  sequence = 0
  Object.assign(fixture, {
    input: null,
    acquired: 0,
    disposed: 0,
    starts: 0,
    closes: 0,
    allow: true,
  })
  vi.spyOn(performance, 'now').mockImplementation(() => now)
  fetcher = vi.fn((path: string) =>
    Promise.resolve(
      new Response(
        JSON.stringify(
          path.endsWith('/csrf')
            ? { csrf_token: 'a'.repeat(64) }
            : { id: '11111111-1111-4111-8111-111111111111', email: 'fixture@example.com' },
        ),
        { status: 200 },
      ),
    ),
  )
  vi.stubGlobal('fetch', fetcher)
})
afterEach(async () => {
  cleanup()
  await act(async () => {})
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
async function open(config = configuration()) {
  render(
    <MemoryRouter>
      <AuthProvider>
        <NeckCoachingRun configuration={config} />
      </AuthProvider>
    </MemoryRouter>,
  )
  await waitFor(() => expect(fetcher).toHaveBeenCalled())
  await act(async () => {})
}
async function start() {
  await act(async () =>
    fireEvent.click(screen.getByRole('button', { name: /^(검수 시작|새 검수 시작)$/ })),
  )
  await screen.findByText('왼쪽 · 준비', { exact: true })
}
async function supply(
  classification: 'start' | 'target' | 'returned' | 'unobservable',
  side = 'left',
  generation = 1,
  delta = 10,
) {
  now += delta
  await act(async () => {
    fixture.input?.observe({
      generation,
      sequence: ++sequence,
      sampledAt: now,
      personCount: classification === 'unobservable' ? 0 : 1,
      stepId: side,
      classification,
    })
  })
}
it('does not acquire resources on mount or with a false motion gate', async () => {
  fixture.allow = false
  await open()
  expect(fixture.acquired).toBe(0)
  await act(async () => fireEvent.click(screen.getByRole('button', { name: '검수 시작' })))
  await screen.findByRole('alert')
  expect(fixture.acquired).toBe(0)
  expect(fixture.starts).toBe(0)
  expect(fetcher.mock.calls.every(([path]) => !String(path).includes('/records'))).toBe(true)
})
it('refuses mismatched explicit criteria before creating a playback owner', async () => {
  const config = configuration()
  await open({ ...config, plan: { ...config.plan, version: 'other-version' } })
  await act(async () => fireEvent.click(screen.getByRole('button', { name: '검수 시작' })))
  await screen.findByRole('alert')
  expect(fixture.input).toBeNull()
  expect(fixture.acquired).toBe(0)
})
it('pauses/reclaims and explicitly resumes a fresh generation; pain stop shows an unsaved partial result', async () => {
  await open()
  await start()
  await supply('start')
  await screen.findByText('왼쪽 · 수행', { exact: true })
  await act(async () => fireEvent.click(screen.getByRole('button', { name: /^일시정지$/ })))
  expect(fixture.disposed).toBe(3)
  await act(async () => fireEvent.click(screen.getByRole('button', { name: '다시 준비하고 재개' })))
  expect(fixture.acquired).toBe(6)
  expect(fixture.starts).toBe(2)
  await supply('start', 'left', 1)
  expect(screen.getByText('왼쪽 · 준비', { exact: true })).toBeTruthy()
  await supply('start', 'left', 2)
  await act(async () => fireEvent.click(screen.getByRole('button', { name: '불편하면 중단' })))
  await screen.findByRole('heading', { name: '불편으로 중단했습니다' })
  expect(fixture.disposed).toBe(6)
  expect(screen.getByText('왼쪽 · 진행 후 중단')).toBeTruthy()
  expect(screen.getByText('검수 결과는 운동 기록에 저장하지 않습니다.')).toBeTruthy()
})
it('renders both completed sides only after target and return; empty input does not accrue and candidate result never writes', async () => {
  await open()
  await start()
  await supply('start')
  await supply('target')
  await supply('unobservable')
  expect(screen.getByRole('progressbar').getAttribute('value')).toBe('0')
  await supply('target', 'left', 1, 50)
  expect(screen.queryByRole('heading', { name: '검수 흐름 완료' })).toBeNull()
  await supply('start')
  await supply('target')
  await supply('target', 'left', 1, 50)
  await supply('returned')
  await supply('start', 'right')
  await supply('target', 'right')
  await supply('target', 'right', 1, 50)
  await supply('returned', 'right')
  await screen.findByRole('heading', { name: '검수 흐름 완료' })
  expect(document.activeElement).toBe(screen.getByRole('heading', { name: '검수 흐름 완료' }))
  expect(screen.getByText('왼쪽 · 완료')).toBeTruthy()
  expect(screen.getByText('오른쪽 · 완료')).toBeTruthy()
  expect(fixture.disposed).toBe(3)
  expect(screen.queryByRole('button', { name: /저장/ })).toBeNull()
  expect(fetcher.mock.calls.every(([path]) => !String(path).includes('/records'))).toBe(true)
})
it('account refresh closes the current run and clears its state without automatic resource reacquisition', async () => {
  await open()
  await start()
  await supply('start')
  await act(async () => dispatchEvent(new Event('focus')))
  await waitFor(() => expect(fixture.disposed).toBe(3))
  expect(screen.queryByRole('button', { name: /^일시정지$/ })).toBeNull()
  expect(fixture.acquired).toBe(3)
  expect(screen.getByRole('button', { name: '검수 시작' })).toBeTruthy()
})
it('hidden clears the visible run and releases resources; returning does not restart it', async () => {
  await open()
  await start()
  await supply('start')
  const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
  await act(async () => document.dispatchEvent(new Event('visibilitychange')))
  await waitFor(() => expect(fixture.disposed).toBe(3))
  expect(screen.queryByRole('button', { name: /^일시정지$/ })).toBeNull()
  visibility.mockReturnValue('visible')
  await act(async () => document.dispatchEvent(new Event('visibilitychange')))
  expect(fixture.acquired).toBe(3)
  expect(screen.getByRole('button', { name: '검수 시작' })).toBeTruthy()
})
