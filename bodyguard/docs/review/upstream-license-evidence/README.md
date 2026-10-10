# 버전 고정 라이선스 출처 보완

S5.6 · 시작 main `0aed84e9` · [Story](../../stories/upstream-license-evidence.md) · [수집/재검증](../../../scripts/license-source-proof.mjs)

누락 후보8개 버전의 공개 npm metadata를 현재 pnpm-lock의 정확한 name/version·integrity와 대조했다. 그중4개 버전의 공식 source 원문5개를 byte 그대로 보존했다. **설치물의 누락 파일을 복원하거나 제품 bundle에 적용한 것은 아니다. 모든 NOTICE/바이너리·SDK/WASM·최종 모델 권리·법무/배포/전체5단계 완료가 아니다.**

| 버전 | 이번에 확보한 원문 | 출처 연결과 미완료 |
|---|---|---|
| @react-three/fiber9.8.1 | LICENSE | npm gitHead `53ec672ac4a7189711766b87ece18889abbb32d4` |
| draco3d1.5.7 | LICENSE 전체 | npm gitHead `8786740086a9f4d83f44aa83badfbea4dce7a1b5`. 하단 ASCIIMathML.js/MIT·pygments/Unlicense 고지도 그대로 보존. 모든 바이너리 부품 대조는 별도 |
| @biomejs/cli-darwin-arm642.5.14 | LICENSE-MIT / LICENSE-APACHE | npm gitHead `af4365d2b80177d0e0434c0ed4fd2c9171afc56c`. `MIT OR Apache-2.0` 유지, 어느 하나로 임의 변경하지 않음. ROME 별도 고지/실제 binary 대조는 미완료 |
| @rolldown/binding-darwin-arm641.2.11 | LICENSE | npm gitHead 없음. 공식 v1.2.11 tag가 직접 가리키는 commit `8df421985114ecfaf52cce038d4a5a6ea8c05408`을 별도 대조. 바이너리/하위 부품 source 동등성 검증 아님 |
| @mediapipe/tasks-vision0.10.17 /1.0.1 | 미확보 | registry에 gitHead/repository 없음. 기존 canonical Apache-2.0을 두 버전의 SDK/WASM 원문·NOTICE라고 부르지 않음 |
| maath0.10.8 | 미확보 | registry source 연결 없음. 공식 tag API 연결 실패는 태그/권리의 부재 증거가 아님 |
| stats-gl2.4.2 | 미확보 | npm gitHead `c12b2e391d5a88616e0b30f3c7f0577966426239` 확인. 해당 root LICENSE404/tree에 license 파일 없음. 전체 repository의 고지 부재를 입증한 것은 아님 |

## 실제 재현과 결과

Node24.20.0의 고정 공개 요청14개(8 metadata·1 tag·5 source text)만 실행했다. redirect 허용0·요청 timeout15초·응답1 MiB 제한·코드 실행/패키지 install/binary 다운로드0이다. 실제 수집 오류0이며 미확보4개를 성공으로 채우지 않았다. [proof.json](proof.json)은 원문 경로·고정 URL·byte/hash·metadata와 미확인을 구분한다.

원래 공개 npm 응답은 `/private/tmp/bodyguard-upstream-license.OTqo0Q/evidence`에 보존했다. 저장소 registry JSON은 출처 대조에 필요한 필드만 선택했으며 author/npm 계정 필드는 제외했다. manifest의 `originalResponse` hash/byte는 보존된 실제 응답, 각 registry file hash/byte는 선택 필드 파일이다. LICENSE5개와 공식 tag 응답은 원래 byte다. 이전 inventory·canonical license·실패/아바타 원본은 변경하지 않았다.

```bash
node bodyguard/scripts/license-source-proof.mjs --verify /absolute/checkout/bodyguard/docs/review/upstream-license-evidence
node --test bodyguard/scripts/license-source-proof.test.mjs
node --check bodyguard/scripts/license-source-proof.mjs
git diff --check
```

재수집은 먼저 소유한 임시 parent에 **존재하지 않는** output 디렉터리를 지정한다. `--collect`는 네트워크, `--verify`와 `--publish`는 네트워크 없는 대조/선택 필드 공개다. 이미 존재하는 destination에 덮어쓰지 않는다. 실행 실패 시 새 evidence의 원본/부분 manifest를 보존하고 adoption/완료로 세지 않는다. source lock/version 변경 시 재검증 실패는 정상이며 기존 receipt를 고쳐 통과시키지 않는다.

