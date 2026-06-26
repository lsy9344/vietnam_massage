CREATE TABLE "therapist_daily_settlement_payment_histories" (
  "id" TEXT NOT NULL,
  "payment_id" TEXT NOT NULL,
  "operating_month_id" TEXT NOT NULL,
  "service_date" DATE NOT NULL,
  "employee_id" TEXT NOT NULL,
  "previous_is_paid" BOOLEAN,
  "new_is_paid" BOOLEAN NOT NULL,
  "changed_by_account_id" TEXT NOT NULL,
  "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "therapist_daily_settlement_payment_histories_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_tdsp_histories_payment_changed"
  ON "therapist_daily_settlement_payment_histories"("payment_id", "changed_at");

CREATE INDEX "idx_tdsp_histories_month_date_emp"
  ON "therapist_daily_settlement_payment_histories"("operating_month_id", "service_date", "employee_id");

CREATE INDEX "idx_tdsp_histories_actor_changed"
  ON "therapist_daily_settlement_payment_histories"("changed_by_account_id", "changed_at");

CREATE UNIQUE INDEX "uq_tdsp_id_month_date_employee"
  ON "therapist_daily_settlement_payments"("id", "operating_month_id", "service_date", "employee_id");

ALTER TABLE "therapist_daily_settlement_payment_histories"
  ADD CONSTRAINT "therapist_daily_settlement_payment_histories_payment_key_fkey"
  FOREIGN KEY ("payment_id", "operating_month_id", "service_date", "employee_id")
  REFERENCES "therapist_daily_settlement_payments"("id", "operating_month_id", "service_date", "employee_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "therapist_daily_settlement_payment_histories"
  ADD CONSTRAINT "therapist_daily_settlement_payment_histories_account_id_fkey"
  FOREIGN KEY ("changed_by_account_id") REFERENCES "user_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
