# 코칭 시작 실패 재현 · S6.17 진행 중

## 최신: 중단 시 카메라와 SDK 수명 분리

[실제 흐름·개정 계약·실패·남은 문제](early-camera/README.md): 비공개 native 중단 요청과 같은 turn에 카메라를 끄고 처리 중 입력/SDK/Worker는 기존 반환 장벽 뒤 회수한다. actual 남녀 Worker24/main52에서 늦은 결과·권한·기록·회수 경계를 확인했다. 일반 caller·기본 main은 유지한다. camera helper12건의 정확한 계약 변경과 실패 원문을 별도34bundle로 보존했다. 실제 사용자 버튼 지연/전체 시작 P2 해결·제품/단계 완료로 세지 않으며 Draft101 병합 불가다. 현재 검증은 `early-camera/verify.mjs --current`로 수행하고 이전 두 verifier는 `--current` 없이 고정 과거 증거만 검증한다.

## 후속 제품 수정 · 병렬 준비 검증 중

카메라 이후 독립 SDK/아바타 준비를 중첩하고 양쪽 소유권 이전에는 ready/재생을 금지하도록 구현했다. 최초 asset 실패가 다른 factory의 abort로 덮이는 문제도 고정 stage 원인 보존으로 수정했다. 일반 factory의 직렬 기본값, 취소/late 회수·정리 실패 격리·새 세대 장벽·출시 동작0은 유지한다.

초기156pass/6fail, 첫 브라우저12pass/1fail, renderer 추가0pass/2fail와 실행 전 DB sandbox 실패를 보존했다. 병렬 준비에 따라 기존 타이밍2건의 순서 계약과 renderer 추가4건의 실제 생성/회수 guard를 [Story](../../stories/native-startup-browser-comparison.md)에 명시했다. 원래26건 모두 불변으로 표시하지 않으며 나머지24건 및 poll/timeout/retry는 그대로다. [별도 정확한 계약 비교](compare-parallel-contract.mjs)는 baseline의 명시한 변경만 허용한다.

기존 `manifest.json`/457개 증거와 아래 조사 기록은 이전 시점의 고정 baseline이며 덮어쓰지 않는다. 기존 `verify.mjs --current`는 그 시점 소스 대조이므로 후속 소스 검증에 사용하지 않는다. 새 제품 수정의 실제 회귀·시간·정리 증거는 별도 구간에 추가한다. **시작 P2/Story/전체1~6은 미완료이며 Draft PR101 병합 불가다.**

[후속 실제 결과](parallel-preparation/README.md): 두 Chrome 실행본 각각 남녀26·전체 계측26·renderer 취소4건의 흐름/회수를 확인했다. 준비는 실제 중첩됐지만 전체 지연은 거의 줄지 않았다. 성능 개선/과거 원인 해결로 주장하지 않으며 동일 Draft에서 main-thread 추론 병목을 이어간다. 최초 실패/개정 계약과17개 새 bundle은 기존 증거와 분리했다.

---

아래는 제품 수정 전 재현·계측 결과다.

[Story](../../stories/native-startup-browser-comparison.md). 최신 main85885c4d에서 원래26개 회귀의 본문/guard/loop를 유지해 시작 지연을 다시 확인했다. **시작 P2는 미해결이고 이 Story는 완료/병합 불가다.**

## 실제 흐름과 발견

별도로 남아 있던 Chrome for Testing154.0.8037.57에서 남성 첫 목 흐름이 기존5초 poll의 nativeCloses≥3 조건을0으로 실패했다. before-close에는1개 결과·4개 render와 running 상태가 있었지만 단계 계측은 꺼져 있었다. 이는 **현재 코드에서 같은 실패 predicate를 재현한 것**이며 과거 PR90의 정확한 원인이 같다고 입증한 것은 아니다.

그 외154의 남성12·여성13, 설치된 Chrome155.0.8059.40의 남녀26은 통과했다. 정상 흐름에서는 두 기존 모델/가림·presence/새 세대·권한 회수·본인 중단 기록·자원 해제를 확인했다. 실패한 시작에서도 후처리의 카메라·입력·모델 회수와 외부 요청/JS 오류0을 확인했다. 합성 양성/단계/오류·가짜 카메라/메일과 actual SDK/API/격리 SQL을 구분한다. 실제 사람·물리 카메라·올바른 임상 판정 시험이 아니다.

