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
  "prisma/schema.prisma",
  "prisma/migrations/20260610093000_add_earcare_attendances/migration.sql",
  "src/modules/settlements/earcare-attendance-service.ts",
  "src/modules/settlements/earcare-attendance-service.test.ts",
  "src/app/(erp)/settlements/earcare/page.tsx",
  "src/app/(erp)/settlements/earcare/actions.ts",
  "src/app/(erp)/settlements/earcare/earcare-attendance-form.tsx",
  "tests/e2e/story-4-3-earcare-attendance.spec.ts",
  "src/modules/settlements/README.md",
  "_bmad-output/implementation-artifacts/4-3-귀케어-근무상태-입력.md"
].forEach(requireFile);

const packageJson = readJson("package.json");
if (!packageJson.scripts?.lint?.includes("validate-story-4-2.mjs && node scripts/validate-story-4-3.mjs")) {
  errors.push("package.json lint script must run scripts/validate-story-4-3.mjs immediately after validate-story-4-2.mjs");
}

const schema = read("prisma/schema.prisma");
for (const required of [
  "model EarcareAttendance",
  "operatingMonthId",
  "attendanceDate    DateTime       @map(\"attendance_date\") @db.Date",
  "employeeId        String         @map(\"employee_id\")",
  "statusCode        String         @map(\"status_code\")",
  "@@unique([operatingMonthId, attendanceDate, employeeId]",
  "@@index([employeeId, attendanceDate]",
  "@@map(\"earcare_attendances\")",
  "earcareAttendances EarcareAttendance[]"
]) {
  if (!schema.includes(required)) errors.push(`schema.prisma missing ${required}`);
}

const migration = read("prisma/migrations/20260610093000_add_earcare_attendances/migration.sql");
for (const required of [
  "CREATE TABLE \"earcare_attendances\"",
  "\"operating_month_id\" TEXT NOT NULL",
  "\"attendance_date\" DATE NOT NULL",
  "\"employee_id\" TEXT NOT NULL",
  "\"status_code\" TEXT NOT NULL",
  "uq_earcare_attendances_month_date_employee",
  "idx_earcare_attendances_employee_date",
  "REFERENCES \"operating_months\"",
  "REFERENCES \"employees\""
]) {
  if (!migration.includes(required)) errors.push(`earcare migration missing ${required}`);
}

const service = read("src/modules/settlements/earcare-attendance-service.ts");
for (const required of [
  "export async function listEarcareAttendanceForDate",
  "export async function upsertEarcareAttendance",
  "employeeGroup: \"EARCARE\"",
  "isActive: true",
  "codeType: \"ATTENDANCE_STATUS\"",
  "statusCode",
  "isPayoutEligible",
  "exclusionReason",
  "OPERATING_MONTH_DATE_OUT_OF_RANGE",
  "OPERATING_MONTH_LOCKED",
  "recordAuditEvent",
  "earcare_attendance.created",
  "earcare_attendance.changed",
  "payoutImpact: true",
  "reason: \"payout_affecting\"",
  "$transaction",
  "status.code === \"NORMAL\" || status.displayName === \"정상\""
]) {
  if (!service.includes(required)) errors.push(`earcare-attendance-service.ts missing ${required}`);
}
for (const forbidden of ["monthly close", "closing snapshot", "ops_daily", "therapist shift"]) {
  if (service.includes(forbidden)) errors.push(`earcare-attendance-service.ts must not implement out-of-scope ${forbidden}`);
}

const action = read("src/app/(erp)/settlements/earcare/actions.ts");
const attendanceErrors = read("src/app/(erp)/settlements/attendance-action-error.ts");
for (const required of [
  "\"use server\"",
  "requirePermission(\"payout:write\")",
  "upsertEarcareAttendance",
  "ActionResult<EarcareAttendanceDto>",
  "revalidatePath(\"/settlements/earcare\")",
  "OPERATING_MONTH_DATE_OUT_OF_RANGE",
  "ATTENDANCE_STATUS_NOT_FOUND"
]) {
  if (!action.includes(required) && !attendanceErrors.includes(required)) errors.push(`earcare actions.ts missing ${required}`);
}

// ko/vi i18n migration: settlement UI strings moved to t() keys in the ko catalog.
const koCatalog = read("src/lib/i18n/messages/ko.ts");
function requireMoved(contents, fileLabel, key, korean) {
  if (!contents.includes(key)) errors.push(`${fileLabel} missing t() key ${key}`);
  if (!koCatalog.includes(korean)) errors.push(`ko.ts missing ${korean}`);
}

