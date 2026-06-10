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
  "prisma/migrations/20260610152000_version_monthly_closings/migration.sql",
  "src/modules/closing/monthly-closing-service.ts",
  "src/modules/closing/monthly-closing-service.test.ts",
  "src/modules/closing/month-lock-guard.ts",
  "src/modules/calls/service-call-service.test.ts",
  "src/lib/authorization.ts",
  "src/app/(erp)/closing/actions.ts",
  "src/app/(erp)/closing/closing-action-panel.tsx",
  "src/app/(erp)/closing/page.tsx",
  "tests/e2e/story-5-5-monthly-close-reopen.spec.ts",
  "src/modules/closing/README.md",
  "docs/modules/closing.md",
  "_bmad-output/project-context.md",
  "_bmad-output/implementation-artifacts/5-5-관리자-사유-기반-재오픈.md"
].forEach(requireFile);

const packageJson = readJson("package.json");
if (!packageJson.scripts?.lint?.includes("validate-story-5-4.mjs && node scripts/validate-story-5-5.mjs")) {
  errors.push("package.json lint script must run scripts/validate-story-5-5.mjs immediately after validate-story-5-4.mjs");
}

const schema = read("prisma/schema.prisma");
for (const required of [
  "closeVersion         Int",
  "@map(\"close_version\")",
  "reopenedAt           DateTime?",
  "reopenedByAccountId  String?",
  "reopenReason         String?",
  "@@unique([operatingMonthId, closeVersion]",
  "@@index([operatingMonthId, closeVersion]",
  "monthlyClosings MonthlyClosing[]"
]) {
  if (!schema.includes(required)) errors.push(`schema.prisma missing ${required}`);
}
if (schema.includes("operatingMonthId     String         @unique")) {
  errors.push("MonthlyClosing.operatingMonthId must not remain globally unique");
}

const migration = read("prisma/migrations/20260610152000_version_monthly_closings/migration.sql");
for (const required of [
  "ADD COLUMN \"close_version\" INTEGER NOT NULL DEFAULT 1",
  "ADD COLUMN \"reopened_at\"",
  "ADD COLUMN \"reopened_by_account_id\"",
  "ADD COLUMN \"reopen_reason\"",
  "DROP INDEX \"monthly_closings_operating_month_id_key\"",
  "CREATE UNIQUE INDEX \"uq_monthly_closings_month_version\""
]) {
  if (!migration.includes(required)) errors.push(`versioned monthly_closings migration missing ${required}`);
}

const service = read("src/modules/closing/monthly-closing-service.ts");
for (const required of [
  "export async function reopenMonthlyClose",
  "ReopenMonthlyCloseInput",
  "reopenMonthlyClosingInputSchema",
  "reason: z.string().trim().min(5",
  "INVALID_MONTHLY_CLOSE_REOPEN_REASON",
  "INVALID_MONTHLY_CLOSE_REOPEN_TRANSITION",
  "status !== \"잠금\"",
  "data: { status: \"검토중\" }",
  "findLatestMonthlyClosing",
  "orderBy: { closeVersion: \"desc\" }",
  "closeVersion = (latestClosing?.closeVersion ?? 0) + 1",
  "monthly_close.reopened",
  "targetType: \"monthly_close\"",
  "reopenedAt",
  "reopenedByAccountId",
  "reopenReason",
  "reason: parsed.data.reason",
  "MONTHLY_CLOSE_VERSION_CONFLICT"
]) {
  if (!service.includes(required)) errors.push(`monthly-closing-service.ts missing ${required}`);
}
if (service.includes("snapshotJson: updated") || service.includes("monthlyClosing.delete")) {
  errors.push("reopen/versioning must not overwrite snapshotJson or delete MonthlyClosing rows");
}

const authorization = read("src/lib/authorization.ts");
for (const required of [
  "\"closing:reopen\"",
  "administrator: [\"call:write\", \"payout:write\", \"closing:write\", \"closing:reopen\"",
  "settlement_manager: [\"payout:write\", \"closing:write\"]"
]) {
  if (!authorization.includes(required)) errors.push(`authorization.ts missing ${required}`);
}

