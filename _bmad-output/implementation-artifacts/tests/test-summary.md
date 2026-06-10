# 테스트 자동화 요약

## 생성/보강한 테스트

### API Tests
- [x] Story 5.4는 신규 REST/API endpoint가 없다. 월마감 잠금은 Next.js Server Action과 `closing` domain service가 소유하므로 별도 HTTP API 테스트는 해당 없음.
- [x] `src/modules/closing/monthly-closing-service.test.ts` - 확정 후 잠금, 확정 전 잠금 차단, 중복 잠금 차단, snapshot 없음 차단, `monthly_close.locked` audit payload, audit 실패 rollback, persisted snapshot 조회를 검증한다.
- [x] `src/modules/closing/month-lock-guard.test.ts` - `마감확정`과 `잠금`을 지급 영향 write lock 상태로 판정하고 `OPERATING_MONTH_LOCKED`로 매핑되는지 검증한다.
- [x] `src/modules/calls/service-call-service.test.ts` - 콜 저장/autosave와 일별 지출 mutation이 `마감확정` 또는 `잠금` 운영월에서 차단되는지 검증한다.
- [x] `src/modules/settlements/earcare-attendance-service.test.ts` 및 `src/modules/settlements/ops-attendance-service.test.ts` - 근무상태 mutation 차단, read-only flag, transaction 내부 재검사를 검증한다.
- [x] `src/modules/masters/course-service.test.ts` - 코스 정책, 마사지사 수당, 운영팀 인센 정책 range가 확정/잠금 운영월과 겹치면 차단되는지 검증한다.

### E2E Tests
- [x] `tests/e2e/story-5-4-monthly-close-lock.spec.ts` - administrator가 `/closing`에서 마감확정 월을 잠금으로 전환하고 `확정 스냅샷`과 `monthly_close.locked` audit payload를 확인한다.
- [x] `tests/e2e/story-5-4-monthly-close-lock.spec.ts` - counter가 잠금 월 `/calls`에서 콜 행 추가와 일별 지출 추가 control이 disabled/read-only로 표시되는지 확인한다.
- [x] `tests/e2e/story-5-4-monthly-close-lock.spec.ts` - UI disabled와 별도로 실제 `createDailyExpense()` write mutation이 `OPERATING_MONTH_LOCKED`로 실패하는지 확인한다.
- [x] `tests/e2e/story-5-4-monthly-close-lock.spec.ts` - settlement_manager가 별도 마감확정 월을 잠금 처리하고 audit actor가 정산 담당 계정으로 남는지 확인한다.
- [x] E2E seed 보강 - test별 별도 운영월을 사용해 병렬 실행 순서 의존을 제거했고, audit cleanup 범위를 해당 운영월/스냅샷 target으로 제한했다.

## Coverage
- API endpoints: 0/0 applicable.
- Domain/unit coverage: lock transition, invalid transitions, duplicate lock, snapshot missing, rollback, audit payload, payout-impacting write guards, read-only DTO flags, policy range guard.
- UI/E2E coverage: administrator lock flow, settlement_manager lock flow, locked calls UI read-only signal, locked daily expense UI disabled state, persisted snapshot visibility.
- Critical/negative cases: confirmed-before-lock requirement, duplicate lock no-audit, unauthorized roles covered by `requirePermission("closing:write")` static validator and existing route guard tests, server-side `OPERATING_MONTH_LOCKED` write blocking.

## Validation
- [x] `node scripts/validate-story-5-4.mjs` - passed.
- [x] `npm run test:unit -- src/modules/closing/monthly-closing-service.test.ts src/modules/closing/month-lock-guard.test.ts src/modules/calls/service-call-service.test.ts src/modules/settlements/earcare-attendance-service.test.ts src/modules/settlements/ops-attendance-service.test.ts src/modules/masters/course-service.test.ts` - passed 70/70 selected tests.
- [x] `node --import tsx --test $(rg --files src -g '*.test.ts')` - passed 136/136 tests.
- [x] `npm run lint` - passed all story validators through Story 5.4.
- [x] `PLAYWRIGHT_SKIP_WEBSERVER=1 npx playwright test --list tests/e2e/story-5-4-monthly-close-lock.spec.ts` - listed 3 Story 5.4 Playwright tests.
- [ ] `npx playwright test tests/e2e/story-5-4-monthly-close-lock.spec.ts --project=chromium-desktop --workers=1` - attempted; web server started, then seed setup failed before browser assertions because Prisma returned `ECONNREFUSED` for `Employee` against `localhost:5432/vietnam_massage`. Direct Prisma probe confirmed the same database connectivity blocker.

## Next Steps
- Rerun the Story 5.4 Playwright spec after the local PostgreSQL database for `DATABASE_URL` is reachable and migrated.
