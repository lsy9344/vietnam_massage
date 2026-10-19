-- Therapist 신청(스펙 D22–D24, M24, 티켓 08): 휴무 신청과 정정 요청을 한 표에 담는다. 09가
-- kind='정정'으로 이 표를 그대로 쓴다(requested_check_in_time/requested_check_out_time은 정정만
-- 쓴다). "기한 지남"은 저장하지 않고 읽을 때 정한다 — status는 대기/승인/거절/취소만 가진다.
-- 더하기만 하는 마이그레이션이고(D29), 운영 DB 적용은 사용자 확인 뒤에 한다.

CREATE TABLE "therapist_requests" (
  "id" TEXT NOT NULL,
  "employee_id" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "target_date" DATE NOT NULL,
  "requested_check_in_time" TEXT,
  "requested_check_out_time" TEXT,
  "reason" TEXT,
  "status" TEXT NOT NULL DEFAULT '대기',
  "resolution_reason" TEXT,
  "resolved_by_account_id" TEXT,
  "resolved_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "therapist_requests_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "chk_therapist_requests_kind" CHECK ("kind" IN ('휴무', '정정')),
  CONSTRAINT "chk_therapist_requests_status" CHECK ("status" IN ('대기', '승인', '거절', '취소')),
  -- 휴무 신청은 요청 시각 칸을 쓰지 않는다. 정정 요청만 쓸 수 있다.
  CONSTRAINT "chk_therapist_requests_correction_fields_consistent" CHECK (
    "kind" = '정정' OR ("requested_check_in_time" IS NULL AND "requested_check_out_time" IS NULL)
  ),
  -- 대기는 처리 칸이 비어 있고, 그 밖의 상태는 처리 계정·시각이 반드시 있어야 한다.
  CONSTRAINT "chk_therapist_requests_resolution_consistent" CHECK (
    ("status" = '대기') = ("resolved_by_account_id" IS NULL AND "resolved_at" IS NULL)
  ),
  -- 거절은 사유가 필수다.
  CONSTRAINT "chk_therapist_requests_rejection_reason_required" CHECK (
    "status" <> '거절' OR "resolution_reason" IS NOT NULL
  )
);

CREATE INDEX "idx_therapist_requests_employee_target_date" ON "therapist_requests"("employee_id", "target_date");

CREATE INDEX "idx_therapist_requests_status_target_date" ON "therapist_requests"("status", "target_date");

ALTER TABLE "therapist_requests"
  ADD CONSTRAINT "therapist_requests_employee_id_fkey"
  FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "therapist_requests"
  ADD CONSTRAINT "therapist_requests_resolved_by_account_id_fkey"
  FOREIGN KEY ("resolved_by_account_id") REFERENCES "user_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
