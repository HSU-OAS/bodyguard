# S2.M3 — 관찰 신뢰도와 부위 강조

낮은/비정상 presence를 높은 visibility로 보완하지 않는다. 사용자의 해당 팔·몸통 관찰 coverage를 제거하고 표시용 마지막 local rotation은 유지하되 유효 관찰로 세지 않는다. 값이 생략된 기존 입력과 디버그 가시성 평균은 유지한다. 새 기준값·임상 classifier·확인 불가 색은 추가하지 않았다.

## 실제 작동한 흐름

실제 Chrome154.0.8037.98/WebGL의 기존 남녀 A37 두 모델에서 팔/다리 강조→낮은 또는 비정상 presence→해당 강조 해제→다른 신뢰 가능한 부위 표시→새 관찰 복구를 확인했다. 가림·복수·미검출·만료·이전 세대 거부·종료도 재실행했다. 각 모델26상태이며 source/reference 속성·재질·pose와 전신 구도를 보존했다. 종료 후 pair의 renderer memory는 기존 PBR cache 기준 geometry0/texture1으로 돌아왔다. caller renderer 종료와 SDK 종료는 별개다.

저작된 관절·합성 오류 시험이다. 실제 SDK·카메라·참여자0, 미완성 A37이며 올바른 시범/교정·외형 승인·노트북 성능을 입증하지 않는다. GPU readback은 제작 모델의 색상 픽셀 개수만 반환하고 좌표·raw 픽셀을 내보내지 않았다. 기존 시험기가 만든 제작 마네킹 전용 screenshot은 보존하며 사용자 영상은 없다. 외부 요청·카메라 호출·storage 쓰기·JS/셰이더 오류0이다.

팔/몸통 관찰 단위 시험과 전체 FE1397, 타입·Biome269(경고/info0)·assets·Vite·공개 guard·diff를 실제 실행했다. 공개 JS355151/CSS31199 bytes가 PR95 기준선과 byte 동일하고 기존 남녀 GLB·SDK 실행 파일/5모델 hash도 동일하다. 목/손/동일인·깊이 정확도의 완료로 확대하지 않는다.

## 실패와 리뷰

- 구현 전 단위 시험은41통과/19실패였다. 실제 남성 Chrome에서는 presence0인데 이전 빨강3802픽셀이 남아 강조를 잘못 수락했다. 첫 실패에서 중단하므로 여성 RED를 실행했다고 하지 않는다. 단위/Chrome 실패 report와 수정 전 번들을 보존했다.
- 수정 후60집중/1396전체 시험과 남녀 Chrome이 통과했다. 디버그 평균이 적격성 점수가 아니라는 회귀를 추가한 최종 전체1397도 통과했다.
- 최초 임시 의존성 링크가 잘못된 상대 경로여서 pnpm이 설치를 시도했으나 DNS 실패로 중단했다(exit130, 테스트 실행 전). 링크만 보존하고 기존 설치 캐시의 정확한 절대 경로로 연결해 direct Node 실행했다. 실패 도구 출력은 대화 기록이며 별도 원본 로그 파일이 있다고 주장하지 않는다. lockfile/기존 의존성 디렉터리는 바꾸지 않았다.
- engineering code-review 절차의 작성자 점검으로 shared trust 누락을 발견했다. 필드 생략 호환성·동일 기준/범위·입력 불변성·사지/몸통 coverage·소유권/강조 해제·표시/판정 구분·개인정보·공개 경계와 실제 브라우저 흐름을 점검했다. 이번 Story의 미해결 P1/P2는0이며 독립 review/전문가 승인 또는 기존 시작P2 해결을 뜻하지 않는다.

## 증거와 남은 조건

[manifest](manifest.json)과 [검증기](verify.mjs)는 원문/압축 SHA, 실행 receipt, 수정 전후 source와 private bundle을 연결한다. 파일 hash는 실행 사실의 단독 증거가 아니므로 실제 report/receipt와 함께 읽는다. GLB는 기존 Git25a9bd6과 hash로 연결하고 새 사본을 저장소에 넣지 않는다. 소스/번들 Three MIT 원문 고지를 보존한다. SDK는 이번 브라우저 시험에서 실행하지 않았다.

`node bodyguard/docs/review/pose-presence-guard/verify.mjs --current`는 보존한 최종 source와 현재 파일도 대조한다. 기본 실행은 과거 증거 자체의 bytes만 확인한다. 단위 RED 당시 모든 TS 원문의 별도 snapshot은 없으며, Git 기준선·실패 report·최종 diff와 실제 브라우저 RED 번들을 보존했다. manifest 수집 후 생성되는 커밋/원격 receipt는 이 manifest에 포함되어 있다고 주장하지 않는다.

공개 UI/문구·GLB/Blender·계정/API/DB·SDK 정책·운영/배포 변경0. 시작P2·올바른 동작/판정·실측·외형/권리·승인 웹 구조·SDK 정책·참여자/다장치·Docker/공급자/HTTPS와 전체1~6은 여전히 미완료, 출시 적격 동작0이다. 기존 별도 승인 요청을 반복하거나 자동 goal 재개를 응답으로 간주하지 않는다. 이번 좁은 보완을 출시 완료로 세지 않는다.
