# 검증 번들 고지

`../evidence/probe-{first,second,delivery,final}.js.gz`와 raw-head-regression-probe.js.gz는 BODYGUARD 시험 entry와 변경하지 않은 설치 npm 의존성의 Vite 합성 결과다. 각 원본 gzip/SHA를 보존하며 제품 배포/법무 승인으로 쓰지 않는다.

- three0.186.1: MIT, Copyright © 2010-2026 three.js authors. [설치 LICENSE 그대로](three-MIT.txt).
- @mediapipe/tasks-vision1.0.1: package.json의 Apache-2.0 선언. [canonical Apache-2.0](Apache-2.0.txt)을 인접 보존한다. 설치 root LICENSE/NOTICE는 없어 미검증이며 canonical text를 설치 원문이라고 부르지 않는다. raw head 회귀는 SDK 없이 Three를 사용한다.

원본 코드의 고지/SPDX를 보존했다. SDK/WASM/model의 전체 권리·NOTICE와 최종 배포 법무 검토는 S5/D2 게이트에 그대로 남는다. 제품 정책·라이선스 선택·외부 계약 변경0.
