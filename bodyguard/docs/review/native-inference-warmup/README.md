# S6.18 — 재생 전 첫 추론 준비

한 번의 실제 decoded frame을 같은 소유 source로 처리하고 결과를 버린 뒤 ready를 연다. 첫 live 프레임은 source의 원래 sequence/media/time 경계를 이어받는 새 입력이다. 준비 결과는 observe/evaluator·코칭·타이머·기록에 전달하지 않는다. 기본 경로는 준비 opt-in이 없고 공개 화면·문구·SDK 정책·아바타 파일은 바꾸지 않았다. [Story](../../stories/native-inference-warmup.md).

## 작동하는 흐름

camera → SDK → 두 모델/GPU 준비 → 준비용 첫 추론(선택) → ready → 새 프레임 재생이다. 같은 source를 한 번만 만들며 준비 read와 재생을 분리한다. 취소 시 capture를 즉시 무효화하고 pending read/source retirement를 마친 뒤 SDK를 닫는다. 늦은 완료는 ready나 재생을 되살리지 않는다. 준비 실패·cleanup 실패를 보존하고 새 generation은 이전 회수 뒤에만 카메라를 연다.

실제 Chrome154/155·lite/face/hands SDK·Three WebGL·보존 A37 남녀 GLB(25a9bd6)를 사용했다. 최종 normal16조건은 renderer 준비를 모두 켜고 warmup만 바꿨다. fresh context·고정 교차 순서·직렬 실행·retries0·기존 ready 뒤5초 세 번째 delivery 기준이다. 가짜 카메라에 실제 사람은 없으며 조건당1회, normal CPU만 시험했다. 실제 노트북의 사람 코칭·FPS·임상 정확도 증거가 아니다.

| 최종 관찰 | 준비용 추론 없음 | 준비용 추론 있음 |
|---|---|---|
| main ready 이후 첫 copied result | 840.0~952.2ms | 57.1~69.5ms |
| main ready 이후 RAF stamp 쌍의 최대 공백 | 799.9~933.3ms | 50.1~66.7ms |
| main 준비 완료 | 713.1~1016.5ms | 1579.2~1588.9ms |
| Worker ready 이후 첫 copied result | 1035.6~1423.4ms | 59.3~78.0ms |
| Worker 준비 완료 | 716.3~788.0ms | 1523.8~1579.6ms |

첫 body/face/hands 동기 호출의 phase가 실제 preparing으로 옮겨진 것을 main 계측에서 확인했다. **비용을 제거한 것이 아니다.** main 전체 관찰 RAF 공백은 준비 포함 약800~833ms로 남는다. 여성 main의 시작→첫 결과는 준비 없음1560.8/1580.4ms, 준비 있음1648.2/1648.7ms로 오히려 길었다. 캐시/순서/실제 사람 조건을 통제한 전체 시작 개선이나 기존 PR90/101 시작 P2 해결로 표시하지 않는다. Worker 내부 SDK 비용을 main 호출 비용으로 환산하지 않았다.

최종 취소4조건은 actual main SDK body 호출 이후 **시험 전용 result-return 장벽**을 세웠다. 취소→늦은 return 뒤 ready/live delivery/render0, 입력 frame 회수1:1, 카메라 ended, storage0이다. GPU/CPU 실제 행이나 물리 권한 팝업 취소의 재현이 아니다. 정상16에서 source 입력 frame 회수, 카메라 ended, Worker 생성/종료1:1, storage0을 확인했다. 요청 라우터 외부 요청/pageerror0은 이 통제 시험의 관찰이며 CSP 이전 SDK 통신 시도 전체를 계측한 것은 아니다.

## 실패·계측 보완·보존 한계

