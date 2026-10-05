# 보조 실행 오류 기록

2026-10-05 S5.2. 기능/이미지 검증 완료와 구분한다.

- 최초 Compose parser 명령은 backend에서 잘못된 bodyguard/deploy 상대 경로를 사용해 file not found/exit1이었다. ../deploy/compose.web.yaml로 고친 뒤 native parser를 실제 통과했다. 이것을 runtime 구성의 실패/성공으로 혼동하지 않는다.
- 증거 checksum15개는 실제 OK였지만 이어진 보조 링크 확인에서 README를 test -f 대신 shell source로 지정했다. zsh가 README3행의 Markdown에 대해 no matches found/exit1로 중단했다. 뒤 문서의 실행 예시/컨테이너·DB/운영 작업은 실행하지 않았고 설정을 바꾸지 않았다. 이후 첫 test -f도 backend 기준 상대 경로가 잘못되어 exit1이었다. 정확한 ../deploy/README.md에 대한 test -f를 실제 통과했고 문서는 실행하지 않았다.
- Docker registry 조회의 credential helper 정체/SIGTERM·잘못된 bookworm tag의 not found와 native test의 plugin discovery 오류는 README 및 보존 원본을 따른다. 오류 결과를 삭제하거나 실제 빌드/HTTPS 통과로 바꾸지 않는다.
