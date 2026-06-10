# 테스트 자동화 요약

## 생성/보강한 테스트

### API Tests
- [x] Story 4.4에는 신규 REST/API endpoint가 없다. 귀케어 지급액은 `listEarcareDailySettlements()` read-only domain service와 `/settlements/earcare` 서버 컴포넌트 조회로 처리되므로 별도 API endpoint 테스트는 해당 없음.
- [x] `src/modules/settlements/earcare-daily-settlement-service.test.ts` - calculated 방문완료 귀케어 풀 합계, 비완료/정책없음/수당없음/D코스누락 제외 warning, 정상 근무자 균등 분배, 잔여 1 VND deterministic 배분, `Employee.id` tie-breaker, 정상근무자 0명 미분배, 잠금 운영월 read-only 조회, 운영월 범위 밖 오류를 검증한다.

### E2E Tests
- [x] `tests/e2e/story-4-4-earcare-daily-settlement.spec.ts` - 정산 담당자가 `/settlements/earcare`에서 운영월/조회날짜로 귀케어 풀, 정상 근무자 수, 지급액 row, 풀 산출 근거, warning count를 조회하는 흐름을 검증한다.
- [x] `tests/e2e/story-4-4-earcare-daily-settlement.spec.ts` - 근무상태 변경 후 재조회 시 지급 대상 수와 개인 지급액이 최신 상태 기준으로 갱신되는지 검증한다.
- [x] `tests/e2e/story-4-4-earcare-daily-settlement.spec.ts` - 정상 근무자 0명일 때 지급액 0원/미분배 풀/`정상 근무자 0명` 근거가 표시되는지 검증한다.
- [x] `tests/e2e/story-4-4-earcare-daily-settlement.spec.ts` - 잠금 운영월에서도 계산 결과는 읽기 전용으로 보이고 근무상태 입력은 disabled인지 검증한다.
- [x] `tests/e2e/story-4-4-earcare-daily-settlement.spec.ts` - counter 권한 direct access가 `/calls`로 redirect되는지 검증한다.
- [x] 보강: E2E가 각 테스트 시작 시 Story 4.4 seed를 재생성해 근무상태 변경이 다른 케이스에 남지 않도록 했고, 잔여 배분 근거와 지급액 직접 수정 버튼 부재를 추가 assertion으로 확인한다.

## Coverage
- API endpoints: 0/0 applicable.
- Domain service: 8/8 Story 4.4 핵심 계산 규칙 covered by unit tests, including explicit `sortOrder`, `staffCode`, `Employee.id` remainder ordering.
- UI workflows: 5/5 Story 4.4 주요 E2E 흐름 covered: 조회 happy path, 근무상태 변경 반영, 정상근무자 0명, 잠금 read-only, 권한 redirect.
- Critical/negative cases: 비완료 row 제외, `therapist_rate_missing`, `second_therapist_required`, `course_policy_missing`, 운영월 범위 밖 날짜, 정상근무자 0명, 잠금 운영월, 권한 없는 route 접근.

## Validation
- [x] `npm run test:unit -- src/modules/settlements/earcare-daily-settlement-service.test.ts src/modules/settlements/earcare-attendance-service.test.ts` - passed 16/16 executed tests.
- [x] `npm run lint` - passed all story validators through Story 4.4.
- [x] `PLAYWRIGHT_SKIP_WEBSERVER=1 npx playwright test tests/e2e/story-4-4-earcare-daily-settlement.spec.ts --list` - listed 5 Story 4.4 tests successfully.
- [ ] `npm run test:e2e -- tests/e2e/story-4-4-earcare-daily-settlement.spec.ts` - attempted, but Playwright's configured Next dev server could not bind to `127.0.0.1:3000` in this sandbox (`listen EPERM`), so browser assertions did not run here.

## Next Steps
- `DATABASE_URL`이 E2E DB를 가리키고 `127.0.0.1:3000` listen이 가능한 환경에서 focused Playwright command를 실행한다.
