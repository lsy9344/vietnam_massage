# 테스트 자동화 요약

## 생성/보강한 테스트

### API Tests
- [x] Story 5.1에는 신규 REST/API endpoint가 없다. 월마감 미리보기는 read-only page와 `listMonthlyClosingPreview()` domain service가 처리하므로 별도 API endpoint 테스트는 해당 없음.
- [x] `src/modules/closing/monthly-closing-preview-service.test.ts` - 운영월 날짜 범위 순회, 활성 마사지사 zero-call row 보존, 마사지사 월 총콜/정산액, 운영팀 일일/월 인센 merge, 귀케어 지급/미분배 집계, 전체 지급 합계, warning propagation, locked/current-preview label, invalid input/domain error를 검증한다.

### E2E Tests
- [x] `tests/e2e/story-5-1-monthly-closing-preview.spec.ts` - 정산 담당자가 `/closing`에서 운영월 날짜 범위, 미확정 미리보기 label, summary 지급액, 마사지사 row, 귀케어 row, evidence/warning counts, Story 5.2 보너스 대기 상태, read-only boundary를 확인하는 흐름을 검증한다.
- [x] `tests/e2e/story-5-1-monthly-closing-preview.spec.ts` - 운영월 selector로 잠금 운영월을 선택하면 같은 route가 새 운영월 기준으로 재조회되고 현재 기준 미리보기 안내가 표시되는지 검증한다.
- [x] `tests/e2e/story-5-1-monthly-closing-preview.spec.ts` - administrator가 잠금 운영월을 볼 때 확정 스냅샷 값이 아니라 현재 기준 미리보기임을 분리 표시하는지 검증한다.
- [x] `tests/e2e/story-5-1-monthly-closing-preview.spec.ts` - counter, waiter, read-only 계정의 `/closing` direct access가 기존 route access 정책대로 redirect되는지 검증한다.
- [x] `tests/e2e/story-5-1-monthly-closing-preview.spec.ts` - `fullyParallel: true`에서 worker별 fixture data를 분리하고 shared `CodeItem`/`TimeSlot` upsert는 sortOrder 예약 및 unique-race retry로 병렬/반복 실행 idempotency를 보강했다.

## Coverage
- API endpoints: 0/0 applicable.
- Domain service: Story 5.1 핵심 집계 규칙 covered by unit tests.
- UI workflows: 4 Story 5.1 Playwright tests discovered: preview happy path, 운영월 selector reload, locked/current-preview 안내, 권한 redirect.
- Critical/negative cases: 비완료 콜 제외 count, 귀케어 정상근무자 0명/미분배 warning, Story 5.2 보너스 미적용 경계, read-only/no write action boundary, 권한 없는 route 접근, invalid input/domain errors.

## Validation
- [x] `npm run test:unit -- src/modules/closing/monthly-closing-preview-service.test.ts` - passed 6/6 executed tests in this environment after Story 5.1 E2E fixture review fix.
- [x] `node --import tsx --test $(rg --files src | rg '\.test\.ts$')` - passed 116/116 co-located unit tests after senior review fixes.
- [x] `npm run lint` - passed all story validators through Story 5.1 after fixture review fix.
- [x] `PLAYWRIGHT_SKIP_WEBSERVER=1 npx playwright test --list tests/e2e/story-5-1-monthly-closing-preview.spec.ts` - listed 4 Story 5.1 Playwright tests successfully after fixture review fix.
- [ ] `npm run test:e2e -- tests/e2e/story-5-1-monthly-closing-preview.spec.ts` - attempted after fixture review cycle 2. Playwright's configured webServer starts and 4 workers launch, but all tests fail before browser assertions at `tests/e2e/story-5-1-monthly-closing-preview.spec.ts:70` (`codeItem.findUnique`) with Prisma `ECONNREFUSED` on model `CodeItem`.
- [ ] Direct Prisma probe - confirmed the same `ECONNREFUSED` failure on model `CodeItem`, so the current runtime E2E blocker is database connectivity/configuration, not the previous `CodeItem` upsert/sortOrder race.
- [ ] `npx tsc --noEmit --pretty false` - attempted, but project-wide pre-existing TypeScript errors remain outside Story 5.1 (`call-ledger-keyboard.test.ts`, Prisma ambient enum under `isolatedModules`, older E2E `getByDisplayValue` usage). No Story 5.1 changed file appeared in the reported errors.

## Next Steps
- Fix E2E database reachability for the configured `DATABASE_URL`, then rerun `npm run test:e2e -- tests/e2e/story-5-1-monthly-closing-preview.spec.ts`.
