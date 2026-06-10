-- CreateTable
CREATE TABLE "earcare_attendances" (
    "id" TEXT NOT NULL,
    "operating_month_id" TEXT NOT NULL,
    "attendance_date" DATE NOT NULL,
    "employee_id" TEXT NOT NULL,
    "status_code" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "earcare_attendances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_earcare_attendances_month_date_employee" ON "earcare_attendances"("operating_month_id", "attendance_date", "employee_id");

-- CreateIndex
CREATE INDEX "idx_earcare_attendances_employee_date" ON "earcare_attendances"("employee_id", "attendance_date");

-- AddForeignKey
ALTER TABLE "earcare_attendances" ADD CONSTRAINT "earcare_attendances_operating_month_id_fkey" FOREIGN KEY ("operating_month_id") REFERENCES "operating_months"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "earcare_attendances" ADD CONSTRAINT "earcare_attendances_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
