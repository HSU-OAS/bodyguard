# S6.16 — 촬영 목 관찰의 전체 native 회귀

비공개 코칭에서 촬영 비율·낮은 presence·가림/복수/미검출·pause/새 세대·권한 회수와 기존 본인 기록 흐름을 함께 확인하는 검증 하네스를 복원했다. 공개 코칭이나 실제 사람의 자세 판정을 완성한 것이 아니다. [Story](../../stories/native-neck-full-regression.md).

## 실제 작동과 원래 시험 대조

PR90/884700e의 원래26건은 목 관찰을 켠 기존 남녀24건과 새 목2건이었다. 최근 기본24/준비28에 없는 구성이다. 이번에는 BODYGUARD_TEST_NATIVE_NECK=1이 **전체26건에** 적용된다. 현재 signature의 Worker(9번째)/captured neck(10번째)/renderer 준비(11번째)를 구분했고 Worker·준비는 켜지 않았다. nativeCloses≥3의5초 poll·전체60초·retry0·가입 제한을 유지했다.

[원래 spec](original-nativehead.spec.ts.gz)의 모든 test callback 본문·guard·loop binding을 TypeScript AST로 정규화하여 현재 spec과 대조했다. 생성된26개 제목과 실제 report 제목도 모두 일치한다. [대조 실행](local-original-contract.stdout.txt.gz)과 [compare-original.mjs](compare-original.mjs)는 누락·본문 변경·특정 회귀 제외를 실패시킨다.

현재 main은 과거의 getNeckObservation 캐시가 아니라 **accepted frame의 evaluator와 observeCapturedNeckSide**를 사용한다. fixture는 같은 copied frame 하나만 임시 메모리에 두고 현재 actor/session 소유·세대와 현재 performance 시각으로 관찰한다. 원래 native VideoFrame 크기/presence를 사용하며 video/CSS 크기를 뒤늦게 가져오지 않는다. 종료/소유 회수·pause/새 세대에서 unavailable로 보류한다. snapshot에는 status와 고정 일치 boolean만 있고 관절·관찰 각도는 없다.

실제 Chrome **155.0.8059.40**, SDK1.0.1, Three0.186.1, AuthProvider/useRecordedCoaching/API/새 격리 PostgreSQL18에서 남녀13+13건과 opt-in 없는 기본12+12건이 각각 통과했다. 모두 skip/retry/flaky0이다. 가짜 장치/메일·기존 저작 fixture/양성 점·오류/진행 gate를 사용한 기술 시험이다. SDK blank의 실제 사람 검출은0이고 생성 양성은 올바른 자세·임상 classifier·동일인 확인이 아니다.

새 목 흐름에서 양성 비율 일치→낮은 presence→crop/multiple/none→복구→pause의 해제→세대2의 새 입력을 확인했고 verifiedMs/기록 제출0을 유지했다. 기존 흐름의 두 모델/시범·오류 강조·중단 기록·refresh/logout/server401/pagehide/unmount와 모델/카메라/SDK/입력 회수·GPU memory baseline을 유지했다.

## 기존 시작 P2는 닫지 않는다

원래 Chrome154의 최종13통과/13실패와 소스/실패 증거는 PR90에 보존한다. [당시 실패 요약](original-failed-summary.json.gz)도 원문 그대로 유지했다. 이번은 **현재 main/Chrome155의 원래 test body 구성 복원**이지 동일한 과거 환경/함수 경계의 재실행이 아니다. 준비비용/SDK·브라우저/host 조건의 인과 원인은 이번에 입증하지 않았다. 성공 반복으로 과거 실패를 지우거나 PR90/기존 시작P2를 해결로 표시하지 않는다. 준비 opt-in26/30·실제 Worker는 이번 미실행이다.

## 실패·검증 보존

