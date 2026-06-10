# 테스트 자동화 요약

## 생성/보강한 테스트

### API Tests
- [x] Story 4.6에는 신규 REST/API endpoint가 없다. 운영팀 월 인센 미리보기는 read-only page와 `listOpsMonthlyIncentivePreview()` domain service가 처리하므로 별도 API endpoint 테스트는 해당 없음.
- [x] `src/modules/settlements/ops-monthly-incentive-service.test.ts` - 월 총콜 `opsCallCredit` 합산, calculated 방문완료만 포함, warning count, 1000/1100/1200/1300/1400/1500 최고 threshold 선택, 구간 미달, 정책 없음, 운영월 없음, effective month filtering, 30/35/35 분배, deterministic VND 잔여 배분, 직원 stable ID row key, 잠금/마감 current preview를 검증한다.

### E2E Tests
- [x] `tests/e2e/story-4-6-ops-monthly-incentive.spec.ts` - 정산 담당자가 운영월 selector로 `/settlements/operations/monthly` 조회 대상을 바꾸고 월 총콜, 적용 threshold, 전체 월인센, 팀 분배, 직원별 분배, 산출 근거, 제외 warning을 확인하는 흐름을 검증한다.
- [x] `tests/e2e/story-4-6-ops-monthly-incentive.spec.ts` - 최저 threshold 미만 운영월은 `최저 구간 미달`, 0 VND, 한국어 warning을 표시하는지 검증한다.
- [x] `tests/e2e/story-4-6-ops-monthly-incentive.spec.ts` - 적용월 월 인센 정책 없음이 조용한 0원 처리 대신 `정책 없음`과 명시 warning으로 표시되는지 검증한다.
- [x] `tests/e2e/story-4-6-ops-monthly-incentive.spec.ts` - 잠금 운영월은 현재 기준 미리보기와 월마감 스냅샷 확정값 안내를 분리해 표시하는지 검증한다.
- [x] `tests/e2e/story-4-6-ops-monthly-incentive.spec.ts` - counter 권한 direct access가 기존 route access 정책대로 `/calls`로 redirect되는지 검증한다.
- [x] `tests/e2e/story-4-6-ops-monthly-incentive.spec.ts` - waiter/read-only 권한 direct access가 기존 route access 정책대로 `/rooms`로 redirect되는지 검증한다.

## Coverage
- API endpoints: 0/0 applicable.
- Domain service: Story 4.6 핵심 domain 규칙 covered by unit tests.
- UI workflows: 7 Story 4.6 Playwright tests discovered: 운영월 선택 happy path, below-threshold warning, missing-policy warning, locked/current-preview 안내, counter/waiter/read-only 권한 redirect.
- Critical/negative cases: 비완료 row 제외 warning, 정책 없음, 구간 미달, 운영월 없음, 잠금/마감확정 운영월 read-only/current-preview, 권한 없는 route 접근.

## Validation
- [x] `npm run test:unit -- src/modules/settlements/ops-monthly-incentive-service.test.ts` - passed 10/10 executed tests.
- [x] `npm run lint` - passed all story validators through Story 4.6.
- [x] `npx playwright test --list tests/e2e/story-4-6-ops-monthly-incentive.spec.ts` - listed 7 Story 4.6 Playwright tests successfully.
- [ ] `npm run test:e2e -- tests/e2e/story-4-6-ops-monthly-incentive.spec.ts` - attempted, but Playwright's configured Next dev server could not bind to `127.0.0.1:3000` in this sandbox (`listen EPERM`), so browser assertions did not run here.

## Next Steps
- `DATABASE_URL`이 E2E DB를 가리키고 `127.0.0.1:3000` listen이 가능한 환경에서 focused Playwright command를 실행한다.
