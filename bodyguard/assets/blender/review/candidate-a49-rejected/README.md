# A49 — native 경계 밀도 대응·실제 전체 검수

2026-10-01 · S2.4 A-02/A-04/A-07. **원본·GLB 각118개 기술 변형과 설치 Chrome3개 PASS. 실제 목 경계 외형은 미달이라 미채택한다.** 개발 A37·외형 P2·Draft PR #9 병합 보류·1~6단계와 승인 기준은 유지한다.

## 실제 변경·보존

[A48](../candidate-a48-rejected/README.md)의 보간 비교 뒤, A38/기존 CC0 전문 목·0.81/0.87 범위·12mm 연결에 native SURFACE/cuts6을 유지하며 두 경계의 점 수를 대응시켰다. [생성 당시 코드](producer-at-generation.py.txt)는 별도 임시 실험이며 저장소의 기본 `replace_neck_from_artist.py`는 변경하지 않았다. native subdivision은 기존 좌표/skin의 값과 중복 개수를 정확히 보존한다. 좌표 복구·허용 오차 확대·전신 remesh로 통과시키지 않았다.

[실제 생성](generation-report.json)은 exit0다. 남성 하부156↔158→158/158·상부134↔488→488/488, 여성 하부156↔166→166/166·상부132↔426→426/426이었다. 전문 패치1,771/1,804점·영역 밖 신체/skin·보호 손·각163bones/rest를 보존했다. 원본104,472/102,762점으로 입력142,087/139,882점이나 A47/A48과 동일 위상이 아니다. 이전 이음매 대비 양방향 최대 거리 남10.196497/10.242811mm·여11.054702/10.984547mm는 조형 진단이지 해부학·사람 측정 정확도 목표가 아니다.

[native 밀도 대조6개](native-density-regression.json)·[실행 당시 대조 코드](density-check-at-generation.py.txt)를 보존했다. 합성4→4/8/9/15점 대응과4→17점/동일 절단면 거부를 실제 통과했다. 첫 합성 fixture는 두 절단면이 겹쳐 실패했고, 다음 검사는 native subdivision 후 무효화된 BMesh 객체 참조를 비교해 실패했다. [첫 실패 코드](producer-first-handle-check-failed.py.txt)·stdout을 보존했다. 최종 검사는 좌표/skin/중복 개수의 Counter 비교로 실제 보존을 확인하며 값 덮어쓰기는 없다. 이6개는 실제 사람 시험이 아니다.

## 실제 외형·다음 수정

[정면](faceless-front.png)·[3/4](faceless-quarter.png)·[남성 측면](faceless-side-male.png)·[여성 측면](faceless-side-female.png)·[여성 목 기울임](faceless-neck-female-left.png)을 실제 확인했다. 여성 별도 의상 없이 남녀 같은 백색 중성 표면·여성 자연 곡선/관절을 유지하며 사실적 유두·생식기 세부를 추가하지 않았다. 의상 경계·허리선·옷단 요구를 되살리지 않는다. 그러나 머리 아래 수평 접힘과 뒤 목의 옷깃 같은 턱이 남아 **참조 외형 미통과**다. 매끄러움 때문에 필요한 구조·리깅 정확도를 낮추지 않는다.

[face 법선 진단](interface-normal-diagnostics.json)의 머리 경계 p95는 남12.279443°/여21.347626°, 최대76.387251°/51.285961°다. A47 SURFACE 대비 여성 p95와 극값 일부는 줄었지만 남성 p95는 개선되지 않았고 실제 외형도 해결되지 않았다. 이는 메시 face 방향 변화이지 사용자 관절/임상 각도/합격 임계값이 아니다. 남성 목의 기술 edge 변형도 일부 증가했으므로 전반적 개선으로 확대하지 않는다.

디버깅에서 기존 `refine_avatar_studio.py`의 상부 머리 shrinkwrap·국소 remesh·Boolean 연결 경로를 확인했다. [기존 전문 head의 실제 배치 진단](author-head-placement-diagnostic.json)은 scene update 후 world matrix로 다시 실행했으며 첫 stale world matrix는 사용하지 않았다. 다음은 기존 전문 head와 목의 연결 형태·정렬을 직접 대조하는 새 후보다. 특정 operator가 접힘의 단독 원인이라는 가설은 아직 확정하지 않았고 새 head 후보는 생성 전이다. 기존 몸통/손/리그·원본·검증 증거를 보존하며 같은 전체 검수를 다시 요구한다.

## 실제 원본·GLB

- [원본](source-deformation-report.json):118개/121행/실패0·rendered:true·실제34PNG.
- [GLB 재가져오기](web-deformation-report.json):118개/121행/실패0·qc-only/rendered:false. 별도 웹 native 렌더로 세지 않는다.
- 최대 원래1mm 초과 edge 변형 비율 원본2.943930367·GLB2.947679803, 기존3미만 기준 유지. 목 원본 남1.223492/1.204547·여1.288001/1.180155, GLB 남1.225718/1.204505·여1.288048/1.180843.20°는 기술 스트레스이지 권장 운동 각도 아니다.
- 양쪽 연결 성분1/non-manifold0/정규화 오류0/각163bones·별도 의상0·같은 Base Color/Metallic/Roughness/Specular/Alpha. 의상 침투 대상이 없어도 전체 신체 검사는 생략하지 않았다.
- [왕복](roundtrip-report.json):각5meshes·이미지/액션0·fin 제거0·여덟 가중치. native 영향 제한258227/255747·남성 parent 경고가 있었다. 웹 정점104,472/102,762이며 전체 재가져오기 변형을 실제 실행했다. 생성/왕복 report의 pending은 생성 당시 기록으로 보존한다.

