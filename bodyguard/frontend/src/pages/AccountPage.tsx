// FR-U-01~04: credentials and challenges live only in this mounted form.
import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router'
import {
  ApiError,
  errorMessage,
  googleConfigured,
  resend,
  signup,
  validPassword,
} from '../api/auth'
import { useAuth } from '../auth'
import { loginDestination } from '../authDestination'
import './FigmaLogin.css'

const googleErrors: Record<string, string> = {
  cancelled: '구글 로그인을 취소했습니다. 다시 시작하거나 이메일로 계속해 주세요.',
  failed: '구글 로그인을 완료하지 못했습니다. 다시 시도해 주세요.',
  'account-conflict':
    '같은 이메일의 계정이 있습니다. 가입했던 기존 방식으로 로그인해 주세요. 계정은 자동으로 합치지 않습니다.',
  unavailable: '구글 연결을 확인하지 못했습니다. 이메일로 계속해 주세요.',
  'rate-limited': '구글 로그인 요청이 많습니다. 잠시 후 다시 시도해 주세요.',
}

export function AccountPage({ mode }: { mode: 'login' | 'signup' }) {
  const auth = useAuth()
  const [query] = useSearchParams()
  const destination = loginDestination(query)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [visible, setVisible] = useState(false)
  const [challenge, setChallenge] = useState('')
  const [code, setCode] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState(() => {
    const values = query.getAll('google')
    return values.length === 0
      ? ''
      : values.length === 1 && Object.hasOwn(googleErrors, values[0])
        ? googleErrors[values[0]]
        : googleErrors.failed
  })
  const [googleState, setGoogleState] = useState<
    'checking' | 'ready' | 'unavailable' | 'error' | 'leaving'
  >('checking')
  const [notice, setNotice] = useState('')
  const [deadline, setDeadline] = useState(0)
  const [remaining, setRemaining] = useState(0)
  const busy = useRef(false)
  const controller = useRef<AbortController | null>(null)
  const googleController = useRef<AbortController | null>(null)
  const codeInput = useRef<HTMLInputElement>(null)
  const passwordInput = useRef<HTMLInputElement>(null)
  const verify = Boolean(challenge)

  useEffect(() => () => controller.current?.abort(), [])
  const checkGoogle = useCallback(() => {
    googleController.current?.abort()
    const operation = new AbortController()
    googleController.current = operation
    setGoogleState('checking')
    void googleConfigured(operation.signal).then(
      (available) => {
        if (!operation.signal.aborted) setGoogleState(available ? 'ready' : 'unavailable')
      },
      () => {
        if (!operation.signal.aborted) setGoogleState('error')
      },
    )
  }, [])
  useEffect(() => {
    if (!verify) checkGoogle()
    return () => googleController.current?.abort()
  }, [verify, checkGoogle])
  useEffect(() => {
    const restore = (event: PageTransitionEvent) => {
      if (!event.persisted) return
      controller.current?.abort()
      busy.current = false
      setPending(false)
      checkGoogle()
    }
    window.addEventListener('pageshow', restore)
    return () => window.removeEventListener('pageshow', restore)
  }, [checkGoogle])
  useEffect(() => {
    const update = () => setRemaining(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)))
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [deadline])
  useEffect(() => {
    if (challenge) codeInput.current?.focus()
  }, [challenge])

  async function submit(event?: FormEvent<HTMLFormElement>, sendAgain = false) {
    event?.preventDefault()
    if (busy.current) return
    if (!verify && !sendAgain && !validPassword(password)) {
      setError('비밀번호는 15~128자로 입력해 주세요.')
      passwordInput.current?.focus()
      return
    }
    busy.current = true
    setPending(true)
    setError('')
    setNotice('')
    const operation = new AbortController()
    controller.current = operation
    try {
      if (sendAgain) {
        setCode('')
        await resend(challenge, operation.signal)
        setDeadline(Date.now() + 60_000)
        setNotice('새 코드를 보냈습니다. 이전 코드는 사용할 수 없습니다.')
      } else if (mode === 'signup' && !verify) {
        const result = await signup({ email, password }, operation.signal)
        setPassword('')
        setChallenge(result.challenge_id)
        setDeadline(Date.now() + 60_000)
      } else {
        await auth.signIn(
          verify ? 'verify' : 'login',
          verify ? { challenge_id: challenge, code } : { email, password },
          operation.signal,
        )
        setPassword('')
        setCode('')
      }
    } catch (failure) {
      if (!operation.signal.aborted) {
        setError(errorMessage(failure, verify))
        if (sendAgain)
          setNotice(
            '재발송이 확인되지 않았습니다. 이전 코드를 사용하지 말고 새 코드를 다시 받아 주세요.',
          )
        if (failure instanceof ApiError && failure.status === 429) {
          setDeadline(Date.now() + Math.max(1, failure.retryAfter) * 1000)
        }
      }
    } finally {
      if (!operation.signal.aborted) {
        setPending(false)
        busy.current = false
      }
    }
  }

  if (auth.state.status === 'ready')
    return (
      <Navigate
        to={
          mode === 'signup' && verify
            ? `/account/profile?${new URLSearchParams({ next: destination })}`
            : destination
        }
        replace
      />
    )
  const heading = verify ? '이메일을 확인해 주세요' : mode === 'signup' ? '회원가입' : '로그인'
  const googleOption = !verify && (
    <div className="google-option">
      <button
        type="button"
        className="button google-button wide"
        disabled={pending || googleState !== 'ready'}
        aria-describedby="google-feedback"
        onClick={() => {
          if (busy.current || googleState !== 'ready') return
          busy.current = true
          setPending(true)
          setError('')
          setGoogleState('leaving')
          window.location.assign('/api/v1/auth/google/login')
        }}
      >
        <span className="google-icon" aria-hidden="true">
          <img src="/brand/google-icon.png" alt="" width={40} height={40} />
        </span>
        Google로 계속하기
      </button>
      <p id="google-feedback" className="muted small google-feedback" role="status">
        {googleState === 'checking'
          ? '구글 연결을 확인하고 있습니다.'
          : googleState === 'leaving'
            ? '구글 로그인으로 이동합니다.'
            : googleState === 'unavailable'
              ? '구글 연결을 준비하고 있습니다. 이메일로 계속해 주세요.'
              : googleState === 'error'
                ? '구글 연결을 확인하지 못했습니다. 이메일로 계속할 수 있습니다.'
                : '구글 계정으로 로그인하거나 새 계정을 만듭니다.'}
      </p>
      {googleState === 'error' && (
        <button
          type="button"
          className="text-button google-retry"
          disabled={pending}
          onClick={checkGoogle}
        >
          구글 연결 다시 확인
        </button>
      )}
    </div>
  )
  return (
    <section className="account-layout figma-login">
      <div className="account-form">
        <Link className="figma-login-brand" to="/">
          BODYGUARD
        </Link>
        {mode !== 'login' && (
          <p className="eyebrow">
            {verify ? '이메일 인증 · 2 / 2' : mode === 'signup' ? '이메일 가입 · 1 / 2' : '로그인'}
          </p>
        )}
        <h1 tabIndex={-1}>{heading}</h1>
        {mode !== 'login' && (
          <p className="muted">
            {verify
              ? `${email}로 보낸 6자리 코드를 입력하세요. 코드는 10분간 유효합니다.`
              : mode === 'signup'
                ? '이메일 인증 후 계정이 만들어집니다.'
                : '이메일로 내 계정에 로그인하세요.'}
          </p>
        )}
        <form
          onSubmit={(event) => {
            void submit(event)
          }}
          aria-busy={pending}
        >
          {verify ? (
            <label>
              인증 코드
              <input
                ref={codeInput}
                value={code}
                onChange={(event) => setCode(event.target.value)}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                minLength={6}
                maxLength={6}
                required
                disabled={pending}
                aria-describedby="account-feedback"
              />
            </label>
          ) : (
            <>
              <label>
                이메일
                <input
                  type="email"
                  name="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  required
                  maxLength={254}
                  disabled={pending}
                />
              </label>
              <label htmlFor="account-password">비밀번호</label>
              <div className="password-input">
                <input
                  id="account-password"
                  ref={passwordInput}
                  name="password"
                  type={visible ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  required
                  maxLength={256}
                  disabled={pending}
                  aria-describedby={mode === 'signup' ? 'password-help' : undefined}
                />
                <button
                  type="button"
                  className="text-button"
                  aria-label={visible ? '비밀번호 숨기기' : '비밀번호 표시'}
                  aria-pressed={visible}
                  onClick={() => setVisible(!visible)}
                >
                  {visible ? '숨기기' : '표시'}
                </button>
              </div>
              {mode === 'signup' && (
                <p id="password-help" className="muted small">
                  15~128자. 공백과 한글을 사용할 수 있습니다.
                </p>
              )}
            </>
          )}
          <div id="account-feedback">
            {error && (
              <p role="alert" className="form-error">
                {error}
              </p>
            )}
            {notice && (
              <p role="status" className="form-notice">
                {notice}
              </p>
            )}
          </div>
          <button
            className="button primary wide"
            type="submit"
            disabled={pending || (remaining > 0 && !verify)}
          >
            {pending
              ? '처리 중…'
              : verify
                ? '인증하고 시작하기'
                : mode === 'signup'
                  ? '인증 코드 받기'
                  : '로그인'}
          </button>
          {!verify && remaining > 0 && (
            <p className="muted small" role="status">
              다시 요청까지 {remaining}초
            </p>
          )}
        </form>
        {verify ? (
          <div className="form-secondary">
            <button
              className="button secondary wide"
              type="button"
              disabled={pending || remaining > 0}
              onClick={() => {
                void submit(undefined, true)
              }}
            >
              {remaining > 0 ? `재발송까지 ${remaining}초` : '인증 코드 다시 받기'}
            </button>
            <button
              className="text-button"
              type="button"
              disabled={pending}
              onClick={() => {
                setChallenge('')
                setCode('')
                setError('')
                setNotice('')
                setDeadline(0)
              }}
            >
              이메일 변경·가입 다시 시작
            </button>
          </div>
        ) : mode === 'signup' ? (
          <p className="form-secondary">
            이미 계정이 있나요?{' '}
            <Link to={'/login?' + new URLSearchParams({ next: destination }).toString()}>
              로그인
            </Link>
          </p>
        ) : (
          <div className="figma-login-links">
            <Link to="/password/forgot">비밀번호 찾기</Link>
            <Link to={'/signup?' + new URLSearchParams({ next: destination }).toString()}>
              회원가입
            </Link>
          </div>
        )}
        {googleOption}
        <Link className="back-link" to="/">
          서비스 소개로 돌아가기
        </Link>
        {mode === 'signup' && (
          <Link className="back-link" to="/data">
            카메라·데이터 안내
          </Link>
        )}
      </div>
    </section>
  )
}
