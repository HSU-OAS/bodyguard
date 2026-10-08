# S3.4 실제 작동 흐름·검증

2026-10-08 · localhost Chrome · 계정 mock · 카메라0 · 최종 디자인/동작 검증 아님

어깨 으쓱·이완과 팔 위로 뻗기가 기존 검수 목록의 부위 필터/검색→상세→참고 자료 키보드 펼침→목록 복귀에 연결됐다. 시작 버튼은 비활성이며 guest·오류·production에서는 후보를 공개하지 않는다. 공개 JS/CSS는 PR85와 byte 동일하다.

[어깨 상세](shoulder-shrug.png) · [팔 올림 상세](arm-overhead.png)는 **기존 개발 검수 UI**다. CEO가 선택한 아바타 중심 최소 텍스트 출시 디자인이나 최종 3D 외형의 시안이 아니다.

## 실제 증거

- [Chrome 원본 보고서](browser.json), [stdout](browser.log), [stderr](browser.stderr.log): 전체10 통과, 실패/skip/retry0. 새 두 항목 상세와 기존 선택/추천 입구·복귀·오류·권한·공개 제외를 확인했다. 계정은 mock, 실제 사람·웹캠·동작 판정은0이다.
- [요약·소스 SHA](summary.json), [파일 SHA](manifest.json), [전체 FE 원본](unit-final.json.gz):1179 통과/실패0, gzip의 원본 SHA도 manifest에 기록했다.
- [코드 검사](code-check.log)250파일, 타입 검사·[build](build.log)·[production guard](guard.log) 통과. 공개 JS355151/CSS31199 byte의 PR85 SHA 일치를 확인했다.
- 실행: 설치된 Vitest/Biome/tsc/Vite bin을 직접 사용했다. Chrome은 기존 scripts/test-selection-browser.mjs의 외부 거부 프록시를 사용했고, 작업 전용 launcher는 pnpm exec playwright만 설치된 bin으로 전달했다. 보안 정책·의존성·테스트 timeout/skip은 바꾸지 않았다.

## 실패 보존

[최초 launcher 실패](launcher-failed.log.gz)는 pnpm의 설치 사전 검사에서 기존 dependency symlink를 실제 directory로 요구한 환경 오류다. 단위 시험 실행 결과로 세지 않았다. 설치를 새로 하거나 정책을 끄지 않고 기존 설치 bin을 직접 실행했다. [구현 전 RED](unit-red.log.gz)는 후보 누락/수량/필터로5실패·7통과, 구현 후12통과다. 기존 설치 cache는 보존하고 이번 작업의 dependency symlink만 제거했다.

최초 staged diff 검사에서 위 두 로그 원문의 마지막 빈 줄로 실패했다. 내용/실패 결과를 편집하지 않고 lossless gzip으로 보존하고 원본 SHA를 manifest에 기록했다. 원래 proof 로그와 변환 전 manifest도 보존한다. 최종 staged 검사를 다시 확인한다.

Oxford의 예전 PDF는 현재404로 실패했다. 원래 문서/실패 기록은 남기고 CUH 해당 수행 항목을 대체 근거로 확인했다. NBT Exercise5는 앉아서 한 팔씩 머리 위로 뻗는 앞부분만 반영했다. 출처/문맥은 [원문 대조 기록](../../motion-evidence.md)을 따른다. 원문 그림/PDF·숫자 처방은 복제하지 않았다.

## 작성자 리뷰·남은 조건

실제 diff를 보안/성능/정확성/유지보수 관점에서 검토했다. 기존 guest/production 후보 부재 assertion을 새 항목까지 유지하고 source 배열/원소 불변성 assertion을 보완한 뒤 전체 FE/Chrome/정적 검사를 재실행했다. Story 범위의 미해결 P1/P2는0이며 독립 리뷰라고 주장하지 않는다. GitHub 체크 결과는 PR 게이트에서 별도 확인한다.

출시 적격 동작은0이다. 개인별 안전/수행 적합성·실제 촬영/임계값/오판정·시범 애니메이션/3D 미리보기는 미완료다. 시작 지연 P2·최종 아바타/권리·승인 공개 UI·실제 참여자/다장치·SDK/외부·운영·전체1~6 게이트도 미충족이다. API·계정 공급자·SDK 정책·GLB/조형·운영 배포 변경0.
