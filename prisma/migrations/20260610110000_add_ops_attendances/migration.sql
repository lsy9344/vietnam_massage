CREATE TABLE "ops_attendances" (
    "id" TEXT NOT NULL,
    "operating_month_id" TEXT NOT NULL,
    "attendance_date" DATE NOT NULL,
    "employee_id" TEXT NOT NULL,
    "status_code" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ops_attendances_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uq_ops_attendances_month_date_employee" ON "ops_attendances"("operating_month_id", "attendance_date", "employee_id");

CREATE INDEX "idx_ops_attendances_employee_date" ON "ops_attendances"("employee_id", "attendance_date");

ALTER TABLE "ops_attendances" ADD CONSTRAINT "ops_attendances_operating_month_id_fkey" FOREIGN KEY ("operating_month_id") REFERENCES "operating_months"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ops_attendances" ADD CONSTRAINT "ops_attendances_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