154는 for Testing이고155는 desktop 실행본이다. 실행 순서·패키징·호스트 부하·캐시까지 분리한 인과 실험이 아니므로 버전 차이 하나를 원인으로 단정하지 않는다. 과거13/26 실패와 모든 기존 증거는 그대로 남는다.

## 추가한 관측 · 제품 수정은 아님

`BODYGUARD_TEST_NATIVE_STARTUP_TIMING=1`이면 기존 유한한 nativeStartupTiming을 전체 시험의 mount에도 켠다. 기본은 계속 꺼짐이다. 원래 시험 본문·guard·loop,5초 poll/60초/retry0·기본 main thread·renderer 준비 꺼짐과 가입 제한을 유지했다. 기존 명시 계측 시험은 그대로다.

계측154 남녀26은 통과했고 모든 종료 snapshot의 계측이 closed/invalid=false·이벤트≤30/각 stage≤3이었다. 고정 stage와 상대 시작/끝 시간만 있으며 영상·좌표·신체 수치·신원/URL 수집은 없다. **계측 실행의 성공은 비계측 실패의 수정이 아니다.** 먼저 실패 당시 단계 기록을 확보하고 지연 원인을 좁혀 실제 제품 보완과 필수 회귀를 이어간다.

## 실제 실패와 검증 경계

- 첫 실행은 허용 prefix가 아닌 출력 경로 때문에 Vite의 소유권 검사에서 실패했다. 브라우저 시험0건이며 성공이나 제품 assertion 실패로 세지 않는다. 이전 driver/원문/receipt/0건 report를 보존하고 허용된 새 경로로 수정했다. 검사 완화0이다.
- 처음 묶어 실행한 원래 계약 대조와 타입 검사 뒤 Biome은 저장소 루트에서 FE 파일을 지정해 nested-root 설정 오류를 냈다. 그 묶음의 마지막 diff exit0을 전체 통과로 세지 않는다. 당시 원문은 대화 출력이며 별도 최초 receipt가 있다고 하지 않는다. frontend cwd에서 각 명령을 따로 기록해 검증한다. 설정/migration 변경0이다.
- 없는 원본 문서 경로·추정 report 경로·잘린 조회 출력·샌드박스 ps 권한 오류는 조회 실패다. 현재 프로세스와 실제 생성 경로로 확인했으며 제품 성공 증거가 아니다.
- 최초 collector는 기록 화면으로 이동한 시험의 `final=null`을 잘못 가정해 TypeError로 중단됐고 manifest가 없어 verifier도 실패했다. 두 번째는 Playwright가 잘라 만든 여성 폴더명에 완전한 제목을 기대해 실패했다. 이동 전에 `native-closed-before-public-record`에서 실제 종료·회수·GPU baseline을 확인한 정상 흐름이며, 실제 report의 정확한 시험 제목/단계만 연결하도록 고쳤다.
- 세 번째 collector는 처음 계측26건 중 몸통4건의 기록이 없음을 발견했다. mount의 기본값만 바꿔서는 명시적 false 인자를 전달한 시험에 적용되지 않았다. 이전 부분 계측/소스/collector를 보존하고 Node에서 전달 객체를 만들 때 전역 opt-in과 명시 인자를 결합하도록 수정했다. 수정 중 잘못된 binding 위치도 실행 전 코드 검사에서 발견해 바로잡고 해당 소스를 보존했다. 수정 후 남녀 전체26건을 새로 실행해 모두 통과하고 종료 계측을 확인했다. 부분 계측의 정상26건을 전체 관측으로 세지 않는다.
- 이전 collector/중간 소스와 부분 패키지는 `/private/tmp/bodyguard-startup-browser-proof.iidajw/collector-partial-1`, `collector-partial-2`, `collector-partial-3`에 보존했다. 해당 collector/조회 오류 원문은 대화 출력이며 별도 최초 receipt가 있다고 하지 않는다.

[manifest](manifest.json)의 명시적 허용 파일에는 보고서·고정 종류의 snapshot/상대 시간·실행 receipt/소스 전후 hash·검증 결과·전용 driver만 담는다. API/GitHub 메타데이터·DB·메일함·키·임의 폴더는 수집하지 않는다. 아바타/합성 계정 PNG는 원래 private 출력에 보존하되 이 조사 패키지에는 추가하지 않는다. 최종 아바타 미리보기나 디자인 검토가 아니다.

