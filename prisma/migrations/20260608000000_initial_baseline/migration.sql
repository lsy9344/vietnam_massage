-- Baseline for the core Story 1/2 tables that later migrations reference.
-- Existing local databases may already contain these tables, so the baseline is
-- written to be idempotent while still allowing a fresh DB to migrate from empty.

CREATE TABLE IF NOT EXISTS "employees" (
  "id" TEXT NOT NULL,
  "display_name" TEXT NOT NULL,
  "staff_code" TEXT NOT NULL,
  "employee_group" TEXT NOT NULL,
  "position" TEXT NOT NULL,
  "shift_type" TEXT,
  "base_salary" INTEGER NOT NULL,
  "phone" TEXT,
  "birthday" DATE,
  "hire_date" DATE,
  "employment_status" TEXT NOT NULL DEFAULT '재직',
  "sort_order" INTEGER NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "employees_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "employees_staff_code_key" UNIQUE ("staff_code"),
  CONSTRAINT "uq_employees_employee_group_sort_order" UNIQUE ("employee_group", "sort_order")
);

CREATE TABLE IF NOT EXISTS "operating_months" (
  "id" TEXT NOT NULL,
  "month_key" TEXT NOT NULL,
  "start_date" DATE NOT NULL,
  "end_date" DATE NOT NULL,
  "status" TEXT NOT NULL DEFAULT '작성중',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "operating_months_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "operating_months_month_key_key" UNIQUE ("month_key")
);

CREATE TABLE IF NOT EXISTS "rooms" (
  "id" TEXT NOT NULL,
  "display_name" TEXT NOT NULL,
  "migration_reference_name" TEXT NOT NULL,
  "sort_order" INTEGER NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "rooms_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "rooms_sort_order_key" UNIQUE ("sort_order")
);

CREATE TABLE IF NOT EXISTS "code_items" (
  "id" TEXT NOT NULL,
  "code_type" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "display_name" TEXT NOT NULL,
  "sort_order" INTEGER NOT NULL,
  "is_system_default" BOOLEAN NOT NULL DEFAULT false,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "code_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "uq_code_items_code_type_code" UNIQUE ("code_type", "code"),
  CONSTRAINT "uq_code_items_code_type_sort_order" UNIQUE ("code_type", "sort_order")
);

CREATE TABLE IF NOT EXISTS "time_slots" (
  "id" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "sort_order" INTEGER NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "time_slots_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "time_slots_value_key" UNIQUE ("value"),
  CONSTRAINT "time_slots_sort_order_key" UNIQUE ("sort_order")
);

CREATE TABLE IF NOT EXISTS "courses" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "courses_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "courses_code_key" UNIQUE ("code")
);

