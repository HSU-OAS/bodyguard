# 출시 통합 실행 게이트 — 2026-10-09

**2026-10-11 독립 통합 갱신:** [S3.C6](stories/recorded-playback-assembly.md)은 입력·현재 세션 상태·세대별 재생·계정 소유 기록의 공통 경로를 연결했다. [실제 Chrome/React·fixture HTTP 준비→합성 수행→명시 저장→기존 기록 상세 및 실패/리뷰](review/recorded-playback-assembly/README.md). 합성 계정/자원/시계/판정이며 native SDK/SQL/참여자/아바타의 통과 증거가 아니다. 새 상태 덮어쓰기 P2는 실제 재현/보완했고 공개 byte/시작 gate/출시 동작0은 불변이다. PR132 source724f282→mergef4bddae/main은 확인했다. UI/UX 추후·아바타/참여자/Docker 보류·실제 판정/추천·최종 외형/실측·시작P2/과거 native timeout·운영/HTTPS 및 전체1~6 미완료는 유지한다.

**2026-10-11 기능 연결 우선:** CEO는 UI/UX 다듬기를 나중으로 두고 독립 웹 기능의 빠른 완성을 지시했다. 이어 아바타 보류 유지·실제 참여자 연결은 나중으로 답했으며 Docker 보류도 유지한다. [S3.C5](stories/motion-camera-framing.md)는 선택 동작의 촬영 안내를 실제 개발 연속 입력과 연결하고 동작 변경 시 종료/새 명시 준비·unknown ID 차단을 구현했다. [실제 흐름·가짜/실제 경계·실패](review/motion-camera-framing/README.md). 촬영 기술 상태는 자세 성공·추천·코칭/기록 활성화가 아니다. 기존 필수 단계 기준을 낮추거나 이월 항목을 통과 처리하지 않는다. PR131 source71afcb2→mergedde3d3c/main은 확인했다.

**2026-10-11 입력 복구 갱신:** [S3.C4](stories/coaching-input-recovery.md)에서 현재 개발 웹의 제어 capture/Worker 오류·입력 정지·정리 오류와 명시 재시도를 실제 SDK/가짜 카메라로 검증했다. [작동 영역·실패 보존·범위](review/coaching-input-recovery/README.md). 제품/화면/SDK/판정 변경0이며 회귀 하네스를 추가한 결과다. 강화 시험의 원인 미확정 timeout과 기존 시작P2를 닫지 않으며 공개 코칭/기록0이다. PR130 mergebbc2b15/main 포함을 실제 확인했다. 아바타/Docker·실측/적격 동작0·운영/전체1~6 게이트는 미완료다.

**2026-10-11 연속 입력 갱신:** [S3.C3](stories/coaching-continuous-input.md)은 승인된 개발 웹에서 카메라 준비 후 별도 명시 연속 입력과 종료·화면/계정 회수를 연결했다. [실제 작동 제어·실패 보존·경계](review/coaching-continuous-input/README.md). 같은 카메라/Worker의 관찰 producer이며 준비 frame 폐기·최신 메모리 슬롯1개·원래 촬영 시각을 유지한다. 공개 JS/CSS는 PR129 build와 byte 동일이고 공개 코칭/판정/기록0이다. PR129 mergeb5791b2/main은 실제 확인했다. 아바타/Docker 보류·출시 적격0·실측·기존 시작P2·전체1~6 완료 기준은 닫지 않았다.

**2026-10-11 취소 경로 갱신:** [S3.C2](stories/camera-playback-cancellation.md)에서 획득한 카메라의 미완료 재생 취소·화면 이탈·늦은 완료와 정리 실패 차단을 보완했다. [실제 흐름·원문·경계](review/camera-playback-cancellation/README.md). 공개 JS/CSS와 판정/SDK 정책은 불변이며 PR128 source68f0bc2→mergebe1ec62/main을 실제 확인한 뒤 진행했다. 원래 시작P2·아바타/Docker 보류·실측/출시 적격0·전체1~6의 미완료는 해소되지 않았다.

**2026-10-11 카메라 준비 갱신:** [S3.C1](stories/coaching-camera-preparation.md)은 실제 개발 웹에서 명시 카메라 준비/SDK 첫 입력 처리·폐기/끄기와 거부/취소·계정/화면 이탈의 정리를 연결했다. [실제 화면·가짜 장치/제어 계정/실제 SDK 경계·실패](review/coaching-camera-preparation/README.md). 구조 PR127은 mergefd331d2/main에 포함됐다. 원래 시작P2를 닫거나 아바타·동작/추천/판정·실측·전체1~6 완료로 세지 않는다. CEO는 Docker 연결을 나중에 하기로 했으므로 컨테이너/HTTPS 실제 검증은 보류·미완료다. 아래 과거 SDK/화면/연결 상태는 위 최신 결과와 구분한다.