## 최종 기록과 작성자 검토

마지막 계측 실행은 `chrome154-timed-male-fixed`/`chrome154-timed-female-fixed`이며, 각각13건의 report와 종료 snapshot을 연결했다. 초기 부분 계측과 환경 실패까지9개 실행·457개 허용 증거의 원문/압축 hash를 보존했다. 원래26개 본문/guard/loop AST 대조, FE1411·타입·Biome·자산 준비·직렬 공개 build/guard·diff는 최종 소스에서 모두 exit0이다. 공개 JS/CSS와 남녀 GLB·저작 fixture hash는 기존과 같다. 백엔드 전체 시험·Docker/HTTPS·실제 사람/장치 시험은 이번에 실행하지 않았다.

증거 verifier는 원래 계약·원문 hash·소스 허용 경로·전후 소스 불변·실제 report 제목/상태·26건 계측과 회수를 확인했다. 별도 private 복사본에서 허위 완료, 실패 삭제, 사례/계측 누락, 잘못된 경로/hash, 중복 항목8개를 실제 거부했다. 원본 증거는 바꾸지 않았으며 브라우저 재시험 또는 시작 P2 해결로 세지 않는다. 복사본/출력/receipt는 `/var/folders/8z/d7p5k9352z75y68hl1l0x3mr0000gn/T/bodyguard-startup-evidence-negative-fNkT0o`에 보존했다.

| 검토 축 | 확인과 결론 |
|---|---|
| 보안·개인정보 | 환경 변수는 Node의 TEST 인자에서만 읽고 기존 stage/상대 시간 상한을 재사용한다. 증거 파일·소스 경로를 허용 목록으로 고정했다. 공개 SDK 정책/원시 영상·신체 데이터 수집 변경0 |
| 성능 | 계측 자체가 timing을 바꿀 수 있고154/155는 환경 대조가 완전하지 않다. 정상 계측을 제품 개선·실제 노트북 기준 충족으로 처리하지 않음 |
| 정확성 | 명시 false를 넘기는 몸통 시험에도 opt-in이 적용되고 기본 false/기존 true를 유지한다. 본문/guard/loop와5초/60초/retry0은 그대로. **첫 시작 P2는 미해결: Request changes, 병합 불가** |
| 유지보수 | 단일 TEST opt-in과 기존 helper를 사용한다. 초기 오류·부분 계측·최종 원문과 실행 receipt를 분리하고 검증 명령을 제공함 |

독립 에이전트·전문가 리뷰가 아닌 작성자 검토다. 이 기록은 완료된 제품 수정이 아닌 재현과 다음 원인 조사용 Draft다.

## 남은 작업과 PR 경계

다음은 재현된 첫 시작의 실패 단계·환경 대조와 실제 수정이다. 시간 제한 확대·재시도·원래 사례 제거·시작 전 성공 관찰 적립·정상 반복만으로 닫지 않는다. 실제 camera/SDK 준비와 render/첫 추론의 비용을 구분한 뒤 정상/가림·취소/소유 회수·기록 및 원래26개를 검증한다.

engineering:debug로 재현과 대조를, engineering:code-review로 기본 opt-in/개인정보·이벤트 상한/복구·본문 불변/증거 허용 목록을 작성자 검토한다. 독립 에이전트/전문가 리뷰가 아니다. 시작 P2가 남으므로 Draft를 유지하며 **체크가 없어도 병합하지 않는다.**

공개 화면/최소 문구·공개 consumer·SDK 정책·판정 수치·GLB/Blender/새 조형·운영 변경0이다. 실제 동작/classifier·최종 외형/권리·승인된 공개 구조/SDK·참여자/다장치·공급자·Docker/HTTPS/운영 및 D2/전체1~6은 미완료다. 별도 승인 경계와 출시 동작0을 유지한다.

```bash
node bodyguard/docs/review/native-startup-browser-comparison/verify.mjs --current
node bodyguard/docs/review/native-startup-browser-comparison/verify-negative.mjs
```

위 명령은 포장/원래 계약/실행 목록/상태의 일관성 검사이며 브라우저 재실행 또는 시작 P2 통과 검증이 아니다.
