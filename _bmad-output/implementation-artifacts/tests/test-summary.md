# 테스트 자동화 요약

## 생성/보강한 테스트

### API Tests
- [x] Story 5.3은 신규 REST/API endpoint가 없다. 월마감 mutation은 Next.js Server Action과 `closing` domain service가 소유하므로 별도 HTTP API 테스트는 해당 없음.
- [x] `src/modules/closing/monthly-closing-service.test.ts` - 작성중→검토중, 검토중→마감확정, 중복/invalid 확정 차단, audit 실패 transaction rollback, persisted snapshot 조회, snapshot missing error를 검증한다.

### E2E Tests
- [x] `tests/e2e/story-5-3-monthly-close-confirmation.spec.ts` - administrator가 `/closing?operatingMonthId=...`에서 검토 시작과 마감 확정을 수행하고 `확정 스냅샷`과 `현재 기준 미리보기`를 확인한다.
- [x] `tests/e2e/story-5-3-monthly-close-confirmation.spec.ts` - UI 확정 후 DB의 운영월 상태, `MonthlyClosing` 1건 저장, snapshot JSON의 actor/status/source/totals, `operating_month.status_changed`와 `monthly_close.confirmed` audit payload를 확인한다.
- [x] `tests/e2e/story-5-3-monthly-close-confirmation.spec.ts` - 마감확정 후 버튼 disabled와 스냅샷 1건 유지로 중복 확정 부작용이 없는지 확인한다.
- [x] `tests/e2e/story-5-3-monthly-close-confirmation.spec.ts` - settlement_manager가 검토중 운영월을 확정하고 snapshot confirmed actor가 정산 담당 계정으로 저장되는지 확인한다.
- [x] `tests/e2e/story-5-3-monthly-close-confirmation.spec.ts` - counter, waiter, read_only_viewer가 `/closing` 직접 접근 시 기존 route guard에 따라 `/calls`, `/rooms`로 redirect되는지 확인한다.

## Coverage
- API endpoints: 0/0 applicable.
- Domain service: 8 Story 5.3 unit tests cover state transitions, duplicate/invalid errors, transaction rollback, DB unique-constraint race rollback, invalid snapshot JSON rollback, audit payload, and persisted snapshot retrieval.
- UI workflows: 3 Story 5.3 Playwright tests cover administrator flow, settlement_manager flow, restricted-role redirects.
- Critical/negative cases: duplicate confirm guard, no extra snapshot after reload, unauthorized route access, audit payload, transaction rollback via unit test, current preview vs confirmed snapshot labels.

## Validation
- [x] `npm run test:unit -- src/modules/closing/monthly-closing-service.test.ts` - passed 11/11 tests reported by Node test runner for the selected invocation.
- [x] `node scripts/validate-story-5-3.mjs` - passed.
- [x] `npm run lint` - passed all story validators through Story 5.3.
- [x] `npx prisma validate` - schema valid.
- [x] `node --import tsx --test $(rg --files src -g '*.test.ts')` - passed 126/126 tests.
- [x] `PLAYWRIGHT_SKIP_WEBSERVER=1 npx playwright test --list tests/e2e/story-5-3-monthly-close-confirmation.spec.ts` - listed 3 Story 5.3 Playwright tests.
- [ ] `npx playwright test tests/e2e/story-5-3-monthly-close-confirmation.spec.ts --project=chromium-desktop --workers=1` - attempted; web server started, then seed setup failed before browser assertions because Prisma returned `ECONNREFUSED` for `Employee` against `localhost:5432/vietnam_massage`. Direct Prisma probe confirmed the same database connectivity blocker.

## Next Steps
- Rerun the Story 5.3 Playwright spec after the local PostgreSQL database for `DATABASE_URL` is reachable and migrated.
