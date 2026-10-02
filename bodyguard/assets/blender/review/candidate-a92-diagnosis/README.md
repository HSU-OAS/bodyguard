# A92 — 남은 뒤 목 연결 원인 대조

**진단만 진행했고 새 모델은 저장하지 않았다. 외형 P2·미채택·Draft PR #9 미병합·전체1~6단계 미완료는 그대로다.** 최신 CEO 얼굴·목 기준, 무의상 통일 백색 남녀 표면·자연 곡선/관절·리깅 정확도와 개발 A37·이전 원본/증거를 변경하지 않았다.

## 실제 발견과 대조

- 기존 A91의 남은 접힘은 원본 남49/여50, 재수입57/48이다. 서로 다른 위상/local 길이 분류의 진단이며 동일 edge ID 대조·정확도·개선율로 해석하지 않는다.
- 첫 국소 n-gon 삼각분할 대조는 여성 nonmanifold guard에서 exit1·JSON/scene 저장0으로 중단했다. 별도 단계 진단은 원본0 → 삼각분할 뒤1 → 회전 뒤1이고, 해당 edge에4면이 붙는 것을 확인했다. guard를 낮추지 않았다.
- 원래 여성 quad [103690,68956,103697,103689]의 A-C 대각선은 이미 다른 면에서 사용 중이었다. 일반 BEAUTY 분할의 중복 면 대조와 같은 위치의 연결 오류를 기록했다.
- 이미 점유된 대각선을 피하는 native 분할을 대조했다. 첫 API 이름 FIXED_ALTERNATE는 설치된 BMesh의 실제 enum이 아니어 ValueError/exit1·JSON/scene 저장0이었다. 실패본 그대로 보존하고 실제 enum ALTERNATE를 쓴 별도 v2를 실행했다.
- v2의 detached BMesh 메모리 대조는 모든 좌표·영역 밖 연결 정확 보존, nonmanifold0, 남49→48/여50→47이다. 두 대각선이 모두 점유되거나 좌표·외부 연결이 바뀌거나 nonmanifold가 생기면 계속 실패한다. 신체 구조 삭제·투영·smoothing·clamp/좌표 복구는 없다.
- **새 .blend0/GLB0/PNG0, 새 원본·재수입118변형 QA/Chrome은 미실행**이다. 이 진단을 제작 완료·외형/임상/운동 정답/웹캠 정확도 통과로 대신하지 않는다. 현재 실제 모델 검증·미리보기는 [A91](../candidate-a91-review/README.md)의 별도 결과다.

다음은 이 위상 제약을 별도 native 제작 후보에 적용하기 전 남은 접힘 면을 조사하는 작업이다. 후보를 실제 저장하면 독립 저장 보존 대조·원본/GLB 각각118개·실제 브라우저·선명한 외형 미리보기를 새로 검사한다. 이전 자료를 새 검사 완료로 재사용하지 않는다.

## 보존과 재현

[실행 기록](execution-record.json)은 native7회/실패2회, 정확한 actor/명령/exit와 미실행을 구분한다. [manifest](copy-manifest.json)의14사본은 실제 JSON5·실패 log2·gzip7이며 byte/SHA256·gzip 해제 byte를 대조했다. 일부 tool stdout tail은 잘렸지만 구조화된 JSON은 보존했고 모든 stdout을 보존했다고 주장하지 않는다.

[원본 연결](source-connectivity.json), [재수입 연결](import-connectivity.json), [단계별 진단](stage-diagnosis.json), [중복 면 대조](duplicate-face-diagnosis.json), [별도 v2 대조](constrained-dryrun.json), [위상 실패](failed-manifold.log), [API 실패](failed-native-enum.log)를 보존한다. 공유 A91 readonly probe를 변경 없이 재사용했다. 새 Python5파일 전체 Ruff/format0·copier JS 구문0이며 첫 stage format1/preformat snapshot과 실행 전 수정을 구분한다.

입력 원본 SHA256은8424a1306b91e36b7db024987667ca4068a035bc11fe0abe78357216c34bbe9c이다. 실제 사람/카메라/pose 기록·업로드, 계정/API/DB/SMTP/OAuth 재실행·연결, 시크릿·운영 migration·배포·출시는0/미실행이다.

읽기 전용 반복 검사:

```sh
node bodyguard/assets/blender/review/candidate-a92-diagnosis/evidence-check.cjs
```

scripts/a92-copy-evidence.cjs.txt.gz는 이미 실행된 일회용 보존 도구다. 재실행·기존 증거 덮어쓰기 금지. 위 evidence-check.cjs만 반복 실행한다. native producer를 바꾸어 .blend를 저장한 결과가 아니라 메모리 진단이라는 한계를 유지한다.
