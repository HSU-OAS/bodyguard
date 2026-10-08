# 몸통 표시·강조 — 비공개 native 통합

2026-10-08 · 실제 Chrome/SDK/API/SQL · 가짜 카메라/메일 · 생성 양성 · A37 미완성

로그인 소유 세션에서 두 아바타가 준비되고 사용자 몸통 축이 옆/앞으로 움직인다. 같은 관찰과 supplied 오류에만 spine05의 저작 가중치 영역을 강조한다. 네 어깨/골반 관절 가림, 복수/미검출, 만료, pause/권한 회수 때 강조를 해제한다. 새 세대 재개와 본인 중단 기록을 연결했다. **실제 사람 자세 판정·몸통 전체/개별 척추 오류 분석·공개 코칭 UI가 아니다.**

## 실제 화면·증거

[여성 옆](trunk-female-side.png) · [여성 앞](trunk-female-forward.png) · [남성 옆](trunk-male-side.png) · [남성 앞](trunk-male-forward.png).

원본 A37의 얼굴/목·팔 표면·최종 외형과 표시 디자인은 승인되지 않았다. 임상적으로 올바른 시범이 아닌 기존 Blender 메모리 fixture와 생성 관찰이다. 조형/원본 저장/GLB export0. 남녀 GLB의 원래 SHA는 [summary](summary.json)에 보존했다.

[최종 native 결과](browser-summaries.json.gz)는 남녀 각각12건/총24건 통과·실패/skip0이다. [전체 FE](unit-verified-final-results.json.gz)1214건·Biome255파일·tsc·build·production guard가 통과했다. 원래 미검출과 생성 양성은 분리하며 외부 요청0·storage0·SDK/프레임/모델 정리를 확인했다. [증거 SHA/gzip 원문 SHA](manifest.json)166파일·실제 소스226개를 대조했다. 테스트 당시 HEAD는 기준선 f55566d이며 새 커밋에서 실행한 것처럼 기록을 바꾸지 않는다.

## 보완·실패 보존

- 최초 표면 RED는 19건 중5실패였다. 명시적 몸통 허용, await 전 옵션/프로그램 복사와 disabled 거부를 구현했다.
- 최초 Chrome은19통과/5실패였다. 여성 강조의 GPU red pixel 검증 실패1과 확장된24시험의 실제 가입 제한429 실패4다. 제품 rate limit/timeout은 낮추거나 늘리지 않았다.
- 시험 제목에 파일명이 붙는데 시작점에 여성 이름을 고정해0건 실행한 실패, 이후 bare male이 female까지 선택한20통과/4실패도 보존했다. 제목 토큰 경계를 사용하고 남녀를 각각 새 격리 시험 서비스에서 실행한다. 사례 생략/자동 retry가 아니다.
- 색상 보완의 per-mesh peak0 거부는 정상 하위 메시를 잘못 거부하여 여성10통과/2실패를 만들었다. 0가중치 부분은 중립으로 유지한다. 추가 리뷰에서 작은 기여를 독립적으로 증폭하지 않도록 모델 전체의 한 peak로 색상만 정규화했다. 영향 범위·position/normal/skin 가중치·판정은 바꾸지 않는다. 관련 RED와 다중 메시 회귀를 보존했다.
- 초기 pnpm 실행은 잘못된 시험 캐시 링크로 설치 시도/DNS 실패했고 검사 실행 완료로 세지 않는다. 기존 설치 바이너리를 재사용했다. 첫 DB 초기화는 sandbox shared memory 권한 실패이며 새 소유 시험 DB로 검증했다. 초기 Biome 경고를 고쳤다. 기존 로그 이름 충돌은 wx 보호에서 기록기가 실패했으며 원본을 덮어쓰지 않고 verified-final 이름으로 재실행했다. 원래 오류 출력은 실행 대화에 남고 별도 기록이 없는 오류를 파일 증거로 주장하지 않는다.

최초/보완/최종 report·원본 로그·compiled probe를 각각 보존한다. 최종 공개 JS355151/CSS31199 byte와 SHA는 이전과 동일하다. 개인정보/SDK 제품 정책·운영/배포·deps 변경0. 기존 SDK notices는 [이전 원문 고지](../native-feedback/notices/README.md)에 있다.

## 리뷰·남은 조건

작성자가 실제 diff의 보안·성능·정확성·소유권/정리·유지보수를 검토했다. 독립 리뷰는 아니다. Story diff의 미해결 P1/P2는0이다. 남녀 동일 최종 probe byte와 소스 SHA를 대조하고 시험 DB는 정상 종료/파일 보존했다. PR gate에서 최신 diff/CLEAN/체크/main 포함을 별도로 확인한다.

출시 적격 동작0·실제 사람/다장치·검증된 판정/교정 콘텐츠·최종 외형/리깅/권리·승인 공개 구조·SDK/외부/HTTPS/운영·기존 간헐적 시작 P2 및 전체1~6은 미완료다. 정상 시작 결과를 기존 P2 해결로 세지 않는다. 최소 텍스트·안전/오류 안내·기존 원본/실패·사전/별도 승인 기준 유지.
