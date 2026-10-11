# S5.8 — 설치 파일에 남은 부분 저작권 고지

기준 main `9c620b598f1d68f5c0146dd6506329ffb02b194b` · `codex/embedded-package-notices` · release-plan5/Q-11·FR-A-02/03

## 범위·수용 기준

기존 root license 미확인을 유지하면서 maath0.10.8의 Quaternion Damp 주석(MIT 조건/저작권) 3개와 MediaPipe0.10.17/1.0.1의 vision.d.ts 파일 고지 2개를 설치물에서 byte 그대로 보존한다. 기존 패키지 코드의 읽기만 수행하며 import/실행·설치·네트워크·외부 문의·Blender/GLB·제품 화면/API·운영 변경은 없다.

1. 실제 고정 source 5개와 package name/version/license를 확인한다. source 전체·추출 byte 위치와 SHA256, 현재 source lock 및 이전 공식 source 증거를 대조한다. 새 소유 raw 폴더와 존재하지 않는 공개 evidence만 사용하고 기존 증거/설치물을 덮어쓰지 않는다.
2. 추출 범위는 maath의 해당 함수 주석과 MediaPipe의 해당 타입 파일 머리 주석뿐이다. maath 전체 패키지 또는 SDK/WASM 전체 license/NOTICE로 확대하지 않는다. 배포 허가·완전 고지·npm artifact 무결성/동등성 flag는 false다.
3. 원본과 추출 고지의 byte를 보존한다. 실제 주석 SHA를 코드에도 고정해 manifest를 다시 hash한 축약/변조도 거부한다. fixed path·no-follow·1MiB·symlink/외부 경로·기존 destination 거절을 검증한다.
4. 하네스는 합성 변조와 실제 설치물/보존 고지의 offline/current 대조를 구분한다. 원본·실패를 보존하고 두 script 문법·범위 정적·링크/diff·작성자 리뷰·최신 PR 게이트를 적용한다. 제품 코드 변경0이므로 새 FE/SQL/browser 재실행은 요구하지 않으며 이전 실행을 이번 통과로 세지 않는다.

## 유지되는 의존성

PR136은 sourcec2629dd→merge9c620b5로 실제 main에 포함됐다. 공식 문의·아바타·참여자·Docker 보류를 유지한다. 2026-10-11 CEO는 실제 Gmail/Google 공급자 연결도 나중에 진행하도록 결정했다. 연결/발송/로그인 실행0이다. 원문 미확보4버전·stats source 버전 불일치·최종 배포 artifact/권리·기존 시작P2·실제 판정/추천 및 전체1~6은 미완료다.

## 실행 결과

명세/하네스 선행 후 helper를 작성했다. 최초 module-loader 실패와 첫 부분 수집3개/오류1을 보존했다. 반복 머리말을 유일하다고 가정한 오류를 actual source/byte 위치/hash 고정으로 보완하고 새 경로에서5개/오류0을 실제 확인했다. 보존/현재 대조·raw10개 hash·새5+기존11개의 하네스16개·범위 정적/두 문법이 통과했다. [실패/실제 범위·원본·작성자 리뷰](../review/embedded-package-notices/README.md). 링크/diff·최신 PR 조건부 게이트 진행 중이며 whole package 권리·공개 코칭/전체1~6 완료로 세지 않는다. 새로운 FE/API/SQL/browser 검증은 미실행이다.
