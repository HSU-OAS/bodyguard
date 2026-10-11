# S5.7 — 고정 source의 동봉 고지·누락 경계

기준 main `ababacfe36b8f548e5b7ad1180fd8524f1fd0d83` · `codex/pinned-companion-notices` · release-plan5/Q-11·FR-A-02/03

상태: 실제 수집·하네스/검증·작성자 리뷰를 마쳤으며 조건부 PR 게이트를 진행한다. PR135 sourcee56c40a→mergeababacfe/main 포함·브랜치 보존은 확인했으며 제품/SDK/아바타·운영 변경은 하지 않는다.

## 필요한 결과

기존 S5.6은 Rolldown root LICENSE가 가리키는 THIRD-PARTY-LICENSE를 확인하지 않았다. 같은 불변 commit의 동봉 고지를 원문으로 보존한다. maath의 공식0.10.8 annotated tag→commit→source package name/version/license와 실제 전체 tree, stats-gl의 registry gitHead→source package/tree·README의 선언을 대조해 연결 실패와 원문 누락을 구분한다.

현재 읽은 maath tag object `18ea482a52d544b2bd72a3c1142c5b642ecedf01`은 commit `626d198fbae28ba82f2f1b184db7fcafd4d23846`을 가리킨다. 이전 탐색의404/연결 실패·기존 원본을 보존하며 이름 있는 license 파일이 없는 tree를 모든 blob/권리의 부재로 확대하지 않는다. npm build와 source 동등성·완전한 NOTICE/설치 복구·최종 배포 허가를 선언하지 않는다.

## 수용 기준·하네스

1. 기존8버전 증거의 offline 대조를 먼저 통과한다. 현재 pnpm lock을 바꾸지 않고 관련3개 registry identity/license/integrity와 maath annotated/direct commit·stats 고정 gitHead·Rolldown 공식 tag를 검증한다.
2. 고정된 공개 registry/API/raw text만 기존 redirect0·15초·1MiB 제한으로 읽는다. raw는 새 소유 private parent, 레포에는 필요한 selected metadata/tree/tag/package identity와 고지 byte·원본 hash만 남긴다. code import/실행·binary download/install·계정·시크릿·외부 메시지·아바타/GLB/Blender·운영/배포0이다.
3. Rolldown source 동봉 고지는 같은 commit의 byte 원문이다. maath/stats의 선언은 full license/copyright 원문으로 부르지 않는다. MediaPipe 두 버전·누락 원문·binary 하위 고지/최종 artifact 대응은 여전히 미완료다.
4. metadata/tag/commit/source version/truncated tree·고정 경로/URL·hash 변조/기존 destination 거절을 합성 하네스로 검증한다. 보존 실제 파일의 offline 대조와 원본 byte/hash를 별도로 실행한다. distributionApproved/completeArtifactNoticesVerified/npmArtifactSourceEquivalenceProven은 false다.
5. 범위 정적/문법·링크/diff·작성자 리뷰·최신 PR 게이트를 적용한다. 제품 코드/환경/자산 변경0이므로 전체 FE/SQL/browser는 이번 미실행이며 이전1750/실제8을 이번 재실행으로 세지 않는다.

## 별도 의존성

필요한 경우 공식 원문/고지 문의의 외부 메시지는 정확한 대상·내용·비용/위험/복구 범위를 CEO에게 먼저 요청한다. 질문만으로 공급자 확인/법무 승인을 완료 처리하지 않는다. 아바타/참여자/Docker 보류·기존 시작P2/native timeout·전체1~6의 필수 완료 기준은 유지한다.

## 실제 결과

[확보한 원문·실제 누락/불일치·실패/리뷰](../review/pinned-companion-notices/README.md), [증거](../review/pinned-companion-notices/evidence/proof.json), [raw/로그/소스 검증](../review/pinned-companion-notices/verification.json).

관련 registry3개와 source/ref/tree/package7개·Rolldown 동봉 고지1개를 실제 공개 요청11건으로 읽고 raw11개의 byte/hash를 대조했다. maath의 공식0.10.8 source identity는 연결됐으나 같은 tree에 이름 있는 license/notice 경로가 없다. stats-gl의 요청2.4.2 gitHead source package는2.3.1로 실제 불일치하며 동등성 false다. 두 package의 원문 확보로 세지 않는다. Rolldown 고지2209byte 원문은 같은 commit에 연결해 보존했다. 세 배포/완전고지/npm 동등성 flag false 유지.

수집 전 mkdir ENOENT와 탐색404는 실제 실패/도구 출력으로 남겼다. 초기 하네스11통과 뒤 리뷰의 manifest 재hash 고지 축약 P2를 실제10통과/1실패로 재현해 원문 SHA256 코드 고정으로 보완했다. 최종11통과/실패·skip0·offline/실제 raw hash·범위 정적/문법·링크/diff 통과다. 고지 원문/lock/기존 증거를 수정하지 않았다. source snapshot은 실행 후이며 전체 FE/SQL/browser·최종 artifact 검증은 이번 미실행이다.

좁은 변경의 작성자 리뷰 미해결 P1/P2는 없다. 2026-10-11 CEO의 **외부 문의는 나중에** 결정에 따라 공식 source 문의3건은 보류/외부 메시지0이다. 누락4버전·실제 배포 고지·법무/운영·보류/전체 완료 기준을 닫지 않는다.
