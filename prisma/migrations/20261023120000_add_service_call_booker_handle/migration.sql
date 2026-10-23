-- 예약 경로가 메신저일 때 그 메신저의 예약자 ID(2026-10-23 고객 요청). 칸만 더하고, 기존 콜은 null로 시작한다.
ALTER TABLE "service_calls" ADD COLUMN "booker_handle" TEXT;
