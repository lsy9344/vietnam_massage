-- E코스 비활성(콜 원장 흐름 재구성 스펙 D8). ADR 0006의 B코스와 같은 방식이다.
-- 코스 행과 정책 행은 지우지 않는다: 과거 콜의 금액 계산과 마감 기록이 참조한다. E를 쓰는 기존 콜은 다른 코스로 바꿔야 저장된다.
-- 나중에 다시 하려면 코스 기준정보의 "다시 사용"으로 켠다.
DO $$
DECLARE
  courses_deactivated INTEGER;
BEGIN
  UPDATE "courses"
  SET "is_active" = false, "updated_at" = CURRENT_TIMESTAMP
  WHERE "code" = 'E' AND "is_active" = true;
  GET DIAGNOSTICS courses_deactivated = ROW_COUNT;

  RAISE NOTICE 'E코스 비활성: %건', courses_deactivated;
END $$;
