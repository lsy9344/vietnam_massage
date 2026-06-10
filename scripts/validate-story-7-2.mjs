import { existsSync, readFileSync } from "node:fs";

const errors = [];

function requireFile(path) {
  if (!existsSync(path)) errors.push(`Missing required file: ${path}`);
}

function read(path) {
  requireFile(path);
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

function readJson(path) {
  const contents = read(path);
  return contents ? JSON.parse(contents) : {};
}

[
  "tests/fixtures/migration-calculation-comparison.ts",
  "tests/fixtures/migration-calculation-prisma.ts",
  "src/modules/migration/migration-calculation-comparison.test.ts",
  "tests/e2e/story-7-2-migration-calculation-comparison.spec.ts",
  "docs/modules/migration-verification.md",
  "docs/modules/README.md",
  "_bmad-output/project-context.md",
  "package.json"
].forEach(requireFile);

const packageJson = readJson("package.json");
if (!packageJson.scripts?.lint?.includes("validate-story-7-1.mjs && node scripts/validate-story-7-2.mjs")) {
  errors.push("package.json lint script must run scripts/validate-story-7-2.mjs immediately after validate-story-7-1.mjs");
}

const fixture = read("tests/fixtures/migration-calculation-comparison.ts");
const adapter = read("tests/fixtures/migration-calculation-prisma.ts");
const unitTest = read("src/modules/migration/migration-calculation-comparison.test.ts");
const e2eTest = read("tests/e2e/story-7-2-migration-calculation-comparison.spec.ts");
const docs = `${read("docs/modules/migration-verification.md")}\n${read("docs/modules/README.md")}`;
const context = read("_bmad-output/project-context.md");

for (const status of ["방문완료", "예약", "사용중", "청소중", "노쇼", "취소"]) {
  if (!fixture.includes(`status: "${status}"`) && !fixture.includes(`"${status}"`)) errors.push(`fixture missing status: ${status}`);
}

for (const required of [
  "MIGRATION_CALCULATION_FIXTURE",
  "MIGRATION_EXPECTED_RESULTS",
  "MIGRATION_SOURCE_REFERENCES",
  "operatingMonth",
  "rooms",
  "courses",
  "coursePolicies",
  "therapistCourseRates",
  "employees",
  "timeSlots",
  "serviceCalls",
  "assignments",
  "attendance",
  "expenses",
  "incentiveRules",
  "expected",
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
  "area",
  "fixtureId",
  "expected",
  "actual",
  "sourceReference",
  "relatedRequirement",
  "message",
  "sheet_erp_design.md",
  "client_erp_specification.md",
  "A:S"
]) {
  if (!fixture.includes(required)) errors.push(`fixture missing Story 7.2 marker: ${required}`);
}

for (const forbidden of ["readFileSync(\"sheet.xlsx\"", "xlsx", "cellAddress", "parseCell", "workbookRange.split"]) {
  if (fixture.includes(forbidden) || unitTest.includes(forbidden) || adapter.includes(forbidden)) {
    errors.push(`Story 7.2 tests must not parse Excel/cell coordinates at runtime: ${forbidden}`);
  }
}

for (const required of [
  "createMigrationCalculationPrisma",
  "read-only",
  "failWrite",
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
  if (!adapter.includes(required)) errors.push(`adapter missing Story 7.2 marker: ${required}`);
}

for (const required of [
  "listCompletedServiceCallCalculationsForDate",
  "getDailyCallLedgerSummary",
  "saveBasicServiceCallRow",
  "listRoomStatuses",
  "RoomStatus",
  "listOpsDailyIncentives",
  "listOpsMonthlyIncentivePreview",
  "listEarcareDailySettlements",
  "listTherapistDailySettlements",
  "listMonthlyClosingPreview",
  "zeroWorker",
  "recognizedHoursThreshold: 8",
  "D코스 마사지사2 누락",
  "셀 좌표",
  "stable",
  "mismatchReport"
]) {
  if (!unitTest.includes(required)) errors.push(`unit test missing Story 7.2 marker: ${required}`);
}

for (const required of [
  "source guardrails",
  "tests/fixtures/migration-calculation-comparison.ts",
  "tests/fixtures/migration-calculation-prisma.ts",
  "src/modules/migration/migration-calculation-comparison.test.ts",
  "MIGRATION_CALCULATION_FIXTURE",
  "MIGRATION_EXPECTED_RESULTS",
  "MIGRATION_SOURCE_REFERENCES",
  "listCompletedServiceCallCalculationsForDate",
  "getDailyCallLedgerSummary",
  "listRoomStatuses",
  "listMonthlyClosingPreview",
  "mismatchReport",
  "read-only",
  "stable ID",
  "셀 좌표"
]) {
  if (!e2eTest.includes(required)) errors.push(`E2E source guardrail missing Story 7.2 marker: ${required}`);
}

for (const forbidden of ["page.goto(", "DATABASE_URL", "PrismaClient", "seedStoryAccounts", "recordAuditEvent", '"use server"']) {
  if (e2eTest.includes(forbidden)) errors.push(`Story 7.2 E2E guardrail must stay DB/browser independent: ${forbidden}`);
}

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
  if (!docs.includes(required)) errors.push(`docs missing Story 7.2 marker: ${required}`);
  if (!context.includes(required)) errors.push(`project-context missing Story 7.2 marker: ${required}`);
}

if (errors.length > 0) {
  console.error("Story 7.2 validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Story 7.2 validation passed.");
