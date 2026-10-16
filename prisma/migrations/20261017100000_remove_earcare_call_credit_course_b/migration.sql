-- 귀케어 담당·귀케어풀·콜인정·B코스 제거(ADR 0006).
-- 되돌릴 수 없는 정리다: 귀케어 출근, 귀케어 담당 배정, 귀케어 지급 확인 사건, 코스 정책의 콜인정·귀케어 풀 값이 사라진다.
-- 과거 콜과 월마감 기록이 참조하는 B코스 코스 행, 귀케어팀 직원 행, 감사 로그는 지우지 않고 비활성으로만 둔다.
DO $$
DECLARE
  assignments_deleted INTEGER;
  confirmations_deleted INTEGER;
  attendances_dropped INTEGER;
  employees_deactivated INTEGER;
  courses_deactivated INTEGER;
  credit_not_one INTEGER;
BEGIN
  -- 1) 콜에 적힌 귀케어 담당 배정 삭제
  DELETE FROM "service_call_assignments" WHERE "assignment_role" = 'EARCARE';
  GET DIAGNOSTICS assignments_deleted = ROW_COUNT;

  -- 2) 귀케어 일일정산 지급 확인 사건 삭제
  DELETE FROM "payout_confirmation_events" WHERE "unit_type" = 'EARCARE_DAILY';
  GET DIAGNOSTICS confirmations_deleted = ROW_COUNT;
  ALTER TABLE "payout_confirmation_events" DROP CONSTRAINT "payout_confirmation_events_unit_type_check";
  ALTER TABLE "payout_confirmation_events" ADD CONSTRAINT "payout_confirmation_events_unit_type_check"
    CHECK ("unit_type" IN ('THERAPIST_DAILY', 'OPS_DAILY', 'OPS_MONTHLY'));

  -- 3) 귀케어 출근(근무상태) 표 삭제
  SELECT COUNT(*) INTO attendances_dropped FROM "earcare_attendances";
  DROP TABLE "earcare_attendances";

  -- 4) 코스 정책의 콜인정·귀케어 풀 컬럼 삭제. 운영팀 인센은 이제 방문완료 콜을 1건씩 세므로,
  --    콜인정이 1이 아닌 정책이 있었다면 집계가 달라진다. 지우기 전에 개수를 로그로 남긴다.
  SELECT COUNT(*) INTO credit_not_one FROM "course_policies" WHERE "ops_call_credit" <> 1;
  ALTER TABLE "course_policies" DROP COLUMN "ops_call_credit";
  ALTER TABLE "course_policies" DROP COLUMN "earcare_pool_amount";

  -- 5) 귀케어팀 직원은 지우지 않고 비활성으로 둔다(감사 로그·계정 연결 보존).
  UPDATE "employees"
  SET "is_active" = false, "updated_at" = CURRENT_TIMESTAMP
  WHERE "employee_group" = 'EARCARE' AND "is_active" = true;
  GET DIAGNOSTICS employees_deactivated = ROW_COUNT;

  -- 6) B코스는 비활성으로만 바꾼다. 정책 행은 과거 콜의 금액 계산을 위해 활성으로 둔다.
  UPDATE "courses"
  SET "is_active" = false, "updated_at" = CURRENT_TIMESTAMP
  WHERE "code" = 'B' AND "is_active" = true;
  GET DIAGNOSTICS courses_deactivated = ROW_COUNT;

  RAISE NOTICE '귀케어·콜인정·B코스 제거: 귀케어 담당 배정 삭제 %건, 귀케어 지급 확인 사건 삭제 %건, 귀케어 출근 삭제 %건, 귀케어팀 직원 비활성 %명, B코스 비활성 %건, 콜인정이 1이 아니던 코스 정책 %건',
    assignments_deleted, confirmations_deleted, attendances_dropped, employees_deactivated, courses_deactivated, credit_not_one;
END $$;
