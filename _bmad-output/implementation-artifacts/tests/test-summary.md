# 테스트 자동화 요약

## 생성/보강한 테스트

### API Tests
- [x] Story 7.1은 신규 REST/API endpoint가 없다. 읽기 전용 route 계약은 `requireRouteAccess("/masters/sheet-mapping")`, `src/lib/authorization.test.ts`, Story 7.1 static validator로 유지한다.

### E2E Tests
- [x] `tests/e2e/story-7-1-sheet-mapping.spec.ts` - source guardrail로 route가 read-only이고 누락 시트 실패 문구, 숨김 `목록`, A:S/U:X 구분, `방문완료`, stable ID 원칙, `StatusBadge` 재사용을 검증한다.
- [x] `tests/e2e/story-7-1-sheet-mapping.spec.ts` - administrator가 `/masters/sheet-mapping`에서 12개 source sheet, 기능 보존율 100%, 숨김 `목록`, 확장된 검증 evidence를 확인하는 workflow를 검증한다.
- [x] `tests/e2e/story-7-1-sheet-mapping.spec.ts` - `read_only_viewer`의 exact route 접근과 `/masters/codes` 차단, `waiter` redirect 및 sidebar 숨김을 검증한다.
- [x] `tests/e2e/story-1-2-auth-rbac.spec.ts` - Story 7.1의 `read_only_viewer` sidebar 기대값을 `시트 기능 매핑표` exact access에 맞게 갱신했다.

## Coverage
- API endpoints: 0/0 applicable.
- Static/domain features: 원본 12개 sheet coverage, hidden `목록`, row별 ERP 연결, 모호한 "이관됨" 방지, mapping summary 100%는 `src/modules/migration/sheet-feature-mapping.test.ts`와 validator로 유지.
- UI features: summary counters, missing-sheet failure copy, table rows, details evidence, status token reuse, read-only affordance, administrator/read-only/waiter route access covered.
- Critical edge paths: hidden sheet omission, A:S/U:X 혼합, non-completed status inclusion, mutable display-name key usage, read_only_viewer `/masters` prefix widening prevention.

## Validation
- [x] `node scripts/validate-story-7-1.mjs` - passed.
- [x] `node --import tsx --test src/modules/migration/sheet-feature-mapping.test.ts src/lib/authorization.test.ts` - 8 tests passed.
- [x] `npm run test:unit` - passed for the repo's current `src/**/*.test.ts` script expansion.
- [x] `npm run lint` - Story 1.1 through Story 7.1 validators passed.
- [x] `PLAYWRIGHT_SKIP_WEBSERVER=1 npx playwright test tests/e2e/story-7-1-sheet-mapping.spec.ts -g "source guardrails"` - 2 static Playwright guard tests passed.
- [x] `PLAYWRIGHT_SKIP_WEBSERVER=1 npx playwright test --list tests/e2e/story-7-1-sheet-mapping.spec.ts` - listed 5 tests.
- [ ] `npx playwright test tests/e2e/story-7-1-sheet-mapping.spec.ts` - attempted; sandbox blocked Next dev server bind with `listen EPERM: operation not permitted 127.0.0.1:3000`.
