# 테스트 자동화 요약

## 생성/보강한 테스트

### API Tests
- [x] Story 6.4는 신규 REST/API endpoint가 없다. 대시보드 query service 계약은 기존 `src/modules/dashboard/dashboard-query-service.test.ts`와 Story 6.4 static validator로 유지한다.

### E2E Tests
- [x] `tests/e2e/story-6-4-dashboard-states-and-colors.spec.ts` - today/monthly/reports loading skeleton, `aria-busy`, safe Korean error boundary, retry/refresh affordance, raw `error.message`/stack 미노출을 검증한다.
- [x] `tests/e2e/story-6-4-dashboard-states-and-colors.spec.ts` - `/dashboard/reports` chart source가 non-status series에 `bg-brand`, `bg-danger`, `var(--color-brand)`, `var(--color-danger)`를 유지하고 `bg-status-*`/`var(--color-status-*)`를 쓰지 않는지 검증한다.
- [x] `tests/e2e/story-6-4-dashboard-states-and-colors.spec.ts` - worker-local 계정과 운영월 seed로 today no-call empty, monthly/reports snapshot missing, current payout fallback 금지, reports 정산 source 없음 상태를 브라우저에서 검증한다.
- [x] `tests/e2e/story-6-4-dashboard-states-and-colors.spec.ts` - waiter의 `/dashboard/today`, `/dashboard/monthly`, `/dashboard/reports` direct access가 `/rooms`로 redirect되고 dashboard nav가 숨겨지는지 검증한다.
- [x] `tests/e2e/story-6-4-dashboard-states-and-colors.spec.ts` - counter, settlement_manager, read_only_viewer의 `/dashboard/reports` 접근 회귀를 검증한다.

## Coverage
- API endpoints: 0/0 applicable.
- Server/query service features: dashboard read-only query DTO 기존 단위 테스트로 유지.
- UI features: loading, safe error, no-call empty, snapshot missing, settlement source missing, status color 의미 보존, legend/table fallback source markers, route access covered.
- Critical edge paths: raw server error exposure prevention, fake 0값 success graph prevention, current preview/snapshot mixing prevention, waiter dashboard redirect.

## Validation
- [x] `node scripts/validate-story-6-4.mjs` - passed.
- [x] `node --import tsx --test src/modules/dashboard/dashboard-query-service.test.ts src/lib/authorization.test.ts` - 16 tests passed.
- [x] `npm run lint` - Story 1.1 through Story 6.4 static validators passed.
- [x] `PLAYWRIGHT_SKIP_WEBSERVER=1 npx playwright test tests/e2e/story-6-4-dashboard-states-and-colors.spec.ts -g "source guardrails"` - 2 static Playwright guard tests passed.
- [x] `PLAYWRIGHT_SKIP_WEBSERVER=1 npx playwright test --list tests/e2e/story-6-4-dashboard-states-and-colors.spec.ts` - listed 10 tests.
- [ ] `npx playwright test tests/e2e/story-6-4-dashboard-states-and-colors.spec.ts` - attempted; sandbox blocked Next dev server bind with `listen EPERM: operation not permitted 127.0.0.1:3000`.