// 티켓 05부터 비교 표와 직원 패널은 클라이언트 뷰에, 근무상태 정정은 패널의 폼에, 잠금·오류 안내는 settlement-parts에 있다.
const page = [
  "src/app/(erp)/settlements/earcare/page.tsx",
  "src/app/(erp)/settlements/earcare/earcare-settlement-view.tsx",
  "src/app/(erp)/settlements/earcare/earcare-attendance-form.tsx",
  "src/app/(erp)/settlements/settlement-parts.tsx"
].map(read).join("\n");
for (const required of [
  "requireRouteAccess(\"/settlements/earcare\")",
  "listEarcareAttendanceForDate",
  "selectedOperatingMonthFor",
  "clampDateToOperatingMonth",
  "EarcareAttendanceForm"
]) {
  if (!page.includes(required)) errors.push(`earcare page.tsx missing ${required}`);
}
requireMoved(page, "earcare page.tsx", "settlements.earcare.locked.description", "귀케어 근무상태");
requireMoved(page, "earcare page.tsx", "settlements.locked.title", "잠긴 운영월입니다");
// 운영월이 없을 때 안내는 공용 NoOperatingMonthNotice(그 안에 common.goToOperatingMonths)로 옮겨졌다.
requireMoved(page, "earcare page.tsx", "NoOperatingMonthNotice", "운영월 관리로 이동");
requireMoved(page, "earcare page.tsx", "settlements.earcare.payoutEligible", "지급 대상");
requireMoved(page, "earcare page.tsx", "settlements.earcare.excluded", "제외");

const table = read("src/app/(erp)/settlements/earcare/earcare-attendance-form.tsx");
for (const required of [
  "useActionState",
  "saveEarcareAttendanceAction"
]) {
  if (!table.includes(required)) errors.push(`earcare-attendance-form.tsx missing ${required}`);
}
requireMoved(table, "earcare-attendance-form.tsx", "settlements.earcare.attendance.column.workStatus", "근무상태");
requireMoved(table, "earcare-attendance-form.tsx", "settlements.therapist.attendance.action.saving", "저장중");
requireMoved(table, "earcare-attendance-form.tsx", "settlements.therapist.attendance.status.saved", "저장됨");
requireMoved(table, "earcare-attendance-form.tsx", "settlements.therapist.attendance.action.retry", "재시도");
requireMoved(table, "earcare-attendance-form.tsx", "settlements.therapist.attendance.saveFailed", "저장 실패");
requireMoved(table, "earcare-attendance-form.tsx", "settlements.earcare.payoutEligible", "지급 대상");
requireMoved(table, "earcare-attendance-form.tsx", "settlements.earcare.excluded", "제외:");

// 구역 안 탭 링크는 routes.ts의 screenRoutes에서 ScreenToolbar가 그린다.
const settlementPage = read("src/app/(erp)/settlements/page.tsx");
const routes = read("src/lib/routes.ts");
if (!/\{ path: "\/settlements",[^}]*roles: \["administrator", "settlement_manager"\][^}]*\}/.test(routes) ||
    !/\{ path: "\/settlements\/earcare",[^}]*roles: \["administrator", "settlement_manager"\][^}]*\}/.test(routes)) {
  errors.push("routes.ts must keep /settlements and /settlements/earcare screen routes in the settlements zone");
}
if (!settlementPage.includes("ScreenToolbar") || !settlementPage.includes("path=\"/settlements\"")) {
  errors.push("settlements/page.tsx must keep using ScreenToolbar so its earcare tab link comes from routes.ts, without replacing therapist daily settlement");
}
if (!koCatalog.includes("귀케어 일일정산")) errors.push("ko.ts missing 귀케어 일일정산");

const unitTest = read("src/modules/settlements/earcare-attendance-service.test.ts");
for (const required of [
  "active EARCARE employees",
  "inactive",
  "NORMAL",
  "DAY_OFF",
  "LATE",
  "ABSENT",
  "OPERATING_MONTH_DATE_OUT_OF_RANGE",
  "OPERATING_MONTH_LOCKED",
  "rechecks locked operating month inside the write transaction",
  "EARLY_LEAVE",
  "rolls back attendance writes when audit logging fails",
  "earcare_attendance.created",
  "earcare_attendance.changed"
]) {
  if (!unitTest.includes(required)) errors.push(`earcare-attendance-service.test.ts missing ${required}`);
}

const e2e = read("tests/e2e/story-4-3-earcare-attendance.spec.ts");
for (const required of [
  "Story 4.3 earcare attendance",
  "story43_settlement",
  "story43_counter",
  "/settlements/earcare?operatingMonthId",
  "E2E43 귀케어1",
  "E2E43 귀케어4",
  "E2E43 비활성 귀케어",
  "DAY_OFF",
  "저장됨",
  "잠긴 운영월입니다",
  "toHaveURL(/\\/calls/)"
]) {
  if (!e2e.includes(required)) errors.push(`story-4-3-earcare-attendance.spec.ts missing ${required}`);
}

const readme = read("src/modules/settlements/README.md");
for (const required of [
  "listEarcareAttendanceForDate",
  "upsertEarcareAttendance",
  "EarcareAttendance",
  "ATTENDANCE_STATUS",
  "Employee.id",
  "NORMAL",
  "earcare_attendance.created"
]) {
  if (!readme.includes(required)) errors.push(`src/modules/settlements/README.md missing ${required}`);
}

if (errors.length > 0) {
  console.error("Story 4.3 validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Story 4.3 validation passed.");
