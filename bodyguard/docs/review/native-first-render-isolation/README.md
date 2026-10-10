# S6.14 첫 렌더 준비와 SDK 비용 분리

비공개 코칭 자원에 renderer 소유 준비 장벽을 추가했다. 두 모델의 GPU 준비가 끝나야 재생 가능 상태가 된다. 준비 중 취소/실패하면 늦은 완료가 재생을 되살리지 않고 카메라·SDK·모델을 회수한다. 공개 화면이나 출시 아바타를 완성한 것이 아니다. [Story](../../stories/native-first-render-isolation.md).

## 실제 작동 흐름

기존 같은 lite/얼굴/손 모델·A37 남녀 원본 GLB·640×480 가짜 카메라·1440×900 renderer를 사용했다. 명시적 prepareAvatar만 선택적으로 받으며 기존 기본 main 경로는 그대로다. 같은 두 모델을 장면에 붙이고 compileAsync와 첫 실제 render를 준비 단계에서 마친 뒤 재생한다. 모델·재질·조명·화질을 낮추지 않았다.

실제 Chrome fresh context·retries0·normal/4× CDP에서 main/명시 Worker·남녀·준비 유무를 고정 교차16조건으로 대조했다. CDP가 실제 OS/Worker에 동일한 부하를 준다거나 특정 노트북 성능을 대표한다고 주장하지 않는다.

| 관찰 | GPU 준비 없음 | GPU 준비 있음 |
|---|---|---|
| 최종 재생 후 첫 render | 154.3~564.1ms | 1.0~5.8ms |
| 준비 단계의 실제 첫 render | 없음 | 122.4~546.4ms |
| 최종 main 최대 재생 RAF 공백 | 816.5~1816.5ms | 799.9~1816.7ms |
| 최종 Worker 최대 재생 RAF 공백 | 250.0~966.6ms | 116.7~499.9ms |

렌더 비용을 없앤 것이 아니라 재생 이전으로 옮겼다. 첫 main SDK 처리의 동기 비용도 따로 관찰했다. baseline에서 몸·얼굴·손 첫 호출 합계818~1793ms였다. Worker 내부 SDK 비용을 main 시간으로 만들지 않았다. 완전히 매끄러운 코칭이나 시작 P2 해결은 아니다.

최종16조건은 세 번째 copied native delivery를 ready 뒤5초 안에 관찰했다. 이 count는 사람 검출/올바른 수행/시간 적립이 아니다. Node 대기와 브라우저 응답 시점이 전체 관찰 구간을 달라지게 하므로 render 수를 고정5초 FPS/개선율로 환산하지 않는다.

실제 Chrome 취소2조건은 compile 시작 이후 시험 전용 준비 장벽을 세운 뒤 취소·장벽 해제를 수행했다. ready/관찰/재생 render/준비 draw 모두0, 최종 cancelled, 카메라 track ended·Worker 생성/종료1:1·storage0이다. 실제 GPU 정지/행/hardware 고장을 재현한 시험은 아니다. 정상16·취소2에서 외부 요청0/pageerror0을 관찰했으며 제품 SDK 정책 승인/전 조건 무통신 증거로 확대하지 않는다.

원시 프레임·몸/얼굴/손 배열·행렬·계정은 읽거나 출력·저장하지 않았다. 시간 계측은 각 stage 첫3호출만 기록한다. 시안/스크린샷0·공개 구조/문구 변경0·새 조형/GLB 변경0이다. 미완성 아바타를 최종 외형으로 공개하지 않는다.

## 실패와 한계

