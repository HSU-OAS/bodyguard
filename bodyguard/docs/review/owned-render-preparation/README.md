# S6.15 — 로그인 소유 렌더 준비 통합

두 원본 아바타의 첫 GPU 준비를 실제 로그인 소유 코칭 흐름에 연결했다. 준비 중 로그아웃·이탈하면 늦은 compile 완료가 재생이나 기록을 되살리지 않는다. 공개 코칭·최종 아바타·출시 후보판이 완성된 것은 아니다. [Story](../../stories/owned-render-preparation.md).

## 실제 작동 흐름

`prepareAvatarStage`는 이미 배치·조명·재질이 설정된 scene/camera/renderer를 빌려 compileAsync와 첫 실제 draw를 마친다. 호출 전/compile 후/draw 후 취소를 확인하고 실패를 전파한다. 생성·최종 폐기는 caller 책임이다. 준비 draw는 live render/관찰/올바른 수행/타이머 적립이 아니다. Three의 [공식 compileAsync 계약](https://threejs.org/docs/pages/WebGLRenderer.html)과 실제 GPU draw를 구분한다.

실제 Chrome155·SDK1.0.1·Three0.186.1·AuthProvider/useRecordedCoaching/API·새 PostgreSQL18 격리 DB에서 같은 A37 남녀 두 GLB를 사용했다. 가짜 카메라/메일·명시 합성 plan/오류/phase를 사용한 기술 시험이다. 실제 SDK의 blank 입력 검출은0이며 빨간 강조·교정 시범·타이머 긍정은 별도 생성 입력이지 실제 사람 판정이 아니다.

남녀 준비 opt-in **14+14건**에서 준비→재생·오류 강조/가림/복수·미검출 해제/복구·교정 시범 변경·일시정지/새 세대·본인 중단 기록·동일 계정 refresh/명시 재시작·logout/server401/pagehide/unmount를 확인했다. 새 준비 대기 취소4건은 actual compile을 시작한 뒤 시험 전용 장벽을 세웠다. 취소·장벽 해제 후 ready/준비 draw/live render/native/적립/record0, camera track ended·SDK/모델 회수·GPU memory baseline 복귀를 확인했다. 실제 GPU hang/하드웨어 고장 시험은 아니다.

기본 호출의 renderer 준비는 계속 opt-in이다. 공개 구조·문구·default main/SDK 정책·화질·재질·원본 GLB/조형·API/운영 정책은 변경하지 않았다. 현재 main의 기본24건과 PR90의 원래26건은 당시 Draft 목2건과 parameter 구성이 달라 별도다. 이번28을 원래26 통과/시작P2 해결로 세지 않는다.

## 실패 보존

- 최초 unit RED는 helper 미존재의 import 실패/exit1이며 실행 assertion0이다. 구현 후7건이 통과했다. 최초 포맷 전 test 전체 source는 따로 보존하지 않았으므로 그 binary/source까지 보존했다고 주장하지 않는다.
- pnpm 타입/전체 FE 실행은 자동 의존성 검증 설치가 sandbox DNS 실패로 중단했다. 이어 직접 CLI는 그 실패로 손상된 **자체 복사본**에서 module-not-found로 실행 전 실패했다. 복사본을 별도 경로에 보존하고 기존 잠긴 설치본을 다시 자체 복사했다. 설치/잠금/정책을 끄지 않았다. 이후 설치된 Node CLI의 실제 타입·전체 FE를 실행했다. pnpm 명령이 통과했다고 하지 않는다. private launcher dispatcher는 현재 workdir/허용 명령만 받아 Node의 asset 준비·타입·Vite build와 Playwright를 호출한다.
- 최초 격리 initdb는 sandbox shared-memory EPERM/exit1이었다. 전용 임시 경로·UTF8·로컬 권한으로 실제 초기화했으며 외부 TCP를 열지 않았다. 기존/운영 DB가 아니다.
- 첫 브라우저 분할 selector `^male `은 파일명도 포함하는 Playwright title과 맞지 않아 **0건/exit1**이었다. selector를 바로잡고 원본 script/bundle/report를 보존했다. `--grep`는 시험 분할만 추가하고 retries0·기존5초 poll·제품 rate limit은 그대로다. 각 분할은 별도 서비스에서 합성 시험 데이터만 초기화한다.
- 첫 실제 남성14건은12통과/**준비 취소2실패**였다. 하네스가 장벽에 걸린 start Promise를 반환해 취소를 보내지 못하고60초 전체 시험 timeout이 났다. `before-close`의 preparing/held=true·ready/draw/native0과 source/bundle/report를 보존했다. beginStart로 작업을 시작하고 취소·늦은 완료 이후 finishStart를 기다리도록 시험 순서만 고쳤다. 시험 시간을 늘리지 않고 남녀28을 실제 재실행했다.
- 잘못된 CLI 상대경로·존재하지 않는 임시 report 경로·최초 Ruff 줄길이/포맷 root 설정 오류는 도구/정적 검사 실패다. 별도 receipt 없는 것은 대화 출력에만 있으며 실제 브라우저 RED로 세지 않는다.
- 최초 증거 verifier는 본인 기록 페이지로 이동한4건의 `final=null`을 이해하지 못해 실패했다. 이동 직전의 명시적 `native-closed-before-public-record` closed snapshot에서 이미 회수가 검증돼 있었다. 그 경우에만 해당 snapshot을 확인하도록 수정했으며 기존 실패 verifier/재실행 receipt·첫 manifest를 보존한다. 브라우저 기준을 낮추거나 제품을 변경한 것이 아니다.

## 검증·리뷰 경계

최종 전체 FE1411/72파일·타입·Biome272·backend Ruff/변경 파일 format을 실제 통과했다. 실제 Chrome prepared28과 **기본12+12건**의 external/pageerror/storage0·모델0·카메라/입력/SDK 회수·memory baseline을 확인했다. 모든 분할 retries0/skip0/flaky0이며 제품 signup 제한을 변경하지 않았다. 기존5초 nativeCloses 기준을 유지했다. Node의 asset 준비·타입 확인·직렬 Vite public build/guard를 실행했고 공개 JS355151/CSS31199 byte·SHA는 base와 동일하다. 실제 Worker 통합·전체 backend 단위 suite·실제 사람/물리 장치 시험은 이번 미실행이다.

원시 영상·몸/얼굴/손 배열·행렬·신체 per-frame 수치를 저장/로그/스크린샷하지 않는다. 보존 PNG는 기존 제작 fixture의 **아바타 canvas와 합성 계정의 본인 중단 기록 화면**이다. 아바타는 미완성 외형/생성 오류·타이밍의 기술 증거이며 실제 카메라나 완성 디자인 미리보기가 아니다. 원본 GLB hash는 기존25a9bd6과 동일하며 새 Blender 제작/원본/GLB 변경0이다.

engineering:debug의 실패 원인 분리와 engineering:code-review의 취소/이전 세대/차용 자원·부분 정리·개인정보 경계를 작성자가 검토했다. prepare 호출의 signal·순서·실패 전파, 준비와 관찰/적립 분리, 취소 후 owner/자원 회수, 새 세대의 rest/배치 초기화·기본 parameter 유지, CLI 목록 전달/시험 격리·제품 제한 불변을 확인했다. 이 좁은 helper/통합 보완 범위의 미해결 P1/P2는 발견하지 않았다. **기존 시작P2를 닫는 판정이 아니다.** graphify의 vocab 확장 `[auth, native, prepare, lifecycle]` 지도는 관련 경로 탐색에만 유용했으며 최신 GPU helper/성능 원인의 근거가 아니다. 전문가/독립 리뷰가 아니다.

SDK 통신 제품 정책·승인 공개 화면 구조·실제 참여자/물리 webcam/권한 popup/노트북·정확한 classifier/시범·최종 외형/권리·Docker/TLS·공급자/운영·PR90 기존 시작P2와 D2/전체1~6은 미완료다. 텍스트는 짧은 제목·버튼·현재 코칭, 펼쳐 보는 설명·간결한 필수 안전 안내로 제한한다. 기존 별도 승인 경계와 보존 규칙을 유지한다.

증거 gzip·SHA/길이/현재 source 확인은 아래 명령으로 재검증한다. Hash 검증은 브라우저 재실행이 아니다.

실제 보존360파일·현재 source12개의 길이/압축·해제 SHA 및 prepared28/default24·실패2·취소4/회수 snapshot·공개 byte/원본 hash 검증이 통과했다. 첫 manifest와 실패 verifier도 보존한다. 원격 diff/CLEAN/체크/main 포함·merge commit/브랜치 보존은 다음 별도 Git 게이트다.

```bash
node bodyguard/docs/review/owned-render-preparation/verify.mjs
node bodyguard/docs/review/owned-render-preparation/verify.mjs --current
```
