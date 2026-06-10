# 테스트 자동화 요약

## 생성/보강한 테스트

### API Tests
- [x] Story 6.3은 신규 REST/API endpoint가 없다. 서버 경계는 `getDashboardGraphReport()` read-only query service 단위 테스트와 static validator로 검증한다.
- [x] `src/modules/dashboard/dashboard-query-service.test.ts` - URL/query 입력 검증, completed-only 매출 추이, A~E 코스 비중, 마사지사 담당/정산 순위, 객실 상태 분포, 노쇼/취소 추이, snapshot missing fallback 금지를 검증한다.

### E2E Tests
- [x] `tests/e2e/story-6-3-graph-report.spec.ts` - administrator, counter, settlement_manager, read_only_viewer의 `/dashboard/reports` 접근과 waiter의 `/rooms` redirect를 검증한다.
- [x] `tests/e2e/story-6-3-graph-report.spec.ts` - worker-local 운영월, 계정, 객실, 마사지사, 코스 정책, 수당, 콜, 지출 seed를 생성한다.
- [x] `tests/e2e/story-6-3-graph-report.spec.ts` - canonical URL search params, out-of-range `serviceDate` 정규화, chart section labels, accessible chart role, table fallback을 검증한다.
- [x] `tests/e2e/story-6-3-graph-report.spec.ts` - 실제 그래프 값으로 방문완료 매출 `1,400,000 VND`, 순매출 `1,100,000 VND`, A/B 코스 비중, 마사지사 evidence 기반 담당 `3건`, 객실 `사용중`/`청소중`, 노쇼/취소 `1건`을 검증한다.
- [x] `tests/e2e/story-6-3-graph-report.spec.ts` - loading skeleton과 safe Korean error/retry copy가 raw `error.message`를 노출하지 않는지 검증한다.

## Coverage
- API endpoints: 0/0 applicable.
- Server/query service features: Story 6.3 graph report DTO 1/1 covered.
- UI features: `/dashboard/reports` access, URL param retention/canonicalization, chart labels, visible numeric labels, table fallback, role access, waiter redirect, loading/error wiring covered.
- Critical success paths: calculated completed calls only revenue basis, A~E course mix, therapist role evidence aggregation by employee, room status DTO display status, no-show/cancel trend.
- Critical error/edge paths: out-of-range service date canonicalization, invalid query unit coverage, snapshot missing without current fallback, safe error boundary.

## Validation
- [x] `node --import tsx --test src/modules/dashboard/dashboard-query-service.test.ts src/lib/authorization.test.ts` - 16 tests passed.
- [x] `node scripts/validate-story-6-3.mjs` - passed.
- [x] `npm run lint` - Story 1.1 through Story 6.3 static validators passed.
- [x] `PLAYWRIGHT_SKIP_WEBSERVER=1 npx playwright test --list tests/e2e/story-6-3-graph-report.spec.ts` - listed 7 tests.
- [ ] `npx playwright test tests/e2e/story-6-3-graph-report.spec.ts` - attempted; sandbox blocked Next dev server bind with `listen EPERM: operation not permitted 127.0.0.1:3000`.

## Next Steps
- Run the Story 6.3 Playwright spec in an environment where the dev server can bind to `127.0.0.1:3000` and the configured PostgreSQL `DATABASE_URL` is reachable/migrated.
