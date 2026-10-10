# S6.11 비공개 Worker 추론

최종 FE1337·계정/두 아바타6·Worker3과 정적/빌드/공개 경계 검증을 실행했다. 실행 원문124개·소스9개는 `node bodyguard/docs/review/native-worker-inference/verify.mjs`로 무결성을 확인한다.

[Story](../../stories/native-worker-inference.md) · [실행 원문/hash](manifest.json). 작성자 검토이며 독립 전문가 리뷰가 아니다. 공개 적용/출시 완료가 아니다.

## 작동한 웹 흐름

Chrome·실제 SDK·FastAPI·격리 PostgreSQL에서 남녀 각각 로그인→두 A37 GLB→중단→본인 interrupted 기록 저장, 준비 중 로그아웃→이전 재개/저장 차단, 동일 계정 갱신→이전 Worker 종료→새 소유자 명시 시작을 확인했다. 카메라/메일/동작 gate는 합성이고 준비 취소는 실제 모델 fetch를 시험에서 지연한 사례다. 실제 양성 몸/사람/물리 카메라/전문가 시험0, 최종 외형 승인0이다.

별도 Chrome/SDK Worker 시험은 세 모델·연속3프레임·준비/추론 중 취소를 확인했다. 최종 heartbeat109회/최대 간격24.1ms는 제한된 관찰이며 통제 benchmark/main 대비 개선율·최종 아바타 성능 근거가 아니다. `browser-final`은 FE 검증과 겹쳤고 `browser-serial-final`/`browser-accepted`는 무거운 검증 종료 후 별도 실행이다.

카메라/프레임·모델·Worker·renderer 수명, 외부 요청/JS 오류/웹 저장소0과 본인 기록을 확인했다. raw 영상/몸·얼굴·손 배열은 저장/출력하지 않았다. 원본/GLB·5모델·공개 JS/CSS와 기본 main·최소 문구를 유지했다. 실제 CPU fallback 성공·다장치·사람 정확도·운영/Docker/TLS·공급자는 미검증이다.

## 실패 보존 및 검증

`.gz`는 실제 원문을 압축한 것. manifest의 해제 SHA로 확인한다. 최종은 `full-accepted-units`, `owner-fourth`와 최신 nativeworker report, `browser-accepted`, accepted type/Biome/build/공개 guard·Ruff/소스 전후 hash·diff다.

- client-red: 구현 전 import 실패(실행0). client-first: clone 반환 시점1건. runtime-first: duplicate init 후 늦은 ready/잘못된 세대 프레임 누수2건. 구현 보완 및 회귀를 추가했다.
- owner-first: dependency symlink 거부, Chrome 실행0. 일반 잠금/공급망 정책 설치로 해결했다. owner-second: hook prepared와 자원 준비를 혼동한 하네스2건. 실제 fetch 대기·지연 주입/자원 상태로 수정했다.
- full-final-units: 준비 직후 source를 검사한 하네스2건. source가 생성되는 실제 재생 시작 후 검사했다.
- tool trace의 shared-memory 초기화/오프라인 패키지 누락/Biome unsafe-finally 실패는 실제 실패다. 전용 임시 DB만 허용 실행, 기존 패키지 정상 설치, finally 밖 정리 오류 전파로 보완했다. 파일 receipt 없는 trace를 재생성 원문으로 주장하지 않는다.

기존 PR90의13건 시작 실패는 유지한다. 전체 nativefeedback26 gate를 이번에 재실행하지 않았으며 기존 시작 P2를 닫지 않는다. private 이전 bundle·가짜 계정 DB·원문도 보존하고 이번 전용 DB/API/preview/Chrome은 종료했다.

## 작성자 리뷰

보안/정확성/성능/유지보수 관점에서 최종 소스와 테스트·실패를 검토했다. 고정 동일 출처/명시 opt-in·한 입력/원래 시각/한 요청·기존 bounded copy/보류·세대/ID/시각·늦은 응답/취소·부분 준비·ACK→terminate·원시정보 경계를 확인했다. 정리 실패 오보고, head 복사 순서, clone 정리, 동기 초기 postMessage 실패의 promise 수명을 보완하고 회귀했다. 실패를 빈 몸/성공/자동 main fallback으로 바꾸지 않는다.

이 좁은 Worker 목적에서 미해결 P1/P2를 발견하지 않았다. 제품 SDK egress 승인·승인 공개 구조·최종 외형/권리·실제 동작/사람/노트북·기존 시작 P2·D2 및 전체1~6단계는 미완료다. 미완성 코칭을 공개하지 않는다.
