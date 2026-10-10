# S2.A1 복원 경계 대조 — 작성자 리뷰

2026-10-10 · engineering:code-review · **Request Changes: 기존 외형 P2 유지**

## 범위와 결과

변경은 동결 저작의 원인 진단·중단 관찰·영구 실행 기록·증거 보존이다. [실제 결과](restored-boundary/README.md)는 native exit0지만 저작 실패를 재현한 결과이며 새 후보/외형·기능 완성은 아니다. 전문 원본/입력·여성·private probe body/rig가 불변이다. 제품 JS/CSS/API/SDK/판정/개인정보·운영은 변경하지 않는다.

첫 미확정 native exit를0/1로 추정하지 않고 null로 보존했다. 핸들 유실만으로 중복 실행하지 않았으며 해당 프로세스·임시 폴더 없음도 확인한 뒤 동일 SHA inspector를 별도 영구 폴더에서 실행했다. 실제 terminal metadata의 exit0·signal/spawn error 없음과 frozen row exact를 읽었다. 원본 저장·renderer 실행·사용자 장면 변경은 없다.

## 코드 검토

- **보안/데이터:** fixed repository proof·두 입력 SHA·autoexec 비활성화, professional asset만 취급한다. 비용/시크릿/외부 사람 데이터 업로드·실제 카메라 입력은 없다.
- **정확성:** 동일 실패만 catch, 동일 rows 요구·원래 selection/front를 사용한다. BMesh의 원래/복원 edge를 같은 연결에서 읽고 원본 대응의 음수 ID·누락/모호함을 추정하지 않는다. 진단 성공과 새 모델 저장·외형 승인 flag는 분리돼 있다.
- **보존/오류:** runner는 기존 proof 파일을 덮어쓰지 않고 terminal signal/spawn failure를 따로 남긴다. collector는 실제 terminal/hash·고정 파일 목록을 검증한 뒤 새 output만 생성한다. 실행 소스는 동결하며 이전 반려 helper·증거를 수정하지 않았다.
- **성능/유지보수:** 전체 스냅샷/원래 면 대응 비교는 별도 offline 제작 검증이다. 제품의 실시간 경로가 아니다. 웹 FPS/실제 사람/전체 해부학 정확도 시험으로 주장하지 않는다.

원인 대조 코드는 검토 범위에서 새 P1/P2를 발견하지 않았다. 전체 PR의 **외형 P2는 미해결**이며 기존 시작/SDK·실측·승인 공개 UI·외부/운영·전체1~6 게이트도 그대로다. Draft 병합·출시 후보판 선언은 하지 않는다. 이는 작성자 검토이지 독립 전문가 검토가 아니다.

## 실제 검증

- 새 native 진단 exit0·candidate0, 새 collector7개 byte/원시 SHA 감사 exit0. 첫 미확정 native 실행은 별도 null 기록이다.
- 같은 output의 duplicate archive는 실제 exit1/EEXIST였고 검사 시점15개 파일 전후 fingerprint `0357b126c1863603a8d0b32d8415bfffe7afffd1ef38124e397eebf069101bf3`가 같았다. 기존 증거 덮어쓰기0이다.
- Python inspector Ruff check/format --check·Node runner/collector Biome check는 exit0였다. 실행 inspector a72bea96/runner4d1b8c2d의 SHA는 그대로다.
- Markdown6개/로컬312개 링크 누락0, 현재/전체 main diff --check exit0. 기존 origin4/restore8/faces12개 byte 감사도 exit0였다.
- 이전39개 감사의 첫 명령은 존재하지 않는 `archive_lateral_evidence.mjs` 이름을 사용해 MODULE_NOT_FOUND/exit1이었다. 모델 실행이나 증거 수정은 없었다. 실제 파일 목록을 확인해 `archive_lateral_attempt.mjs --check`로 다시 감사해 byte 감사exit0를 확인했으며 잘못된 첫 호출을 성공 실행으로 세지 않는다.

새 원본 렌더·GLB/왕복/118 pose·브라우저·Frontend/API/SQL 회귀·실제 사람/전문가/공급자/HTTPS는 이번에 실행하지 않았다. 과거 성공을 복사하지 않는다.
