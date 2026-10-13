-- 지출 수단. 값이 없던 기존 행은 현금으로 본다.
ALTER TABLE "daily_expenses" ADD COLUMN "method" TEXT NOT NULL DEFAULT 'cash';

ALTER TABLE "daily_expenses" ADD CONSTRAINT "daily_expenses_method_check" CHECK ("method" IN ('cash', 'bank'));
