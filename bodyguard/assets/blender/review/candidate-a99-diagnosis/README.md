# A99 — 재절단·경계 밀도 원인 분리

A98에서 확인한 기존42 vs96/94점 경계를 대상으로 같은 native bridge helper를 메모리에서 대조했다. **새 asset/전체 변형 QA/Chrome/외형 승인 증거는 아니다.** source와 maker SHA는 그대로이며 좌표·가중치를 사후 복원하거나 기존 보호/변형 guard를 낮추지 않았다.

## 실제 대조 결과

| 경로 / 긴 접힘 수 | 남성 | 여성 |
|---|---|---|
| A97 저장된 후보 | 80 | 47 |
| 다시 절단·원래 밀도 | 1070 | 1033 |
| 다시 절단·점 수 대응 | 500 | 539 |
| 기존 경계 유지·원래 밀도 | 133 | 123 |
| 기존 경계 유지·점 수 대응 | 9 | 11 |

기존 경계를 다시 자르면 42/96·94점 대신69/107·71/121·68/127·56/120점 등 추가 경계가 생겼다. 원래 guard를 통과해도 기존 후보보다 악화돼 재절단 경로를 채택하지 않는다. **이미 있는 경계를 재절단하지 않고** native subdivision으로 낮은 밀도 경계의 점 수만 대응한 마지막 대조는 남녀 좁은 면0·non-manifold0·보호 손 누락0·retained 원래 좌표/skin·각163rest bones/행렬 보존을 통과했다. 연결/면 집합이 달라 고정 edge 개선률/인체 정확도로 해석하지 않는다. 실제 Chrome 줄무늬 해결/최종 외형 PASS는 아직 별도 검증이 필요하다.

## 실패도 보존

A99 보호 손 marker 검사1, A99b BMVert 참조 ReferenceError1, A99c 새 절단점까지 exact skin 적용한 검사1, A99d 내부 AST 구문1/Ruff E501 1, A99g escaped newline index1을 보존했다. AST 변환 traceback의 maker 파일 줄 표시는 **메모리에서 변환된 함수의 줄 번호**이며 실제 production maker 파일 변경이 아니다.

A99e는 읽기 전용 진단 JSON을 남긴 뒤 **의도적으로 exit1**이다. native subdivision 뒤 immutable 좌표가 모두 남았고 바뀐 skin13개는 전부 새 절단 marker0였다. 원래 source marker/보호 손 변경0, 새 점 최대 변화5.960e-8을 실제 기록했다. 실패한 BMVert 참조를 재사용하지 않고 immutable 좌표 키로 식별 **tag만** 연결했다. 원래 source 정점 skin은 exact로 검사하며 새 절단점은 기존 native 보간/정규화 guard를 따른다. 좌표/skin을 원래 값으로 덮어써 실패를 숨긴 것이 아니다.

A99f 재절단 대조4행/exit0은 악화, A99h 재절단 없는 대조4행/exit0은 위 국소 개선이었다. A99e의 outer/inner AST, A99h의 rewrite index/inner AST를 native 전에 실제 확인했다. A99d를 제외한7개 실행 스크립트 Ruff/isolated88 format check0이며 D의 lint 실패를 지우지 않는다. 공식 API 웹 fetch402는 근거가 아니며 설치된 native operator docstring을 진단 JSON에 기록했다.

[새 점 skin 진단](skin-diagnosis.json), [재절단 대조](recut-memory.json), [기존 경계 대조](existing-contours-memory.json), [명령/session/exit/미실행](execution-record.json), [19사본/16gzip·byte/SHA](copy-manifest.json)을 보존한다. native8회 중 실패/의도 종료6회·대조 완료2회다. 모든8회 전체 stdout을 보존했다고 주장하지 않는다. 7개의 poll log를 압축했고 F log는 초기 Read 한 줄이 빠졌다. 8개 실제 코드와 copier도 별도 gzip으로 보존했다. exclusive copier를 다시 실행하지 않는다.

```sh
node bodyguard/assets/blender/review/candidate-a99-diagnosis/evidence-check.cjs
```

A99 자체 새blend/GLB/PNG/118변형/Chrome0, 실제 사람 촬영·좌표 수집/운동·retarget·통합 지연·외부 계정/시크릿/DB/배포/출시는 미실행이다. 마지막 경로로 **별도 A100 후보**를 제작해 원본·GLB·전체 변형·실제 웹/외형을 검증한다. 기존 원본/검수·개발 A37·최신 얼굴/목·무의상 통일 백색·필요 구조/관절/리깅 정확도·외형 P2·Draft PR #9 미병합·전체1~6/승인 기준은 유지한다.
