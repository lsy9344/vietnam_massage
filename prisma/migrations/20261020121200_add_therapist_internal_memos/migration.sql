-- 티켓 12: Therapist 내부 메모(스펙 D27, M24). 직원 화면의 Therapist 패널에 날짜·작성자가 붙은
-- 기록을 쌓는 새 표다. 추가만 하고(수정·삭제 없음) 관리자만 읽고 쓴다. 새 표를 더하기만 하고(D29),
-- 운영 DB 적용은 사용자 확인 뒤에 한다.

CREATE TABLE "therapist_internal_memos" (
  "id" TEXT NOT NULL,
  "employee_id" TEXT NOT NULL,
  "author_account_id" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "therapist_internal_memos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_therapist_internal_memos_employee_created_at"
  ON "therapist_internal_memos"("employee_id", "created_at");

ALTER TABLE "therapist_internal_memos"
  ADD CONSTRAINT "therapist_internal_memos_employee_id_fkey"
  FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "therapist_internal_memos"
  ADD CONSTRAINT "therapist_internal_memos_author_account_id_fkey"
  FOREIGN KEY ("author_account_id") REFERENCES "user_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
