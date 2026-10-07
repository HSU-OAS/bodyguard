# S2.T2 — 같은 관찰 결과에서 사용자 리그로 연결

상태: 비공개 구현·첫 실제 Chrome 통과 / 최종 source·PR 게이트 진행 / baseline `48d315461720377f757f80d039a95a3b916ca2f2` / `codex/observed-avatar-pose`

FR-A-01/03·FR-M-02/07·NFR-07/08. S2.T1의 실제 GLB driver 앞에 세대·원본 timestamp/sequence와 한 번의 pose 결과를 받는 비공개 adapter를 연결한다. pose image/world를 서로 다른 최신 저장소에서 읽지 않는다. 영상/좌표를 저장·업로드·로그에 넣지 않는다. 공개 화면·SDK 통신 정책·실제 판정·Blender/GLB 외형은 변경하지 않는다.

## 수용 기준

1. 원본 generation/sequence/at를 유지한다. 시작·재시작의 과거 callback, 역행/중복/만료 frame은 최근 유효 관찰을 덮지 않는다. caller가 수신 시각으로 재표기해 오래된 입력을 살리는 방식을 사용하지 않는다.
2. 하나의 결과 안에 image/world가 각각 한 사람이고 33점인 경우에만 같은 index pair를 읽는다. 사람이 없거나 복수이거나 결과가 불일치하면 빈 관찰을 전달해 추적 coverage를 즉시0으로 만들고 회전은 동결한다. 첫 사람을 임의 선택하거나 이전 좌표를 재사용하지 않는다. 모델의 검출 수는 실제 인원 보장이 아니다.
3. 기존 visibility/in-frame 규칙과 명시 mirror를 그대로 사용한다. 가려진 endpoint·비유한 값은 해당 사지 방향을 전달하지 않는다. full-body 기준 충족과 partial 화면 추적은 별개이며 어떤 coverage도 성공 판정/타이머를 만들지 않는다.
4. 실제 cloned GLB의 명시 binding만 사용하고 source/기준용 다른 리그를 변경하지 않는다. frame 객체/배열은 보관하지 않으며 방향을 복사한다. getter/provider 오류는 raw 내용을 노출하지 않고 adapter를 종료한다. abort/dispose는 멱등이고 외부 GPU 자원을 직접 파괴하지 않는다.
5. 결정적 Three.js unit으로 단일/다중/불일치/가림/시간/세대/복사/종료 경계를 확인하고 실제 Chrome·GLTFLoader·WebGL의 남녀 기존 GLB에서 단일 결과→움직임→가림/복수 보류→새 결과 복구→종료를 확인한다. 관찰 입력은 합성이며 실제 SDK/웹캠·임상 판정 시험이 아니다.
6. 전체 frontend·타입/Biome/build/공개 guard·현재 source 및 증거 SHA·작성자 리뷰를 통과한다. 공개 JS/CSS와 GLB 포함 여부를 비교하고 최신 diff/exact HEAD/CLEAN/체크 후에만 사전 승인 PR을 병합한다. 실패·모의·미실행은 구분한다.

## 하네스와 후속

Unit은 source의 33점 결과 모양을 가진 합성 point만 사용한다. browser는 Git에 보존된 PR9 A37 남녀 GLB를 임시로 읽고 실제 GPU에서 렌더한다. 기준 쪽은 중립 배치 비교용이며 **올바른 스트레칭 시범이 아니다**. private 기술 화면은 긴 설명 없이 짧은 미완성/합성 고지만 유지하고 제품 디자인 승인으로 세지 않는다.

D2-A/M/T/R/I/P 및 전체1~6 기준은 그대로다. 실제 SDK와 카메라의 소유 포트는 Draft #36의 개인정보 승인/검증 이후 연결한다. 몸통/목/손·축 비틀림·실제 카메라 좌표계/오차/지연·올바른 시범/적색 피드백·참여자·최종 외형/성능·공개 코칭·디자인 구조/제품 적용·외부/운영은 이번 범위에서 완료하지 않는다.

## 구현·실패와 작성자 검토

- 동일 결과의 image/world와 원본 세대/순서/시각만 사용한다. 한 사람33점·기존 visibility/화면 범위·명시 mirror와 실제 bone→anchor 연결을 확인한다. 여러 사람/불일치/없음은 새 빈 관찰로 coverage를 즉시0으로 만들며 현재 local 회전은 동결한다. 가려진 사지는 새 frame에 포함하지 않는다. 회전 동결이 관측/정답을 뜻하지 않는다.
- 처음 미구현 adapter의 unit15실패→첫42통과(기존 driver/skin 포함). 잘못된 descendant anchor를 관절로 연결하는 경계를 RED15통과/1실패로 재현해 정확한 source anchor 표를 재사용했다. 문자열 world 좌표의 암묵 변환과 제곱 길이 overflow는 RED16통과/2실패로 확인하고 finite 원값·안정적인 방향 정규화로 보완했다. 임상 각도/수치·visibility 기준을 만들거나 바꾸지 않았다.
- 첫 typecheck는 fixture의 Group/Object3D 타입 오류로 실패했고 probe build는 미실행이었다. 이어진 첫 browser 명령은 bundle 없음으로 브라우저 실행 전 실패(검증0). 타입을 실제 Object3D 계약으로 수정했으며 원본 실패를 보존했다.
- 첫 실제 Chrome과 후속 진단은 남성 초기 로드 뒤10초 대기 초과, 여성 미실행이었다. clock RED에서 `captureRegressed:true`와 고정 `private-frame-rejected`를 실제 확인했다. fixture가 RAF frame-start 시각과 중간 performance.now capture를 섞어 원본 시간 검사를 위반했다. 새로 생성하는 합성 결과의 capture clock만 통일했다. adapter의 시간/세대 검사는 그대로이며 제한을 늘리지 않았다. 진행 대기에는 저비용 peek를 쓰고 실제 skinned 전신 정점은 단계별 snapshot에서 계속 검사한다.
- 첫 정상 Chrome에서 남녀 각각 단일8방향 움직임·crop4방향/하체 local 동결·복수/불일치/없음0·복구8·만료0·종료를 통과했다. source/비교 모델 불변·실제 목표 방향·전신 발끝·독립 뼈대도 확인했다. 15°/50ms/250ms와0.002rad는 **합성 그래픽 fixture 입력/오차**이며 운동 정답·실측 성능이 아니다. 비교 모델은 중립 배치이지 검증된 시범이 아니다.
- 공개 출력의 첫 대조는 worktree마다 다른 basename을 같다고 가정해 파일 읽기 전 실패했다. 확장자/SHA로 실제 비교하니 JS는 같지만 새 unit의 변수 이름 때문에 Tailwind utility29byte가 추가됐다. assertion/의미 변경 없이 그 변수 이름만 바꾸고 build/대조를 다시 실행한다. CSS 설정이나 공개 화면을 변경하지 않는다.
- 원본 A37 남녀 GLB는 PR9 Git blob에서 임시로 읽고 hash를 대조했다. 기존 Blender/GLB/실패 증거·후보 작업트리 삭제 상태를 수정하지 않는다. 같은 부위 조형0이며 외형 P2는 그대로다. API/SQL·운영·SDK/카메라를 이번 증거로 세지 않는다.
- graphify는 legacy camera/useMeasurement 경로를 보여 현재 source와 대조했다. testing-strategy/code-review로 원본 보존·프레임/가림/세대·문자 변환/수치·정확한 binding·종료·공개 차단을 작성자 검토했다. 독립 에이전트/전문가/디자인 검토가 아니며 전체 출시 기준은 미완료다.
