# A101 — 실제 접힘·법선 원인 분리

A100의 Chrome 잔줄무늬를 대상으로 native 원본/재수입24행과 별도 pose-basis2행을 읽기 전용으로 대조했다. native2회/exit각0·Ruff/isolated88 format각0·7사본/5gzip·2JSON을 보존했고 입력 byte/SHA는 불변이다. **새 아바타/GLB/PNG/전체 변형/Chrome 검수0이며 외형 통과 증거가 아니다.**

## 확인한 것

- 원본은 남녀 custom normals=false·flat face0·pose exact identity0이다. 원본 자체의 손목 접합부 최대 기하 면각은 남 좌65.609/우102.809°·여 좌38.995/우143.851°로 남아 있다. A100의 좁은 면0/큰 접힘 수 감소를 매끈한 외형 합격으로 볼 수 없다.
- 재수입은 custom normals=true·flat face남10/여5지만 **flat arm face는 각0**이다. 단순히 팔의 flat shading 누락을 고치면 해결된다는 가설을 뒷받침하지 않는다. 원본/웹의 면·edge 집합은 달라 통계 차이를 고정 edge 개선율/정확도 수치로 쓰지 않는다. 쉐이더 전체의 결함이 없다는 증거도 아니다.
- 첫 보고서의 imported nonidentity pose163개는 **정확한 부동소수점 identity 검사**다. 별도 수치 대조에서 최대 행렬 원소 차이는 남6.079674e-6/여8.821487e-6였다. 이를163관절의 실제 움직임/회전량·임상 허용 오차로 해석하지 않는다. 임계값·리깅·원래 변형 QA guard를 바꾸지 않았다.

전완 앞쪽(-160~-80mm), 기존 연결(-80~+9mm), 손 쪽(+9~+80mm)을 기존 authored arm skin으로 구분해 양쪽 geometric dihedral 분포를 기록했다. 모델 제작 좌표이지 사람 스트레칭 목표 각도/위치가 아니다. 새 source 좌표/skin/pose를 수정하지 않았고 Blender 사용자 GUI도 바꾸지 않았다. 이미 있는 source/GLB 검증은 [A100](../candidate-a100-review/README.md)에 있으며 이번 대조와 합산해 ‘새 실제 검수’로 세지 않는다.

[표면/법선 실제24행](surface-normal-diagnosis.json), [행렬 원소 대조/flat arm](import-basis-rounding.json), [명령/session/exit/미실행](execution-record.json), [7사본 byte/SHA](copy-manifest.json), 실행한 두 코드/일회용 copier/두 native 관측 log를 gzip 보존한다. GLB 재수입용 임시 .blend 자체는 이 작은 진단 아카이브에 복제하지 않았다. 실제 GLB2와 source는 A100에 있고, checker는 임시 디렉터리 존속을 요구하지 않는다. exclusive copier를 재실행하지 않는다.

```sh
node bodyguard/assets/blender/review/candidate-a101-diagnosis/evidence-check.cjs
```

다음은 이미 대응된 같은 경계와 source/손/skin/rig 보호 기준을 유지한 **native bridge 보간 대조**다. custom loft/강도 반복/전체 머리 교체·좌표/skin 사후 복원·수용 기준 완화는 하지 않는다. 최신 얼굴/앞목·무의상 남녀 동일 백색/필요 구조·리깅 정확도·기존 파일/증거·개발 A37·외형 P2·Draft PR #9 미병합·전체1~6/승인 규칙은 유지한다. A100 생산자 S102를 이번 새 읽기 전용 코드의 Ruff 통과로 ‘해결’ 처리하지 않는다.
