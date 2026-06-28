import { existsSync, readFileSync, readdirSync } from "node:fs";

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
  "src/modules/settlements/therapist-attendance-service.ts",
  "src/modules/settlements/therapist-attendance-service.test.ts",
  "src/app/(erp)/settlements/actions.ts",
  "src/app/(erp)/settlements/therapist-attendance-table.tsx",
  "src/app/(erp)/settlements/page.tsx",
  "src/modules/closing/monthly-closing-preview-service.ts",
  "src/modules/closing/monthly-closing-preview-service.test.ts",
  "tests/e2e/story-4-1-therapist-attendance.spec.ts",
  "src/modules/settlements/README.md",
  "_bmad-output/implementation-artifacts/4-1-마사지사-출퇴근-입력과-만근-인정-기초.md"
].forEach(requireFile);

const packageJson = readJson("package.json");
if (!packageJson.scripts?.lint?.includes("validate-story-4-1.mjs && node scripts/validate-story-4-2.mjs")) {
  errors.push("package.json lint script must run scripts/validate-story-4-1.mjs immediately before validate-story-4-2.mjs");
}

// Review finding #1: generated Prisma client is gitignored, so tests must generate it first.
if (!packageJson.scripts?.["pretest:unit"]?.includes("prisma generate")) {
  errors.push("package.json must run prisma generate via pretest:unit before unit tests");
}
if (!packageJson.scripts?.["pretest:e2e"]?.includes("prisma generate")) {
  errors.push("package.json must run prisma generate via pretest:e2e before e2e tests");
}

const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
for (const forbidden of [
  "swr",
  "@tanstack/react-query",
  "redis",
  "ioredis",
  "socket.io",
  "zustand",
  "recharts",
  "@prisma/client-runtime-utils",
  "geist"
]) {
  if (dependencies[forbidden]) errors.push(`Story 4.1 must not add ${forbidden}`);
}

// Prisma model + migration
const schema = read("prisma/schema.prisma");
for (const required of [
  "model TherapistAttendance",
  "@@map(\"therapist_attendances\")",
  "checkInMinute",
  "checkOutMinute",
  "standbyMinutes",
  "isFullAttendanceRecognized",
  "@db.Date",
  "uq_therapist_attendances_month_date_employee",
  "idx_therapist_attendances_employee_date",
  "therapistAttendances   TherapistAttendance[]"
]) {
  if (!schema.includes(required)) errors.push(`prisma/schema.prisma missing ${required}`);
}

const migrationsDir = "prisma/migrations";
const hasMigration = existsSync(migrationsDir)
  ? readdirSync(migrationsDir).some((entry) => entry.includes("add_therapist_attendances"))
  : false;
if (!hasMigration) {
  errors.push("Missing prisma migration directory *_add_therapist_attendances");
} else {
  const migrationDir = readdirSync(migrationsDir).find((entry) => entry.includes("add_therapist_attendances"));
  const migrationSql = read(`${migrationsDir}/${migrationDir}/migration.sql`);
  for (const required of [
    "CREATE TABLE \"therapist_attendances\"",
    "\"check_in_minute\" INTEGER NOT NULL",
    "\"check_out_minute\" INTEGER NOT NULL",
    "\"standby_minutes\" INTEGER NOT NULL",
    "\"is_full_attendance_recognized\" BOOLEAN NOT NULL",
    "uq_therapist_attendances_month_date_employee",
    "idx_therapist_attendances_employee_date",
    // Review finding #7: DB CHECK constraints for minute ranges and stored-calc consistency.
    "chk_therapist_attendances_check_in_minute_range",
    "chk_therapist_attendances_check_out_minute_range",
    "chk_therapist_attendances_standby_minutes_range",
    "chk_therapist_attendances_standby_minutes_consistent",
    "chk_therapist_attendances_full_attendance_consistent"
  ]) {
    if (!migrationSql.includes(required)) errors.push(`therapist_attendances migration.sql missing ${required}`);
  }
}

