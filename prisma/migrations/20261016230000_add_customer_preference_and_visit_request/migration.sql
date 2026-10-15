-- 고객 공통 선호·주의사항과 콜의 방문별 요청(스펙 F06, 티켓 23, ADR 0003). 기존 고객 메모(memo)와
-- 콜 비고(note)는 그대로 두고, 둘 다 null로만 시작한다. 기존 값을 옮기거나 추측으로 다시 분류하지 않는다.
ALTER TABLE "customers" ADD COLUMN "preference_note" TEXT;

ALTER TABLE "service_calls" ADD COLUMN "visit_request" TEXT;
