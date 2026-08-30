# 이전 계획 — Vercel + Neon → Cloudflare Workers + PlanetScale Postgres

> 작성일: 2026-08-28 · 상태: **계획 (0단계 사전 검증 전)** · 현행 운영은 `docs/deployment.md` 참고
> 결론: **Cloudflare Workers + PlanetScale Postgres(싱가포르)** 로 옮긴다. 적용 사양은 PS-5이며 월 $32 → **약 $10 + 스토리지**.
> 단, **0단계 사전 검증을 통과하지 못하면 이 계획을 폐기하고 "차선책" 절의 AWS Lightsail로 간다.**

## 왜 옮기나

2026-08-27 운영 장애가 직접적인 계기다. 객실/TV 현황 화면의 15초 자동 새로고침이 Neon 컴퓨트를
24시간 깨워두는 바람에 Free 티어 한도(프로젝트당 100 CU-시간/월)를 소진했고, Postgres 53000이
나면서 로그인과 전 화면이 실패했다. 같은 날 Neon을 Launch로 전환해 복구했고, 커밋 `a1b621d`로
영업시간·화면 가시성 기반 폴링 중지를 넣었다.

그러나 **요금 구조 자체가 이 앱과 맞지 않는다**는 문제가 남는다.

| | 현행 구조의 성질 |
| --- | --- |
| Vercel Pro | 월 $20 **고정**. 코드를 아무리 최적화해도 이 아래로 못 내려간다. |
| Neon | 질의 횟수가 아니라 **컴퓨트가 깨어 있는 시간**으로 과금($0.106/CU-시간, 최소 0.25 CU). 상시 표시 화면과 상극이다. |

"매장에 현황을 띄워둔다"는 요구사항은 본질적으로 **상시 연결**이다. 종량제 위에서는 이게 그대로
비용이 되지만, 정액제 위에서는 **추가 비용이 0**이다. 그래서 정액제 조합으로 옮긴다.

---

## 후보 비교 (2026-08-28 조사)

모든 후보는 **싱가포르 리전**을 쓸 수 있는 것만 골랐다. 매장이 베트남이고, 콜 원장 저장이
트랜잭션 안에서 DB를 여러 번 왕복하므로 앱·DB가 다른 대륙에 있으면 "엑셀 입력 속도" 요구가 깨진다
(`docs/deployment.md` 핵심 원칙 1).

| 후보 | 월 비용 | 관리형 | 폴링 추가요금 | 비고 |
| --- | --- | --- | --- | --- |
| **Cloudflare Workers + PlanetScale** | **약 $10 + 스토리지** | ✅ | **0** | 선택안(PS-5 적용) |
| AWS Lightsail 1대 (앱+DB 합침) + 자동 스냅샷 | $8 | ❌ | 0 | 차선책. 백업·패치 직접 |
| Hetzner 싱가포르 CPX11 | ~$8.5 | ❌ | 0 | 위와 같은 성격 |
| AWS Lightsail + Lightsail 관리형 Postgres | $22 | ✅ | 0 | AWS의 관리형 최저가 |
| AWS Lambda(OpenNext) + RDS `db.t4g.micro` | ~$18 ~ $20 | ✅ | 낮음 | RDS가 비용을 지배 |
| **현행 (Vercel Pro + Neon)** | **$32** | ✅ | **높음** | 최적화 후에도 $31이 바닥 |

### 세부 계산

**Cloudflare Workers (유료) — $5/월 고정**
- 포함: 요청 1,000만 건, CPU 3,000만 ms. 초과 시 요청 100만당 $0.30, CPU 100만ms당 $0.02.
- 예상 사용: 화면 3대 × 30초 주기 × 영업 16시간 = 하루 5,760건 ≈ **월 17.5만 건(한도의 1.8%)**.
  CPU는 렌더당 50ms로 잡아도 **월 875만 ms(한도의 29%)**.
