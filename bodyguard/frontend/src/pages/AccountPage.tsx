// FR-U-02/03: credentials and challenges live only in this mounted form.
import { type FormEvent, useEffect, useRef, useState } from 'react'
import { Link, Navigate } from 'react-router'
import { ApiError, errorMessage, resend, signup, validPassword } from '../api/auth'
import { useAuth } from '../auth'

export function AccountPage({ mode }: { mode: 'login' | 'signup' }) {
  const auth = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [visible, setVisible] = useState(false)
  const [challenge, setChallenge] = useState('')
  const [code, setCode] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [deadline, setDeadline] = useState(0)
  const [remaining, setRemaining] = useState(0)
  const busy = useRef(false)
  const controller = useRef<AbortController | null>(null)
  const codeInput = useRef<HTMLInputElement>(null)
  const passwordInput = useRef<HTMLInputElement>(null)
  const verify = Boolean(challenge)

  useEffect(() => () => controller.current?.abort(), [])
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

  if (auth.state.status === 'ready') return <Navigate to="/start" replace />
  const heading = verify
    ? '이메일을 확인해 주세요'
    : mode === 'signup'
      ? '나를 위한 움직임의 시작'
      : '다시 만나 반갑습니다'
  return (
    <section className="account-layout">
      <aside className="account-intro">
        <p className="eyebrow">BODYGUARD / MY ACCOUNT</p>
        <h2>
          일상에 맞춘
          <br />몸 돌보기.
        </h2>
        <p>
          노트북 웹캠 한 대로 시작하는
          <br />
          스트레칭과 자세 코칭.
        </p>
        <div className="privacy-note">
          <span className="section-number">01</span>
          <p>
            카메라는 직접 시작할 때만 켜집니다.
            <br />
            원본 영상은 저장하거나 전송하지 않습니다.
          </p>
        </div>
        <p className="muted small">
          현재 개발 중인 웹입니다.
          <br />
          출시 전 기능·안전·개인정보 검증을 진행하고 있습니다.
        </p>
      </aside>
      <div className="account-form">
        <p className="eyebrow">
          {verify ? '이메일 인증 · 2 / 2' : mode === 'signup' ? '이메일 가입 · 1 / 2' : '로그인'}
        </p>
        <h1 tabIndex={-1}>{heading}</h1>
        <p className="muted">
          {verify
            ? `${email}로 보낸 6자리 코드를 입력하세요. 코드는 10분간 유효합니다.`
            : mode === 'signup'
              ? '이메일 인증 후 계정이 만들어집니다.'
              : '이메일로 내 계정에 로그인하세요.'}
        </p>
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
        ) : (
          <p className="form-secondary">
            {mode === 'signup' ? '이미 계정이 있나요?' : '처음 오셨나요?'}{' '}
            <Link to={mode === 'signup' ? '/login?next=%2Fstart' : '/signup?next=%2Fstart'}>
              {mode === 'signup' ? '로그인' : '이메일로 가입'}
            </Link>
          </p>
        )}
        {mode === 'login' && (
          <p className="form-secondary">
            <Link to="/password/forgot">비밀번호를 잊으셨나요?</Link>
          </p>
        )}
        <Link className="back-link" to="/">
          서비스 소개로 돌아가기
        </Link>
      </div>
    </section>
  )
}
