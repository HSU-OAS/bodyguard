# S2.T10 — native 자원 연결과 카메라 복구

상태: 구현·초기 native 복구 검증 / baseline708c6a0171d8719af4dce7f4834cb05a1558dc72 / codex/native-camera-recovery / runtime 회귀·리뷰/PR 게이트 대기

FR-M-01/02/07·FR-A-01/03·FR-S-02/04·FR-U-04·NFR-07/08. 이전 S2.T9의 native 조합을 실제 재사용 adapter로 연결한다. 시작 전 native 획득0·명시 시작/취소·안전한 종료·명시 새 준비/재시작을 지원한다. 아직 공개 consumer는 없으며 미검증 에셋/판정·미승인 디자인/SDK 정책을 활성화하지 않는다.

## 수용 기준·하네스

1. adapter는 기존 openCamera·landmarker·ownedAvatarPair·videoPoseSource·ownedPlaybackResources를 연결한다. 명시 pose 모델/새 source loader/거울·보간·만료 설정과 caller renderer/scheduler만 받는다. 판정/임계값/기본 출시 에셋·모델을 결정하지 않는다. 원본 영상/좌표는 메모리만 사용한다.
2. 생성/계정 준비로 카메라/SDK/모델0. 권한 거부·busy·not-found·unknown을 고정 종류로 보존하며 native error 문구/계정/좌표를 노출하지 않는다. 취소 오류는 사용자 거부로 오인하지 않는다.
3. camera/SDK 준비 중 취소·실패에서 늦은 소유 자원 및 partial work를 정리한다. 정리 실패는 기존 fail-closed 장벽을 유지한다. 입력/결과가 정리되기 전 활성 native SDK/camera를 닫지 않는다. 준비 실패가 성공/저장으로 이어지지 않는다.
4. 종료/권한/연결 오류 뒤 새 bridge·명시 새 준비와 시작으로 복구한다. 자동 카메라 재획득/동작 성공·기록 생성0. 외부 연결 대기 중 독립 native 작업만 진행한다.
5. 단위: 카메라 오류 분류·late camera/SDK 취소·partial/cleanup 실패·명시 모델/rig·fresh bridge/생성 무획득·source/native detect 연결. 실제 API/Chrome/격리 SQL: 브라우저 권한 거부→해제/새 준비, 지연 camera 반환 중 취소→늦은 stream 종료, 실행 중 native track 끊김(시험 이벤트), 아바타 HTTP 실패→정리→명시 재시도. SDK/GLB/RAF는 실제, 촬영/메일/motion gate·보류/끊김 유발만 합성이다.
6. 전체 frontend/타입/Biome·변경 runner Ruff·assets/build/공개 guard, 기존 계정-native 회귀·공개 JS/CSS/모델 byte 동일·GLB0·source SHA/실패 원본·작성자 리뷰·최신 PR 조건을 검증한다. 테스트 camera/input 스크린샷0.

권한 시험은 실제 Chrome 권한 설정을 사용하되 사람이 popup을 누른 검증이 아니다. 연결 끊김 유발은 실제 케이블 분리가 아니다. 실패한 SDK 내부 allocation의 완전 해제·전체 GPU/worker·물리 webcam/사람/오판정/외형/다장치 품질·승인 공개 UI/SDK 정책·운영/HTTPS는 이 Story 증거로 통과시키지 않는다. 이월 D2/전체1~6 기준, 같은 부위 새 조형 금지·원본 보존·최소 문구·별도 승인을 유지한다.

## 초기 작동 흐름·실패

실제 Chrome 권한 denied에서 native 요청이 거부되고 준비/저장으로 이어지지 않는다. 권한 복구 뒤 새 준비·명시 시작으로 다시 재생한다. 늦은 가짜 native stream은 취소 후 종료되며 새 준비가 이전 정리를 기다린다. 실행 중 native track stop과 합성 ended 이벤트, 실제 GLB HTTP404에서도 종료·정리 후 명시 새 시작을 확인했다. 실제 SDK/남녀 GLB·계정 API/격리 SQL을 같은 흐름에서 사용했다. 미검출의 검증 시간/완료 수행을 만들지 않았다.

첫 단위 시험은 module 미구현으로 suite 실패(실행 assertion0)였고, 구현 후에는 DOM 환경 누락으로13중12 실패였다. happy-dom을 명시하고13을 통과했다. 첫 브라우저8흐름 중4 실패는 권한 설정과 시험 snapshot의 종료 사유 접근 문제였다. 결과의 reason을 읽도록 고치고 fake UI 자동 허용을 제거했다. 다음 실행은 권한 설정용 CDP 연결을 너무 일찍 종료해 denied가 prompt로 초기화되면서2 실패했다. 별도 실제 Chrome 권한 시험에서 이 인과를 재현하고, native 요청/재시도까지 해당 연결을 유지해8을 통과했다. 테스트 조건을 낮추거나 가짜 NotAllowedError로 대체하지 않았다.

재시작 검증은 누적 이전 frame이 아니라 **새 시작 이후** frame 증가를 기다린다. 카메라/input 스크린샷0이고 PNG는 기존 미완성 A37의 아바타 canvas만이다. 초기 launcher receipt의 nativeSdkOrGlb=false는 metadata 실수이며 실제 native 실행을 부정하거나 모의 통과로 바꾸지 않는다. 후속 receipt를 수정하고 잘못된 원본도 보존한다. 전체 회귀·정적/build/공개 byte/source SHA·리뷰/최신 PR 조건은 runtime에서 다시 검증한다.