- 첫 shader-only 시도는 재생 첫 render120.9~609.1ms로 불충분했다. 실제 buffer/texture 업로드를 ready 이전으로 옮긴 뒤 재검증했다. 이 실패 bundle/source/report를 보존한다.
- 중간 reviewed 비교의 **male/main/4× 대조군 third6047.1ms >5000ms**는 실패다. 해당 실행의 exit0/harnessPassed는 계측·정리가 작동했다는 뜻이며 성능 전 조건 PASS가 아니다. 이후 최종16 정상 결과로 이 실패나 PR90의13/26 실패·기존 시작 P2를 닫지 않는다.
- 최초 unit RED는 준비 장벽/회수의5실패였다. 확장 unit의1실패는 독립 actor cleanup 실패를 outer controller close에서도 throw해야 한다는 잘못된 시험 가정이었다. 실제 actor의 반복 close 실패·cleanup notice·다른 자원 회수·ready 차단을 검증하도록 경계를 바로잡았다.
- 최초 unit RED 당시 test 전체 소스 스냅샷은 따로 보존하지 않았다. 실행 원문/receipt와 base core·최초 구현 core를 보존하며 최초 test binary/source가 모두 있다고 주장하지 않는다. 확장 실패 test 전체 소스는 보존한다.
- 최초 실제 취소2조건은 회수/재생 차단은 맞았으나 fixture가 cancelled를 prepare-error로 오표기해 실패했다. 내부 actor 취소 신호와 stopped를 반영하고 최종 소스/bundle로 실제 재실행했다.
- sandbox 취소 재실행은 127.0.0.1 listen EPERM으로 제품 실행 이전 실패했다. 원문 보존 후 로컬 전용 권한으로 수행했다. pnpm 최종3명령은 자동 설치가 캐시 node_modules 링크를 거부해 검사 이전 실패했다. 잠금/정책을 끄지 않고 동일 설치본의 Node CLI로 타입/Biome/전체 FE를 실제 실행했다.
- 상태 분석용 임시 one-liner의 report 필드 오류, 도구의 undefined 경로 patch 실패와 ps sandbox 거부는 제품 RED가 아니다. 해당 도구 출력만 대화 기록에 있으며 원본 command receipt가 있다고 주장하지 않는다. undefined 경로에는 파일을 만들지 않았다.
- 최초 증거 포장은 보류 후보 GLB가 main에도 있을 것으로 잘못 가정해 실패했다. 후보는 Draft PR9/25a9bd6에만 있으며 실제 시험은 그 원본 bytes를 읽었다. 기존 gzip을 덮어쓰지 않고 내용 일치를 확인해 재사용한 preserve-final로 수정했다. 첫 script도 보존한다. manifest 생성 전 verify의 ENOENT와 문서 patch 문맥 오류는 실행 순서/도구 실패이며 제품 검증으로 세지 않는다.

## 실행·검토·보존

최종 전체 FE1404/71파일·타입·Biome270·public Vite build·공개 guard를 실제 실행했다. pnpm build 자체가 아니라 별도 타입 확인과 Vite build다. 공개 JS355151/CSS31199 byte·SHA는 PR97과 같으며 private core hook만 변경했다. 실제 Auth/API/SQL 통합26·nativeCloses·실제 사람/물리 카메라/다장치·권한 popup·올바른 동작/classifier·최종 외형/권리·Docker/HTTPS·배포는 이번 미실행이다.

최초/불충분/중간/최종 fixture·bundle·worker·기술 report·실패와 성공의 원문/receipts를 gzip으로 보존한다. baseline-source는 첫 계측 소스, shader-only/first-probe는 첫 GPU shader 소스, reviewed-source는 취소 원인 수정 전 업로드 포함 소스, final source는 source-nativeContentionProbe.ts다. 중간 reviewed 실행이 이미 Node에 로드한 driver는 compare-before-cancel.mjs이며 최종 driver는 compare.mjs다. 원본 GLB는 기존25a9bd6 bytes 그대로이고 hash를 기록했다. 별도 기록을 지우거나 덮어쓰지 않는다.

[manifest](manifest.json): gzip 해제 SHA/길이와 source/base 차이, 모델·WASM·GLB/public hash를 검증한다.

```bash
node bodyguard/docs/review/native-first-render-isolation/verify.mjs
node bodyguard/docs/review/native-first-render-isolation/verify.mjs --current
```

engineering:debug의 원인 분리와 engineering:code-review의 준비/취소·부분 회수·이전 세대 차단·개인정보·계측 경계를 작성자가 검토했다. graphify의 기존 지도는 관련 경로 확인에만 사용했으며 실제 비용/최신 hook의 근거가 아니다. 전문가나 독립 리뷰로 표시하지 않는다.

최종 diff/소스 검토에서 이 좁은 준비 장벽 범위의 미해결 P1/P2는 발견하지 않았다. 기존 시작 P2를 해결/면제한 것이 아니다. 기술 증거103·소스13의 gzip/hash·현재 소스 일치 검증은 실제 통과했다. 원격 PR diff·CLEAN·체크·main 포함 확인은 다음 별도 Git 게이트다.

이 좁은 준비 보완과 별도로 시작 P2·첫 추론/화면 지연·승인 공개 구조/SDK 정책·실제 수행자/관찰자·D2·전체1~6 완료 조건은 미충족이다. 텍스트는 아바타/움직임 중심의 짧은 제목·버튼·현재 코칭, 펼쳐 보는 설명과 간결한 필수 안전 안내로 제한한다. 비용·계정·시크릿·운영 DB·배포·출시 등 별도 승인 경계는 유지한다.
