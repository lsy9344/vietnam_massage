# 테스트 자동화 요약

## 생성/보강한 테스트

### API Tests
- [x] Story 3.5에는 신규 API endpoint가 없다. `/live`, `/rooms`, `/tv`의 읽기 전용 상태 presentation을 기존 `listRoomStatuses()` 결과로 렌더링하므로 API 테스트는 해당 없음.

### E2E Tests
- [x] `tests/e2e/story-3-5-status-badge-accessibility.spec.ts` - `/live`, `/rooms`, `/tv`에서 5개 상태(`예약`, `사용중`, `청소중`, `종료확인`, `빈방`)의 aria label, visible glyph, text label을 검증한다.
- [x] `tests/e2e/story-3-5-status-badge-accessibility.spec.ts` - `청소중` dark foreground, `빈방` outline/ghost badge 및 card, `종료확인` dark badge와 glow/ring 분리, reduced-motion animation 제거와 warning label/ring 유지, TV typography ramp를 검증한다.
- [x] `tests/e2e/story-3-5-status-badge-accessibility.spec.ts` - 새로 발견한 gap을 보강해 세 표면의 room status card가 버튼/저장/수정/삭제/정산/마감/입력 affordance를 노출하지 않는 read-only 계약을 검증한다.

## Coverage
- API endpoints: 0/0 applicable.
- UI features: 10/10 Story 3.5 acceptance areas covered by E2E/static assertions: locked status tokens, shared `StatusBadge`, label+glyph+color, cleaning contrast pairing, empty outline/ghost, complete-check dark/glow split, reduced-motion safety, slow attention motion contract, TV readability ramp, read-only/no color-only status meaning.
- Critical/negative cases: `청소중` white foreground 금지, `빈방` filled bronze badge/card 금지, `종료확인` glow token 위 텍스트 금지, reduced-motion pulse 제거, route-local status token map 금지, hardcoded `waitForTimeout()` 금지, mutation affordance 금지.
- Discovered gaps fixed: E2E가 `/live`, `/rooms`, `/tv` 전체에서 empty card outline/ghost class를 직접 확인하도록 보강했고, 세 표면의 room cards 내부에 mutation affordance가 없음을 검증하는 read-only regression test를 추가했다.

## Validation
- [x] `node scripts/validate-story-3-5.mjs` - passed.
- [x] `npm run lint` - passed all story validators through Story 3.5.
- [x] `npm run test:unit` - passed 3/3 unit tests.
- [x] `PLAYWRIGHT_SKIP_WEBSERVER=1 npx playwright test --list tests/e2e/story-3-5-status-badge-accessibility.spec.ts` - listed 5 Story 3.5 tests successfully.
- [ ] `npm run test:e2e -- tests/e2e/story-3-5-status-badge-accessibility.spec.ts` - not completed in this local environment because Playwright's configured Next dev server could not bind to `127.0.0.1:3000` (`listen EPERM`), so browser assertions did not run.

## Next Steps
- Run the focused Playwright command in an environment where the Next dev server can listen on `127.0.0.1:3000` and `DATABASE_URL` points to a reachable E2E database.
