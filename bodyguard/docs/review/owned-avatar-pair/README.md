# 두 아바타 준비·실패·종료 연결

비공개 준비 자원을 실제 GLB와 연결했다. **외형 완성·웹캠 정확도·올바른 스트레칭·출시 코칭을 검증한 것은 아니다.**

## 작동하는 흐름

- 기존 남녀 GLB를 준비해 독립된 두 모델을 표시하고, 사용자 모델만 합성 관찰에 따라 움직인다. 원본과 비교 모델은 바뀌지 않는다.
- 종료하면 두 모델을 공간에서 분리하고 관찰·복제 자원·인수한 source를 정리한다. 취소된 load의 뒤늦은 반환도 모델을 다시 표시하지 않는다.
- 잘못된 리그는 준비 실패다. 새 소유 source로 명시 재시도하면 다시 준비할 수 있다. 이미 인수한 scene/모델 또는 공유 자원 alias는 거부하며 다른 소유자의 자원을 해제하지 않는다.
- 일부 정리 실패도 나머지 정리를 시도한다. 반환 전·과거 세대 정리 실패는 현재 세대까지 종료하고 재준비를 차단한다. 고정 오류만 전달한다.

[여성 실제 Chrome 화면](runtime-accepted-female.png)·[남성 실제 Chrome 화면](runtime-accepted-male.png)은 기존 미완성 A37의 기술 시험이다. 왼쪽은 중립 비교 모델, 오른쪽은 합성 관찰 모델이며 올바른 시범/최종 외형/승인된 제품 배치를 의미하지 않는다. 전신이 발끝까지 보이고 두 모델의 간격을 유지했다. 이미지·좌표는 사용자의 영상이 아니라 기존 GLB와 생성된 비개인 fixture다.

## 실제 검증 / 실패 보존

runtime `43696772a5dbd57d661ba24811fd1f6046d39ba4`의 실제 Chrome154·GLTFLoader·WebGL에서 남녀 각각 준비→움직임→종료→잘못된 리그 실패→명시 재시도→취소된 load의 늦은 반환→늦은 정리 실패/격리→종료를 통과했다. 카메라·추론 포트/관찰은 합성이다. 카메라 호출·외부 요청·페이지 오류0. 원본 source와 비교 모델 불변, 복제 자원/원본 정리 횟수·전후 GPU 메모리·코드/GLB SHA를 실제 대조했다.

전체 frontend826통과·실패0/skip0, Biome·타입·원래 assets→tsc→Vite build 순서·공개 guard 통과. 공개 JS355151byte/CSS31199byte는 PR65 출력과 byte 동일하며 공개 GLB0. 원래 버전 모델5개/lock을 대조해 로컬 build에만 사용했다. 실제 SDK를 실행한 것이 아니다. [summary.json](summary.json)은 63개 원본 log/JSON/PNG와 runtime11개 변경 파일의 SHA/Git blob을 기록한다. native 보고의 다른 의존 source SHA도 시험 전후 동일하다.

보존한 실패·보완은 다음과 같다.

