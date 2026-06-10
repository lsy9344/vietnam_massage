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
  "prisma/schema.prisma",
  "prisma/migrations/20260610134000_add_monthly_closings/migration.sql",
  "src/modules/closing/monthly-closing-service.ts",
  "src/modules/closing/monthly-closing-service.test.ts",
  "src/modules/closing/monthly-closing-preview-service.ts",
  "src/app/(erp)/closing/actions.ts",
  "src/app/(erp)/closing/closing-action-panel.tsx",
  "src/app/(erp)/closing/page.tsx",
  "tests/e2e/story-5-3-monthly-close-confirmation.spec.ts",
  "src/modules/closing/README.md",
  "_bmad-output/project-context.md",
  "_bmad-output/implementation-artifacts/5-3-월마감-검토와-확정-스냅샷.md"
].forEach(requireFile);

const packageJson = readJson("package.json");
if (!packageJson.scripts?.lint?.includes("validate-story-5-2.mjs && node scripts/validate-story-5-3.mjs")) {
  errors.push("package.json lint script must run scripts/validate-story-5-3.mjs immediately after validate-story-5-2.mjs");
}

const schema = read("prisma/schema.prisma");
for (const required of [
  "model MonthlyClosing",
  "@@map(\"monthly_closings\")",
  "snapshotJson         Json",
  "operatingMonthId     String         @unique",
  "confirmedByAccountId String",
  "confirmedByAccount   UserAccount",
  "monthlyClosing MonthlyClosing?",
  "confirmedMonthlyClosings MonthlyClosing[]"
]) {
  if (!schema.includes(required)) errors.push(`schema.prisma missing ${required}`);
}

const migration = read("prisma/migrations/20260610134000_add_monthly_closings/migration.sql");
for (const required of [
  "CREATE TABLE \"monthly_closings\"",
  "\"snapshot_json\" JSONB NOT NULL",
  "CREATE UNIQUE INDEX \"monthly_closings_operating_month_id_key\"",
  "FOREIGN KEY (\"operating_month_id\") REFERENCES \"operating_months\"",
  "FOREIGN KEY (\"confirmed_by_account_id\") REFERENCES \"user_accounts\""
]) {
  if (!migration.includes(required)) errors.push(`monthly_closings migration missing ${required}`);
}

const service = read("src/modules/closing/monthly-closing-service.ts");
for (const required of [
  "export async function startMonthlyCloseReview",
  "export async function confirmMonthlyClose",
  "export async function getMonthlyClosingSnapshot",
  "MonthlyClosingDomainError",
  "INVALID_MONTHLY_CLOSE_INPUT",
  "OPERATING_MONTH_NOT_FOUND",
  "INVALID_MONTHLY_CLOSE_TRANSITION",
  "MONTHLY_CLOSE_ALREADY_CONFIRMED",
  "MONTHLY_CLOSE_SNAPSHOT_NOT_FOUND",
  "listMonthlyClosingPreview",
  "runInTransaction",
  "isolationLevel: \"Serializable\"",
  "assertPlainJson",
  "clonePlainJson",
  "updateMany",
  "status: \"검토중\"",
  "status: \"마감확정\"",
  "monthlyClosing.create",
  "recordAuditEvent",
  "operating_month.status_changed",
  "monthly_close.confirmed",
  "targetType: \"monthly_close\"",
  "snapshotId",
  "serviceVersion: \"monthly-closing-service:5.3\""
]) {
  if (!service.includes(required)) errors.push(`monthly-closing-service.ts missing ${required}`);
}

const actions = read("src/app/(erp)/closing/actions.ts");
for (const required of [
  "\"use server\"",
  "startMonthlyCloseReviewAction",
  "confirmMonthlyCloseAction",
  "requirePermission(\"closing:write\")",
  "revalidatePath(\"/closing\")",
  "MonthlyClosingDomainError",
  "AuditDomainError",
  "domainErrorCode",
  "formError"
]) {
  if (!actions.includes(required)) errors.push(`closing actions.ts missing ${required}`);
}
for (const forbidden of ["requirePermission(\"employee:write\")", "recordAuditEvent("]) {
  if (actions.includes(forbidden)) errors.push(`closing actions.ts must not contain ${forbidden}`);
}

const page = read("src/app/(erp)/closing/page.tsx");
for (const required of [
  "requireRouteAccess(\"/closing\")",
  "ClosingStepper",
  "ClosingActionPanel",
  "getMonthlyClosingSnapshot",
  "SnapshotSummary",
  "확정 스냅샷",
  "현재 기준 미리보기",
  "listMonthlyClosingPreview"
]) {
  if (!page.includes(required)) errors.push(`closing page.tsx missing ${required}`);
}
for (const forbidden of ["recordAuditEvent", "monthlyClosing.create", "updateMany({", "monthly_close.confirmed"]) {
  if (page.includes(forbidden)) errors.push(`closing page.tsx must not perform domain write/audit work: ${forbidden}`);
}

const actionPanel = read("src/app/(erp)/closing/closing-action-panel.tsx");
for (const required of [
  "useActionState",
  "검토 시작",
  "마감 확정",
  "이미 마감확정된 운영월입니다.",
  "월마감 처리 권한이 없습니다."
]) {
  if (!actionPanel.includes(required)) errors.push(`closing-action-panel.tsx missing ${required}`);
}

const unitTest = read("src/modules/closing/monthly-closing-service.test.ts");
for (const required of [
  "작성중 operating month to 검토중",
  "normalized immutable snapshot",
  "monthly_close.confirmed audit",
  "blocks duplicate or invalid confirmation",
  "rolls back status and snapshot",
  "DB unique constraint rejects a duplicate confirmation race",
  "rejects non-JSON snapshot values",
  "without recalculating current preview",
  "MONTHLY_CLOSE_SNAPSHOT_NOT_FOUND"
]) {
  if (!unitTest.includes(required)) errors.push(`monthly-closing-service.test.ts missing ${required}`);
}

const e2e = read("tests/e2e/story-5-3-monthly-close-confirmation.spec.ts");
for (const required of [
  "Story 5.3 monthly close confirmation snapshot",
  "/closing?operatingMonthId",
  "검토 시작",
  "마감 확정",
  "확정 스냅샷",
  "현재 기준 미리보기",
  "story53_admin",
  "story53_settlement",
  "toHaveURL(/\\/calls/)",
  "toHaveURL(/\\/rooms/)"
]) {
  if (!e2e.includes(required)) errors.push(`story-5-3-monthly-close-confirmation.spec.ts missing ${required}`);
}

const readme = read("src/modules/closing/README.md");
for (const required of [
  "Story 5.3",
  "MonthlyClosing",
  "monthly_closings",
  "startMonthlyCloseReview",
  "confirmMonthlyClose",
  "getMonthlyClosingSnapshot",
  "monthly_close.confirmed",
  "operating_month.status_changed",
  "preview and snapshot",
  "Story 5.4",
  "Story 5.5",
  "Story 5.6"
]) {
  if (!readme.includes(required)) errors.push(`src/modules/closing/README.md missing ${required}`);
}

const projectContext = read("_bmad-output/project-context.md");
for (const required of [
  "Story 5.3",
  "MonthlyClosing",
  "monthly_closings",
  "monthly_close.confirmed",
  "startMonthlyCloseReview()",
  "confirmMonthlyClose()",
  "getMonthlyClosingSnapshot()"
]) {
  if (!projectContext.includes(required)) errors.push(`project-context.md missing ${required}`);
}

if (errors.length > 0) {
  console.error("Story 5.3 validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Story 5.3 validation passed.");
