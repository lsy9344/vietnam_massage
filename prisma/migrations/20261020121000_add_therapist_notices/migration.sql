-- Therapist 공지(스펙 D25, M24, 티켓 10): 관리자가 Therapist 전체 또는 특정 Therapist 한 명에게
-- 보낸다. 보낸 공지는 고칠 수 없고 내리기(withdrawn_at)만 할 수 있다. 받는 사람 줄은 보낼 때의
-- 활성 Therapist 계정 기준으로 한 번 고정한다(therapist_notice_recipients). 더하기만 하는
-- 마이그레이션이고(D29), 운영 DB 적용은 사용자 확인 뒤에 한다.

CREATE TABLE "therapist_notices" (
  "id" TEXT NOT NULL,
  "author_account_id" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "target_type" TEXT NOT NULL,
  "target_employee_id" TEXT,
  "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "withdrawn_at" TIMESTAMP(3),
  "withdrawn_by_account_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "therapist_notices_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "chk_therapist_notices_target_type" CHECK ("target_type" IN ('전체', '특정')),
  -- "전체"는 특정 대상 직원이 없고, "특정"은 반드시 있어야 한다.
  CONSTRAINT "chk_therapist_notices_target_employee_consistent" CHECK (("target_type" = '특정') = ("target_employee_id" IS NOT NULL)),
  CONSTRAINT "chk_therapist_notices_withdrawn_by_consistent" CHECK (("withdrawn_at" IS NULL) = ("withdrawn_by_account_id" IS NULL))
);

CREATE INDEX "idx_therapist_notices_sent_at" ON "therapist_notices"("sent_at");

ALTER TABLE "therapist_notices"
  ADD CONSTRAINT "therapist_notices_author_account_id_fkey"
  FOREIGN KEY ("author_account_id") REFERENCES "user_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "therapist_notices"
  ADD CONSTRAINT "therapist_notices_target_employee_id_fkey"
  FOREIGN KEY ("target_employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "therapist_notices"
  ADD CONSTRAINT "therapist_notices_withdrawn_by_account_id_fkey"
  FOREIGN KEY ("withdrawn_by_account_id") REFERENCES "user_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "therapist_notice_recipients" (
  "id" TEXT NOT NULL,
  "notice_id" TEXT NOT NULL,
  "employee_id" TEXT NOT NULL,
  "read_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "therapist_notice_recipients_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uq_therapist_notice_recipients_notice_employee" ON "therapist_notice_recipients"("notice_id", "employee_id");

CREATE INDEX "idx_therapist_notice_recipients_employee_read" ON "therapist_notice_recipients"("employee_id", "read_at");

ALTER TABLE "therapist_notice_recipients"
  ADD CONSTRAINT "therapist_notice_recipients_notice_id_fkey"
  FOREIGN KEY ("notice_id") REFERENCES "therapist_notices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "therapist_notice_recipients"
  ADD CONSTRAINT "therapist_notice_recipients_employee_id_fkey"
  FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
