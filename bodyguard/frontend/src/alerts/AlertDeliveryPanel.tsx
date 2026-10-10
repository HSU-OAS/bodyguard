// FR-N-04/05/NFR-08: private non-modal web panel; owner controls delivery lifetime.
import { useId, useLayoutEffect, useRef, useSyncExternalStore } from 'react'
import type { AlertDelivery } from './delivery'
import './AlertDeliveryPanel.css'

export function AlertDeliveryPanel({ delivery }: { delivery: AlertDelivery }) {
  const state = useSyncExternalStore(delivery.subscribe, delivery.getSnapshot, delivery.getSnapshot)
  const id = useId()
  const host = useRef<HTMLElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const returnFocus = useRef(false)
  useLayoutEffect(() => {
    if (!returnFocus.current) return
    returnFocus.current = false
    if (state.closed) return
    // NFR-08: the owner may already focus its destination; never override it.
    const active = document.activeElement
    if (
      active &&
      active !== document.body &&
      active !== document.documentElement &&
      active.isConnected
    )
      return
    // NFR-08: only the user's removal relocates focus; arrivals never do.
    const next = host.current?.querySelector<HTMLButtonElement>('.alert-actions button')
    ;(next ?? heading.current)?.focus()
  })
  if (state.closed) return null
  const explanation = {
    default: '다른 창에서도 받으려면 알림을 허용하세요.',
    requesting: '브라우저에서 권한을 선택해 주세요.',
    granted: '브라우저 알림 허용됨',
    denied: '화면에서만 안내합니다. 다른 창에서는 알림이 보이지 않습니다.',
    unsupported: '화면 안내만 지원합니다.',
    failed: '권한 확인 실패. 화면 안내는 사용할 수 있습니다.',
  }[state.permission]
  return (
    <section ref={host} className="alert-delivery" aria-labelledby={`${id}-title`}>
      <h2 ref={heading} tabIndex={-1} id={`${id}-title`}>
        스트레칭 알림
      </h2>
      <p className="muted alert-permission">{explanation}</p>
      {['default', 'failed', 'requesting'].includes(state.permission) ? (
        <button
          className="button secondary"
          type="button"
          aria-label={
            state.permission === 'requesting' ? '권한 확인 중…' : '브라우저 알림 허용 요청'
          }
          disabled={state.permission === 'requesting'}
          onClick={() => {
            void delivery.requestPermission()
          }}
        >
          {state.permission === 'requesting' ? '권한 확인 중…' : '알림 허용'}
        </button>
      ) : state.permission === 'denied' || state.permission === 'granted' ? (
        <button
          className="text-button alert-refresh"
          type="button"
          onClick={delivery.refreshPermission}
        >
          권한 다시 확인
        </button>
      ) : null}
      <p className="alert-summary" role="status" aria-atomic="true">
        {state.alerts.length ? `안내 ${state.alerts.length}개` : '안내가 없습니다.'}
      </p>
      {state.browserFailed && (
        <p className="form-error">브라우저 알림 표시 실패. 화면에서 확인해 주세요.</p>
      )}
      <div className="alert-list">
        {state.alerts.map((kind) => {
          const prefix = kind === 'posture' ? '자세' : '장시간'
          return (
            <fieldset className="alert-item" aria-labelledby={`${id}-${kind}`} key={kind}>
              <h3 id={`${id}-${kind}`}>
                {kind === 'posture' ? '자세 스트레칭 안내' : '장시간 사용 안내'}
              </h3>
              <div className="alert-actions">
                <button
                  className="button primary"
                  type="button"
                  aria-label={`${prefix} 안내 스트레칭 살펴보기`}
                  onClick={(event) => {
                    returnFocus.current = document.activeElement === event.currentTarget
                    if (!delivery.choose(kind)) returnFocus.current = false
                  }}
                >
                  스트레칭 보기
                </button>
                <button
                  className="button secondary"
                  type="button"
                  aria-label={`${prefix} 안내 닫기`}
                  onClick={(event) => {
                    returnFocus.current = document.activeElement === event.currentTarget
                    delivery.dismiss(kind)
                  }}
                >
                  닫기
                </button>
              </div>
            </fieldset>
          )
        })}
      </div>
      {state.alerts.length > 0 && (
        <p className="muted alert-safety">통증이 있으면 동작을 멈추세요.</p>
      )}
      <details className="alert-help">
        <summary>알림 안내</summary>
        <p className="muted">
          권한을 허용하지 않아도 화면 안내는 남습니다. 차단한 권한은 브라우저 설정에서 변경하세요.
        </p>
        <p className="muted">소리와 실제 측정 연결은 준비 중입니다.</p>
      </details>
    </section>
  )
}