- → 실사용이 10배로 늘어도 $5에서 안 올라간다.

**PlanetScale Postgres (싱가포르 `ap-southeast-1`) — 적용 PS-5 $5/월 + 스토리지**
- PS-5 $5: 1/16 vCPU, 512MB RAM ← **2026-08-28 사용자 승인으로 적용**
- PS-10은 싱가포르 AWS X86 단일 노드 기준 CLI 확인값 $16: 1/8 vCPU, 1GB RAM
- 스토리지는 별도 과금이다. 첫 달 실제 사용량과 백업/PITR 비용을 확인한다.
- PS-5는 월마감 정산 계산 같은 무거운 작업에 빠듯할 수 있으므로, 원격 검증에서 저장·월마감 지연을 실측하고 느리면 PS-10으로 올린다.

**Hyperdrive (앱↔DB 연결 풀링) — 유료 플랜에 무제한 포함, 추가 $0**

> **적용 합계: 약 $10/월(Workers $5 + PS-5 $5) + PlanetScale 스토리지.**

### AWS를 선택하지 않은 이유

AWS도 진지하게 비교했다. 결론은 **AWS의 관리형 조합이 Cloudflare보다 비싸다**는 것이다.

1. **관리형 Postgres가 비싸다.** AWS의 최저가 관리형 Postgres는 Lightsail 관리형 DB $15/월
   (1GB, 1코어)이고, RDS `db.t4g.micro`도 컴퓨트만 ~$12/월(us-east-1 기준, 싱가포르는 더 비쌈)에
   스토리지·백업이 별도로 붙는다. PlanetScale은 같은 급이 $5~10이다.
2. **Aurora Serverless v2는 논외다.** 최소 용량으로 상시 가동하면 월 $40을 넘긴다. 폴링이 있으면
   scale-to-zero도 못 쓴다.
3. **Lambda로 앱을 돌리면 컴퓨트는 거의 공짜지만**, 결국 RDS 비용이 남아 총액이 $18~20이 된다.
4. **AWS 무료 티어에 기대면 안 된다.** 2025-07-15 이후 만든 계정은 12개월 무료 티어가 없고,
   6개월짜리 크레딧 기반 Free Plan이다. **크레딧이 소진되고 유료 전환을 안 하면 90일 유예 후
   계정이 닫히고 리소스가 삭제된다.** 매장 장부를 올려둘 조건이 아니다.

**AWS가 이기는 유일한 지점은 Lightsail 1대에 앱과 DB를 함께 올리는 $8짜리 구성**인데, 이건
Cloudflare와 성격이 다르다(아래 "차선책" 참고). Cloudflare와 $7 차이로 백업·보안 패치·가동 감시
책임을 떠안는 거래다.

### 차선책 — AWS Lightsail 1대 (0단계 실패 시)

- 싱가포르 리전, $7/월 (1GB RAM, 2 vCPU, 40GB SSD, 2TB 전송).
- 자동 스냅샷 $0.05/GB-월(증분, 최근 7개 보관) → 실사용 10GB 기준 **월 $0.5~1**.
- **합계 약 $8/월.** 앱과 Postgres를 한 대에 Docker로 올린다.
- **코드 수정이 거의 필요 없다.** Node 런타임 그대로라 argon2도 NextAuth v4도 손댈 게 없다.
- 대신 이걸 진다: OS 보안 업데이트, Postgres 업그레이드, 디스크 용량 감시, 장애 대응,
  그리고 **디스크 스냅샷은 트랜잭션 정합 백업이 아니므로 `pg_dump` 야간 크론을 별도로 붙여야 한다.**
- 정산·월마감 기록이 사업상 핵심 기록이므로, 이 경로를 택하면 **복구 테스트를 1회 반드시 수행**한다.

---

## 목표 구조

