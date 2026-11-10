# 앉은 시작 자세의 native 시범 후보

2026-11-11. 원문의 앉은 시작과 기존 목·팔 올림 시범의 선 자세 불일치를 보완한 별도 [Blender 원본](models/seated-unapproved.blend)을 만들었다. 원래 6개 action을 보존한 사본에서 남녀의 목/팔 올림 4개 action에만 일정한 다리 자세 키를 추가했다. 메시·가중치·정지 뼈대 해시는 동일함을 [제작](author.py)에서 대조했다([결과](report.json)). 허벅지를 앞쪽으로, 종아리를 아래로 향하게 한 것은 의자에 앉은 모습을 그리는 작화 설정이며 의료적 정답 각도가 아니다. 의자 접촉이나 실제 관절 정확도를 검증하지 않았다.

실제 Blender에서 [남성 시작](male-neck-side-1.png)·[여성 시작](female-neck-side-1.png)과 [여성 팔 올림](female-arm-overhead-44.png)을 렌더했다. 형상은 기존 미채택 아바타이며 이 자료로 최종 디자인/변형이 승인되지 않는다.

## 변형 실패와 채택 범위

시작·좌우 목표·복귀 5프레임씩 4개 action에서 원래 1mm 초과 모서리의 늘어남을 검사했다([시험](verify.py), [후보 결과](deformation.json)). 목 시범에서 최대 모서리 비율은 남성 약 1.91, 여성 약 2.02였지만 여성 팔 올림은 기존 3배 기술 경계를 넘었다. 기존 시범 원본도 [같은 검사](verify-baseline.py)에서 동일 부위 약 3.58배 늘어나 실패했다([원본 결과](baseline-deformation.json)). 원문·실제 인체의 정답 허용각과는 관계없는 메시 기술 검사다.

추가로 팔 올림의 원래 총 작화 회전량을 유지하면서 쇄골/위팔 사이의 회전을 바꾼 [별도 실패 후보](failed-distribution/candidate-unapproved.blend)를 만들었으나 남성도 기술 경계를 넘고 최대 약 3.73배로 악화돼 채택하지 않았다([제작](failed-distribution/author.py), [검사](failed-distribution/deformation.json)). 두 후보와 이전 원본을 보존하며 한계를 낮추지 않았다. 팔 올림 후보는 GLB·제품에 반영하지 않는다.

## 목 시범 GLB와 브라우저

남녀 **목 시범만** [별도 애니메이션 GLB](neck-animations/export-report.json)로 내보냈다([exporter](export-neck.py)). 두 GLB의 실제 parse와 기존 163관절 바인딩, 시작 clip의 앞쪽 허벅지 방향을 검사해 2개가 통과했다([당시 시험 source](glb-test.ts.txt), [결과](glb-test.log.gz)). 이 시험 코드는 frontend/src/avatar에 임시로 두고 실행한 후 옮겨 기존 전체 검사 범위를 확장하지 않았다.

검수 화면의 원래 **크기·SHA 검사는 유지**하면서 시험 중에만 목 시범 2개의 기대 크기/SHA와 응답을 후보값으로 바꿨다([runner](browser-runner.mjs), [실제 Chrome/WebGL 결과](browser.json)). 목의 좌우·정지/복귀·시범 단계·컨텍스트 손실·손상 GLB/명시 재시도·숨김/401 정리가 통과했다. 화면 검사에 함께 등장한 어깨·팔 시범 4개는 기존 파일이며 이 목 후보의 수정이나 외형 승인으로 세지 않는다. 카메라·외부 요청·페이지 오류 0, 원본 파일 전후 해시 동일이다. runner는 frontend/scripts에 두고 임시 내보내기 경로를 준비해야 재실행할 수 있다.

이 결과는 앉은 시작의 목 시범 기술 후보다. 최종 남녀 외형·목 연결부 변형, 실제 사람 오판정/시범 적합성·임상 기준·지속 성능을 통과하지 않았고 공개 제품/배포에 적용하지 않았다. 남녀 목 시범도 출시 적격 동작 수를 늘리지 않는다.
