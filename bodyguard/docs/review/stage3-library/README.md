# S3.3 동작 검수 목록 실제 증거

2026-10-05 · localhost Chrome · 계정 mock · 실제 사용자 수행 아님

[어깨 상세](shoulder.png) · [상체 목록](torso.png)

[첫 실패 보고서](browser-first-failed.json): Chrome 초기화 실패1/통과6.
[두 번째 실패 보고서](browser-second-failed.json), [오류 문맥](browser-second-error.md): 로딩 중 status locator 중복 실패1/통과6.
[최종 보고서](browser-final-passed.json): 통과7/실패0/skip0.

첫 오류 문맥 파일은 재실행 정리로 별도 사본이 남지 않았다. 첫 JSON 보고서와 도구 출력에는 실패 원인·실행 결과가 남아 있다. 없어진 파일을 보존했다고 주장하지 않는다.

원문 재확인: [CUH](https://www.cuh.nhs.uk/patient-information/neck-exercises-and-advice/), [AAOS](https://orthoinfo.aaos.org/globalassets/pdfs/2024-rotator-cuff-and-shoulder-conditioning-program.pdf), [Leeds](https://www.leedsth.nhs.uk/wp-content/uploads/2023/08/Exercise-NASS-Home-exercises-for-axSpA_AS-v2.pdf), [Kingston and Richmond](https://www.kingstonandrichmond.nhs.uk/patients-and-families/patient-leaflets/home-exercise-programme-falls-prevention). 자료의 환자별 숫자 처방을 제품 판정값으로 복제하지 않았다. Oxford PDF 접근 실패는 동작 콘텐츠 재확인 미완료로 유지한다.

기존 아바타 원본·증거를 변경하지 않았다. 상세 실행과 잔여 문제는 [Story](../../stories/stage3-motion-library.md)를 따른다.
