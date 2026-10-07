# 실제 웹 빌드 고지 — S5.5

현재 Vite production 출력에 bundled JS 원문 고지·식별 목록과 Tailwind CSS 원문 고지를 생성하고, 누락/변조 시 빌드를 실패시킨다. 제품 화면·메뉴·문구·SDK 통신·판정·계정/API는 변경하지 않았다. **최종 패키지에서의 전달·법무 승인·전체 1~6단계 완료는 아니다.**

## 실제 실행과 결과

시작 main `33a6e8b5d24f6d9635bb1605d148ed6d30ba4f42`의 `codex/web-notice-evidence`에서 실행했다. Node24.20.0/pnpm12.6.0/Vite8.3.1이며 새 dependency/버전·lock 변경은 없다. 첫 offline 설치는 `ERR_PNPM_NO_OFFLINE_TARBALL`로 실패했다. frozen 설치는 기존194개를 재사용해 다운로드0으로 성공했고 package/lock 원본과 기존 설치 reference가 같았다. 최초 실패는 대화 원본에, 이후 install 원본은 private 실행 폴더에 보존한다.

실제 기존 Vite production 빌드는 성공했지만 별도 고지는 없었고, 새 checker가 exit1로 실패했다. 최종 생성물은 JS4개 패키지(react/react-dom19.3.0, react-router8.4.0, scheduler0.28.0)의 version·identifier·root license 원문을 실제 설치 파일과 대조한다. JS chunk에서 독립 추출한 name/version 목록으로 고지 항목 누락도 검사한다. Tailwind4.3.3은 JS 목록 밖 CSS 제작 경로로 별도 고지를 둔다. 실제 CSS에는 Tailwind banner가 없으며 그 부재를 성공으로 바꾸지 않았다.

[Vite 공식 build.license](https://vite.dev/config/build-options#build-license)를 사용했다. 설치 Vite의 실제 구현은 JS chunk의 node_modules root license만 읽고 asset은 건너뛰므로 CSS를 별도로 보완했다. 새로운 라이선스 라이브러리는 도입하지 않았다. 빌드 전용 hook이며 개발 서버/UI runtime에서 고지를 읽거나 새 화면을 만들지 않는다. 명시적 `.ts` import를 위해 기존 noEmit TypeScript 설정의 allowImportingTsExtensions만 추가했다.

기존 출력5개(JS/CSS/index/brand PNG/brand README)는 최종 비교에서 **byte 동일**하다. 고지3개만 추가됐다. 공개 증거는 [summary.json](summary.json)의 실행/원본/source/output SHA다. 실행 HEAD는 시작 main이고 구현은 당시 uncommitted였다. 기록된 코드4개 SHA가 실제 최종 build의 source manifest와 같음을 확인했으며 후속 증거 커밋 자체를 실행했다고 주장하지 않는다.

최종 native 경계18건은 **합성 fixture**다. 실제 Vite 출력 대조·의도적으로 license:false를 넣은 private 설정의 native 실패(exit1, missing bundled-js.json)와 구분한다. 실제 DOM/순수 회귀693건·42파일, TypeScript/Biome, production 후보 제외 검사를 실행했다. production Vite build와 TypeScript를 분리 실행했으며 `pnpm assets`의 모델/WASM 준비·전체 `pnpm build`는 이번에 호출하지 않았다. 정상 코드의 실제 파일과 실패한 출력/원본은 모두 보존했다.

원본은 `/private/tmp/bodyguard-web-notice.Oemyww`의 실행 log/JSON·baseline/첫 생성/최종/negative 출력에 있다. 공개본에는 원문 절대 경로·오류 stack·dependency author를 옮기지 않았다. 원본 hash로 연결하며 PII를 지운 원본이라고 부르지 않는다. 초기 CLI fixture는 URL.pathname의 한글 경로 인코딩 때문에1건 실패했고 fileURLToPath로 보완했다. 초기 build의 extension 경고도 원본에 남기고 명시적 import 후 실제 최종 build에서 사라졌다.

## 작성자 리뷰

documentation·testing-strategy·code-review로 실제 diff/source와 실패 원본을 확인했다. 별도 리뷰어/하위 에이전트 검토를 주장하지 않는다. Graphify는 옛 자료 위치 확인에만 사용했고 현재 artifact 판단은 실제 출력/설치 자료에서 했다.

- 보완: 항목별 원문 대조만으로 빠진 package를 놓칠 수 있어 실제 chunk 식별 목록을 추가했다. 같은 name/version의 중복, 버전/원문/identifier 변경, 누락, credential-shaped/범위 밖 symlink는 거부한다. 고지를 비활성화한 실제 build가 실패하므로 checker를 수동으로 실행해야만 막는 구조는 아니다.
- 경계: metadata·라이선스의 지시는 데이터로만 읽고 package code/network/API를 실행하지 않는다. CLI 오류는 고정 문구다. 읽기 크기/항목 수 제한은 있고 설치 디렉터리는 frozen 설치 뒤 변경하지 않는 로컬 빌드 입력이다. 적대적인 동시 filesystem 교체·최종 image 전체 secret scan 검증으로 확대하지 않는다.
- 성능·정합성: 빌드 때만 설치 증거를 읽는다. 실제 화면의 기존 JS/CSS가 동일하며 public 카메라/판정/계정 경계를 바꾸지 않았다. 범위 내 미해결 P1/P2는 없고 아래 후속 필수 기준은 그대로 남긴다.

## 재현·남은 연결

같은 lock으로 frontend 의존성을 준비한 뒤 `pnpm typecheck`, `node --test scripts/check-build-notices.test.mjs`, `pnpm exec vite build`, `node scripts/check-build-notices.ts`, `node scripts/check-selection-production.mjs`, `pnpm test`, `pnpm check`를 실행한다. 이미 존재하는 실패/증거 폴더를 다시 빌드 대상으로 덮지 않는다.

Draft #29의 실제 exporter/NGINX에 이 고지3개를 연결하고 브라우저에서 올바른 content-type/본문으로 전달되는지 확인해야 한다. 현재 #29는 고지를 제외하고 있어 이번 Story만으로 runtime package 완료를 선언하지 않는다. 프로젝트 MIT/LICENSE, root 밖/nested NOTICE, Google 표식, 최종 WASM/모델·아바타, API/컨테이너 구성과 법무·공급자 권리는 별도 확인이 필요하다. 실제 Docker/HTTPS·운영 복구/보안·외부 계정·실제 참여자/실측·최종3D·코칭 producer·승인된 디자인 구조·전체 출시 게이트도 미완료다.
