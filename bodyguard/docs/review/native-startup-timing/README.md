# Native 시작 시간 분리

[S6.8 명세](../../stories/native-startup-timing.md) · [원본·SHA·실제 수치](summary.json)

현재 웹의 시작 지연은 **미해결**이다. 이번 Story는 원인을 가를 시험용 계측이며,
사용자 화면·판정·공개 제품 코드는 변경하지 않았다. 남녀 두 아바타·코칭/중단·본인
기록·권한 회수 흐름의 기존 시험에 카메라/SDK/GLB/렌더/추론 구간을 추가했다.

## 실제 실행과 해석

runtime245508c의 실제 Chrome/AuthProvider/API/새 격리 PostgreSQL/SDK/기존 A37 GLB에서
20개 흐름이 통과했다. 장치·메일·동작 및 오류 판정은 시험 입력이다. 실제 사람/물리
웹캠/SDK 양성 검출은0이며 최종 아바타 외형이나 올바른 스트레칭 검증이 아니다.

카메라 호출 시작을0ms로 둔 처음 세 결과의 기록:

| 시험 | SDK 생성 body/face/hands | GLB 로딩 | 첫 renderer 호출 | 첫 결과 반환 / 세 번째 반환 |
|---|---|---|---|---|
| 남성 | 814.5 / 427.1 / 766.3ms | 265.3ms | 200.1ms | 4190.7 / 4511.9ms |
| 여성 | 419.4 / 230.0 / 687.8ms | 254.3ms | 162.9ms | 2964.1 / 3200.0ms |

순차 suite의 남성은1번·여성은11번이다. 성별 성능 차이·물리 카메라·실사용 지연으로
일반화하지 않는다. 첫 결과의 body→face→hands→반환 구간은 각각1207.1/940.2ms였다.
생성/콜드 실행 시간이 관측됐지만 **과거 실패의 원인이 입증된 것은 아니다.**
이번에는 재현되지 않아 기존 시작 P2를 닫지 않는다. 정상 시험을 추가 반복해 해결로
세지 않고, 다음 실제 실패 당시 같은 단계 기록과 실행 조건을 대조한다.

시각은 단계 상대 시간만 기록하며 최대30개다. renderer 값은 최초 세 avatar renderer
호출만 포함한다. fixture의 초기 baseline render와 GLB clone/배치·리그 준비 및 나머지
공백은 포함하지 않는다. endMs는 호출 정리 시점이지 성공 판정이 아니다. SDK factory의
test-only await/시계 읽기 영향이 있으므로 제품 성능 벤치마크로 쓰지 않는다. 합성 hold는
native face/hands 호출 시간 밖에 있으며 result 수명에는 포함될 수 있다.

## 실패 보존·검증·작성자 리뷰

이전 [native-feedback 실패](../native-feedback/README.md)의 결과0/cleanup timeout,
5초 동안 결과2·후속 snapshot7은 그대로다. 제목 로딩의 [이전 회귀](../web-startup-recurrence/README.md)와
구분한다. 당시에 단계 수치가 없던 구간은 현재 정상 수치로 역추정하지 않는다.

새 시계 하네스는 외부 clock이 close하는 순간 오래된 token을 완료시키는 첫 시험에서
1실패/7통과였다. 종료 여부를 다시 확인한 뒤8통과, 전체 FE1177통과/실패·skip0,
type/Biome250파일/build/production guard를 실제 통과했다. poll5000ms/case60000ms/
재시도0은 그대로다. public JS/CSS는 PR84 기준선과 byte 동일하다. 각 실행의 source
before/after를 실제 파일과 대조했으며 runtime 원본5파일을 함께 보존했다.

증거 대조 helper의 첫 집합 비교는 잘못된 scope 때문에 실패했다. 원본 helper·실패
설명과 수정된 실제 receipt별 비교를 보존했다. 초기 RED/type receipt125파일과 최종
receipt222파일은 다른 범위다. 초기 receipt가 모든 src를 포함했다고 표시하지 않는다.
시험 원본 로그·보고서·시각은 gzip으로 보존하고 압축 전후 SHA를 검증한다. SDK bundle,
큰 GLB/모델 중복은 로컬 보존/해시로 구분한다. 원본 사람 데이터와 쿠키는 저장하지 않았다.
시험 DB를 정상 종료했고 직접 만든 의존성 symlink만 제거했다. DB 자료/캐시는 보존했다.

engineering:debug·testing-strategy로 실제 실패와 콜드 실행/모의 입력을 구분하고,
code-review로 제한된 기록·clock 재진입·닫힌 token·SDK factory descriptor 복원·native
호출/정리 수·공개 누출과 근거 없는 해결 선언을 검토했다. 이 **시험 계측 diff 범위**의
미해결 P1/P2는 없으며 작성자 검토다. 독립 에이전트·전문가·제품 전체 승인이 아니다.

## 남은 완료 기준

실제 오류 classifier/검증된 교정 시범·동일인/목/체간/손 정확도·실측/참여자·다장치/
물리 권한·최종 외형/권리·승인 공개 UX/SDK 통신 정책·외부 공급자/HTTPS/운영 및
D2-A/M/T/R/I/P와 전체1~6은 미충족이다. 출시 동작0·최소 텍스트·아바타 중심 방향·
원본/실패 보존·같은 부위 새 조형 보류·별도 승인 기준을 유지한다.
