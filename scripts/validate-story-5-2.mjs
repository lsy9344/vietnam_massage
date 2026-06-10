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
  "src/modules/closing/monthly-closing-preview-service.ts",
  "src/modules/closing/monthly-closing-preview-service.test.ts",
  "src/app/(erp)/closing/page.tsx",
  "tests/e2e/story-5-2-monthly-closing-bonuses.spec.ts",
  "src/modules/closing/README.md",
  "prisma/schema.prisma",
  "_bmad-output/implementation-artifacts/5-2-만근수당과-갯수왕-수당-계산.md"
].forEach(requireFile);

const packageJson = readJson("package.json");
if (!packageJson.scripts?.lint?.includes("validate-story-5-1.mjs && node scripts/validate-story-5-2.mjs")) {
  errors.push("package.json lint script must run scripts/validate-story-5-2.mjs immediately after validate-story-5-1.mjs");
}

const service = read("src/modules/closing/monthly-closing-preview-service.ts");
for (const required of [
  "FULL_ATTENDANCE_THRESHOLD_DAYS = 20",
  "FULL_ATTENDANCE_ALLOWANCE_AMOUNT = 2_000_000",
  "COUNT_KING_MIN_CALLS = 40",
  "1: 5_000_000",
  "2: 3_000_000",
  "3: 1_000_000",
  "TherapistFullAttendanceRecognitionResultDto",
  "missing_story_4_1_source",
  "listTherapistFullAttendanceRecognitions",
  "fullAttendanceDays",
  "fullAttendanceAllowanceAmount",
  "fullAttendanceBasis",
  "countKingRank",
  "countKingBonusAmount",
  "countKingBasis",
  "finalPayoutAmount",
  "bonusWarningMessages",
  "totalCallCount >= COUNT_KING_MIN_CALLS",
  "b.monthlySettlementAmount - a.monthlySettlementAmount",
  "a.staffCode.localeCompare",
  "a.employeeId.localeCompare",
  "rows.reduce((sum, row) => sum + row.finalPayoutAmount, 0)",
  "fullAttendanceSourceStatus",
  "countKingEligibleCount",
  "countKingExcludedCount"
]) {
  if (!service.includes(required)) errors.push(`monthly-closing-preview-service.ts missing ${required}`);
}
for (const forbidden of ["pending_story_5_2", "finalBasePayoutAmount", "bonusStatus", "recordAuditEvent", "MonthlyClose", "closingSnapshot", "$transaction"]) {
  if (service.includes(forbidden)) errors.push(`monthly-closing-preview-service.ts violates Story 5.2 boundary: ${forbidden}`);
}
for (const forbiddenPattern of [/\.create\s*\(/, /\.update\s*\(/, /\.deleteMany\s*\(/, /\.updateMany\s*\(/]) {
  if (forbiddenPattern.test(service)) errors.push(`monthly-closing-preview-service.ts must remain read-only: ${forbiddenPattern}`);
}

const page = read("src/app/(erp)/closing/page.tsx");
for (const required of [
  "requireRouteAccess(\"/closing\")",
  "만근 인정일",
  "만근수당",
  "갯수왕",
  "갯수왕 수당",
  "최종지급액",
  "source 없음",
  "fullAttendanceBasis",
  "countKingBasis",
  "bonusWarningMessages",
  "fullAttendanceSourceStatus",
  "countKingTieBreaker",
  "보너스 포함"
]) {
  if (!page.includes(required)) errors.push(`closing page.tsx missing ${required}`);
}
for (const forbidden of ["use server", "action=", "recordAuditEvent", "revalidatePath", "MonthlyClose", "closingSnapshot", "createMonthlyClose"]) {
  if (page.includes(forbidden)) errors.push(`closing page.tsx must not add write/snapshot behavior: ${forbidden}`);
}

const unitTest = read("src/modules/closing/monthly-closing-preview-service.test.ts");
for (const required of [
  "missing_story_4_1_source",
  "full-attendance",
  "40콜 미만 제외",
  "applies full-attendance and count-king bonuses",
  "20일 미만",
  "20일 이상 2,000,000 VND",
  "countKingRank",
  "countKingBonusAmount",
  "finalPayoutAmount",
  "tie-breaker: totalCallCount desc, monthlySettlementAmount desc, staffCode asc, Employee.id asc",
  "countKingEligibleCount",
  "countKingExcludedCount"
]) {
  if (!unitTest.includes(required)) errors.push(`monthly-closing-preview-service.test.ts missing ${required}`);
}

const e2e = read("tests/e2e/story-5-2-monthly-closing-bonuses.spec.ts");
for (const required of [
  "Story 5.2 monthly closing bonuses",
  "/closing?operatingMonthId",
  "만근 인정일",
  "만근수당",
  "갯수왕",
  "갯수왕 수당",
  "최종지급액",
  "40콜 미만 제외",
  "Story 4.1",
  "toHaveURL(/\\/calls/)",
  "toHaveURL(/\\/rooms/)"
]) {
  if (!e2e.includes(required)) errors.push(`story-5-2-monthly-closing-bonuses.spec.ts missing ${required}`);
}

const readme = read("src/modules/closing/README.md");
for (const required of [
  "Story 5.2",
  "full-attendance allowance",
  "20",
  "2,000,000 VND",
  "count-king",
  "40",
  "5,000,000 / 3,000,000 / 1,000,000 VND",
  "finalPayoutAmount",
  "missing_story_4_1_source",
  "no persistence",
  "no `MonthlyClose`",
  "no audit event",
  "no status mutation"
]) {
  if (!readme.includes(required)) errors.push(`src/modules/closing/README.md missing ${required}`);
}

const schema = read("prisma/schema.prisma");
for (const forbidden of ["TherapistAttendance", "MonthlyClose", "monthly_closes", "MonthlyCloseSnapshot", "closing_snapshots", "PayoutSnapshot", "monthly_payouts"]) {
  if (schema.includes(forbidden)) errors.push(`schema.prisma must not include out-of-scope persistence/source model: ${forbidden}`);
}

if (errors.length > 0) {
  console.error("Story 5.2 validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Story 5.2 validation passed.");
