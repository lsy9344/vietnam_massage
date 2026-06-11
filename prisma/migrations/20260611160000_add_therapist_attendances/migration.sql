CREATE TABLE "therapist_attendances" (
    "id" TEXT NOT NULL,
    "operating_month_id" TEXT NOT NULL,
    "attendance_date" DATE NOT NULL,
    "employee_id" TEXT NOT NULL,
    "check_in_minute" INTEGER NOT NULL,
    "check_out_minute" INTEGER NOT NULL,
    "standby_minutes" INTEGER NOT NULL,
    "is_full_attendance_recognized" BOOLEAN NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "therapist_attendances_pkey" PRIMARY KEY ("id"),
    -- check_in/check_out are minute-of-day integers (00:00..23:59 => 0..1439).
    CONSTRAINT "chk_therapist_attendances_check_in_minute_range" CHECK ("check_in_minute" >= 0 AND "check_in_minute" <= 1439),
    CONSTRAINT "chk_therapist_attendances_check_out_minute_range" CHECK ("check_out_minute" >= 0 AND "check_out_minute" <= 1439),
    -- standby_minutes is the overnight-aware difference (0..1439) and must match the stored times.
    CONSTRAINT "chk_therapist_attendances_standby_minutes_range" CHECK ("standby_minutes" >= 0 AND "standby_minutes" <= 1439),
    CONSTRAINT "chk_therapist_attendances_standby_minutes_consistent" CHECK ("standby_minutes" = (("check_out_minute" - "check_in_minute" + 1440) % 1440)),
    -- full attendance is recognized only when standby >= 8 hours (480 minutes).
    CONSTRAINT "chk_therapist_attendances_full_attendance_consistent" CHECK ("is_full_attendance_recognized" = ("standby_minutes" >= 480))
);

CREATE UNIQUE INDEX "uq_therapist_attendances_month_date_employee" ON "therapist_attendances"("operating_month_id", "attendance_date", "employee_id");

CREATE INDEX "idx_therapist_attendances_employee_date" ON "therapist_attendances"("employee_id", "attendance_date");

ALTER TABLE "therapist_attendances" ADD CONSTRAINT "therapist_attendances_operating_month_id_fkey" FOREIGN KEY ("operating_month_id") REFERENCES "operating_months"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "therapist_attendances" ADD CONSTRAINT "therapist_attendances_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
