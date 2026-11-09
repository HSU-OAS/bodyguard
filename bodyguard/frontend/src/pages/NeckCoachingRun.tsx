// FR-S-02/03/04·FR-U-04·FR-R-03: private candidate run UI; no default clinical protocol.
import { useLayoutEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../auth'
import type { ReferenceView } from '../avatar/referenceStage'
import type { AvatarGender } from '../avatar/reviewAvatarAssets'
import { createNeckWorkspacePlayback } from '../coaching/neckWorkspacePlayback'
import type { ResourceContext } from '../coaching/resources'
import type { SessionSnapshot } from '../coaching/session'
import { useRecordedPlayback } from '../coaching/useRecordedPlayback'
import {
  copyNeckReviewCriteria,
  copyShrugReviewCriteria,
  type NeckReviewCriteria,
  type ShrugReviewCriteria,
} from '../posture/thresholds'
import type { NeckCandidateError } from '../stretch/neckCandidateClassifier'
import { type CoachingPlan, createCoaching } from '../stretch/progression'
import type { ShrugCandidateError } from '../stretch/shrugCandidateClassifier'

export type NeckRunConfiguration = Readonly<{
  scope: 'candidate-review-only'
  // Test runner must additionally own the isolated DB; this is not clinical authority.
  recording?: 'isolated-local-test'
  criteria: NeckReviewCriteria
  plan: CoachingPlan
  readGates(): Readonly<{
    authenticated: boolean
    motionValidated: boolean
    referenceAvatarReady: boolean
    userAvatarReady: boolean
  }>
}>
export type ShrugRunConfiguration = Omit<NeckRunConfiguration, 'criteria'> &
  Readonly<{ criteria: ShrugReviewCriteria }>
export type CandidateRunConfiguration = NeckRunConfiguration | ShrugRunConfiguration
const feedback = {
  'neck-shoulder-line': '어깨선 확인 · 준비 시범을 다시 보세요',
  'neck-head-position': '머리 위치 확인 · 준비 시범을 다시 보세요',
  'neck-wrong-direction': '선택한 방향의 시범을 확인해 주세요',
  'neck-range': '현재 목표 시범을 확인해 주세요',
  'shrug-head': '머리 위치 확인 · 준비 시범을 다시 보세요',
  'shrug-trunk': '몸통 기울기 확인 · 준비 시범을 다시 보세요',
  'shrug-arms': '팔을 편하게 내리고 시범을 확인해 주세요',
  'shrug-asymmetry': '양쪽 어깨의 움직임을 함께 확인해 주세요',
  'shrug-range': '편안한 범위에서 시범을 확인해 주세요',
} as const
const phases = {
  'waiting-start': '준비',
  'seeking-target': '수행',
  holding: '유지',
  'waiting-return': '복귀',
} as const
// A remount must also wait for an old native permission/Worker/GPU owner to retire.
let retirement: Promise<void> | undefined
let retirementFailed = false
type RunSession = NonNullable<ReturnType<ReturnType<typeof useRecordedPlayback>['getSession']>>
type RecordState = ReturnType<RunSession['getRecordSnapshot']>

function checked(input: CandidateRunConfiguration) {
  const plan = createCoaching(input.plan).plan
  if (plan.motionId !== 'neck-side' && plan.motionId !== 'shoulder-shrug')
    throw new Error('Invalid candidate run')
  const motion = plan.motionId
  const criteria =
    motion === 'shoulder-shrug'
      ? copyShrugReviewCriteria(input.criteria as ShrugReviewCriteria)
      : copyNeckReviewCriteria(input.criteria as NeckReviewCriteria)
  if (
    input.scope !== 'candidate-review-only' ||
    plan.version !== criteria.version ||
    plan.maxFrameAgeMs !== criteria.maxFrameAgeMs ||
    plan.maxFrameGapMs !== criteria.maxFrameGapMs ||
    (motion === 'shoulder-shrug'
      ? plan.steps.length !== 1 || plan.steps[0].id !== 'both'
      : plan.steps.length !== 2 || plan.steps[0].id !== 'left' || plan.steps[1].id !== 'right') ||
    typeof input.readGates !== 'function'
  )
    throw new Error('Invalid candidate run')
  const recording = input.recording
  if (
    recording !== undefined &&
    (recording !== 'isolated-local-test' ||
      !import.meta.env.DEV ||
      !['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname))
  )
    throw new Error('Invalid candidate recording')
  return Object.freeze({ criteria, plan, motion, readGates: input.readGates, recording })
}

export function NeckCoachingRun({ configuration }: { configuration: CandidateRunConfiguration }) {
  const authentication = useAuth(),
    auth = authentication.state,
    playback = useRecordedPlayback(),
    live = useRef(playback),
    canvas = useRef<HTMLCanvasElement>(null),
    native = useRef<ReturnType<typeof createNeckWorkspacePlayback> | null>(null),
    resultHeading = useRef<HTMLHeadingElement>(null),
    recordNotice = useRef<HTMLParagraphElement>(null),
    recordRun = useRef<{
      id: string
      session: RunSession
      playback: ReturnType<typeof createNeckWorkspacePlayback>
      configuration: CandidateRunConfiguration
      auth: typeof auth
    } | null>(null),
    mounted = useRef(false),
    pending = useRef(false),
    runId = useRef(0),
    waitingCanvas = useRef<Readonly<{ key: string; ready(node: HTMLCanvasElement): void }> | null>(
      null,
    ),
    canceled = useRef(false),
    authority = useRef(configuration),
    account = useRef(auth),
    currentView = useRef<ReferenceView>('full')
  live.current = playback
  authority.current = configuration
  account.current = auth
  const [snapshot, setSnapshot] = useState<SessionSnapshot | null>(null),
    [recordState, setRecordState] = useState<RecordState | null>(null),
    [issue, setIssue] = useState<NeckCandidateError | ShrugCandidateError | null>(null),
    [busy, setBusy] = useState(false),
    [attempt, setAttempt] = useState(0),
    [failed, setFailed] = useState(false),
    [view, setView] = useState<ReferenceView>('full'),
    [gender, setGender] = useState<AvatarGender>('male')
  currentView.current = view
  function canvasFor(context: ResourceContext, id: number): Promise<HTMLCanvasElement> {
    const key = `${id}:${context.generation}`,
      node = canvas.current
    if (context.signal.aborted) return Promise.reject(new Error('Candidate canvas unavailable'))
    if (node?.isConnected && node.dataset.owner === key) return Promise.resolve(node)
    return new Promise((resolve, reject) => {
      const clear = () => {
        if (waitingCanvas.current === waiter) waitingCanvas.current = null
        context.signal.removeEventListener('abort', aborted)
      }
      const aborted = () => {
        clear()
        reject(new Error('Candidate canvas unavailable'))
      }
      const waiter = {
        key,
        ready(node: HTMLCanvasElement) {
          clear()
          resolve(node)
        },
      }
      waitingCanvas.current = waiter
      context.signal.addEventListener('abort', aborted, { once: true })
      if (context.signal.aborted) aborted()
    })
  }
  useLayoutEffect(() => {
    mounted.current = true
    const clearRun = () => {
      canceled.current = true
      recordRun.current = null
      setRecordState(null)
      setSnapshot(null)
      setIssue(null)
    }
    const hidden = () => {
      if (document.visibilityState === 'hidden') clearRun()
    }
    document.addEventListener('visibilitychange', hidden)
    window.addEventListener('pagehide', clearRun)
    return () => {
      mounted.current = false
      document.removeEventListener('visibilitychange', hidden)
      window.removeEventListener('pagehide', clearRun)
      const done = Promise.allSettled([retirement, live.current.cancel()]).then((results) => {
        if (results.some((result) => result.status === 'rejected')) retirementFailed = true
      })
      retirement = done
      void done.then(() => {
        if (retirement === done) retirement = undefined
      })
    }
  }, [])
  useLayoutEffect(() => {
    recordRun.current = null
    setRecordState(null)
    setSnapshot(null)
    setIssue(null)
    setFailed(false)
    void playback.cancel().catch(() => {
      if (mounted.current && authority.current === configuration && account.current === auth)
        setFailed(true)
    })
  }, [configuration, auth, playback.cancel])

  async function start() {
    if (pending.current || !import.meta.env.DEV || auth.status !== 'ready') return
    pending.current = true
    canceled.current = false
    setBusy(true)
    setFailed(false)
    setSnapshot(null)
    const id = ++runId.current
    recordRun.current = null
    setRecordState(null)
    setAttempt(id)
    const original = configuration
    try {
      const config = checked(original)
      await retirement
      if (
        !mounted.current ||
        authority.current !== original ||
        account.current !== auth ||
        canceled.current ||
        retirementFailed
      )
        throw new Error()
      const recordId = crypto.randomUUID()
      const session = await live.current.prepare({
        recordId,
        plan: config.plan,
        readClockPair: () => ({ monotonicMs: performance.now(), utc: new Date().toISOString() }),
        readGates: config.readGates,
        createPlayback: (input) => {
          const owned = createNeckWorkspacePlayback(input, {
            canvas: (context) => canvasFor(context, id),
            criteria: config.criteria,
            motion: config.motion,
            gender,
            session: () => live.current.getSession(),
            view: () => currentView.current,
            feedback: (next) => {
              if (mounted.current && authority.current === original && account.current === auth)
                setIssue(next)
            },
          })
          native.current = owned
          return owned
        },
        onChange: (next) => {
          if (mounted.current && authority.current === original && account.current === auth)
            setSnapshot(next)
        },
      })
      if (
        !session ||
        !mounted.current ||
        authority.current !== original ||
        account.current !== auth ||
        canceled.current
      )
        throw new Error()
      if (config.recording === 'isolated-local-test' && native.current)
        recordRun.current = {
          id: recordId,
          session,
          playback: native.current,
          configuration: original,
          auth,
        }
      await session.start()
      if (session.getSnapshot().state.status === 'idle') throw new Error()
    } catch {
      if (
        !canceled.current &&
        mounted.current &&
        authority.current === original &&
        account.current === auth
      )
        setFailed(true)
      await live.current.cancel().catch(() => {
        retirementFailed = true
      })
    } finally {
      pending.current = false
      if (mounted.current) setBusy(false)
    }
  }
  async function action(kind: 'pause' | 'resume' | 'user-stop' | 'pain' | 'skip') {
    if (pending.current) return
    const session = playback.getSession()
    if (!session) return
    pending.current = true
    setBusy(true)
    setIssue(null)
    try {
      if (kind === 'pause') await session.pause()
      else if (kind === 'resume') await session.resume()
      else await session.end(kind)
    } catch {
      if (mounted.current) setFailed(true)
      await live.current.cancel().catch(() => {
        retirementFailed = true
      })
    } finally {
      pending.current = false
      if (mounted.current) setBusy(false)
    }
  }
  async function saveRecord(retry: boolean) {
    const run = recordRun.current
    const current = () =>
      run !== null &&
      mounted.current &&
      !canceled.current &&
      recordRun.current === run &&
      authority.current === run.configuration &&
      account.current === run.auth &&
      live.current.getSession() === run.session
    if (pending.current || !run || !current()) return
    const snapshot = run.session.getSnapshot(),
      previous = run.session.getRecordSnapshot()
    if (
      snapshot.state.status !== 'ended' ||
      !snapshot.closed ||
      !snapshot.state.result ||
      previous.status === 'saved' ||
      previous.status === 'closed' ||
      (retry
        ? previous.status !== 'failed' ||
          !['network', 'invalid-response'].includes(previous.failure ?? '')
        : previous.status !== 'idle')
    )
      return
    pending.current = true
    setBusy(true)
    try {
      // closed means input stopped, not cleanup settled. Join its existing barrier first.
      await run.playback.close()
      await run.session.close('user-stop')
      if (!current()) return
      // The generic controller reports cleanup failure by snapshot, not by rejection.
      if (run.session.getSnapshot().failure === 'cleanup-error') throw new Error()
      const done = retry ? run.session.retry() : run.session.save()
      if (current()) setRecordState(run.session.getRecordSnapshot())
      await done
      if (current()) setRecordState(run.session.getRecordSnapshot())
    } catch {
      retirementFailed = true
      if (current()) {
        recordRun.current = null
        setRecordState(null)
        setFailed(true)
      }
      await live.current.cancel().catch(() => {})
    } finally {
      pending.current = false
      if (mounted.current) setBusy(false)
    }
  }
  const state = snapshot?.state,
    result = state?.result,
    running = state?.status === 'running',
    preparing = state?.status === 'preparing' || busy,
    paused = state?.status === 'paused',
    problem =
      failed ||
      playback.state.status === 'failed' ||
      snapshot?.failure != null ||
      (result?.reason !== undefined && !['user-stop', 'pain', 'skip'].includes(result.reason)),
    owned = playback.getSession() !== null,
    step = state?.plan.steps[state.stepIndex],
    progress = state?.progress[state.stepIndex]
  useLayoutEffect(() => {
    if (result) resultHeading.current?.focus({ preventScroll: true })
  }, [result])
  useLayoutEffect(() => {
    if (recordState?.status === 'saved' || recordState?.status === 'failed')
      recordNotice.current?.focus({ preventScroll: true })
  }, [recordState])
  return (
    <section
      className="coaching-workspace"
      aria-labelledby="run-title"
      data-session-failure={snapshot?.failure ?? result?.reason ?? ''}
    >
      <nav className="coaching-rail" aria-label="코칭 메뉴">
        <Link to="/start">내 시작</Link>
        <Link to="/dev/select">동작</Link>
        <Link to="/records">기록</Link>
      </nav>
      <div className="coaching-work-area">
        <header className="coaching-heading">
          <div>
            <p className="small muted">판정 후보 검수 · 출시 코칭 아님</p>
            <h1 id="run-title">
              {configuration.plan.motionId === 'shoulder-shrug'
                ? '어깨 으쓱·이완'
                : '목 옆으로 기울이기'}
            </h1>
          </div>
          <fieldset className="coaching-segmented">
            <legend className="sr-only">두 아바타 표시 구도</legend>
            {(
              [
                ['full', '전신'],
                ['upper', '상반신'],
                ['detail', '자세히'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={view === value}
                onClick={() => setView(value)}
              >
                {label}
              </button>
            ))}
          </fieldset>
        </header>
        <ol className="coaching-stages" aria-label="코칭 순서">
          {Object.entries(phases).map(([key, label]) => (
            <li key={key} aria-current={running && state.phase === key ? 'step' : undefined}>
              {label}
            </li>
          ))}
        </ol>
        <section
          className="coaching-space"
          aria-label="두 아바타 공간"
          data-view={view}
          data-avatar={gender}
        >
          <div className="coaching-role-labels">
            <span>내 움직임</span>
            <span>현재 단계 시범</span>
          </div>
          <div className="reference-demonstration">
            <canvas
              key={`${attempt}:${state?.generation ?? 0}`}
              data-owner={`${attempt}:${state?.generation ?? 0}`}
              ref={(node) => {
                canvas.current = node
                const waiting = waitingCanvas.current
                if (node && waiting && waiting.key === node.dataset.owner) waiting.ready(node)
              }}
              role="img"
              aria-label="실행 중인 두 아바타 후보"
            />
          </div>
          <p className="reference-status" role="status">
            {result
              ? '검수 종료'
              : problem
                ? '연결을 확인해 주세요'
                : preparing
                  ? canceled.current
                    ? '정리 중 · 권한 창이 열려 있다면 닫아 주세요'
                    : '연결 준비 중'
                  : paused
                    ? '일시정지'
                    : running
                      ? `${step?.id === 'both' ? '양쪽' : step?.id === 'right' ? '오른쪽' : '왼쪽'} · ${phases[state.phase]}`
                      : '시작하면 카메라를 연결합니다'}
          </p>
        </section>
        <div className="coaching-footer">
          {issue && running && (
            <p className="coaching-feedback" role="status">
              {feedback[issue]}
            </p>
          )}
          {running && step && progress && (
            <progress
              aria-label="현재 단계 관찰 유지 진행"
              max={step.targetMs || 1}
              value={progress.holdMs}
            />
          )}
          {result ? (
            <section aria-labelledby="run-result-title" className="coaching-run-result">
              <h2 id="run-result-title" ref={resultHeading} tabIndex={-1}>
                {result.outcome === 'completed'
                  ? '검수 흐름 완료'
                  : result.reason === 'pain'
                    ? '불편으로 중단했습니다'
                    : result.outcome === 'skipped'
                      ? '동작을 건너뛰었습니다'
                      : '검수를 종료했습니다'}
              </h2>
              <ul>
                {result.steps.map((item) => (
                  <li key={item.id}>
                    {item.id === 'both' ? '양쪽' : item.id === 'left' ? '왼쪽' : '오른쪽'} ·{' '}
                    {item.outcome === 'completed'
                      ? '완료'
                      : item.outcome === 'partial'
                        ? '진행 후 중단'
                        : '진행 전'}
                  </li>
                ))}
              </ul>
              {recordRun.current ? (
                <div>
                  <p className="small muted">격리된 합성 시험 기록 · 실제 운동 기록이 아닙니다.</p>
                  <p
                    ref={recordNotice}
                    tabIndex={-1}
                    role={recordState?.status === 'failed' ? 'alert' : 'status'}
                  >
                    {recordState?.status === 'saved'
                      ? '시험 기록을 저장했습니다.'
                      : recordState?.status === 'saving'
                        ? '시험 기록 저장 중'
                        : busy && !recordState
                          ? '연결 정리 중 · 아직 기록을 전송하지 않았습니다.'
                          : recordState?.status === 'failed'
                            ? recordState.failure === 'session-expired' ||
                              recordState.failure === 'ownership-error'
                              ? '계정을 다시 확인해 주세요. 자동으로 다시 저장하지 않습니다.'
                              : recordState.failure === 'network' ||
                                  recordState.failure === 'invalid-response'
                                ? '저장 응답을 확인하지 못했습니다. 같은 기록으로 다시 시도할 수 있습니다.'
                                : '기록을 저장하지 못했습니다. 새 검수 전에 연결을 확인해 주세요.'
                            : '저장하면 현재 시험 계정에서만 확인할 수 있습니다.'}
                  </p>
                  {recordState?.status === 'saved' ? (
                    <Link to={`/records/${recordRun.current.id}`}>저장한 시험 기록 보기</Link>
                  ) : recordState?.status === 'failed' ? (
                    recordState.failure === 'network' ||
                    recordState.failure === 'invalid-response' ? (
                      <button
                        className="button secondary"
                        type="button"
                        aria-disabled={busy}
                        onClick={() => void saveRecord(true)}
                      >
                        같은 시험 기록 다시 저장
                      </button>
                    ) : recordState.failure === 'session-expired' ||
                      recordState.failure === 'ownership-error' ? (
                      <button
                        className="button secondary"
                        type="button"
                        onClick={() => void authentication.refresh()}
                      >
                        계정 다시 확인
                      </button>
                    ) : null
                  ) : (
                    <button
                      className="button primary"
                      type="button"
                      aria-disabled={busy}
                      onClick={() => void saveRecord(false)}
                    >
                      시험 기록 저장
                    </button>
                  )}
                </div>
              ) : (
                <p className="small muted">검수 결과는 운동 기록에 저장하지 않습니다.</p>
              )}
            </section>
          ) : null}
          {problem && (
            <p role="alert">
              코칭 연결을 마무리하지 못했습니다. 카메라 정리가 실패했다면 화면을 새로 열어 주세요.
            </p>
          )}
          <div className="coaching-actions">
            {running && (
              <button
                className="button secondary"
                type="button"
                disabled={busy}
                onClick={() => native.current?.align()}
              >
                움직임 맞추기
              </button>
            )}
            {!running && !paused && !preparing && (
              <button
                className="button primary"
                type="button"
                onClick={() => void start()}
                disabled={retirementFailed || playback.state.failure === 'cleanup-error'}
              >
                {result ? '새 검수 시작' : '검수 시작'}
              </button>
            )}
            {running && (
              <button
                className="button secondary"
                type="button"
                disabled={busy}
                onClick={() => void action('pause')}
              >
                일시정지
              </button>
            )}
            {paused && (
              <button
                className="button primary"
                type="button"
                disabled={busy || !owned}
                onClick={() => void action('resume')}
              >
                다시 준비하고 재개
              </button>
            )}
            {(running || paused) && (
              <button
                className="button secondary"
                type="button"
                disabled={busy || !owned}
                onClick={() => void action('skip')}
              >
                동작 건너뛰기
              </button>
            )}
            {(running || paused || preparing) && (
              <button
                className="button secondary"
                type="button"
                disabled={busy && canceled.current}
                onClick={() => {
                  if (busy) {
                    canceled.current = true
                    setSnapshot(null)
                    setIssue(null)
                    void playback.cancel().catch(() => {
                      retirementFailed = true
                      if (mounted.current) setFailed(true)
                    })
                  } else void action('user-stop')
                }}
              >
                종료
              </button>
            )}
            {running && (
              <button
                className="button secondary"
                type="button"
                disabled={busy || !owned}
                onClick={() => void action('pain')}
              >
                불편하면 중단
              </button>
            )}
            {!running && !paused && !preparing && (
              <label>
                아바타 형태{' '}
                <select
                  aria-label="검수 아바타 형태"
                  value={gender}
                  onChange={(e) => setGender(e.target.value as AvatarGender)}
                >
                  <option value="male">남성</option>
                  <option value="female">여성</option>
                </select>
              </label>
            )}
            <Link className="button secondary" to="/dev/select">
              나가기
            </Link>
          </div>
          <p className="small muted">개발 검수 전용 · 의학적 진단이 아닙니다.</p>
        </div>
      </div>
    </section>
  )
}
