# S4.2 기록 화면 — 실제 실행 증거

실제 FastAPI / 소유한 격리 PostgreSQL18.6 / 설치된 Chrome / production 빌드다. 가입 메일은 격리 IPC mock, 수행 기록은 테스트 API로 만든 합성 요약이다. 실제 사람·운동·SMTP·HTTPS 운영 검증이 아니다. 기록 화면은 실제 API를 조회했으며 제품에 샘플 기록 생성 버튼을 넣지 않았다.

## 실행 이력

| 보존 실행 | 실제 결과 | 차이 |
|---|---|---|
| [첫 report](records-20261004T181610841641Z/report.json) | RW-01~06 모두 통과 | 기본 목록·상세·기간·페이지·오류·소유권 |
| [포커스 보완 report](records-20261004T181824458408Z/report.json) | RW-01~06 모두 통과 | 키보드 다음 페이지 후 결과 제목 초점 검사 추가 |
| [최종 report](records-20261004T182225211253Z/report.json) | RW-01~06 모두 통과 | 엄격한 캘린더 응답 검사·화면 타이포 포함 |

각 report의 실제 test-results 원본과 PNG를 변경하지 않고 복사 보존했다. 브라우저 실행 실패/skip은 이 Story에서는 없었다. 출력의 NO_COLOR/FORCE_COLOR 경고는 남겼으며 성공과 혼동하지 않는다.

초기 API/DOM 하네스에는 미구현 모듈 import 실패와 로컬 날짜→UTC 요청을 잘못 기대한 DOM 1건 실패가 있었다. 이 실패는 실행 출력과 Story에 기록한다. UI 로딩·오류 기준을 낮추지 않고 테스트가 aware UTC 계약을 따르도록 수정했다. CSS specificity 경고는 같은 우선순위로 정리해 최종 Biome 경고0이다.

## 실제 화면

- [기간 목록](records-20261004T182225211253Z/records-RW-02-actual-summa-0fd33-d-long-record-narrow-layout/records-list.png)
- [700px 목록](records-20261004T182225211253Z/records-RW-02-actual-summa-0fd33-d-long-record-narrow-layout/records-list-narrow.png)
- [700px 상세](records-20261004T182225211253Z/records-RW-02-actual-summa-0fd33-d-long-record-narrow-layout/record-detail-narrow.png)
- [빈 기록](records-20261004T182225211253Z/records-RW-01-protected-en-1fdc8-genuine-empty-record-period/records-empty.png)
- [기간 조회](records-20261004T182225211253Z/records-RW-03-actual-perio-7ef3e--and-invalid-input-recovery/records-period.png)
- [다음 페이지](records-20261004T182225211253Z/records-RW-04-actual-bound-b641f-ses-one-cutoff-and-keyboard/records-page-two.png)
- [읽기 실패](records-20261004T182225211253Z/records-RW-05-read-failure-1a7af--response-after-real-logout/records-read-error.png)
- [읽는 중](records-20261004T182225211253Z/records-RW-05-read-failure-1a7af--response-after-real-logout/records-loading.png)
- [없는/타인 상세](records-20261004T182225211253Z/records-RW-06-own-only-det-04442-count-and-Back-after-logout/record-unavailable.png)

카메라 호출0, 원시 모델/아바타 요청0, storage0, 외부 요청0을 하네스에서 검사했다. 1440px/700px에서 실제 화면을 확인했다. 시험에는 합성 식별자와 규칙 버전이 보이며 출시 동작명 카탈로그 연결은 최종 통합 미완료다.
