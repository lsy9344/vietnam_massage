-- 1018 카운터 원장 재구성 데이터 기초(스펙 D1, 티켓 01). 칸을 더하기만 하고, 모두 비어도 된다.
-- 기존 콜과 근무표 행은 null로 시작하며, 옛 값을 옮기거나 추측으로 채우지 않는다.
-- 예약 경로 기본 코드(BOOKING_CHANNEL)는 다음 마이그레이션 20261019120100이 감사와 함께 넣는다.
ALTER TABLE "service_calls" ADD COLUMN "actual_end_time" TEXT;
ALTER TABLE "service_calls" ADD COLUMN "booking_channel_code" TEXT;
ALTER TABLE "service_calls" ADD COLUMN "booker_name" TEXT;

ALTER TABLE "planned_working_days" ADD COLUMN "planned_start_time" TEXT;