```bash
node bodyguard/scripts/license-source-proof.mjs --collect /absolute/private-parent/new-proof
node bodyguard/scripts/license-source-proof.mjs --publish /absolute/private-parent/new-proof /absolute/checkout/bodyguard/docs/review/new-proof
```

처음 탐색에서 stats/Biome companion의404와 maath 연결 실패를 실제 관찰했다. 당시 별도 파일은 생성하지 않아 도구 출력과 Story의 시점 기록만 있으며, 이번 성공 원문으로 과거 실패를 덮거나 원본 파일을 보존했다고 주장하지 않는다. 4개의 초기 합성 시험과 실제 수집/오프라인 대조를 분리했다. 최종 하네스에는 소유 복사본 변조/경로 이탈·기존 destination 거부도 포함한다. 최종 검증·리뷰 결과는 아래에 이어 기록한다.

제품 UI/API/동작 gate/SDK 통신 정책·3D/GLB/Blender·package/lock·운영/배포 변경0이다. 전체 FE/SQL/브라우저·Docker/HTTPS·사람·최종 artifact/법무 검증은 이번 범위에서 미실행이다. 현재 public 고지 빌드의 missing-text fail-closed를 우회하지 않았다.

## 작성자 리뷰와 미완료

metadata name/version/license/integrity와 gitHead/repository·직접 tag commit을 대조한다. 별도 gate/법무 승인 flag는 false로 유지한다. 출력 파일은 새 디렉터리와 exclusive write로 보존하며 offline reader는 고정 파일명/URL·byte/hash 및 regular/no-follow·크기를 검사한다. 저장된 manifest 자체는 서명된 SBOM이나 신뢰 앵커가 아니며 offline hash 대조만으로 출처/법적 적합성을 새로 증명하지 않는다.

실제 수집·private 원본 offline 대조·선택 필드 공개·공개 증거 offline 대조가 통과했다. 초기 하네스4개 통과 후 추가 offline 시험2개는 URL.pathname의 한글 percent-encoding 경로 처리 때문에 실패했다. 수정 전 실제 재실행의 `offline-before-path-fix.txt`를 같은 private parent에 보존했다. fileURLToPath로 경로를 해석한 뒤 같은 시험은6개 통과했다. timeout·assertion·출처 조건은 낮추지 않았다. 실패를 실제 upstream 원문 확보 실패로 혼동하지 않는다.

수정 전 보존 로그 SHA256: `75619eb6fe7dca539b50fc8c88cad1193b6249075acdbecbdf9afc32ae99cb73`.

최종6개 통과 로그 `final-tests.txt`의 SHA256은 `d13f76c8c281b1017cef83e81a4e2c5bd664cd2f5131eaefdd1c75da9f98e6f0`이며 같은 private parent에 보존했다. 두 script의 Node 문법 검사·범위 한정 Biome 검사/서식·실제 저장 증거 offline 재검증·staged `git diff --check`가 통과했다. 라이선스 원문의 서식/byte를 고치지 않았다.

작성자 리뷰에서 공개 metadata author 계정 제외, offline 파일명/URL·metadata 대조/no-follow를 보완했다. 문서의 Draco 하위 고지 이름 오기는 실제 원문 하단을 읽고 바로잡았다. Rolldown 원문이 연결하는 [THIRD-PARTY-LICENSE의 같은 commit](https://github.com/rolldown/rolldown/blob/8df421985114ecfaf52cce038d4a5a6ea8c05408/THIRD-PARTY-LICENSE)은 이번 수집 목록에 없으며 미확인이다. 이 미완료를 숨겨 전체 NOTICE 완료로 쓰지 않는다. 변경 범위의 미해결 P1/P2는 없다. 독립 리뷰어 승인이 아닌 작성자 리뷰다.

다음 필수: 미확보4개 출처와 동봉 NOTICE/하위 부품·정확한 실제 배포 artifact에 대응시키기, 웹/패키지 전달과 법무 검토. Docker 연결·별도 개인정보/제품 구조 승인·실제 촬영/판정·아바타 보류를 건너뛰지 않는다. 테스트 수를 출시 진척으로 합산하지 않는다.
