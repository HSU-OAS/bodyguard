# 두 아바타 CPU 변형 비용 보완

2026-10-16 · [Story](../../stories/avatar-cpu-skin-cost.md) · 모델/공개 제품 적용0

같은 GLB의 정확한 전신 CPU 계산에서 정점마다 만들던 중첩 배열만 제거했다. 여덟 가중치·원래 뼈/행렬·전체 메시와 서로 독립적인 두 리그는 유지했다. 이는 **소규모 CPU 개선이지 초기 지연/외형 P2 또는 전체1~6 완료가 아니다**.

## 실제 작동과 비용

Chrome155.0.8059.80/Apple M4에서 남녀 각각 두 모델의 합성 움직임·발끝까지 구도·원본 불변·방향 오차0.002 미만·종료를 확인했다. 기존 owned 자원 흐름도 준비→이동→해제→잘못된 리그→명시 재시도→취소된 늦은 반환→정리 실패 차단을 통과했다. 원래 A37 회귀이며 올바른 운동 시범/사람 정확도 증거는 아니다.

초기 남성 준비/정확한 구도 검사3575.8ms 중 CPU 프로파일의 WebGL 컨텍스트 생성은2479.6ms였다. 다음 실행에서 GPU 생성 비용이 작아졌다고 코드가 초기 지연을 해결한 것으로 보지 않는다. 과거의 큰 프레임 지연도 미해결로 유지한다.

동일 페이지의 수정 전/후를 ABBA 순서로 번갈아 측정했다. 정지된 같은 포즈의 정확한 CPU 전신 계산이며 FPS/냉시작 수치가 아니다. 첫 샘플과 느린 샘플을 모두 포함한, 다른 시험 종료 뒤의 독립 실행 결과:

| 후보 | 수정 전 중앙값 | 수정 후 중앙값 | CPU 시간 감소 |
|---|---:|---:|---:|
| 남성 | 86.75ms | 83.90ms | 3.29% |
| 여성 | 88.15ms | 83.80ms | 4.93% |

각 버전10개/성별의 원문은 [paired-isolated.json](proof/paired-isolated.json)에 있다. 남성524584/여성522536 삼각형(각 두 모델 합계), 여덟 가중치와 GLB SHA는 양쪽 동일하다. 남성8c3d34b9/여성a9bca83c 후보는 PR150의 불변2be0ebe에서 읽었고 외형은 미채택이다. 바이너리를 제품 폴더에 복사하지 않았다.

앞선 별도 프로세스 순차 측정은 오히려 느린 샘플이 있어 개선의 근거로 쓰지 않는다. 전체 회귀와 겹친 첫 ABBA도 별도 보존하고, 마지막 독립 비교와 구별한다. CPU sampling 자체의 비용과 다른 노트북/장시간 검증 미실행을 고려해야 한다.

## 검증·실패

