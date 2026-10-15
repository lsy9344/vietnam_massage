# 구현 에이전트 공통 지침 (app-expansion 티켓)

사용자에게 한국어로 보고한다. 아래 `NN`은 맡은 티켓 번호, `<slug>`는 티켓 파일 이름의 나머지다.

## 가리키는 곳
- 티켓: `.scratch/app-expansion/issues/NN-<slug>.md`, 그 티켓이 가리키는 명세 부분: `.scratch/app-expansion/spec.md`
- 저장소 지침: `AGENTS.md`, UI는 `design.md` 먼저, 용어 `CONTEXT.md`, `docs/adr/`
- 코드 지도: `/tmp/claude-1000/-home-noah-Desktop-project-dev-busi-vietnam-massage/23205aa0-954f-4b8d-8f40-540951af6a73/scratchpad/notes/codebase-map.md` (untracked ADR 0004·0005와 설계 문서의 절대 경로도 여기 있다)
- 환경·함정 메모(꼭 읽기): `/home/noah/.claude/projects/-home-noah-Desktop-project-dev-busi-vietnam-massage/memory/` 의 `e2e-environment.md`, `e2e-prod-known-failures.md`, `use-client-constant-pitfall.md`, `button-font-inherit-bug.md`
- 선례: 티켓 09–16 파일의 `## Comments`가 결정·가정·검증을 남긴 방식

## 준비
1. 워크트리 `/home/noah/Desktop/project/dev_busi/vietnam_massage-ticketNN`, 브랜치 `feat/ticket-NN-<slug>`를 `integration/app-expansion`에서 만든다:
   `git -C /home/noah/Desktop/project/dev_busi/vietnam_massage worktree add -b feat/ticket-NN-<slug> /home/noah/Desktop/project/dev_busi/vietnam_massage-ticketNN integration/app-expansion`
   이미 있으면 `git merge-base --is-ancestor integration/app-expansion HEAD`로 확인하고, 아니면 통합 브랜치로 reset한다.
2. `pnpm install --frozen-lockfile --prefer-offline`, `npx prisma generate`

## 구현
- Skill 도구로 `mattpocock-skills:tdd`를 불러 그 방식으로 티켓을 만든다.
- 새 Prisma 마이그레이션 이름은 다른 병렬 티켓과 겹치지 않게 `20261016NN0000_<설명>`처럼 티켓 번호를 넣는다.
- 요청 범위만 고친다. 다른 티켓 범위로 보이는 일은 하지 않고 보고에 적는다.

## 검증
- `npx tsc --noEmit`, `pnpm test:unit`, `pnpm build`.
- 검증 스크립트: `pnpm lint`는 `&&` 사슬이라 기존 실패인 4-6에서 멈추고 5-1~7-3은 돌지 않는다. 대신 `for f in scripts/validate-story-*.mjs; do node "$f" >/dev/null 2>&1 || echo "FAIL $f"; done`로 모두 돌려서 4-6 말고는 실패가 없어야 한다. 고친 코드가 스크립트의 글자 검사에 걸리면 새 규칙에 맞게 스크립트를 고친다.
- E2E는 운영 빌드로, 컨테이너 `vietnam-shell-02-e2e`(127.0.0.1:3450)에 **자기 DB `vietnam_aesthetic_tNN`**을 만들고 **포트 31NN**(예: 티켓 27 → 3127)으로 띄운다. DROP/CREATE는 자기 DB에만. 띄운 서버 PID만 끈다.
- 다른 에이전트가 동시에 돌고 메모리가 빠듯하다(23GB, 스왑 사용 중). 전체 E2E는 돌리지 말고, 새 스펙과 고친 화면에 걸린 스펙만 돌린다. 브라우저 워커는 2개 이하.
- 실패가 나오면 메모의 기존 실패 목록과 비교하고, 확신이 없으면 통합 브랜치 기준으로 재현해 가린다.

## 마무리
- 티켓 파일의 체크박스를 채우고 `**Status:** done`으로 바꾸고, `## Comments`에 날짜·결정·가정·검증 결과를 남긴다(09–16 방식).
- 커밋 메시지는 `git log`의 한국어 형식을 따르고, 끝에는 네 시스템 안내가 주는 `Co-Authored-By` 줄(네 실제 모델)을 붙인다.
- 보고 직전에 `git merge integration/app-expansion`으로 통합 브랜치 끝을 자기 브랜치에 합친다. 무언가 합쳐졌으면 충돌을 풀고 tsc와 단위 테스트를 다시 돌린다.

## 금지
- push 금지. `main`, 메인 폴더(`vietnam_massage`), 다른 워크트리를 건드리지 않는다. 통합 브랜치에 직접 합치지 않는다(병합 담당이 따로 있다).

## 보고(짧게)
브랜치, 끝 커밋, 결정·가정, 검증 결과(실패와 기존 여부), 뒤 티켓에 넘길 것.
