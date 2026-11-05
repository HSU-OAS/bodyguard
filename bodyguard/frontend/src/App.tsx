import { lazy, type ReactNode, Suspense, useEffect, useRef } from 'react'
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from 'react-router'
import { AuthProvider, useAuth } from './auth'
import { personalDestination } from './authDestination'
import { AccountPage } from './pages/AccountPage'
import { DataPage, HelpPage } from './pages/DataHelpPage'
import { ExplorePage } from './pages/ExplorePage'
import { MemberPage } from './pages/MemberPage'
import { MinuteSummaryPage } from './pages/MinuteSummaryPage'
import { NotificationPreferencesPage } from './pages/NotificationPreferencesPage'
import { PasswordPage } from './pages/PasswordPage'
import { RecordsPage } from './pages/RecordsPage'
import { WithdrawalPage } from './pages/WithdrawalPage'

// FR-V-02/03: prototype camera/debug UI is compiled out of production.
const Demo = import.meta.env.DEV
  ? lazy(() =>
      import('./pages/MeasureDemoPage').then((module) => ({ default: module.MeasureDemoPage })),
    )
  : null

// FR-S-01/06: unvalidated candidates remain protected and development-only.
const MotionSelection = import.meta.env.DEV
  ? lazy(() =>
      import('./pages/MotionSelectionPage').then((module) => ({
        default: module.MotionSelectionPage,
      })),
    )
  : null

// FR-V-03: approved structure is not public coaching before asset/motion gates.
const Coaching = import.meta.env.DEV
  ? lazy(() => import('./pages/CoachingPage').then((module) => ({ default: module.CoachingPage })))
  : null

// FR-S-06/FR-V-03: Figma layout review remains separate from the public service.
const FigmaHome = import.meta.env.DEV
  ? lazy(() =>
      import('./pages/FigmaHomePage').then((module) => ({ default: module.FigmaHomePage })),
    )
  : null

