CREATE TABLE "monthly_closings" (
    "id" TEXT NOT NULL,
    "operating_month_id" TEXT NOT NULL,
    "snapshot_json" JSONB NOT NULL,
    "confirmed_by_account_id" TEXT NOT NULL,
    "confirmed_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "monthly_closings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "monthly_closings_operating_month_id_key" ON "monthly_closings"("operating_month_id");
CREATE INDEX "idx_monthly_closings_confirmed_at" ON "monthly_closings"("confirmed_at");
CREATE INDEX "idx_monthly_closings_confirmer_confirmed_at" ON "monthly_closings"("confirmed_by_account_id", "confirmed_at");

ALTER TABLE "monthly_closings"
ADD CONSTRAINT "monthly_closings_operating_month_id_fkey"
FOREIGN KEY ("operating_month_id") REFERENCES "operating_months"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "monthly_closings"
ADD CONSTRAINT "monthly_closings_confirmed_by_account_id_fkey"
FOREIGN KEY ("confirmed_by_account_id") REFERENCES "user_accounts"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
