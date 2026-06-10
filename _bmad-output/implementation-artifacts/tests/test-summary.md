# 테스트 자동화 요약

## 생성/보강한 테스트

### API Tests
- [x] Story 6.1은 신규 REST/API endpoint가 없다. 서버 경계는 `getTodayDashboardMetrics()` read-only query service 단위 테스트로 검증한다.
- [x] `src/modules/dashboard/dashboard-query-service.test.ts` - 예약/방문완료/노쇼/취소 상태 수, calculated 완료 콜 기준 금액, 마사지사1/2 담당콜, 같은 마사지사 이중 역할, A~E 코스 완료, warning propagation을 검증한다.
- [x] `src/modules/dashboard/dashboard-query-service.test.ts` - 운영월 범위 밖 날짜, 잘못된 날짜 형식, 없는 운영월을 한국어 domain error로 검증한다.
- [x] `src/modules/dashboard/dashboard-query-service.test.ts` - 콜이 없는 날짜의 0값 KPI와 `"이 날짜의 콜이 없습니다."` empty state를 검증한다.

### E2E Tests
- [x] `tests/e2e/story-6-1-today-dashboard.spec.ts` - administrator, counter, settlement_manager, read_only_viewer의 `/dashboard/today` 접근과 waiter의 `/rooms` redirect를 검증한다.
- [x] `tests/e2e/story-6-1-today-dashboard.spec.ts` - 운영월/조회날짜 조건에서 상태 KPI, 금액 KPI, 코스별 완료, 마사지사 담당콜/정산 요약, warning alert를 검증한다.
- [x] `tests/e2e/story-6-1-today-dashboard.spec.ts` - 조회날짜 변경이 URL search params를 갱신하고 서버 데이터 기준 empty state로 바뀌는 흐름을 검증한다.
- [x] `tests/e2e/story-6-1-today-dashboard.spec.ts` - 데이터 없는 날짜 empty state와 콜 원장 이동 affordance를 검증한다.
- [x] `tests/e2e/story-6-1-today-dashboard.spec.ts` - loading skeleton과 retry/error affordance wiring을 정적 검증한다.

## Coverage
- API endpoints: 0/0 applicable.
- Server/query service features: Story 6.1 today dashboard DTO 1/1 covered.
- UI features: `/dashboard/today` access, date selection, KPI display, course summary, therapist summary, warning, empty state, loading/error wiring covered.
- Critical success paths: 조회날짜 기준 재계산, URL search params update, calculated completed calls only amount basis, therapist1/2 담당콜 aggregation.
- Critical error/edge paths: invalid query, missing operating month, out-of-range date, no-call date, waiter route redirect.

## Validation
- [x] `node --import tsx --test src/modules/dashboard/dashboard-query-service.test.ts` - 5 tests passed.
- [x] `node scripts/validate-story-6-1.mjs` - passed.
- [x] `PLAYWRIGHT_SKIP_WEBSERVER=1 npx playwright test --list tests/e2e/story-6-1-today-dashboard.spec.ts` - listed 9 tests.
- [x] `npm run lint` - Story 1.1 through Story 6.1 static validators passed.
- [x] `npm run test:unit` - passed, but local shell glob only executed 5 tests in 2 suites.
- [x] `node --import tsx --test $(rg --files src | rg '\.test\.ts$')` - 151 tests / 20 suites passed.
- [x] `git diff --check` - passed.
- [ ] `npx playwright test tests/e2e/story-6-1-today-dashboard.spec.ts` - attempted; the Next webServer started, then seed setup stopped because Prisma returned `ECONNREFUSED` on `Employee`. A direct Prisma probe against `DATABASE_URL` reproduced `code: "ECONNREFUSED"` for `employee.findUnique()`/`employee.findFirst()`.

## Next Steps
- Run the Story 6.1 Playwright spec after the PostgreSQL database for `DATABASE_URL` is reachable and migrated.
