// FR-U-05/NFR-08: explicit confirmation, no background retry or persisted proofs.
import { useEffect, useRef, useState } from 'react'
import { ApiError } from '../api/auth'
import type { DeletePeriod, DeleteProof } from '../api/generated'
import { confirmDeletion, previewDeletion } from '../api/recordDeletion'
import { useAuth } from '../auth'

type State =
  | { kind: 'idle' | 'previewing' | 'deleting' }
  | { kind: 'confirm'; proof: DeleteProof }
  | { kind: 'message'; text: string }
export function RecordDeletion({
  period,
  from,
  to,
  onChanged,
}: {
  period: DeletePeriod
  from: string
  to: string
  onChanged: () => void
}) {
  const [state, setState] = useState<State>({ kind: 'idle' })
  const requestRef = useRef<AbortController | null>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const restoreFocus = useRef(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const { refresh } = useAuth()
  const busy = state.kind === 'previewing' || state.kind === 'deleting'
  useEffect(() => () => requestRef.current?.abort(), [])
  useEffect(() => {
    if (state.kind !== 'idle') heading.current?.focus({ preventScroll: true })
    else if (restoreFocus.current) {
      trigger.current?.focus()
      restoreFocus.current = false
    }
  }, [state.kind])
  function cancel() {
    requestRef.current?.abort()
    requestRef.current = null
    restoreFocus.current = true
    setState({ kind: 'idle' })
  }
  async function run(proof?: DeleteProof) {
    if (requestRef.current) return
    const controller = new AbortController()
    requestRef.current = controller
    setState({ kind: proof ? 'deleting' : 'previewing' })
    try {
      if (proof) {
        const deleted = await confirmDeletion(proof, controller.signal)
        if (controller.signal.aborted) return
        setState({ kind: 'message', text: `${deleted}건의 수행 기록을 삭제했습니다.` })
        onChanged()
      } else {
        const preview = await previewDeletion(period, controller.signal)
        if (!controller.signal.aborted) setState({ kind: 'confirm', proof: preview })
      }
    } catch (error) {
      if (controller.signal.aborted) return
      if (error instanceof ApiError && error.status === 401) {
        void refresh()
        return
      }
      const recheck = error instanceof ApiError && [403, 409].includes(error.status)
      setState({
        kind: 'message',
        text: recheck
          ? '삭제 확인이 만료되었거나 대상이 바뀌었습니다. 대상을 다시 확인해 주세요.'
          : proof
            ? '삭제 결과를 확인하지 못했습니다. 목록을 다시 조회한 뒤 대상을 확인해 주세요.'
            : '삭제 대상을 불러오지 못했습니다. 다시 확인해 주세요.',
      })
    } finally {
      if (requestRef.current === controller) requestRef.current = null
    }
  }
  return (
    <section className="record-deletion" aria-label="기록 삭제">
      {state.kind === 'idle' ? (
        <button ref={trigger} type="button" className="button secondary" onClick={() => void run()}>
          이 기간 기록 삭제
        </button>
      ) : (
        <>
          <h2 ref={heading} tabIndex={-1}>
            수행 기록 삭제 확인
          </h2>
          <p>
            {from}부터 {to}까지 · 조회한 기간의 전체 페이지
          </p>
          <div role="status">
            {state.kind === 'previewing' && <p>삭제 대상을 확인하고 있습니다.</p>}
            {state.kind === 'deleting' && (
              <p>삭제 요청을 처리하고 있습니다. 화면을 닫아도 서버에서 처리될 수 있습니다.</p>
            )}
            {state.kind === 'message' && <p>{state.text}</p>}
            {state.kind === 'confirm' && (
              <>
                <p>삭제 대상: {state.proof.count}건</p>
                <p>
                  삭제한 수행 기록은 복구할 수 없습니다. 계정이나 다른 기간의 기록은 삭제하지
                  않습니다.
                </p>
              </>
            )}
          </div>
          <div className="record-deletion-actions">
            <button
              type="button"
              className="button secondary"
              disabled={state.kind === 'deleting'}
              onClick={cancel}
            >
              {state.kind === 'confirm' || state.kind === 'previewing'
                ? '취소'
                : '목록으로 돌아가기'}
            </button>
            {state.kind === 'confirm' && (
              <button
                type="button"
                className="button destructive"
                disabled={state.proof.count === 0}
                onClick={() => void run(state.proof)}
              >
                기록 삭제
              </button>
            )}
            {state.kind === 'message' && (
              <>
                <button type="button" className="button secondary" onClick={onChanged}>
                  목록 다시 조회
                </button>
                <button
                  type="button"
                  className="button secondary"
                  disabled={busy}
                  onClick={() => void run()}
                >
                  삭제 대상 다시 확인
                </button>
              </>
            )}
          </div>
        </>
      )}
    </section>
  )
}