- 구현 전 원래 test를 연결한 타입 검사에서 neckStatus와 setNeckPresenceHidden 누락4건/exit2를 확인했다. **타입 계약 실패이며 브라우저 assertion RED가 아니다.** 해당 test·base fixture·원문/receipt를 보존했다.
- 첫 DB 준비는 생성 전 bodyguard_test에 접속해 identity/exit2로 실패했다. 카메라/시험 실행 전 실패다. 서버는 정상 종료했고 새 DB를 만든 뒤 전체 흐름을 실행했다. 당시 driver/psql 원문·receipt를 보존했다. outer Node assertion은 대화 출력이며 별도 stderr 파일이 있다고 하지 않는다.
- 마지막 guard 명령은 존재하지 않는 파일명으로 module-not-found/exit1이었다. 실제 저장소의 check-selection-production.mjs로 바로잡아 실행했다. 잘못된 명령/원문/receipt를 보존하며 성공으로 세지 않는다.
- 시작 시 존재하지 않는 원래 문서 경로·Unicode workdir 오타·큰 도구 출력의 잘림은 대화의 조회/도구 오류다. 제품 RED/브라우저 실패 또는 별도 receipt가 있는 것으로 표시하지 않는다. 올바른 git 경로와 작은 출력으로 대조했다.

전체 FE1411·타입·Biome272·Node asset 준비/직렬 Vite public build·실제 public guard·diff를 통과했다. pnpm을 직접 호출한 통과가 아니라 기존 잠긴 설치본을 자체 복사한 **Node CLI/시험 dispatcher** 실행이다. 설치/보안 정책은 변경하지 않았다. API/DB 계약 변경0으로 전체 backend 단위 suite는 미실행이다. DB는 정상 종료하고 파일을 보존했다.

공개 JS355151/CSS31199 byte·SHA, 원본 A37 남녀 GLB와 저작 fixture, SDK5모델/6WASM 파일 SHA는 PR99와 동일하다. Blender 재저장/GLB export/새 조형0이다. PNG는 미완성 A37의 **아바타 canvas 및 합성 계정의 본인 중단 기록 화면**이며 실제 영상이나 최종 외형/디자인 미리보기가 아니다. 기존 사진 요구의 외형은 여전히 미완료다.

## 검토·남은 조건

engineering:debug로 원래26 구성/누락/실제·모의를 구분했고 engineering:code-review로 현재 소유·시각/세대·메모리/회수·기본 인자·입력 비율/presence·비공개 번들/증거·원래 본문과 실행 목록의 일치를 작성자가 검토했다. graphify의 `[captured, neck, native, startup]`은 경로 탐색만 도왔으며 과거26 계약/원인/최신 helper의 근거는 아니었다. 독립 에이전트/전문가 승인이 아니다. 이 좁은 하네스 복원 diff의 미해결 P1/P2는 발견하지 않았지만 **기존 시작P2는 별도 미완료**다.

실제 사람/물리 webcam/권한 popup/장치·조명·체형, 올바른 시범/classifier·최종 외형/권리·승인 공개 구조/SDK 정책·Docker/HTTPS·외부/운영·D2/전체1~6은 미완료다. 출시 동작0, 비용·계정·시크릿·운영 DB migration·배포·출시·중요한 안전/개인정보 변경의 별도 승인 경계를 유지한다. 텍스트는 짧은 제목·버튼·현재 코칭과 펼쳐 보는 설명·간결한 필수 안전 안내로 제한한다.

[manifest](manifest.json)의 증거275·현재 소스13개 길이/압축·해제 SHA, 원래26 목록/실행·기본24·정리/신뢰도·공개/원본/SDK 불변 검증을 실제 통과했다. hash 검증은 브라우저 재실행이 아니다. 원격 diff/CLEAN/체크/main 포함은 다음 별도 Git 게이트다.

```bash
node bodyguard/docs/review/native-neck-full-regression/compare-original.mjs
node bodyguard/docs/review/native-neck-full-regression/verify.mjs --current
```
