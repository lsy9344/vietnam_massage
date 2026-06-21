# 배포 가이드 — Vercel + Neon

> 확정일: 2026-06-21 · 운영 환경 프로비저닝·검증 완료일: 2026-06-21
> 스택: Next.js 16 (App Router, Node 런타임) · PostgreSQL 17(Neon) · Prisma 7 (`@prisma/adapter-pg` + `pg` 8) · NextAuth v4 · pnpm
> 플랫폼: **Vercel**(앱, 리전 `sin1`) + **Neon**(DB, AWS `ap-southeast-1`, PostgreSQL 17)

이 문서는 단일 매장 운영 ERP를 Vercel + Neon에 배포하는 절차다.
아키텍처 결정 근거는 `_bmad-output/planning-artifacts/architecture.md`의 "Infrastructure & Deployment" 참고.
**현재 운영 환경의 실제 리소스 ID·적용 스택은 같은 문서의 "As-provisioned record (2026-06-21)" 표에 기록**돼 있다.

## 현재 운영 환경 (2026-06-21 적용 완료)

| 항목 | 값 |
| --- | --- |
| Vercel 프로젝트 | `erp_vietnam_massage` (`prj_Clxkks3vDpagQLiFk4PNISPEh0L6`), 팀 `noah's projects` |
| 앱 리전 | `sin1` (싱가포르) |
| 빌드 커맨드 | `pnpm run vercel-build` (Vercel 프로젝트 설정에 적용됨) |
| DB | Neon `erp-vietnam-massage-sg` (Neon id `rapid-forest-91070214`, Vercel store `store_E2eQztb7zw0uI5Wb`) |
| DB 리전 / 엔진 | AWS `ap-southeast-1` (싱가포르) / PostgreSQL 17 |
| 운영 도메인 | https://erpvietnammassage.vercel.app |
| 적용 마이그레이션 | 12/12 |

> 아래 1~6단계는 **백지 상태에서의 신규 구축 절차**다. 위 환경은 이미 이 절차로 구축·검증돼 있으므로, 일상 운영은 "이후 배포" 절을 따른다.

## 핵심 원칙 (먼저 읽을 것)

1. **앱과 DB는 같은 리전(싱가포르)에 둔다.** 콜 원장 저장은 트랜잭션 안에서 DB를 여러 번 왕복하므로, 앱(Vercel)과 DB(Neon)가 다른 대륙에 있으면 행 저장이 느려져 "엑셀 입력 속도" 요구사항이 깨진다.
2. **Neon은 연결 문자열이 2개다.**
   - **Pooled** → 런타임 앱이 사용 (`DATABASE_URL`)
   - **Direct** → `prisma migrate deploy`가 사용 (`DIRECT_DATABASE_URL`). 마이그레이션은 pooler 위에서 돌면 안 된다.
3. **Vercel은 Pro 플랜**을 쓴다. Hobby(무료)는 비상업적 용도로 제한되며 이 ERP는 상업적 운영이다.
4. **Neon은 Launch 티어 + 항상 켜기**를 쓴다. 15초 폴링이 DB를 깨워두므로 Free 티어의 100 CU-시간/월 한도를 며칠 만에 소진한다.

---

## 1단계 — Neon 프로젝트 생성

> **중요 — 이 조직은 Vercel-managed다.** Neon 콘솔/`neonctl`/Neon API로는 프로젝트를 **직접 생성할 수 없다** (`organization is managed by Vercel` 오류). 반드시 Vercel 마켓플레이스 통합으로 DB를 만든다. 아래 (A) 대시보드 또는 (B) API 중 택1.

**(A) Vercel 대시보드 (권장, 가장 단순)**

1. Vercel 프로젝트 → **Storage → Create Database → Neon**.
2. **Region: `Singapore (ap-southeast-1)` / `sin1`** 선택. (이게 가장 중요)
3. 생성 후 Neon 콘솔에서 플랜을 **Launch**로 올리고, 컴퓨트는 **Autosuspend 끔(항상 켜기)** 으로 설정.

**(B) CLI/API로 리전 고정 생성 (자동화·재현용)**

> `vercel integration add neon --non-interactive`는 **리전을 무시하고 `us-east-1`로 기본 생성**한다. 싱가포르를 고정하려면 마켓플레이스 auto-provision API를 직접 호출한다:
>
> ```bash
> TOKEN=...   # Vercel CLI 토큰 (~/.../com.vercel.cli/auth.json)
> TEAM=team_fGZaevoOIWwaUq9Nlstf7QpO
> curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
>   "https://api.vercel.com/v1/integrations/integration/neon/marketplace/auto-provision/neon?teamId=$TEAM" \
>   -d '{"name":"erp-vietnam-massage-sg","metadata":{"region":"sin1","auth":false}}'
> ```
>
> 허용 리전 enum: `cle1, iad1, pdx1, fra1, lhr1, syd1, sin1, gru1`. 생성 후 Neon 콘솔에서 Launch + Autosuspend off는 동일하게 수동 설정.

