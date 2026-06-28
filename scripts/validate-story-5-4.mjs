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
  "src/modules/closing/monthly-closing-service.ts",
  "src/modules/closing/monthly-closing-service.test.ts",
  "src/modules/closing/month-lock-guard.ts",
  "src/modules/closing/month-lock-guard.test.ts",
  "src/app/(erp)/closing/actions.ts",
  "src/app/(erp)/closing/closing-action-panel.tsx",
  "src/modules/calls/service-call-service.ts",
  "src/modules/calls/service-call-service.test.ts",
  "src/modules/settlements/earcare-attendance-service.ts",
  "src/modules/settlements/earcare-attendance-service.test.ts",
  "src/modules/settlements/ops-attendance-service.ts",
  "src/modules/settlements/ops-attendance-service.test.ts",
  "src/app/(erp)/settlements/operations/monthly/page.tsx",
  "src/modules/masters/course-service.ts",
  "src/modules/masters/course-service.test.ts",
  "tests/e2e/story-5-4-monthly-close-lock.spec.ts",
  "src/modules/closing/README.md",
  "_bmad-output/project-context.md",
  "_bmad-output/implementation-artifacts/5-4-잠금-상태와-지급-영향-데이터-수정-차단.md"
].forEach(requireFile);

const packageJson = readJson("package.json");
if (!packageJson.scripts?.lint?.includes("validate-story-5-3.mjs && node scripts/validate-story-5-4.mjs")) {
  errors.push("package.json lint script must run scripts/validate-story-5-4.mjs immediately after validate-story-5-3.mjs");
}

const service = read("src/modules/closing/monthly-closing-service.ts");
for (const required of [
  "export async function lockMonthlyClose",
  "monthlyClosingInputSchema.safeParse",
  "status: \"마감확정\"",
  "data: { status: \"잠금\" }",
  "findLatestMonthlyClosing",
  "monthly_close.locked",
  "targetType: \"monthly_close\"",
  "lockedAt",
  "lockedByAccountId",
  "MONTHLY_CLOSE_NOT_CONFIRMED",
  "MONTHLY_CLOSE_ALREADY_LOCKED",
  "INVALID_MONTHLY_CLOSE_TRANSITION",
  "getMonthlyClosingSnapshot"
]) {
  if (!service.includes(required)) errors.push(`monthly-closing-service.ts missing ${required}`);
}
const lockSection = service.slice(service.indexOf("export async function lockMonthlyClose"), service.indexOf("export async function reopenMonthlyClose"));
if (lockSection.includes("snapshotJson:") || lockSection.includes("monthlyClosing.update(")) {
  errors.push("lockMonthlyClose must not overwrite the persisted MonthlyClosing snapshot");
}

const actions = read("src/app/(erp)/closing/actions.ts");
for (const required of [
  "lockMonthlyCloseAction",
  "requirePermission(\"closing:write\")",
  "lockMonthlyClose",
  "revalidatePath(\"/closing\")"
]) {
  if (!actions.includes(required)) errors.push(`closing actions.ts missing ${required}`);
}
if (actions.includes("recordAuditEvent(") || actions.includes("monthly_close.locked")) {
  errors.push("closing actions.ts must call the domain service instead of implementing audit payloads");
}

// ko/vi i18n migration: closing/settlement UI strings moved to t() keys in the ko catalog.
const koCatalog = read("src/lib/i18n/messages/ko.ts");
function requireMoved(contents, fileLabel, key, korean) {
  if (!contents.includes(key)) errors.push(`${fileLabel} missing t() key ${key}`);
  if (!koCatalog.includes(korean)) errors.push(`ko.ts missing ${korean}`);
}

const actionPanel = read("src/app/(erp)/closing/closing-action-panel.tsx");
for (const required of [
  "lockMonthlyCloseAction",
  "status === \"마감확정\"",
  "Story 5.6"
]) {
  if (!actionPanel.includes(required)) errors.push(`closing-action-panel.tsx missing ${required}`);
}
requireMoved(actionPanel, "closing-action-panel.tsx", "closing.disabled.needConfirmFirst", "잠금은 먼저 마감확정이 필요합니다.");
requireMoved(actionPanel, "closing-action-panel.tsx", "closing.disabled.locked", "잠금 상태입니다. 확정 스냅샷 조회는 계속 가능합니다.");

const opsMonthlyPage = read("src/app/(erp)/settlements/operations/monthly/page.tsx");
for (const required of [
  "getMonthlyClosingSnapshot",
  "SnapshotSummary",
  "MONTHLY_CLOSE_SNAPSHOT_NOT_FOUND"
]) {
  if (!opsMonthlyPage.includes(required)) errors.push(`operations monthly page missing ${required}`);
}
requireMoved(opsMonthlyPage, "operations monthly page", "settlements.opsMonthly.snapshot.confirmed", "확정 스냅샷");
requireMoved(opsMonthlyPage, "operations monthly page", "settlements.opsMonthly.preview.current", "현재 기준 미리보기");

