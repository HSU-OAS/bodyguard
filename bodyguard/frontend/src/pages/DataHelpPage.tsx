// FR-V-01/FR-U-04/05: factual public help, not a legal policy or new data collection.
import { Link } from 'react-router'
import './DataHelpPage.css'

export function HelpPage() {
  return (
    <article className="guide-screen">
      <header className="guide-intro">
        <p className="eyebrow">BODYGUARD GUIDE</p>
        <h1 tabIndex={-1}>도움말</h1>
        <p>계정 이용부터 기록 관리까지, 필요한 안내를 확인하세요.</p>
      </header>
      <section className="guide-section" aria-labelledby="help-account">
        <h2 id="help-account">계정 이용</h2>
        <p>이메일로 가입하고 로그인할 수 있습니다. 비밀번호를 잊었다면 계정 복구를 이용하세요.</p>
        <div className="guide-actions">
          <Link className="button primary" to="/signup">
            이메일 가입
          </Link>
          <Link className="button secondary" to="/password/forgot">
            계정 복구
          </Link>
        </div>
        <p className="guide-caption">Google 로그인은 외부 서비스 연결을 준비하고 있습니다.</p>
      </section>
      <section className="guide-section" aria-labelledby="help-management">
        <h2 id="help-management">내 기록과 계정 관리</h2>
        <p>
          수행 기록에서 기간별 조회와 삭제를, 내 계정에서 로그아웃과 탈퇴를 진행할 수 있습니다. 개인
          화면은 로그인 후 이용합니다.
        </p>
        <div className="guide-actions">
          <Link className="button secondary" to="/records">
            수행 기록 관리
          </Link>
          <Link className="button secondary" to="/account">
            계정 관리·탈퇴
          </Link>
        </div>
      </section>
      <section className="guide-section guide-faq" aria-labelledby="help-questions">
        <h2 id="help-questions">자주 묻는 질문</h2>
        <details>
          <summary>카메라가 자동으로 켜지나요?</summary>
          <p>
            아닙니다. 이 안내와 계정·기록 화면은 카메라를 켜지 않습니다. 코칭 연결 후에도 사용자가
            시작하고 브라우저 권한을 허용할 때만 사용하도록 설계합니다.
          </p>
        </details>
        <details>
          <summary>지금 스트레칭 코칭을 사용할 수 있나요?</summary>
          <p>
            아직 연결 전입니다. 동작 검증과 남녀 3D 아바타 통합을 준비하고 있습니다. 현재 이용
            가능한 코칭 동작은 없으며, 기록 관리 기능이 자세의 정확성을 보증하지는 않습니다.
          </p>
        </details>
        <details>
          <summary>기록 삭제와 계정 탈퇴는 어떻게 다른가요?</summary>
          <p>
            기록 삭제는 선택한 기간의 수행 기록만 지우고 계정은 유지합니다. 탈퇴는 별도 이메일 본인
            확인과 최종 확인 후 계정과 연결된 수행 기록을 삭제하고 해당 계정의 로그인 세션을
            종료합니다.
          </p>
        </details>
        <details>
          <summary>삭제 중 연결이 끊겼다면 어떻게 하나요?</summary>
          <p>
            완료 여부를 추측하거나 자동으로 다시 삭제하지 않습니다. 화면 안내에 따라 연결과 계정
            상태, 기록을 다시 확인한 뒤 필요한 경우 새 확인 절차를 진행하세요.
          </p>
        </details>
        <details>
          <summary>계정에 연결되지 않아도 안내를 읽을 수 있나요?</summary>
          <p>
            네. 도움말과 카메라·데이터 안내는 로그인 없이 읽을 수 있습니다. 계정 연결에 실패하면
            개인 화면은 열리지 않으며, 해당 화면에서 다시 확인할 수 있습니다.
          </p>
        </details>
      </section>
      <aside className="guide-note">
        <h2>카메라와 데이터가 궁금하다면</h2>
        <p>현재 처리하는 정보의 종류와 관리 방법을 별도로 정리했습니다.</p>
        <Link className="guide-link" to="/data">
          카메라·데이터 안내 보기
        </Link>
      </aside>
    </article>
  )
}

