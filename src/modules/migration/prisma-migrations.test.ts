import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const migrationsDir = join(process.cwd(), "prisma", "migrations");

function migrationSql(name: string) {
  return readFileSync(join(migrationsDir, name, "migration.sql"), "utf8");
}

describe("Prisma migration chain", () => {
  it("빈 DB 배포를 위해 기존 기본 테이블 baseline이 첫 story migration보다 먼저 존재한다", () => {
    const migrationNames = readdirSync(migrationsDir).filter((name) => existsSync(join(migrationsDir, name, "migration.sql"))).sort();
    const baselineName = "20260608000000_initial_baseline";

    assert.equal(migrationNames[0], baselineName);

    const sql = migrationSql(baselineName);
    for (const tableName of ["operating_months", "employees", "user_accounts", "rooms", "courses", "service_calls"]) {
      assert.match(sql, new RegExp(`CREATE TABLE IF NOT EXISTS "${tableName}"`));
    }
  });

  it("지급완료 이력은 payment_id와 정산 키가 같은 payment row를 가리키도록 DB FK로 묶는다", () => {
    const paymentSql = migrationSql("20260615122000_add_therapist_daily_settlement_payments");
    const historySql = migrationSql("20260615130000_add_therapist_daily_settlement_payment_histories");

    assert.match(paymentSql, /ON DELETE RESTRICT ON UPDATE CASCADE/);
    assert.match(historySql, /uq_tdsp_id_month_date_employee/);
    assert.match(historySql, /FOREIGN KEY \("payment_id", "operating_month_id", "service_date", "employee_id"\)/);
  });
});
