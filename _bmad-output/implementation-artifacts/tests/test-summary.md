# 테스트 자동화 요약

## 생성/보강한 테스트

### API Tests
- [x] Story 4.3에는 신규 REST/API endpoint가 없다. `/settlements/earcare` 저장은 Server Action과 `upsertEarcareAttendance()` domain service 경계로 처리되므로 별도 API endpoint 테스트는 해당 없음.
- [x] `src/modules/settlements/earcare-attendance-service.test.ts` - active EARCARE 4명 목록, inactive 제외, stable `ATTENDANCE_STATUS` code 사용, `NORMAL` 지급 대상, 휴무/지각/조퇴/결근 제외, 운영월 범위 밖 차단, 잠금 차단 무부작용, transaction 내부 잠금 재확인, create/update audit transaction, audit 실패 rollback을 검증한다.

### E2E Tests
- [x] `tests/e2e/story-4-3-earcare-attendance.spec.ts` - 정산 담당자가 `/settlements/earcare`에서 운영월/조회날짜로 active 귀케어사 4명을 조회하고 비정상 근무상태를 저장하는 흐름을 검증한다.
- [x] `tests/e2e/story-4-3-earcare-attendance.spec.ts` - 저장 payload가 표시명이 아니라 stable code `DAY_OFF`와 `Employee.id`로 persistence 되고 `earcare_attendance.created` 감사 로그가 남는지 DB까지 확인하도록 보강했다.
- [x] `tests/e2e/story-4-3-earcare-attendance.spec.ts` - 날짜 변경 시 이전 날짜의 `지각` 상태가 새 날짜 값처럼 보이지 않고 기본 `NORMAL`/`지급 대상`으로 표시되는지 검증하도록 보강했다.
- [x] `tests/e2e/story-4-3-earcare-attendance.spec.ts` - 잘못된 stable status code 저장 실패 시 inline error와 `재시도` affordance가 표시되고 attendance row가 생성되지 않는 critical error case를 추가했다.
- [x] `tests/e2e/story-4-3-earcare-attendance.spec.ts` - 잠긴 운영월 disabled 입력 상태와 권한 없는 counter direct access redirect를 검증한다.

## Coverage
- API endpoints: 0/0 applicable.
- UI features: 8/8 Story 4.3 주요 화면 조건 covered by E2E/static assertions: route access, 운영월 selector, 조회날짜 selector, active 귀케어사 4명 목록, 상태 select, 저장 성공, 저장 실패/재시도, 잠금 disabled, 날짜 변경 stale 값 방지.
- Domain service: 8/8 Story 4.3 핵심 업무 규칙 covered by unit tests: active EARCARE 필터, stable code 저장, 정상 지급 대상, 비정상 제외 사유, 운영월 범위 검증, 잠금 차단 무부작용, 감사 로그 transaction, 후속 Story 4.4 재사용 DTO.
- Critical/negative cases: inactive 귀케어사 제외, out-of-range date 차단, locked month mutation 차단, invalid status code 차단, audit 실패 rollback, 권한 없는 route redirect, 날짜 변경 stale attendance 방지.
- Discovered gaps fixed: E2E가 기존 happy path/lock/permission 중심에서 persistence stable key, audit evidence, stale-date prevention, invalid status save failure까지 직접 검증하도록 보강했다. Senior Developer Review에서 audit payout-impact classification, transaction 내부 locked-month recheck, `조퇴` exclusion unit coverage를 보강했다.

## Validation
- [x] `npm run test:unit -- src/modules/settlements/earcare-attendance-service.test.ts` - passed 11/11 executed tests, including the focused Story 4.3 service suite plus review-added coverage.
- [x] `npm run lint` - passed all story validators through Story 4.3.
- [x] `PLAYWRIGHT_SKIP_WEBSERVER=1 npx playwright test --list tests/e2e/story-4-3-earcare-attendance.spec.ts` - listed 5 Story 4.3 tests successfully.
- [ ] `npm run test:e2e -- tests/e2e/story-4-3-earcare-attendance.spec.ts` - attempted, but Playwright's configured Next dev server could not bind to `127.0.0.1:3000` in this sandbox (`listen EPERM`), so browser assertions did not run here.

## Next Steps
- E2E 실행이 로컬 sandbox의 Next dev server bind 제한으로 막히면, `DATABASE_URL`이 E2E DB를 가리키고 `127.0.0.1:3000` listen이 가능한 환경에서 focused Playwright command를 실행한다.
