import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from 'react-router'
import { AuthProvider, useAuth } from './auth'
import { AccountPage } from './pages/AccountPage'
import { PasswordPage } from './pages/PasswordPage'

// FR-V-02/03: prototype camera/debug UI is compiled out of production.
const Demo = import.meta.env.DEV
  ? lazy(() =>
      import('./pages/MeasureDemoPage').then((module) => ({ default: module.MeasureDemoPage })),
    )
  : null

function SessionGate() {
  const { state, refresh, signOut } = useAuth()
  if (state.status === 'guest') return <Navigate to="/login?next=%2Fstart" replace />
  if (state.status === 'offline' || state.status === 'logout-error')
    return (
      <section className="status-screen">
        <p className="eyebrow">계정 연결</p>
        <h1 tabIndex={-1}>
          {state.status === 'logout-error'
            ? '로그아웃을 확인하지 못했습니다'
            : '연결을 확인해 주세요'}
        </h1>
        <p role="alert">
          {state.status === 'logout-error'
            ? '개인 화면은 닫았습니다. 서버 연결을 확인하고 로그아웃을 다시 시도해 주세요.'
            : '계정 상태를 확인할 수 없어 개인 화면을 열지 않았습니다.'}
        </p>
        <button
          className="button primary"
          type="button"
          onClick={() => {
            void (state.status === 'logout-error' ? signOut() : refresh())
          }}
        >
          {state.status === 'logout-error' ? '로그아웃 다시 시도' : '다시 확인'}
        </button>
      </section>
    )
  if (state.status !== 'ready')
    return (
      <section className="status-screen" role="status">
        <h1 tabIndex={-1}>
          {state.status === 'logging-out' ? '로그아웃 중입니다' : '계정을 확인하고 있습니다'}
        </h1>
        <p>잠시만 기다려 주세요.</p>
      </section>
    )
  return (
    <section className="start-screen">
      <p className="eyebrow">MY BODYGUARD</p>
      <h1 tabIndex={-1}>내 몸을 위한 시작</h1>
      <p className="muted account-email">{state.user.email}</p>
      <div className="development-note">
        <h2>첫 코칭 흐름을 준비하고 있습니다</h2>
        <p>
          동작 검증과 남녀 3D 아바타 제작이 끝나면 스트레칭 선택과 코칭을 이곳에 연결합니다. 지금은
          계정 기능을 사용할 수 있습니다.
        </p>
        <p className="small muted">카메라는 켜지지 않았습니다.</p>
      </div>
      <button
        className="button secondary"
        type="button"
        onClick={() => {
          void signOut()
        }}
      >
        로그아웃
      </button>
    </section>
  )
}

function Home() {
  return (
    <>
      <section className="hero">
        <p className="eyebrow">PERSONAL STRETCHING & POSTURE CARE</p>
        <h1 tabIndex={-1}>
          내 몸을 이해하는
          <br />
          스트레칭
        </h1>
        <p className="hero-description">
          내 움직임을 살피고, 더 바르게 움직이는 시간.
          <br />
          노트북 웹캠 한 대로 시작하는 자세 코칭.
        </p>
        <Link className="button primary" to="/start">
          시작하기 <span aria-hidden="true">↗</span>
        </Link>
        <p className="muted small">출시 준비 중 · 계정 기능부터 순차적으로 연결하고 있습니다.</p>
      </section>
      <section className="how-it-works" aria-labelledby="how-heading">
        <div>
          <p className="eyebrow">HOW IT WORKS</p>
          <h2 id="how-heading">
            하나의 화면에서,
            <br />내 몸에 집중하도록.
          </h2>
        </div>
        <ol>
          <li>
            <span className="section-number">01</span>
            <div>
              <h3>필요한 스트레칭 선택</h3>
              <p>신체 확인에 따른 추천, 또는 원하는 동작을 직접 선택합니다.</p>
            </div>
          </li>
          <li>
            <span className="section-number">02</span>
            <div>
              <h3>두 아바타로 동작 비교</h3>
              <p>기준 동작과 내 움직임을 함께 보며 수행 과정을 따라갑니다.</p>
            </div>
          </li>
          <li>
            <span className="section-number">03</span>
            <div>
              <h3>수행 안내와 기록</h3>
              <p>관찰 가능한 자세의 피드백을 받고 수행 기록을 확인합니다.</p>
            </div>
          </li>
        </ol>
      </section>
      <section className="care-note">
        <h2>편안한 범위에서, 안전하게.</h2>
        <p>
          BODYGUARD는 질환을 진단하거나 치료를 대신하지 않습니다. 통증이나 불편함이 있다면 수행을
          멈추세요.
        </p>
        <p className="muted">
          카메라는 직접 시작할 때만 켜집니다. 원본 영상은 저장하거나 전송하지 않습니다.
        </p>
      </section>
    </>
  )
}

function Shell() {
  const { state } = useAuth()
  const location = useLocation()
  useEffect(() => {
    document.querySelector<HTMLElement>('main h1')?.focus({ preventScroll: true })
    document.title = `${
      location.pathname === '/login'
        ? '로그인'
        : location.pathname === '/signup'
          ? '이메일 가입'
          : location.pathname.startsWith('/password/')
            ? '계정 복구'
            : location.pathname === '/start'
              ? '내 시작'
              : '자세 코칭'
    } · BODYGUARD`
  }, [location.pathname])
  return (
    <div className="website">
      <button
        className="skip-link"
        type="button"
        onClick={() => {
          // FR-U-03/NFR-08: focus the page without overwriting recovery fragments.
          document.getElementById('content')?.focus()
        }}
      >
        본문으로 이동
      </button>
      <header className="site-header">
        <Link className="wordmark" to="/" aria-label="BODYGUARD 서비스 소개">
          BODYGUARD<span aria-hidden="true">.</span>
        </Link>
        <nav aria-label="계정 메뉴">
          {state.status === 'ready' ? (
            <Link className="nav-link" to="/start">
              내 시작
            </Link>
          ) : state.status === 'checking' || state.status === 'logging-out' ? (
            <span className="muted small" role="status">
              계정 확인 중
            </span>
          ) : (
            <Link className="nav-link" to="/login">
              로그인
            </Link>
          )}
        </nav>
      </header>
      <main id="content" tabIndex={-1}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<AccountPage key="login" mode="login" />} />
          <Route path="/signup" element={<AccountPage key="signup" mode="signup" />} />
          <Route path="/password/forgot" element={<PasswordPage key="forgot" mode="forgot" />} />
          <Route path="/password/reset" element={<PasswordPage key="reset" mode="reset" />} />
          <Route path="/start" element={<SessionGate />} />
          <Route
            path="*"
            element={
              <section className="status-screen">
                <h1 tabIndex={-1}>페이지를 찾을 수 없습니다</h1>
                <Link className="button secondary" to="/">
                  서비스 소개로 돌아가기
                </Link>
              </section>
            }
          />
        </Routes>
      </main>
      <footer className="site-footer">
        <span>BODYGUARD</span>
        <p>일상을 위한 스트레칭과 자세 코칭 · 출시 준비 중</p>
      </footer>
    </div>
  )
}

// FR-M-01·07 라우트 이탈은 측정 화면을 실제로 해제하여 카메라를 끈다.
function AppContent() {
  const location = useLocation()
  return Demo && location.pathname === '/dev/measure' ? (
    <Suspense fallback={<p role="status">개발 도구를 여는 중입니다</p>}>
      <Demo />
    </Suspense>
  ) : (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  )
}

export function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  )
}
