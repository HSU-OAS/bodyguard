# 중단 즉시 카메라 종료 · S6.17 미완료

2026-10-09 · 같은 Draft [PR #101](https://github.com/HSU-OAS/bodyguard/pull/101).

## 실제로 바뀐 흐름

비공개 로그인 소유 코칭에서 **중단 요청 → 카메라 종료 → 처리 중 입력 반환 → SDK·Worker·아바타 회수**로 동작한다. 중단 뒤 늦게 반환된 결과는 교정·성공·기록으로 받아들이지 않는다. SDK를 추론 도중 강제로 닫아 입력 회수를 생략하지 않는다. 일반 caller는 기존 순서를 유지하고, 이미 복사한 VideoFrame을 소유하는 native adapter만 `earlyCameraRelease`를 명시한다. 공개 화면이나 기본 main/Worker 선택은 바꾸지 않았다.

정상 protocol로 분리한 실제 Worker 대조에서 opt-in=false는 추론915.0ms 뒤 camera stop918.3ms로 실패했다. true 적용 후 네 최종 실행은 카메라가 추론 종료 전에 꺼지고 정상 engine 반환·clean close·입력 전부 회수를 확인했다. 아래 시간은 첫 실제 복합 추론 시작 기준의 기술 계측이다.

| 실제 실행 | 복합 추론 구간 | 카메라 종료 관측 | 중단 정리 완료 |
|---|---:|---:|---:|
| Chrome154 남성 | 907.1ms | 2.7ms | 931.4ms |
| Chrome154 여성 | 1068.4ms | 2.2ms | 1087.7ms |
| Chrome155 남성 | 912.7ms | 6.0ms | 931.3ms |
| Chrome155 여성 | 921.6ms | 1.9ms | 938.9ms |

TEST ONLY listener가 `probe.stop()`을 호출한 결과다. 실제 사용자 버튼 클릭 지연·기본 main의 동기 추론 중 입력 반응·전체 시작 시간·실제 장치 SLA/FPS를 검증한 것은 아니다. 가짜 카메라/메일/합성 동작 gate, 미완성 기존 남녀 GLB를 실제 SDK/API/격리 SQL과 구분한다. 실제 사람의 올바른 동작·최종 외형 승인 증거는 아니다. 두 실행본의 버전/패키징/캐시/순서를 통제한 인과 실험도 아니다.

## 확인한 사용자 경계와 남은 문제

최종 Worker24건은 로그인→시작→중단, 준비 중 logout·같은 소유자 새 시작, 응답 없는 Worker의 실패·기록 경계를 확인했다. 최종 main52건은 두 아바타의 시범/합성 강조, 가림/복구, 본인 중단 기록, 권한 회수·새 세대의 늦은 결과 차단과 회수를 확인했다. 실제 판정 양성/참여자 시험은 아니다. main 공통 helper를 사용하는12건의 카메라 대기 계약만 즉시 종료로 개정했다. held 입력·SDK close0/반환 뒤 close1·권위/기록·5초 poll/60초/retry0은 유지했다. Worker 기존10건/후처리 hook은 그대로이고 추론 중 중단2건만 추가했다.

전체 FE1439, 타입·Biome·정확한 두 계약·자산·직렬 public build/guard를 실제 통과했다. 이전 고정 증거/비교기는 덮어쓰지 않았다. 공개 JS/CSS·남녀 GLB/저작 fixture는 동일하고 시험 marker는 공개 build에 없다. DB는 종료했다. 백엔드 전체 시험·추가 renderer4·물리 카메라/참여자·Docker/HTTPS/운영은 이번 구간에서 재실행하지 않았다.

**기존 시작 P2는 미해결이다. S6.17/전체1~6 미완료, Request changes, Draft 유지·병합 불가다.** 다음은 기존 main-thread 복합 추론의 실제 시작/입력 반응 병목과 공개 적용 의존성을 분리하는 일이다. timeout 확대·재시도·원래 사례 제외·반복 성공만으로 완료하지 않는다. 최종 외형/권리·실제 동작/classifier·승인된 공개 구조/SDK 정책·참여자/다장치·공급자/운영의 필수 기준과 별도 승인을 유지한다.

## 실패 보존과 증거 위치

[manifest](manifest.json)에15실행·34bundle의 원문/압축 SHA·실행 receipt·전후 소스·실제 report를 연결했다. 0browser 빌드 실패는 성공 사례로 세지 않는다. Worker sidecar는 원래 reporter attachment가 아니다. 설치된 Playwright1.63.0의 outputDir 알고리즘으로 유일한 시험 경로를 도출하고 그 방식을 명시했다. main은 실제 attachment로 연결한다. 영상/좌표/신원/메일/DB/시크릿은 포장하지 않는다. 이전 증거와 원본 아바타는 보존한다.

- 초기 Worker2실패: TEST marker가 strict production protocol에 전달돼 종료를 유발했다. releaseMs=null/Float64 반올림 실패를 포함하며 정상 추론 중단의 증거로 쓰지 않는다. listener에서 marker만 분리했고 계산 오차4EPS만 허용한다. 실제 overlap은 그보다 커야 한다.
- 올바른 opt-in=false 대조1실패: 카메라가 실제 추론 종료 뒤 꺼졌다. 새 옵션 코드가 존재하지만 false인 대조이며 전체 코드가 a59와 byte-identical하다고 주장하지 않는다.
- 첫 native unit116pass/2fail: 이전 카메라 대기 assertion을 기록했다. camera만 교체하고 SDK 대기 검증은 보존했다. 타입/빌드 실패는0browser이며 수정 후122개 집중·1439개 전체 시험을 통과했다. 최초 Biome import 정렬 실패의 원문은 대화 출력이고 별도 최초 receipt가 있다고 하지 않는다.
- 첫 main13건7pass/6fail: 이전 cameraLive/close0 계약의 실패를 보존했다. 카메라 즉시 종료/track ended/detached를 요구하도록 명시한 helper만 교체했고 기존 SDK/held/권한 조건은 유지했다.
- collector2실패: report의 실제 private 위치를 잘못 찾은 조회와 worker sidecar를 attachment로 가정한 포장 실패다. 이전 collector·부분bundle을 보존했다. 재사용은 byte-identical인 경우만 허용했고 verdict를 바꾸지 않았다. 해당 최초 진단은 대화 출력의 전사이며 별도 stdout receipt가 아니다.
- 포장 후 검사 파일명 검증은 `.receipt.json`의 중간 점을 허용하지 않아 한 번 실패했다. verifier 이전 소스를 private에 보존하고 임의 경로 허용 대신24개 실제 파일명을 정확히 열거했다. 브라우저/제품 실패가 아니며 최초 진단은 대화 출력이다.

[포장 후 원문/receipt·변조 거부 검사](post-package-checks.json)는 정상 복사본 수용 및 hash를 다시 계산한 허위 완료/실패 삭제/카메라 지연/SDK 미완료/늦은 피드백/Worker 누수/임의 기록/소스 변조8개 거부를 기록한다. 실제 브라우저 재시험이나 임상 검증으로 세지 않는다. private 원문은 `/private/tmp/bodyguard-worker-busy-proof.ViLOld`와 `/private/tmp/bodyguard-native-cold-stage.rrMOG8`에 보존한다.

## 작성자 검토

engineering:debug가 실제 추론 중 중단을 대조하도록, engineering:code-review가 수명/중단·회수/권위·시험 분리를 검토하도록 이끌었다. 독립 에이전트/전문가 검토는 아니다.

보안/개인정보: 중단 시 기존 수집을 먼저 끝내며 새 수집·저장·egress가 없다. 별도 camera signal은 명시적 native만 사용한다. 테스트 entry/두 고정 marker는 별도 private bundle이다. 성능: camera stop은 앞당겼지만 SDK 추론·전체 시작 병목은 남고 기본 main의 동기 입력 반응을 개선했다고 주장하지 않는다. 정확성: camera/SDK 수명을 분리하되 동일 retirement barrier·늦은 반환/별칭/실패 격리·새 소유자 장벽을 유지했다. 유지보수: 옵션을 초기 snapshot/boolean 검증하고 원래 기본값·정확한 AST 계약·원문 SHA를 보존한다. 같은 Story의 시작 P2 때문에 병합 승인은 충족하지 않는다.

```bash
node bodyguard/docs/review/native-startup-browser-comparison/early-camera/verify.mjs --current
node bodyguard/docs/review/native-startup-browser-comparison/early-camera/compare-main-contract.mjs
node bodyguard/docs/review/native-startup-browser-comparison/early-camera/compare-worker-contract.mjs
```

이전 root/parallel verifier는 `--current` 없이 고정 과거 증거에만 적용한다. 새 현재 소스 검증은 위 명령을 사용한다.
