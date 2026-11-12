# 형상관리 및 테스트 URL 제출 안내

확인일: 2026-11-12 · 팀: UHI · 프로젝트: BODYGUARD

## 공유 스프레드시트 입력값

[수업 형상관리 표](https://docs.google.com/spreadsheets/d/1rhlkvuK0nsFdw1uiZlTyhJmVGplxwAFyeO7jU1Q0w7M/edit)의 **UHI 행**에 아래 값을 사용한다. 다른 팀의 행은 변경하지 않는다.

| 열 | 입력값 |
| --- | --- |
| 팀명 | UHI |
| Url | https://github.com/HSU-OAS/bodyguard |
| README 등록 | 등록 |
| Repository 구성 | 등록 |
| Test URL | https://hsu-oas.github.io/bodyguard/ — ID: 불필요 / Password: 불필요 |
| AI접근 | 딥러닝 — 기존 분류표 기준 `4.딥러닝` |
| 서비스유형 | Web — 기존 분류표 기준 `2.Web` |
| 기타 | 웹캠·후보 아바타 검수용 시제품. 전체 서비스는 개발 중. |

2026-11-12 현재 연결된 Google Drive 계정으로 공유표를 읽을 수 없어 현재 셀 값과 입력 완료 여부는 재확인하지 못했다. 위 표는 저장소와 공개 URL을 확인해 준비한 **입력할 값**이며, 시트를 수정했다는 기록이 아니다. 편집 권한을 확보하면 현재 UHI 행과 드롭다운 선택지를 다시 읽고 해당 행만 갱신한다.

Test URL과 ID·Password가 한 셀인 경우 다음 내용을 함께 입력한다.

```text
https://hsu-oas.github.io/bodyguard/
ID: 불필요 / Password: 불필요 (비로그인 검수 페이지)
```

## 테스트 페이지 사용 방법

1. 웹캠이 있는 노트북의 브라우저에서 [테스트 URL](https://hsu-oas.github.io/bodyguard/)을 연다.
2. 남성·여성 아바타와 전신·상반신·자세히 중 보기 범위를 고른다.
3. `웹캠 시작`을 누르고 브라우저의 카메라 권한을 허용한다.
4. 어깨와 팔이 보이게 한 뒤 한 팔을 천천히 들어 추종 후보를 확인한다. 정면을 보고 `정면 맞추기`를 사용할 수 있다.
5. 끝나면 `웹캠 종료`를 누른다.

이 페이지의 오른쪽 아바타는 중립 자세다. 스트레칭 선택·올바른 시범·잘못된 부위 판정·로그인·기록 저장을 시연하는 전체 서비스는 아니다. 촬영 범위 밖의 움직임까지 재현하지 않으며 실제 추종 품질과 정확도는 검증 중이다. [검수본 설명](../bodyguard/pages-preview/README.md)

## 저장소 구성과 제출 근거

| 요구 항목 | 실제 저장 위치 |
| --- | --- |
| README를 Project Charter로 구성 | [README](../README.md): 문제·대상·목표·범위·현재 상태·기술·팀 역할·라이선스 |
| 문서 | [과목 산출물](./) · [개발 요구사항·설계·Story](../bodyguard/docs/) |
| 소스 | [React 웹](../bodyguard/frontend/src/) · [FastAPI API](../bodyguard/backend/app/) |
| 이미지 | [공개 검수본 접속 화면](images/public-preview-20261112.png) · [Blender 검수 이미지](../bodyguard/assets/blender/review/) |
| 기타 | [MIT 라이선스](../LICENSE) · [Blender 원본](../bodyguard/assets/blender/) · [E2E 안내](06_e2e_test_guide.md) |

기존 실행 경로를 유지하므로 `sorc`라는 이름의 복제 폴더는 만들지 않는다. 공개 검수본의 빌드 코드는 [pages-preview](../bodyguard/pages-preview/)에 있다. 검수 이미지와 모델 후보를 최종 외형이나 출시 승인 증거로 사용하지 않는다.

## 실제 확인 결과

| 확인 | 2026-11-12 결과 |
| --- | --- |
| 공개 저장소 비로그인 접속 | 인증 정보 없는 HTTP 요청에서 200. GitHub 저장소 정보도 `isPrivate: false` |
| 테스트 URL 접속 | 인증 정보 없는 HTTP 요청에서 200 |
| 브라우저 초기 화면 | Chrome 비로그인 새 컨텍스트에서 페이지와 JavaScript 로드, `웹캠 시작` 버튼과 보기 선택 표시. 페이지 오류·실패 요청 없음 |
| ID·Password 요구 | 공개 검수본은 로그인 입력 없이 이용. 초기 화면의 비밀번호 입력 필드 0개 |
| 실제 사람 웹캠·추종·자세 판정 | 이번 제출 점검에서는 미실행. 카메라를 시작하거나 영상을 수집하지 않음 |
| 공유표 읽기·쓰기 | 연결 계정의 권한 부족으로 미완료. 현재 입력값 확인 및 쓰기 미실행 |

[접속 화면](images/public-preview-20261112.png)과 [브라우저 확인 결과](images/public-preview-20261112.json)를 함께 보존한다. 카메라를 시작하기 전의 대기 화면이며, 아바타 표시나 실제 추종·판정 성공을 입증하는 스크린샷이 아니다.

AI 분류의 근거는 MediaPipe 사전 학습 모델을 통한 신체 추정이다. 동작 코칭은 별도의 규칙을 사용한다. Codex 등의 개발 보조 도구 사용을 제품의 에이전트형 AI 기능으로 분류하지 않는다. 실제 동작별 정확도와 전체 출시 기준 통과는 별도 검증 대상이다.