```
브라우저
   │
   ├─ Cloudflare Workers (앱, OpenNext 어댑터로 빌드한 Next.js 16)
   │     └─ Hyperdrive (연결 풀링)
   │           └─ PlanetScale Postgres (ap-southeast-1 싱가포르)
   │
   └─ GitHub Actions: prisma migrate deploy (배포 파이프라인에서 분리)
```

바뀌지 않는 것: Next.js 16 App Router, Prisma 7 스키마와 마이그레이션 12개, 도메인 로직 전부,
i18n, 테스트, 검증 스크립트.

---

## 걸림돌 3개

### 🔴 걸림돌 1 — `@node-rs/argon2`는 Workers에서 못 돈다 (확정)

`src/modules/masters/account-service.ts`가 쓰는 `@node-rs/argon2`는 Rust를 **Node 네이티브
애드온(`.node`)** 으로 배포한다. Cloudflare는 V8 격리 환경이라 네이티브 애드온을 로드할 수 없고,
Cloudflare는 이를 **앞으로도 지원할 계획이 없다**고 밝혔다. 우회가 아니라 교체가 필요하다.

**대응:** 같은 argon2id를 WebAssembly로 구현한 부품으로 교체한다.

현재 파라미터는 표준값이다:

```
algorithm=argon2id, memoryCost=19456 KiB, timeCost=2, parallelism=1
```

저장된 해시가 **표준 PHC 문자열**(`$argon2id$v=19$m=19456,t=2,p=1$...`)이므로, 같은 표준을 따르는
어떤 구현으로도 그대로 검증된다. → **직원 비밀번호 초기화가 필요 없다.**

**필수 회귀 테스트:** 운영 DB에서 기존 해시 하나를 가져와, 교체한 부품으로 `verify`가 성공하는지
확인하는 테스트를 반드시 추가한다. 이게 통과하지 않으면 전환하지 않는다.

### 🟡 걸림돌 2 — NextAuth v4가 Workers에서 도는지 미검증 (이 계획의 최대 위험)

이 앱은 NextAuth **v4**를 쓴다. v4는 Node 런타임을 전제로 설계됐고, edge/Workers 환경은
Auth.js v5에서 본격 지원됐다. `nodejs_compat`으로 돌 가능성은 있으나 **2026-08-28 시점에
검증되지 않았다.**

**대응:** 0단계에서 이것만 먼저 확인한다. 실패하면 두 갈래다.
- (a) Auth.js v5로 올린다 — 추가 반나절~하루, `src/lib/auth.ts`·`src/types/next-auth.d.ts`·
  `getServerSession` 호출부 전반 수정
- (b) 이 계획을 폐기하고 차선책(Lightsail)으로 간다

### 🟢 걸림돌 3 — Worker 번들 크기 한도 10 MiB (유료 플랜)

Prisma 7의 WASM 쿼리 컴파일러가 번들에 들어간다. 압축 후 크기만 한도에 걸리며, 무료 플랜은 3 MiB라
애초에 불가능하다(유료 $5는 어차피 필요하다). 0단계에서 실측한다.

---

## 이전 절차

### 0단계 — 사전 검증 (반나절, 비용 $0) ⚠️ **게이트**

**여기를 통과하지 못하면 그 아래 단계를 진행하지 않는다.**

최소 재현판을 만들어 Cloudflare 무료 등급에 올리고, 아래 셋만 확인한다.

1. OpenNext Cloudflare 어댑터로 이 앱이 **빌드되는가**, 번들이 10 MiB 안에 들어오는가
2. **WASM argon2가 기존 해시를 검증하는가** (운영 해시 1건으로)
3. **NextAuth v4 자격증명 로그인이 Workers에서 동작하는가**

결과를 이 문서의 "검증 기록" 절에 적는다.

### 1단계 — 비밀번호 부품 교체

