CREATE TABLE "therapist_daily_settlement_payments" (
  "id" TEXT NOT NULL,
  "operating_month_id" TEXT NOT NULL,
  "service_date" DATE NOT NULL,
  "employee_id" TEXT NOT NULL,
  "is_paid" BOOLEAN NOT NULL DEFAULT false,
  "paid_at" TIMESTAMP(3),
  "paid_by_account_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "therapist_daily_settlement_payments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uq_therapist_daily_settlement_payments_month_date_employee"
  ON "therapist_daily_settlement_payments"("operating_month_id", "service_date", "employee_id");

CREATE INDEX "idx_therapist_daily_settlement_payments_employee_date"
  ON "therapist_daily_settlement_payments"("employee_id", "service_date");

CREATE INDEX "idx_therapist_daily_settlement_payments_actor_paid_at"
  ON "therapist_daily_settlement_payments"("paid_by_account_id", "paid_at");

ALTER TABLE "therapist_daily_settlement_payments"
  ADD CONSTRAINT "therapist_daily_settlement_payments_operating_month_id_fkey"
  FOREIGN KEY ("operating_month_id") REFERENCES "operating_months"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "therapist_daily_settlement_payments"
  ADD CONSTRAINT "therapist_daily_settlement_payments_employee_id_fkey"
  FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "therapist_daily_settlement_payments"
  ADD CONSTRAINT "therapist_daily_settlement_payments_paid_by_account_id_fkey"
  FOREIGN KEY ("paid_by_account_id") REFERENCES "user_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
