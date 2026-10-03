# A190–A192 — 전문 머리·목 결합과 국소 면 구성 검증

상태: S2.4a 진행 중. **새 얼굴·목 참조에 대한 외형은 미통과이며 서비스에 채택하지 않았다.** 남녀 백색·무의상·중성 표면, 필요한 신체 구조와 리깅 정확도, 1~6단계 및 승인 계약은 변경하지 않는다.

A190은 과한 턱 아래 투영을 제한한 전문 head cage와 원래 동반 neck을 실제 부모 행렬로 배치하고 body 복사본과 native EXACT UNION했다. 닫힌 단일 성분·non-manifold/작은 면 0이지만 길이1mm 초과 edge의 90° 초과 접힘이 남62/여41개여서 반려했다. 얼굴 앞면에도 잔여 띠가 보인다.

A191은 실제 Boolean/절단 경계점과 긴 접힘의 끝점에서 mesh geodesic16mm 안의 영역만 native SMOOTH16회/.35로 정제했다. 마스크0점·정제 전후 위상을 보존했고 최대 추가 이동 남4.050/여5.003mm로 기존6mm 제한 안이다. 남성 긴 접힘0개, 여성57개로 여성은 실패했다. 실제 여성 측면/뒤쪽의 검은 틈처럼 보이는 접힌 표면도 기록한다. 닫힌 위상과 좋은 외형은 다르다.

A192는 같은 결합부만 native triangulate·긴 edge 1회 subdivision한 뒤 동일 국소 정제를 실행했다. 원래 전문 점을 재구성 단계에서 정확히 보존하고 영역 밖 남93296/여92440개 면을 유지했다. 추가 이동 남3.246/여2.346mm·긴 접힘0개·작은 면0개·단일 닫힌 성분으로 **이 복사본의 국소 기술 검사만** 통과했다. 남성 최대 국소 면각141.152°는 짧은 edge에도 검사값으로 남아 있으며, 모든 접힘/침투/해부학/가중치가 해결됐다는 뜻이 아니다.

## 실제 결과와 한계

| 시험 | 남성 | 여성 | 외형 판단 |
|---|---|---|---|
| A190 결합 | 긴 접힘62개 | 긴 접힘41개 | 목의 단차·잔여 얼굴 띠 |
| A191 국소 정제 | 긴 접힘0개, 4.050mm | 긴 접힘57개, 5.003mm | 여성 접힘 회귀, 미채택 |
| A192 국소 면 보완 | 긴 접힘0개, 3.246mm | 긴 접힘0개, 2.346mm | 뾰족한 측면 턱·머리/목 뒤 경계 남음 |

6mm는 기존 추가 목 정제의 기술 제한이며 임상/운동 기준이 아니다. A190 앞면 cage 투영 최대 남16.408/여15.313mm, A191/A192 남16.408/여19.115mm는 별도 머리 조형 값이다. 그 값을 추가 목 정제6mm 검사 통과로 확대하지 않는다. 전신의 균일 높이를 맞춘 원래 전문 body 복사본이고 **해부학적 등록·기존 팔을 내린 중립 리그·최종 남녀 전신 마네킹을 완성한 시험이 아니다.**

세 native 실행 모두 exit0이며 실제18PNG를 전부 직접 열람했다. 현재 A146 전체 좌표·skin·면·group·각163rest bone/행렬과 입력 SHA는 완료 snapshot에서 보존했다. 이전915파일과 개발 A37을 그대로 유지했고 34사본(16gzip/18PNG)을 추가했다. **새 blend/GLB·독립 원본 재열기·원본/GLB118변형·Chrome·사람 웹캠은 각각0**이다. 과거 118/Chrome 기록의 해시 검사는 새 시험 재실행이 아니다.

아래는 아카이브·로그 정합성 검사이며 외형 승인/출시 검증이 아니다.

```bash
node bodyguard/assets/blender/review/candidate-a190-a192-diagnosis/evidence-check.cjs
```

## 실제 Blender 목·머리 진단 미리보기 — 완성 전신 아바타 아님

| 결과 | 남성 | 여성 |
|---|---|---|
| A190 | [정면](a190/native-overlap-front-male.png) · [측면](a190/native-overlap-side-male.png) · [뒤](a190/native-overlap-back-male.png) | [정면](a190/native-overlap-front-female.png) · [측면](a190/native-overlap-side-female.png) · [뒤](a190/native-overlap-back-female.png) |
| A191 | [정면](a191/native-overlap-front-male.png) · [측면](a191/native-overlap-side-male.png) · [뒤](a191/native-overlap-back-male.png) | [정면](a191/native-overlap-front-female.png) · [측면](a191/native-overlap-side-female.png) · [뒤](a191/native-overlap-back-female.png) |
| A192 | [정면](a192/native-overlap-front-male.png) · [측면](a192/native-overlap-side-male.png) · [뒤](a192/native-overlap-back-male.png) | [정면](a192/native-overlap-front-female.png) · [측면](a192/native-overlap-side-female.png) · [뒤](a192/native-overlap-back-female.png) |

다음 작업은 기존 전문 head의 측면 턱/후두부 접선을 국소 정제하고 실제 연속 목에 맞춰 피팅하는 것이다. A192의 국소 면 보완을 출발점으로 검수하되 보호 기준을 낮추거나 전신/목 전체 remesh하지 않는다. 전체 후보 준비 후 원본·GLB·각118변형·브라우저·남녀 외형을 실제 재실행한다. A-02/A-08 P2·Draft PR #9 미병합·전체2단계 및1~6단계 미완료를 유지한다. 사용자 Blender GUI·외부 계정·시크릿·운영DB·배포·출시는 변경하지 않았다.
