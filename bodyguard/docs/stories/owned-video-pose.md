# S2.T5 — 새 영상 프레임 → 추론 → 사용자 아바타

상태: 명세·하네스 작성 / baseline `d1743c49509d782a888e55ed4da406a270985ca4` / `codex/owned-video-pose`

FR-M-01/02/07·FR-A-01/03·NFR-07/08. S2.T4의 동일 결과 전달 경로에 브라우저의 실제 decoded-frame 공급자를 연결한다. 공개 코칭/판정이나 실제 사람 정확도 완료를 뜻하지 않는다.

## 수용 기준·시험 계획

1. 이미 열린 video/stream·세대·명시 detect만 받는다. 생성/잘못된 구성만으로 카메라/SDK/프레임 획득0. caller가 인증·camera/detector를 소유하고 이 source 종료를 기다린 뒤 해당 자원을 해제한다.
2. requestVideoFrameCallback에서 원본 now/presentedFrames/mediaTime을 한 번 읽는다. 중복/잘못된 stamp·다른 stream/종료된 track은 추론하지 않는다. 새 timestamp·정답·person 선택을 만들지 않는다.
3. VideoFrame으로 픽셀을 브라우저 메모리 안에 고정한다. 재사용 canvas나 해상도 축소·녹화/입력 screenshot/export0. 한 추론 결과의 image/world만 기존 소유 경계로 전달한다.
4. VideoFrame과 SDK 결과를 정상/취소/late/실패에서 모두 닫는다. 한 close 실패가 다른 close를 막지 않는다. 부분 공급자 cleanup 실패도 ResourceCleanupError로 남기고 source를 재개하지 않는다.
5. dispose/abort는 대기 frame callback을 취소·종료시키고, 진행 중 inference 반환의 정리까지 기다린다. 과거 callback/stream 교체·track 종료는 현재 관찰을 전달하지 않는다. caller 소유 stream/다른 영상은 이 source가 stop/detach하지 않는다.
6. 결정적인 unit으로 중복·callback 재진입·late/abort·부분 실패·정리 실패·stream/track 변경을 시험한다. 실제 Chrome 가짜 카메라→실제 SDK→남녀 기존 GLB 흐름을 시험 전용 CSP/거부 proxy에서 확인한다. 실제 카메라 popup/사람 자세 정확도와 구분한다.
7. 전체 frontend·타입/Biome/assets/build/guard·공개 byte·소스/증거 SHA·작성자 리뷰와 최신 PR 게이트를 실제 통과하면 조건부 병합한다. 실패·미실행을 보존한다.

testing-strategy로 unit(소유권/순서/취소)·native integration(실제 fake MediaStream·VideoFrame·SDK·GLB)·실제 참여자 검증을 분리한다. 관절/진단 수치·SDK 제품 통신 정책·외형/Blender·미승인 UI/공개 경로·API/SQL·CI/시크릿·운영은 변경하지 않는다. SDK의 현재 TexImageSource/displayWidth API를 로컬 설치 소스/타입에서 확인했고 실제 지원 여부는 native 시험으로 확인한다. 임의 fallback으로 품질 기준을 낮추지 않는다.

D2-A/M/T/R/I/P·SDK/디자인 승인·Docker/외부·실제 참여자/운영과 전체1~6 완료 기준은 유지한다.
