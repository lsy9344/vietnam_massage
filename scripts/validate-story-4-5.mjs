import { existsSync, readFileSync } from "node:fs";

const errors = [];

function requireFile(path) {
  if (!existsSync(path)) {
    errors.push(`Missing required file: ${path}`);
  }
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
  "prisma/migrations/20260610110000_add_ops_attendances/migration.sql",
  "src/modules/settlements/ops-attendance-service.ts",
  "src/modules/settlements/ops-attendance-service.test.ts",
  "src/modules/settlements/ops-daily-incentive-service.ts",
  "src/modules/settlements/ops-daily-incentive-service.test.ts",
  "src/app/(erp)/settlements/operations/page.tsx",
  "src/app/(erp)/settlements/operations/actions.ts",
  "src/app/(erp)/settlements/operations/ops-attendance-table.tsx",
  "tests/e2e/story-4-5-ops-daily-incentive.spec.ts",
  "src/modules/settlements/README.md",
  "_bmad-output/implementation-artifacts/4-5-운영팀-근무상태와-일일-인센.md"
].forEach(requireFile);

const packageJson = readJson("package.json");
if (!packageJson.scripts?.lint?.includes("validate-story-4-4.mjs && node scripts/validate-story-4-5.mjs")) {
  errors.push("package.json lint script must run scripts/validate-story-4-5.mjs immediately after validate-story-4-4.mjs");
}

const schema = read("prisma/schema.prisma");
for (const required of [
  "model OpsAttendance",
  "opsAttendances",
  "operatingMonthId",
  "attendanceDate",
  "employeeId",
  "statusCode",
  "@@unique([operatingMonthId, attendanceDate, employeeId], map: \"uq_ops_attendances_month_date_employee\")",
  "@@index([employeeId, attendanceDate], map: \"idx_ops_attendances_employee_date\")",
  "@@map(\"ops_attendances\")"
]) {
  if (!schema.includes(required)) errors.push(`schema.prisma missing ${required}`);
}
for (const forbidden of [
  "OpsDailyIncentivePayout",
  "ops_daily_incentive_payouts",
  "dailyIncentiveAmount",
  "daily_incentive_amount",
  "monthlySnapshot",
  "monthly_snapshot"
]) {
  if (schema.includes(forbidden)) errors.push(`schema.prisma must not include payout/monthly persistence: ${forbidden}`);
}

const migration = read("prisma/migrations/20260610110000_add_ops_attendances/migration.sql");
for (const required of [
  "CREATE TABLE \"ops_attendances\"",
  "\"operating_month_id\"",
  "\"attendance_date\" DATE NOT NULL",
  "\"employee_id\"",
  "\"status_code\"",
  "uq_ops_attendances_month_date_employee",
  "idx_ops_attendances_employee_date"
]) {
  if (!migration.includes(required)) errors.push(`ops attendance migration missing ${required}`);
}

const attendanceService = read("src/modules/settlements/ops-attendance-service.ts");
for (const required of [
  "export async function listOpsAttendanceForDate",
  "export async function upsertOpsAttendance",
  "OpsAttendanceDomainError",
  "z.object",
  "employeeGroup: \"OPERATIONS\"",
  "ATTENDANCE_STATUS",
  "status.code === \"NORMAL\"",
  "status.displayName === \"정상\"",
  "OPERATING_MONTH_DATE_OUT_OF_RANGE",
  "OPERATING_MONTH_LOCKED",
  "client.$transaction",
  "ops_attendance.created",
  "ops_attendance.changed",
  "payoutImpact: true",
  "reason: \"payout_affecting\""
]) {
  if (!attendanceService.includes(required)) errors.push(`ops-attendance-service.ts missing ${required}`);
}
for (const forbidden of ["displayName:", "Excel", "dailyIncentiveAmount", "monthlySnapshot"]) {
  if (forbidden === "displayName:") continue;
  if (attendanceService.includes(forbidden)) errors.push(`ops-attendance-service.ts must not include out-of-scope ${forbidden}`);
}