const guard = read("src/modules/closing/month-lock-guard.ts");
for (const required of [
  "isOperatingMonthPayoutLocked",
  "assertOperatingMonthPayoutWritable",
  "status === \"마감확정\" || status === \"잠금\"",
  "OPERATING_MONTH_LOCKED"
]) {
  if (!guard.includes(required)) errors.push(`month-lock-guard.ts missing ${required}`);
}

const calls = read("src/modules/calls/service-call-service.ts");
for (const required of [
  "assertOperatingMonthPayoutWritable",
  "saveBasicServiceCallRow",
  "autosaveServiceCallRow",
  "createDailyExpense",
  "updateDailyExpense",
  "deactivateDailyExpense",
  "OPERATING_MONTH_LOCKED"
]) {
  if (!calls.includes(required)) errors.push(`service-call-service.ts missing ${required}`);
}
if (calls.includes("month.status === \"잠금\"")) errors.push("service-call-service.ts must not use 잠금-only guards");

for (const path of [
  "src/modules/settlements/earcare-attendance-service.ts",
  "src/modules/settlements/ops-attendance-service.ts"
]) {
  const contents = read(path);
  for (const required of ["assertOperatingMonthPayoutWritable", "isOperatingMonthPayoutLocked", "isLocked", "OPERATING_MONTH_LOCKED"]) {
    if (!contents.includes(required)) errors.push(`${path} missing ${required}`);
  }
  if (contents.includes("status === \"잠금\"")) errors.push(`${path} must not use 잠금-only guards`);
}

const course = read("src/modules/masters/course-service.ts");
for (const required of [
  "assertNoClosedOperatingMonthOverlap",
  "isOperatingMonthPayoutLocked",
  "createCoursePolicy",
  "updateCoursePolicy",
  "createTherapistCourseRate",
  "updateTherapistCourseRate",
  "createOpsDailyIncentiveRule",
  "updateOpsDailyIncentiveRule",
  "createOpsMonthlyIncentiveRule",
  "updateOpsMonthlyIncentiveRule",
  "OPERATING_MONTH_LOCKED"
]) {
  if (!course.includes(required)) errors.push(`course-service.ts missing ${required}`);
}

const tests = [
  read("src/modules/closing/monthly-closing-service.test.ts"),
  read("src/modules/calls/service-call-service.test.ts"),
  read("src/modules/settlements/earcare-attendance-service.test.ts"),
  read("src/modules/settlements/ops-attendance-service.test.ts"),
  read("src/modules/masters/course-service.test.ts")
].join("\n");
for (const required of [
  "monthly_close.locked",
  "MONTHLY_CLOSE_NOT_CONFIRMED",
  "MONTHLY_CLOSE_ALREADY_LOCKED",
  "마감확정",
  "OPERATING_MONTH_LOCKED",
  "read-only",
  "confirmed operating month"
]) {
  if (!tests.includes(required)) errors.push(`unit tests missing ${required}`);
}

const e2e = read("tests/e2e/story-5-4-monthly-close-lock.spec.ts");
for (const required of [
  "Story 5.4 monthly close lock",
  "story54_admin",
  "story54_settlement",
  "story54_counter",
  "잠금",
  "/closing?operatingMonthId",
  "/calls?operatingMonthId",
  "/settlements/operations/monthly?operatingMonthId",
  "확정 스냅샷",
  "monthly_close.locked",
  "OPERATING_MONTH_LOCKED"
]) {
  if (!e2e.includes(required)) errors.push(`story-5-4 e2e missing ${required}`);
}

const readme = read("src/modules/closing/README.md");
for (const required of [
  "Story 5.4",
  "lockMonthlyClose",
  "monthly_close.locked",
  "마감확정` and `잠금`",
  "getMonthlyClosingSnapshot()",
  "Story 5.5"
]) {
  if (!readme.includes(required)) errors.push(`closing README missing ${required}`);
}

const projectContext = read("_bmad-output/project-context.md");
for (const required of [
  "Story 5.4",
  "lockMonthlyClose()",
  "monthly_close.locked",
  "마감확정` 또는 `잠금`",
  "isOperatingMonthPayoutLocked()",
  "assertOperatingMonthPayoutWritable()"
]) {
  if (!projectContext.includes(required)) errors.push(`project-context.md missing ${required}`);
}

if (errors.length > 0) {
  console.error("Story 5.4 validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Story 5.4 validation passed.");
