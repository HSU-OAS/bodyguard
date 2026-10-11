# 고정 source의 동봉 고지·누락 경계

[S5.7](../../stories/pinned-companion-notices.md) · 기준 main `ababacfe`.

## 확보한 것과 남은 것

| 대상 | 실제 확인 | 아직 증명하지 못한 것 |
|---|---|---|
| Rolldown1.2.11 | 공식 tag→고정 commit `8df42198`; root LICENSE의 참조 대상인 [THIRD-PARTY-LICENSE](https://raw.githubusercontent.com/rolldown/rolldown/8df421985114ecfaf52cce038d4a5a6ea8c05408/THIRD-PARTY-LICENSE)2209byte 원문·저작권/조건 보존 | 모든 native binary 부품과 실제 배포 고지 |
| maath0.10.8 | 공식 annotated tag→`626d198f`; source package의 name/version/MIT 선언 일치. 잘리지 않은 tree에서 이름에 license/notice가 포함된 경로0 | full license/copyright 원문·npm build/source 동등성. 모든 blob 내용의 부재를 의미하지 않음 |
| stats-gl2.4.2 | registry gitHead `c12b2e39`의 [source package](https://github.com/RenaudRohlinger/stats-gl/blob/c12b2e391d5a88616e0b30f3c7f0577966426239/package.json)는2.3.1. 잘리지 않은 tree에서 같은 고지 경로0 | 요청한2.4.2와 source 동등성·full license/copyright 원문. 다른 버전으로 대체하지 않음 |

MediaPipe0.10.17/1.0.1의 원문/동봉 NOTICE, 기존4버전의 full 원문 미확인은 그대로다. MIT/Apache 선언이나 source 동봉 고지를 설치 복구·완전한 artifact NOTICE·법무/배포 허가로 만들지 않는다. [proof.json](evidence/proof.json)의 세 승인/동등성 flag는 false다.

## 수집과 실패·검증

기존8버전 proof를 offline 대조한 뒤 실제 공개 요청11건(관련 registry3·공식 ref/tag/tree/source package7·동봉 고지1)을 실행했다. 기존15초/1MiB/redirect0를 유지하고 package code·binary를 download/import/실행하거나 install하지 않았다. 원래 응답은 `/private/tmp/bodyguard-companion-proof.SLDf1N/raw`에 보존하고 레포에는 필요 필드만 선택했다. 고지 text는 원래 byte이며 저작권은 제외하지 않았다. 기존 증거/설치물/lock·프로젝트 MIT는 수정하지 않았다.

처음 수집 호출은 새 review 부모 폴더가 없어 mkdir ENOENT/exit1로 요청 전 실패했다. 처음 private parent의 빈 raw 폴더는 보존했다. 별도 원본 로그 파일이 있다고 주장하지 않으며 원문은 대화 도구 출력에 있다. 탐색 maath root LICENSE404도 당시 도구 출력이다. 새 parent에서 실제 수집11건·오류0을 확인했으며 이 성공이 원문 누락을 해결한 것은 아니다.

초기11개 하네스 통과 후 작성자 리뷰에서, 고지를 일부 문구로 바꾸고 manifest hash를 다시 쓰는 공격이 검사를 통과하는 P2를 재현했다(10통과/1실패). 공식 고정 원문의 SHA256을 코드에도 고정하여 manifest와 독립적으로 원문을 검사했다. 동일 하네스 최종11통과/실패·skip0, 실제 보존 source/metadata·raw11개 hash/offline 대조·범위 Biome·두 script 문법·링크/diff 검사 통과다. [실패/통과 원본과 소스 snapshot](verification.json)을 보존했으며 새로운 FE/SQL/browser 검증은 실행하지 않았다.

하네스의 metadata/commit/tag/source identity·truncated tree·path/URL·symlink/기존 destination·고지/flags 변조는 합성이다. 실제 수집이 아니며 공급자 답변·최종 법무 승인의 대체물이 아니다. post-execution 소스 snapshot이고 실행 전후 동일 receipt라고 하지 않는다.

```bash
node bodyguard/scripts/companion-notice-proof.mjs --verify /absolute/checkout/bodyguard/docs/review/pinned-companion-notices/evidence
node --test bodyguard/scripts/companion-notice-proof.test.mjs bodyguard/scripts/license-source-proof.test.mjs
```

재수집은 새 소유 private parent와 존재하지 않는 output 디렉터리를 지정한다. 기존 destination에는 덮어쓰지 않는다. 수집이 실패하면 부분 proof/error·원본을 보존하며 성공으로 표시하지 않는다.

## 작성자 리뷰·다음 의존성

`code-review` 기준으로 bounded 공개 요청·선택 metadata의 작성자/계정 필드 제외, 공식 ref→annotated commit/direct commit·source version/lock·raw bytes 보존, symlink/고정 파일명/원문 hash·오류 보존을 검토했다. 위 P2를 재현/보완했고 변경 범위 미해결 P1/P2는 없다. 독립 리뷰가 아닌 작성자 리뷰이며 저장 proof 자체는 서명된 SBOM이나 npm artifact 동등성의 신뢰 앵커가 아니다.

공식 저장소3곳에 정확한 full license/copyright/NOTICE 출처를 묻는 제한된 공개 이슈의 CEO 승인을 요청했고, 2026-10-11 CEO가 **외부 문의는 나중에**로 결정했다. 따라서 **문의 보류·외부 메시지0**이며 답변/권리 승인을 완료로 세지 않는다. 사용자/영상/관절/시크릿/내부 코드 첨부나 비용/계정/운영 변경을 하지 않는다. 독립 웹 작업은 계속하되 이 미확보 고지를 통과 처리하지 않는다.

제품 화면/API·SDK 통신 정책·아바타/GLB/Blender 변경0이다. 아바타·참여자·Docker 보류, 원래 시작P2/native timeout·실제 동작/판정/추천·외부/HTTPS/운영 및 전체1~6 미완료를 유지한다.
