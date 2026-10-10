# S5.6 — 누락 라이선스의 버전 고정 출처 증거

시작 main `0aed84e9442c69d50b405a2c9b4ef523997a8d7f` · `codex/upstream-license-evidence` · release-plan5/Q-11/FR-A-02·03

## 결과물과 경계

[S5.4의 누락 8개 버전](../stage5-license-inventory-runbook.md)을 공개 npm의 정확한 버전·integrity와 source lock에 대조하고, 연결 가능한 공식 불변 커밋의 라이선스 원문을 보존한다. upstream 원문은 설치물 원문이나 실제 배포물 권리 승인과 다르다. SDK·WASM·바이너리 하위 부품/NOTICE·상표·최종 모델·배포 고지의 검증을 대신하지 않는다.

원본 inventory/notice/실패, dependency/lock, 제품 화면/API/판정·SDK 통신 정책·아바타/Blender/GLB는 수정하지 않는다. 비용·계정·시크릿·운영·배포·법무 결정을 하지 않는다. 아바타 보류와 전체1~6단계 필수 기준은 그대로다.

## 수용 기준과 검증

1. 고정된 8개 name/version의 공개 metadata만 읽는다. 원문을 실행/import하지 않고 인증 설정이나 package code를 읽지 않는다. redirect·timeout·응답 크기를 제한한다.
2. npm name/version/license/integrity를 현재 source lock에 대조한다. 불일치·누락·404/연결 실패를 통과로 바꾸지 않는다. repository/gitHead가 있는 경우 공식 commit에 고정한다. gitHead가 없는 Rolldown은 공식 tag의 실제 commit을 따로 검증하고 npm gitHead로 부르지 않는다.
3. 새 evidence 디렉터리에 metadata·라이선스 byte 원문과 hash를 보존한다. 기존 파일은 덮어쓰지 않는다. 일부 source만 확보돼도 전체 누락8개를 해결했다고 표시하지 않는다.
4. identity/integrity/source commit 불일치·응답 크기·redirect·빈 원문을 합성 시험한다. 실제 공식 출처 수집과 합성 시험을 구분하고, 보존된 실제 파일 hash를 네트워크 없이 다시 대조한다.
5. 원문 확보와 완전한 NOTICE/실제 artifact 대응·법무/출시 승인을 분리한다. `distributionApproved`와 `completeArtifactNoticesVerified`는 항상 false다. 현재 웹 빌드의 실패 경계를 우회하거나 missing license에 프로젝트 MIT를 상속시키지 않는다.

## 착수 시 발견

공개 npm8개 버전/integrity는 현재 잠금 파일과 일치했다. R3F/Draco/Biome의 registry gitHead와 공식 commit 원문, Rolldown의 공식 v1.2.11 tag commit을 확인했다. stats-gl의 해당 commit root `LICENSE`는404였고 root tree에도 license 파일이 없었다. Biome root `ROME-LICENSE-MIT`도404였다. maath 공식 tag API는 두 번 연결 실패였다. 이 탐색 결과는 당시 도구 출력이며 별도 원본 파일로 저장하지 않았다. 연결 실패를 태그/라이선스의 부재로 해석하지 않는다.

MediaPipe 두 버전은 registry gitHead/repository가 없으며 기존 canonical Apache-2.0 보존은 특정 SDK/WASM의 원문/NOTICE 입증이 아니다. maath/stats-gl도 원문 출처 연결 미완료로 남긴다. 새로운 avatar/SDK 실행이나 package binary 다운로드는 하지 않는다.

## 실행 결과

명세 작성 시점에는 수집기·하네스·최종 파일 검증·리뷰/PR 게이트가 미실행이었다. 이후 실제 metadata8·불변 source4개 version/원문5개를 수집·대조했다. 초기 합성4개 통과 뒤 추가 offline2개는 한글 경로를 잘못 해석해 실패했고 수정 전 재실행 원본을 private에 보존했다. fileURLToPath 수정 후 최종6개가 통과했다. source/공개 증거의 hash·고정 출처를 offline으로 다시 대조했다. [증거 요약](../review/upstream-license-evidence/README.md)에 실제 결과·작성자 리뷰·잔여 조건을 기록했다.

metadata identity/license/integrity/commit·tag 불일치, public host/redirect·404/size/empty, 합성 복사본 변조/경로 이탈과 기존 destination 거부를 검증했다. 실제 수집 결과는 법무/NOTICE/출시 허가가 아니며 판정/화면·운영·아바타 보류 변경0이다. 이번 Story 수용 기준의 로컬 검증/작성자 리뷰는 완료했으며 PR의 최신 diff/head/base·체크·충돌/조건부 병합 확인은 다음이다.
