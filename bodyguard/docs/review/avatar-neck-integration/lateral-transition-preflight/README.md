# 연속 전이 runner의 초기 준비 실패

[실제 관찰](result.json)과 실패 당시 runner source gzip을 보존했다. SHA `07d4a88f6a7bb066835ff11504a3d1bf2ce2c164ca600b484b526e7f64cb8048`는 source의 `run_lateral_transition.mjs`와 같다. 이 파일은 미사용/반려된 초기 실행 source이며 후속 `run_lateral_transition_native.mjs`로 고친 실제 실행과 구분한다.

Biome의 import 순서 exit1로 chained mkdir가 실행되지 않았는데도 다음 도구 호출에서 runner를 시작했다. Node는 proof 폴더 readdir 단계에서 ENOENT/exit1로 종료해 **Blender 실행0, native exit=null, 모델/runner 증거 작성0**이다. 이 초기 orchestration 실패를 삭제하거나 실제 native 실패exit1로 바꾸지 않는다.

새 이름의 runner는 import 순서 보완·정적 검사 exit0를 확인한 뒤 빈 영구 proof를 만들고 실제 Blender를 실행했다. authoring 파라미터는 바꾸지 않았다. 이후 실제 결과/입력 보호/미실행은 [연속 전이 결과](../lateral-transition/README.md)에 기록했다.