- 모든 여덟 influence를 직접 합산하는 oracle에 다중 정점/회전/비균일 scale·Vector3/Vector4·늦은 뼈 이동/attribute 교체를 대조했다. 기존 거부·셰이더·정리 시험을 포함한 관련40/전체1932개가 통과했다. 임상/동작 통과 임계값 변경0.
- 타입 검사와 scoped Biome0진단, 전체 Biome는 기존16 info/오류0, 원래 assets/build·production guard·diff가 통과했다. 공개 JS에 private 코칭/아바타 코드가 포함되지 않음을 원래 guard로 확인했으며 공개 byte 동일을 별도 측정했다고 주장하지 않는다.
- PR150에서 검증한 저비용 진행 조회/240개 한도의 로컬 진단만 재사용했다. 시작/완료 시 정확한 전신 검사는 유지하며60회/10초·방향/가중치/원본/종료 조건을 낮추지 않았다. 새 후보 입력 CLI 옵션은 이 PR에 가져오지 않았다.
- 실제 A37 Chrome 남녀2흐름, owned 자원 남녀2흐름에서 페이지의 외부 요청/카메라 호출/pageerror0이었다. Chrome 프로세스 전체 통신 또는 모든 GPU 드라이버 자원 회수까지 입증한 것은 아니다.
- 최초 Biome는 새 시험의 forEach 반환으로 실패했고 본문을 for-of로 바꾼 뒤 재검사했다. frontend 하위에서 최초 archive 명령은 pathspec 오류였고, 저장소 루트에서 pipefail로 재실행했다. 두 초기 tool 출력은 실행 기록에 있으며 별도 파일 원문이 있다고 주장하지 않는다.
- 기존 결과 경로에 대한 재실행은 의도된 exit1로 거부됐다. [원문](proof/existing-output-negative.log)을 남기며 기존 JSON을 덮어쓰지 않았다. 이 부정 시험을 통합 성공 수에 넣지 않는다.
- 최초 staged diff 검사는 raw Biome/시험 로그의 공백으로 실패했다. 해당3개는 내용을 자르지 않고 gzip으로 무손실 보존했으며 최초 로컬 커밋34b0beb와 원래 임시 파일에도 남는다. 최종 branch 전체 diff 검사를 다시 실행한다. 소스/검증 내용 변경은 없다.

## 재현·보존

[proof](proof/)에는 원문 JSON·CPU profile·시험/build/guard 로그·사용한 두 bundle의 gzip·두 실제 실행 스크립트가 있다. 압축은 생성 파일의 무손실 보관이며 모델/이미지 수정이 아니다. [manifest](manifest.json)는 결과 파일과 최종 tracked source의 SHA를 기록한다. 사용자 영상/관절 데이터는0이며 전부 전문 모델과 합성 포즈다.

두 bundle의 기존 Three.js 저작권/SPDX는 유지됐고 설치된 동일 버전의 [MIT 원문](proof/three-LICENSE.txt)을 byte 그대로 동봉했다. 새 의존성/권리 채택이나 전체 출시 라이선스 미완료 해결로 확대하지 않는다.

일반 회귀는 새 bodyguard-rig-proof/owned-avatar-proof 임시 디렉터리에 immutable25a9bd6의 남녀 A37을 git archive로 풀고 각 fixture Vite config로 build한 뒤 원래 scripts/test-avatar-rig-browser.mjs, test-owned-avatar-browser.mjs를 실행한다. private env는 BODYGUARD_TEST_RIG_PROBE/BODYGUARD_TEST_OWNED_AVATAR다.

비교 재현은 새 디렉터리에 before-probe.js.gz→before-probe.js, after-probe.js.gz→probe/probe.js를 풀고 compare.mjs에 frontend 절대 경로·그 디렉터리·새 label을 전달한다. 후보 GLB는 불변2be0ebe에서 읽는다. profile.mjs는 같은 bundle에서 CDP CPU sampling을 수집하며 profile 결과와 단순 ABBA 수치를 혼합하지 않는다. before.json은 bounds 반복을 추가하기 전 실행이라 exactBoundsMs가 없는 원래 형식이다.

작성자 code-review는 여덟 가중치/연산 순서·현재 attributes/행렬 조회·소유권/해제·입력 검증·보안/성능/공개 경계를 검토했다. 이 좁은 변경의 미해결 P1/P2는 없다. 독립 외부 리뷰나 전문가 승인으로 표시하지 않는다.

## 다음 필수 작업

GPU 초기화/과거 프레임 지연, 여성 목·어깨 외형과 최종 아바타, 실제 동작 기준/시범·신체 확인 추천/코칭의 완성 연결은 남는다. 전체1~6·출시 후보 선언은 불가하다. 실제 참여자·메일/OAuth 공급자·Docker/HTTPS·권리 문의는 기존대로 미실행/이월이며 새 비용·계정·시크릿·운영 DB·배포·출시0이다. 이 CPU 보완만 반복하지 않고 다음 핵심 사용자 흐름을 완성한다.
