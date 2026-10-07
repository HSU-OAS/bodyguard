# 영상 프레임 → 실제 추론 → 아바타 전달

runtime `73a3e9961e91fa1ce59938ca24bb03606eaf7b1f` · baseline PR #67 merge `d1743c49509d782a888e55ed4da406a270985ca4`. 비공개 연결이며 공개 코칭/최종 아바타가 아니다.

실제 Chrome154.0.8037.98의 **가짜 카메라 → native VideoFrame → MediaPipe1.0.1 → 남녀 A37 GLB**를 연결했다. 각 모델에서 새 프레임6개 전달→멈춘 decoder의 대기 read 취소→명시 재준비/전달1개→종료를 실행했다. source 종료 중에는 caller 카메라를 유지하고, 전체 종료 때 실제 track ended·video 분리·SDK close·model 분리를 확인했다.

[native 원본](browser-runtime.json) · [남성 실제 WebGL](runtime-male.png) · [여성 실제 WebGL](runtime-female.png) · [SHA/범위](summary.json). 영상은 Chrome의 생성 패턴이며 실제 사람0이다. 사람을 검출하지 않은 결과는 관찰0으로 유지한다. PNG는 기존 미완성 A37의 **아바타 canvas만** 촬영한 것으로 입력 영상이나 최종 외형·올바른 시범이 아니다.

## 실제 검증·실패

- 브라우저의 원본 callback now/presentedFrames/mediaTime으로 프레임을 고정한다. 해상도 축소/입력 export·다른 사람 선택·각도/정답 생성0. 추론 결과와 입력을 정상/abort/late/실패에서 닫는다.
- 최초 source stub [11실패](video-unit-red.log), 기존 프레임 경계의 공급자 부분 cleanup 태그 손실 [1실패/18통과](partial-cleanup-red.log)를 재현하고 수정했다. 후속 경계는 GREEN 추가 시험이며 최초 RED라고 소급하지 않는다. TrackedFrame 생성자 overload의 실제 TypeScript 실패도 [보존](types-native-first.log)했다.
- 최종 source16/기존 frame19·전체861 frontend, 타입/Biome·캐시 assets·Vite build·공개 guard 통과. guard 새 marker는 실제 실패1 후 해당 시험 파일만 제거해 통과0. 공개 JS355151/CSS31199 bytes/SHA는 PR #67과 동일하다. 공개 GLB0.
- 정확한 runtime native: 남녀 각각 VideoFrame7·SDK 결과 close7·detector close1, input clone의 실제 InvalidStateError로 닫힘 확인. 중복 dispose·늦은 callback·stream 교체/track 종료·한 cleanup 실패 뒤 나머지 정리는 unit 경계다. 실제 권한 popup/물리 webcam 오류는 미검증이다.
- 기존 blank/합성 긍정 흐름은 커밋 직전 [2통과](browser-blank-regression.json). 기록한 source SHA14개가 현재 runtime과 같지만 실행 HEAD는 baseline이므로 exact runtime 재실행이라고 표기하지 않는다. fake-camera 경로의 실행 HEAD는 실제 runtime이다.
- native camera API2(가짜), CSP connect 차단2, 외부 routed0/pageerror0. 거부 proxy11건은 주소/내용을 수집하지 않아 원인을 분류하지 않는다. 시험용 차단일 뿐 **제품 SDK 정책은 승인 대기**다. raw 입력·실제 관절 데이터 저장/로그/전송0.
- source18개·보존45개(읽기용 로그/원본 gzip7개 포함) SHA를 검증했다. 읽기용 EOF만 정리했고 원본 gzip을 해제해 scratch 원본과 byte 동일함을 확인했다. Git 공백 검사 정책은 유지한다. 모델5개·GLB/lock·SDK 버전 변경0.

## 작성자 리뷰

code-review로 순서/소유권·한 pending read·callback 재진입/취소·source 생성/부분 실패·SDK/input close 실패·세대/stream/track·로그/외부 통신·공개 경계를 검토했다. 공급자 cleanup 태그 손실은 위 RED로 보완했고, 외부 context 스냅샷/정리 계속 수행은 코드 검토에 따른 방어이며 별도 실패 재현으로 표기하지 않는다. 범위 내 미해결 P1/P2는0, 독립 리뷰는 아니다.

renderer는 geometry0/공용 PBR texture1 baseline으로 복귀했다. 이는 전체 GPU/worker 메모리 해제·장시간 안정성·실제 fps/전력 기준을 충족했다는 증거가 아니다.

## 남은 출시 조건

실제 물리 webcam/사람 자세·가림·촬영 범위 정확도, 손/얼굴/목/체간/축 비틀림, 검증된 시범/오류 부위 피드백, 최신 사진의 Blender 원본/GLB·외형/변형, 공개 코칭→본인 기록, SDK 정책·전체 자원 수명, Docker/TLS·외부 계정/운영·실제 참여자 노트북 시험은 남는다. 출시 적격 동작0, D2-A/M/T/R/I/P·전체1~6 미완료. 같은 부위 조형·미승인 화면·API/SQL·CI·시크릿·운영/배포 변경0. 비용·계정·중요 안전/개인정보·배포/출시는 별도 승인을 유지한다.