- `src/modules/masters/account-service.ts`의 `hash`/`verify` 임포트를 WASM 구현으로 교체
- 파라미터(`m=19456, t=2, p=1`)를 **동일하게** 유지
- 기존 해시 검증 회귀 테스트 추가
- `pnpm test:unit`, `pnpm run lint` 통과 확인
- **이 단계는 Vercel에서도 그대로 동작한다.** 먼저 머지해서 운영에 올려두면, 실제 로그인으로
  검증된 상태에서 이전할 수 있다. (위험 분산)

### 2단계 — OpenNext Cloudflare 어댑터 적용

- 어댑터 설정 추가, `nodejs_compat` 플래그 활성화
- `next.config.ts`의 turbopack 설정과 충돌 없는지 확인
- 로컬에서 프리뷰 구동 확인

### 3단계 — DB 이전 (Neon → PlanetScale 싱가포르)

`docs/deployment.md`의 "기존 DB를 다른 리전으로 이전해야 할 때" 절차를 그대로 쓴다.
2026-06-21에 us-east-1 → 싱가포르 이전에 이미 사용해 검증된 절차다.

1. PlanetScale Postgres 클러스터 생성 — **리전 `ap-southeast-1`(싱가포르), PS-5 단일 노드**
2. 이 변경을 Vercel에 먼저 배포하고, 영업 종료 후 `MAINTENANCE_MODE=read-only`로 재배포해 모든 쓰기 요청이 503으로 차단되는지 확인한다.
3. 활성 저장 작업이 끝난 뒤 최종 `pg_dump`를 시작한다. 덤프 시작부터 도메인 전환 완료까지 쓰기 차단을 유지한다.
4. `pg_restore --no-owner --no-privileges --exit-on-error`로 PlanetScale에 복원한다.
5. `prisma migrate diff`로 스키마 일치 확인하고, 양쪽 핵심 테이블의 row count와 `max(updated_at)`을 비교한다 (FK 이름 차이만 남는 건 무해).
6. Hyperdrive 바인딩 생성 → Worker에 연결
7. `_prisma_migrations` 테이블이 함께 넘어왔는지 확인 (넘어왔다면 baseline 처리 불필요)와 덤프·전환 시각을 기록한다.

> 이전은 **읽기만 하는 덤프**라 원본 Neon은 그대로 남는다. 롤백 자산이 된다.

### 4단계 — 마이그레이션 파이프라인 이동

현재는 `vercel-build`가 `prisma migrate deploy`를 돌린다. Cloudflare 빌드에는 그 단계가 없다.

- GitHub Actions 워크플로에서 설정 검증·OpenNext 빌드·Wrangler dry-run을 먼저 끝내고 배포 artifact를 고정한다
- 사전 빌드가 성공한 경우에만 `prisma migrate deploy`를 실행하고, 성공 후 **동일 artifact**를 배포한다
- `DIRECT_DATABASE_URL`을 GitHub Secrets에 등록
- 마이그레이션이 없을 때 no-op으로 통과하는지 확인
- 스키마 변경은 구버전 Vercel과 새 Worker가 동시에 사용할 수 있는 expand/contract 방식으로 나눈다

### 5단계 — 병행 운영 후 전환

- [x] Cloudflare 임시 주소에서 실제 운영 계정 로그인과 주요 화면 점검
- [x] 최종 쓰기 차단 후 Neon → PlanetScale 복원 및 26개 전체 테이블 row count 일치 확인
- [x] 2026-08-28T08:16:37Z에 Workers 주소 `https://vietnam-massage-erp.boothy-selectroom.workers.dev`를 운영 주소로 전환
- [x] Vercel은 `MAINTENANCE_MODE=read-only`로 유지하고 직접 주소에서도 쓰기를 차단
- [x] Vercel 배포와 Neon 원본은 롤백 자산으로 유지

### 6단계 — 정리 (전환 후 최소 1주 뒤)

> 가장 빠른 정리 가능 시각: **2026-09-04T08:16:37Z**. 그 전에는 삭제하지 않는다.

