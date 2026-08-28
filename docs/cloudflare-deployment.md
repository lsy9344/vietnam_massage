# Cloudflare Workers + PlanetScale Postgres 배포 가이드

> 전환 계획과 게이트는 `docs/plans/2026-08-28-cloudflare-migration-plan.md`를 따른다.
> 0단계 검증이 모두 통과하기 전에는 운영 DB와 도메인을 전환하지 않는다.

## 1. 로컬 사전 검증

```bash
pnpm install --frozen-lockfile
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/vietnam_aesthetic" \
DIRECT_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/vietnam_aesthetic" \
NEXTAUTH_SECRET="로컬-테스트용-32자-이상-값" \
NEXTAUTH_URL="http://127.0.0.1:8787" \
pnpm cf:build

pnpm cf:preview
```

- `pnpm cf:build`는 `.open-next/`에 Worker 번들을 만든다.
- 실제 진입점은 `cloudflare-worker.ts`다. 이 파일이 Argon2 WASM을 Cloudflare 방식으로 먼저 불러온 뒤 OpenNext handler를 실행한다.
- `pg-cloudflare`는 OpenNext 파일 추적 누락을 막기 위해 직접 의존성으로 고정돼 있다.
- `pnpm exec wrangler deploy --dry-run` 출력의 gzip 크기가 유료 Workers 한도 10 MiB 이하인지 확인한다.
- `src/lib/password-hash.test.ts`의 고정 PHC 값은 테스트 전용이며 운영 해시가 아니다.
- 운영 전환 전에는 운영 DB의 기존 해시 1건을 **값을 출력하지 않는 일회성 검증**으로 확인한다.

## 2. 리소스 생성

1. Cloudflare Workers 유료 플랜을 활성화한다.
2. PlanetScale Postgres를 `ap-southeast-1`, PS-5 단일 노드로 만든다. 월마감 실측이 느리면 PS-10으로 올린다.
3. Cloudflare 대시보드의 **Hyperdrive → Create configuration**에서 PlanetScale 직접 연결 정보를 입력한다.
4. 생성된 ID를 GitHub의 `CLOUDFLARE_HYPERDRIVE_ID` Variable에 등록한다. 저장소의 `wrangler.jsonc` placeholder는 CI가 배포 시 교체한다.

연결 문자열을 CLI 인수로 넣으면 셸 기록이나 프로세스 목록에 노출될 수 있으므로 대시보드 입력을 우선한다. 연결 문자열과 비밀번호는 문서, Git, 셸 히스토리, CI 로그에 남기지 않는다.

## 3. Worker 런타임 값 등록

```bash
pnpm exec wrangler secret put NEXTAUTH_SECRET
pnpm exec wrangler secret put NEXTAUTH_URL
```

`NEXTAUTH_SECRET`은 가능하면 기존 운영 값을 유지한다. Vercel sensitive 값처럼 회수할 수 없으면 새 값을 생성하며, 전환 시 기존 세션이 한 번 만료되어 재로그인이 필요하다. 도메인 전환 시 `NEXTAUTH_URL`을 최종 HTTPS 주소로 갱신한다.

## 4. GitHub Actions 설정

`.github/workflows/deploy-cloudflare.yml`은 `main` 푸시 시 다음 순서를 강제한다.

1. 설정 검증, OpenNext 빌드, Wrangler dry-run 후 배포 artifact 고정
2. 앞 단계가 성공한 경우에만 `prisma migrate deploy`
3. 마이그레이션 성공 후 1단계에서 만든 **동일 artifact**를 Cloudflare에 배포

스키마 변경은 이전 Vercel과 새 Worker가 모두 처리할 수 있는 expand/contract 방식으로 나눈다. 먼저 호환되는 컬럼·테이블을 추가하고, 구버전 코드가 사라진 뒤 별도 배포에서 삭제한다.

GitHub repository에 등록할 값:

