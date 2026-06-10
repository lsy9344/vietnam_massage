# 테스트 자동화 요약

## 생성/보강한 테스트

### API Tests
- [x] Story 5.6은 신규 REST/API endpoint가 없다. 월마감 확정은 기존 Next.js Server Action `confirmMonthlyCloseAction`과 closing domain service를 재사용하므로 별도 HTTP API 테스트는 해당 없음.
- [x] 기존 `src/modules/closing/monthly-closing-service.test.ts`가 확정 상태 전이, snapshot 생성, audit rollback 등 domain/API에 준하는 서버 경계를 계속 검증한다.

### E2E Tests
- [x] `tests/e2e/story-5-6-monthly-close-confirm-dialog.spec.ts` - 첫 `마감 확정` 클릭이 즉시 제출하지 않고 `role="alertdialog"` 모달을 여는지 검증한다.
- [x] `tests/e2e/story-5-6-monthly-close-confirm-dialog.spec.ts` - 운영월, 전체 지급 합계, 마사지사/운영팀/귀케어 지급 합계와 인원 수, 운영팀 일일/월 인센, warning count, 스냅샷 불변 경고를 검증한다.
- [x] `tests/e2e/story-5-6-monthly-close-confirm-dialog.spec.ts` - `Esc` 취소와 `취소` 버튼이 snapshot/audit 부작용 없이 닫히고 focus를 trigger로 돌려주는지 검증한다.
- [x] `tests/e2e/story-5-6-monthly-close-confirm-dialog.spec.ts` - safe initial focus, destructive button non-initial focus, focus trap, `aria-labelledby`/`aria-describedby` 연결을 검증한다.
- [x] `tests/e2e/story-5-6-monthly-close-confirm-dialog.spec.ts` - 두 번째 확인에서만 확정되어 `마감확정`, 최신 `확정 스냅샷`, `잠금`, `monthly_close.confirmed` audit이 생성되는지 검증한다.
- [x] `tests/e2e/story-5-6-monthly-close-confirm-dialog.spec.ts` - stale 상태 전이 실패 시 한국어 `role="alert"` 오류가 보이고 snapshot/audit 부작용이 없음을 검증한다.
- [x] `tests/e2e/story-5-3-monthly-close-confirmation.spec.ts` - 기존 Story 5.3 확정 흐름을 이중확인 모달 기반으로 갱신했다.
- [x] `tests/e2e/story-5-5-monthly-close-reopen.spec.ts` - 재오픈 후 재확정(closeVersion 2) 흐름도 이중확인 모달을 거치도록 갱신했다.

## Coverage
- API endpoints: 0/0 applicable.
- UI features: Story 5.6 confirm dialog 1/1 covered.
- Critical success paths: 모달 열림, 즉시 제출 방지, 두 번째 확인 확정, Story 5.3/5.5 호환.
- Critical error/cancel paths: `Esc` 취소, `취소` 버튼, stale transition failure.
- Accessibility contract: alertdialog role, title/description labeling, safe initial focus, focus trap, focus return.

## Validation
- [x] `node scripts/validate-story-5-6.mjs` - passed.
- [x] `PLAYWRIGHT_SKIP_WEBSERVER=1 npx playwright test --list tests/e2e/story-5-6-monthly-close-confirm-dialog.spec.ts tests/e2e/story-5-3-monthly-close-confirmation.spec.ts tests/e2e/story-5-5-monthly-close-reopen.spec.ts` - listed 10 tests.
- [ ] `npx playwright test tests/e2e/story-5-6-monthly-close-confirm-dialog.spec.ts tests/e2e/story-5-3-monthly-close-confirmation.spec.ts tests/e2e/story-5-5-monthly-close-reopen.spec.ts` - attempted during final verification; the Next web server started, then seed setup stopped because Prisma returned `ECONNREFUSED` on `Employee`. A direct Prisma probe against `DATABASE_URL` confirmed the same `ECONNREFUSED` database connectivity blocker.

## Next Steps
- Run the three Story 5.3/5.5/5.6 Playwright specs after the PostgreSQL database for `DATABASE_URL` is reachable and migrated.
