# native 몸·얼굴·손 연결 검토

2026-10-08 · S2.T16 · runtime `af6656e9a8b1345c7e9dafc7fb52d2b3a789b12c` · **비공개 기술 연결, 출시 코칭 아님**.

## 실제 작동한 흐름

실제 로그인/API/격리 PostgreSQL과 Chrome154의 가짜 카메라에서 준비→명시 시작→남녀 두 아바타→중단→본인 기록 상세가 작동했다. 같은 frozen VideoFrame과 원래 시각으로 Pose→Face→Gesture를 호출한다. 손 결과 대기 중 refresh/logout204/서버401/pagehide/unmount는 이전 재생·저장·재개를 차단하고, 입력 반환 뒤 세 SDK·카메라·모델을 정리한다. 새 소유자는 새 자원으로 명시 시작한다.

손 설정이 없으면 Gesture를 열지 않는다. 기존 몸·머리 로그인 흐름도 실제 브라우저에서 별도 재실행했다. 몸 전용 인자/동작은 전체 기존 단위 회귀를 유지했다.

native 가짜 장치는 몸/얼굴/손 모두 미검출이다. 실제 사람·손 양성·동일인·물리 카메라·권한 팝업 정확도 시험이 아니다. held-result는 실제 동기 SDK 호출 직후의 **테스트 전용 Promise**다. 임상 gate·시간은 합성이고 확인 시간/횟수0, 중단 기록이며 성공 수행 기록이 아니다.

별도 생성21점 WebGL 시험에서 남녀 손목2개·손가락30개의 굽힘/회전→클리핑/누락→복구→만료/종료, 비교/source·8가중치·전신 보존을 다시 확인했다. 이 양성 표시는 native 양성 정확도가 아니다. 기존 읽기 전용 Blender 축 결과를 재사용했고, 새 Blender 제작·검사는 실행하지 않았다.

## 실제 미리보기·증거

[남성 native 미완성 아바타](evidence/native-final-male-avatar.png) · [여성 native 미완성 아바타](evidence/native-final-female-avatar.png) · [본인 중단 기록](evidence/native-final-female-record.png)

[남성 생성 손 굽힘](evidence/generated-positive-male-bend.png) · [여성 생성 손목 회전](evidence/generated-positive-female-turn.png)

아바타 canvas만 캡처했다. 영상·실제 개인 좌표 저장/업로드0. 기존 A37의 얼굴·목/손 외형 결함을 유지한 미완성 검증 화면이며 확정 디자인/최종 외형으로 제시하지 않는다. 새 공개 화면·문구·조형/GLB·API/SQL·SDK 운영 정책 변경0. 최소 텍스트·화이트/블루 웹 방향을 유지한다.

전체frontend1068/타입/Biome/assets/build/public guard/diff 및 로컬 Ruff 통과. 최종 native 손12·기존 머리12·생성 표시 남녀2와 초기 native 손12의 실제 결과를 보존했다. 공개 JS/CSS·5모델 byte는 동일하고 공개 GLB0이다. [source29·증거147 SHA와 원문 gzip](summary.json). 원격 체크가 없으면 **체크 없음**이며 CI 통과로 부르지 않는다.

## 실패·작성자 리뷰

명세/단위 하네스를 먼저 작성하고 미구현 모듈 RED(exit1/실행 테스트0)를 보존했다. 초기 연결의2실패는 video source가 선택적 손 payload를 누락해서 발생했다. 원래 stamp를 유지한 조건부 handoff로 수정했다. 리뷰에서 가변 face 설정을 뒤늦게 읽는 문제를 새 RED로 확인하고 decoder 이전 함수/행렬 순서 복사·null 거부로 해결했다.

없는 current main GLB 경로를 읽은 에셋 helper 실패, 기존 receipt 이름 충돌로 검증 실행을 거부한 실패, scheduler 라이선스의 top-level/lexical symlink 조회 실패2개도 보존했다. helper 실패는 실행/배포/품질 실패를 성공으로 바꾼 것이 아니다. 일부는 원본 tool 출력 메모이며 전체 로그가 없음을 표시했다. 두 partial archive는 로컬 proof에 이동 보존했다. 초기 source는 커밋과 receipt, 시험 결과는 그대로 보존했고 최초 성공 private bundle은 최종 빌드로 갱신되었으므로 초기 번들 원본 보존으로 주장하지 않는다.

테스트 전략 스킬에 따라 연결·누락·취소·권한/정리·실제/합성을 분리했다. 코드 리뷰 스킬로 보안/개인정보, 수명/부분 실패, 원래 timestamp/복사, 기존 caller 회귀, 수용 기준을 작성자 검토했다. 독립 리뷰어/실제 사람 검증이 아니다. Story 미해결P1/P2=0, 전역 D2 및 시작 준비 성능P2는 그대로 남는다. 의도적 private leak guard RED1→복원 GREEN0도 실제 확인했다.

## 남은 필수 조건

같은 입력과 SDK Left/Right 후보는 동일인 연결 증거가 아니다. score[0,1]은 형식 검증만 하고 정확도 기준이나 출력으로 쓰지 않는다.21점은 관절별 가시성·축 비틀림·중수골·경추/체간·임상 각도/정답을 증명하지 않는다. 미완성 정보를 공개 코칭에 승격하지 않는다.

다음은 코칭 단계에 맞는 시범/사용자 비교 연결의 선행 조건을 정리하고 독립 기술 구현을 진행한다. 실제 동작의 시작/목표/복귀·보상·가림·복수 인물/촬영 범위는 동의한 참가자·관찰자와 별도 튜닝/검증 사례가 필요하다. 최종 외형/권리·승인 디자인·실제 노트북/장시간·SDK egress·외부 인증/메일·HTTPS/운영 및 전체1~6은 미완료이며 출시 적격 동작0이다.

시험 CSP/닫힌 proxy 차단 시도는 운영 SDK 무통신/정책 승인이 아니다. renderer PBR baseline cache는 전체 GPU/worker 해제 증거가 아니다. 시험 DB는 종료하고 데이터를 보존했다. 비용·계정·시크릿·운영DB/migration·배포·출시·중요한 안전/개인정보 변경은 별도 승인이다. [이월 조건](../../stage2-carryover.md)과 [검증 번들 고지](notices/README.md)를 유지한다.
