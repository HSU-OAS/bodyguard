# 전문 배치 복원 작성자 리뷰

2026-10-10 · engineering:code-review · [실제 결과](lateral-restore/README.md) · 전문가/외부 승인 아님

## 실제 범위

실제 원본 대조에 근거한 native 점 배치 복원과 저장 전 실패·8개 보존 증거를 검토했다. 임상 기준/공개 UI/SDK/계정·운영 변경0이며 전문 에셋 좌표만 다룬다. 원래 파일이나 실패한 소스를 고쳐 통과 기록으로 바꾸지 않는다.

## 검토

- 보호: 동일 world/rest/pose/groups·ID 유일성과 source raw skin 대응 뒤 좌표만 쓴다. 같은 원래 ray 기반 앞면/중앙/외부 좌표·위상/rig/PBR/history/손/속성 exact를 실제 compare로 확인했다. 새점은 추정하지 않으며6mm 기준을 유지한다.
- 정확성/실패: 남성14→1과177.667°/저장0, 여성 미실행을 구분한다. 남은 접힘 원인은 아직 국소 edge 대조 전이다. decrease만으로 통과하지 않고0 assertion에서 중단했다. 새 원본/렌더·GLB/변형/브라우저/실제 사람 검증을 복사하지 않는다.
- 보존/보안: input/origin/target/report 경로를 분리하고 두 원본 SHA·새 출력 부재를 확인한다. 새 target 등장 시 저장을 거부한다. isolated proof의 실행 helper5개·로그/JSON을 frozen gzip/SHA로 보존하고 collector는 fixed-list/regular file·실경로/wx를 강제한다. 실패 JSON에 없는 후속 SHA 필드를 성공으로 보완하지 않는다. archive의 별도 원본 SHA 확인과 구분한다.
- 유지보수/성능: 전문 원본 대응 좌표 복원이라는 단일 목적이며 public 런타임에 추가하지 않는다. snapshot/참조 읽기 비용을 코칭 성능으로 주장하지 않는다. 동일 저작/파라미터 retry 대신 남은 국소 edge와 경계 영향 대조를 다음 작업으로 한정했다.

## 판정

저작 실패를 차단하고 보존하는 코드에서 새 P1/P2는 발견하지 않았다. **기존 외형 P2는 미해결 → Request Changes / Draft #108 유지 / 병합하지 않음**. 새 후보0·실제 외형 검증 미실행·D2/전체1~6 미완료다. 커밋/푸시 전에 static/byte/links/diff와 원격 최신 HEAD를 확인하며 실제 제품 build/DOM/API/SQL/카메라는 이 에셋 보완의 실행 범위에 없다.

## 실제 검증

Python2개 Ruff check/format --check·Node2개 Biome, Markdown8개/334개 로컬 링크 누락0·현재/전체 diff --check는 실제 통과했다. 새4/8개·이전12/39개 byte 감사는0, 새 collector2개의 duplicate archive는1/EEXIST이며16개 증거 전후 fingerprint가 exact다. [원본 대조 리뷰](lateral-origin-review.md#실제-검증)에 해시/실제 범위를 기록했다. native 저작의exit1/남성 저장0·여성 미실행은 이 정적/byte 성공으로 대체되지 않는다.
