# S2.6b2 Chrome 화면 증거

2026-10-01 · 최종 Google 브라우저 suite10개/21.9s 실행에서 얻은 원본 PNG다. localhost:4173의 production Vite build·실제 FastAPI/격리 PostgreSQL·RSA/Authlib을 사용했다. Google 동의/HTTPS는 모의이며 브라우저 외부 통신은 소유한 닫힌 proxy로 차단했다. 실제 Google 계정·Gmail·운영 서버·카메라·신체 영상은 없다. [Story 검증/최초 실패 기록](../../stories/stage2-google-auth-web.md)을 함께 읽는다.

| 원본 | 검사 | SHA-256 |
|---|---|---|
| [google-signup-desktop.png](google-signup-desktop.png) | 1440×1000, 전체 페이지, 이메일/Google 두 선택 | `c26f94ceea2f25f4f36b213f2812f300f853aa868776c2f792918b14449b2758` |
| [google-signup-narrow.png](google-signup-narrow.png) | 700×900 viewport·전체 페이지, 가로 넘침 없음·키보드 초점 | `43fc8066ceee61e442fc6a16b2a1858f6d4eb39a141ebe1025f16135aec4293f` |
| [google-cancelled.png](google-cancelled.png) | 취소 실패 안내·이메일 재시도·미인증 | `c89c6eb264be20ee3e52f7c9e6c0e0fe2d9210996d83101cbd7b2fa2dbf41853` |
| [google-account-conflict.png](google-account-conflict.png) | 자동 계정 합치기 없음·기존 방식 복귀·한국어 줄바꿈 | `488269c774f406a3ecbf4faf647aa68da8bb9189b9e0d30c1e447545c87a74bc` |

이미지를 직접 검사했다. `fullPage`이므로 실제 PNG 높이는 viewport보다 클 수 있다. 픽셀을 후보 UI로 꾸미거나 합성하지 않았으며 추후 변경 후에는 다시 캡처해야 한다. 실제 Google 동의 화면·모바일 UI·전체 서비스 출시 검증 완료로 표시하지 않는다.
