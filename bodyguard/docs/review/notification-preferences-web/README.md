# 내 계정 → 알림 설정 웹 검증

2026-10-06 · S4.N2 · 최신 main e4265f5 통합 · 최종 실제 production Chrome154/HTTP/PostgreSQL18

## 실제 작동하는 흐름

- 이메일 가입·인증 → 내 계정 → 알림 설정. 서버의5필드를 조회하고 명시 저장한 뒤 새로고침해7분/60분·끄기·소리를 그대로 확인했다. 설정만 저장하며 실제 알림/소리/카메라를 실행하지 않는다.
- 서버가13분 저장을 실제 수락한 뒤 응답을 끊었다. 성공 문구0·편집 잠금·자동 POST 반복0이며 명시 재조회가 실제 저장값13분으로 복구했다.
- 기존 A 폼을 둔 채 실제 쿠키를 B로 바꾸었다. 과거 캡처 proof의 POST403, B 기본값/본인 설정 보존, A 재로그인 후 원래11분 보존을 확인했다. 서버 owner/Origin/CSRF 경계를 바꾸지 않았다.
- loading/읽기 실패/명시 재조회·잘못된 시간 오류 요약 초점·inline 연결·POST0, 키보드 Enter/Tab·그룹 이름·실제 입력48px/초점3px/버튼8px·계산 대비·1440/920px 노트북·CSS200% 확대·reduced-motion/light 유지·가로 overflow0을 확인했다.

## 최종 검증과 구분

전체 frontend590/실패0(이번 API client18+실제 DOM14), 타입·Biome128파일·build/production guard, 실제 API321/실패0(88.20초, 기존 asyncio/pydantic 경고2), Ruff·format35파일·mypy9모듈을 통과했다. 최종 Chrome4/실패0·skip0·retry0, 직전 진단 태그 제거 실행4/실패0을 확인했다. 최종 screenshot9개와 실제/합성 경계는 manifest에 보존한다. 메일/장애는 합성이며 실제 SMTP·참여자·운동·알림 작동·노트북 성능 합격·HTTPS·운영 검증이 아니다.

## 실패 보존 / 보완

최초 actual DOM red12건을 보존했다. 초기29건 중1건은 happy-dom의 fieldset 상속 disabled 검사 차이였으며 DOM은 실제 fieldset.disabled를 확인하고 Chrome은 실제 자식 disabled를 확인한다. 초기 타입/정적 오류는 보완했다. offline 설치는 캐시 메타데이터 부족으로 실패한 도구 결과였고, 복사 뒤 pnpm 실행이 설치 준비를 다시 요구한 것도 검증0/중단으로 구분한다. 최종 frozen-lockfile 설치는 실제 통과, 버전/잠금파일/공급망 정책 변경0이다. 설치 실패 stdout 파일을 확보했다고 주장하지 않는다.

첫 Chrome4실패는 verify201 기대값/가입 응답 대기 및 blank page의 storage 보조 실패를 포함했다. 후속4실패·3실패1통과·3실패1통과·2실패2통과를 원본으로 보존한다. 요청들은 수십 ms에 끝났으나 일부 화면 준비/새로고침의 초기5초 기대가 실패했다. 비활성 창 자동 초점 방지, 실제 HTTP/paint 전제와 Node-side DOM count polling(기존5초 한도)을 적용했다. 일시적인 고정 phase 진단 실행4통과는 release 증거로 세지 않으며 태그를 전부 제거했다. 제거 실행 및 마지막 접근 가능한 그룹/대비 검증 실행이 각각4건 통과했다. 초점만이 실패의 원인이었다거나 전체 제품 성능/운영 안정성을 입증했다고 단정하지 않는다.

원본 stdout/XML/모든 실행별 report·실패 context/PNG는 소유 scratch와 frontend/test-results의 고유 UTC 폴더에 보존한다. 수집본은 환경 경로·호스트명을 정리한 사본, 원본/public SHA와 최종 source17을 별도로 기록한다. collector는 symlink/overwrite·비소유 경로·과도한 파일을 거부한다.

## 지정 디자인 스킬의 실제 검토

web-design-studio→frontend-design→UI UX Pro Max form/React focused checks를 적용했다. 최종8개 critique 지침으로 실제 desktop/920px/오류·불확실 화면을 검토했다.

- visual-audit/hierarchy: 한 개의 블루 저장 CTA와 보조 내 계정 링크. 결과 불확실은 빨간 문구와 명시 재조회로 구분한다.
- spatial-rhythm/craft-signals:4px 배수 간격·그룹 구분선·48px 컨트롤·같은 radius,920px에서 입력과 문구가 잘리지 않는다.
- color-systems/type-systems: 기존 white/blue만 재사용, 본문16/제목31.25/그룹20/보조12.8의4역할. 실제 CTA 문구4.5·입력 테두리/초점3 이상 대비를 확인했다.
- motion-design/quality-checklist: 저장 상태 문구만 변화, reduced-motion 전환0·그룹/label·오류 요약 및 inline 연결·키보드·실패/재조회·확대 상태를 확인했다. fieldset 그룹 이름을 명시 aria-labelledby로 보완했다.

별도 디자인 시스템·외부 폰트·장식3D/유리 효과·의료 자격/효과 주장을 추가하지 않았다. Figma/axe/Impeccable/외부 독립 audit은 실행하지 않았다.

## 작성자 scope 리뷰 / 남은 게이트

engineering:code-review로 엄격5필드·private captured proof·committed ready identity·abort/late 폐기·단일 POST·응답 일치/불확실·자동 재시도0·입력/교체 경합·XSS/raw 오류/storage0·listener 해제·기존 middleware를 검토했다. 현재 이 Story의 미해결 P1/P2는 없다. 외부 독립 리뷰를 주장하지 않는다.

실제 scheduler/브라우저 권한/소리·classifier/기준선/추천·두 아바타/실측·1분 요약 HTTP 연결·Q32/PDF/LLM/변화 탐지·Draft36 SDK 개인정보 P2·2단계 이월·참여자/법무·Docker/TLS/운영 복구·외부/배포·전체1~6단계는 미완료다. 코드 병합은 알림 기능의 전체 완료·운영 migration·배포·출시 승인이 아니다. 같은 아바타 부위 새 수정/검증0을 유지한다.
