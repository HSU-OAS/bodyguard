# 손목·손가락 표시 연결 검토

2026-10-08 · S2.T15 · runtime `507e7562450104de9dc6d620a152170f2bcc3587` · **비공개 합성 관찰, 출시 아바타/코칭 아님**.

## 실제 작동한 흐름

보존 A37 남녀 GLB의 두 독립 owned 모델에서 비교 모델은 그대로 두고 사용자 모델의 손목2개·손가락30개(끝마디 포함)를 원래 관찰 stamp로 움직인다. 손목은 손바닥 평면 회전, 손가락은 선분 방향과 원본 twist 보존으로 구분한다. 굽힘→손목 회전→손끝 클리핑→한 손 누락→모두 누락→중복 후보→손바닥 클리핑→복수 body→복구→만료→종료가 남녀 각각 실제 Chrome154/WebGL에서 작동했다. 초기 상태와10후속 상태를 확인했다. 몸·머리와 같은 owned pair에 연결했고 source/비교 모델·position/scale·8가중치·전신 구도를 보존했다.

전체frontend1036/타입/Biome/assets/build/public guard/diff 통과. guard의 의도적 RED1→복원 GREEN0도 확인했다. 공개 JS/CSS와5개 모델 byte는 기존과 같고 공개 후보 GLB는0이다. [실제 결과·source14/증거90 SHA](summary.json).

Blender5.1.1에서 보존 원본을 저장·수정하지 않고32관절 축/계층을 읽었다. GLTFLoader의 정확한 이름과 끝마디의 실제 local +Y를 확인했다. Blender 원본·GLB·조형·재질 변경0이며 새로운 제작 사이클이 아니다.

## 실제 미리보기

[여성 손 굽힘](evidence/final-female-bend.png) · [여성 손목 회전](evidence/final-female-turn.png) · [남성 손 굽힘](evidence/final-male-bend.png) · [남성 손목 회전](evidence/final-male-turn.png)

아바타만 캡처한 비공개 검증 화면이다. 기존 A37의 얼굴/목·손 표면 결함은 미완료 그대로다. 최종 외형이나 확정 제품 디자인으로 제시하지 않는다. 입력 영상·개인 관절/얼굴 데이터 캡처/저장0.

## 실패·리뷰

초기 Blender sandbox crash139와 원본 crash, 잘못된 helper cwd/모델 복사 경로/누락 config, TS 키·fixture 타입 오류, 단위5실패와 browser 만료 snapshot 실패를 보존했다. 거울 손바닥의 반사 좌표계를 proper 회전으로 고쳐 반 바퀴 뒤집힘을 해결했다. 외부 옵션 getter는 load 이전 한 번 읽어 복사하고 quaternion의 Float32 오차만 정규화했다. 만료 전에는 보간이 계속되므로 실제 만료 후 정지를 따로 확인했다. 품질 수치나 임상 기준을 낮추지 않았다.

테스트 전략 스킬에 따라 긍정·오류/누락·복구·소유권을 분리했고 코드 리뷰 스킬로 보안/개인정보·수명/성능·관절 수학/계층·수용 기준을 작성자 리뷰했다. 독립 리뷰어 시험이 아니다. Story 범위 미해결P1/P2=0; 전역 D2 문제와 초기 시작 성능P2는 해결로 세지 않는다. 이 검토는 PR 최신 diff/CLEAN/체크 게이트를 대체하지 않는다.

## 남은 필수 작업

native Gesture Recognizer의 같은 frozen 입력·소유권 연결은 다음 Story다. 긍정 움직임은 생성21점이며 실제 카메라/SDK/사람 정확도 검증은 아니다. 좌우 label은 caller 후보로 동일인 연결 증거가 아니다.21점에는 관절별 가시성 증거가 없고 손가락 축 비틀림·중수골 회전·임상 각도/정답을 측정하지 않는다. 이 상태를 공개 코칭에 사용하지 않는다.

실제 참여자·관찰자와 각 동작의 시작/목표/복귀·보상·가림·복수 인물/촬영 범위를 따로 검증해야 한다. 최종 무의상/연속 얼굴·목 외형·권리, 시범/교정·승인 디자인·실제 노트북/장시간·SDK 정책·HTTPS/운영·외부 인증/메일 및 D2/전체1~6 기준은 미완료다. 비용·계정·시크릿·운영DB/migration·배포·출시·중요한 안전/개인정보 변경0.

압축 증거는 lossless gzip으로 원본 SHA 검증이 가능하다. Blender/GLB 원본은 기존 Git 객체25a9bd6와 로컬 proof에 보존했다. 압축 probe의 [실제 Three.js MIT 고지](notices/three-MIT.txt)를 함께 보존한다.
