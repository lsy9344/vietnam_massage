# Test Automation Summary

## Generated Tests

### API Tests
- [x] Not applicable for Story 3.3. `/rooms` is a read-only UI surface over the existing `listRoomStatuses()` domain service; no new API endpoint was introduced.

### E2E Tests
- [x] `tests/e2e/story-3-3-rooms-waiter-guidance.spec.ts` - Waiter `/rooms` landing, unauthorized sidebar hiding, 11 room status cards, status label + glyph coverage, guidance text, `사용중` remaining time and expected end, `종료확인` action guidance, `빈방` fallback values, refresh state, read-only guardrails, read-only user access, and waiter direct-route redirects.

## Coverage
- API endpoints: 0/0 applicable for this story.
- UI features: 8/8 Story 3.3 acceptance areas covered by E2E assertions: role landing, sidebar authorization, 11-card room grid, state guidance text, active room timing, `종료확인`, empty room fallback, refresh/stale affordance, and read-only mutation absence.
- Critical error/negative cases: waiter direct access to `/calls`, `/settlements`, and `/masters/rooms` redirects to `/rooms`; call-ledger grid/autosave affordances are absent after clicking a room card.
- Discovered gaps fixed: Story 3.3 E2E fixture no longer depends on fixed `2026-06-09` start times, and fixture employee/code seeds now reserve unique sort orders idempotently instead of assuming fixed Story 3.3 sort orders are always free.

## Validation
- [x] `node scripts/validate-story-3-3.mjs` - passed.
- [x] `npm run test:unit` - passed with 3/3 unit tests.
- [x] `npm run lint` - passed all story validators through Story 3.3.
- [x] `npx playwright test --list tests/e2e/story-3-3-rooms-waiter-guidance.spec.ts` - listed 3 Story 3.3 tests successfully.
- [ ] `npm run test:e2e -- tests/e2e/story-3-3-rooms-waiter-guidance.spec.ts` - not completed in this local environment. Earlier reruns were blocked by Next dev server bind (`listen EPERM`); the final rerun reached Playwright but failed before assertions because Prisma could not connect to the E2E database (`ECONNREFUSED`).

## Next Steps
- Run the focused Playwright command in an environment where the dev server can listen on `127.0.0.1:3000` and `DATABASE_URL` points to a reachable E2E database.
