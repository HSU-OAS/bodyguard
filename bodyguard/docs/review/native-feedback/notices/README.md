# 검증 번들 추가 고지

runtime d4f475c의 보존된 `probe.js` region에서 MediaPipe, React, React DOM,
scheduler, Three의 실제 포함을 확인했다. Three는 기존 `three-MIT.txt`,
React/React DOM/scheduler는 같은 설치 버전의 LICENSE 원문을 byte 그대로 보존한다.

MediaPipe Tasks Vision1.0.1은 실제 package.json의 Apache-2.0 선언과 기존
native-body-head 증거의 canonical Apache-2.0 원문을 인접 보존한다. 설치 root
LICENSE/NOTICE는 없어 미검증이며 canonical text를 설치 원문이라고 부르지 않는다.

[추가 고지 SHA](extra-notices.json)는 별도 기록이다. 먼저 생성한413파일 manifest는
그대로 보존하며 이 후속 파일들이 원래 manifest에 포함됐다고 주장하지 않는다.
SDK/WASM/model의 전체 권리·NOTICE·제품 배포 검토는 S5/D2 필수 조건으로 남긴다.
라이선스 선택·외부 계약·제품 출력/배포 변경0이다.

첫 수집은 scheduler의 transitive 패키지를 flat root에 가정해 ENOENT였다.
원문/receipt를 `initial-notice-copy.*.gz`로 보존하고 실제 react-dom 의존성의
설치 경로에서 resolve했다. 이미 복사한 원문은 byte를 확인하고 덮어쓰지 않았다.
