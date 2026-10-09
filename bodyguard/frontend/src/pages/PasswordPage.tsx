// FR-U-03/NFR-08: one-use email link stays in mounted memory, never browser storage.
import { type FormEvent, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { ApiError, errorMessage, forgot, validPassword } from '../api/auth'
import { useAuth } from '../auth'

function linkToken(hash: string, search: string) {
  if (search) return ''
  const values = new URLSearchParams(hash.slice(1))
  const value = values.get('token') || ''
  return values.size === 1 && /^[A-Za-z0-9_-]{43}$/.test(value) ? value : ''
}

export function PasswordPage({ mode }: { mode: 'forgot' | 'reset' }) {
  const location = useLocation()
  const navigate = useNavigate()
  const auth = useAuth()
  const [token, setToken] = useState(() =>
    mode === 'reset' ? linkToken(location.hash, location.search) : '',
  )
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [visible, setVisible] = useState(false)
  const [pending, setPending] = useState(false)
  const [acknowledged, setAcknowledged] = useState(false)
  const [complete, setComplete] = useState(false)
  const [error, setError] = useState('')
  const [deadline, setDeadline] = useState(0)
  const [remaining, setRemaining] = useState(0)
  const busy = useRef(false)
  const operation = useRef<AbortController | null>(null)
  const confirmInput = useRef<HTMLInputElement>(null)
  const passwordInput = useRef<HTMLInputElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)

  useLayoutEffect(() => {
    if (mode === 'reset' && (location.hash || location.search)) {
      // FR-U-03: a new fragment can navigate the same mounted page without a reload.
      operation.current?.abort()
      busy.current = false
      setPending(false)
      setToken(linkToken(location.hash, location.search))
      setPassword('')
      setConfirmation('')
      setComplete(false)
      setError('')
      setDeadline(0)
      navigate('/password/reset', { replace: true })
    }
  }, [mode, location.hash, location.search, navigate])
  useEffect(() => () => operation.current?.abort(), [])
  useEffect(() => {
    const update = () => setRemaining(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)))
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [deadline])
  useEffect(() => {
    if (complete || (mode === 'reset' && !token)) heading.current?.focus()
  }, [complete, mode, token])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy.current || remaining > 0) return
    if (mode === 'reset' && !validPassword(password)) {
      setError('비밀번호는 15~128자로 입력해 주세요.')
      passwordInput.current?.focus()
      return
    }
    if (mode === 'reset' && password !== confirmation) {
      setError('두 비밀번호가 일치하지 않습니다.')
      confirmInput.current?.focus()
      return
    }
    busy.current = true
    setPending(true)
    setError('')
    setAcknowledged(false)
    const controller = new AbortController()
    operation.current = controller
    try {
      if (mode === 'forgot') {
        await forgot({ email }, controller.signal)
        if (!controller.signal.aborted) setAcknowledged(true)
      } else {
        await auth.resetPassword({ token, password }, controller.signal)
        if (!controller.signal.aborted) {
          setPassword('')
          setConfirmation('')
          setToken('')
          setComplete(true)
        }
      }
    } catch (failure) {
      if (!controller.signal.aborted) {
        if (mode === 'reset' && failure instanceof ApiError && failure.status === 400) {
          setToken('')
          setPassword('')
          setConfirmation('')
        } else {
          setError(errorMessage(failure))
        }
        if (failure instanceof ApiError && failure.status === 429)
          setDeadline(Date.now() + Math.max(1, failure.retryAfter) * 1000)
      }
    } finally {
      if (!controller.signal.aborted) {
        busy.current = false
        setPending(false)
      }
    }
  }

  const invalid = mode === 'reset' && !token && !complete
  return (
    <section className="account-layout">
      <aside className="account-intro">
        <p className="eyebrow">BODYGUARD / ACCOUNT RECOVERY</p>
        <h2>안전한 계정 복구</h2>
        <p>이메일의 일회용 링크로 재설정합니다.</p>
      </aside>
      <div className="account-form">
        <p className="eyebrow">계정 복구</p>
        <h1 ref={heading} tabIndex={-1}>
          {complete
            ? '비밀번호를 변경했습니다'
            : invalid
              ? '새 링크가 필요합니다'
              : mode === 'forgot'
                ? '비밀번호 재설정 요청'
                : '새 비밀번호 설정'}
        </h1>
        {complete ? (
          <>
            <p role="status">기존 로그인은 종료했습니다. 새 비밀번호로 로그인하세요.</p>
            <Link className="button primary wide" to="/login">
              로그인으로 돌아가기
            </Link>
          </>
        ) : invalid ? (
          <>
            <p role="alert">만료됐거나 사용할 수 없는 링크입니다. 새 안내를 요청하세요.</p>
            <Link className="button primary wide" to="/password/forgot">
              재설정 다시 요청
            </Link>
          </>
        ) : (
          <>
            <p className="muted">
              {mode === 'forgot'
                ? '가입한 이메일을 입력하세요. 가입 여부는 공개하지 않습니다.'
                : '15~128자 · 한글·공백 가능. 링크는 30분 내 1회만 사용합니다.'}
            </p>
            <form
              aria-busy={pending}
              onSubmit={(event) => {
                void submit(event)
              }}
            >
              {mode === 'forgot' ? (
                <label>
                  이메일
                  <input
                    type="email"
                    autoComplete="email"
                    required
                    maxLength={254}
                    value={email}
                    disabled={pending}
                    onChange={(event) => {
                      setEmail(event.target.value)
                      setAcknowledged(false)
                    }}
                  />
                </label>
              ) : (
                <>
                  <label htmlFor="new-password">새 비밀번호</label>
                  <div className="password-input">
                    <input
                      id="new-password"
                      ref={passwordInput}
                      name="password"
                      type={visible ? 'text' : 'password'}
                      autoComplete="new-password"
                      required
                      maxLength={256}
                      value={password}
                      disabled={pending}
                      onChange={(event) => setPassword(event.target.value)}
                    />
                    <button
                      className="text-button"
                      type="button"
                      aria-label={visible ? '비밀번호 숨기기' : '비밀번호 표시'}
                      aria-pressed={visible}
                      onClick={() => setVisible(!visible)}
                    >
                      {visible ? '숨기기' : '표시'}
                    </button>
                  </div>
                  <label>
                    새 비밀번호 확인
                    <input
                      ref={confirmInput}
                      type={visible ? 'text' : 'password'}
                      autoComplete="new-password"
                      required
                      maxLength={256}
                      value={confirmation}
                      disabled={pending}
                      onChange={(event) => setConfirmation(event.target.value)}
                    />
                  </label>
                </>
              )}
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
              {acknowledged && (
                <p className="form-notice" role="status">
                  요청을 접수했습니다. 등록된 이메일이면 안내를 받을 수 있습니다. 받지 못했다면
                  스팸함 확인 후 다시 요청하세요.
                </p>
              )}
              <button
                className="button primary wide"
                type="submit"
                disabled={pending || remaining > 0}
              >
                {pending
                  ? '처리 중…'
                  : mode === 'forgot'
                    ? acknowledged
                      ? '다시 요청하기'
                      : '재설정 요청'
                    : '비밀번호 변경'}
              </button>
              {remaining > 0 && (
                <p className="muted small" role="status">
                  다시 요청까지 {remaining}초
                </p>
              )}
            </form>
          </>
        )}
        {/* FR-U-03/NFR-08: essential notice stays visible when the aside is hidden. */}
        <p className="form-notice muted small">
          변경하면 기존 로그인은 모두 종료됩니다. 카메라는 켜지지 않습니다.
        </p>
        <p className="form-secondary">
          <Link to="/login">로그인</Link>
          {mode === 'reset' && !invalid && !complete && (
            <>
              {' · '}
              <Link to="/password/forgot">재설정 다시 요청</Link>
            </>
          )}
        </p>
        <Link className="back-link" to="/">
          서비스 소개로 돌아가기
        </Link>
      </div>
    </section>
  )
}