- [ ] Vercel 프로젝트 `erp_vietnam_massage` 제거
- [ ] Neon 리소스 `erp-vietnam-massage-sg`(`rapid-forest-91070214`) 제거
- ⚠️ **Neon 요금제는 리소스별이 아니라 installation 전체 범위다.** 이 창고를 지워도
  같은 installation의 `neon-cinnabar-horizon`(erp-fish)이 남아 있으면 Launch를 유지해야 한다.
  erp-fish를 Free로 되돌리면 같은 한도 소진 장애가 재발한다.

---

## 롤백 계획

| 시점 | 롤백 방법 | 소요 |
| --- | --- | --- |
| 0~4단계 중 | 아무것도 안 바꾸면 됨. 운영은 Vercel에서 계속 돌고 있다 | 즉시 |
| 5단계 직후 | PlanetScale에 성공한 쓰기가 0건이면 도메인을 Vercel로 되돌리고 쓰기 차단을 해제한다. 1건이라도 있으면 Worker 쓰기 차단 → PlanetScale 변경분을 Neon에 역이전 → 데이터 재검증 후 복귀한다 | 수 분~수 시간 |
| 6단계 이후 | 롤백 불가. **그래서 6단계는 최소 1주 안정 운영 후에만 한다** | — |

**5단계 이후 PlanetScale에 쌓인 데이터는 Neon에 없다.** 전환 직후라도 성공한 쓰기가 한 건이라도 있으면
Cloudflare Worker 쓰기를 먼저 멈추고 PlanetScale 변경분을 Neon으로 역이전해야 한다. 핵심 테이블의
row count와 최종 갱신 시각이 다시 일치한 뒤에만 도메인을 되돌리고 Vercel 쓰기 차단을 해제한다.

---

## 이전 후 점검표

- [x] `/sign-in` 표시 + **기존 비밀번호로** 실제 로그인 성공 (비번 초기화 없이)
- [ ] 콜 원장 행 저장이 빠른가 (앱·DB가 같은 싱가포르 리전)
- [ ] 객실/TV 현황이 30초마다 갱신, 영업시간 외에는 "영업 시간 외 · 자동 갱신 중지" 표시
- [ ] 월마감 미리보기·확정, 대시보드 표시
- [ ] 정산(테라피스트/이어케어/운영) 화면과 지급 처리
- [ ] 감사 로그 기록
- [ ] 한국어/베트남어 전환
- [ ] GitHub Actions에서 `prisma migrate deploy`가 도는가 (빈 마이그레이션에도 통과)
- [ ] 첫 달 실제 청구액이 $10 + 스토리지 근처인가 (아니면 원인 파악)

---

## 조사 근거 (2026-08-28 확인)

가격·정책은 변동된다. 실행 전 재확인할 것.

