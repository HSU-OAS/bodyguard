# 최초 실행 보존

2026-10-09 19:37:58 KST. `node node_modules/vitest/vitest.mjs run src/avatar/ownedMotionPreview.test.ts`.

exit 1. 1 failed suite / no tests. `Cannot find module './ownedMotionPreview' imported from .../ownedMotionPreview.test.ts`.

Story 명세와 하네스를 먼저 작성한 뒤 구현 파일이 없어서 import 단계에서 실패했다. 수용 기준 assertion이 실행되어 실패한 RED라고 표현하지 않는다. 이후 구현·재실행 결과와 구분한다.
