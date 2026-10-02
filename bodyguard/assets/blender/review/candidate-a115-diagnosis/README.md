# A115 — 실제 순서화 경계 조사

**읽기 전용·외형 미해결·새 원본/GLB/PNG 없음.** 같은 A106 전문 원본에서 A114와 같은 bbox/최대 연결 성분의 경계를 실제 edge 순서로 한 번 순회했다. 원래 신체 좌표/skin과 입력 SHA 불변을 assert했고 native session76532 실제 종료0이다.

| XZ 기하 네 변의 edge 수 | 아래 | 오른쪽 | 위 | 왼쪽 |
|---|---:|---:|---:|---:|
| 남성 경계374 | 56 | 107 | 104 | 107 |
| 여성 원래 경계363 | 56 | 103 | 81 | 123 |

마주 보는 변의 대응이 맞지 않는다. 여성은 parity 삼각면을 편집하지 않은 **원래 경계**이며 A114의364와 구분한다. XZ 투영 엄격 교차0은 전신/3D 충돌·해부학·외형 승인 근거가 아니다. 이 기하 코너가 승인된 해부학적 랜드마크라고 주장하지 않는다.

설치 build `b70da489d7f4`와 같은 [Blender 공식 소스](https://github.com/blender/blender/blob/b70da489d7f4/source/blender/editors/mesh/editmesh_tools.cc#L4748)를 실제 GitHub contents API로 읽었다. 면 선택은 prepare 전에 split/join을 거친다. **요청한 active 원래 정점이 이 단계 뒤에도 유지되는지는 아직 native로 측정하지 않았다.** 따라서 A114의 지정 corner를 최종 native corner가 검증됐다는 뜻으로 해석하지 않는다. 관측한 소스 일부는 **SPDX-FileCopyrightText: 2004 Blender Authors / GPL-2.0-or-later**이며 [GPL2 원문](https://www.gnu.org/licenses/old-licenses/gpl-2.0.html)을 따른다. 실행 로그에 연구용 일부만 보존하며 제품 코드에 복사·편입하지 않는다.

[5사본/5gzip SHA](copy-manifest.json), [실제 명령/종료·초기 Ruff 실패/보완·한계](execution-record.json)를 보존했다. 이전 A110–A114 기록/원본은 그대로이며 새 source/GLB/118변형/브라우저/사람·웹캠/운영은0/미실행이다. 초기 B0236건을 native 실행 전 보완한 후 default/isolated/88format0을 실제 확인했다. 앞선 PR 댓글의 shell 인용으로 누락된 커밋/경로/줄바꿈은 **정확한 본인 댓글 하나만** 파일 기반 본문으로 복구하고 실제 body 동일을 확인했다.

```sh
node bodyguard/assets/blender/review/candidate-a115-diagnosis/evidence-check.cjs
node bodyguard/assets/blender/review/candidate-a110-a114-diagnosis/evidence-check.cjs
```

다음은 측정한 실제 두 경계/레일 대응과 native two-open-loop 경로를 확인한 뒤 국소 연결을 수정하는 작업이다. 임의 quarter span/corner·smoothing 강도/법선 우회는 반복하지 않는다. 최신 CEO 참조의 얼굴/목 연속 연결·무의상 남녀 백색/곡선/관절·필요 구조/리깅 정확도·기존 파일/증거·개발 A37·A-02/A-08 P2/Draft PR #9 미병합·전체1~6/승인 기준은 유지한다.
