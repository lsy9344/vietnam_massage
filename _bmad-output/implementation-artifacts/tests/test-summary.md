# 테스트 자동화 요약

## 생성/보강된 테스트

### API Tests
- 해당 없음: Story 1.8은 별도 HTTP API endpoint가 아니라 Server Action과 도메인 서비스로 구현되어 unit/static validation과 E2E workflow로 검증한다.

### E2E Tests
- [x] `tests/e2e/story-1-8-courses-policies.spec.ts` - administrator 코스/수당/인센 화면 happy path, 기본 A~E 코스, D코스 마사지사2 필요 정책, 0원 수당, 일/월 인센 threshold, stable Course.id/code 보존, 정책 변경 감사 로그 UI 확인
- [x] `tests/e2e/story-1-8-courses-policies.spec.ts` - 적용 종료월이 시작월보다 빠른 코스 정책 오류와 월 인센 분배율 합계 오류의 한국어 메시지 확인
- [x] `tests/e2e/story-1-8-courses-policies.spec.ts` - non-admin direct route 차단과 sidebar 항목 숨김 확인

## Coverage
- Story 1.8 AC: unit tests, static validator, E2E 조합으로 AC 1-9 covering
- 기본 seed: 코스 A~E, D코스 2인 필요, 마사지사 1~4 A/B/C 수당, 마사지사 5~50 0원 수당, 운영팀 일/월 인센 seed covered
- 정책 이력/lookup: effective-month lookup, overlap 차단, stable Course.id/code 보존 covered
- 감사 로그: course, course_policy, therapist_course_rate, ops incentive audit events covered by unit/static validation; `course.policy_changed`는 E2E에서 감사 로그 화면까지 확인
- Critical error cases: 코스 정책 월 범위 오류, 월 인센 분배율 합계 오류 covered
- 권한 경계: administrator + non-admin counter/waiter covered

## Validation
- [x] `npm run lint` passed Story 1.1 through Story 1.8 static validation.
- [ ] `npm run test:unit` attempted, but local dependencies are not installed: `Cannot find package 'tsx'`.
- [ ] `npm run build` attempted, but local dependencies are not installed: `next: command not found`.
- [ ] `npm run test:e2e -- tests/e2e/story-1-8-courses-policies.spec.ts` attempted, but local dependencies are not installed: `playwright: command not found`.
- [ ] `npx tsc --noEmit` attempted, but network is restricted and `npx` could not fetch `tsc` from npm.

## Checklist Result
- [x] API tests generated if applicable
- [x] E2E tests generated if UI exists
- [x] Tests use standard Playwright APIs
- [x] Tests cover happy path
- [x] Tests cover 1-2 critical error cases
- [ ] All generated tests run successfully - blocked by missing local dependencies
- [x] Tests use semantic, accessible locators where the UI exposes roles/labels
- [x] Tests have clear descriptions
- [x] No hardcoded waits or sleeps
- [x] Tests are independent of order except the Story 1.8 file's intentional serial mode for shared policy mutations
- [x] Test summary created
- [x] Tests saved to appropriate directories
- [x] Summary includes coverage metrics