function SessionGate({ children }: { children?: ReactNode }) {
  const { state, refresh, signOut } = useAuth()
  const location = useLocation()
  if (state.status === 'guest') {
    const next = personalDestination(location.pathname + location.search) ?? '/start'
    return <Navigate to={`/login?${new URLSearchParams({ next }).toString()}`} replace />
  }
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
          {state.status === 'logging-out'
            ? '로그아웃 중입니다'
            : state.status === 'withdrawing'
              ? '탈퇴 결과를 확인하고 있습니다'
              : '계정을 확인하고 있습니다'}
        </h1>
        <p>잠시만 기다려 주세요.</p>
      </section>
    )
  if (children) return children
  return (
    <section className="start-screen">
      <p className="eyebrow">MY BODYGUARD</p>
      <h1 tabIndex={-1}>내 몸을 위한 시작</h1>
      <p className="muted account-email">{state.user.email}</p>
      <Link className="button primary" to="/explore">
        스트레칭 시작 경로 선택
      </Link>
      <p>
        <Link className="back-link" to="/records">
          내 수행 기록 확인
        </Link>
      </p>
      <p>
        <Link className="back-link" to="/posture-records">
          내 자세 기록 확인
        </Link>
      </p>
      <p>
        <Link className="back-link" to="/account">
          계정 관리
        </Link>
      </p>
      <div className="development-note">
        <h2>첫 코칭 흐름을 준비하고 있습니다</h2>
        <p>
          동작 검증과 남녀 3D 아바타 제작이 끝나면 스트레칭 선택과 코칭을 이곳에 연결합니다. 지금은
          계정 기능을 사용할 수 있습니다.
        </p>
        <p className="small muted">카메라는 켜지지 않았습니다.</p>
        {MotionSelection && (
          <Link className="back-link" to="/dev/select">
            동작 선택 개발 검수
          </Link>
        )}
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
  // FR-V-02/FR-U-04: match Router's case/trailing-slash pages, never rewrite URL/token.
  const pagePath = location.pathname.replace(/\/+$/, '').toLowerCase() || '/'
  const previousFocus = useRef<{ path: string; phase: string | null } | null>(null)
  // FR-U-04 / release-plan4·6: these protected titles change after account checking.
  // Public forms and pages with their own focus policy must not react to auth alone.
  const focusState = /^\/(?:start|explore|account)\/*$/i.test(location.pathname)
    ? state.status
    : null
  useEffect(() => {
    const navigated = previousFocus.current?.path !== location.pathname
    const phaseChanged = previousFocus.current?.phase !== focusState
    previousFocus.current = { path: location.pathname, phase: focusState }
    // NFR-08: selection/records pages own their asynchronous title and focus.
    if (
      (MotionSelection && pagePath === '/dev/select') ||
      (Coaching && pagePath === '/dev/coaching') ||
      pagePath === '/account/delete' ||
      pagePath === '/account/notifications' ||
      pagePath === '/posture-records' ||
      /^\/records(?:\/[^/]+)?$/.test(pagePath)
    )
      return
    const heading = document.querySelector<HTMLElement>('main h1')
    const active = document.activeElement
    // Restore a removed/loading target, but preserve a live user-selected control.
    // NFR-08: never activate an unfocused window and cause another /me refresh.
    if (
      document.hasFocus() &&
      (navigated ||
        (phaseChanged &&
          (active === document.body || active === document.documentElement || active === heading)))
    )
      heading?.focus({ preventScroll: true })
    document.title = `${
      pagePath === '/'
        ? '서비스 소개'
        : pagePath === '/login'
          ? '로그인'
          : pagePath === '/signup'
            ? '이메일 가입'
            : pagePath === '/password/forgot' || pagePath === '/password/reset'
              ? '계정 복구'
              : pagePath === '/explore'
                ? '스트레칭 시작 경로'
                : pagePath === '/start'
                  ? '내 시작'
                  : pagePath === '/account'
                    ? '내 계정'
                    : pagePath === '/help'
                      ? '도움말'
                      : pagePath === '/data'
                        ? '카메라와 데이터 안내'
                        : '페이지를 찾을 수 없습니다'
    } · BODYGUARD`
  }, [location.pathname, pagePath, focusState])
  return (
    <div className={`website${Coaching && pagePath === '/dev/coaching' ? ' coaching-layout' : ''}`}>
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
            <>
              <Link
                className="nav-link"
                to="/start"
                aria-current={pagePath === '/start' ? 'page' : undefined}
              >
                내 시작
              </Link>
              <Link
                className="nav-link"
                to="/posture-records"
                aria-current={pagePath === '/posture-records' ? 'page' : undefined}
              >
                자세 기록
              </Link>
              <Link
                className="nav-link"
                to="/records"
                aria-current={/^\/records(?:\/[^/]+)?$/.test(pagePath) ? 'page' : undefined}
              >
                수행 기록
              </Link>
              <Link
                className="nav-link"
                to="/account"
                aria-current={
                  /^\/account(?:\/(?:delete|notifications))?$/.test(pagePath) ? 'page' : undefined
                }
              >
                내 계정
              </Link>
            </>
          ) : state.status === 'checking' ||
            state.status === 'logging-out' ||
            state.status === 'withdrawing' ? (
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
          <Route path="/help" element={<HelpPage />} />
          <Route path="/data" element={<DataPage />} />
          <Route path="/login" element={<AccountPage key="login" mode="login" />} />
          <Route path="/signup" element={<AccountPage key="signup" mode="signup" />} />
          <Route path="/password/forgot" element={<PasswordPage key="forgot" mode="forgot" />} />
          <Route path="/password/reset" element={<PasswordPage key="reset" mode="reset" />} />
          <Route path="/start" element={<SessionGate />} />
          <Route
            path="/account"
            element={
              <SessionGate>
                <MemberPage />
              </SessionGate>
            }
          />
          {/* FR-U-05: do not unmount the confirmation request when private UI closes. */}
          <Route
            path="/account/notifications"
            element={
              <SessionGate>
                <NotificationPreferencesPage />
              </SessionGate>
            }
          />
          <Route path="/account/delete" element={<WithdrawalPage />} />
          <Route
            path="/records"
            element={
              <SessionGate>
                <RecordsPage />
              </SessionGate>
            }
          />
          <Route
            path="/posture-records"
            element={
              <SessionGate>
                <MinuteSummaryPage />
              </SessionGate>
            }
          />
          <Route
            path="/records/:recordId"
            element={
              <SessionGate>
                <RecordsPage />
              </SessionGate>
            }
          />
          <Route
            path="/explore"
            element={
              <SessionGate>
                <ExplorePage reviewCamera={import.meta.env.DEV} />
              </SessionGate>
            }
          />
          {MotionSelection && (
            <Route
              path="/dev/select"
              element={
                <SessionGate>
                  <Suspense fallback={<p role="status">동작 안내를 여는 중입니다</p>}>
                    <MotionSelection />
                  </Suspense>
                </SessionGate>
              }
            />
          )}
          {Coaching && (
            <Route
              path="/dev/coaching"
              element={
                <SessionGate>
                  <Suspense fallback={<p role="status">코칭 화면을 여는 중입니다</p>}>
                    <Coaching />
                  </Suspense>
                </SessionGate>
              }
            />
          )}
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
        <nav aria-label="서비스 안내">
          <Link
            className="footer-link"
            to="/help"
            aria-current={pagePath === '/help' ? 'page' : undefined}
          >
            도움말
          </Link>
          <Link
            className="footer-link"
            to="/data"
            aria-current={pagePath === '/data' ? 'page' : undefined}
          >
            카메라·데이터 안내
          </Link>
        </nav>
      </footer>
    </div>
  )
}

// FR-M-01·07 라우트 이탈은 측정 화면을 실제로 해제하여 카메라를 끈다.
function AppContent() {
  const location = useLocation()
  if (FigmaHome && location.pathname === '/dev/figma-home')
    return (
      <Suspense fallback={<p role="status">화면을 여는 중입니다</p>}>
        <FigmaHome />
      </Suspense>
    )
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
