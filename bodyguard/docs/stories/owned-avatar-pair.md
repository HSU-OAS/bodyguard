# S2.T3 — 두 아바타의 준비·실패·종료 소유권

상태: 비공개 구현·검증 통과 / runtime `43696772a5dbd57d661ba24811fd1f6046d39ba4` / baseline `2c4ec7f581e847288acbb0b2ae32d3c0bb7e1d00` / `codex/owned-avatar-pair`

FR-A-01/02/03·FR-M-07·NFR-07/08. S2.T2의 관찰 연결을 실제 소유권이 있는 아바타 준비 자원으로 묶는다. loader가 반환한 새 소유 GLB scene·두 cloned skeleton·사용자 rig를 함께 관리한다. 준비 실패·abort·종료·뒤늦은 load에서 원본/복제 자원을 정리하고 과거 모델을 준비 완료로 쓰지 않는다. 이 자원 준비는 **외형·시범·카메라·판정·코칭의 출시 적격성 증거가 아니다**.

## 범위·수용 기준

1. 명시적인 loader/context만 사용한다. 생성만으로 카메라/SDK/공개 화면/운영 요청0. 이미 종료된 세대·잘못된 구성은 load를 시작하지 않는다. loader의 부분 생성 후 reject 정리는 loader 책임이며 반환된 새 scene의 소유권만 이 자원이 인수한다.
2. 실제 source의 명시 bone→anchor·eight-weight 구조와 두 독립 skeleton을 검증한 뒤에만 반환한다. 실패 시 생성된 복제 geometry/material/depth/skeleton도 정리한다. mesh/가중치/관절 구조를 단순화하거나 source를 정답 자세로 보정하지 않는다.
3. 취소된 load가 뒤늦게 반환되면 새 source를 정리하고 고정 asset 실패로 끝낸다. 다른 세대의 반환이나 source alias로 현재 소유 객체를 파괴하지 않는다. 이미 인수한 scene은 재사용하지 않는다.
4. 살아 있는 세대에만 models/관찰을 제공한다. abort/명시 dispose에서는 두 모델을 부모에서 분리하고 사용자 rig·복제 GPU 자원·소유 source를 멱등 정리한다. 외부 renderer나 camera/SDK는 파괴하지 않는다.
5. 한 정리가 실패해도 다른 정리를 수행한다. 고정 ResourceCleanupError만 전달한다. 반환 전·과거 세대 cleanup 실패도 controller의 현재 세대를 차단하며 새 준비를 성공 처리하지 않는다. Draft36의 독립 정리 오류 계약만 재사용하고 SDK/카메라/개인정보 정책 코드는 도입하지 않는다.
6. 합성 Three 객체에서 실패/late/alias/abort/정리 경계를 RED→GREEN으로 검증하고, 실제 Chrome·GLTFLoader·WebGL 남녀 기존 GLB의 준비→움직임→취소/종료→실패→명시 재준비를 검증한다. 카메라/추론 포트와 관찰은 합성이며 raw 영상·좌표 저장/전송·로그0이다.
7. 전체 frontend·타입/Biome/assets/build/공개 guard·source/증거 SHA·작성자 리뷰·diff/HEAD/CLEAN/체크를 실제 통과한 경우에만 사전 승인 PR 게이트를 진행한다. 실패/미실행은 보존한다.

testing-strategy로 결정적 경계 시험과 실제 GLB/native 시험을 분리한다. code-review의 자원 누수·중복/재진입 dispose·늦은 응답·정리 실패·source 격리를 검사한다. 공개 HTML/제품 디자인/판정·에셋/Blender 조형·API/SQL·SDK 통신·CI·시크릿·운영/배포는 변경하지 않는다. 남녀 A37은 미완성 검수용이며 올바른 시범이 아니다.

D2-A/M/T/R/I/P·디자인/SDK 승인·Docker·실측/참여자·외부/운영 및 전체1~6 필수 조건은 유지한다. PR65 실제 merge2c4ec7f/main 포함·source와 같은 tree·브랜치 보존을 확인하고 그 최신 main에서 시작했다. 현재 Docker 읽기 확인은 daemon socket 없음으로 실패했으며 연결/실행 완료로 표시하지 않는다.

## 실행 결과

[실제 흐름·미리보기·실패·남은 조건](../review/owned-avatar-pair/README.md). frontend826·실제 Chrome 남녀2개 자원 흐름·정적/타입/assets/build/guard·공개 byte 동일/source/63증거 SHA를 통과했다. 최소 문구 원칙과 미승인 제품 UI 경계는 유지했다. 엔진 PBR 공용 캐시1은 별도 renderer baseline이며 전체 GPU 종료를 완료로 세지 않는다. 추가 alias/재진입/controller 시험은 최초 RED8과 구분한다. 원본·GLB/Blender·같은 부위 조형 변경0. 출시 적격 동작0·D2-A/M/T/R/I/P·전체1~6과 실제 웹캠/최종 아바타/공개 코칭은 미완료다. 조건부 PR 게이트를 진행하며 비용/계정/시크릿/운영 migration·배포/출시는 하지 않는다.