// Domain service
const service = read("src/modules/settlements/therapist-attendance-service.ts");
for (const required of [
  "export async function listTherapistAttendanceForDate",
  "export async function upsertTherapistAttendance",
  "export async function deactivateTherapistAttendance",
  "export async function listTherapistFullAttendanceRecognitions",
  "class TherapistAttendanceDomainError",
  "employeeGroup: \"THERAPIST\"",
  "checkInMinute",
  "checkOutMinute",
  "standbyMinutes",
  "isFullAttendanceRecognized",
  "480",
  "1440",
  "computeStandbyMinutes",
  "assertOperatingMonthPayoutWritable",
  "OPERATING_MONTH_DATE_OUT_OF_RANGE",
  "OPERATING_MONTH_LOCKED",
  "$transaction",
  "therapist_attendance.created",
  "therapist_attendance.changed",
  "therapist_attendance.deactivated",
  "payout_affecting",
  "payoutImpact: true",
  "sourceStatus: \"available\"",
  "sourceDayCount"
]) {
  if (!service.includes(required)) errors.push(`therapist-attendance-service.ts missing ${required}`);
}
// transaction must re-check the lock inside the transaction
const transactionLockRechecks = (service.match(/assertUnlocked\(transactionOperatingMonth\)/g) ?? []).length;
if (transactionLockRechecks < 2) {
  errors.push("therapist-attendance-service.ts must re-check the operating-month lock inside each write transaction");
}
// Review finding #4: transaction must re-check active therapist status inside each write transaction.
const transactionTherapistRechecks = (service.match(/loadActiveTherapist\(tx,/g) ?? []).length;
if (transactionTherapistRechecks < 2) {
  errors.push("therapist-attendance-service.ts must re-check the active therapist inside each write transaction");
}
// Review finding #5: full-attendance recognition must reject invalid/reversed date ranges.
if (!service.includes("assertValidParsedDate(parsed.data.startDate)") || !service.includes("assertValidParsedDate(parsed.data.endDate)")) {
  errors.push("listTherapistFullAttendanceRecognitions must validate startDate and endDate as real calendar dates");
}
if (!service.includes("parsed.data.startDate > parsed.data.endDate")) {
  errors.push("listTherapistFullAttendanceRecognitions must reject reversed date ranges (startDate > endDate)");
}
// Review finding R2-#1: deactivate must guard against a stale/duplicate clear inside the transaction.
if (!service.includes("if (!before || !before.isActive)")) {
  errors.push("deactivateTherapistAttendance must re-check the active row inside the transaction before recording a clear");
}
// Review finding R2-#4: full-attendance recognition must be bounded to the operating month dates.
if (
  !service.includes("assertDateInOperatingMonth(operatingMonth, parsed.data.startDate)") ||
  !service.includes("assertDateInOperatingMonth(operatingMonth, parsed.data.endDate)")
) {
  errors.push("listTherapistFullAttendanceRecognitions must bound the requested range to the operating month dates");
}
// Review finding R2-#3: invalid input must carry a specific field instead of being mapped to both time inputs.
if (!service.includes("field?: TherapistAttendanceErrorField") || !service.includes("timeToMinute(parsed.data.checkInTime, \"checkInTime\")")) {
  errors.push("therapist-attendance-service.ts must attach the failing field to invalid attendance input errors");
}
// Review finding R3-#2: upsert/deactivate must lock the attendance key before reading inside the transaction.
if (!service.includes("lockAttendanceKey") || !service.includes("pg_advisory_xact_lock")) {
  errors.push("therapist-attendance-service.ts must lock the attendance key inside write transactions before auditing");
}

// Actions
const actions = read("src/app/(erp)/settlements/actions.ts");
for (const required of [
  "use server",
  "saveTherapistAttendanceAction",
  "deactivateTherapistAttendanceAction",
  "requirePermission(\"payout:write\")",
  "upsertTherapistAttendance",
  "deactivateTherapistAttendance",
  "revalidatePath(\"/settlements\")",
  "ActionResult",
  // Review finding R2-#3: map invalid input to the specific failing field, not both time inputs.
  "error.field"
]) {
  if (!actions.includes(required)) errors.push(`settlements/actions.ts missing ${required}`);
}

// ko/vi i18n migration: settlement/closing UI strings moved to t() keys in the ko catalog.
// Repoint moved-string assertions to the t() key in the component AND the Korean original in ko.ts.
const koCatalog = read("src/lib/i18n/messages/ko.ts");
function requireMoved(contents, fileLabel, key, korean) {
  if (!contents.includes(key)) errors.push(`${fileLabel} missing t() key ${key}`);
  if (!koCatalog.includes(korean)) errors.push(`ko.ts missing ${korean}`);
}

// Client table
const table = read("src/app/(erp)/settlements/therapist-attendance-table.tsx");
for (const required of [
  "use client",
  "useActionState",
  "saveTherapistAttendanceAction",
  // Review finding #3: table must expose a user-facing deactivate/clear path.
  "deactivateTherapistAttendanceAction",
  // Review finding R2-#2: table must resolve the most recent action and remount on persisted change.
  "lastAction",
  "checkInTime",
  "checkOutTime",
  "aria-invalid",
  "aria-describedby",
  "role=\"alert\""
]) {
  if (!table.includes(required)) errors.push(`therapist-attendance-table.tsx missing ${required}`);
}
requireMoved(table, "therapist-attendance-table.tsx", "settlements.therapist.attendance.action.clear", "비우기");
requireMoved(table, "therapist-attendance-table.tsx", "settlements.therapist.attendance.fullRecognized", "만근");
requireMoved(table, "therapist-attendance-table.tsx", "settlements.therapist.attendance.action.saving", "저장중");
requireMoved(table, "therapist-attendance-table.tsx", "settlements.therapist.attendance.status.saved", "저장됨");
requireMoved(table, "therapist-attendance-table.tsx", "settlements.therapist.attendance.action.retry", "재시도");
requireMoved(table, "therapist-attendance-table.tsx", "settlements.therapist.attendance.status.locked", "잠금");
// Review finding R3-#3: stale errors from the previous action must not remain after the opposite action wins.
if (!table.includes("lastAction.current === \"save\" ? inlineError(state)") || !table.includes("lastAction.current === \"clear\" ? inlineError(clearState)")) {
  errors.push("therapist-attendance-table.tsx must gate save/clear errors by the latest action");
}

// Page wiring keeps Story 4.2 behavior and adds attendance
const page = read("src/app/(erp)/settlements/page.tsx");
for (const required of [
  "requireRouteAccess(\"/settlements\")",
  "listTherapistDailySettlements",
  "listTherapistAttendanceForDate",
  "TherapistAttendanceTable",
  // Review finding #6: attendance read must not be hidden when the settlement read fails.
  "Promise.allSettled",
  "attendanceErrorMessage"
]) {
  if (!page.includes(required)) errors.push(`settlements/page.tsx missing ${required}`);
}
requireMoved(page, "settlements/page.tsx", "settlements.therapist.title", "마사지사 일일정산");
requireMoved(page, "settlements/page.tsx", "settlements.therapist.evidence.title", "콜별 산출 근거");
requireMoved(page, "settlements/page.tsx", "settlements.locked.title", "잠긴 운영월입니다");

// Closing preview default dependency wiring
const closing = read("src/modules/closing/monthly-closing-preview-service.ts");
for (const required of [
  "import { listTherapistFullAttendanceRecognitions }",
  "listTherapistFullAttendanceRecognitions: defaultTherapistFullAttendanceRecognitions"
]) {
  if (!closing.includes(required)) errors.push(`monthly-closing-preview-service.ts missing ${required}`);
}

// Unit tests cover the required scenarios
const unitTest = read("src/modules/settlements/therapist-attendance-service.test.ts");
for (const required of [
  "22:00",
  "06:00",
  "05:59",
  "480",
  "479",
  "10:00",
  "therapist_attendance.created",
  "therapist_attendance.deactivated",
  "OPERATING_MONTH_LOCKED",
  "OPERATING_MONTH_DATE_OUT_OF_RANGE",
  "audit failed",
  "attendanceLocks",
  "listTherapistFullAttendanceRecognitions"
]) {
  if (!unitTest.includes(required)) errors.push(`therapist-attendance-service.test.ts missing ${required}`);
}

const closingTest = read("src/modules/closing/monthly-closing-preview-service.test.ts");
for (const required of ["missing_story_4_1_source", "listTherapistFullAttendanceRecognitions", "2000000"]) {
  if (!closingTest.includes(required)) errors.push(`monthly-closing-preview-service.test.ts missing Story 4.1 regression ${required}`);
}

// E2E spec
const e2e = read("tests/e2e/story-4-1-therapist-attendance.spec.ts");
for (const required of [
  "Story 4.1 therapist attendance",
  "story41_settlement",
  "story41_counter",
  "/settlements?operatingMonthId",
  "therapistAttendance",
  "therapist_attendance.created",
  "출근시간",
  "퇴근시간",
  "만근",
  // Review finding #2: audit-log cleanup must be scoped to this story's attendance rows.
  "targetId: { in: storyAttendanceIds }",
  // Review finding #2/R3-#4: seeded accounts/employees/months must not pollute later suites.
  "cleanupStorySeedData",
  "accountId: { in: [\"story41_settlement\", \"story41_counter\"] }",
  "startsWith: \"E2E41-\"",
  "monthKey: { in: [\"2035-03\", \"2035-04\"] }",
  // Review finding #8: invalid-input case must assert the Korean error feedback.
  "HH:mm 형식이어야 합니다"
]) {
  if (!e2e.includes(required)) errors.push(`story-4-1-therapist-attendance.spec.ts missing ${required}`);
}

// README contract
const readme = read("src/modules/settlements/README.md");
for (const required of [
  "Therapist Attendance Service",
  "listTherapistFullAttendanceRecognitions",
  "checkInMinute",
  "480",
  "Story 5.2"
]) {
  if (!readme.includes(required)) errors.push(`src/modules/settlements/README.md missing ${required}`);
}

if (errors.length > 0) {
  console.error("Story 4.1 validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Story 4.1 validation passed.");
