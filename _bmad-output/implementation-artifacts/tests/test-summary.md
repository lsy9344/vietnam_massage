# Test Automation Summary

## Generated Tests

### API Tests
- [x] `src/modules/calls/service-call-service.test.ts` - `getDailyCallLedgerSummary()` includes `inUseCount` and `cleaningCount` from call-ledger statuses, while preserving visit-complete-only financial summaries.

### E2E Tests
- [x] `tests/e2e/story-3-2-live-status.spec.ts` - Administrator login lands on `/live`, and `/live` renders 11 room cards, status badges with glyphs, `종료확인` action labeling, exact status summary counts, exact VND KPIs, course completion count, refresh state, and read-only guardrails.

## Coverage
- API/domain service paths: Story 3.2 summary DTO extension covered for reservation, in-use, cleaning, completed, no-show, canceled, payment total, net sales, warning counts, and course summaries.
- UI features: `/live` first screen covered for login landing, room card grid, `RoomStatusDto` card output, status label + glyph, `결제·확인 필요`, today status summary, payment/net-sales KPIs, course completion summary, last-refresh state, and absence of call-ledger mutation UI.
- Critical cases: active `사용중` and expired `사용중 -> 종료확인` are both seeded; read-only UI is checked by asserting no call grid/autosave affordances appear.
- Review fix: Story 3.2 E2E now reuses the default 11 room master rows instead of creating 11 extra active rooms, so the 11-card assertion matches the `/live` active-room contract.

## Validation
- [x] `node scripts/validate-story-3-2.mjs` - passed.
- [x] `npm run test:unit` - passed with the repository's configured unit command.
- [x] `npm run lint` - passed all story validators through Story 3.2.
- [x] `npx playwright test --list tests/e2e/story-3-2-live-status.spec.ts` - listed 2 tests successfully.
- [ ] `npm run test:e2e -- tests/e2e/story-3-2-live-status.spec.ts` - blocked in this sandbox because Next dev server cannot bind `127.0.0.1:3000` (`listen EPERM`).
- [x] Review rerun: `node --import tsx --test $(find src -name '*.test.ts' -print | sort)` - passed 81 tests after review fixes.

## Next Steps
- Run the focused Playwright command in an environment where the dev server can listen on `127.0.0.1:3000` and `DATABASE_URL` points to the E2E database.
