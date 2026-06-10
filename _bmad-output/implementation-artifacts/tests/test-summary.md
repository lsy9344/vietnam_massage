# 테스트 자동화 요약

## 생성/보강한 테스트

### API Tests
- [x] Story 4.5에는 신규 REST/API endpoint가 없다. 운영팀 근무상태 저장은 Server Action과 `upsertOpsAttendance()` domain service가 처리하므로 별도 API endpoint 테스트는 해당 없음.
- [x] `src/modules/settlements/ops-attendance-service.test.ts` - 운영팀 5명 조회, `ATTENDANCE_STATUS` stable code mapping, 정상/비정상 지급 판정, 생성/수정 감사 로그, 범위/잠금 차단, transaction rollback을 검증한다.
- [x] `src/modules/settlements/ops-daily-incentive-service.test.ts` - calculated 완료 콜 `opsCallCredit` 합산, 비완료/정책없음/수당없음/D코스누락 warning, 30/40/50 threshold, 30콜 미만 0원, 정상 직원만 지급, 정책 없음 warning, 잠금 운영월 read-only 조회를 검증한다.

### E2E Tests
- [x] `tests/e2e/story-4-5-ops-daily-incentive.spec.ts` - 정산 담당자가 `/settlements/operations`에서 운영월/조회날짜로 일 총콜, threshold, 개인별 인센, 지급 row, 산출 근거, warning count를 조회하는 흐름을 검증한다.
- [x] `tests/e2e/story-4-5-ops-daily-incentive.spec.ts` - `정상`, `휴무`, `지각`, `조퇴`, `결근` 근무상태 옵션이 화면 select에 노출되는지 검증한다.
- [x] `tests/e2e/story-4-5-ops-daily-incentive.spec.ts` - 근무상태 변경 후 재조회 시 정상 지급 대상 수와 지급 합계가 최신 상태 기준으로 갱신되는지 검증한다.
- [x] `tests/e2e/story-4-5-ops-daily-incentive.spec.ts` - 30콜 미만, 정확히 30콜, 40콜, 50콜 이상 threshold 표시와 지급액을 검증한다.
- [x] `tests/e2e/story-4-5-ops-daily-incentive.spec.ts` - 잠금 운영월은 계산 결과를 읽을 수 있고 근무상태 저장 입력이 disabled인지 검증한다.
- [x] `tests/e2e/story-4-5-ops-daily-incentive.spec.ts` - 적용월 정책 없음이 명시 warning과 0 VND 지급으로 표시되는지 검증한다.
- [x] `tests/e2e/story-4-5-ops-daily-incentive.spec.ts` - counter 권한 direct access가 `/calls`로 redirect되는지 검증한다.

## Coverage
- API endpoints: 0/0 applicable.
- Domain service: Story 4.5 핵심 domain 규칙 covered by unit tests.
- UI workflows: 6 Story 4.5 Playwright tests discovered: 조회 happy path, 근무상태 변경 반영, threshold 경계값, 잠금 read-only, 정책 없음 warning, 권한 redirect.
- Critical/negative cases: 비완료 row 제외, `course_policy_missing`, `therapist_rate_missing`, `second_therapist_required`, 30콜 미만, 정책 없음, 비정상 근무 제외, 잠금 운영월, 권한 없는 route 접근.

## Validation
- [x] `npm run test:unit -- src/modules/settlements/ops-attendance-service.test.ts src/modules/settlements/ops-daily-incentive-service.test.ts` - passed 12/12 executed tests.
- [x] `npm run lint` - passed all story validators through Story 4.5.
- [x] `npm run test:e2e -- --list tests/e2e/story-4-5-ops-daily-incentive.spec.ts` - listed 6 Story 4.5 Playwright tests successfully.
- [ ] `npm run test:e2e -- tests/e2e/story-4-5-ops-daily-incentive.spec.ts` - attempted, but Playwright's configured Next dev server could not bind to `127.0.0.1:3000` in this sandbox (`listen EPERM`), so browser assertions did not run here.

## Next Steps
- `DATABASE_URL`이 E2E DB를 가리키고 `127.0.0.1:3000` listen이 가능한 환경에서 focused Playwright command를 실행한다.
