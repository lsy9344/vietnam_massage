-- 원장 새 행 초안의 요청 id. 이전에 만든 콜은 비워 두고, 값이 있으면 유일하다.
ALTER TABLE "service_calls" ADD COLUMN "request_id" TEXT;

CREATE UNIQUE INDEX "service_calls_request_id_key" ON "service_calls"("request_id");
