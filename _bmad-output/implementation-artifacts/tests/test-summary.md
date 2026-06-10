# 테스트 자동화 요약

## 생성/보강한 테스트

### API Tests
- [x] Story 5.5는 신규 REST/API endpoint가 없다. 월마감 재오픈은 Next.js Server Action과 `closing` domain service가 소유하므로 별도 HTTP API 테스트는 해당 없음.
- [x] `src/modules/closing/monthly-closing-service.test.ts` - 관리자 재오픈 domain flow, 사유 필수/최소 길이, 비잠금 상태 차단, snapshot 없음 차단, `monthly_close.reopened` 감사 로그, audit 실패 rollback, 기존 snapshot 보존, 재확정 `closeVersion` 증가를 검증한다.
- [x] `src/modules/calls/service-call-service.test.ts` - 재오픈 후 `검토중` 운영월에서 지급 영향 write가 다시 허용되는 회귀를 검증한다.
- [x] `src/lib/authorization.test.ts` - `administrator`만 `closing:reopen`을 갖고, `settlement_manager`는 `/closing` 접근 및 `closing:write`는 유지하되 재오픈 권한은 없음을 검증한다.

### E2E Tests
- [x] `tests/e2e/story-5-5-monthly-close-reopen.spec.ts` - administrator가 잠긴 월에서 사유를 입력해 재오픈하고 상태 `검토중`, `이전 확정 스냅샷`, 현재 미리보기, `monthly_close.reopened` audit reason을 확인한다.
- [x] `tests/e2e/story-5-5-monthly-close-reopen.spec.ts` - 재오픈 후 다시 `마감 확정`하면 기존 snapshot은 보존되고 새 `closeVersion 2` snapshot이 생성되는지 확인한다.
- [x] `tests/e2e/story-5-5-monthly-close-reopen.spec.ts` - 빈 사유는 UI 오류로 차단되고 운영월 상태, snapshot metadata/json, `monthly_close.reopened` audit count가 바뀌지 않음을 확인한다.
- [x] `tests/e2e/story-5-5-monthly-close-reopen.spec.ts` - `settlement_manager`는 재오픈 affordance를 보지만 reason field와 submit이 disabled이고 관리자 전용 문구가 보이는지 확인한다.

## Coverage
- API endpoints: 0/0 applicable.
- Domain/unit coverage: reopen transition, invalid reason, invalid status, missing snapshot, audit rollback, audit payload, versioned snapshot lookup/reconfirm, post-reopen payout write, administrator-only permission.
- UI/E2E coverage: administrator happy path, blank reason critical error, disabled non-admin affordance, previous snapshot labeling, reconfirm version creation.
- Critical/negative cases: 사유 필수 무부작용, 비잠금 상태 차단은 domain unit에서 검증, `closing:write`와 `closing:reopen` 분리는 unit/E2E/static validator에서 검증.

## Validation
- [x] `node scripts/validate-story-5-5.mjs` - passed.
- [x] `node --import tsx --test src/lib/authorization.test.ts src/modules/closing/monthly-closing-service.test.ts src/modules/calls/service-call-service.test.ts` - passed 50/50 selected tests.
- [x] `node --import tsx --test $(rg --files src -g '*.test.ts')` - passed 146/146 tests.
- [x] `npm run lint` - passed all story validators through Story 5.5.
- [x] `PLAYWRIGHT_SKIP_WEBSERVER=1 npx playwright test --list tests/e2e/story-5-5-monthly-close-reopen.spec.ts` - listed 3 Story 5.5 Playwright tests.
- [ ] `npx playwright test tests/e2e/story-5-5-monthly-close-reopen.spec.ts --project=chromium-desktop --workers=1` - attempted; web server started, then seed setup failed before browser assertions because Prisma returned `ECONNREFUSED` for `Employee` against `localhost:5432/vietnam_massage`. Direct Prisma probe confirmed the same database connectivity blocker.

## Next Steps
- Rerun the Story 5.5 Playwright spec after the local PostgreSQL database for `DATABASE_URL` is reachable and migrated.
