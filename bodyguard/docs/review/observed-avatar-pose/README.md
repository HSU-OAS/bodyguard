# 관찰 결과 → 사용자 아바타 연결 검증

한 번의 pose 결과에 포함된 image/world와 원본 세대·순서·시각을 사용자 리그에 연결했다. **비공개 기술 구현이며 실제 웹캠·올바른 스트레칭·최종 외형 검증은 아니다.**

## 실제 화면과 동작

[여성 화면](accepted-native-female-single.png)·[남성 화면](accepted-native-male-single.png)은 실제 Chrome154·GLTFLoader·WebGL에서 기존 미완성 A37 GLB를 렌더한 화면이다. 왼쪽은 중립 비교용 모델이지 올바른 시범이 아니며 오른쪽만 합성 관찰을 따른다. 두 skeleton과 원본은 독립적이다. 새 외형·의상·Blender 작업은 하지 않았다.

- 단일 결과: 사지8방향을 전달해 팔의 실제 목표 방향과 전신 구도를 확인했다.
- 하체가 화면 밖인 결과: 팔4방향만 전달하고 관측하지 못한 하체의 local 회전을 동결했다. 부모 움직임에 따른 world 위치는 관측으로 간주하지 않는다.
- 복수/불일치/없음: 새 빈 관찰로 coverage0, local 회전 동결. 임의의 첫 사람이나 이전 좌표를 사용하지 않는다.
- 새 단일 결과: 다시 움직인다. 만료·종료 후에는 추적을 이어가지 않는다. source/다른 아바타는 바뀌지 않는다.

어떤 coverage도 성공·타이머·정답 보정에 사용하지 않는다. 얼굴/목·몸통·손·축 비틀림은 이 구현으로 관측하지 않는다. 15°/50ms/250ms·0.002rad는 합성 그래픽 fixture의 입력/수학적 오차이며 임상 기준·카메라 오차·노트북 성능 합격 수치가 아니다.

## 실제 검증과 실패

실행 source `fea93b94f407433d631f0088f8be7945d43ee1e0`에서 전체 frontend810통과·실패0/skip0, Biome·타입·원래 assets/build 순서·공개 guard 통과. 최종 실제 Chrome에서 남녀 각각 움직임→가림→복수/불일치/없음→복구→만료→종료를 통과했다. 외부 요청/카메라 호출/페이지 오류0. 시험 전후 source SHA·Git blob·GLB·이미지·82개 원본 증거를 실제 대조했다([summary.json](summary.json)).

다음 실패를 덮어쓰지 않았다.

- 미구현 unit15실패, 잘못된 descendant anchor RED1실패, 문자열 좌표/제곱 overflow RED2실패. 명시적인 bone→anchor·finite 원값·안정적인 정규화로 보완했다.
- 첫 타입 오류로 probe build 미실행, 다음 browser 명령은 bundle 없음으로 브라우저 실행 전 실패했다.
- 첫 실제 Chrome/진단은 남성 초기 로드 뒤10초 timeout, 여성 미실행. clock RED에서 capture 역행을 확인했다. 새로 생성되는 합성 결과의 capture clock을 통일했고 adapter의 원본 시간 검사는 유지했다.
- 공개 byte 비교는 처음 basename 가정으로 실패했다. 이후 새 unit 변수 이름이 Tailwind utility29byte를 추가하는 것을 확인했다. assertion/의미 변경 없이 변수 이름만 변경한 뒤 공개 JS/CSS가 기존 출력과 byte 동일함을 실제 재확인했다. 공개 GLB0이다. 비어 있는 첫 실패 출력도 보존했다.
- guard에 소유한 합성 leak sentinel을 넣은 시험은 실제 실패했고, 그 임시 파일만 제거한 뒤 guard를 다시 통과했다.
- runtime commit의 첫 최종 browser 명령은 sandbox의 `listen EPERM 127.0.0.1`로 브라우저 실행 전 실패했다(보고 JSON 없음). 로컬 서버/Chrome 시험 권한으로 같은 source를 재실행한 `accepted-native` 결과가 최종 통과다. 첫 Git fetch도 sandbox DNS로 실패했고 읽기 권한 재실행에서 최신 main을 확인했다.

## 범위와 남은 조건

영상/좌표의 저장·전송·로그, 공개 화면·카메라/SDK·판정 임계값·API/SQL·운영·CI·migration·새 Blender/GLB 변경0. 기존 버전 모델5개와 lock을 byte 대조해 assets 준비에 사용했지만 SDK를 실행한 것은 아니다. 공개 JS355151byte/CSS31199byte가 이전 출력과 동일하다.

기존 후보 작업트리의 추적 파일1959개 삭제 상태와 PR9 Git 원본은 보존했다. 복구/삭제 권한이나 원인을 가정하지 않는다. graphify의 legacy 경로를 실제 현재 source와 대조했고 testing-strategy/code-review로 정확한 anchor·프레임 소유·복사·시간/가림/종료·공개 격리를 작성자 검토했다. 독립 에이전트·전문가·디자인 승인은 아니다. 수정 범위의 미해결 P1/P2는 발견하지 않았다.

D2-A/M/T/R/I/P·디자인/SDK 승인·실측/참여자·최종 외형·올바른 시범/적색 피드백·공개 사용자 흐름·외부/운영 및 전체1~6 필수 기준은 미완료다. 이번 통과로 출시 후보판이나 전문가 검토만 남은 상태를 선언하지 않는다.
