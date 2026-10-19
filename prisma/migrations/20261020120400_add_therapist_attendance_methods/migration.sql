-- 출근과 퇴근 각각에 찍힌 방식을 남긴다(스펙 D16, M23). 값은 직접(출근 코드)·대리 입력(운영팀이
-- 기존 출퇴근 화면에서 입력)·정정 승인·이전 기록 네 가지 코드 문자열이다. 더하기만 하는 칸이고(D29),
-- 운영 DB 적용은 사용자 확인 뒤에 한다.
ALTER TABLE "therapist_attendances" ADD COLUMN "check_in_method" TEXT NOT NULL DEFAULT '이전 기록';
ALTER TABLE "therapist_attendances" ADD COLUMN "check_out_method" TEXT;

-- 이 칸이 생기기 전 기록은 모두 "이전 기록"으로 둔다(가정, D16) — 대리 입력 횟수에 세지 않는다.
-- 출근 방식은 ADD COLUMN의 DEFAULT로 기존 줄에 이미 채워졌다. 퇴근이 있는 줄만 퇴근 방식도 채운다.
UPDATE "therapist_attendances" SET "check_out_method" = '이전 기록' WHERE "check_out_minute" IS NOT NULL;

-- 값은 네 가지 코드 문자열로 제한한다.
ALTER TABLE "therapist_attendances" ADD CONSTRAINT "chk_therapist_attendances_check_in_method_valid" CHECK ("check_in_method" IN ('직접', '대리 입력', '정정 승인', '이전 기록'));
ALTER TABLE "therapist_attendances" ADD CONSTRAINT "chk_therapist_attendances_check_out_method_valid" CHECK ("check_out_method" IS NULL OR "check_out_method" IN ('직접', '대리 입력', '정정 승인', '이전 기록'));
-- 퇴근이 없으면 퇴근 방식도 비어 있어야 한다(퇴근을 지우면 방식도 비운다).
ALTER TABLE "therapist_attendances" ADD CONSTRAINT "chk_therapist_attendances_check_out_method_consistent" CHECK (("check_out_minute" IS NULL) = ("check_out_method" IS NULL));