- 최초 pnpm 실행은 auto-install의 sandbox DNS 실패로 검사 전 중단했고 중단 요청 exit130이다. 별도 offline install도 캐시 tarball 부재로 실패했다(대화 출력). 잠금/정책을 끄지 않고 기존 잠금 설치본을 자체 복사해 Node CLI로 실제 검사를 실행했다. pnpm 검사 통과로 쓰지 않는다.
- 실제 최초 ownership RED는3실패/23통과이다. 당시 전체 test source 스냅샷은 따로 없고 원문 로그만 있다. 이후 구현/확장 source와 로그를 보존한다. 최초 patch 문맥 오류는 도구 실패이며 assertion으로 세지 않는다.
- 첫 타입 검사는 존재하지 않는 unavailable 호출1오류, 다음은 합성 frame이 result 경계를 빠뜨린3오류였다. 실제 타입/프레임 경계로 보완하고 재검증했다. 첫 Biome도 새 driver 포맷 실패였으며 원문을 남겼다.
- 첫 Chrome154 비교는 전체 unit 실행과 초반에 겹쳐 부하 대조로 부적절했다. 첫 RAF 계측은 pre-ready stamp가 늦게 전달되면 preparing 비용을 running 공백에 섞었다. 최초8개 report·driver·fixture source를 보존하고 재생 이후 stamp 쌍만 집계하도록 고쳤다. 전체 공백·first/third/ready 원시 시간은 별도 유지한다. 5초 기준을 늘리지 않았다.
- 최초 probe JS는 다음 build로 덮어써 원본 바이너리 자체는 남지 않는다. 첫 report의 hash·driver/fixture source는 남으며 원본 bundle까지 보존했다고 주장하지 않는다. 이후 reviewed-probe와 최종 probe·Worker는 별도 보존한다.
- 중간 Chrome1558조건은 재진입 안전 guard/atReady 계측 추가 전 bundle이다. 최종16+취소4는 현재 코드로 다시 실행했다. 서로 다른 bundle을 동일 최종 검증으로 합산하지 않는다.

영상·관절 배열·얼굴 행렬·계정·프레임 스크린샷 저장0이다. 결과에는 고정 조건/기술 시간·source frame 회수 개수만 있다. GLB는 보류 후보 bytes 그대로이며 Blender/GLB/외형 수정0이다. 미완성 아바타를 최종 미리보기로 공개하지 않는다.

## 검증·작성자 리뷰

최종 FE1479/74파일·타입·Biome(기존 info6)·assets·public build/guard를 실제 통과했다. 새 준비/취소/실패/교체/재진입 합성 시험은15건이다. 공개 JS354600/CSS31199 byte 및 SHA가 PR104와 같다. 실제 Auth/API/SQL·원래26·운영 DB·Docker/HTTPS·배포·실제 사람/물리 장치·실제 매끄러움·임상/최종 시범/외형은 이번 미실행이다.

engineering:debug로 첫 비용과 RAF phase 계측을 분리하고 testing-strategy로 준비 결과/취소/source retirement/SDK close·새 owner/실패를 먼저 검증했다. engineering:code-review 기준으로 작성자가 보안·소유권·재진입/부분 회수·실패 전파·기본 호출 불변·판정 비적립·계측 한계를 검토했다. 소스 factory가 close를 재진입한 뒤 준비 callback을 실행할 수 있던 경로는 live 재확인과 회귀로 보완했다. 이 좁은 private 준비 opt-in 범위의 미해결 P1/P2는 발견하지 않았다. 전문가/독립 리뷰나 기존 시작 P2 종료로 표시하지 않는다.

graphify의 일반 render/prepare/startup DFS는 최신 첫 추론 연결을 입증하지 못했으므로 dead_end로 기록하고 직접 소스를 읽었다. 공개 디자인 적용/SDK 제품 승인·실제 참여자·최종 외형/시범·D2·전체1~6 완료 기준은 남는다. 최소 텍스트 원칙(짧은 제목·버튼·현재 코칭, 펼쳐 보는 설명·필수 안전 안내)과 별도 승인 경계를 유지한다.

증거의 hash/길이와 현재 소스 검증은 브라우저 재실행이 아니다.

증거140·현재 소스11의 압축/해제 SHA·길이·브라우저 bundle/재빌드 동일성·public byte/원본 GLB hash를 실제 검증했다. 최종 정적 검사에는 새 collector도 포함했고 추가 오류0(기존 info6)이다. 최초/중간/최종 report를 같은 성공으로 합산하지 않는다.

```bash
node bodyguard/docs/review/native-inference-warmup/verify.mjs --current
```

로컬 결과 뒤 원격 diff/CLEAN/체크·정확한 HEAD·merge commit·main 포함을 별도 확인한다. 미리 병합/출시 완료로 기록하지 않는다.
