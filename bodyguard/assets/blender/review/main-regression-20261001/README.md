# 최신 main 통합 A27 개발 웹 회귀

2026-10-01 · 아바타 브랜치의 main `4bbb784` 통합 뒤 A27을 그대로 사용한 검사다. [native Chrome JSON](browser-report.json)·[남성](male-two-models.png)·[여성](female-two-models.png)은 이전 기록을 덮지 않고 별도 보존했다. A29/30은 웹에 반영하지 않았다.

`PLAYWRIGHT_JSON_OUTPUT_NAME=<새 경로> pnpm exec playwright test --config playwright.avatar.config.ts --reporter=list,json`의 실제 2개/32.803s·skip0/flaky0 결과다. 설치된 Chrome154.0.8037.58/headless·1440×1080·DPR1·장치Mac16,12/AppleM4/16GiB에서 Blender 제작이 끝난 뒤 실행했다. 렌더러 문자열은 WebKit WebGL이며 전원 모드/GPU 상세/전체 시스템 부하는 수집하지 않았다. 측정값을 목표 모든 노트북이나 최종 코칭 성능으로 일반화하지 않는다.

| 실제 두 모델 기술 변형 | sample | mean(ms) | p95(ms) | draw calls / triangles |
|---|---:|---:|---:|---:|
| 남성 |180|16.665556|17.400000|33 / 1,190,242|
| 여성 |180|16.665556|18.400000|37 / 1,374,162|

이는 실제 프레임 사이의 간격이지 GPU 연산 시간·추론15fps·사용자 피드백1초 검증이 아니다. 정지 뼈대의 변화0, 합성 변형의 변화·독립 뼈대, GLB503/WebGL context-loss와 재시도·페이지 이탈·카메라 호출0을 검사했다. 정상 포즈/오류 자세·운동 처방/사용자 리타게팅·원본 영상은 없다. 오류 주입의 console error 및 NO_COLOR/Three.Clock/WebGL 경고도 있었다.

원본/GLB 해시는 기존 A27과 같다: source `bfb09fabff11e77214b7f25740cd6e07b527c5519f59b2afd35f4457c50b9ade`, male `93d9a3467f8ae8a14e02822052dbffa6e9973ba6b58c893554fdf49edcd0263a`, female `863e62e6cb16de8e4f670dd4e81a47b85df67dd0af6a6df636636b691c04662b`. **외형 P2/실제 사람/2단계 전체는 미완료**다.