export function DataPage() {
  return (
    <article className="guide-screen">
      <header className="guide-intro">
        <p className="eyebrow">CAMERA & DATA</p>
        <h1 tabIndex={-1}>카메라와 데이터 안내</h1>
        <p>어떤 정보를 다루고, 어디서 관리할 수 있는지 안내합니다.</p>
      </header>
      <section className="guide-section" aria-labelledby="data-camera">
        <h2 id="data-camera">카메라와 내 움직임</h2>
        <p>
          <strong>현재 카메라 코칭은 연결 전입니다.</strong>
        </p>
        <p>
          이 안내와 계정·기록 화면은 카메라 권한을 요청하지 않습니다. 코칭은 사용자가 직접 시작할
          때만 카메라를 사용하고, 신체 움직임을 브라우저 안에서 처리하도록 설계합니다. 원본 영상과
          관절 좌표는 서버에 보내거나 저장하지 않는 기준을 유지합니다.
        </p>
      </section>
      <section className="guide-section" aria-labelledby="data-server">
        <h2 id="data-server">현재 서버에서 다루는 정보</h2>
        <dl className="guide-data-list">
          <div>
            <dt>계정 정보</dt>
            <dd>
              이메일 주소, 계정 식별값과 생성·인증 정보입니다. 이메일 가입의 비밀번호는 원문이 아닌
              해시로 저장합니다. Google 계정 식별정보를 위한 구조도 있으며 실제 연결은 준비
              중입니다.
            </dd>
          </div>
          <div>
            <dt>선택한 기본 정보</dt>
            <dd>
              입력한 닉네임·나이·키·몸무게·성별을 계정에 저장합니다. 자세 판정이나 진단에 사용하지
              않으며 외부 서비스에 전송하지 않습니다. 기본 정보 화면에서 수정·삭제할 수 있습니다.
            </dd>
          </div>
          <div>
            <dt>로그인·인증 보안 정보</dt>
            <dd>
              로그인 세션, 가입·복구·탈퇴 확인값과 만료·시도 정보, 과도한 인증 요청을 제한하는
              해시된 식별값과 횟수입니다. 이메일 인증과 복구·탈퇴 확인을 위해 입력한 이메일 주소로
              안내를 보내는 기능이 있습니다. 실제 메일 제공사 연결은 준비 중입니다.
            </dd>
          </div>
          <div>
            <dt>수행 요약</dt>
            <dd>
              클라이언트가 보고한 동작·기준 버전, 시작·종료 시각, 완료·중단·건너뛰기, 관찰 시간과
              반복 횟수입니다. 영상이나 관절 좌표가 아닙니다. 실제 코칭의 기록 생성은 아직 연결
              전입니다.
            </dd>
          </div>
        </dl>
      </section>
      <section className="guide-section" aria-labelledby="data-management">
        <h2 id="data-management">내 정보 관리</h2>
        <p>
          기본 정보에서 입력값을 삭제할 수 있으며 충돌 방지용 수정 번호는 탈퇴 전까지 유지됩니다.
          수행 기록에서 삭제할 기간과 대상 수를 먼저 확인할 수 있습니다. 계정 탈퇴는 내 계정에서
          별도의 본인 확인을 거쳐 진행합니다. 삭제 후에는 되돌릴 수 없습니다.
        </p>
        <div className="guide-actions">
          <Link className="button primary" to="/records">
            수행 기록 관리
          </Link>
          <Link className="button secondary" to="/account">
            계정 관리·탈퇴
          </Link>
        </div>
        <p className="guide-caption">
          탈퇴 후에도 공용 접속 경로의 과도한 인증 요청을 제한하는 정보는 즉시 모두 삭제되지
          않습니다. 운영 백업과 보관 기간은 별도로 확정해야 하므로 모든 정보의 즉시 삭제를 약속하지
          않습니다.
        </p>
      </section>
      <aside className="guide-note">
        <h2>출시 전 확정할 안내</h2>
        <p>
          이 페이지는 현재 기술적 처리와 관리 방법을 설명하며, 법정 개인정보 처리방침이나 동의
          절차를 대신하지 않습니다. 사업자·연락처, 보관·백업 정책과 외부 서비스 안내는 출시 전에
          확정합니다.
        </p>
        <Link className="guide-link" to="/help">
          이용 도움말 보기
        </Link>
      </aside>
    </article>
  )
}
