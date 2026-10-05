// FR-U-04/05/FR-N-03: real account/settings; unfinished coaching is not advertised.
import { Link } from 'react-router'
import { useAuth } from '../auth'

export function MemberPage() {
  const { state, signOut } = useAuth()
  if (state.status !== 'ready') return null
  return (
    <section className="member-screen">
      <p className="eyebrow">MY ACCOUNT</p>
      <h1 tabIndex={-1}>내 계정</h1>
      <p className="muted member-lead">로그인 정보와 수행 기록을 관리합니다.</p>
      <section className="member-section" aria-labelledby="member-login">
        <h2 id="member-login">로그인 정보</h2>
        <dl className="member-details">
          <dt>확인된 이메일</dt>
          <dd>{state.user.email}</dd>
        </dl>
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
      <section className="member-section" aria-labelledby="member-records">
        <h2 id="member-records">수행 기록</h2>
        <p>기간별 기록을 확인하고, 선택한 기간의 기록을 삭제할 수 있습니다.</p>
        <Link className="button primary" to="/records">
          수행 기록 관리
        </Link>
      </section>
      <section className="member-section" aria-labelledby="member-notifications">
        <h2 id="member-notifications">알림 설정</h2>
        <p>알림 시간과 소리 설정을 계정에 저장합니다. 실제 알림 연결은 준비 중입니다.</p>
        <Link className="button secondary" to="/account/notifications">
          알림 설정 관리
        </Link>
      </section>
      <section className="member-section" aria-labelledby="member-withdrawal">
        <h2 id="member-withdrawal">회원 탈퇴</h2>
        <p>계정과 수행 기록을 삭제합니다. 먼저 삭제 범위와 본인 확인 절차를 확인해 주세요.</p>
        <Link className="button secondary" to="/account/delete">
          회원 탈퇴 안내
        </Link>
      </section>
    </section>
  )
}
