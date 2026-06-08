CREATE TABLE "daily_expenses" (
    "id" TEXT NOT NULL,
    "operating_month_id" TEXT NOT NULL,
    "expense_date" DATE NOT NULL,
    "amount" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "handled_by_employee_id" TEXT NOT NULL,
    "note" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_expenses_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_daily_expenses_month_date" ON "daily_expenses"("operating_month_id", "expense_date");
CREATE INDEX "idx_daily_expenses_handler_date" ON "daily_expenses"("handled_by_employee_id", "expense_date");

ALTER TABLE "daily_expenses"
ADD CONSTRAINT "daily_expenses_operating_month_id_fkey"
FOREIGN KEY ("operating_month_id") REFERENCES "operating_months"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "daily_expenses"
ADD CONSTRAINT "daily_expenses_handled_by_employee_id_fkey"
FOREIGN KEY ("handled_by_employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
