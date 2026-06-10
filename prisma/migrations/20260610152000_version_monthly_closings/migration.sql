ALTER TABLE "monthly_closings"
ADD COLUMN "close_version" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "reopened_at" TIMESTAMP(3),
ADD COLUMN "reopened_by_account_id" TEXT,
ADD COLUMN "reopen_reason" TEXT;

DROP INDEX "monthly_closings_operating_month_id_key";

CREATE UNIQUE INDEX "uq_monthly_closings_month_version" ON "monthly_closings"("operating_month_id", "close_version");
CREATE INDEX "idx_monthly_closings_month_version" ON "monthly_closings"("operating_month_id", "close_version");