| 항목 | 확인값 | 출처 |
| --- | --- | --- |
| Cloudflare Workers 유료 | $5/월, 요청 1,000만·CPU 3,000만ms 포함 | [Workers 요금](https://developers.cloudflare.com/workers/platform/pricing/) |
| Hyperdrive | 유료 플랜 무제한 쿼리 포함 | 위와 같음 |
| PlanetScale Postgres | `ap-southeast-1` PS-5 단일 노드 $5, PS-10 AWS X86 단일 노드 $16(CLI 실측). 스토리지 별도 | [PlanetScale Postgres 요금](https://planetscale.com/docs/postgres/pricing) |
| Cloudflare↔PlanetScale 제휴 | Cloudflare 대시보드에서 생성·합산 청구 | [Cloudflare 블로그](https://blog.cloudflare.com/deploy-planetscale-postgres-with-workers/) |
| OpenNext Next.js 16 지원 | 지원됨. Worker 크기 한도 무료 3 MiB / 유료 10 MiB | [OpenNext Cloudflare](https://opennext.js.org/cloudflare) |
| 네이티브 애드온 미지원 | Workers는 `.node` 애드온을 지원하지 않으며 계획도 없음 | [workerd 논의](https://github.com/cloudflare/workerd/discussions/1905) |
| AWS Lightsail | 인스턴스 $5/$7/$12, 관리형 DB 최저 $15 | [Lightsail 요금](https://aws.amazon.com/lightsail/pricing/) |
| Lightsail 스냅샷 | $0.05/GB-월, 증분, 자동 스냅샷 최근 7개 보관 | [Lightsail FAQ](https://aws.amazon.com/lightsail/faq/) |
| AWS 무료 티어 변경 | 2025-07-15 이후 계정은 6개월 크레딧 방식, 소진·미전환 시 계정 종료·리소스 삭제 | [AWS Free Tier 2026 정리](https://infratally.com/articles/aws-free-tier-2026/) |
| Neon 과금 방식 | 컴퓨트 $0.106/CU-시간(최소 0.25 CU), 스토리지 $0.35/GB-월, 자동 절전 60초~1주 설정 | [Neon scale-to-zero](https://neon.com/docs/guides/scale-to-zero-guide) |
| Vercel Pro | 월 $20 고정(1석 + $20 크레딧), Hobby는 비상업 전용 | [Pro 플랜](https://vercel.com/docs/plans/pro-plan) · [Hobby 플랜](https://vercel.com/docs/plans/hobby) |

---

## 검증 기록

> 0단계를 수행한 뒤 결과를 여기에 적는다.

| 항목 | 결과 | 날짜 | 비고 |
| --- | --- | --- | --- |
| OpenNext 빌드 성공 / 번들 크기 | 통과 | 2026-08-28 | OpenNext 1.20.1 빌드 및 Cloudflare 유료 Workers 배포 성공. 원격 gzip 3.565 MiB(10 MiB 이하) |
| WASM argon2가 기존 해시 검증 | 통과 | 2026-08-28 | `@node-rs/argon2` PHC 회귀 fixture를 Node·workerd에서 검증하고, 복사된 운영 계정의 기존 비밀번호로 원격 Worker 로그인 성공 |
| NextAuth v4 Workers 로그인 | 통과 | 2026-08-28 | 원격 Workers + Hyperdrive + PlanetScale에서 자동 Credentials callback·세션 왕복 및 사용자 운영 계정 로그인 성공. 일회성 테스트 계정과 로그인 기록은 삭제함 |
| 초기 Neon → PlanetScale 복원 | 통과 | 2026-08-28 | PS-5 싱가포르에 초기 복원, 핵심 6개 테이블 건수·최종 갱신 시각·12개 migration 기록 일치, `migrate deploy` no-op 확인 |
| 최종 DB 전환 | 통과 | 2026-08-28 | 쓰기 차단 후 최종 덤프·복원, 전체 26개 테이블 건수와 핵심 최종 갱신 시각 일치. PlanetScale 관리용 `hypopg`·named NOT NULL 외 의미상 스키마 동일 |
| 운영 Worker 화면 | 통과 | 2026-08-28 | 로그인, 월간 대시보드, 코스/수당/인센, 직원, 정산, 월마감 표시 확인. 월마감 중복 조회 제거 후 약 20초 내 응답 |
| 롤백 자산 | 유지 중 | 2026-08-28 | Vercel production은 read-only, Neon 원본은 보존. 2026-09-04T08:16:37Z 이전 삭제 금지 |
| PlanetScale 보호 백업 | 통과 | 2026-08-30 | `post-cloudflare-cutover-2026-08-28` (`373d0ssdibqy`), 약 9.8MB, 백업 삭제 방지·`main` 브랜치 삭제 방지 적용, 완료 상태 확인 |

> **게이트 상태: 통과 및 운영 전환 완료.** Workers + PlanetScale가 운영 쓰기를 담당한다.
> Vercel/Neon은 최소 1주 안정화와 이전 후 점검표 완료 전까지 삭제하지 않는다.
