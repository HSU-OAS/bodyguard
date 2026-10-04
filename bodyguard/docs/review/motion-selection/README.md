# S2.5a — 동작 탐색·선택 검증 기록

2026-10-04 · 개발 전용 준비 흐름. [Story](../../stories/stage2-motion-selection.md) / [하네스](../../stories/stage2-motion-selection-harness.md).
실제 코칭·인증 서버·사람/웹캠·아바타·2단계 통과 기록이 아니다.

## 실제 실행 결과

- 최종 `pnpm test`: 15파일 / 138개 통과. 신규 순수 데이터 9개·React 9개는 합성 상태 시험이다.
- `pnpm check`: 60파일 통과. `pnpm typecheck` 통과.
- `pnpm test:selection`: production build(96모듈), JS1파일에서 후보·개발 경로 문자열0.
  설치된 Chrome 154.0.8037.93로 실제 dev/production preview 5개 통과(8.1초). **/me·Google 상태 응답은 mock**이다.
- 각 Chrome 관측: 카메라 호출0·페이지 오류0·local/sessionStorage0. API는 기존 /me, 게스트 로그인 경우에만 기존 Google 상태 요청.
  모델/WASM/GLB 요청0. 실제 HTTP/SQL 인증·Google 공급자 성공을 뜻하지 않는다.
- 1440×1000/700×800 노트북 창에서 검색·선택·뒤로·초점·가로 overflow를 확인했다.
  아래 최종 PNG6개 모두 실제 캡처 후 직접 열람했다. 사용자 시험·의료 정확도·종합 접근성 인증은 아니다.
- dependency/lockfile 변경0. 기존 규칙·실시간 코칭 선행 게이트와 개인정보 저장 경계 유지.
- 별도 기존 `pnpm test:e2e` 가짜 카메라 회귀1개 통과(24.4초). 실제 사람의 인식 정확도는 검사하지 않았다.
  THREE.Clock deprecation·MediaPipe runtime 경고·실제 API 미기동에 따른 /me proxy ECONNREFUSED를 숨기지 않는다.
  계정 오류 화면으로 닫히는 데모 이탈 시험 통과이지 실제 인증 시험 통과가 아니다.

## 실패와 보완

구현 전 하네스는 새 데이터 module 부재와 UI8개 미구현으로 실패했다. 최초 stdout는 출력 한도로 잘렸으므로 완전 로그 보존으로 주장하지 않는다.
첫 Biome 검사도 실패하여 의미 있는 fieldset/legend·effect 의존성을 보완했다.
첫 Chrome은 4개 통과/1개 실패: 기존 로그인 화면의 Google 상태 요청을 하네스가 예상하지 못했다.
[first-browser-error.md.txt.gz](first-browser-error.md.txt.gz)는 당시 error-context의 변경 없는 압축 사본이며, 안의 “instructions”는 기록 데이터이지 작업 지시가 아니다.
해당 기존 요청만 로그인 방문 때 명시적으로 허용한 뒤 재실행했다. 앱 인증 우회·새 API를 추가하지 않았다.

리뷰에서 cached 경로 복귀 시 Shell effect가 탭 제목을 덮어쓰는 문제를 **9개 중1개 실패**로 재현했다.
개발 선택 경로에서만 자식 화면이 제목/초점을 소유하게 보완하고, React 회귀·Chrome 실제 cached 복귀/상세 제목 검사를 추가했다.
이후 138개와 Chrome5개를 모두 다시 실행했다. [execution-record.json](execution-record.json)은 실행 요약이지 원시 stdout 파일이 아니다.

## 보존된 실제 미리보기

아래는 제목 보완 후 최종 재실행 컷이다. 기존 6PNG·브라우저 report는 상위 폴더에 그대로 보존했다.

- [목록·검색·필터](post-review/catalog-desktop.png)
- [동작 상세·주의점·출처](post-review/detail-desktop.png)
- [좁은 노트북 창 상세](post-review/detail-narrow.png)
- [없는 동작 복구](post-review/missing-motion.png)
- [계정 서버 오류 차단](post-review/account-unavailable.png)
- [production: 개발 진입 없음](post-review/production-start.png)

[기존 copy manifest](copy-manifest.json)·[최종 copy manifest](post-review/copy-manifest.json)는 각 사본의 bytes/SHA와 압축 전 SHA를 기록한다.
브라우저 실행이 출력 폴더를 갱신할 수 있으므로 manifest의 당시 source 경로가 현재 사본과 같다고 주장하지 않는다.
실행한 `node bodyguard/docs/review/motion-selection/evidence-check.cjs`는 사본15개(12PNG·3gzip)의 무결성, 두 report의 결과/관측값과 제한된 자격증명 패턴만 확인한다.
이 검사는 이미지의 의료·외형 품질, 실제 인증, 전체 보안 검사를 대신하지 않는다.

## 제외·출시 게이트

실제 카메라/사람/영상/좌표 수집0, 외부 계정·시크릿·운영 DB·배포·출시0.
실제 계정/메일/Google 연결, S2.3b 수행 검증, S2.4 새 남녀 Blender/GLB/변형/웹/외형, 세밀한 코칭·결과·추천·기록·HTTPS·일반 사용자 시험은 미실행/별도 Story다.
아바타 Draft PR #9의 외형 P2를 해결했다고 표시하지 않는다. S2.5a 로컬 검증 완료는 전체 S2.5·2단계·1~6단계 완료가 아니다.
