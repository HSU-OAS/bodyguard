# 설치 파일의 부분 고지 보존

[S5.8](../../stories/embedded-package-notices.md) · 기준 main `9c620b5`(PR136 merge).

## 확보한 범위

| 설치물 | 실제 보존 | 아직 미확인 |
|---|---|---|
| maath0.10.8 | dev/prod/esm easing 파일 3개의 Quaternion Damp 주석. 각1170byte, 동일 MIT 조건·저작권 원문 | maath 전체 full license/copyright·다른 부품·npm artifact/source 동등성 |
| MediaPipe0.10.17 /1.0.1 | 각 vision.d.ts의 맨 앞620byte Apache2.0 고지/저작권/링크, CRLF 보존 | Apache 라이선스 전문·전체 SDK/WASM NOTICE·하위 부품/배포 고지 |

[실제 부분 고지 proof](verified-evidence/proof.json)의 배포 허가·완전 고지·npm artifact 무결성 flag는 모두 false다. 새로운 확인은 설치 파일 안의 주석뿐이며, 기존 root text 누락8버전 목록이나 full 원문 미확인4버전·stats-gl source 버전 불일치를 해결한 것이 아니다. 기존 [공식 source 증거](../upstream-license-evidence/README.md)와 [동봉 고지 증거](../pinned-companion-notices/README.md)를 그대로 유지한다.

## 실제 수집·실패·검증

정해진 source5개·package3버전의 name/version/license와 전체 byte/hash를 실제로 읽었다. 설치물·lock·package code는 수정/import/실행하지 않았다. 외부 요청/문의·공급자 로그인/메일 발송0, 제품 화면/API/SDK/Blender/GLB 변경0이다. 전체 원본10개(각 source/package.json)는 `/private/tmp/bodyguard-embedded-current.CAU9h8/raw`에 보존하며, 공개 증거에는 해당 주석과 최소 identity/path/hash/byte 위치만 넣었다.

하네스 최초 실행은 helper 작성 전 module-not-found였다(0통과/1실패). 이는 제품 결함 assertion RED가 아니다. [stdout 원본 압축](loader-red.stdout.gz)과 [stderr 원본 압축](loader-red.stderr.gz)을 보존했다.

첫 실제 수집은 maath3개 후 MediaPipe marker가 유일해야 한다는 잘못된 가정 때문에 exit1이었다. [실패 proof](evidence/proof.json)와 당시 고지3개·private raw는 덮어쓰지 않았다. 최초 수집 process 출력은 대화 도구 출력에 있고 별도 원본 로그 파일이 있다고 하지 않는다. 실제 확인 결과 두 타입 파일 모두 동일 marker7개가 있었다. source/주석/identity hash와 맨 앞 byte 위치를 고정해 정확히 해당 파일 머리만 추출하도록 보완했다. 이 실패가 웹의 기존 native 시작P2 해결을 의미하지 않는다.

새 private/output 경로에서 최종 수집5개·오류0, 보존 고지 offline 및 현재 설치물 대조, source/private raw10개 hash 대조가 통과했다. 새5개+기존11개의 Node 하네스16개 모두 통과·실패/skip0이다. 합성 검사는 축약/저작권 변조 후 manifest 재hash, source/path/offset/package/flags 변조, symlink proof·기존 destination 거절이며 실제 공급자/사람/임상 검증이 아니다. 두 script 문법·범위 Biome도 통과했다. [실행 원본/압축 hash와 소스 snapshot](verification.json)은 실행 후 snapshot이며 실행 전후 동일 receipt라고 주장하지 않는다. 제품 코드 변경0이므로 이번에 FE/API/SQL/browser를 재실행하지 않았고 과거 실행을 이번 성공으로 세지 않는다.

```bash
node bodyguard/scripts/embedded-notice-proof.mjs --verify /absolute/checkout/bodyguard/docs/review/embedded-package-notices/verified-evidence
node bodyguard/scripts/embedded-notice-proof.mjs --verify-current /absolute/checkout/bodyguard/docs/review/embedded-package-notices/verified-evidence
node --test bodyguard/scripts/embedded-notice-proof.test.mjs bodyguard/scripts/license-source-proof.test.mjs bodyguard/scripts/companion-notice-proof.test.mjs
```

재수집은 새 소유 private parent와 존재하지 않는 output을 지정한다. 기존 목적지는 거절하며 실패 부분 proof·원본도 보존한다. `--verify-current`는 명시된 설치 경로/peer instance의 source와 identity가 byte 동일해야 한다. 다른 설치물·새 버전·최종 배포 artifact를 자동 동등 처리하지 않는다. 처음 원문 CRLF를 일반 diff 검사에 넣었을 때 exit3/줄끝 CR 경고가 발생했다(원문은 대화 도구 출력). [.gitattributes](verified-evidence/.gitattributes)는 해당 고지2개만 CRLF와 원본 byte를 보존하고 trailing-space 검사는 유지한다. 제품 코드/전역 whitespace 규칙·원문 byte는 바꾸지 않는다.

## 작성자 리뷰·남은 조건

`code-review` 기준으로 고정 path/전체 source와 package hash·byte 위치, 최대1MiB bounded/no-follow 읽기·핸들 종료, 기존 destination/원본 보존, 오류와 부분 범위·false 승인 flag를 검토했다. 제한된 변경 범위 미해결 P1/P2는 없다. 독립 리뷰가 아닌 작성자 리뷰이며 proof는 서명된 SBOM이나 패키지 권리의 신뢰 앵커가 아니다. 링크·최종 diff 및 GitHub 상태/체크는 PR 병합 직전에 재확인한다.

CEO는 공식 라이선스 외부 문의와 실제 Gmail/Google 공급자 연결을 나중으로 결정했다. 아바타·참여자·Docker 보류도 유지하며 관련 연결/제작을 임의 실행하지 않는다. 전체1~6·출시 적격 동작0·최종 아바타/시범/판정/추천·실측·원래 시작P2/native timeout·HTTPS/운영·최종 고지/권리는 미완료다. 부분 고지 보존만으로 출시 후보판을 선언하지 않는다.