**2026-10-11 갱신:** 승인된 SDK 정책은 [PR126](https://github.com/HSU-OAS/bodyguard/pull/126)의 sourcec426f6d→merge5d12491로 main에 포함됐다. [실제 SDK/외부 차단·인증 회귀의 범위](review/sdk-network-policy/README.md). 코칭·동작 선택 구조는 [S4.D6](stories/coaching-workspace-structure.md)에서 실제 React 개발 라우트에 적용하고 화면 흐름을 검증했다. [실제 작동 화면·실패·한계](review/coaching-workspace-structure/README.md). 아래 과거 목록의 구조/정책 승인 대기는 해소됐지만 실제 두 아바타·동작 미디어/판정·참여자·시작P2·운영/HTTPS와 전체1~6은 미완료다. 개발 구조는 공개 코칭으로 노출하지 않는다. PR36/51 등 과거 Draft를 자동 통과/병합한 것이 아니다.

**1~6단계는 미완료다.** 전문가 최종 실용성 검토만 남은 출시 후보판이 아니다. 이 문서는 최신 main `5a1a3d8ec1149cf029c486aee35de1dc33a2f167`과 실제 열린 PR, 실행된 코칭 시안을 대조한 다음 작업의 입력이다. [출시 계약](release-plan.md)의 범위와 완료 기준을 바꾸지 않는다.

## 현재 사용자 흐름과 부족한 증거

| 출시 요구 | 현재 구현·증거 | 아직 필요한 것 |
| --- | --- | --- |
| 가입·로그인·복구·계정 및 데이터 관리 | [계정 웹](stories/stage2-account-web.md), [복구 웹](stories/stage2-password-recovery-web.md), [계정 삭제](stories/stage4-account-withdrawal-web.md), [데이터 안내](stories/stage4-data-help-web.md), [현재 웹 통합](stories/stage6-web-integration.md)의 로컬 흐름 | 실제 Gmail/Google 연결·최종 화면·HTTPS 배포본의 처음 방문자 흐름. 과거 합성 메일·계정 시험을 공급자 검증으로 세지 않음 |
| 동작 직접 선택·신체 확인과 추천 | [근거 목록](motion-evidence.md), [동작 검수 목록](stories/stage3-motion-library.md), [추천 계약](stories/stage3-recommendation-contract.md) | 출시 적격 동작은 **0개**. 각 동작의 실제 촬영·판정·시범·추천 근거를 검증하고 그 뒤 공개 연결 |
| 남녀 두 아바타·세밀한 코칭 | [비공개 몸통 통합](stories/native-trunk-feedback.md), [적응형 시범](stories/adaptive-reference.md), [목 관찰](stories/neck-side-observation.md) | 최종 외형·얼굴/목 연결·관절 대응·올바른 동작/교정 콘텐츠·실제 사람 정확도·노트북 성능. 공급된 합성 오류나 제작 fixture가 임상 classifier/올바른 시범의 증거는 아님 |
| 최소 텍스트·화이트/블루·한 공간의 두 아바타 | [디자인 결정](coaching-design-decision-20261007.md), [기존 독립 시안](stories/coaching-prototype-minimal-copy.md), [이번 실제 재확인](review/release-readiness-gates/report.json) | 클릭 가능한 코칭 구조 검토와 제품 적용 범위 합의. 정적 배치 이미지·단계 문구 전환을 실제 3D/코칭으로 공개하지 않음 |
| 결과·기록 조회/삭제 | [수행 기록 연결](stories/coaching-recorded-session.md), [분 요약 조회/삭제](stories/minute-summary-web.md), [소유 업로드](stories/owned-minute-upload.md) | 검증된 동작의 실제 결과 producer와 최종 웹 흐름. 합성 기록을 실제 운동 완료로 취급하지 않음 |
| 개인정보·보안·배포·운영·내부 출시 시험 | [보안 시험](stories/stage6-web-security.md), [이월](stage2-carryover.md), [운영 규칙](operating-rules.md) | SDK 제품 통신 경계, Docker/NGINX/TLS 실제 실행·최종 artifact 권리/고지·안전한 복구·배포·참여자/다장치/사용성 시험. 로컬·가짜 카메라 결과는 이 기준의 대체물이 아님 |

위 링크의 과거 기능 검증은 이번 문서 Story에서 재실행한 것이 아니다. 화면 구조 승인 대기와 임상·외형 미완료는 서로 다른 게이트다. 아바타 제작·기술 구현·검증 설계의 책임은 CTO에게 있으며 CEO에게 그 작업 자체를 넘기지 않는다.

## 요청한 결정·연결 — 2026-10-11 갱신

아래 1·2항의 로컬 구현·검증·PR 범위는 2026-10-11 CEO가 명시 승인했다. 아바타 보류와 실제 완료 기준은 유지하며 [SDK Story](stories/sdk-same-origin-policy.md)부터 독립 작업을 재개한다. 3항 실제 촬영 참여 연결은 아직 미수신이다. 다음 목록은 원래 요청 범위이며 승인 자체가 구현/검증 완료는 아니다.

1. **코칭 구조 적용:** 현재 시안의 왼쪽 사용자/오른쪽 시범, 왼쪽 메뉴, 상단 보기/동작 설정, 하단 조작을 권장한다. 적용 범위는 코칭 화면과 동작 선택 대화상자다. 다른 화면은 확장하지 않으며 실제 동작/에셋 게이트 전 코칭은 비공개다. 비용·계정·시크릿·배포 없음. 위험은 구도·조작이 사용자 기대와 다를 수 있다는 것; 문제 시 변경을 되돌리고 기존 화면/기능과 원본 시안을 보존한다.
2. **SDK 제품 통신 정책:** 코칭 실행 영역에서 동일 출처 자산/API만 허용하고 외부 계측을 차단하는 로컬 구현·검증·PR을 권장한다. SDK 내부 비공개 속성 수정·외부 통신 허용·패키지 교체·운영 적용의 승인이 아니다. 비용·계정·시크릿·배포 없음. SDK 회귀 위험이 있어 실제 준비/추론/종료·기존 인증/API를 검증한다. 문제 시 정책 변경을 되돌리고 코칭은 계속 비공개로 유지한다. 승인 전 제품 정책을 적용하거나 PR36의 B-09/P2를 통과 처리하지 않는다.
3. **실제 촬영 참여 연결:** 첫 시험의 수행 팀원과 독립 관찰자, 가능한 시간·노트북 연결이 필요하다. [S2.3b](stories/stage2-motion-validation.md)의 동의·안전·영상/좌표/이름 저장 금지 경계를 먼저 확인한다. 연결 요청은 참여/동의 완료가 아니다. 전체 출시의 참여자 수·조건 분리·다장치 시험을 첫 두 사람 연결만으로 충족했다고 하지 않는다. 절차·판정 구현·분석은 CTO가 준비한다.

위 세 항목은 2026-10-09 대화에서 구체적으로 요청했다. 2026-10-11의 직접 답변으로 1·2항만 승인됐다. 3항은 자동 goal 재개나 기술 승인으로 충족되지 않는다. 승인된 범위는 재질문하며 멈추지 않는다.

## 다른 필수 의존성과 진행 경계

- Docker 소켓 `/Users/gongman/.docker/run/docker.sock`은 이번 확인에서 없었다. 실제 Docker 연결 요청이 남아 있다. 운영 서버·계정·비용·시크릿·DB migration·배포·출시는 별도 실행 범위/위험/복구 계획을 제시한 뒤 승인받는다. localhost 시안 서버는 운영 배포가 아니다.
- [Q-13/Q-27/Q-32](open-questions.md)의 PDF 내용, LLM 공급자/결제, 기존 부가 기능의 첫 출시 포함 범위는 미정이다. 자세/착석 알림·PDF·LLM·변화 탐지를 임의 삭제·후속 확정하거나 미정 수치를 제품 기준으로 채택하지 않는다. 기술적으로 준비 가능한 부분과 범위·사업 결정을 구분한다.
- 기록 보관/탈퇴, 개인정보 문서, 복구 시 삭제·세션 보안 재적용, 최종 라이선스/고지는 별도 미완료 조건이다. [백업/복구](stage5-backup-restore-runbook.md), [권리/고지](stage5-license-inventory-runbook.md)의 실제 게이트를 유지한다.
- 얼굴·목과 여성의 의상 없는 중립 백색 표면 등 [D2-A/M/T/R/I/P](stage2-carryover.md)를 최종 통합에서 닫는다. 우선순위 지시를 문서 작성만으로 해제하거나 같은 부위 제작 사이클을 임의 재개하지 않는다. 미완성 원본/GLB·실패와 검증 증거는 보존한다.
- 시작 지연은 아직 미해결이다. PR90 필수26건 중13실패는 이후 정상 진단 실행으로 대체하지 않는다. 실제 실패 조건·내부 준비/첫 추론·노트북 조건에 근거한 보완이 필요하다. 정상 재시험·timeout 확대·기능 축소만으로 해결했다고 표시하지 않는다.

독립적인 승인 범위 구현/보완은 CTO가 계속한다. 다만 미정 PDF 내용을 임의 완성하거나 합성 판정을 성공 기능으로 노출하는 것은 독립 작업이 아니다. 승인 또는 실제 관찰이 필요한 경계를 건너뛰어 진척을 만들지 않는다.

## 실제 PR 상태 — 시점 기록

2026-10-08 16:34 UTC에 GitHub에서 읽은 결과이며 [후속 저장 snapshot](review/release-readiness-gates/pr-snapshot.json)도 같은 HEAD/상태다. 모두 OPEN/Draft·**체크 없음**이며 이번 Story에서는 아래 PR을 변경/병합하지 않았다. 상태는 이후 달라질 수 있으므로 병합 직전에 다시 읽는다.

| PR | HEAD | 충돌 상태 | 남은 조건 |
| --- | --- | --- | --- |
| [9](https://github.com/HSU-OAS/bodyguard/pull/9) | `25a9bd6c7392890e3b5d5d6ae1046bb7087d56ad` | DIRTY / CONFLICTING | 최종 외형/변형·원본/GLB/권리·최신 main 정합 |
| [29](https://github.com/HSU-OAS/bodyguard/pull/29) | `b6235843710e169cf102da6c7b92c9df0630695f` | DIRTY / CONFLICTING | 실제 컨테이너/NGINX/TLS·최신 main 정합 |
| [36](https://github.com/HSU-OAS/bodyguard/pull/36) | `e4df4a99963bc72d3bf656074f226b47d9128719` | DIRTY / CONFLICTING | SDK 정책 승인·B-09/P2 보완/실제 검증·최신 main 정합 |
| [51](https://github.com/HSU-OAS/bodyguard/pull/51) | `bc7b29a793079cfb7feb5ca1998fc484876859e3` | DIRTY / CONFLICTING | 화면 구조/통합·남은 판정/시작 문제·최신 main 정합 |
| [90](https://github.com/HSU-OAS/bodyguard/pull/90) | `884700e3cebfce2b1c0c51fdca2cce4788e6dc4b` | CLEAN / MERGEABLE | 필수 시작 회귀13실패·원인/보완·해당 Story 필수 재검증 |
| [91](https://github.com/HSU-OAS/bodyguard/pull/91) | `e7869f3f92ac2dcfdc903b20c853e3b121d27f45` | CLEAN / MERGEABLE | 원인 입증/제품 보완·시작P2. 진단/분석 통과만으로 해결 Story를 병합하지 않음 |

## 이번 독립 시안 재확인 범위

UTC2026-10-08 16:25:14, 실행 HEAD `e7869f3f92ac2dcfdc903b20c853e3b121d27f45`에서 기존 정적 HTML12건을 독립 Chrome으로 확인했다. 다섯 시안 파일의 실행 전후 SHA가 같고 최신 main의 대응 Git blob과도 byte 동일했다. 제품/카메라/임상/GLB/실제 참여자 시험이 아니다.

실제 작동한 것은 전신·상반신·상세 구도, 설명 접기/키보드/초점, 동작 대화상자, 설정 초기화, 수동 단계 문구, 종료 취소/초기화, 이미지 실패 복구다. [원문 report](review/release-readiness-gates/report.json)와 [경계](review/release-readiness-gates/boundary.json)에 카메라·저장소 쓰기·외부/API 요청·JS 오류0을 기록했다. 실제 브라우저 메뉴 확대가 아닌 CSS 확대 시험을 구분한다. [현재 화면과 설명 펼치기](review/coaching-prototype-minimal-copy/README.md)는 기존 증거이며 이번 PNG의 원본은 private 임시 증거 폴더에 보존한다.

최초 잘못된 상대 런타임 경로는 module-not-found/exit1로 **브라우저 실행 전 실패**했다. 기존 설치 런타임의 절대경로로 바로잡은 뒤 실행했다. 샌드박스의 loopback listen/curl 실패·공유 브라우저의 상태 변경/스크린샷 경로 제한은 제품 검증 성공으로 세지 않는다. 독립 Chrome 하네스와 제한된 정적 loopback 서버를 사용했고 실제 HTTP200을 따로 확인했다. 이 실패 원문은 대화 도구 출력에 남아 있으며 별도 원본 로그 파일이 있다고 주장하지 않는다.

문서 Story의 링크·정합·원본 hash·diff 검증과 조건부 PR 게이트가 끝나도 전체 출시 상태는 미완료다. [Story 수용 기준](stories/release-readiness-gates.md)으로 이번 좁은 기록 범위만 검증한다.