const incentiveService = read("src/modules/settlements/ops-daily-incentive-service.ts");
for (const required of [
  "export async function listOpsDailyIncentives",
  "OpsDailyIncentiveDomainError",
  "listOpsAttendanceForDate",
  "listCompletedServiceCallCalculationsForDate",
  "listServiceCallsForDate",
  "opsDailyIncentiveRule",
  "dailyOpsCallCredit",
  "calculation.opsCallCredit",
  "ruleStatus",
  "missing_policy",
  "below_threshold",
  "appliedThresholdCallCount",
  "personalIncentiveAmount",
  "thresholdCallCount",
  "warningCounts",
  "notCompleted",
  "coursePolicyMissing",
  "therapistRateMissing",
  "secondTherapistRequired",
  "callEvidence",
  "calculationBasis"
]) {
  if (!incentiveService.includes(required)) errors.push(`ops-daily-incentive-service.ts missing ${required}`);
}
for (const forbidden of ["recordAuditEvent", "opsDailyIncentivePayout", "payoutResult", "monthlyClose", "closingSnapshot", "createOpsDaily", "updateOpsDaily"]) {
  if (incentiveService.includes(forbidden)) errors.push(`ops-daily-incentive-service.ts must not implement out-of-scope ${forbidden}`);
}

// ko/vi i18n migration: settlement UI strings moved to t() keys in the ko catalog.
const koCatalog = read("src/lib/i18n/messages/ko.ts");
function requireMoved(contents, fileLabel, key, korean) {
  if (!contents.includes(key)) errors.push(`${fileLabel} missing t() key ${key}`);
  if (!koCatalog.includes(korean)) errors.push(`ko.ts missing ${korean}`);
}

const page = read("src/app/(erp)/settlements/operations/page.tsx");
for (const required of [
  "requireRouteAccess(\"/settlements/operations\")",
  "selectedOperatingMonthFor",
  "clampDateToOperatingMonth",
  "listOpsAttendanceForDate",
  "listOpsDailyIncentives",
  "OpsIncentiveSummary",
  "OpsAttendanceTable"
]) {
  if (!page.includes(required)) errors.push(`operations page.tsx missing ${required}`);
}
requireMoved(page, "operations page.tsx", "settlements.ops.title", "운영팀 근무/일일인센");
requireMoved(page, "operations page.tsx", "settlements.ops.summary.dailyTotalCalls", "일 총콜");
requireMoved(page, "operations page.tsx", "settlements.ops.summary.appliedThreshold", "적용 threshold");
requireMoved(page, "operations page.tsx", "settlements.ops.summary.eligible", "정상 지급 대상");
requireMoved(page, "operations page.tsx", "settlements.ops.summary.distributed", "지급 합계");
requireMoved(page, "operations page.tsx", "settlements.ops.table.title", "운영팀 직원별 일일 인센");
requireMoved(page, "operations page.tsx", "settlements.ops.callEvidence.title", "일 총콜 산출 근거");
requireMoved(page, "operations page.tsx", "settlements.locked.title", "잠긴 운영월입니다");
requireMoved(page, "operations page.tsx", "settlements.ops.threshold.missingPolicy", "정책 없음");
requireMoved(page, "operations page.tsx", "settlements.ops.threshold.belowThreshold", "30콜 미만");
for (const forbidden of ["saveOpsPayout", "payoutAmount: {", "closing", "snapshot", "monthly preview"]) {
  if (page.includes(forbidden)) errors.push(`operations page.tsx must not implement out-of-scope ${forbidden}`);
}