**연결 문자열 확보 (공통):** 생성된 DB에서 두 문자열을 얻는다 (Vercel Storage 화면 또는 `neonctl connection-string <project-id> --org-id <org> [--pooled]`):
   - **Pooled connection** (호스트에 `-pooler` 포함) → `DATABASE_URL`
   - **Direct connection** (`-pooler` 없음) → `DIRECT_DATABASE_URL`
   - 둘 다 끝에 `?sslmode=require`가 있는지 확인.

## 2단계 — Vercel 프로젝트 생성 및 GitHub 연결

1. https://vercel.com 에서 **Add New → Project** → 이 GitHub 저장소를 import.
2. Framework Preset은 자동으로 **Next.js**로 인식된다.
3. 리포의 `vercel.json`이 `regions: ["sin1"]`(싱가포르 고정)과 `buildCommand: pnpm run vercel-build`(= `prisma generate && prisma migrate deploy && next build`)를 지정한다.
   - ⚠️ **Vercel 프로젝트의 Build Command 설정이 `vercel.json`보다 우선한다.** Settings → Build & Development Settings에서 Build Command가 비어있거나(프레임워크 기본=`next build`) 다른 값이면 마이그레이션이 빌드 때 안 돈다. **반드시 `pnpm run vercel-build`로 설정**할 것. (이번 운영 환경의 최초 구축이 `next build`로 돼 있어 스키마 미적용 문제가 있었음 — As-provisioned record 참고.)
4. 플랜이 **Pro**인지 확인 (팀/프로젝트 설정).

## 3단계 — 환경변수 등록 (Vercel)

Vercel 프로젝트 → Settings → Environment Variables. **Production**(필요시 Preview도)에 등록:

| 변수 | 값 |
| --- | --- |
| `DATABASE_URL` | Neon **Pooled** 문자열 (`...-pooler.ap-southeast-1.aws.neon.tech/...?sslmode=require`) |
| `DIRECT_DATABASE_URL` | Neon **Direct** 문자열 (pooler 없음, `...?sslmode=require`) |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` 로 새로 생성한 값 (로컬과 다른 고유값) |
| `NEXTAUTH_URL` | 배포 도메인. 1차 배포 후 정해진 `https://<프로젝트>.vercel.app`, 커스텀 도메인이 있으면 그 주소 |

> `NEXTAUTH_URL`은 도메인이 확정된 뒤 값을 채우고 재배포해야 로그인 콜백이 정상 동작한다.

> **참고 (실제 적용 방식):** 환경변수는 Neon–Vercel 통합이 자동 주입하는 `POSTGRES_*`/`PG*` 16개에 의존하지 않고, 앱이 실제로 읽는 `DATABASE_URL`/`DIRECT_DATABASE_URL`만 **명시적으로 등록**했다. 이 4개 변수는 Vercel에 `type: sensitive`로 저장되어 **API/`vercel env pull`로 값이 다시 읽히지 않는다**(정상 동작이며 보안상 의도된 것). 값 확인은 빌드 로그(아래 4단계)로 한다.
> CLI로 등록 시: `printf '%s' "<문자열>" | vercel env add DATABASE_URL production`.

## 4단계 — 첫 배포

0. **`prisma/migrations/migration_lock.toml`이 커밋돼 있는지 확인.** 없으면 `prisma migrate deploy`가 커넥터를 못 정해 실패한다. 내용은 `provider = "postgresql"` 한 줄.
1. `main` 브랜치에 푸시하거나 Vercel 대시보드/`vercel deploy --prod`로 **Deploy**.
2. 빌드 로그에서 `prisma migrate deploy`가 실행되어 Neon에 스키마가 적용되는지 확인한다.
   - 로그에 `Datasource "db": ... ap-southeast-1.aws.neon.tech` (싱가포르 호스트)와 `migrations ... applied`(빈 DB) 또는 `No pending migrations to apply.`(이미 적용된 DB)가 보이면 정상.
   - 빈 DB이면 커밋된 마이그레이션이 순서대로 적용된다 (P3005 없음).
3. 빌드 성공 후 배포 URL 접속 → 로그인 화면(`/sign-in`)이 뜨는지 확인.

## 5단계 — 운영 계정/기준 데이터 (최초 1회)

