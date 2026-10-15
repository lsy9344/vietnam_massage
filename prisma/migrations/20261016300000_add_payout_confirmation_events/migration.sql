-- 티켓 30: 지급 확인(ADR 0004) 공통 저장소.
-- 세 직군(Therapist·귀케어·운영팀)의 정산 행 지급 확인을 확인/재확인/해제 사건으로 쌓는다.
-- 단위는 (unit_type, operating_month_id, service_date, employee_id)이고, service_date는
-- 월 단위(운영팀 월 인센)에서 NULL이다.

CREATE TABLE "payout_confirmation_events" (
  "id" TEXT NOT NULL,
  "unit_type" TEXT NOT NULL,
  "operating_month_id" TEXT NOT NULL,
  "service_date" DATE,
  "employee_id" TEXT NOT NULL,
  "event_type" TEXT NOT NULL,
  "amount" INTEGER,
  "reason" TEXT,
  "actor_account_id" TEXT NOT NULL,
  "occurred_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "payout_confirmation_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payout_confirmation_events_unit_type_check"
    CHECK ("unit_type" IN ('THERAPIST_DAILY', 'EARCARE_DAILY', 'OPS_DAILY', 'OPS_MONTHLY')),
  CONSTRAINT "payout_confirmation_events_event_type_check"
    CHECK ("event_type" IN ('confirm', 'reconfirm', 'release')),
  CONSTRAINT "payout_confirmation_events_amount_check"
    CHECK ("amount" IS NULL OR "amount" >= 0)
);

CREATE INDEX "idx_payout_confirmation_events_unit_occurred"
  ON "payout_confirmation_events"("unit_type", "operating_month_id", "service_date", "employee_id", "occurred_at");

CREATE INDEX "idx_payout_confirmation_events_actor_occurred"
  ON "payout_confirmation_events"("actor_account_id", "occurred_at");

ALTER TABLE "payout_confirmation_events"
  ADD CONSTRAINT "payout_confirmation_events_operating_month_id_fkey"
  FOREIGN KEY ("operating_month_id") REFERENCES "operating_months"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payout_confirmation_events"
  ADD CONSTRAINT "payout_confirmation_events_employee_id_fkey"
  FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payout_confirmation_events"
  ADD CONSTRAINT "payout_confirmation_events_actor_account_id_fkey"
  FOREIGN KEY ("actor_account_id") REFERENCES "user_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 데이터 이전: 기존 Therapist 지급완료 기록/이력을 금액 없는(amount IS NULL) 확인 사건으로 옮긴다.
-- 과거 확인 당시 금액은 알 수 없으므로 채워 넣지 않는다(화면에는 "확인 금액 미기록"으로 보인다).
-- 옛 therapist_daily_settlement_payment(_histories) 표는 과거 기록 보존을 위해 그대로 둔다(삭제하지 않음).
DO $$
DECLARE
  payments_before INTEGER;
  histories_before INTEGER;
  events_before INTEGER;
  events_after INTEGER;
  migrated_from_history INTEGER;
  migrated_from_payment_only INTEGER;
BEGIN
  SELECT COUNT(*) INTO payments_before FROM "therapist_daily_settlement_payments";
  SELECT COUNT(*) INTO histories_before FROM "therapist_daily_settlement_payment_histories";
  SELECT COUNT(*) INTO events_before FROM "payout_confirmation_events";

  -- 변경 이력이 있는 경우: 각 변경을 그 순서 그대로 confirm(지급완료)/release(미지급) 사건으로 옮긴다.
  INSERT INTO "payout_confirmation_events"
    ("id", "unit_type", "operating_month_id", "service_date", "employee_id", "event_type", "amount", "reason", "actor_account_id", "occurred_at", "created_at")
  SELECT
    'migrated-history-' || h."id",
    'THERAPIST_DAILY',
    h."operating_month_id",
    h."service_date",
    h."employee_id",
    CASE WHEN h."new_is_paid" THEN 'confirm' ELSE 'release' END,
    NULL,
    NULL,
    h."changed_by_account_id",
    h."changed_at",
    h."created_at"
  FROM "therapist_daily_settlement_payment_histories" h;

  GET DIAGNOSTICS migrated_from_history = ROW_COUNT;

  -- 변경 이력 없이 지급완료만 기록된 경우(이력 표 도입 전 데이터 등)를 위한 보완: payment row 자체에서 한 번 더 confirm을 만든다.
  INSERT INTO "payout_confirmation_events"
    ("id", "unit_type", "operating_month_id", "service_date", "employee_id", "event_type", "amount", "reason", "actor_account_id", "occurred_at", "created_at")
  SELECT
    'migrated-payment-' || p."id",
    'THERAPIST_DAILY',
    p."operating_month_id",
    p."service_date",
    p."employee_id",
    'confirm',
    NULL,
    NULL,
    p."paid_by_account_id",
    COALESCE(p."paid_at", p."updated_at"),
    p."updated_at"
  FROM "therapist_daily_settlement_payments" p
  WHERE p."is_paid" = true
    AND p."paid_by_account_id" IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM "therapist_daily_settlement_payment_histories" h WHERE h."payment_id" = p."id"
    );

  GET DIAGNOSTICS migrated_from_payment_only = ROW_COUNT;

  SELECT COUNT(*) INTO events_after FROM "payout_confirmation_events";

  RAISE NOTICE '지급 확인 마이그레이션(티켓 30): therapist_daily_settlement_payments=%(이전), therapist_daily_settlement_payment_histories=%(이전), payout_confirmation_events=% -> %(이력 이전 %건 + payment 보완 %건)',
    payments_before, histories_before, events_before, events_after, migrated_from_history, migrated_from_payment_only;
END $$;
