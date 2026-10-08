# 목 관찰 입력 연결 — 미완료 Draft

[S2.M2 명세](../../stories/native-neck-observation.md) · [실제 실행 요약](summary.json) · [원본/GZIP SHA](manifest.json)

촬영한 VideoFrame의 비율과 선택적 presence를 그대로 전달하고 현재 로그인 소유 재생에서 목의 이미지 평면 관찰값을 계산한다. 입력 반전과 아바타 표시 반전을 분리한다. 가림·낮은 신뢰도·복수/미검출·만료·중단/새 세대에서는 이전 관찰을 사용할 수 없다. available은 **정상 자세·올바른 스트레칭·동일인 확인이 아니다.** 파생 관찰도 임시 브라우저 메모리만 사용하며 기록/API/로그/파일로 내보내지 않는다.

## 실제 작동과 필수 실패

실제 Chrome154/SDK/AuthProvider/API/새 격리 PostgreSQL을 사용했다. 장치·메일·양성 좌표는 시험용이며 실제 사람/물리 웹캠은0이다. 최초 남녀 목 흐름2건은 촬영 비율→낮은 presence→가림/복수/미검출→중단/새 세대를 통과했다. 재진입 보완 후 같은 최종 소스에서 남성 새 흐름은 통과했으나 여성 새 흐름은 시작 단계에서 실패했다. 이전 여성 통과를 최종 여성 검증으로 대체하지 않는다.

| 최종 소스의 실행 | 통과 | 실패 | skip/retry |
|---|---:|---:|---:|
| 새 목 흐름 남녀 |1|1|0|
| 기존 native 회귀 남성 |4|8|0|
| 기존 native 회귀 여성 |8|4|0|
| 합계 |13|13|0|

13실패는 기존 running()의 nativeCloses≥3/5000ms 조건에서 발생했다. 조건·timeout·retry·가입 rate limit은 변경하지 않았다. 한 실제 실패의 카메라 시작 기준 SDK 준비는8663.4ms, 아바타 준비9766.9ms, 첫 결과 반환14915.3ms다. 새 목 복사에 전달될 body 결과보다 앞에서 지연이 관측됐지만 **근본 원인·변경의 인과 영향은 미확정**이다. 이후 읽은 높은 host load도 원인으로 확정하지 않는다. 성공 재실행을 해결로 세지 않는다.

전체 FE1327·Biome·tsc·build·production guard는 통과했다. 공개 JS355151/CSS31199 byte와 SHA는 PR88/89 기준선과 동일하다. 시험의 외부 요청0·현재 값 해제·SDK/프레임/모델 정리와 원본 GLB SHA를 확인했다. 이는 제품 SDK 무통신 승인·전체 GPU 수명·실사용 성능 증거가 아니다.

실제로 몸통 회귀가 작동한 [여성 옆 화면](regression-female-nativefeedback-female-nati-186f8-fresh-generation→own-record-trunk-female-side.png)과 [앞 화면](regression-female-nativefeedback-female-nati-186f8-fresh-generation→own-record-trunk-female-forward.png)은 기존 A37/생성 관찰의 시험 화면이다. **미완성·미승인 외형이며 최종 디자인/올바른 시범이 아니다.** 조형/Blender 재저장/GLB export0이다.

## 보완·원본 보존·작성자 검토

- 최초250건의235통과/15실패로 촬영 크기·presence·현재 neck 경계 누락을 재현한 뒤 연결했다.
- 추가261건의260통과/1실패로 foreign image getter가 더 새 관찰을 이전 값으로 덮는 경계를 재현했다. per-pair token과 퇴역 검사를 보완했고 전체1327에서 통과했다.
- 두 타입 검사의 실패를 수정했다. 해당 txt는 설명 기록이며 원래 stderr receipt로 표시하지 않는다. 원본 오류는 실행 대화에 남는다.
- 증거 수집기의 첫28≠26 실패는 per-case final snapshot이 helper의 run 선택 boolean을 덮은 문제였다. selectedFinal로 분리하고 기존 부분 파일의 같은 byte만 재사용했다. 파일 삭제/덮어쓰기0, 제품 시험 결과 변경0이다.

147개 증거와249개 실행 소스 SHA를 대조했다. 각 원본/실패/compiled probe를 보존하며 최종 남녀/회귀 probe byte도 동일하다. 실행 당시 HEAD는 기준 main5a1a3d8이며 이후 새 커밋에서 시험한 것으로 바꾸지 않는다. 직접 만든 DB는 정상 종료/데이터 보존했고 캐시는 유지한다.

graphify의 기존 그래프는 경로 탐색만 사용하고 현재 파일을 별도로 확인했다. testing-strategy·code-review·debug로 캡처 시점/신뢰도·재진입·소유/정리·실제/모의·시작 지연을 구분했다. 작성자 검토이며 독립 에이전트/전문가 승인이 아니다. **시작 회귀 P2와 필수 검증 미충족으로 병합할 수 없다.**

## 다음 조건

최신 main과 변경 소스를 동일한 시작 조건에서 대조하고 SDK 준비/추론·실행 순서/환경 영향을 분리한다. 필요한 보완 후 남녀 새 흐름과 기존 회귀 모두 실제 통과해야 한다. 미완료 코칭은 공개하지 않는다.

출시 적격0·실제 사람/관찰자·카메라 반전/정확도·임계값/교정 콘텐츠·최종 아바타/권리·승인 공개 구조·SDK/외부/HTTPS/운영 및 D2/전체1~6은 미완료다. 최소 텍스트·안전/오류 안내·기존 원본/실패·같은 부위 새 조형 보류·별도 승인 기준을 유지한다.
