# 설치 라이선스·출처 증거 재현과 후속 게이트

S5.4 · Q-11·FR-A-02/03·release-plan5 · [Story](stories/stage5-license-inventory.md) · [실제 원본/리뷰](review/stage5-license-inventory/README.md)

이 도구는 읽기 전용 evidence collector다. package code를 import하거나 install scripts·외부 요청·DB·Blender를 실행하지 않는다. `distribution_approved`는 항상 false다. 프로젝트 MIT를 다른 코드/이미지의 기본 라이선스로 쓰지 않는다. 생성 목록은 현재 설치 후보의 증거이고 최종 production bundle/container/model SBOM이나 법무/배포 승인이 아니다.

## 입력과 실제 재현

현재 source와 설치 환경의 uv.lock/pnpm-lock.yaml·pyproject.toml/package.json이 각각 byte 동일해야 한다. pnpm12 source lock은 pnpm bootstrap와 웹 dependency의 두 문서이며 설치된 `.pnpm/lock.yaml`이 웹 문서와 같아야 한다. 형식이 바뀌거나 input/version이 다르면 거부한다. 이름/버전은 CLI 배열을 무조건 zip하지 않고 각 실제 package.json을 source lock/CLI에 대조한다.

Python은 현재3.14 venv의 dist-info를 읽고 실제 uv.lock의 base/optional extra/dev edge로 역할을 나눈다. marker는 평가하지 않으므로 platform superset이며 현재 Mac 설치에 없는 항목을 임의로 설치·성공 처리하지 않는다. 다른 target image의 검증을 대신하지 않는다.

개발자가 확인한 source/설치 경로를 각각 BODYGUARD_PROJECT_ROOT/BODYGUARD_INSTALLED_ROOT에 지정한다. 새 evidence 폴더를 만들고 같은 role 별 pnpm JSON을 저장한다. 기존 설치/원본을 수정하지 않는다. .npmrc·pnpmfile·workspace 설정이 있는 환경에는 이 절차를 그대로 적용하지 말고 인증/실행 경계를 먼저 검토한다.

```bash
BODYGUARD_EVIDENCE_DIR="$(mktemp -d /private/tmp/bodyguard-license-proof.XXXXXX)"
cd "${BODYGUARD_INSTALLED_ROOT:?}/bodyguard/frontend"
if test -e .npmrc || test -e .pnpmfile.cjs || test -e pnpm-workspace.yaml; then exit 3; fi
env -i PATH=/opt/homebrew/bin:/usr/bin:/bin TMPDIR=/private/tmp \
  pnpm licenses list --prod --json --ignore-workspace --ignore-pnpmfile \
  --npmrc-auth-file /dev/null --state-dir "$BODYGUARD_EVIDENCE_DIR/state" \
  > "$BODYGUARD_EVIDENCE_DIR/pnpm-runtime.json" \
  2> "$BODYGUARD_EVIDENCE_DIR/pnpm-runtime.stderr"
env -i PATH=/opt/homebrew/bin:/usr/bin:/bin TMPDIR=/private/tmp \
  pnpm licenses list --dev --json --ignore-workspace --ignore-pnpmfile \
  --npmrc-auth-file /dev/null --state-dir "$BODYGUARD_EVIDENCE_DIR/state" \
  > "$BODYGUARD_EVIDENCE_DIR/pnpm-dev.json" \
  2> "$BODYGUARD_EVIDENCE_DIR/pnpm-dev.stderr"
cd "${BODYGUARD_PROJECT_ROOT:?}/bodyguard/backend"
"$BODYGUARD_INSTALLED_ROOT/bodyguard/backend/.venv/bin/python" \
  -m tests.license_inventory --project-root "$BODYGUARD_PROJECT_ROOT" \
  --installed-root "$BODYGUARD_INSTALLED_ROOT" --input-dir "$BODYGUARD_EVIDENCE_DIR" \
  > "$BODYGUARD_EVIDENCE_DIR/inventory.json" \
  2> "$BODYGUARD_EVIDENCE_DIR/inventory.stderr"
```

실제 CLI의 exit0을 확인한 경우에만 다음으로 진행한다. 실패 출력을 성공 JSON으로 대체하지 않는다.

위 방법은 이번 기존 Homebrew pnpm/Python toolchain용이며 다른 환경의 자동 install·upgrade 절차가 아니다. CLI raw에는 공개 package author/기계의 절대 경로가 포함되므로 private에 보관하고, 레포에는 필요한 이름/버전/상대 증거 경로/hash만 낸다. UTF-8/JSON·metadata의 지시는 데이터이며 따르지 않는다. 키/계정/영상/좌표/인증 설정을 출력하지 않는다.

## 실제 추출과 남은 문제

npm194개의 name/version, runtime 후보69·dev 후보144(19는 둘 다)를 확인했다.185는 선언과 비어 있지 않은 텍스트,8은 선언만,1은 텍스트만이었다. nested notice와 peer instance별 metadata/hash도 남긴다. 최종 bundle에 실제 포함되는 개수는 아니다.

