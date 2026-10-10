# Native 제한 변형 첫 실행 — 초기화 중단

별도 sandbox 프로세스가 `SIGSEGV`로 종료했다. [실제 terminal](native-exit.json)의 numeric native exit는 **null**이며 성공0/일반 저작 실패1로 바꾸지 않는다. `probe.json`은 생성되지 않았다. [로그](native.log)와 같은 시각의 `startup-crash.txt.gz`를 보존했다. Backtrace는 WM_init의 Metal backend 초기화이고 Python backtrace는 비어 있다. 설치 API/fixture가 실행됐다는 증거가 아니며 정확한 환경 원인을 전부 확정하지 않는다.

실행 runner와 helper gzip/SHA를 그대로 보존했다. Professional 모델·사용자 장면은 열지 않았으며 모델 저장/렌더/GLB/브라우저·실측0이다. 동일 helper는 별도 [허용된 독립 프로세스](../native-deform-probe-confirmed/README.md)에서 실제 실행했고 이 첫 실패를 삭제/덮어쓰지 않았다. 권한 우회·기기/전역 설정 변경·비용0이며 API probe 성공도 아바타 품질 성공은 아니다.
