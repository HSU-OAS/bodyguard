# 어깨 코칭 SDK 종료 재현 및 대안 시험

2026-11-06 · Draft PR #163의 기존 `014b6cbf`에서 시작 · **P2 미해결, 코드 수정·병합 없음**

모든 실행은 Chrome의 빈 가짜 카메라, 실제 MediaPipe/Worker/GLB 및 생성 관절 UI를 사용했다. 실제 사람의 영상·좌표·올바른 자세나 손 추적 정확도는 시험하지 않았다. 프레임/좌표/예외 payload 대신 자원별 고정 이벤트만 기록했다. 기존 SDK 추론·정리 5초 제한은 바꾸지 않았다.

## 실패와 원인 분리

1. `repeat-native`는 첫 추론이 5초를 넘고 Worker 정리 ACK도 5초 안에 오지 않아 `cleanup-error`가 발생했다. 동시에 `repeat-ui`는 Vite 동적 import 실패로 시작하지 못했다. 두 서버가 공유 `node_modules/.vite`를 사용하는 시험 간섭 가능성이 있으므로 두 실패를 제품 원인이나 정상 동시 UI 부하로 단정하지 않는다.
2. 각 서버의 캐시를 분리한 `isolated-native`/`isolated-ui`에서는 생성 UI 4흐름이 통과했지만, 네이티브는 정상 입력 33회 후 일시정지에서 기존과 같은 `cleanup-error`를 재현했다. source·아바타·카메라 정리는 성공했고 inference 종료 요청 후 5초 안에 Worker ACK가 오지 않았다. 이는 캐시 간섭만의 문제는 아니라는 직접 관찰이다.
3. `deep3`·`deep4`는 시험 Worker에만 종료 고정 단계 로그를 추가했고 각각 네이티브 2흐름과 UI 4흐름이 통과했다. `deep5`는 첫 추론 timeout 후 정리 실패했다. 이때 세 SDK를 역순 종료하는 첫 호출(손 GestureRecognizer `close()`)이 시작된 로그는 있으나 종료 로그는 없었다. **deep5는 준비 중 추론 timeout이고, isolated-native의 일시정지 실패와 동일 원인이라고 입증된 것은 아니다.** 계측에 따른 타이밍 변화도 있다.
4. `fifo1`은 시험 Worker에서만 세 SDK 정리 순서를 뒤집었다. SDK 종료 단계 전체가 기록됐지만 5초 내 ACK를 받지 못해 일시정지에서 `cleanup-error`가 났다. 순서만 바꾸는 대안을 채택하지 않았다.
5. `handcpu1~3`은 시험 Worker에서만 손 모델을 CPU delegate로 만들고 모델·카메라·다른 두 SDK·마감은 그대로 유지했다. 각 네이티브 2흐름과 대응 생성 UI 4흐름이 통과했다. 두 반복은 각 별도 프로세스에서 실행해 두 시험의 매 순간 부하 일치를 보장하지 않는다. **빈 카메라의 소수 시험은 실제 손·전신 정확도, 모든 기기 성능, 오류 해결을 입증하지 못한다.** 제품 설정은 바꾸지 않았다.

`deep-native.log`는 진단 runner의 async 문법 오류, `deep2-native.log`는 시험용 `route.fetch`가 테스트의 거부 프록시를 사용한 실패다. 각각 실제 제품 검사 실패와 구분해 보존한다. 이후 원래 CSP를 전달하는 같은 출처 Node fetch로 runner를 고쳐 실행했다. 계측 대상은 원래 Vite가 생성한 Worker 번들이며 `[BG-QC]` 로그는 실제 SDK 종료 전후의 정해진 단계만 기록한다. FIFO/CPU는 그 번들을 시험 중에만 변형했으며 실제 제품 코드나 SDK 설치 파일은 수정하지 않았다.

[실패한 격리 재현](evidence/isolated-native.json) · [UI 동시 통과](evidence/isolated-ui.json) · [계측 실패 로그](evidence/deep5-native.log) · [FIFO 실패](evidence/fifo1-native.json) · [손 CPU 시험 1](evidence/handcpu1-native.json), [2](evidence/handcpu2-native.json), [3](evidence/handcpu3-native.json).

## 보존과 다음 조건

각 JSON·로그와 실제 실행 runner는 `evidence/`, `executed/`에 보존했다. runner 내부의 `before`/`after` 스냅샷은 원래 저장소 runner 이름을 기록하므로, 수정된 실제 실행 runner의 소스는 별도 `executed/` 파일과 SHA를 기준으로 한다. 모델 입력이나 계정·비밀값·운영 데이터는 저장하지 않았다. 모든 동작은 로컬이고 배포·공개 활성화가 아니다.

다음은 실제 사람을 포함한 손 추적·전체 화면 성능과 기기별 반복 시험을 수행하고, 대안의 정확도·정리 안전성을 확인한 후 설정 변경 여부를 결정하는 것이다. 현재 CPU 대안을 적용하거나 원인을 확정하지 않는다. 원래 P2, 외형 P2, 실제 사용자·전문가 검증과 전체 단계 완료 기준은 그대로 남는다.

## 공개 정적 손 이미지의 CPU/GPU 비교

Google MediaPipe의 공개 테스트 이미지 `thumb_up.jpg` (generation `1662650667349746`, SHA-256 `5d673c081ab13b8a1812269ff57047066f9c33c07db5f4178089e8cb3fdc0291`)를 로컬 임시 폴더로 받아 사용했다. 이미지 자체는 저장소에 복사하지 않았다. 같은 버전의 손 모델을 동일 이미지로 VIDEO 모드에서 20프레임씩 시험했으며 Chrome/WebGL의 실제 SDK, 동일 출처 로컬 모델/WASM을 사용하고 외부 요청·pageerror는 0이었다. GPU를 먼저, CPU를 나중에 실행한 1회 시험이다.

양쪽 모두 20프레임에서 손 하나를 감지했다. 21개 관절의 x/y/z 정규화 좌표를 대응 비교했을 때 최대 절댓값 차이는 약 0.0136이었다. 첫 프레임을 제외한 평균 추론 시간은 GPU 약 26.0ms, CPU 약 60.3ms였다. 순서·캐시·기기 하나·정적 사진의 한계가 있어 이 수치가 일반적인 성능, 실제 신체 오차, 의학적 정확도, 동작 추적의 등가성을 뜻하지는 않는다. 원시 관절은 브라우저 메모리에서만 비교하고 저장소에는 집계 결과만 기록했다. [집계 결과](evidence/hand-static-cpu-gpu.json) · [실행 코드](executed/local-hand-cpu-gpu-compare.mjs) · [브라우저 비교 코드](executed/local-hand-cpu-gpu-compare.ts).

이 시험으로 `handcpu1~3`의 정리 가능성이 실제 손 추적이나 여러 기기에서도 유지됨을 증명할 수 없으며, 차이와 추가 지연을 확인했으므로 제품 CPU 전환이나 P2 해결로 처리하지 않는다.
