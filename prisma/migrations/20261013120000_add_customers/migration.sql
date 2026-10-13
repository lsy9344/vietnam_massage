CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "memo" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "service_calls" ADD COLUMN "customer_id" TEXT;

CREATE INDEX "idx_service_calls_customer_id" ON "service_calls"("customer_id");

ALTER TABLE "service_calls"
ADD CONSTRAINT "service_calls_customer_id_fkey"
FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
