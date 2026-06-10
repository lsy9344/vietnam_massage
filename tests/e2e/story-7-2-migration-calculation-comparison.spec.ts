import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

function readSource(path: string) {
  return readFileSync(path, "utf8");
}

test.describe("Story 7.2 migration calculation comparison source guardrails", () => {
  test("source guardrails: fixture preserves workbook business rules without runtime Excel parsing", async () => {
    const fixture = readSource("tests/fixtures/migration-calculation-comparison.ts");

    for (const status of ["방문완료", "예약", "사용중", "청소중", "노쇼", "취소"]) {
      expect(fixture).toContain(status);
    }

    for (const required of [
      "MIGRATION_CALCULATION_FIXTURE",
      "MIGRATION_EXPECTED_RESULTS",
      "MIGRATION_SOURCE_REFERENCES",
      "room-101",
      "course-a",
      "therapist-thr-001",
      "ops-counter-001",
      "100000",
      "THERAPIST_1",
      "THERAPIST_2",
      "D_COURSE_SECOND_THERAPIST_REQUIRED",
      "erpStrengthenedRule",
      "30",
      "40",
      "50",
      "1000",
      "1100",
      "1200",
      "1300",
      "1400",
      "1500",
      "fullAttendanceThresholdHours: 8",
      "fullAttendanceBonusThresholdDays: 20",
      "countKingThresholdCalls: 40",
      "sheet_erp_design.md",
      "client_erp_specification.md",
      "A:S"
    ]) {
      expect(fixture).toContain(required);
    }

    for (const forbidden of ["readFileSync(\"sheet.xlsx\"", "cellAddress", "parseCell", "workbookRange.split"]) {
      expect(fixture).not.toContain(forbidden);
    }
  });

  test("source guardrails: comparison suite delegates to existing domain services and reports mismatches", async () => {
    const unitTest = readSource("src/modules/migration/migration-calculation-comparison.test.ts");

    for (const required of [
      "listCompletedServiceCallCalculationsForDate",
      "getDailyCallLedgerSummary",
      "saveBasicServiceCallRow",
      "listRoomStatuses",
      "listOpsDailyIncentives",
      "listOpsMonthlyIncentivePreview",
      "listEarcareDailySettlements",
      "listTherapistDailySettlements",
      "listMonthlyClosingPreview",
      "mismatchReport",
      "area",
      "fixtureId",
      "expected",
      "actual",
      "sourceReference",
      "relatedRequirement",
      "message"
    ]) {
      expect(unitTest).toContain(required);
    }

    expect(unitTest).not.toContain("readFileSync(\"sheet.xlsx\"");
    expect(unitTest).not.toContain("parseCell");
    expect(unitTest).not.toContain("new MigrationCalculationEngine");
  });

  test("source guardrails: memory Prisma adapter stays read-only and stable-id based", async () => {
    const adapter = readSource("tests/fixtures/migration-calculation-prisma.ts");

    for (const required of [
      "createMigrationCalculationPrisma",
      "read-only",
      "failWrite",
      "writeOperations",
      "operatingMonth",
      "room",
      "coursePolicy",
      "therapistCourseRate",
      "employee",
      "codeItem",
      "serviceCall",
      "serviceCallAssignment",
      "dailyExpense",
      "opsAttendance",
      "earcareAttendance",
      "opsDailyIncentiveRule",
      "opsMonthlyIncentiveRule",
      "YYYY-MM-DD"
    ]) {
      expect(adapter).toContain(required);
    }

    expect(adapter).toContain("id");
    expect(adapter).toContain("staffCode");
    expect(adapter).not.toContain("displayName: input.where");
    expect(adapter).not.toContain("readFileSync(\"sheet.xlsx\"");
  });

  test("source guardrails: static validation and docs keep Story 7.2 automation wired", async () => {
    const validator = readSource("scripts/validate-story-7-2.mjs");
    const packageJson = readSource("package.json");
    const docs = `${readSource("docs/modules/migration-verification.md")}\n${readSource("docs/modules/README.md")}\n${readSource("_bmad-output/project-context.md")}`;

    expect(validator).toContain("tests/e2e/story-7-2-migration-calculation-comparison.spec.ts");
    expect(packageJson).toContain("validate-story-7-1.mjs && node scripts/validate-story-7-2.mjs");

    for (const required of [
      "Story 7.2",
      "계산 대조",
      "fixture",
      "domain service",
      "RoomStatusDto",
      "100000",
      "30/40/50",
      "1000/1100/1200/1300/1400/1500",
      "귀케어 0명",
      "8시간",
      "20일",
      "40콜",
      "stable ID",
      "셀 좌표"
    ]) {
      expect(docs).toContain(required);
    }
  });
});
