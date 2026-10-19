-- 출근 코드 실패 잠금 칸(스펙 D14, 가정: 로그인 잠금과 같은 기준인 5회·15분). 더하기만 하는 칸이고(D29),
-- 운영 DB 적용은 사용자 확인 뒤에 한다. 로그인 실패 횟수·잠금 칸(failed_login_count, locked_until)과
-- 같은 모양이고, 로그인 잠금과는 별개로 센다 — 출근 코드를 틀려도 로그인 계정 자체는 잠기지 않는다.
ALTER TABLE "user_accounts" ADD COLUMN "clock_in_code_failed_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "user_accounts" ADD COLUMN "clock_in_code_locked_until" TIMESTAMP(3);
