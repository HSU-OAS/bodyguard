# 기존 내 계정·비밀번호 복구 문구 정리

중복 소개를 없애고 설명을 한 문장으로 줄였다. 기존 화이트·블루, 메뉴/섹션·버튼/필드·링크·인증/API 동작을 유지한다. 좁은 창에서 숨겨지던 복구 보안 안내를 입력 영역으로 옮겼다. 코칭 구조나 아바타의 확정 디자인을 뜻하지 않는다.

## 실제 화면

- [계정 전](evidence/baseline-1-member-1440.png) → [계정 후](evidence/final-1-member-1440.png)
- [새 비밀번호 전](evidence/baseline-3-reset-1440.png) → [새 비밀번호 후](evidence/final-3-reset-1440.png)
- [800px 복구 전](evidence/baseline-8-forgot-800.png) → [800px 복구 후](evidence/final-8-forgot-800.png)
- [완료 후](evidence/final-14-complete-1440.png)

실제 production Chrome154.0.8037.57의 main DOM에서 보이는 공백 제외 문자 수다. 이미지·header/footer·전체 서비스 문자 수가 아니다.

| 화면 | 1440/1024px 전 → 후 | 800px 전 → 후 |
|---|---|---|
| 내 계정 | 250 → 172 (-31.2%) | 250 → 172 |
| 복구 요청 | 173 → 140 (-19.1%) | 65 → 91 |
| 새 비밀번호 | 206 → 163 (-20.9%) | 98 → 114 |

800px에서는 빠져 있던 기존 로그인 종료·카메라 미사용 안내가 다시 보이므로 문자 수가 늘었다. 이를 최소 문구 실패나 숨길 이유로 삼지 않는다. 알림 미연결·기간별 조회/삭제·1분 측정 시간/부위별 편차·본인 확인/삭제 범위, 가입 여부 비공개·조건부 접수·일회용/30분·길이/한글/공백을 유지했다.

## 실행·증거 구분

- 최초 happy-dom: 새 기준4실패/기존19통과. [실패와 하네스 보완](initial-red.md). Chrome 원본 하네스 실패3회도 원본 파일에 보존했다. 제품 실패와 구분한다.
- 최종 frontend 73파일/1439통과. 대상 회원·복구23통과. typecheck·Biome282파일(기존 collector의 정보2건, 경고/오류0)·assets·production build·후보 코칭 공개 차단·diff check 통과. 증거 수집/검증 스크립트 추가 후 정적 검사/build/guard도 재실행했다. 원본112파일·별도18증거의 SHA와 현재 UI/test 소스 일치 검증을 통과했다.
- 원본과 최종 각각 실제 Chrome14화면·7흐름: 1440/1024/800px, dark/동작 감소 선호·이메일→제출 키보드 초점, 오류→재시도→조건부 접수·429 대기/비활성·처리 중 이탈/늦은 결과 차단·유효/잘못된 링크·확인 불일치/미전송·완료/필드 제거/제목 초점·로그아웃/계정 숨김. API·계정·비밀번호는 합성 fixture이다. 실제 공급자·메일·SQL·보안 전수 검증으로 세지 않는다.
- 기존 주요 링크/필드 이름, App/Auth/API/CSS/lock SHA는 원본과 같다. PasswordPage의 return 이전 토큰/효과/submit 코드와 MemberPage 로그아웃 핸들러는 diff에서 불변을 확인한다. CSS 출력31199바이트는 기존 동일 SHA `043cb9bdb5d82a3baa9a8463c7a641cbe92ace213303f20c6c7f91e9a14ac82e`. JS는 실제 문구 수정에 따라 바뀌며 기존 동일 출력이라고 주장하지 않는다.
- source 시작/종료 SHA 불변·카메라 호출0·페이지 외부 origin0·pageerror0. 브라우저 background network 전수 감사나 실제 카메라/참여자 검증이 아니다.
- [manifest](evidence/manifest.json)은 원본112파일을 해시로 기록한다. 모든 원본/하네스 실패/PNG/source는 `original-proof.tar.gz`에 보존했다. 별도 PNG/보고서·현재 source·production bundle도 기록한다. 수집 때 기존 파일은 삭제/덮어쓰지 않았다.

재검증:

```bash
node scripts/verify-account-copy-proof.mjs --current
node node_modules/vitest/vitest.mjs run
node node_modules/@biomejs/biome/bin/biome check .
node node_modules/typescript/bin/tsc --noEmit
node scripts/prepare-assets.mjs
node node_modules/vite/bin/vite.js build
node scripts/check-selection-production.mjs
```

새 Chrome 실행은 `mktemp -d /private/tmp/bodyguard-account-minimal-copy-proof.XXXXXX` 안의 새 부모 폴더에서 하네스 baseline/final을 실행한다. baseline은 명시한 기준선 제품 소스/production build여야 하며 final은 현재 제품이다. 이미 존재하는 실행 폴더는 덮어쓰지 않는다. 기존 소스를 되돌리거나 원본을 삭제하지 않는다.

## 작성자 리뷰·디자인 점검

`web-design-studio` 기준으로 실제 계정/1440px 재설정/800px 복구 전후 PNG를 직접 보았다. 입력과 행동 이름이 먼저 보이고 기존 위계/간격/스타일을 유지하며 문단은 줄었다. 작은 창에서도 보안 안내는 잘리지 않는다. UI UX Pro Max의 visible form label·submit feedback 기준에 맞게 필드 이름·로딩/오류/성공을 유지했다. 신규 토큰/라이브러리/아이콘 전용 조작·장식 모션은 없다.

code-review 기준으로 실제 diff의 토큰 저장/URL 제거·CSRF·가입 여부 비공개·취소/중복/늦은 응답·오류/429·성공/세션 종료·탈퇴 진입/삭제 범위·navigation/label을 검토했다. 개인정보/인증 정책 변경0이다. 하네스의 대기·구글 준비 계약·제목 matcher와 Tailwind 지역 이름 유출은 보완했다. 현재 scoped 미해결 P1/P2는 없다. 독립 외부/전문가 리뷰 승인이라고 주장하지 않는다.

## 남은 필수 조건

전체1~6 미통과, 출시 적격 동작0, 최종 아바타/실측·실제 참여자·코칭 구조 적용/SDK 정책·기존 시작P2/Draft101·외부 공급자/운영/HTTPS와 사업 결정은 그대로 남는다. 이 Story는 기존 두 화면의 제한된 문구/안내 개선이며 서비스 출시나 단계4 통과가 아니다. 비용·계정·시크릿·운영 DB migration·배포/출시는 실행하지 않았다.