- 미구현 준비 unit8실패, 기존 skinning의 실패 중 생성된 geometry/material 정리 누락2실패를 실제 재현했다. 검증 실패 시 부분 생성 자원도 정리하도록 보완했다.
- 구조 검사를 복제 전으로 앞당긴 후, ‘복제 뒤 실패’ 시험이 이전 누락 부위를 사용해 복제 정리 횟수1을 기대하면서1실패했다. 조기 거부를 유지하고 이 fixture를 **복제 후 발견되는 중복 endpoint**로 바꾸어 부분 복제 정리를 실제 확인했다. 빈/미연결 body 거부는 별도 시험으로 유지한다.
- 첫 타입 검사는 fixture의 readonly 속성 변경으로 실패했다. 실제 Mesh로 해당 fixture를 구성했다. probe의 Promise<void> 불일치와 source texture 집합의 DataTexture 추론 오류도 각각 보존하고 보완했다. 각 실패 뒤 이어질 build/native는 실행하지 않았으며 최종 타입/build는 실제 통과했다.
- 첫 native는 남성의 종료까지 수행한 뒤 texture0 기대에서 실패했고 여성은 미실행이었다. 모델 geometry0·복제/원본 정리 횟수는 모두 충족했지만 texture1이 남았다. 설치된 Three의 `WebGLRenderer.js`→`DFGLUTData.js`를 읽고, 아바타를 load하기 **전** PBR 보정용 작은 plane을 한 번 렌더·즉시 geometry/material 정리해 공용 LUT baseline(geometry0/texture1)을 실제 확인했다. 이 plane은 아바타 대용이나 미리보기가 아니다. 재시도/실패/종료마다 모델 자원은 같은 baseline으로 돌아왔다. 외부 renderer를 이 자원이 파괴하지 않으며 **엔진 전체 GPU 종료 완료를 주장하지 않는다**.
- 첫 공개 CSS 관측은31228byte로 기존보다29byte 컸다. 시험 제목의 영어 `invisible`이 Tailwind utility를 만든 것을 실제 출력에서 대조했다. 시험 의미/assertion 변경 없이 제목만 바꾼 뒤 최종 JS/CSS byte 동일 검사를 통과했다. 첫 관측 hash/원인과 build 원본을 summary에 기록했다.
- 추가 작성자 검토에서 새 scene이 다른 lease의 texture를 공유하는 경우도 발견해, 자원 단위 alias 예약·거부와 fresh 자원만 정리하는 경계를 보완했다. 소유 모델 alias·공유 texture·재진입 dispose·늦은 source 정리 실패→controller 격리의 추가 시험을 통과했다. 이 추가 시험들을 최초 RED8의 실행 범위로 소급하지 않는다.
- 새 private marker의 소유 leak sentinel을 실제 dist에 넣으면 guard가 실패했다(exit1). 그 검증용 파일만 제거하고 guard를 다시 통과했다(exit0). 최종 배포 출력에는 sentinel이 없다.

초기 잘못된 조회 경로의 명령 실패와 한 apply_patch 중복 경로 거부는 제품 시험이 아니다. 원래 후보 작업트리의 추적 파일1959개 삭제 상태·과거 GLB/Blender·검증 증거는 수정/복구하지 않았다.

## 작성자 검토 / 남은 조건

testing-strategy/code-review를 사용해 source/복제 독립성, 부분 실패/자원 alias, 재진입·중복/abort·늦은 세대·정리 실패/고정 오류, 세션의 전역 cleanup 실패 처리, 공개 bundle 격리를 작성자 검토했다. 이 변경 범위의 미해결 P1/P2는 발견하지 않았다. 독립 에이전트·전문가 승인이나 제품 전체 P2 해결은 아니다.

SDK/카메라/판정·임계값·API/SQL·CI·Blender/GLB 조형·제품 UI·개인정보 정책·운영/배포 변경0. scene 반환 전 loader의 부분 실패 정리는 loader 책임이다. 시험은 기존 에셋의 geometry/material/skeleton/texture GPU 수명이며 향후 이미지 에셋/실제 detector/worker·렌더러 전체 해제의 최종 통합 검증을 대체하지 않는다.

텍스트 최소화와 승인된 디자인 방향은 유지한다. 제품의 클릭 가능한 구조/적용 범위 승인·D2-A/M/T/R/I/P·실측/참여자·Docker/HTTPS/공급자/운영·전체1~6 필수 기준은 여전히 미완료다. Docker 읽기 확인은 daemon socket 없음으로 실패했다. SDK 정책·외부/운영 승인을 우회하지 않는다. PR65 source18b9fc0→merge2c4ec7f/main 포함·같은 tree·소스 브랜치 보존을 확인하고 그 최신 main에서 시작했으며 이 Story도 최신 diff/HEAD/CLEAN/체크/충돌의 조건부 게이트를 통과한 뒤에만 병합한다.
