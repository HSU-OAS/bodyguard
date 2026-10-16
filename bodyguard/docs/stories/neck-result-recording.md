# S4.R11 — 현재 목 코칭 결과와 명시 기록 저장 연결

2026-10-17 · PR159 merge `eb94fac57e33ce35afa6d072a701a3aceedae31f`의 최신 main에서 시작한다.

## 범위·화면 계약

기존 `NeckCoachingRun`의 실제 좌우 완료/중단 결과를 `useRecordedPlayback`의 기존 저장 파이프라인에 연결한다. 같은 UUID/준비 시 UTC와 단조 시간·계정 lease·CSRF·제한된 요약 DTO를 재사용한다. 새 기록 API/DB schema·카메라/SDK·메뉴/디자인 개편은 없다. 화이트/블루·기존 버튼/결과 제목·초점 체계를 유지한다.

**기본 후보 검수는 계속 저장하지 않는다.** 수학 프로필을 일반 운동 기록으로 공개하지 않는다. 명시 테스트 구성의 `recording: 'isolated-local-test'`와 DEV/loopback이 모두 충족될 때만 합성·격리 시험임을 표시한 수동 저장 컨트롤을 제공한다. 이 표식은 임상/출시 gate나 서버 DB 소유권 증명이 아니다. 실제 시험 runner가 새 소유 PostgreSQL·시험 계정/메일을 격리한다. 공개 bundle에서는 후보와 테스트 진입을 제거한다.

## 수용 기준·하네스

1. 기본 구성·준비/수행/종료만으로 기록 POST0. 명시 격리 구성의 종료 결과에서만 저장할 수 있고, 기존 소유 카메라/Worker/아바타 정리가 실제 완료된 후 요청한다. 정리 실패 시 저장하지 않는다.
2. 실제 목 classifier→기존 진행→좌우 완료/중단→같은 결과 UUID/8필드 DTO→현재 API/SQL→기존 상세/목록이 연결된다. 합성 입력·시범/GLB는 실제 SDK/사람 정확도와 구분한다.
3. 중복 클릭은 한 요청만 만들고 성공 뒤 재저장하지 않는다. 수락 후 응답 단절에서는 자동 재시도0, 명시 재시도만 같은 UUID/DTO를 쓰며 SQL 기록1을 유지한다. invalid response/401/403/409를 성공 표시로 바꾸지 않는다.
4. 계정 refresh/변경·숨김/나가기·새 검수/구성 교체는 기존 소유 작업을 회수하고 늦은 성공을 화면에 적용하지 않는다. 옛 CSRF를 새 cookie 계정에 다시 발급받아 쓰지 않는다. 실제 타 계정 조회404/목록0을 확인한다.
5. 일반 단위/화면 회귀·타입/notice/build·production 격리·범위/전체 Biome·소유 Python runner 검사·diff와 작성자 리뷰를 통과한다. 실패/미실행/증거와 실행 소스 SHA를 보존한다. 정리 실패는 controller의 notice/snapshot으로도 오므로 공통 recorded session의 저장/재시도에서도 차단한다.

단위 검사는 실제 session/writer+모의 HTTP로 저장/재시도/늦은 결과/정리 실패 경계를 확인한다. 새 실제 API browser 시험은 기존 locked `test_database`/runner와 loopback Vite만 사용하며 실제 가입/세션/CSRF/SQL·기록 화면을 검사한다. 생성 입력의 카메라/Worker만 대체하고 실제 GLB/classifier/엔진을 실행한다.

## 제외·필수 잔여 조건

공개 코칭·출시 적격 동작/임상 각도/운동량·실제 사람 검증·최종 아바타 외형/성능·신규 Blender/GLB·Gmail/Google/Docker/HTTPS·운영 DB/migration·시크릿/비용·배포/출시는 하지 않는다. 기존 Draft150/152와 SDK P2 및 전체1~4/1~6 실제 완료 기준은 그대로다. 최종 공개 적용에는 검증된 실행 프로필·나머지 동작/추천·모든 선행 gate가 필요하다.

## 구현 결과

[실제 화면·동작/저장 흐름·명령·실패/한계](../review/neck-result-recording/README.md). 현재 목 classifier/GLB 화면에서 명시 저장→실제 API/SQL→기존 상세, 수락 뒤 응답 단절의 동일 UUID 재시도/기록1, 옛 proof403·타 계정404를 확인했다. 기본 후보는 별도 browser8흐름에서 기록 쓰기0을 유지한다. 일반 회귀121파일/2033검사·원래 build/고지/공개 격리·Biome와 runner 검사 및 작성자 리뷰를 통과했다. 테스트 fixture의 성공을 임상/출시 gate로 바꾸지 않는다.
