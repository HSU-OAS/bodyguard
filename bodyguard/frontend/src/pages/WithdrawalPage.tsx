// FR-U-05/NFR-08: memory-only proof, explicit consent, no automatic destructive retries.
import { type FormEvent, useEffect, useRef, useState } from 'react'
import { Link, Navigate } from 'react-router'
import { ApiError } from '../api/auth'
import { startWithdrawal, WithdrawalRejected } from '../api/withdrawal'
import { useAuth } from '../auth'

export function WithdrawalPage() {
  const { state, refresh, signOut, withdrawAccount } = useAuth()
  const latestAuth = useRef(state)
  latestAuth.current = state
  const [phase, setPhase] = useState<'intro' | 'verify' | 'unknown' | 'done'>('intro')
  const [proof, setProof] = useState<{ id: string; owner: string } | null>(null)
  const [code, setCode] = useState('')
  const [agreement, setAgreement] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState<'send' | 'confirm' | null>(null)
  const [deadline, setDeadline] = useState(0)
  const [now, setNow] = useState(Date.now)
  const active = useRef<{ controller: AbortController; kind: 'send' | 'confirm' } | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const codeInput = useRef<HTMLInputElement>(null)
  const remaining = Math.max(0, Math.ceil((deadline - now) / 1000))
  const owner = state.status === 'ready' ? state.user.id : null

  useEffect(
    () => () => {
      active.current?.controller.abort()
      active.current = null
    },
    [],
  )
  useEffect(() => {
    if (state.status === 'withdrawing') return
    if (state.status !== 'ready' || (proof && proof.owner !== owner)) {
      setProof(null)
      setCode('')
      setAgreement('')
      setPhase((value) => (value === 'verify' ? 'intro' : value))
      if (active.current?.kind === 'send') {
        active.current.controller.abort()
        active.current = null
        setPending(null)
      }
    }
  }, [state.status, owner, proof])
  useEffect(() => {
    if (deadline <= Date.now()) return
    const timer = window.setInterval(() => {
      const time = Date.now()
      setNow(time)
      if (time >= deadline) window.clearInterval(timer)
    }, 1000)
    return () => window.clearInterval(timer)
  }, [deadline])
  useEffect(() => {
    document.title = `${phase === 'done' ? '탈퇴 완료' : '회원 탈퇴'} · BODYGUARD`
    if (phase === 'verify' && state.status === 'ready') codeInput.current?.focus()
    else heading.current?.focus({ preventScroll: true })
  }, [phase, state.status])

  function clearProof() {
    setProof(null)
    setCode('')
    setAgreement('')
  }
  function limit(error: ApiError) {
    const wait = Math.max(1, Math.min(3600, Math.ceil(error.retryAfter || 60)))
    setDeadline(Date.now() + wait * 1000)
    setNow(Date.now())
  }
  async function send() {
    if (active.current || state.status !== 'ready' || remaining > 0) return
    const id = state.user.id
    const operation = { controller: new AbortController(), kind: 'send' as const }
    active.current = operation
    setPending('send')
    setError('')
    clearProof()
    setPhase('intro')
    try {
      const result = await startWithdrawal(operation.controller.signal)
      const current = latestAuth.current
      if (
        !operation.controller.signal.aborted &&
        current.status === 'ready' &&
        current.user.id === id
      ) {
        setProof({ id: result.challenge_id, owner: id })
        setPhase('verify')
      }
    } catch (error) {
      if (operation.controller.signal.aborted) return
      if (error instanceof ApiError && error.status === 429) {
        limit(error)
        setError('요청이 많습니다. 표시된 대기 시간 후 다시 요청해 주세요.')
      } else if (error instanceof ApiError && [401, 403].includes(error.status)) {
        setError('본인 계정을 다시 확인해 주세요.')
        void refresh()
      } else setError('인증 코드 전송을 확인하지 못했습니다. 잠시 후 다시 요청해 주세요.')
    } finally {
      if (active.current === operation) {
        active.current = null
        setPending(null)
      }
    }
  }
  async function confirm(event: FormEvent) {
    event.preventDefault()
    if (
      active.current ||
      !proof ||
      state.status !== 'ready' ||
      proof.owner !== state.user.id ||
      remaining > 0
    )
      return
    if (!/^[0-9]{6}$/.test(code) || agreement !== '탈퇴') {
      setError('6자리 인증 코드와 확인문 “탈퇴”를 입력해 주세요.')
      return
    }
    const operation = { controller: new AbortController(), kind: 'confirm' as const }
    active.current = operation
    setPending('confirm')
    setError('')
    try {
      await withdrawAccount(
        { challenge_id: proof.id, code, confirmation: 'delete-my-account' },
        operation.controller.signal,
      )
      if (!operation.controller.signal.aborted) {
        clearProof()
        setPhase('done')
      }
    } catch (error) {
      if (operation.controller.signal.aborted) return
      if (error instanceof WithdrawalRejected && error.checkedUserId === proof.owner) {
        setCode('')
        setAgreement('')
        if (error.status === 429) {
          limit(error)
          setError('요청이 많습니다. 대기 후 다시 확인해 주세요.')
        } else
          setError(
            '인증 코드를 확인해 주세요. 만료되거나 새로 발급했다면 인증 코드를 다시 받아 주세요.',
          )
        codeInput.current?.focus()
      } else {
        clearProof()
        setPhase('unknown')
        setError(
          '삭제 결과를 확인하지 못했습니다. 완료로 표시하지 않았으며 자동으로 다시 삭제하지 않습니다.',
        )
      }
    } finally {
      if (active.current === operation) {
        active.current = null
        setPending(null)
      }
    }
  }

  if (phase === 'done')
    return (
      <section className="status-screen withdrawal-status">
        <p className="eyebrow">ACCOUNT CLOSED</p>
        <h1 ref={heading} tabIndex={-1}>
          회원 탈퇴가 완료되었습니다
        </h1>
        <p role="status">계정과 수행 기록이 삭제되었으며 로그아웃되었습니다.</p>
        <Link className="button primary" to="/">
          서비스 소개로 돌아가기
        </Link>
      </section>
    )
  if (phase === 'unknown')
    return (
      <section className="status-screen withdrawal-status">
        <p className="eyebrow">ACCOUNT CHECK</p>
        <h1 ref={heading} tabIndex={-1}>
          계정 상태를 다시 확인해 주세요
        </h1>
        <p className="form-error" role="alert">
          {error}
        </p>
        <p>
          로그인이 만료된 것만으로 탈퇴 완료를 확인할 수는 없습니다. 계정 상태 확인 또는 재로그인 후
          진행해 주세요.
        </p>
        {state.status === 'checking' ? (
          <p role="status">계정을 확인하고 있습니다.</p>
        ) : state.status === 'ready' ? (
          <Link className="button primary" to="/account">
            계정 관리로 돌아가기
          </Link>
        ) : state.status === 'guest' ? (
          <Link className="button primary" to="/login?next=%2Fstart">
            로그인하여 계정 확인
          </Link>
        ) : (
          <button
            type="button"
            className="button primary"
            onClick={() => {
              void refresh()
            }}
          >
            계정 상태 확인
          </button>
        )}
        <Link className="back-link" to="/">
          서비스 소개
        </Link>
      </section>
    )
  if (state.status === 'guest') return <Navigate to="/login?next=%2Fstart" replace />
  if (
    (state.status !== 'ready' && state.status !== 'withdrawing') ||
    (state.status === 'withdrawing' && pending !== 'confirm')
  )
    return (
      <section className="status-screen">
        <h1 ref={heading} tabIndex={-1}>
          {state.status === 'checking'
            ? '계정을 확인하고 있습니다'
            : state.status === 'logging-out'
              ? '로그아웃 중입니다'
              : state.status === 'withdrawing'
                ? '탈퇴 결과를 확인하고 있습니다'
                : '계정 연결을 확인해 주세요'}
        </h1>
        <p
          role={
            ['checking', 'logging-out', 'withdrawing'].includes(state.status) ? 'status' : 'alert'
          }
        >
          본인 계정이 확인된 뒤에만 탈퇴를 진행합니다.
        </p>
        {!['checking', 'logging-out', 'withdrawing'].includes(state.status) && (
          <button
            type="button"
            className="button primary"
            onClick={() => {
              void (state.status === 'logout-error' ? signOut() : refresh())
            }}
          >
            {state.status === 'logout-error' ? '로그아웃 다시 시도' : '계정 상태 확인'}
          </button>
        )}
      </section>
    )
  return (
    <section className="withdrawal-screen">
      <p className="eyebrow">ACCOUNT & DATA</p>
      <h1 ref={heading} tabIndex={-1}>
        회원 탈퇴
      </h1>
      <p className="muted member-lead">
        계정과 수행 기록을 삭제합니다. 삭제 후에는 되돌릴 수 없습니다.
      </p>
      <div className="withdrawal-scope">
        <h2>삭제되는 정보</h2>
        <ul>
          <li>BODYGUARD 계정과 로그인 정보</li>
          <li>이 계정의 수행 기록</li>
        </ul>
        <p>
          모든 로그인 세션이 종료됩니다. 기록만 삭제하려면 수행 기록 관리에서 기간을 선택해 주세요.
        </p>
        <Link to="/records">기록만 삭제하기</Link>
      </div>
      <div className="account-form withdrawal-form">
        {state.status === 'ready' && (
          <p className="withdrawal-email">
            본인 확인 이메일 <strong>{state.user.email}</strong>
          </p>
        )}
        {phase === 'verify' && proof ? (
          <>
            <p className="form-notice" role="status">
              탈퇴 전용 인증 코드를 보냈습니다. 코드는 10분 동안 사용할 수 있습니다.
            </p>
            <form
              onSubmit={(event) => {
                void confirm(event)
              }}
              aria-busy={pending === 'confirm'}
            >
              <label>
                탈퇴 인증 코드
                <input
                  ref={codeInput}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  pattern="[0-9]{6}"
                  minLength={6}
                  maxLength={6}
                  required
                  disabled={pending !== null}
                  aria-describedby="withdrawal-feedback"
                />
              </label>
              <label>
                확인문
                <input
                  type="text"
                  value={agreement}
                  onChange={(event) => setAgreement(event.target.value)}
                  autoComplete="off"
                  required
                  disabled={pending !== null}
                  aria-describedby="withdrawal-agreement"
                />
              </label>
              <p id="withdrawal-agreement" className="muted small">
                계정과 기록의 삭제에 동의하면 “탈퇴”를 입력해 주세요.
              </p>
              <div id="withdrawal-feedback">
                {error && (
                  <p className="form-error" role="alert">
                    {error}
                  </p>
                )}
              </div>
              <button
                className="button destructive wide"
                type="submit"
                disabled={
                  pending !== null ||
                  remaining > 0 ||
                  !/^[0-9]{6}$/.test(code) ||
                  agreement !== '탈퇴'
                }
              >
                {pending === 'confirm' ? '삭제 결과 확인 중…' : '계정과 기록 삭제'}
              </button>
            </form>
            <button
              className="text-button withdrawal-resend"
              type="button"
              disabled={pending !== null || remaining > 0}
              onClick={() => {
                void send()
              }}
            >
              인증 코드 다시 받기
            </button>
          </>
        ) : (
          <>
            <p>현재 계정의 이메일로 인증 코드를 보냅니다. 코드 요청만으로는 삭제되지 않습니다.</p>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button
              type="button"
              className="button primary wide"
              disabled={pending !== null || remaining > 0}
              onClick={() => {
                void send()
              }}
            >
              {pending === 'send' ? '인증 코드 요청 중…' : '탈퇴 인증 코드 받기'}
            </button>
          </>
        )}
        {remaining > 0 && (
          <p className="muted small" role="status">
            다시 요청까지 {remaining}초
          </p>
        )}
        {pending === 'confirm' ? (
          <p className="muted small" role="status">
            요청이 전송되었습니다. 삭제 결과를 확인할 때까지 기다려 주세요.
          </p>
        ) : (
          <Link className="button secondary wide withdrawal-cancel" to="/account">
            탈퇴 취소하고 돌아가기
          </Link>
        )}
      </div>
    </section>
  )
}
