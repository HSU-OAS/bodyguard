// FR-N-03/FR-U-04/NFR-08: explicit owned settings, not activated alert coaching.
import { type FormEvent, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { ApiError } from '../api/auth'
import type { NotificationPreferences } from '../api/generated'
import { preparePreferences } from '../api/notificationPreferences'
import { type ReadyAccount, useAuth } from '../auth'
import './NotificationPreferencesPage.css'

type Context = Awaited<ReturnType<typeof preparePreferences>>
type Operation = {
  revision: number
  authority: ReadyAccount
  abort: AbortController
  context: Context | null
  busy: boolean
}
type Draft = Omit<NotificationPreferences, 'posture_minutes' | 'sitting_minutes'> & {
  posture_minutes: string
  sitting_minutes: string
}
type Status = 'loading' | 'read-error' | 'editing' | 'saving' | 'saved' | 'uncertain'
function asDraft(value: NotificationPreferences): Draft {
  return {
    ...value,
    posture_minutes: String(value.posture_minutes),
    sitting_minutes: String(value.sitting_minutes),
  }
}
function validMinutes(value: string) {
  return /^[0-9]{1,4}$/.test(value) && Number(value) >= 1 && Number(value) <= 1440
}
function stop(op: Operation | null) {
  op?.abort.abort()
  op?.context?.close()
}

export function NotificationPreferencesPage() {
  const { state, refresh } = useAuth()
  const authority = state.status === 'ready' ? state : null
  const owner = useRef<ReadyAccount | null>(null)
  const operation = useRef<Operation | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const summary = useRef<HTMLDivElement>(null)
  const [revision, setRevision] = useState(0)
  const [view, setView] = useState<{ owner: ReadyAccount | null; status: Status }>({
    owner: null,
    status: 'loading',
  })
  const [draft, setDraft] = useState<Draft | null>(null)
  const [invalid, setInvalid] = useState<Array<'posture' | 'sitting'>>([])
  useLayoutEffect(() => {
    owner.current = authority
    return () => {
      owner.current = null
      stop(operation.current)
      operation.current = null
    }
  }, [authority])
  useEffect(() => {
    document.title = '알림 설정 · BODYGUARD'
    // NFR-08: route focus must not activate an unfocused browser window and trigger re-auth.
    if (document.hasFocus()) heading.current?.focus({ preventScroll: true })
  }, [])
  useEffect(() => {
    if (invalid.length) summary.current?.focus()
  }, [invalid])
  useEffect(() => {
    if (!authority) return
    const op: Operation = {
      authority,
      revision,
      abort: new AbortController(),
      context: null,
      busy: false,
    }
    operation.current = op
    setView({ owner: authority, status: 'loading' })
    setDraft(null)
    setInvalid([])
    void preparePreferences({
      authority,
      readAuthority: () => owner.current,
      signal: op.abort.signal,
    }).then(
      (context) => {
        if (operation.current !== op || op.abort.signal.aborted || owner.current !== authority) {
          context.close()
          return
        }
        op.context = context
        setDraft(asDraft(context.value))
        setView({ owner: authority, status: 'editing' })
      },
      (error: unknown) => {
        if (operation.current !== op || op.abort.signal.aborted || owner.current !== authority)
          return
        if (error instanceof ApiError && [401, 403].includes(error.status)) {
          void refresh()
          return
        }
        setView({ owner: authority, status: 'read-error' })
      },
    )
    return () => {
      stop(op)
      if (operation.current === op) operation.current = null
    }
  }, [authority, revision, refresh])

  const status = view.owner === authority ? view.status : 'loading'
  const blocked = status === 'saving' || status === 'uncertain'
  function change(update: Partial<Draft>) {
    if (blocked) return
    setDraft((previous) => {
      if (!previous) return previous
      const next = { ...previous, ...update }
      for (const kind of ['posture', 'sitting'] as const) {
        const minutes = `${kind}_minutes` as const
        if (update[`${kind}_enabled`] === false && !validMinutes(next[minutes])) {
          const saved = operation.current?.context?.value[minutes]
          if (saved !== undefined) next[minutes] = String(saved)
        }
      }
      return next
    })
    setInvalid([])
    setView({ owner: authority, status: 'editing' })
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const op = operation.current
    if (
      !draft ||
      !op?.context ||
      op.busy ||
      op.abort.signal.aborted ||
      owner.current !== op.authority ||
      blocked
    )
      return
    const errors: Array<'posture' | 'sitting'> = []
    if (!validMinutes(draft.posture_minutes)) errors.push('posture')
    if (!validMinutes(draft.sitting_minutes)) errors.push('sitting')
    setInvalid(errors)
    if (errors.length) {
      return
    }
    op.busy = true
    setView({ owner: op.authority, status: 'saving' })
    try {
      const result = await op.context.save({
        ...draft,
        posture_minutes: Number(draft.posture_minutes),
        sitting_minutes: Number(draft.sitting_minutes),
      })
      if (operation.current !== op || op.abort.signal.aborted || owner.current !== op.authority)
        return
      setDraft(asDraft(result))
      setView({ owner: op.authority, status: 'saved' })
    } catch (error) {
      if (operation.current !== op || op.abort.signal.aborted || owner.current !== op.authority)
        return
      if (error instanceof ApiError && [401, 403].includes(error.status)) {
        void refresh()
        return
      }
      setView({ owner: op.authority, status: 'uncertain' })
    } finally {
      op.busy = false
    }
  }
  if (!authority) return null
  return (
    <section className="notification-screen">
      <Link className="notification-back" to="/account">
        ← 내 계정
      </Link>
      <p className="eyebrow">MY BODYGUARD / PREFERENCES</p>
      <h1 ref={heading} tabIndex={-1}>
        알림 설정
      </h1>
      <p className="muted notification-lead">내 생활에 맞는 알림 시간과 방식을 설정하세요.</p>
      <aside className="notification-note">
        <p>설정은 계정에 저장됩니다. 실제 알림 연결은 준비 중입니다.</p>
        <p className="small muted">
          이 화면에서는 카메라·브라우저 알림을 켜거나 소리를 재생하지 않습니다.
        </p>
      </aside>
      {status === 'loading' ? (
        <p className="notification-state" role="status">
          설정을 불러오고 있습니다.
        </p>
      ) : status === 'read-error' ? (
        <div className="notification-state">
          <p role="alert">설정을 불러오지 못했습니다.</p>
          <p className="muted">연결을 확인한 뒤 다시 조회해 주세요.</p>
          <button
            className="button secondary"
            type="button"
            onClick={() => setRevision((n) => n + 1)}
          >
            다시 조회
          </button>
        </div>
      ) : (
        draft && (
          <form
            aria-label="알림 설정 변경"
            noValidate
            onSubmit={(event) => {
              void save(event)
            }}
            aria-busy={status === 'saving'}
          >
            {invalid.length > 0 && (
              <div
                className="notification-errors form-error"
                ref={summary}
                tabIndex={-1}
                role="alert"
              >
                <p>알림 시간을 확인해 주세요.</p>
                {invalid.map((kind) => (
                  <button
                    key={kind}
                    className="text-button"
                    type="button"
                    onClick={() => document.getElementById(`${kind}-minutes`)?.focus()}
                  >
                    {kind === 'posture' ? '자세 알림 시간' : '장시간 앉음 알림 시간'}: 1~1440분의
                    정수를 입력해 주세요.
                  </button>
                ))}
              </div>
            )}
            {(['posture', 'sitting'] as const).map((kind, index) => {
              const enabled = `${kind}_enabled` as const
              const minutes = `${kind}_minutes` as const
              const label = kind === 'posture' ? '자세 알림' : '장시간 앉음 알림'
              return (
                <fieldset
                  className="notification-group"
                  key={kind}
                  disabled={blocked}
                  aria-labelledby={`${kind}-heading`}
                >
                  <legend id={`${kind}-heading`}>
                    <span aria-hidden="true">0{index + 1}</span>
                    {label}
                  </legend>
                  <p className="muted">
                    {kind === 'posture'
                      ? '기준 자세에서 벗어난 상태가 이어지면 알리는 시간입니다.'
                      : '오래 앉아 있는 시간이 이어지면 알리는 시간입니다.'}
                  </p>
                  <label className="notification-choice">
                    <input
                      type="checkbox"
                      checked={draft[enabled]}
                      onChange={(event) => change({ [enabled]: event.target.checked })}
                    />
                    {label} 사용
                  </label>
                  <div className="notification-interval">
                    <label htmlFor={`${kind}-minutes`}>{label} 시간 (분)</label>
                    <input
                      id={`${kind}-minutes`}
                      type="number"
                      inputMode="numeric"
                      min="1"
                      max="1440"
                      step="1"
                      disabled={!draft[enabled]}
                      value={draft[minutes]}
                      onChange={(event) => change({ [minutes]: event.target.value })}
                      aria-invalid={invalid.includes(kind) ? true : undefined}
                      aria-describedby={
                        invalid.includes(kind) ? `${kind}-error` : 'notification-range'
                      }
                    />
                  </div>
                  {invalid.includes(kind) && (
                    <p id={`${kind}-error`} className="form-error">
                      1~1440분의 정수를 입력해 주세요.
                    </p>
                  )}
                </fieldset>
              )
            })}
            <fieldset
              className="notification-group"
              disabled={blocked}
              aria-labelledby="notification-sound-heading"
            >
              <legend id="notification-sound-heading">
                <span aria-hidden="true">03</span>알림 소리
              </legend>
              <p className="muted">
                필요할 때 소리를 함께 사용할지 선택합니다. 기본값은 꺼짐입니다.
              </p>
              <label className="notification-choice">
                <input
                  type="checkbox"
                  checked={draft.sound_enabled}
                  onChange={(event) => change({ sound_enabled: event.target.checked })}
                />
                알림 소리 사용
              </label>
            </fieldset>
            <p id="notification-range" className="small muted notification-range">
              시간은 1~1440분 범위에서 설정할 수 있습니다. 이 범위는 의학 권장 간격이 아닙니다.
            </p>
            <div className="notification-actions">
              <button className="button primary" type="submit" disabled={blocked}>
                {status === 'saving' ? '저장 중…' : '설정 저장'}
              </button>
              <Link to="/account">내 계정으로 돌아가기</Link>
            </div>
            <p className="form-notice" role="status">
              {status === 'saved'
                ? '설정을 저장했습니다.'
                : status === 'saving'
                  ? '저장 결과를 확인하고 있습니다.'
                  : ''}
            </p>
            {status === 'uncertain' && (
              <div className="notification-state">
                <p className="form-error" role="alert">
                  저장 결과를 확인하지 못했습니다. 저장된 설정을 다시 불러온 뒤 변경해 주세요.
                </p>
                <button
                  className="button secondary"
                  type="button"
                  onClick={() => setRevision((n) => n + 1)}
                >
                  저장된 설정 다시 조회
                </button>
              </div>
            )}
          </form>
        )
      )}
    </section>
  )
}
