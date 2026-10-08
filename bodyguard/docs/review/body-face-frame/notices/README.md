# 시험 번들 고지

`../probe.js.gz`는 BODYGUARD 시험 코드와 변경하지 않은 설치 의존성의 부분을 Vite가 합성한 검증용 번들이다. 원본 npm library/JS를 수정하지 않았으며 시험 entry의 compile/tree-shaking 결과다. 제품 배포물이나 법무 승인으로 사용하지 않는다.

- `three@0.186.1` — MIT. [설치 원문](three-MIT.txt), Copyright © 2010-2026 three.js authors. 실제 package LICENSE의 byte를 그대로 보존한다.
- `@mediapipe/tasks-vision@1.0.1` — 설치 package.json의 Apache-2.0 선언. [공식 Apache 원문](https://www.apache.org/licenses/LICENSE-2.0.txt)을 [함께 보존](Apache-2.0.txt)한다. 설치 root LICENSE/NOTICE가 제공되지 않은 것은 누락으로 그대로 기록하며 canonical text를 설치 원문이라고 부르지 않는다. package 출처는 Google MediaPipe이며 지원·승인·진단 효과를 의미하지 않는다.

원본 번들의 SPDX/저작권 주석을 보존했고 두 원문 고지를 인접해 제공한다. 실제 bundler 식별 목록과 core source 불변은 [notice-proof.json](../notice-proof.json)이다. 별도 고지 build는 작업 위치로 region 경로 주석이 달라 byte 동일이 아니며, 해당 주석만 제외한 실행 코드 동일을 별도로 확인했다. native 시험에 사용한 원래 번들은 바꾸지 않았다. 원본 SDK/WASM/모델의 전체 NOTICE·권리·최종 배포 고지와 법무 검토는 기존 S5/D2 게이트에 남는다. 이번 고지 보완은 제품 법무 정책·판매/국가/약관·라이선스 선택의 변경이 아니다.