> ⚠️ **현재 운영 DB(`erp-vietnam-massage-sg`)에는 이미 실데이터가 들어있다** (2026-06-21에 기존 us-east-1 DB에서 `pg_dump`/`pg_restore`로 계정·마스터·운영 데이터 일체를 이전함). 따라서 **재시드하지 말 것** — `seed-dev-accounts.ts`는 개발용 기본 비밀번호로 계정을 upsert하므로 운영 계정 비번을 덮어쓴다(보안 위험).

**완전히 빈 DB로 신규 구축하는 경우에만** 아래를 1회 실행한다 (시드는 자동이 아님):

```bash
# 운영 Neon Direct 문자열을 임시로 환경에 주입해 실행 (셸 히스토리에 남지 않게 주의)
DATABASE_URL="<Neon Direct 문자열>" pnpm exec tsx scripts/seed-dev-accounts.ts
DATABASE_URL="<Neon Direct 문자열>" pnpm exec tsx scripts/seed-master-data.ts
```

> `seed-dev-accounts.ts`는 개발용 계정을 만든다. 실제 운영이라면 시드 후 기본 비밀번호를 바꾸거나, 운영용 관리자 계정 생성 절차를 별도로 따른다. 두 스크립트는 upsert(멱등)라 반복 실행해도 중복은 안 쌓이지만, **계정 비번 덮어쓰기**는 주의.

### 기존 DB를 다른 리전으로 이전해야 할 때 (참고)

2026-06-21 us-east-1 → 싱가포르 이전에 쓴 절차:

```bash
# PostgreSQL 17 클라이언트가 없으면 docker postgres:17 이미지 사용
# 1) 덤프 (소스는 읽기만 함)
pg_dump "<소스 Direct 문자열>" -Fc --no-owner --no-privileges -f erp.dump
# 2) 복원 (대상 Direct 문자열)
pg_restore --no-owner --no-privileges --exit-on-error -d "<대상 Direct 문자열>" erp.dump
# 3) 소스가 마이그레이션 기록(_prisma_migrations) 없이 db push로 만들어졌거나 스키마가 뒤처졌다면:
#    이미 반영된 마이그레이션을 baseline 처리 후 나머지만 적용
DIRECT_DATABASE_URL="<대상>" pnpm exec prisma migrate resolve --applied <이미_반영된_마이그레이션_이름>   # 반영된 것마다
DIRECT_DATABASE_URL="<대상>" pnpm exec prisma migrate deploy                                            # 나머지 적용
# 4) prisma migrate diff 로 스키마 일치 확인 (FK 이름 차이만 남는 건 무해)
```

## 6단계 — 배포 후 점검

- [x] `/sign-in` 200 + 로그인 화면 표시 (2026-06-21 확인)
- [x] 런타임이 싱가포르 DB(pooled)로 계정 조회 성공 (2026-06-21 확인)
- [ ] `/sign-in` 실제 로그인 동작 (이전된 운영 계정으로)
- [ ] 콜 원장에서 행 저장이 빠른지 (앱·DB가 같은 싱가포르 리전이면 즉각 반응)
- [ ] 객실/TV 현황이 15초마다 갱신되는지
- [ ] 월마감 미리보기/대시보드가 뜨는지
- [ ] (운영자) Neon `erp-vietnam-massage-sg`를 **Launch + Autosuspend off**로 올렸는지
- [ ] (운영자) Vercel 플랜이 **Pro**인지

---

## 이후 배포 (일상 운영)

- `main`에 머지/푸시하면 Vercel이 자동 빌드·배포하며, `vercel-build`가 새 마이그레이션을 `migrate deploy`로 적용한다.
- **마이그레이션 주의:** 새 스키마 변경은 반드시 로컬에서 `prisma migrate dev`로 마이그레이션 파일을 생성·커밋한 뒤 머지한다. 운영에는 절대 `migrate dev`를 돌리지 않는다 (빌드는 `migrate deploy`만 사용).

## 백업/복구 (운영 전 확정 필요)

- 월마감 스냅샷·감사 로그는 사업상 핵심 기록이다. Neon 콘솔에서 **백업 보존기간(PITR window)** 을 운영 정책에 맞게 설정하고, 복구 테스트를 1회 수행한다.
- Neon은 시점 복구(point-in-time restore)를 제공한다 — 플랜별 보존기간을 확인할 것.

## 비용 요약 (2026-06 기준, 단일 매장)

| 항목 | 플랜 | 예상 월 비용 |
| --- | --- | --- |
| Vercel | Pro | ~$20 (포함 크레딧 내에서 대부분 커버) |
| Neon | Launch (항상 켜기, 최소 컴퓨트) | ~$5–15 (종량제) |
| **합계** | | **~$25–35/월** |

가격·리전·플랜 정책은 변동될 수 있으므로 https://vercel.com/pricing 와 https://neon.com/pricing 에서 최종 확인할 것.
