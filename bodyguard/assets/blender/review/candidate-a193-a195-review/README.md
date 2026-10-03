# A193–A195 — 정면 보존·뒤 목 회귀 분리와 실제 재검수

2026-10-03, S2.4. **A195는 기술 검사를 통과했지만 외형 미통과·미채택이다.** 뒤쪽 머리–목 경계와 GLB/웹의 작은 표면 흔적이 남아 A-02/A-08 P2, Draft PR #9 병합 보류, 개발 기본 A37을 유지한다. 2단계와 전체 1~6단계는 완료되지 않았다.

최신 CEO 사진의 얼굴·목·연속 연결, 남녀 무의상 중립 백색·통일 마감, 필요한 신체 구조와 리깅 정확도 요구를 기존 Story/명세에 이어 적용했다. 사진 SHA256은 `45b313912dee5ae2218b1fe76086abb35a9b948fab9e877f1a9d2b05f832de62`이다. 참조와 픽셀 단위 동일·외형 승인·의학적 정확도를 주장하지 않는다.

## 실제 제작과 반려 기준

원래 전문 에셋을 사용한 A146 전체 후보의 복사본에서 정면 얼굴과 앞 목을 보존하고 뒤쪽만 국소 native 면 분할·fairing했다. 전문 도구 Blender의 실제 mesh 작업이며 원시 도형으로 신체를 새로 생성하지 않았다. 전체 신체/목 remesh, 검사 기준 완화, 적용 뒤 좌표·skin 복구는 하지 않았다.

| 실행 | 실제 결과 | 저장/판정 |
|---|---|---|
| A193 | 기존 긴 접힘 남1/여0 → 17/7, 추가 이동5.087/4.580mm | native exit1·실제6PNG, 원본 저장 전 반려 |
| A194 | 같은 안정 point/edge ID로 회귀 재현. 새 접힘 남16/여7의 모든 끝점이 높이 비율0.875 아래 | native exit0·진단 완료일 뿐 형상 불합격, 새 PNG/원본/GLB 없음 |
| A195 | fairing 전에 하부 cap 원래 좌표를 보호. 긴 접힘 기존1/0 유지·새 접힘0, 추가 이동0.449/0.586mm | native exit0·실제6PNG·별도 편집 원본 저장, 외형은 반려 |
| 독립 재열기 | 원래 named skin 남129630/여128389점, 보호 좌표126101/125394점, 손·group·각163 rest bone·행렬·재질·변경 밖 면/winding 보존 | native exit0·저장된 실제 원본 대조 통과 |

0.875 높이 비율과 6mm 제한은 국소 조형 보호 기준이지 해부학/임상 허용 범위가 아니다. A195는 남2015/여2165점이 새로 생긴 국소 위상 변경이며 전체 좌표/면 배열 동일이 아니다. 기존 ledger entries는 보존하고 새점은 0으로 연장했다. 원래점의 named skin은 모두 동일하나 새점의 skin은 native 보간됐다. 기존 남성 긴 접힘1개는 남아 있다. 상부 면각 p95도 남2.593→2.617°, 여2.637→2.680°로 모든 지표가 개선된 것은 아니다.

정면 사진에 더 가까운 기존 face/앞 목을 남기는 방향으로 바꾸었다. 실제 측면/뒤 렌더에서는 머리 아래 경계가 아직 단단하게 보이고, GLB 목–승모근 확대에는 작은 삼각형 표면 흔적도 남는다. 숫자 통과를 외형 완료로 대체하지 않는다.

## 실제 재실행한 검증

- 새 편집 원본: 전체121행/중립 제외118변형, 실패0, 실제34PNG.
- 새 GLB를 native 재수입한 원본: 전체121행/중립 제외118변형, 실패0, 실제34PNG.
- 실제 설치 Chrome: 3개/93.314초, 외부 연결 차단·남녀 GLB 두 복제본 독립 변형·로드 실패/연결 상실 후 재시도 통과. 테스트의 503 오류는 의도한 복구 fixture이다.
- frontend `pnpm check` 56파일·`pnpm exec tsc --noEmit` 실제 exit0.
- 새 Python4개 default Ruff·격리 E/F·format 검사 모두 exit0. A194 초기 unused Vector F401은 native 실행 전에 보완했다. 최초 생성 JS의 index 오류도 파일 쓰기 전에 중단됐다.
- native 7회 종료는 순서대로 `1/0/0/0/0/0/0`. 전체 stdout·명령·terminal chunk를 보존했고 native 실행끼리와 Chrome 실행은 겹치지 않았다.

내보내기는 ratio1·최대8 skin influences이며 남녀 각각 fin2개를 정리했다. armature-parent 경고5개를 그대로 로그에 보존했다. 따라서 “경고 없음”이나 “GLB skin이 원본과 byte 동일”이 아니다. 이후 왕복 변형과 Chrome 검사를 별도로 실제 통과했다. 두 GLB에는 승인된 시범 animation이 없다.

Chrome API401은 하네스 fixture이며 카메라 호출0·사람 촬영0이다. 남녀 각각180프레임의 합성 technical 렌더 p95는17.7/17.4ms다. 웹캠 추론/코칭 정확도·사람 동작 지연·실제 목표 노트북 집단의 성능으로 확대하지 않는다.

## 원본과 실제 미리보기

- [새 편집 원본](a195/artist-candidate.blend), [웹 내보내기 원본](web-candidate.blend), [GLB 재수입 원본](web-candidate-roundtrip.blend)
- [남성 GLB](glb/bodyguard-male-candidate.glb), [여성 GLB](glb/bodyguard-female-candidate.glb)
- [원본 정면](source-review/faceless-front.png), [원본 사선](source-review/faceless-quarter.png)
- [남성 GLB 측면/잔여 목 경계](roundtrip-review/faceless-side-male.png), [여성 GLB 뒤쪽](roundtrip-review/faceless-body-back-female.png)
- [남성 실제 브라우저](browser/남성-two-models.png), [여성 실제 브라우저](browser/여성-two-models.png)

전체 새 PNG82개 중 직접 열람62개: A193 6+A195 6+원본24+왕복24+브라우저2. 자동 생성/검사34컷 각각을 “모두 직접 열람”으로 표시하지 않는다. 직접 열람한 파일은 execution record에 정확히 열거했다.

## 보존과 다음 작업

[실행 기록](execution-record.json), [사본 manifest](copy-manifest.json), [무결성 검사](evidence-check.cjs). 실제109사본/22gzip/82PNG/새 blend3·GLB2, 이전953파일과 원래 A146/제작 helper의 SHA 불변이다. 재귀 무결성 검사는 기술 증거·원본 보존 확인이지 외형/임상 승인이나 보안 감사가 아니다.

다음은 실제 뒤 목 seam/edge flow와 native→web 표면 차이를 좁혀 국소 구조를 보완한다. 전면 형상을 바꾸거나 전체 smoothing 강도를 반복하지 않고, 변경 원본 준비 뒤 원본·GLB·변형·브라우저·외형 검사를 다시 실제 수행한다. 실제 사람/시범/리타게팅·Gmail/Google 연결·2단계 전체와 이후 출시 게이트는 여전히 미완료다. 기존 1~6단계 완료 기준·사전 승인 운영 규칙·별도 승인 대상은 유지한다.
