-- 소중한날 휴가를 일반 휴무와 구분한다. 기존 신청과 지급·근태 기록은 보존한다.
-- 운영 DB 적용은 .scratch/therapist-accounts/spec.md D29에 따라 사용자 확인 후 진행한다.
BEGIN;

ALTER TABLE "therapist_requests" DROP CONSTRAINT "chk_therapist_requests_kind";
ALTER TABLE "therapist_requests"
  ADD CONSTRAINT "chk_therapist_requests_kind" CHECK ("kind" IN ('휴무', '소중한날 휴가', '정정'));

COMMIT;
