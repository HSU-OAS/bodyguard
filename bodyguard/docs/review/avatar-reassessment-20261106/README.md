# 남녀 아바타 표면 재검증 · 미승인 후보

2026-11-06 · 기준 main d9b0fa93 · 외형/성능 P2 미해결 · 제품 적용 및 출시 없음

사용자가 최종 아바타 보완을 다시 요청해, 기존 [Draft PR #150](https://github.com/HSU-OAS/bodyguard/pull/150)의 원본과 실패 증거를 변경하지 않고 별도 Blender 사본에서 검토했다. 입력은 PR #150의 `continuous-20261014/models/candidate-continuous-unapproved.blend`, SHA-256 `71c369c96667549d00a4e77ff5d0b301ce307d806d5f3b42e739f48b4b7a8a2d`다. 사용자가 정한 남녀 공통 무의상 백색 마네킹과 얼굴·목 연결 요구를 유지한다. 이 작업은 최종 승인이나 완성형 선언이 아니다.

## 원본과 세 보완안

- **fair**: 앞면·외부·X/Z 좌표, 토폴로지, 가중치, 뼈대와 기존 속성을 보존한 채 뒤 목·어깨 깊이를 별도로 미세 조정했다. 최대 변위는 남성 약 0.735mm, 여성 약 0.959mm다. 수정 전후 접힘 검사에서 두 모델 모두 0이었으나 여성 뒤쪽 표면은 여전히 매끈한 최종 외형으로 보기 어렵다. 여성 선택 영역의 최대 이면각은 약 45.0°에서 48.9°로 증가했다. 기술 검사 통과를 외형 합격으로 보지 않는다.
- **full3d**: 같은 부위를 세 축으로 보완한 대안이다. 접힘 0·외부/리그 보호 검사는 통과했지만 최대 이면각이 남성 36.8°→54.0°, 여성 45.0°→60.6°로 증가했다. 외형 개선을 입증하지 못해 채택하지 않았다.
- **corrective**: 길이 가중 보완 대안이다. 여성 위험 정점 10개를 원래 위치로 되돌렸고 여성 최대 이면각이 45.0°→84.7°로 증가해 채택하지 않았다. 시험 후보와 수치를 보존한다. 이면각은 선택 메시의 기술 지표이며 단독 미관 점수나 인체 판정 수치가 아니다.

[기존 여성 뒷모습](preview/original/female-back.png) · [fair 여성 뒷모습](preview/fair/female-back.png) · [fair 여성 정면](preview/fair/female-front.png) · [full3d 여성 뒷모습](preview/full3d/female-back.png). 모두 실제 Blender 렌더이며 같은 카메라·재질·조명과 16 samples를 썼다. 모든 자세와 각도에 대한 시각 검사를 완료한 것은 아니다.

## 실제 검증

- Blender 5.1.1에서 기존 원본, `fair` 원본, 웹 변환 `.blend`, GLB 재가져오기 파일 각각에 기존 기술 검사를 재실행했다. 각 121개 검사/종료 0, 렌더 없는 검사다. 전신 연결성, 비매니폴드, 원본 스킨 가중치와 여러 뼈의 기술적 변형을 확인한다. 기술적 관절 각도는 사용자의 운동 지침이 아니다. 실제 사람을 촬영한 추적 정확도·운동 안전성의 증거는 아니다. [원본](proof/original-qc.json), [fair](proof/candidate-fair-unapproved-qc.json), [웹 파일](proof/web-fair-qc.json), [GLB 왕복](proof/web-fair-roundtrip-qc.json).
- GLB 내보내기와 재수입은 실제로 수행했다. 이전과 마찬가지로 내보내기에서 가중치 제한 메시지가 발생했으므로 [원문 로그](proof/export-fair.log)를 남긴다. 에셋의 보편적인 정확성이나 모든 애니메이션 통과를 뜻하지 않는다.
- 실제 Chrome/WebGL, Apple M4의 로컬 합성 관절 재생에서 두 남성/여성 독립 아바타와 전신 구도를 검사했다. [실제 남성 화면](preview/browser/fair-male-after.png), [실제 여성 화면](preview/browser/fair-female-after.png), [결과](proof/browser-fair.json). 외부 요청·카메라 호출·페이지 오류는 각 0건이었고 실제 사람 입력과 코칭은 시험하지 않았다.
- 같은 장치에서 브라우저를 다시 열어 잰 첫 준비 시간은 기존 남성 381ms/여성 340ms, fair 남성 345ms/여성 273ms였다. 각 1회, 이미 이전 Blender·Chrome 검사를 실행한 환경이다. 60프레임 합성 재생의 프레임 간격 p95는 약 16.7ms였다. **진정한 기기 냉시작, 다른 노트북, 실제 웹캠 병행, 장시간 사용을 검증하지 못했으므로 기존 초기 성능 P2는 유지한다.** [기존](proof/browser-original-cold.json) · [fair](proof/browser-fair-cold.json).
- 샌드박스 안의 첫 Blender 실행은 초기화 중 종료 코드 139로 실패했다. [실패 로그](proof/sandbox-crash.log)를 남겼고, 분리 실행으로 위 검사를 재실행했다. 기존 파일을 덮어쓰지 않았다.

## 보존 및 재현

수정 가능한 세 `.blend`와 fair 남녀 `.glb`는 [models](models/)에 있다. 실행한 Blender 스크립트와 로컬 Chrome 스크립트는 [executed](executed/), 결과와 로그는 [proof](proof/)에 있다. 기존 원본은 PR #150의 위 commit에서 얻고 SHA를 확인한다. `review_candidate_full3d.py`는 실행 당시 스크립트를 그대로 보존했으므로 과거 depth-only 설명 주석과 달리 X/Z 복원을 제거한 세 축 대안이다. `review_avatar.py`와 `export_avatar_candidate.py`는 각각 새로운 출력 경로에서 실행해야 한다. Chrome 스크립트는 현재 frontend의 Vite probe, 허용 형식의 별도 `/private/tmp` 경로와 각 GLB SHA를 요구한다. 런타임 로그는 시험 환경 기록이며 운영 사용자 정보를 수집하지 않는다.

fair 모델/GLB SHA-256: `65cd76ec7e0cfd1f3d7912a220a35f1e27193abfead123ba4ba98ddc7a4d34f0` / 남 `1654956059ddd4958df65c2d34db30eb1f6e82d9e35310858d8aaa99ae642781` / 여 `443104b898e1201a27622c6f77ca64d41eb0af794a8798fe2904b750b4744655`. 기존 아바타, PR #150, 기존 실패 증거와 공개 제품은 변경하지 않았다.
