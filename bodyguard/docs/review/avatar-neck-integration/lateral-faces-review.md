# 작성자 리뷰: 남은6면의 실제 원래/반려 비교

2026-10-10 · `engineering:code-review` · base3baf61e · 외부/전문가/서브에이전트 리뷰 아님

**Request Changes / 외형P2 / Draft 유지 / 병합 보류.** [실제 진단](lateral-faces/README.md)은 완료됐지만 새 아바타·후속 QA·D2/전체1~6은 미완료다.

- 보안: 전문 에셋 SHA·동결 helper SHA를 확인하고 별도 factory-startup/disable-autoexec로 실행했다. 새로운 코드/사본은 원래 body에 to_mesh/save를 하지 않으며 원래/반려 관찰 전후 body/rig/속성·여성 불변을 확인했다. 사람 영상/좌표·공개 UI/API/SDK/시크릿/운영 변경0. 좌표는 기존 전문 에셋 기하이지 실제 사람 로그가 아니다.
- 정확성: 최초 Vector 가정 실패를 실제 exit1로 보존하고 설치 API의 비인체 probe/공식 검색 근거 후 별도 인덱스 버전을 실행했다. 반려 복원의 row는 기존 actual row와 exact다. 진단 exit0/12개 byte audit가 외형/새 제작 합격이 아님을 명시했다. 삼각화 반환 면 주변5/6개와 전체14/4개는 검사 범위가 달라 혼용하지 않는다. source ID만으로 원래 source 좌표/연결 불변을 단정하지 않는다.
- 성능/자원: 모든 BMesh는 finally에서 해제한다. 전체 snapshot 비교는 오프라인 제작 검사이며 웹 hot path/새 의존성에 추가하지 않는다. 진단의 계산용 삼각화·snapshot 비용을 웹 성능 통과로 표시하지 않는다.
- 유지보수: 최초 inspector/실행 소스·format source·기존 실패는 동결했다. 새 helper는 인덱스 검증·현재 좌표의 제작용 weight 이름을 사용한다. 새 archive는 고정 경로·whitelist/realpath/비symlink·wx와 기존 폴더 거부로 덮어쓰기를 막고 관측된 exit1/0을 구분한다. 실제 native 재실행과 --check 바이트 감사를 구분한다.

원래 입력에도 접힌 삼각면/quad가 있고 삼각화만으로 해결되지 않는 것이 확인됐다. 다음은 원래 전문 원본의 국소점 출처·배치/연결과 표면 연속성을 대조한 보완 설계다. 같은 마감/단위/삼각화 반복·허용치 상향·인체/리깅 축소·blur/조명 은폐로 통과시키지 않는다. 새 최종 원본/GLB·변형·Chrome·실측과 실제 외형 검수는 별개다.

실제 새 진단12개 보존 바이트 감사는 exit0다. 정적 검사·링크·이전 증거 감사와 최신 PR 상태는 실제 실행 후 기록한다. 제품 build/카메라/API/SQL·새 원본/GLB/전체pose/브라우저·실제 사람은 이번에는 미실행이다. 최소 문구와 별도 승인 경계를 유지한다.

새3개 Python의 실제 Ruff check/format --check·새collector Biome·10문서349개 로컬 링크/누락0·git diff --check가 통과했다. 이전39/37/17개와 새12개 바이트 감사도 exit0이며 native/브라우저 재실행이 아니다. 입력be038 SHA 불변을 재확인했다. Archive 중복 호출은 예상exit1/EEXIST로 거부됐고 README/manifest 포함14개 바이트의 fingerprint는 전후 불변·사후byte audit exit0다. 거부 원시 로그는 `/private/tmp/bodyguard-lateral-faces-duplicate.QcenCA.log`에 보존했으며12개 manifest에 포함했다고 하지 않는다.