const actions = read("src/app/(erp)/closing/actions.ts");
for (const required of [
  "reopenMonthlyCloseAction",
  "reopenMonthlyClosingActionSchema",
  "reason: z.string().trim().min(5",
  "requirePermission(\"closing:reopen\")",
  "reopenMonthlyClose",
  "revalidatePath(\"/closing\")"
]) {
  if (!actions.includes(required)) errors.push(`closing actions.ts missing ${required}`);
}
for (const forbidden of ["monthly_close.reopened", "recordAuditEvent("]) {
  if (actions.includes(forbidden)) errors.push(`closing actions.ts must not implement domain audit directly: ${forbidden}`);
}

const panel = read("src/app/(erp)/closing/closing-action-panel.tsx");
for (const required of [
  "reopenMonthlyCloseAction",
  "canReopen",
  "status === \"잠금\"",
  "재오픈 사유",
  "관리자만 재오픈할 수 있습니다.",
  "aria-invalid",
  "aria-describedby",
  "role=\"alert\""
]) {
  if (!panel.includes(required)) errors.push(`closing-action-panel.tsx missing ${required}`);
}
if (panel.includes("canWrite && status === \"잠금\"")) {
  errors.push("reopen UI must not use canWrite as reopen permission");
}

const page = read("src/app/(erp)/closing/page.tsx");
for (const required of [
  "canPerform(account.role, \"closing:reopen\")",
  "canReopen={canReopenClosing}",
  "이전 확정 스냅샷",
  "재오픈 전 확정값",
  "현재 기준 미리보기",
  "closeVersion"
]) {
  if (!page.includes(required)) errors.push(`closing page.tsx missing ${required}`);
}

const guard = read("src/modules/closing/month-lock-guard.ts");
if (!guard.includes("status === \"마감확정\" || status === \"잠금\"")) {
  errors.push("month-lock-guard.ts must keep 검토중 writable after reopen");
}

const tests = [
  read("src/modules/closing/monthly-closing-service.test.ts"),
  read("src/modules/calls/service-call-service.test.ts")
].join("\n");
for (const required of [
  "monthly_close.reopened",
  "INVALID_MONTHLY_CLOSE_REOPEN_REASON",
  "INVALID_MONTHLY_CLOSE_REOPEN_TRANSITION",
  "MONTHLY_CLOSE_SNAPSHOT_NOT_FOUND",
  "audit fails",
  "closeVersion, 2",
  "month-reopened",
  "재오픈 후 검토중"
]) {
  if (!tests.includes(required)) errors.push(`unit tests missing ${required}`);
}

const e2e = read("tests/e2e/story-5-5-monthly-close-reopen.spec.ts");
for (const required of [
  "Story 5.5 monthly close reopen",
  "story55_admin",
  "story55_settlement",
  "/closing?operatingMonthId",
  "재오픈 사유",
  "monthly_close.reopened",
  "이전 확정 스냅샷",
  "closeVersion",
  "관리자만 재오픈할 수 있습니다.",
  "권한이 없습니다.",
  "재오픈 사유를 5자 이상 입력하세요."
]) {
  if (!e2e.includes(required)) errors.push(`story-5-5 e2e missing ${required}`);
}

const readme = read("src/modules/closing/README.md");
for (const required of [
  "Story 5.5",
  "reopenMonthlyClose",
  "잠금 -> 검토중",
  "closing:reopen",
  "versioned",
  "monthly_close.reopened",
  "이전 확정 스냅샷"
]) {
  if (!readme.includes(required)) errors.push(`closing README missing ${required}`);
}

const projectContext = read("_bmad-output/project-context.md");
for (const required of [
  "Story 5.5",
  "reopenMonthlyClose()",
  "잠금 -> 검토중",
  "closing:reopen",
  "closeVersion",
  "monthly_close.reopened",
  "이전 확정 스냅샷"
]) {
  if (!projectContext.includes(required)) errors.push(`project-context.md missing ${required}`);
}

if (errors.length > 0) {
  console.error("Story 5.5 validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Story 5.5 validation passed.");