| 종류 | 이름 | 값 |
| --- | --- | --- |
| Secret | `DIRECT_DATABASE_URL` | PlanetScale 직접 연결 문자열 |
| Secret | `CLOUDFLARE_API_TOKEN` | Workers 배포 권한 토큰 |
| Secret | `CLOUDFLARE_ACCOUNT_ID` | Cloudflare 계정 ID |
| Secret | `NEXTAUTH_SECRET` | Worker에 등록한 값과 동일 |
| Variable | `CLOUDFLARE_HYPERDRIVE_ID` | 32자 Hyperdrive ID |
| Variable | `NEXTAUTH_URL` | 임시 Worker 주소, 전환 후 최종 도메인 |

마이그레이션이 없으면 `prisma migrate deploy`는 no-op으로 성공한다. 사전 빌드나 마이그레이션이 실패하면 Worker 배포는 시작되지 않는다.

## 5. DB 이전

매장 영업 종료 후 **점검 시간**을 공지하고 아래 순서를 지킨다.

1. 이 변경을 Vercel에도 먼저 배포한다.
2. Vercel에 `MAINTENANCE_MODE=read-only`를 설정해 재배포하고, 저장 요청이 503으로 차단되는지 확인한다.
3. 활성 사용자의 저장 작업이 끝났는지 확인한 뒤 최종 덤프를 시작한다. 이때부터 도메인 전환 완료까지 쓰기 차단을 유지한다.
4. 비밀번호는 숨김 입력과 일시 환경변수로만 전달한다.

```bash
read -rsp "Neon DB password: " PGPASSWORD; echo; export PGPASSWORD
PGHOST="<Neon host>" PGPORT=5432 PGUSER="<Neon user>" \
PGDATABASE="<database>" PGSSLMODE=require \
pg_dump -Fc --no-owner --no-privileges -f erp.dump
unset PGPASSWORD

read -rsp "PlanetScale DB password: " PGPASSWORD; echo; export PGPASSWORD
PGHOST="<PlanetScale host>" PGPORT=5432 PGUSER="<PlanetScale user>" \
PGDATABASE="<database>" PGSSLMODE=require \
pg_restore --no-owner --no-privileges --exit-on-error -d "$PGDATABASE" erp.dump
unset PGPASSWORD

read -rsp "PlanetScale Direct URL: " DIRECT_DATABASE_URL; echo
export DIRECT_DATABASE_URL
pnpm exec prisma migrate deploy
unset DIRECT_DATABASE_URL
```

- `_prisma_migrations` 테이블이 복원됐는지 확인한다.
- `prisma migrate diff`로 스키마를 비교한다.
- 양쪽 DB의 핵심 테이블별 row count와 `max(updated_at)`을 비교하고, 덤프 시작·도메인 전환 시각을 기록한다.
- 원본 Neon과 Vercel 배포는 최소 1주 동안 삭제하지 않는다.

## 6. 전환과 롤백

1. 임시 Worker 주소에서 기존 계정 로그인과 전 화면을 점검한다. Smart Placement가 싱가포르 DB 가까이 실행되는지 저장·월마감 지연도 측정한다.
2. 데이터 비교가 일치하면 도메인을 Cloudflare로 전환한다.
3. Vercel은 롤백 보존 기간 내내 `MAINTENANCE_MODE=read-only`를 유지한다. 직접 Vercel 주소에서도 쓰기를 허용하지 않는다.
4. 전환 후 PlanetScale에 성공한 쓰기가 **한 건도 없음을 확인한 경우에만** 도메인을 바로 Vercel로 되돌리고 쓰기 차단을 해제할 수 있다.
5. 성공한 쓰기가 한 건이라도 있으면 먼저 Cloudflare Worker도 `MAINTENANCE_MODE=read-only`로 바꿔 쓰기를 멈춘다. PlanetScale 변경분을 Neon으로 역이전하고 핵심 테이블 row count와 최종 갱신 시각을 다시 맞춘 뒤에만 도메인을 되돌리고 Vercel 쓰기 차단을 해제한다.

전환 후 점검표와 최종 삭제 조건은 이전 계획 문서를 그대로 사용한다.
