// FR-U-05: exact, cancellable confirmation; uncertain writes are never repeated automatically.
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ApiError } from '../api/auth'
import type { DeletePeriod, SummaryProof } from '../api/generated'
import type { SummaryContext } from '../api/minuteSummaries'

const periodTime = new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'medium' })
const boundary = (value: string) => {
  const fraction = /\.(\d{1,6})/.exec(value)?.[1]
  return periodTime
    .formatToParts(new Date(value))
    .map((part) => (part.type === 'second' && fraction ? `${part.value}.${fraction}` : part.value))
    .join('')
}

type State =
  | { kind: 'idle' | 'previewing' | 'error' | 'conflict' | 'uncertain' }
  | { kind: 'confirming' | 'removing'; proof: SummaryProof }
  | { kind: 'done'; deleted: number }

export function MinuteSummaryDeletion({
  context,
  range,
  onAuthFailure,
  onStale,
  onReload,
  onBusy,
}: {
  context: SummaryContext
  range: DeletePeriod
  onAuthFailure(): void
  onStale(): void
  onReload(): void
  onBusy(busy: boolean): void
}) {
  const [state, setState] = useState<State>({ kind: 'idle' })
  const current = useRef<AbortController | null>(null)
  const mounted = useRef(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const entry = useRef<HTMLButtonElement>(null)
  const result = useRef<HTMLParagraphElement>(null)
  const previousKind = useRef(state.kind)
  useLayoutEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      current.current?.abort()
    }
  }, [])
  useEffect(() => {
    if (state.kind === 'idle' && previousKind.current === 'confirming' && document.hasFocus())
      entry.current?.focus()
    if (state.kind === 'confirming' && document.hasFocus())
      heading.current?.focus({ preventScroll: true })
    previousKind.current = state.kind
    if (['done', 'conflict', 'uncertain', 'error'].includes(state.kind) && document.hasFocus())
      result.current?.focus()
  }, [state.kind])
  async function run(removing: boolean) {
    if (current.current || (removing && state.kind !== 'confirming')) return
    const operation = new AbortController()
    current.current = operation
    onBusy(true)
    const proof = state.kind === 'confirming' ? state.proof : null
    setState(removing && proof ? { kind: 'removing', proof } : { kind: 'previewing' })
    const live = () => mounted.current && !operation.signal.aborted && current.current === operation
    try {
      if (removing && proof) {
        const deleted = await context.remove(proof, operation.signal)
        if (!live()) return
        setState({ kind: 'done', deleted })
        onStale()
      } else {
        const preview = await context.preview(range, operation.signal)
        if (live()) setState({ kind: 'confirming', proof: preview })
      }
    } catch (error) {
      if (!live()) return
      if (error instanceof ApiError && [401, 403].includes(error.status)) {
        onAuthFailure()
        return
      }
      if (error instanceof ApiError && error.status === 409) {
        setState({ kind: 'conflict' })
        onStale()
      } else if (removing) {
        setState({ kind: 'uncertain' })
        onStale()
      } else setState({ kind: 'error' })
    } finally {
      if (live()) {
        current.current = null
        onBusy(false)
      }
    }
  }
  return (
    <section
      className="record-deletion"
      aria-labelledby="summary-deletion-heading"
      aria-busy={state.kind === 'previewing' || state.kind === 'removing'}
    >
      <h2 id="summary-deletion-heading" ref={heading} tabIndex={-1}>
        {state.kind === 'confirming' || state.kind === 'removing'
          ? '자세 기록 삭제 확인'
          : '이 기간의 자세 기록 삭제'}
      </h2>
      {state.kind === 'idle' && (
        <>
          <p className="muted">
            선택한 기간의 자세 기록만 삭제합니다. 먼저 대상 수를 확인하세요. 수행 기록과 개인
            기준선은 삭제하지 않습니다.
          </p>
          <div className="record-deletion-actions">
            <button
              ref={entry}
              className="button secondary"
              type="button"
              onClick={() => {
                void run(false)
              }}
            >
              삭제 대상 확인
            </button>
          </div>
        </>
      )}
      {state.kind === 'previewing' && <p role="status">삭제 대상을 확인하고 있습니다.</p>}
      {(state.kind === 'confirming' || state.kind === 'removing') && (
        <>
          <p>
            삭제 대상 <strong>{state.proof.count.toLocaleString('ko-KR')}건</strong>
          </p>
          <p className="muted">
            확인한 기간: {boundary(state.proof.start)} ~ {boundary(state.proof.end)} (종료 시각
            제외).
          </p>
          <p className="muted">
            확인 시점까지 저장된 이 기간의 기록입니다. 삭제한 기록은 되돌릴 수 없습니다.
          </p>
          <div className="record-deletion-actions">
            <button
              className="button destructive"
              type="button"
              disabled={state.proof.count === 0 || state.kind === 'removing'}
              onClick={() => {
                void run(true)
              }}
            >
              확인한 자세 기록 삭제
            </button>
            <button
              className="button secondary"
              type="button"
              disabled={state.kind === 'removing'}
              onClick={() => setState({ kind: 'idle' })}
            >
              취소
            </button>
          </div>
          {state.kind === 'removing' && <p role="status">삭제 결과를 확인하고 있습니다.</p>}
        </>
      )}
      {state.kind === 'done' && (
        <p role="status" ref={result} tabIndex={-1}>
          {state.deleted
            ? `자세 기록 ${state.deleted.toLocaleString('ko-KR')}건을 삭제했습니다.`
            : '확인한 삭제 대상이 남아 있지 않습니다.'}{' '}
          최신 목록은 기간을 다시 조회해 확인하세요.
        </p>
      )}
      {state.kind === 'uncertain' && (
        <p role="alert" ref={result} tabIndex={-1}>
          삭제 결과를 확인하지 못했습니다. 중복 삭제 요청은 보내지 않았습니다. 기간을 다시 조회해
          기록을 확인하세요.
        </p>
      )}
      {state.kind === 'conflict' && (
        <>
          <p role="alert" ref={result} tabIndex={-1}>
            삭제 대상이 바뀌었거나 확인 시간이 지났습니다. 대상을 다시 확인하세요.
          </p>
          <div className="record-deletion-actions">
            <button
              type="button"
              className="button secondary"
              onClick={() => {
                void run(false)
              }}
            >
              삭제 대상 다시 확인
            </button>
          </div>
        </>
      )}
      {state.kind === 'error' && (
        <>
          <p role="alert" ref={result} tabIndex={-1}>
            삭제 대상을 조회하지 못했습니다. 기록은 삭제하지 않았습니다.
          </p>
          <div className="record-deletion-actions">
            <button
              type="button"
              className="button secondary"
              onClick={() => {
                void run(false)
              }}
            >
              삭제 대상 다시 확인
            </button>
          </div>
        </>
      )}
      {(state.kind === 'done' || state.kind === 'uncertain') && (
        <div className="record-deletion-actions">
          <button type="button" className="button secondary" onClick={onReload}>
            기간 다시 조회
          </button>
        </div>
      )}
    </section>
  )
}
