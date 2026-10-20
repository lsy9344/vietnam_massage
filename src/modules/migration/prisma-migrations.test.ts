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

  it("출퇴근 방식 칸은 더하기만 하고, 기존 줄은 이전 기록으로, 퇴근이 없는 줄은 퇴근 방식을 비운다(스펙 D16, D29)", () => {
    const sql = migrationSql("20261020120400_add_therapist_attendance_methods");

    assert.match(sql, /ADD COLUMN "check_in_method" TEXT NOT NULL DEFAULT '이전 기록'/);
    assert.match(sql, /ADD COLUMN "check_out_method" TEXT/);
    assert.doesNotMatch(sql, /DROP COLUMN|DROP TABLE/);
    assert.match(sql, /UPDATE "therapist_attendances" SET "check_out_method" = '이전 기록' WHERE "check_out_minute" IS NOT NULL/);
    assert.match(sql, /CHECK \("check_in_method" IN \('직접', '대리 입력', '정정 승인', '이전 기록'\)\)/);
    assert.match(sql, /CHECK \(\("check_out_minute" IS NULL\) = \("check_out_method" IS NULL\)\)/);
  });

  it("계정 비밀번호 변경 필요 표시 칸은 더하기만 한다(스펙 D29, 티켓 02)", () => {
    const sql = migrationSql("20261020120200_add_user_account_password_change_required");

    assert.match(sql, /ADD COLUMN "password_change_required" BOOLEAN NOT NULL DEFAULT false/);
    assert.doesNotMatch(sql, /DROP COLUMN|DROP TABLE/);
  });

  // R25: 이 마이그레이션은 CHECK 제약을 DROP·ADD로 교체해서(열·표를 더하기만 하는 다른 마이그레이션과
  // 달리) 위의 doesNotMatch(/DROP COLUMN|DROP TABLE/) 가산성 검사를 비켜 간다. 열·표가 아니라 "허용값"
  // 기준으로 가산성을 따로 본다(스펙 D29: 더하기만 한다) — 새 허용값이 이전 값(20261020120800)의
  // 상위집합이고, DROP·ADD가 한 트랜잭션 안에서 함께 일어나는지 본다.
  it("소중한날 휴가 CHECK 제약 교체는 이전 허용값의 상위집합이고 한 트랜잭션 안에서 함께 바뀐다(스펙 D29)", () => {
    const previousSql = migrationSql("20261020120800_add_therapist_requests");
    const sql = migrationSql("20261020121300_add_special_day_off_request");

    function allowedKinds(source: string) {
      const match = /chk_therapist_requests_kind"\s+CHECK \("kind" IN \(([^)]+)\)\)/.exec(source);
      assert.ok(match, "chk_therapist_requests_kind CHECK를 찾을 수 없습니다.");
      return match[1].split(",").map((value) => value.trim().replace(/^'|'$/g, ""));
    }

    const previousKinds = allowedKinds(previousSql);
    const nextKinds = allowedKinds(sql);
    assert.ok(
      previousKinds.every((kind) => nextKinds.includes(kind)),
      `이전 허용값(${previousKinds.join(", ")})이 새 허용값(${nextKinds.join(", ")})의 상위집합이 아닙니다.`
    );
    assert.ok(nextKinds.length > previousKinds.length, "새 허용값이 이전 값과 같으면 이 마이그레이션이 더한 것이 없습니다.");

    // DROP·ADD가 같은 트랜잭션 안에서 함께 일어난다 — 중간에 COMMIT이 끼면 DROP 뒤 ADD 전까지
    // 제약이 없는 순간이 생긴다. indexOf는 첫 COMMIT을 찾으므로, DROP과 ADD 사이에 COMMIT이
    // 끼어 있었다면 그 COMMIT이 add보다 먼저 잡혀 아래 순서 비교가 걸린다.
    const begin = sql.indexOf("BEGIN;");
    const drop = sql.indexOf('DROP CONSTRAINT "chk_therapist_requests_kind"');
    const add = sql.indexOf('ADD CONSTRAINT "chk_therapist_requests_kind"');
    const commit = sql.indexOf("COMMIT;");
    assert.ok(begin !== -1 && drop !== -1 && add !== -1 && commit !== -1, "BEGIN/DROP/ADD/COMMIT을 모두 찾을 수 없습니다.");
    assert.ok(begin < drop && drop < add && add < commit, "DROP과 ADD가 한 BEGIN...COMMIT 사이에 있지 않습니다.");
  });

  it("Therapist 내부 메모 표는 더하기만 하고, 직원·작성 계정을 FK로 묶는다(스펙 D27, D29)", () => {
    const sql = migrationSql("20261020121200_add_therapist_internal_memos");

    assert.match(sql, /CREATE TABLE "therapist_internal_memos"/);
    assert.doesNotMatch(sql, /DROP COLUMN|DROP TABLE/);
    assert.match(sql, /FOREIGN KEY \("employee_id"\) REFERENCES "employees"\("id"\)/);
    assert.match(sql, /FOREIGN KEY \("author_account_id"\) REFERENCES "user_accounts"\("id"\)/);
  });

  it("휴무 신청·정정 요청 표는 더하기만 하고, 종류·상태·거절 사유 필수를 DB CHECK로 묶는다(스펙 D22–D24, D29, 티켓 08)", () => {
    const sql = migrationSql("20261020120800_add_therapist_requests");

    assert.match(sql, /CREATE TABLE "therapist_requests"/);
    assert.doesNotMatch(sql, /DROP COLUMN|DROP TABLE/);
    assert.match(sql, /CHECK \("kind" IN \('휴무', '정정'\)\)/);
    assert.match(sql, /CHECK \("status" IN \('대기', '승인', '거절', '취소'\)\)/);
    assert.match(sql, /CHECK \(\s*"status" <> '거절' OR "resolution_reason" IS NOT NULL\s*\)/);
    assert.match(sql, /FOREIGN KEY \("employee_id"\) REFERENCES "employees"\("id"\)/);
    assert.match(sql, /FOREIGN KEY \("resolved_by_account_id"\) REFERENCES "user_accounts"\("id"\)/);
  });

  it("출근 코드 실패 잠금 칸은 더하기만 한다(스펙 D14, D29, 티켓 05)", () => {
    const sql = migrationSql("20261020120500_add_therapist_clock_in_code_lockout");

    assert.match(sql, /ADD COLUMN "clock_in_code_failed_count" INTEGER NOT NULL DEFAULT 0/);
    assert.match(sql, /ADD COLUMN "clock_in_code_locked_until" TIMESTAMP\(3\)/);
    assert.doesNotMatch(sql, /DROP COLUMN|DROP TABLE/);
  });
});
