# S2.T21 현재 오류에 대응하는 시범 연결

상태: 구현·최종 실제 Chrome/로컬 검증·author-only 리뷰 완료 / PR 게이트 대기 · 2026-10-08

기준 main `36ed81463418a3749d026cba8aa579db8ef07fbe`는 PR #83의 실제 merge다. source/merge tree·원격 main·브랜치 보존 확인과 [실제 결과 기록](https://github.com/HSU-OAS/bodyguard/pull/83#issuecomment-6055527680)을 읽었다. 최신 main의 `codex/adaptive-reference`에서 하나의 목적으로 시작한다.

## 사용자 가치와 범위

FR-S-03/04·FR-A-01/03·FR-M-07: 기준 아바타가 같은 동작만 반복하지 않고 현재 오류에 대응한 사전 제작 교정 시범으로 전환한다. 단계 시범·사용자 표면 강조에 **오류 코드→저작된 교정 clip** 연결을 추가한다. 오류별 위치/수행법·실제 classifier·정확한 교정 시범 콘텐츠는 D2-M/T 검증에 의존하며 이 기술 연결로 검증된 동작을 만들지 않는다.

- 각 step은 선택적인 교정 시범 목록을 갖는다: id, 정확히 일치할 errorCode/regionId, 적용 phase 목록, 전문 제작 clip. 기존 단계 clip은 유지한다.
- evaluator가 동일 현재 관찰에 명시적으로 제공한 오류 코드만 선택에 사용한다. 부위만 같거나 코드가 없거나 미등록이면 임의 교정 시범을 선택하지 않는다. 여러 일치 오류의 목록 순서는 **저자가 정한 표시 순서**이며 의학적 위험/중요도 판정이 아니다.
- clip과 매핑은 카메라·SDK await 전에 복사/검사한다. 유효 bone·보간·쿼터니언·시간/scale 검사는 기존과 동일하다. 다른 motion/version·feedback region·중복/희소/잘못된 매핑은 준비 전에 거부한다.
- ReferenceCue의 교정 id·원래 sampledAt을 복사한다. 동일 clip은 매 프레임 다시 시작하지 않는다. 교정 시작/교체/해제 시 현재 표시 자세에서 부드럽게 전환하며 자동 반복/수행 성공/기록 진척을 생성하지 않는다.
- 교정은 같은 generation·관찰 sequence/시각·step/phase·소유권에 한정한다. RAF synchronize가 원래 capture 시각을 갱신해서 교정 수명을 늘릴 수 없다. 가림·미검출·복수 인물/새 관찰·만료·pause/종료·권한 회수에서 이전 안내를 적절히 정지/폐기한다.

미승인 공개 UI/디자인은 확장하지 않는다. 최소 텍스트·화이트/블루 웹 원칙을 유지한다. 같은 부위 조형·Blender 재열기/저장·GLB export·임상 임계값·SDK 정책·운영/DB migration·배포·출시 변경은 제외한다. 기존 원본/실패 증거를 보존하며 출시 적격 동작 0과 단계 완료 기준을 유지한다.

## 하네스와 수용 기준

| 검증 | 종류 | 통과 기준 |
|---|---|---|
| 매핑·복사·손상 clip | 순수/Three unit | 기존 clip 검사 그대로, 서로 다른 오류 코드와 현재 step/phase 정확 일치, mutation·희소·중복 거부 |
| 교정 표시→교체→해제 | 실제 Three sampler unit | zero-time 자세 점프0, 원래 clip 시간 단조/끝에서 정지, user/source 변형0 |
| 현재 관찰·소유권 | native adapter mock unit | 현재 관찰에만 전달, synchronize restamp0, 오래된 callback/다른 세대/권한 회수 차단 |
| 실제 미리보기 | 비공개 Chrome/WebGL | 남녀 기존 GLB에서 다른 교정 선택·정지·해제와 실패 복구. 합성 오류/저작 fixture이며 사람 정확도 증거가 아님 |
| 회귀·공개 경계 | FE 전체·type·Biome·build·guard | 필수 통과, 공개 후보/하네스/교정 엔트리0·공개 byte 비교, diff 검사 |

모의/실제/미실행을 구분하며 초기 실패를 기록한다. 실제 사람·물리 webcam·최종 외형/변형·권리·다장치·간헐적 시작 원인·승인 UI/SDK·HTTPS 운영과 전체 1~6단계는 미완료다. 최종 Story 검증/리뷰 후 기존 조건부 PR 병합 게이트를 실행한다.

## 실제 진행

runtime3c8ce1a의 남녀 오류별 시범 전환·가림 해제와 기존 phase/pause/새 세대·중단/본인 기록·refresh/logout401/이탈 경계18흐름을 최종 Chrome에서 통과했다. FE1169·type·Biome248(경고/info0)·assets/build/guard와 소스 안정성·공개 PR83 byte 동일을 실제 확인했다. [작동 흐름·실제 미리보기·실패·남은 조건](../review/adaptive-reference/README.md). 실제 AuthProvider/API/새 격리 SQL·가짜 장치/실제 SDK/기존 A37 GLB이며 양성/오류는 합성 대체다. 원문 실패/중간 오류·기존 원본을 보존했고 자체 DB는 정상 종료했다.

중복 cause/region/phase와 오래된 getter 재진입을 보완했다. author-only 리뷰의 이 연결 diff P1/P2는0이지만 실제 자세/콘텐츠·최종 외형/공개 UI·간헐적 시작 원인 및 D2/전체1~6의 미완료를 해결한 것은 아니다. 실제 PR/원격/체크/병합 결과는 최종 게이트 뒤 별도로 기록한다.
