# 자체 러너 CI

이 저장소의 CI와 Cloudflare 배포는 `[self-hosted, Linux, X64, erp-dabi-linux]` 러너에서만 실행한다. `pull_request`가 다른 저장소에서 온 경우에는 작업을 건너뛰어, 외부 기여자의 코드를 사내 러너에서 실행하지 않는다.

각 작업은 `actions/checkout`의 `clean: true`로 작업 폴더를 비운 뒤 `pnpm install --frozen-lockfile`을 다시 실행한다. pnpm의 콘텐츠 저장소만 다음 경로에 남긴다.

```text
$RUNNER_TOOL_CACHE/package-stores/<repository>/<os>-<arch>/<pr|trusted>/pnpm
```

작업 폴더의 `node_modules`는 재사용하지 않는다. `setup-node`의 GitHub 패키지 캐시도 끄므로, 자체 러너의 로컬 콘텐츠 저장소에 있는 패키지는 재사용하고 없는 패키지만 다운로드한다. `pr`과 `trusted` 저장소를 나누어 신뢰 경계를 유지한다. 설치 로그에는 실제 store 경로도 출력한다.

모든 설치는 `--frozen-lockfile`, `--verify-store-integrity`, `--side-effects-cache=false`를 함께 사용한다. 잠금 파일을 바꾸지 않고 저장소 파일의 무결성을 확인하며, 설치 결과물 캐시는 남기지 않는다.

Playwright 작업은 기존 Docker 컨테이너와 Postgres 서비스를 그대로 사용한다. GitHub Actions Runner는 컨테이너 작업을 시작할 때 러너 도구 폴더를 컨테이너의 `/__t`에 자동으로 연결하므로 별도 volume을 추가하지 않는다. 근거: [ContainerOperationProvider.cs](https://github.com/actions/runner/blob/main/src/Runner.Worker/ContainerOperationProvider.cs#L293-L308)와 [ContainerInfo.cs](https://github.com/actions/runner/blob/main/src/Runner.Worker/Container/ContainerInfo.cs#L45-L56).

워크플로를 바꾼 뒤에는 저장소 루트에서 다음 검사를 실행한다.

```bash
actionlint -config-file .github/actionlint.yaml .github/workflows/*.yml
```