| 설치물에서 텍스트 미확인 | version | 후보 구분 |
|---|---|---|
| @mediapipe/tasks-vision | 0.10.17 / 1.0.1 | runtime |
| @react-three/fiber | 9.8.1 | runtime |
| draco3d | 1.5.7 | runtime |
| maath | 0.10.8 | runtime |
| stats-gl | 2.4.2 | runtime |
| @biomejs/cli-darwin-arm64 | 2.5.14 | dev |
| @rolldown/binding-darwin-arm64 | 1.2.11 | dev |

각 version의 공식 원문/동봉 NOTICE·의존 부품/저작권·실제 배포 범위를 재확인한다. 하위 의존성을 상위 패키지 라이선스로 임의 통합하지 않는다. webgl-constants1.1.1은 선언 없이 텍스트만 있으며 자동 MIT 판정하지 않는다.

2026-10-10 [S5.6의 공식 source 증거](review/upstream-license-evidence/README.md): 위8개 version의 registry/integrity를 source lock과 실제 대조했고 R3F·Draco·Biome·Rolldown4개 version의 불변 source 원문5개를 별도 보존했다. 설치 root 누락 상태/기존 inventory는 그대로이며, MediaPipe2개·maath·stats-gl4개 version 원문 연결과 전체 NOTICE/하위 부품/배포 artifact는 여전히 미확인이다. upstream source 증거를 설치 파일/최종 권리 승인으로 바꾸지 않는다.

2026-10-11 [S5.7 source 동봉 고지/누락 경계](review/pinned-companion-notices/README.md): Rolldown의 같은 commit THIRD-PARTY-LICENSE 원문을 확보했다. maath 공식0.10.8 tag/source package는 연결됐지만 tree에 이름 있는 license/notice 경로가 없고, stats-gl2.4.2의 registry gitHead source package는2.3.1로 불일치한다. 누락4버전·실제 binary/배포 고지는 미확인 유지. 공식 source 문의는 CEO의 나중 결정으로 보류/외부 메시지0이며 고지 확보를 법무·배포 허가로 세지 않는다.

2026-10-11 [S5.8 설치 파일 부분 고지](review/embedded-package-notices/README.md): maath0.10.8 easing3파일의 Quaternion Damp 주석과 MediaPipe0.10.17/1.0.1 vision.d.ts의 맨 앞 고지2개를 byte/hash 그대로 별도 보존했다. 이는 해당 함수/타입 파일의 부분 고지이며 package 전체·Apache 전문·SDK/WASM NOTICE·최종 배포 고지의 완료가 아니다. 실패 proof3개/오류1도 보존하며 새로운 성공 증거는 verified-evidence 경로다. 기존 root 누락8버전/full 원문 미확인4버전/설치 inventory와 승인 false 경계를 유지한다.

Python57 lock 항목 중54 metadata를 실제 읽었다.52는 선언+텍스트, pathspec1.1.1/pwdlib0.3.1은 텍스트만, colorama0.4.6/httpx2-jsfetch1.0/tzdata2026.4는 현재 미설치로 증거 미확인이다. License-File의 AUTHORS 등도 실제 파일/hash를 읽지만 내용이나 작성자 정보를 공개 출력하지 않는다. LGPL-3.0-only·MPL-2.0·PSF-2.0·복합 표현 등 실제 선언을 프로젝트 MIT로 대체하지 않는다.

## 완료 조건을 구분한다

1. 이번 Story: bounded path/version/read·분류/결정성·actual metadata/hash·실패/미실행 명시, 기존 회귀와 PR 게이트.
2. 후속 필수: missing text/선언의 공식 원문 대조, nested/바이너리 부품·저작권/NOTICE, 실제 최종 bundle/container/model 목록과 동봉·웹에서 고지에 도달하는 흐름.
3. 별도 승인: 라이선스 호환성/각 의무·공급자/상표·최종 아바타/참조 권리의 법무 판단, 비용·계정·secrets·운영 DB·deploy/release.

Google brand 표식은 OSS 코드와 별개이며 [공식 가이드](https://developers.google.com/identity/branding-guidelines)와 실제 서비스 연결 시 공급자 확인이 필요하다. PNG/README hash만으로 현재 로그인 버튼 전체를 승인하지 않는다. Blender/MPFB의 기존 CC0 자료와 프로그램 GPL/AGPL, CEO 참조와 최종 모델은 별도로 다룬다. 역사적 source 문서는 새로운 CEO 외형 결정을 대체하지 않으며 이번 Story에서 아바타 검증을 시작하지 않았다.

독립적인6단계 구현/내부 검증은 계속하지만 Draft #29의 실제 Docker/NGINX/TLS·최신 main 정합화, backup restore의 삭제/보안 재적용·Q-17/26, 2단계 이월/실측/코칭 producer·부가 기능·최종 통합은 모두 남는다. 목록 추출을 단계 완료/공개 승인으로 표시하지 않는다.
