# A27 여덟 가중치 웹 검수 — 외형은 미통과

2026-10-01 · Blender 5.1.1 · 설치된 Three 0.186.1/Chrome. Draft PR #9의 관절 변형 리뷰 보완이며 출시 아바타나 운동 정답의 승인 기록이 아니다.

## 원인과 실제 파일

같은 A27에서 [원본 삼각화 진단](source-triangle-diagnosis.json) → [네 가중치 진단](rejected-four-weight-diagnosis.json) → [질량 접기 반려](rejected-fold-diagnosis.json) → [여덟 가중치 진단](eight-weight-diagnosis.json)을 대조했다. 집중 검사는 8개뿐이며 `full_qa: false`다. [전체 왕복 검사](deformation-report.json)는 별도로 목 4개·단일 관절 114개, 합계 **118개 실제 통과**, 최대 국소 edge 비율 2.947680·의상 내부/방향 불일치 0개다. 기준은 기존과 같은 3 미만이며 완화하지 않았다. 파일의 300개 check 행에는 중립 위상과 각 포즈의 의상 표본 검사도 포함된다.

[왕복 변환 보고서](roundtrip-report.json)의 `transforms_passed`는 배율/위치 검사만 뜻한다. `geometry_deformation_pending: true`는 내보내기 시점의 상태이고, 이후 전체 검사는 위 별도 JSON에 있다. 출처 원본 [A27](../../bodyguard_avatar_candidate_a27.blend)은 변경하지 않았다. 이전 네 가중치의 실패 JSON·크기·해시는 [역사 기록](../web-candidate/README.md)에 남긴다.

| 현재 GLB | bytes | meshes | bones | SHA-256 |
|---|---:|---:|---:|---|
| 남성 | 13,002,844 | 8 | 163 | `93d9a3467f8ae8a14e02822052dbffa6e9973ba6b58c893554fdf49edcd0263a` |
| 여성 | 14,721,760 | 9 | 163 | `863e62e6cb16de8e4f670dd4e81a47b85df67dd0af6a6df636636b691c04662b` |

이미지·카메라·조명·액션 0개. 원본 142,160/139,663 vertices → 웹 body 142,154/139,652이며 미세 삼각형 fin 외 전신을 보존했다. 그림자나 불충분한 품질을 숨기기 위해 운동 목록·관절을 줄인 것이 아니다.

## 실제 Chrome — 제한된 조건

[실행 보고서](browser-report.json): headless·1440×1080·DPR 1·WebKit WebGL, 2개 통과, 약 32.7초. 실제 로컬 GLB 로딩·독립 두 뼈대·한쪽 기술 변형/정지·남녀 전환·503/실제 WebGL context loss 후 재시도·이탈·카메라 0회. API만 guest/401 고정 응답이며 503/context loss는 오류 주입이다. 정상 흐름의 JS/셰이더/WebGL 오류를 검사했다.

| 모델 2개 | 표본 | 평균 ms | p95 ms | draw calls | triangles | 여덟 가중치 surfaces |
|---|---:|---:|---:|---:|---:|---:|
| 남성 | 180 | 16.669 | 18.200 | 33 | 1,190,242 | 8 |
| 여성 | 180 | 16.667 | 18.400 | 37 | 1,374,162 | 10 |

정지 모델 회전 0, 움직이는 모델 약 0.2094 rad, 뼈대 공유 없음. native depth 그림자 패스를 포함해 이전 단일 렌더와 draw/triangle 수가 다르다. CPU/GPU 장치 모델·물리 전원은 수집하지 않았으며 값은 프레임 간격이다. GPU 작업 시간·실제 웹캠 인식·피드백 지연·다양한 장치 성능의 검증이 아니다.

실제 화면 [남성](male-two-models.png)·[여성](female-two-models.png)을 확인했다. **여성 의상 경계/뒤 목/손목, 남성 골반 쉘/어깨와 참조 대비 표면·실루엣은 미달**이다. [A28 정제 실험](../candidate-a28-rejected/README.md)도 실제 컷에서 미달해 채택하지 않았다. 외형 P2를 해결하기 전 병합하지 않는다.

## 구현·회귀·미검증 구분

Three 기본 네 가중치 경로 대신 추가 세트를 GPU 위치/법선, CPU 위치/방향·bounds, native depth 그림자에서 처리한다. 기존 캐시는 변경하지 않고 두 복제본의 private geometry/material만 공유하며 이탈 시 해제한다. 잘못된 가중치·뼈 인덱스/중복·누락 세트·지원하지 않는 셰이더는 검수 실패로 처리한다. 참조: [glTF 공식 규격](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#skinned-mesh-attributes)·[Three 공식 SkinnedMesh](https://threejs.org/docs/pages/SkinnedMesh.html) 및 설치된 실제 코드. production에는 개발 검수 경로·GLB·셰이더를 포함하지 않는다.

실행: 여덟 가중치 Vitest 13개(전체 **118개**), API/격리 PostgreSQL **90개**, 실제 HTTP/SQL production 계정 Chrome **9개**(60초 재발송 포함)·복구 **5개**, 사람 없는 가짜 카메라 Chrome **1개**, 타입/Biome/build/Ruff·diff. 계정/복구 메일 전달은 모의다. 처음 하네스가 고정 401을 그래픽 오류로 집계한 실패를 고쳤으며, 전체를 통과로 바꾸지 않고 실제 Chrome을 재실행했다. 다른 회귀가 avatar 증거를 정리하던 문제는 설정의 출력 폴더를 분리해 보완했다.

미검증: A-02 외형, 실제 사람/전문 시범·사용자 리타게팅·복합 운동, 실제 Gmail/Google, 목표 노트북 웹캠 통합 성능·5~6단계·전문가 승인. Blender의 남성 export parent 경고와 하위 라이브러리의 Clock/테스트 teardown 경고가 있었으며 경고가 전혀 없다고 주장하지 않는다. 재현은 [에셋 README](../../README.md)와 [Story](../../../../docs/stories/stage2-avatar-candidate.md)를 따른다.
