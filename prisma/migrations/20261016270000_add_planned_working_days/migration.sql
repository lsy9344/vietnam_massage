CREATE TABLE "planned_working_days" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "work_date" DATE NOT NULL,
    "plan_status" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "planned_working_days_pkey" PRIMARY KEY ("id"),
    -- 두 상태만 저장한다. 미입력은 행이 없는 상태로 표현하며 이 테이블에 쓰지 않는다.
    CONSTRAINT "chk_planned_working_days_plan_status" CHECK ("plan_status" IN ('근무 예정', '휴무'))
);

CREATE UNIQUE INDEX "uq_planned_working_days_employee_date" ON "planned_working_days"("employee_id", "work_date");

CREATE INDEX "idx_planned_working_days_work_date" ON "planned_working_days"("work_date");

ALTER TABLE "planned_working_days" ADD CONSTRAINT "planned_working_days_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
