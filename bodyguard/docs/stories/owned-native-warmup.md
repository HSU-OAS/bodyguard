# S6.19 — 로그인 소유 첫 추론 준비 통합

2026-10-09 · 최신 main ce137244(PR105) · FR-M-01/02/07·FR-A-03·FR-S-04·FR-R-03·NFR-07/08.

## 범위

S6.18의 기본 false 준비용 추론을 실제 AuthProvider/useRecordedCoaching/native SDK/API/격리 PostgreSQL 조합에서 검증한다. 공개 화면·문구·코칭 연결·SDK 통신 정책·default Worker·GLB·신체 판정·운영 설정을 변경하지 않는다. 시험 전용 opt-in만 연결하며 준비 중 수행 판정·타이머·기록을 만들지 않는다.

## 구현 전 수용 기준·하네스

- 기본 original26(남녀, captured neck 포함)을 준비용 추론 없이 실제 재실행한다. 기존 5초 poll·60초 test·retry0·제품 제한을 유지한다.
- opt-in: 같은 소유 source에서 첫 body/face/hands와 입력 회수가 끝난 뒤 running을 연다. running 전 evaluator/관찰/render/적립/기록0, 다음 live frame부터 기존 전달 경로를 사용한다. ready 시점의 고정 기술 count만 보존한다.
- actual SDK 결과 반환 후 TEST Promise 장벽을 걸고 준비 중 logout/server401/pagehide/unmount와 같은 계정 refresh를 보낸다. 권한을 즉시 폐기하고 늦은 결과가 ready/start/save를 되살리지 않아야 한다. 실제 native hang 시험으로 주장하지 않는다.
- 장벽 해제 후 camera/input/source/SDK/GLB/GPU 회수, 같은 계정 명시 재준비·재시작의 새 source/새 owner, 과거 작업의 기록0을 실제 확인한다. 자동 재시작0.
- renderer 준비 대기 취소와 이후 live 오류·가림·복수/미검출·시범 변경·pause/resume·본인 중단 기록 흐름도 opt-in에서 재실행한다.
- timing의 기본 render→첫 추론 계약은 그대로다. opt-in의 준비 추론→첫 live render 계약은 별도 표시한다. 준비 비용 이동을 전체 시작 개선/임상 정확도/실제 부드러움 증거로 표시하지 않는다.
- 최초 source·private bundle·report/log·실패를 실행 전후 독립 경로로 보존한다. source와 binary를 덮어쓴 뒤 hash만 남긴 것을 보존으로 표시하지 않는다.
- 전체 FE/타입/Biome/public build/guard·공개 byte/GLB 불변·scoped 작성자 리뷰·원격 exact HEAD/CLEAN/체크·merge commit/브랜치 보존.

## 제외·미완료

메일·카메라·운동 plan과 긍정/오류는 합성; SDK/API/SQL/browser는 실제다. release motion0·최종 아바타/실측/완성 공개 코칭/실제 참여자·SDK 공개 정책·Docker/TLS/운영·1~6 완료 기준은 그대로 남는다. 새 조형 사이클·미승인 화면 확장·개인정보 정책 변경0. 사용자 텍스트를 추가하지 않는다.

## 진행

- [x] 최신 main에서 독립 Story와 구현 전 검증 계약 작성.
- [x] 실제 기본26/opt-in 기존30/새 준비12를 단일5초 기준으로 최종 재실행. 최초 실패1·이전 source/bundle/report 보존. [실제 흐름과 검증 경계](../review/owned-native-warmup/README.md).
- [x] 전체 FE1479/타입/Biome/assets/build/guard·공개 byte/GLB 불변·현재 source18/증거973 검증·scoped 작성자 리뷰. 최초 archive 보존/중복 제거, 최초954 원문/압축 SHA 유지 확인.
- [x] commit/push/PR/exact HEAD 조건부 merge. PR106 source9e1ea57c·mergea44e7130, 실제 main 포함/브랜치 보존 확인. [병합 후 원격 기록](https://github.com/HSU-OAS/bodyguard/pull/106#issuecomment-6082793645). 이것은 S6.19의 좁은 범위이며 전체1~6 완료가 아니다.
