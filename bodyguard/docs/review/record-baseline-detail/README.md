# 자세 기록의 원래 개인 기준 조회 — S4.B2

## 실제 작동하는 웹 흐름

기존 production `/posture-records`의 분 상세 → 개인 기준의 **기준선 보기** → 기록에 연결된 원래 기준의 저장 날짜·목/어깨/몸통 값과 method/unit을 확인한다. 새 화면·탭·route·아바타/보정 UI를 추가하지 않는다. 기준 없는 분은 기존 ‘보정 전’이며 요청/버튼0이다. null은 ‘—’이며 정상0을 지어내지 않는다.

실제 Chrome155.0.8059.40/FastAPI/새 소유 PostgreSQL18.6에서 다음을 실행했다. 계정 준비는 기존 API로 수행했으며 가입 폼 전체 흐름을 이번 시험으로 대신 세지 않는다.

1. 합성 기준 A 저장 → 분 요약에 A 연결 → 기준 B 저장으로 재보정 → 기존 웹 상세에서 명시 조회. A는 서버의 inactive 과거 기준이며 웹은 A의2.75를 표시하고 B의9.75를 대체하지 않는다. 명시 조회 전 baseline 요청0, 조회 후 해당 detail GET1, 브라우저 baseline POST/active조회0.
2. 첫 응답을 제어503으로 실패시킨 뒤 고정 오류/명시 재조회 → 실제 저장된 A 확인. 자동 재조회·성공 추정 없이 사용자가 다시 요청했을 때만 읽는다.
3. A의 기록을 읽은 웹에서 실제 쿠키를 B로 교체 → 새 조회의 /me 불일치가 baseline 읽기 전에 차단 → 기존 기록/삭제 권한도 닫음 → 명시 계정 재확인 뒤 B의 빈 목록. 실제 B 쿠키에 A hint를 보낸 서버 요청403, B의 무헤더 A 상세 요청404도 확인했다.

계정/메일/기준값·분 요약은 합성 데이터이고 실제 브라우저·HTTP·SQL을 썼다. 합성 분 시각은 시험 당시5분 전이며 기준의 created_at은 서버 저장 시각이다. 이것을 실제 보정 수행·센서 생산 시간순서·올바른 자세/추천 정확도·참여자 검증으로 세지 않는다.

## 실제 화면과 디자인 경계

[1440px 실제 상세](record-baseline-1440.png), [800px 실제 상세](record-baseline-800.png), [503 오류/재조회](record-baseline-error.png). 첫 두 PNG의 긴 F/U 문자열은64자 method/unit의 줄바꿈 시험값이며 사용자용 운동명·완성된 디자인/실측 데이터가 아니다. 표는 기존 키보드 접근 가능한 가로 스크롤을 유지한다. 새 기준 정보는 기존 dl의 보조 항목 안에서 줄바꿈되며 페이지 전체 overflow가 없다.

frontend-design으로 기존 백색/블루·system 글꼴·48px secondary 버튼·둥근 모서리/간격을 재사용했다. 새 카드·색·그라데이션·아이콘·폰트·모션은 없다. 실제 Tab 두 번으로 기존 상세 표 → 기준선 버튼에 도달하고 focus-visible·Enter 조회를 확인했다. 초기/읽는 중/값/404/오류/명시 재조회·계정 차단을 구분하고 null/누락을 정상으로 표시하지 않는다. 문구는 조회·복구에 필요한 만큼만 추가했다. 모바일 지원·스크린리더·브라우저 메뉴 확대 시험은 이번 범위에서 미실행이다.

## 실패·보완과 최종 검증

