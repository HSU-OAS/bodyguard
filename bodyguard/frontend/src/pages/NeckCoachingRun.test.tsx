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
  disposal: null as Promise<void> | null,
}))
vi.mock('../coaching/neckWorkspacePlayback', () => ({
  createNeckWorkspacePlayback(input: PlaybackInput) {
    fixture.input = input
    const resource = () => {
      fixture.acquired++
      return {
        dispose: () => {
          fixture.disposed++
          return fixture.disposal ?? undefined
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
  fetcher: ReturnType<typeof vi.fn<(path: string, init?: RequestInit) => Promise<Response>>>
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
    disposal: null,
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

const recording = (): NeckRunConfiguration => ({
  ...configuration(),
  recording: 'isolated-local-test',
})
async function complete() {
  for (const side of ['left', 'right']) {
    await supply('start', side)
    await supply('target', side)
    await supply('target', side, 1, 50)
    await supply('returned', side)
  }
  await screen.findByRole('heading', { name: '검수 흐름 완료' })
}
function recordServer(reply?: (body: string) => Promise<Response>) {
  const fallback = fetcher.getMockImplementation(),
    bodies: string[] = [],
    signals: AbortSignal[] = []
  if (!fallback) throw new Error('Missing ordinary fixture response')
  fetcher.mockImplementation((path: string, init?: RequestInit) => {
    if (path !== '/api/v1/records/stretch' || init?.method !== 'POST') return fallback(path)
    bodies.push(String(init.body))
    signals.push(init.signal as AbortSignal)
    return reply
      ? reply(String(init.body))
      : Promise.resolve(
          new Response(
            JSON.stringify({
              ...JSON.parse(String(init.body)),
              created_at: new Date().toISOString(),
              provenance: 'client-reported',
            }),
            { status: 201 },
          ),
        )
  })
  return { bodies, signals }
}
it('refuses isolated recording on a non-loopback host before acquiring resources', async () => {
  vi.spyOn(window.location, 'hostname', 'get').mockReturnValue('example.com')
  await open(recording())
  await act(async () => fireEvent.click(screen.getByRole('button', { name: '검수 시작' })))
  await screen.findByRole('alert')
  expect(fixture.acquired).toBe(0)
})
it('saves the exact ended result only after cleanup settles; duplicate clicks send once and saved link identifies it', async () => {
  const server = recordServer()
  await open(recording())
  await start()
  let release!: () => void
  fixture.disposal = new Promise<void>((resolve) => {
    release = resolve
  })
  await complete()
  expect(server.bodies).toHaveLength(0)
  const button = screen.getByRole('button', { name: '시험 기록 저장' })
  await act(async () => {
    fireEvent.click(button)
    fireEvent.click(button)
  })
  expect(server.bodies).toHaveLength(0)
  await act(async () => release())
  const message = await screen.findByText('시험 기록을 저장했습니다.')
  expect(server.bodies).toHaveLength(1)
  const row = JSON.parse(server.bodies[0])
  expect(Object.keys(row).sort()).toEqual(
    [
      'id',
      'motion_id',
      'protocol_version',
      'started_at',
      'ended_at',
      'outcome',
      'observed_ms',
      'repetitions',
    ].sort(),
  )
  expect(row).toMatchObject({
    motion_id: 'neck-side',
    outcome: 'completed',
    observed_ms: 100,
    repetitions: 0,
  })
  expect(screen.getByRole('link', { name: '저장한 시험 기록 보기' }).getAttribute('href')).toBe(
    `/records/${row.id}`,
  )
  expect(document.activeElement).toBe(message)
  expect(screen.queryByRole('button', { name: '시험 기록 저장' })).toBeNull()
})
it('an interrupted result stays interrupted and never saves automatically', async () => {
  const server = recordServer()
  await open(recording())
  await start()
  await supply('start')
  await supply('target')
  await supply('target', 'left', 1, 20)
  await act(async () => fireEvent.click(screen.getByRole('button', { name: '불편하면 중단' })))
  await screen.findByRole('heading', { name: '불편으로 중단했습니다' })
  expect(server.bodies).toHaveLength(0)
  await act(async () => fireEvent.click(screen.getByRole('button', { name: '시험 기록 저장' })))
  await screen.findByText('시험 기록을 저장했습니다.')
  expect(JSON.parse(server.bodies[0])).toMatchObject({ outcome: 'interrupted', observed_ms: 20 })
})
it('lost response retries only explicitly with the identical UUID and body', async () => {
  let count = 0
  const server = recordServer(async (body) => {
    if (++count === 1) throw new TypeError('Controlled response loss')
    return new Response(
      JSON.stringify({
        ...JSON.parse(body),
        created_at: new Date().toISOString(),
        provenance: 'client-reported',
      }),
      { status: 200 },
    )
  })
  await open(recording())
  await start()
  await complete()
  await act(async () => fireEvent.click(screen.getByRole('button', { name: '시험 기록 저장' })))
  await screen.findByRole('button', { name: '같은 시험 기록 다시 저장' })
  expect(server.bodies).toHaveLength(1)
  await act(async () =>
    fireEvent.click(screen.getByRole('button', { name: '같은 시험 기록 다시 저장' })),
  )
  await screen.findByText('시험 기록을 저장했습니다.')
  expect(server.bodies).toHaveLength(2)
  expect(server.bodies[1]).toBe(server.bodies[0])
})
it.each([401, 403, 409])(
  'HTTP %i is not saved and does not offer an unsafe automatic retry',
  async (status) => {
    const server = recordServer(async () => new Response('{}', { status }))
    await open(recording())
    await start()
    await complete()
    await act(async () => fireEvent.click(screen.getByRole('button', { name: '시험 기록 저장' })))
    await screen.findByRole('alert')
    expect(screen.queryByText('시험 기록을 저장했습니다.')).toBeNull()
    expect(screen.queryByRole('button', { name: '같은 시험 기록 다시 저장' })).toBeNull()
    expect(server.bodies).toHaveLength(1)
    if (status !== 409) {
      await act(async () => fireEvent.click(screen.getByRole('button', { name: '계정 다시 확인' })))
      expect(screen.queryByText('검수 흐름 완료')).toBeNull()
      expect(server.bodies).toHaveLength(1)
    }
  },
)
it('auth refresh aborts a pending write and a late accepted response cannot revive saved UI', async () => {
  let release!: (response: Response) => void
  const server = recordServer(
    () =>
      new Promise((resolve) => {
        release = resolve
      }),
  )
  await open(recording())
  await start()
  await complete()
  await act(async () => fireEvent.click(screen.getByRole('button', { name: '시험 기록 저장' })))
  await screen.findByText('시험 기록 저장 중')
  await act(async () => dispatchEvent(new Event('focus')))
  expect(server.signals[0].aborted).toBe(true)
  await act(async () =>
    release(
      new Response(
        JSON.stringify({
          ...JSON.parse(server.bodies[0]),
          created_at: new Date().toISOString(),
          provenance: 'client-reported',
        }),
        { status: 201 },
      ),
    ),
  )
  expect(screen.queryByText('시험 기록을 저장했습니다.')).toBeNull()
  expect(screen.queryByRole('link', { name: '저장한 시험 기록 보기' })).toBeNull()
  expect(server.bodies).toHaveLength(1)
})
it('hidden during pending cleanup prevents the later write', async () => {
  const server = recordServer()
  await open(recording())
  await start()
  let release!: () => void
  fixture.disposal = new Promise<void>((resolve) => {
    release = resolve
  })
  await complete()
  await act(async () => fireEvent.click(screen.getByRole('button', { name: '시험 기록 저장' })))
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
  await act(async () => document.dispatchEvent(new Event('visibilitychange')))
  await act(async () => release())
  expect(server.bodies).toHaveLength(0)
  expect(screen.queryByText('시험 기록을 저장했습니다.')).toBeNull()
})
it('cleanup failure never submits a record and quarantines this native workspace', async () => {
  const server = recordServer()
  await open(recording())
  await start()
  let reject!: (error: Error) => void
  fixture.disposal = new Promise<void>((_, fail) => {
    reject = fail
  })
  await complete()
  await act(async () => fireEvent.click(screen.getByRole('button', { name: '시험 기록 저장' })))
  await act(async () => reject(new Error('Controlled test cleanup failure')))
  await screen.findByRole('alert')
  expect(server.bodies).toHaveLength(0)
  expect(screen.queryByRole('button', { name: '시험 기록 저장' })).toBeNull()
  expect(screen.getByRole('button', { name: '새 검수 시작' }).hasAttribute('disabled')).toBe(true)
})
