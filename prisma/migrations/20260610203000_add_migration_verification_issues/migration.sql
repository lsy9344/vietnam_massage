CREATE TABLE "migration_verification_issues" (
  "id" TEXT NOT NULL,
  "item_key" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "source_sheet" TEXT,
  "related_requirement" TEXT,
  "related_story" TEXT,
  "status" TEXT NOT NULL,
  "assignee_name" TEXT,
  "note" VARCHAR(500),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "migration_verification_issues_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "migration_verification_issues_kind_check" CHECK ("kind" IN ('sheet_mapping', 'calculation_comparison', 'manual_risk')),
  CONSTRAINT "migration_verification_issues_status_check" CHECK ("status" IN ('미확인', '수정중', '재검증 필요', '통과'))
);

CREATE TABLE "migration_verification_issue_histories" (
  "id" TEXT NOT NULL,
  "issue_id" TEXT NOT NULL,
  "previous_status" TEXT,
  "new_status" TEXT NOT NULL,
  "note" VARCHAR(500),
  "changed_by_account_id" TEXT NOT NULL,
  "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "migration_verification_issue_histories_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "migration_verification_issue_histories_previous_status_check" CHECK ("previous_status" IS NULL OR "previous_status" IN ('미확인', '수정중', '재검증 필요', '통과')),
  CONSTRAINT "migration_verification_issue_histories_new_status_check" CHECK ("new_status" IN ('미확인', '수정중', '재검증 필요', '통과'))
);

CREATE UNIQUE INDEX "migration_verification_issues_item_key_key" ON "migration_verification_issues"("item_key");
CREATE INDEX "idx_migration_verification_issues_kind_status" ON "migration_verification_issues"("kind", "status");
CREATE INDEX "idx_migration_verification_issues_source_sheet" ON "migration_verification_issues"("source_sheet");
CREATE INDEX "idx_migration_verification_histories_issue_changed" ON "migration_verification_issue_histories"("issue_id", "changed_at");
CREATE INDEX "idx_migration_verification_histories_actor_changed" ON "migration_verification_issue_histories"("changed_by_account_id", "changed_at");

ALTER TABLE "migration_verification_issue_histories"
  ADD CONSTRAINT "migration_verification_issue_histories_issue_id_fkey"
  FOREIGN KEY ("issue_id") REFERENCES "migration_verification_issues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "migration_verification_issue_histories"
  ADD CONSTRAINT "migration_verification_issue_histories_changed_by_account_id_fkey"
  FOREIGN KEY ("changed_by_account_id") REFERENCES "user_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
