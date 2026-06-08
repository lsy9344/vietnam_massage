# 테스트 자동화 요약

## 생성/보강된 테스트

### API Tests
- 해당 없음: Story 1.7은 별도 HTTP API endpoint가 아니라 Server Action과 도메인 서비스로 구현되어 기존 unit/static validation이 담당한다.

### E2E Tests
- [x] `tests/e2e/story-1-7-employees-master.spec.ts` - 직원 마스터 관리자 workflow, 기본 그룹/count, 생성/수정/비활성, stable employee ID 보존, 계정 연결/역할 로그인, 감사 로그, non-admin 접근 차단 보강
- [x] `tests/e2e/story-1-7-employees-master.spec.ts` - staff code 검증, 중복 staff code, 새 계정 초기 비밀번호 누락의 한국어 오류 메시지 보강

## Coverage
- Story 1.7 AC: 8/8 covered by E2E, unit tests, and static validation
- 기본 직원 seed: 운영팀 5, 귀케어팀 4, 마사지사 50 DB/UI 검증
- UI mutation workflows: 직원 생성, 프로필 변경, 계정 연결, 비활성 처리 4/4 covered
- Critical error cases: invalid staff code, duplicate staff code, missing initial password 3/3 covered
- 권한 경계: administrator + non-admin 4 roles covered

## Validation
- [x] `npm run lint` passed Story 1.1 through Story 1.7 static validation.
- [ ] `npm run test:unit` attempted, but local dependencies are not installed: `Cannot find package 'tsx'`.
- [ ] `npm run test:e2e -- tests/e2e/story-1-7-employees-master.spec.ts` attempted, but local dependencies are not installed: `playwright: command not found`.

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
- [x] Tests are independent enough for reruns by using unique staff codes/account IDs; serial mode is used because the scenarios intentionally mutate shared employee/account data
- [x] Test summary created
- [x] Tests saved to appropriate directories
- [x] Summary includes coverage metrics

## Next Steps
- 의존성 설치 후 `npm run test:unit` 실행
- 의존성, Playwright 브라우저, `DATABASE_URL` 준비 후 `npm run test:e2e -- tests/e2e/story-1-7-employees-master.spec.ts` 실행
