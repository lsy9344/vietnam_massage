# Test Automation Summary

## Generated Tests

### API Tests
- [x] N/A - Story 2.2 exposes Server Actions/domain services, not public API endpoints.

### E2E Tests
- [x] `tests/e2e/story-2-2-call-ledger-autosave.spec.ts` - 기존 콜 행 blur autosave, 저장 상태 표시, 상태 변경 이력, 감사 로그, 실패 보류와 retry, 잠금 read-only, 권한 차단.

### Static Regression Tests
- [x] `scripts/validate-story-2-2.mjs` - status-history schema, autosave schema/service/action/UI, audit action names, E2E file, docs/project-context contract.

## Coverage
- API endpoints: N/A
- Server Action/domain boundary: covered through UI autosave scenarios plus DB assertions.
- UI features: 5/5 Story 2.2 E2E targets specified.
  - 기존 행 blur commit 저장과 `저장됨` 표시
  - 상태 변경 이력 `ServiceCallStatusHistory` 저장
  - `service_call.status_changed` / `service_call.row_changed` 감사 로그
  - 검증 실패 시 `저장 보류`, 입력 유지, inline retry
  - 잠금 운영월 read-only와 권한 상실 autosave 차단

## Validation Results

- `node scripts/validate-story-2-2.mjs` failed by design against the current implementation, exposing non-test gaps:
  - `src/app/(erp)/calls/actions.ts` does not yet export `autosaveServiceCallRowAction` wired to `serviceCallAutosaveInputSchema`, `autosaveServiceCallRow`, and `actorId: account.id`.
  - `src/app/(erp)/calls/editable-call-grid.tsx` still renders existing rows read-only and does not yet expose autosave state (`idle/saving/saved/error`), `저장중`, `저장 보류`, retry, `onBlur`, `serviceCallId`, locked-row disabling, or `aria-live`.
- `npm run lint` failed at the new Story 2.2 validator for the same implementation gaps. Story 1.1 through Story 2.1 validators passed before that point.
- `npm run test:unit -- src/modules/calls/service-call-service.test.ts` failed before test execution because local dependencies are missing: package `tsx` could not be found.
- `npm run build` failed before compilation because local dependencies are missing: `next: command not found`.
- `npm run test:e2e -- tests/e2e/story-2-2-call-ledger-autosave.spec.ts` failed before Playwright startup because local dependencies are missing: `playwright: command not found`.

## Checklist Validation

- [x] API tests generated if applicable: not applicable.
- [x] E2E tests generated if UI exists.
- [x] Tests use standard Playwright APIs.
- [x] Tests cover happy path.
- [x] Tests cover critical error cases: failed autosave/retry, locked month, permission loss.
- [ ] All generated tests run successfully: blocked by missing local dependencies and current autosave UI/action implementation gaps.
- [x] Tests use semantic locators.
- [x] Tests have clear descriptions.
- [x] No hardcoded waits or sleeps.
- [x] Tests are independent outside file-level serial DB fixture setup.
- [x] Test summary created.
- [x] Tests saved to appropriate directories.
- [x] Summary includes coverage metrics.

## Next Steps

- Implement the missing Story 2.2 autosave Server Action and editable grid state/retry UI.
- Install project dependencies from the lockfile.
- Rerun `npm run lint`, `npm run test:unit -- src/modules/calls/service-call-service.test.ts`, `npm run build`, and `npm run test:e2e -- tests/e2e/story-2-2-call-ledger-autosave.spec.ts`.
