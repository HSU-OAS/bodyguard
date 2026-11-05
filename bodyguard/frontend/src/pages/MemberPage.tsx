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
      <section className="member-section" aria-labelledby="member-profile">
        <h2 id="member-profile">기본 정보</h2>
        <p>선택한 기본 정보를 확인하거나 수정·삭제합니다.</p>
        <Link className="button secondary" to="/account/profile">
          기본 정보 관리
        </Link>
      </section>
      <section className="member-section" aria-labelledby="member-records">
        <h2 id="member-records">수행 기록</h2>
        <p>기간별로 조회·삭제합니다.</p>
        <Link className="button primary" to="/records">
          수행 기록 관리
        </Link>
      </section>
      <section className="member-section" aria-labelledby="member-posture-records">
        <h2 id="member-posture-records">자세 기록</h2>
        <p>1분별 측정 시간·부위별 편차 조회와 기간별 삭제.</p>
        <Link className="button secondary" to="/posture-records">
          자세 기록 관리
        </Link>
      </section>
      <section className="member-section" aria-labelledby="member-notifications">
        <h2 id="member-notifications">알림 설정</h2>
        <p>시간·소리를 저장합니다. 실제 알림은 연결 전입니다.</p>
        <Link className="button secondary" to="/account/notifications">
          알림 설정 관리
        </Link>
      </section>
      <section className="member-section" aria-labelledby="member-withdrawal">
        <h2 id="member-withdrawal">회원 탈퇴</h2>
        <p>본인 확인 후 계정과 기본 정보·자세·수행 기록을 삭제합니다.</p>
        <Link className="button secondary" to="/account/delete">
          회원 탈퇴 안내
        </Link>
      </section>
    </section>
  )
}
