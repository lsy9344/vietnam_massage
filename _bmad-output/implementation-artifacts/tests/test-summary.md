# 테스트 자동화 요약

## 생성/보강한 테스트

### API Tests
- [x] Story 6.2는 신규 REST/API endpoint가 없다. 서버 경계는 `getMonthlyDashboardMetrics()` read-only query service 단위 테스트로 검증한다.
- [x] `src/modules/dashboard/dashboard-query-service.test.ts` - 운영월 날짜 범위 누적, completed calculated 콜만 금액/코스 집계 포함, warning accumulation, current source, closed snapshot source, snapshot missing, reopened `검토중` previous snapshot 분리, invalid input을 검증한다.

### E2E Tests
- [x] `tests/e2e/story-6-2-monthly-dashboard.spec.ts` - administrator, counter, settlement_manager, read_only_viewer의 `/dashboard/monthly` 접근과 waiter의 `/rooms` redirect를 검증한다.
- [x] `tests/e2e/story-6-2-monthly-dashboard.spec.ts` - 확정 월의 canonical URL search params, `확정 스냅샷 기준`, `closeVersion`, snapshot 기반 지급 합계를 검증한다.
- [x] `tests/e2e/story-6-2-monthly-dashboard.spec.ts` - 운영월 선택 변경이 URL search params와 서버 데이터 기준 KPI를 갱신하는지 검증한다.
- [x] `tests/e2e/story-6-2-monthly-dashboard.spec.ts` - 작성중 월의 월 전체 날짜 범위 current KPI, 방문완료 매출, 순매출, 코스별 완료, warning state를 검증한다.
- [x] `tests/e2e/story-6-2-monthly-dashboard.spec.ts` - 재오픈 `검토중` 월의 `미확정 현재 기준`과 `이전 확정 스냅샷` 분리 표시를 검증한다.
- [x] `tests/e2e/story-6-2-monthly-dashboard.spec.ts` - 잠금 월 snapshot missing 상태가 current 지급값으로 fallback하지 않는지 검증한다.
- [x] `tests/e2e/story-6-2-monthly-dashboard.spec.ts` - loading skeleton과 safe retry/error affordance wiring을 정적 검증한다.

## Coverage
- API endpoints: 0/0 applicable.
- Server/query service features: Story 6.2 monthly dashboard DTO 1/1 covered.
- UI features: `/dashboard/monthly` access, operating month selection, URL search param retention, KPI display, course summary, sourceBasis labels, closed snapshot, snapshot missing, reopened previous snapshot, warning, loading/error wiring covered.
- Critical success paths: 운영월 날짜 범위 집계, calculated completed calls only amount basis, current recalculation, latest closing snapshot payout source.
- Critical error/edge paths: invalid query, missing snapshot without fallback, no-call month, warning-excluded rows, waiter route redirect.

## Validation
- [x] `node --import tsx --test src/modules/dashboard/dashboard-query-service.test.ts` - 10 tests passed.
- [x] `node scripts/validate-story-6-2.mjs` - passed.
- [x] `npm run lint` - Story 1.1 through Story 6.2 static validators passed.
- [x] `node --import tsx --test $(rg --files src | rg '\.test\.ts$')` - 156 tests / 21 suites passed.
- [x] `PLAYWRIGHT_SKIP_WEBSERVER=1 npx playwright test --list tests/e2e/story-6-2-monthly-dashboard.spec.ts` - listed 11 tests.
- [ ] `npx playwright test tests/e2e/story-6-2-monthly-dashboard.spec.ts` - attempted; latest retry started the web server but failed during worker seed setup because Prisma returned `code: "ECONNREFUSED"` for `Employee.findUnique`. A direct Prisma probe reproduced `ECONNREFUSED` with `meta.modelName: "Employee"`.

## Next Steps
- Run the Story 6.2 Playwright spec in an environment where the PostgreSQL `DATABASE_URL` is reachable/migrated.