| 보존 파일 | bytes | SHA-256 |
|---|---:|---|
| [원본](../../bodyguard_avatar_candidate_a49_rejected.blend) |22,811,486|`84eb04403d9b20edea5c017e10dcc3092cdf4c6f84ae95aca930efb6d29f1232`|
| [남성 GLB](glb/bodyguard-male-candidate.glb) |9,347,384|`7411bec3e4ecebfd12af47d3e9d52c7926e66f65721737f75a667f5256af3b9f`|
| [여성 GLB](glb/bodyguard-female-candidate.glb) |9,197,076|`c58baea3eb52acf3184612d06e49d2f18aa7f2550e6b68fe87793e738b8c2995`|

생성 코드 SHA `6a96114e186b0db44a622beaef770dc58a193656344586f9f189783cc14018c4`·대조 코드 `01cf813bf79ecabd88b694142824c08bd99b0cf11ee38f9e38718f5aa3c6aae9`·첫 실패 코드 `389ce41131bfb4b471e73e50586e612e3c2cc3339bc9bacfbaa587dd1e7389e3`다. 기존 A38 입력 SHA `9a82176b42fee0a2ff1054f8109e78b3238e660fc170ba27ee6ec6a2779e2644`·CC0 번들 `3c121505651140ceb4d69fd1d8923f7788ffadd81672f5be14845a5f2c75c137`는 이전과 같다.

웹/왕복 원본은 `/private/tmp/bodyguard-tailor.6b7Uvu/a49-web.blend`·`a49-web-roundtrip.blend`에 보존했다. SHA는 각각 `d24cb7d812e897efdbc2478d2e0f454c96642223a7d6256c4c5c490c624ffb24`·`0883f7349f3a17835338d0c3b400d859c98a4b488d03d2d71b9921ddc3219c7c`다. 기존 파일/사용자 Blender 장면/개발 기본 연결을 변경하지 않았다.

## 실제 설치 Chrome

[보고서](browser-report.json)는3개/48.121974s/skip0/flaky0/unexpected0/exit0 PASS다. [남성](male-two-models.png)·[여성](female-two-models.png) 실제 화면과 native34컷 총36PNG를 보존했다.

| 두 모델 | 실제 표본 | mean(ms) | p95(ms) | draw calls/triangles |
|---|---:|---:|---:|---:|
| 남 |180|16.662778|17.700000|21 /852,146|
| 여 |180|16.666111|17.500000|21 /838,466|

Chrome154.0.8037.58/headless1440×1080DPR1·실제 sysctl 확인 Mac16,12/Apple M4/16GiB에서 모든 native 검수를 종료한 뒤 실행했다. GPU 상세/전원/전체 부하는 미수집이다. GLB SHA·여덟 가중치·독립 두 뼈대·한쪽 합성 변형/다른 모델 정지·정지 버튼·503/context-loss 재시도·이탈·카메라0·외부 차단 A-00을 실제 검사했다. 자체5182/비청취 프록시만 사용했고 API/DB/SMTP는 시작하지 않았다. NO_COLOR/Three.Clock/WebGL 경고·의도한503 로그가 있었다. 프레임 간격을 GPU 시간·실제 웹캠15fps·피드백1초·다른 노트북·사람 코칭 검증으로 확대하지 않는다.

## 재현·검사 범위

이 [원본](../../bodyguard_avatar_candidate_a49_rejected.blend)에 [기존 명령](../../README.md)의 새 검수 폴더와 `--candidate --mannequin`을 쓴다. GLB 재가져오기만 `--qc-only`를 추가한다. 재생성은 보존된 producer의 바이트 사본을 새 .py 경로로 만들고 A38/기존 전문 번들·0.81/0.87/0.012·새 출력 경로를 명시한다. 기본 저장소 코드를 A49 재현 코드로 대신하지 않는다. Chrome은 backend에서 `BODYGUARD_AVATAR_QA_DIRECTORY=<이 glb 폴더 절대 경로> PLAYWRIGHT_JSON_OUTPUT_FILE=<새 보고서 경로> .venv/bin/python -m tests.run_browser avatar`다. 기존 결과를 덮지 않는다.

`engineering:debug`로 native 핸들/실제 값 보존과 외형 원인을 분리했고 `engineering:code-review`로 기존 경계·영역 밖·리그 guard/임계값을 유지했다. `engineering:documentation`으로 실제/합성/미실행과 외형 반려를 구분했다. 프로젝트 설정 Ruff check·format check는 실행 당시 temp producer/대조2파일에 실제 PASS다. 새 의존성·단순 도형 인체·전신 remesh·검사 완화는 없다.

증거 보존 후 native 합성6개를 다시 실행해 exit0를 확인했다. 로컬 증거 검사237개 assertion에서8파일 크기/SHA·생성 바이트 동일성·36PNG 시그니처·QA242행/각118개·Chrome3개/실제 공급 GLB SHA·변경 Markdown5파일의 로컬126링크를 실제 통과했다. `git diff --check`도 통과했다.

A47의 경계7/CLI8·파일/중복2회귀, API160/Vitest133/계정·Google/production build는 이번 후보에서 재실행하지 않았다. 실제 사람·올바른 시범·리타게팅·Gmail/Google·S2.4·2단계/1~6단계·전문가 승인·출시는 미완료다. 별도 승인 대상은 실행하지 않았다. 외형 P2가 남아 병합하지 않는다.
