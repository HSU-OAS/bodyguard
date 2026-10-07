# S5.4 — 라이선스·출처 증거 목록 기초

evidence 기초 PR #31 main 병합 · 시작 main4599c7c830cdfee786d21df460976fc5efe1c46a · codex/stage5-license-inventory · release-plan5단계·Q-11·FR-A-02/03

## 목적·선행 상태

S5.3 [PR #30](https://github.com/HSU-OAS/bodyguard/pull/30)은 source8d077eb20bdd089e688a8ca972f4312cb039cf8c·필수 native/경계5개·전체266개·작성자 리뷰/보완·CLEAN/MERGEABLE·**체크 없음**을 확인한 뒤 merge4599c7c830cdfee786d21df460976fc5efe1c46a로 병합했다. main 포함과 로컬/원격 source 브랜치 보존을 확인했다. 운영 restore의 삭제/보안 재적용은 [별도 승인 게이트](../stage5-backup-restore-runbook.md)로 남아 있고 전체5단계 완료가 아니다.

S5.2 [Draft #29](https://github.com/HSU-OAS/bodyguard/pull/29)는 source1336d3d830ebab64cf6c1ce75acf94a71f53cda9·OPEN/Draft·체크 없음이며 main 갱신 후 **DIRTY/CONFLICTING**이다. 실제 Docker/NGINX/TLS 실행뿐 아니라 최신 main 정합화도 남았다. 원본을 리셋/덮거나 필수 실행을 건너뛰어 병합하지 않는다. Docker 연결 요청에 답을 기다리면서 이번 독립 작업을 진행한다.

기존 main 루트 LICENSE는 MIT·Copyright(c)2026 Team UHI이며 SHA256 `94ca0c1b5ac5ab46c137c2cefe42aa422e52f0a53a9fcdd10524ae2ebc0688a1`이다. 이를 다른 라이선스로 바꾸거나 전체 제3자 코드/이미지가 MIT라고 확대하지 않는다. 설치된 dependency와 실제 파일의 출처/라이선스 증거를 반복 추출해, 이후 고지/배포 확인의 입력으로 만들려는 Story다. **목록/선언의 존재는 법적 적합성 승인이나 최종 배포 아티팩트 SBOM이 아니다.**

## 수용 기준

1. 외부 URL/키/개인정보/DB·아바타 실행 없이, 현재 잠금 파일과 같은 설치 환경의 라이브러리 metadata/라이선스 텍스트를 읽어 name·version·선언·증거 경로/hash·누락 상태를 결정적으로 기록한다. source lock hash 불일치·없는 버전·없는 증거를 임의 성공으로 채우지 않는다. 실행할 package code/install scripts는 없다.
2. npm/Python·runtime 후보/개발 도구·제3자 brand/3D 데이터 출처를 구분한다. 실제 production bundle/image에 포함됐다는 단정은 하지 않는다. 실제 container 구성/최종 모델은 아직 미검증이다. version·metadata-only/text-only/missing을 별도로 남기고 프로젝트 MIT를 누락 패키지에 상속시키지 않는다.
3. SPDX처럼 보이는 선언이나 라이선스 텍스트만으로 `distribution_approved`를 true로 바꾸지 않는다. 서로 다른 라이선스·NOTICE/저작권 요구·상표/공급자 검토·최종 고지 전달은 후속 확인 항목이다. 이번 범위는 evidence 목록이며 새로운 라이선스/법무/사업 결정을 확정하지 않는다.
4. 증거 경로는 명시적으로 허용한 설치/프로젝트 자료 안에서만 해석한다. absolute/traversal·범위 밖 symlink·.env/인증 파일 등은 읽기 전에 거부한다. license/metadata 텍스트의 지시문은 데이터이며 실행하거나 따르지 않는다. 출력에는 실제 계정/원시 신체/키·token·인증 설정이 없어야 한다.
5. 누락/선언만/텍스트만/경로 이탈/악성 metadata를 결정적으로 재현하는 시험과 **실제 잠금 파일·설치 metadata 추출**을 구분해 실행한다. raw 결과/hash와 실패를 보존한다. fake metadata 시험을 actual 설치/배포 라이선스 통과로 세지 않는다.
6. 기존 LICENSE·잠금/의존성·app API/UI·CI·.env·원본 아바타/검증 증거를 수정하지 않는다. 새 render/동일 부위 아바타 수정·검증 사이클도 시작하지 않는다. 최종 아바타·실측·코칭/기록 producer·운영/법무·부가 기능·6단계/최종 통합 게이트는 그대로다.

## 확인한 입력·근거와 한계

현재 main과 기존 소유 설치 환경의 backend uv.lock SHA는 `e87c2c0aba0ddf3c8bb54ea8d7e2f187ccaf694366199f8b70ae8566591f5fa0`, frontend pnpm-lock SHA는 `d7729cc17930684bf6eb9dc99171e499fc02234ff388fd560e34ab69d9c89984`로 각각 같다. 설치된 react package.json은19.3.0/MIT를 선언했다. 선언을 읽은 것이 전체 패키지의 notice 전달/허가 완료는 아니다. pnpm12의 실제 licenses CLI 도움말을 확인했지만 아직 전체 추출은 실행하지 않았다.

[Google 표식 원본 기록](../../frontend/public/brand/README.md)의160×160 PNG SHA `2bc2ae8e4c67de66d74bf1deed12cd8f22981270266a487576b671b0b4df361c`를 재확인했다. [현재 공식 브랜드 가이드](https://developers.google.com/identity/branding-guidelines)는 button/logo·색/비례/서체/여백·공급자 검토를 별도로 요구한다. 로고 파일 출처/hash를 확인했다고 현재 버튼/실제 OAuth 서비스 전체 승인을 선언하지 않는다. 이 Story에서는 이미지/버튼·공급자 연결을 변경하지 않는다.

[기존 Blender 출처 기록](../../assets/blender/README.md)과 [제작 기초](../avatar-production.md)는 CC0 base/core assets와 코드·참조를 구분한다. [MakeHuman/MPFB 공식 라이선스](https://static.makehumancommunity.org/about/license.html)에서 core assets와 GPL/AGPL source를 분리한 것을 확인했다. [Blender 공식 demo 페이지](https://www.blender.org/download/demo-files/)는 이번 읽기 도구에서402로 실패했다. 이를 실제 사이트 결제 요구나 권리 변경으로 해석하지 않고 재확인 필요로 기록한다. 기존 source archive/hash·실패/이미지/GLB는 보존하며 새 다운로드/Blender 실행을 하지 않았다. 1단계 문서는 당시 WIP이고 최신 아바타 외형 결정/이월을 대체하지 않는다.

[OSI MIT 원문](https://opensource.org/license/mit)도 확인했다. 기존 LICENSE 자체는 수정하지 않고, 원문/metadata와 최종 고지 전달/배포 검증을 구분한다. 비용·계정·시크릿·운영 migration·배포·중요한 법무 결정은 [운영 규칙](../operating-rules.md)의 별도 승인이다.

## 구현·하네스 순서

documentation/testing-strategy의 출처·실제/모의 분리로, 먼저 증거 분류/읽기 경계 모듈을 요구하는 시험을 작성한다. 이어 실제 npm/Python metadata와 lock/파일 hash 수집을 연결하고 원본·누락/후속 고지 항목을 기록한다. source 파일의 법무 문구를 임의 편집하거나 단순 allowlist로 전부 승인 처리하지 않는다. 현재 전체6단계/출시 후보판 선언은 없다.

최초 실제 pytest는 tests.license_inventory 모듈 미구현으로 collection error1·exit2·0.17초였다. [원본/실행 범위](../review/stage5-license-inventory/README.md)를 보존한다. metadata 분류 모듈과 전체 실제 라이선스 추출은 아직 미구현/미실행이며 단위/라이선스/출시 검증 완료로 세지 않는다.

## Tasks / Dev Agent Record

- [x] 최초 collection error 원본을 보존했다. 위의 미구현/미실행 표현은 착수 시점 기록이며 현재 증거로 대체하지 않는다.
- [x] 선언+텍스트/선언만/텍스트만/누락·unparsed·상속 없음·항상 승인 false를 구현했다. 표시 가능한 license label은 법적 적합성 allowlist가 아니며 임의 문자열은 hash-only다.
- [x] 읽기 전 경로/인증 파일·외부 symlink·부모 링크 교체·regular/size 경계와 CLI의 고정 실패 메시지를 구현했다. 설치 package/notice의 지시를 실행하거나 package code를 import하지 않는다.
- [x] 실제 pnpm12 read-only production/dev JSON·두 문서 source lock/실제 installation lock·개별 package.json/version·다중 버전/peer instance·nested notice를 연결했다. source/installation의 두 lock과 두 manifest는 byte 단위로 같아야 한다.
- [x] 실제 Python dist-info METADATA/License-Expression·legacy 선언·License-File/notice를 읽고 uv의 base/optional extra/dev graph와 연결했다. marker를 평가하지 않은 platform superset이며 현재 누락3개는 성공으로 채우지 않는다.
- [x] 프로젝트 MIT·Google brand 자료·Blender/MPFB 출처·역사적 제작 문서를 별도 범주/hash로 기록했다. .blend/GLB/이미지 제작·기존 LICENSE/원본/검증은 변경하거나 새 실행하지 않았다.
- [x] 단위 fixture25건과 실제 npm194개 버전/Python57개 lock 항목의 추출을 구분했다. Python54개 metadata는 현재 설치됨,3개는 미설치다. 최종 JSON 두 실행은 byte 동일이며 전부 distribution_approved=false다.
- [x] 최종 source의 fixture25개·실제 결정적 추출·전체291개 회귀·Ruff/format32파일·mypy app8파일·diff check·작성자 리뷰/P2 보완을 완료했다. 원본과 한계는 review에 보존한다.
- [x] exact source6236468939da505bd271b1e8696c3505ce553121·최신 base4599c7c·diff17파일·CLEAN/MERGEABLE·체크 없음·review0·로컬 clean과 source 동등성을 확인하고 [PR #31](https://github.com/HSU-OAS/bodyguard/pull/31)을 merge26d5e09541b92b33368ed2638eb307565909178a로 병합했다. main 포함과 로컬/원격 source 브랜치 보존을 확인했다. 법무/최종 artifact·전체5단계 완료가 아니다.

testing-strategy·documentation·code-review를 사용해 실제/합성 검증과 실패/미실행을 구분했다. BMAD resolver/config는 저장소에 없어 전체 BMAD 실행을 주장하지 않고 승인된 Story의 명세→실패→구현→검증 순서로 진행했다. web-design-studio의 UI 전용 경계에 따라 이번 백엔드 검증 Story에는 재설계/의존성 교체를 섞지 않았고 기존 화이트·블루 **웹**을 유지했다.

첫 actual 목록은 설치 npm194/Python54 + 미설치 lock3개를 추출했다. 작성자 리뷰에서 짧은 임의 선언 노출, 읽기 직전 부모 symlink 교체, 빈 첫 notice 때문에 다른 notice를 놓치는 경계를 보완했다. License-File이 AUTHORS를 가리키는 경우를 표준 LICENSE 스캔 누락으로 표시한 첫 결과도 private 원본으로 보존하고 실제 해당 파일을 bounded reader로 연결했다. 이 보완은 source/계정/운영 정책을 변경한 것이 아니다.

현재 누락 텍스트 npm8개와 선언 없이 텍스트만 존재하는 npm1/Python2는 [후속 보완](../stage5-license-inventory-runbook.md)에 남긴다. metadata·SPDX-like 표현·원문 hash의 존재는 고지 전달·호환성·LGPL 의무·상표/공급자·최종 모델/배포 artifact의 권리 승인과 별개다. Docker/NGINX/TLS·삭제/보안 replay 대응·Q-17/26·아바타/실측/코칭 producer·부가 기능·Stage6/최종 통합은 미완료다.

### File List

- backend/tests/license_inventory.py — stdlib 기반 bounded metadata/lock/notice 증거 추출. runtime/API 변경 없음.
- backend/tests/test_license_inventory.py — 분류·path/race·version·누락/optional extra·CLI·전체 합성 fixture 경계.
- docs/stage5-license-inventory-runbook.md — 실제 재현 방법·누락/후속 법무·최종 artifact 게이트.
- docs/review/stage5-license-inventory/* — 최초 red·실제 결정적 목록·하네스/회귀·hash·작성자 리뷰. raw CLI의 author/절대 경로는 제외.
- docs/stories/stage5-license-inventory.md, docs/stories/stage5-backup-restore-proof.md, docs/tasks.md — 실제 Story/직전 병합 상태.

### Change Log

2026-10-05: 최초 red 보존, 실제 설치 목록·notice hash 수집과 읽기 경계/누락 보완. 이번 Story는 라이선스 증거 기초이고 전체5단계·1~6단계·법무/출시 승인 완료가 아니다.