const action = read("src/app/(erp)/settlements/operations/actions.ts");
for (const required of ["requirePermission(\"payout:write\")", "upsertOpsAttendance", "revalidatePath(\"/settlements/operations\")", "OPS_EMPLOYEE_NOT_FOUND"]) {
  if (!action.includes(required)) errors.push(`operations actions.ts missing ${required}`);
}
for (const forbidden of ["saveOpsPayout", "listOpsDailyIncentives", "payoutAmount", "recordAuditEvent("]) {
  if (action.includes(forbidden)) errors.push(`operations actions.ts must not add payout calculation mutation/audit behavior: ${forbidden}`);
}

const table = read("src/app/(erp)/settlements/operations/ops-attendance-table.tsx");
for (const required of [
  "useActionState",
  "useRouter",
  "router.refresh()"
]) {
  if (!table.includes(required)) errors.push(`ops-attendance-table.tsx missing existing save UX ${required}`);
}
requireMoved(table, "ops-attendance-table.tsx", "settlements.therapist.attendance.action.saving", "저장중");
requireMoved(table, "ops-attendance-table.tsx", "settlements.therapist.attendance.status.saved", "저장됨");
requireMoved(table, "ops-attendance-table.tsx", "settlements.therapist.attendance.action.retry", "재시도");
requireMoved(table, "ops-attendance-table.tsx", "settlements.therapist.attendance.saveFailed", "저장 실패");
requireMoved(table, "ops-attendance-table.tsx", "settlements.ops.payoutEligible", "지급 대상");
requireMoved(table, "ops-attendance-table.tsx", "settlements.ops.excluded", "제외:");
requireMoved(table, "ops-attendance-table.tsx", "settlements.therapist.attendance.status.locked", "잠금");

const attendanceTest = read("src/modules/settlements/ops-attendance-service.test.ts");
for (const required of [
  "five active OPERATIONS employees",
  "stable status codes",
  "ops_attendance.created",
  "ops_attendance.changed",
  "OPS_EMPLOYEE_NOT_FOUND",
  "OPERATING_MONTH_DATE_OUT_OF_RANGE",
  "OPERATING_MONTH_LOCKED",
  "rolls back attendance"
]) {
  if (!attendanceTest.includes(required)) errors.push(`ops-attendance-service.test.ts missing ${required}`);
}

const incentiveTest = read("src/modules/settlements/ops-daily-incentive-service.test.ts");
for (const required of [
  "opsCallCredit",
  "highest satisfied 30/40/50 threshold",
  "below_threshold",
  "missing_policy",
  "notCompleted",
  "coursePolicyMissing",
  "therapistRateMissing",
  "secondTherapistRequired",
  "locked operating months readable"
]) {
  if (!incentiveTest.includes(required)) errors.push(`ops-daily-incentive-service.test.ts missing ${required}`);
}

const e2e = read("tests/e2e/story-4-5-ops-daily-incentive.spec.ts");
for (const required of [
  "Story 4.5 operations daily incentive",
  "story45_settlement",
  "story45_counter",
  "/settlements/operations?operatingMonthId",
  "운영팀 근무/일일인센",
  "일 총콜",
  "40콜 이상",
  "50콜 이상",
  "30콜 미만",
  "잠긴 운영월입니다",
  "toHaveURL(/\\/calls/)"
]) {
  if (!e2e.includes(required)) errors.push(`story-4-5-ops-daily-incentive.spec.ts missing ${required}`);
}

const readme = read("src/modules/settlements/README.md");
for (const required of [
  "Ops Attendance Service",
  "Ops Daily Incentive Service",
  "listOpsAttendanceForDate",
  "upsertOpsAttendance",
  "listOpsDailyIncentives",
  "opsCallCredit",
  "OpsDailyIncentiveRule",
  "highest satisfied",
  "missing_policy",
  "below_threshold",
  "no payout persistence",
  "no monthly preview"
]) {
  if (!readme.includes(required)) errors.push(`src/modules/settlements/README.md missing ${required}`);
}

if (errors.length > 0) {
  console.error("Story 4.5 validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Story 4.5 validation passed.");
