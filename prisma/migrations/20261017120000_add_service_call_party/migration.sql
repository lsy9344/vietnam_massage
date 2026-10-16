-- 빠른 예약 일행(스펙 D13, ADR 0007). 일행이 아닌 콜은 두 칸 다 비어 있다. 칸 추가와 색인만 하므로 기존 콜과 코드에 영향이 없다.
ALTER TABLE "service_calls" ADD COLUMN "party_id" TEXT;
ALTER TABLE "service_calls" ADD COLUMN "party_position" INTEGER;

CREATE INDEX "idx_service_calls_party_id" ON "service_calls"("party_id");
