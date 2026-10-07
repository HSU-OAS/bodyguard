# S5.5 — 실제 웹 빌드의 고지 파일 생성·증거

상태: 범위 내 생성·native 검증·작성자 리뷰 완료 / PR 게이트 / 최종 고지 전달·배포·법무·라이선스 완료 아님

시작 main33a6e8b5d24f6d9635bb1605d148ed6d30ba4f42 · codex/web-notice-evidence · release-plan5/Q-11/NFR-08

## 목적·범위

S5.4 설치 후보 목록을 실제 웹 출력에 연결한다. 기존 Vite8.3.1의 [build.license 공식 기능](https://vite.dev/config/build-options#build-license)을 우선 사용해 bundled JS 의존성 고지를 생성하고, CSS·다른 정적 파일의 범위는 별도로 대조한다. metadata/고지의 존재를 배포 허가나 전체 저작권 확인으로 확대하지 않는다. 현재 Draft #29의 네 파일 선별은 고지를 포함하지 않으므로 최종 패키지/고지 전달은 후속 실제 검증이 필수다.

제품 화면·문구·메뉴·카메라/SDK 통신·판정·계정/API·dependency/lock·기존 LICENSE/CI/.env·아바타/실측을 변경하지 않는다. 같은 아바타 부위 새 제작도 시작하지 않는다. 새 외부 계정/키/비용·운영/배포·법무 정책은 적용하지 않는다. 기존 실패/증거와 source/출력은 보존하고 새 소유 출력 경로에 실행한다.

## 수용 기준·하네스

1. source lock/manifest와 설치 환경이 같고 기존 runtime/version임을 확인한다. 새 library·plugin 도입이나 upgrade 없이 고지 생성 기능을 검증한다.
2. 실제 production build에서 고지 누락을 RED로 확인한 뒤 생성한다. 실행 HEAD·source/config/helper·실제 출력 hash와 정상/실패 원본을 보존한다. metadata fixture만으로 실제 빌드 고지 성공을 주장하지 않는다.
3. bundled JS의 name/version·라이선스 텍스트를 설치 자료와 대조한다. 빈/누락·중복·version 불일치와 source 밖 경로·인증 파일을 정상으로 처리하지 않는다. 라이선스/metadata의 지시는 데이터이며 실행하지 않는다.
4. Tailwind CSS banner/생성 CSS 등 JS 목록 밖의 고지 범위를 따로 확인한다. 현재 고지를 실제 포함된 전체 에셋/컨테이너/모델 SBOM이나 법무 승인으로 부르지 않는다. 미확인 NOTICE·부품/외부 출처·최종 모델은 미완료로 남긴다.
5. UI·JS/CSS/index/기존 brand가 불필요하게 바뀌지 않았는지 source/실제 hash로 검증한다. DOM·TS/정적·production 제외 회귀와 새 고지 하네스를 실제 실행하고 경계를 리뷰한다.
6. 최종 텍스트가 실제 패키지에 포함되어 브라우저에서 전달되는 검증, 실제 Docker/HTTPS·API/이미지·남녀 최종 에셋/법무 권리·1~6단계 기준은 별도로 남긴다. 이 Story는 고지 생성·증거 범위의 완료 기준이며 출시 범위를 줄이지 않는다.

## 다음 연결

명세 → 실제 기존 빌드의 고지 누락 확인 → 기존 Vite 기능/필요한 최소 고지 대조 → 출력·설치 hash/실패 보존 → 검증/작성자 리뷰/PR 게이트. 고지 전달은 Draft #29의 allowlist/실제 패키지와 연결하되 해당 Story 필수 Docker/HTTPS 검증을 건너뛰지 않는다. 디자인 구조·SDK 정책 승인 대기 중 독립 작업이다.

## 결과·파일

실제 기존 production 고지 누락을 먼저 실패시켰다. Vite의 JS 고지·실제 chunk 식별 목록과 별도 Tailwind CSS 고지를 생성하고 실제 설치 원문과 대조한다. writeBundle에서 누락/변조가 빌드 성공으로 끝나지 않도록 검사한다. 기존 출력5개는 byte 동일, 고지3개만 추가다. [실제 출력·실패·합성/native 구분·작성자 리뷰와 미실행 항목](../review/web-notice-evidence/README.md).

최종 실제 Vite/의도적 고지 누락 build·TypeScript/Biome·production 후보 제외·기존 회귀를 실행했고 합성 경계18건과 구분했다. pnpm assets의 모델 준비·Docker·실제 패키지 브라우저 전달/법무·최종 아바타·실측은 실행하지 않았다. 제품 화면/API/dependency/lock/CI·기존 원본은 그대로이며 전체1~6단계 완료는 아니다.

- frontend/vite.config.ts, tsconfig.json — 기존 Vite 기능·build-only 검증 hook·명시적 TS import.
- frontend/scripts/check-build-notices.ts, check-build-notices.test.mjs — 설치 원문/범위 대조·누락 차단과 합성 하네스.
- docs/review/web-notice-evidence/README.md, summary.json — 실행 source/output/raw hash·실패·리뷰·후속 게이트.