- 구현 전 실제 App/React/AuthProvider의 제어 네트워크 시험은1통과/11실패였다. 기존 기준 없음은 통과했고 조회/복구 연결은 미구현이었다. 원본 RED를 보존했다.
- 첫 부분 회귀41개는 통과했으나 작성자 리뷰 강화 시험은13통과/2실패였다. 같은 ID라도 기준 응답의 버전·실측 부위 method/unit이 기록과 달랐을 때 표시했다. 기존 서버 summary 저장 검사의 관계를 웹에서도 대조해 거부하도록 보완했다. 이는 임계값/의학적 판정 변경이 아니다.
- 최초 Biome은 의도한 ID/항목 수명 dependency가 effect 본문에 사용되지 않아 실패했다. 명시 operation에 ID/항목을 캡처하고 live 조건에서 대조하여 보완했다. 첫 TypeScript 검사는 null baseline 시험의 잘못된 cast로 TS2352가 발생했고 실제 MinuteOut 타입으로 수정했다. 두 오류 원문은 도구 출력에 있으며 별도 원본 로그 파일이 있다고 하지 않는다. lint/type 검사를 완화하거나 unsafe fix/any 우회하지 않았다.
- 최종 frontend 실제101파일/1844개(새 화면 경합17개) 통과. 초기 실패와 늦은 fetch/계정·기간/이탈·같은 기준의 다른 분 선택·재조회 중 옛 값 제거를 제어 시험으로 구분한다.
- 실제 소유 SQL의 관련 baseline/summary·경합/읽기/업로드 binding150개 통과. 전체 backend542개는 이전 S3.B1의 결과이며 이번에 전체 재실행했다고 하지 않는다. API/business schema·migration·생성 타입은 변경하지 않았다.
- 실제 production Chrome 새3흐름과 기존 summary 조회/상세/페이지/취소·삭제/응답 단절/계정 교체/409복구4흐름 모두 통과. 실패/skip/flaky/retry0. 각 관찰 context 카메라/외부·GLB/SDK 요청/JS 오류와 local/session storage0이며 프로세스 전체 egress0의 증명은 아니다.
- TypeScript·전체 Biome(기존 info16개)·범위 Ruff/format·두 실제 원래 product notice build·production guard·diff 검사 통과. 새 공개 기능 연결로 production JS/CSS는 이전 버전과 달라졌으며 ‘공개 byte 동일’이라고 주장하지 않는다.
- 실행 전/후와 수집 시16개 source SHA256 동일. SQL은 baseline6/활성3/분3/분 소유자3으로 세 사용자에게 저장한 A/B와 기록에 부합한다. 이후 기존 summary 회귀는 같은 소유 시험 DB를 초기화해 별도 실행했으므로 census 시점과 구분한다.
- 소유 시험 DB만 경로/inode/PID를 대조해 종료했고 postmaster.pid 없음까지 확인했다. 시험 데이터·로그·초기 실패·기존 파일/다른 DB는 보존했다.

[실제 최종 요약](final-verification.json)과 [압축 원본·PNG SHA256/크기](manifest.json). 원본은 `/private/tmp/bodyguard-record-baseline.KBEZMbms`, 소유 DB는 `/private/tmp/bodyguard-auth-test.aJYJJu4O`다. gzip JSON의 PNG body도 실제 Chrome 첨부 원본이고 AI 생성/편집 이미지는 없다.

## 작성자 code-review

보안: 원래 committed ready 객체/ID·captured CSRF/서버 소유권, URL/DTO 제한, 401/403의 부모 기록/삭제 회수, raw/영속 저장/외부 요청 없음. 정확성: 기록 ID와 과거 불변·버전/실측 부위 method/unit, null/실패·늦은 응답/이탈·분/기간/계정 교체, single-flight·명시 재시도. 성능: 목록별 자동 N+1 없이 명시 조회 한 건과 기존15초 요청 한계, 해제/완료 후 proof 폐기. 유지보수: 기존 client·스타일·페이지를 재사용하고 독립 API/route/디자인 구조를 만들지 않았다.

로컬 결론: 좁은 Story의 발견한 P2를 보완했고 미해결 scoped P1/P2 없음. 독립 외부 리뷰/전문가 승인이 아니다. 최신 원격 diff/main/HEAD/CLEAN/체크·조건부 병합 게이트는 이 문서 시점에 대기 중이다.

실제 카메라 보정값 생산·정자세/추천·최종 아바타/시범·실측·기존 시작P2·HTTPS/외부 공급자/권리·운영 및 전체1~6은 여전히 미완료다. 아바타/참여자/Docker/공식 문의/Gmail·Google 보류와 별도 CEO 승인 경계를 유지한다. 이번 PR로 출시 후보판을 선언하지 않는다.
