# A98 — 손목 경계 밀도 읽기 전용 조사

A97 실제 Chrome에도 남은 전완 줄무늬의 다음 조사다. native Blender5.1.1로 저장된 A97 원본만 읽어 경계 간격/연결을 기록했다. **원인 확정·수정 완료·외형 PASS가 아니다.**

| 경계 | 남성 좌/우 | 여성 좌/우 |
|---|---|---|
| 전완쪽 -80mm | 42/42점 | 42/42점 |
| 손쪽 +9mm | 96/96점 | 94/94점 |
| 손쪽 최소 edge | 6.442/10.649μm | 105.218/112.964μm |

8경계 모두 단일 닫힌 contour·degree2, 보호 손 정점0이다. 손쪽 경계의 500μm 미만 edge는 남10/8개·여9/9개이며 전완쪽은 남0/1개·여0/1개다. 기존 native bridge의 서로 다른 밀도와 불균일 간격은 확인했으나 이것이 화면 줄무늬를 발생시키는지에 대한 **인과 비교/브라우저 재시험은 아직 하지 않았다.** 사용자 좌표/측정 정확도/해부학 수치가 아니라 제작 메시의 국소 간격이다.

실제 native session78636/exit0, source SHA 불변이다. 첫 Ruff check0·isolated88 format check1(한 줄 배치)→format0/check0/format check0 뒤 실행했다. 기존 bmesh·native KDTree·Python stdlib를 썼고 새 의존성/모델 save/좌표·skin·뼈 변경0이다. [실제 보고서](contour-spacing.json)와 [실행한 코드](contour-spacing.py)를 그대로 보존한다.

```sh
'/Applications/Blender.app/Contents/MacOS/Blender' --background --factory-startup --disable-autoexec bodyguard/assets/blender/bodyguard_avatar_candidate_a97_unapproved.blend --python-exit-code 1 --python /private/tmp/bodyguard-tailor.6b7Uvu/a98-wrist-contour-spacing.py -- /private/tmp/bodyguard-tailor.6b7Uvu/a98-wrist-contour-spacing.json
node bodyguard/assets/blender/review/candidate-a98-diagnosis/evidence-check.cjs
```

첫 명령은 이미 생성한 출력을 덮어쓰지 않으므로 replay에는 새 임시 JSON 경로를 사용한다. 현재 스크립트 원본은 위 tmp 경로에 있고 저장소 실행 코드 사본의 내용이 동일하다.

새blend/GLB/PNG0, 새 전체118변형/Chrome/실제 사람 촬영·좌표 수집/운동·retarget·통합 지연/외부 계정·시크릿·DB·배포·출시는 미실행이다. 기존 A97/모든 이전 원본·GLB·검증 증거·개발 기본 A37을 보존했다. 다음은 서로 다른 경계 밀도/근접 점이 bridge 연결에 미치는 영향을 native 메모리 대조한 뒤 국소 수정하는 것이다. 최신 얼굴·목 참조/무의상 통일 백색/관절·필요 구조/리깅 정확도·A-02/A-08 외형 P2·Draft PR #9 미병합·전체1~6/승인 기준을 유지한다.