CREATE TABLE IF NOT EXISTS "user_accounts" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "account_id" TEXT NOT NULL,
  "password_hash" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "employee_id" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "locked_until" TIMESTAMP(3),
  "failed_login_count" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "user_accounts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "user_accounts_email_key" UNIQUE ("email"),
  CONSTRAINT "user_accounts_account_id_key" UNIQUE ("account_id"),
  CONSTRAINT "user_accounts_employee_id_key" UNIQUE ("employee_id"),
  CONSTRAINT "user_accounts_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "login_attempts" (
  "id" TEXT NOT NULL,
  "user_account_id" TEXT,
  "identity" TEXT NOT NULL,
  "success" BOOLEAN NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "login_attempts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "login_attempts_user_account_id_fkey" FOREIGN KEY ("user_account_id") REFERENCES "user_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "audit_logs" (
  "id" TEXT NOT NULL,
  "actor_id" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "target_type" TEXT NOT NULL,
  "target_id" TEXT NOT NULL,
  "before_value" JSONB,
  "after_value" JSONB,
  "reason" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "idx_audit_logs_created_at" ON "audit_logs"("created_at");
CREATE INDEX IF NOT EXISTS "idx_audit_logs_target_type_target_id" ON "audit_logs"("target_type", "target_id");
CREATE INDEX IF NOT EXISTS "idx_audit_logs_action" ON "audit_logs"("action");

CREATE TABLE IF NOT EXISTS "course_policies" (
  "id" TEXT NOT NULL,
  "course_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "duration_minutes" INTEGER NOT NULL,
  "base_price" INTEGER NOT NULL,
  "ops_call_credit" INTEGER NOT NULL,
  "earcare_pool_amount" INTEGER NOT NULL,
  "requires_second_therapist" BOOLEAN NOT NULL DEFAULT false,
  "tv_display_name" TEXT NOT NULL,
  "effective_from_month" TEXT NOT NULL,
  "effective_to_month" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "course_policies_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "course_policies_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "idx_course_policies_course_month" ON "course_policies"("course_id", "effective_from_month");

CREATE TABLE IF NOT EXISTS "therapist_course_rates" (
  "id" TEXT NOT NULL,
  "therapist_id" TEXT NOT NULL,
  "course_id" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "effective_from_month" TEXT NOT NULL,
  "effective_to_month" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "therapist_course_rates_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "therapist_course_rates_therapist_id_fkey" FOREIGN KEY ("therapist_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "therapist_course_rates_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "idx_therapist_course_rates_lookup" ON "therapist_course_rates"("therapist_id", "course_id", "effective_from_month");

CREATE TABLE IF NOT EXISTS "ops_daily_incentive_rules" (
  "id" TEXT NOT NULL,
  "threshold_call_count" INTEGER NOT NULL,
  "personal_amount" INTEGER NOT NULL,
  "effective_from_month" TEXT NOT NULL,
  "effective_to_month" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ops_daily_incentive_rules_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "idx_ops_daily_incentive_rules_lookup" ON "ops_daily_incentive_rules"("threshold_call_count", "effective_from_month");

CREATE TABLE IF NOT EXISTS "ops_monthly_incentive_rules" (
  "id" TEXT NOT NULL,
  "threshold_call_count" INTEGER NOT NULL,
  "total_amount" INTEGER NOT NULL,
  "lead_share" DOUBLE PRECISION NOT NULL,
  "counter_team_share" DOUBLE PRECISION NOT NULL,
  "waiter_team_share" DOUBLE PRECISION NOT NULL,
  "effective_from_month" TEXT NOT NULL,
  "effective_to_month" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ops_monthly_incentive_rules_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "idx_ops_monthly_incentive_rules_lookup" ON "ops_monthly_incentive_rules"("threshold_call_count", "effective_from_month");

CREATE TABLE IF NOT EXISTS "service_calls" (
  "id" TEXT NOT NULL,
  "operating_month_id" TEXT NOT NULL,
  "service_date" DATE NOT NULL,
  "start_time" TEXT NOT NULL,
  "room_id" TEXT NOT NULL,
  "course_id" TEXT NOT NULL,
  "customer_memo" TEXT,
  "status" TEXT NOT NULL,
  "discount_type_code" TEXT,
  "payment_method_code" TEXT,
  "note" TEXT,
  "confirmation_code" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "service_calls_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "service_calls_operating_month_id_fkey" FOREIGN KEY ("operating_month_id") REFERENCES "operating_months"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "service_calls_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "service_calls_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "idx_service_calls_month_date" ON "service_calls"("operating_month_id", "service_date");
CREATE INDEX IF NOT EXISTS "idx_service_calls_room_date" ON "service_calls"("room_id", "service_date");
CREATE INDEX IF NOT EXISTS "idx_service_calls_status_date" ON "service_calls"("status", "service_date");

CREATE TABLE IF NOT EXISTS "service_call_assignments" (
  "id" TEXT NOT NULL,
  "service_call_id" TEXT NOT NULL,
  "employee_id" TEXT NOT NULL,
  "assignment_role" TEXT NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "service_call_assignments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "uq_service_call_assignments_call_role" UNIQUE ("service_call_id", "assignment_role"),
  CONSTRAINT "service_call_assignments_service_call_id_fkey" FOREIGN KEY ("service_call_id") REFERENCES "service_calls"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "service_call_assignments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "idx_service_call_assignments_employee_role" ON "service_call_assignments"("employee_id", "assignment_role");

CREATE TABLE IF NOT EXISTS "service_call_status_histories" (
  "id" TEXT NOT NULL,
  "service_call_id" TEXT NOT NULL,
  "previous_status" TEXT NOT NULL,
  "new_status" TEXT NOT NULL,
  "changed_by_account_id" TEXT NOT NULL,
  "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "service_call_status_histories_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "service_call_status_histories_service_call_id_fkey" FOREIGN KEY ("service_call_id") REFERENCES "service_calls"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "service_call_status_histories_changed_by_account_id_fkey" FOREIGN KEY ("changed_by_account_id") REFERENCES "user_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "idx_service_call_status_histories_call_changed_at" ON "service_call_status_histories"("service_call_id", "changed_at");
CREATE INDEX IF NOT EXISTS "idx_service_call_status_histories_actor_changed_at" ON "service_call_status_histories"("changed_by_account_id", "changed_at");
