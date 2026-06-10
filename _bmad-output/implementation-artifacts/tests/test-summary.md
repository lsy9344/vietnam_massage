# 테스트 자동화 요약

## 생성/보강한 테스트

### API Tests
- [x] Story 5.2에는 신규 REST/API endpoint가 없다. 월마감 보너스 계산은 read-only `/closing` page와 `listMonthlyClosingPreview()` domain service가 처리하므로 별도 API endpoint 테스트는 해당 없음.
- [x] `src/modules/closing/monthly-closing-preview-service.test.ts` - 만근 source 부재, 19일/20일 기준, 40콜 미만/이상, 1~3위 갯수왕 수당, 대상자 3명 미만, deterministic tie-breaker, 최종지급액/요약 합계 반영을 검증한다.

### E2E Tests
- [x] `tests/e2e/story-5-2-monthly-closing-bonuses.spec.ts` - worker-local/idempotent seed로 정산 담당 계정, 운영월, 코스 정책, 마사지사 수당, 완료 콜 60/45/45/39건 fixture를 생성한다.
- [x] `tests/e2e/story-5-2-monthly-closing-bonuses.spec.ts` - `/closing`에서 만근 인정일, 만근수당, 갯수왕, 갯수왕 수당, 최종지급액 컬럼을 확인한다.
- [x] `tests/e2e/story-5-2-monthly-closing-bonuses.spec.ts` - 갯수왕 1위 5,000,000 VND, 2위 3,000,000 VND, 3위 1,000,000 VND, 40콜 미만 제외, tie-breaker 근거, 마사지사 지급 합계 28,800,000 VND를 확인한다.
- [x] `tests/e2e/story-5-2-monthly-closing-bonuses.spec.ts` - Story 4.1 source 부재가 `source 없음`/`Story 4.1`/`만근 source missing 1`로 표시되는지 확인한다.
- [x] `tests/e2e/story-5-2-monthly-closing-bonuses.spec.ts` - counter와 waiter가 `/closing`에 접근해도 기존 route guard대로 `/calls`, `/rooms`로 redirect되는지 확인한다.

## Coverage
- API endpoints: 0/0 applicable.
- Domain service: Story 5.2 핵심 보너스 산정 규칙 covered by unit tests.
- UI workflows: 2 Story 5.2 Playwright tests discovered: 보너스/근거 표시 happy path, 권한 redirect.
- Critical/negative cases: Story 4.1 source 부재 처리, 40콜 미만 제외, 1~3위 밖 row 미생성, tie-breaker 근거 노출, 최종지급액/요약 합계, no write/no snapshot boundary.

## Validation
- [x] `npm run test:unit -- src/modules/closing/monthly-closing-preview-service.test.ts` - passed 8/8 tests.
- [x] `node scripts/validate-story-5-2.mjs` - passed.
- [x] `npm run lint` - passed all story validators through Story 5.2.
- [x] `PLAYWRIGHT_SKIP_WEBSERVER=1 npx playwright test --list tests/e2e/story-5-2-monthly-closing-bonuses.spec.ts` - listed 2 Story 5.2 Playwright tests.
- [ ] `npm run test:e2e -- tests/e2e/story-5-2-monthly-closing-bonuses.spec.ts` - attempted in final orchestrator verification. Playwright's configured webServer starts and 2 workers launch, but both tests fail before browser assertions at `tests/e2e/story-5-2-monthly-closing-bonuses.spec.ts:67` (`employee.findUnique`).
- [ ] Direct Prisma probe - confirmed the same `ECONNREFUSED` failure on model `Employee`, so the current runtime E2E blocker is database connectivity/configuration, not a Story 5.2 assertion failure.

## Next Steps
- Fix E2E database reachability for the configured `DATABASE_URL`, then rerun `npm run test:e2e -- tests/e2e/story-5-2-monthly-closing-bonuses.spec.ts`.
