# 실제 dependency 연결 실패

Stage6 전용 작업트리에서 기존 설치를 symlink로 재사용한 첫 format 명령과 첫 registered runner 실행은 pnpm12 bootstrap의 다음 오류로 exit1이었다.

```text
Lockfile is up to date, resolution step is skipped
Already up to date
Error: installing dependencies
workspace hoist directory is not a real directory
```

두 web case는 아직 실행되지 않았다. runner의 자체 HTTP/시험 DB 준비 후 subprocess가 실패했고 기존 finally로 자체 서버를 종료했다. 이를 실제 Chrome 두 흐름 실패나 통과로 세지 않는다. runner 밖 format은 Ruff만 진행됐고 Biome/diff check는 그 명령에서 실행되지 않았다.

원래 설치·source 브랜치는 clean으로 보존했다. 새 작업트리의 소유 symlink는 private evidence에 이동해 보존하고 기존 설치의 clone 복사본을 사용한다. 새 package/model 다운로드·버전/lock·원본·운영 설정은 변경하지 않는다. 이 기록은 실제 도구 출력 요약이며 raw browser report가 아니다.
