-- 계정에 비밀번호 변경 필요 표시를 더한다(스펙 D29, 티켓 02). Therapist 계정 발급과 비밀번호
-- 초기화가 이 표시를 켜고, 본인이 비밀번호를 바꾸면 지운다(M21). 더하기만 하는 칸이라 기존 계정은
-- 기본값 false로 영향이 없다. 운영 DB 적용은 사용자 확인 뒤에 한다.
ALTER TABLE "user_accounts" ADD COLUMN "password_change_required" BOOLEAN NOT NULL DEFAULT false;
