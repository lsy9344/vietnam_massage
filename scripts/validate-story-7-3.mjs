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
  "src/modules/migration/migration-verification-report.ts",
  "src/modules/migration/migration-verification-report.test.ts",
  "src/app/(erp)/masters/sheet-mapping/page.tsx",
  "src/app/(erp)/masters/sheet-mapping/actions.ts",
  "src/app/(erp)/masters/sheet-mapping/issue-status-form.tsx",
  "tests/e2e/story-7-3-migration-verification-report.spec.ts",
  "prisma/schema.prisma",
  "prisma/migrations/20260610203000_add_migration_verification_issues/migration.sql",
  "docs/modules/migration-verification.md",
  "docs/modules/README.md",
  "_bmad-output/project-context.md",
  "package.json"
].forEach(requireFile);

const packageJson = readJson("package.json");
if (!packageJson.scripts?.lint?.includes("validate-story-7-2.mjs && node scripts/validate-story-7-3.mjs")) {
  errors.push("package.json lint script must run scripts/validate-story-7-3.mjs immediately after validate-story-7-2.mjs");
}

const service = read("src/modules/migration/migration-verification-report.ts");
const unitTest = read("src/modules/migration/migration-verification-report.test.ts");
const page = read("src/app/(erp)/masters/sheet-mapping/page.tsx");
const action = read("src/app/(erp)/masters/sheet-mapping/actions.ts");
const form = read("src/app/(erp)/masters/sheet-mapping/issue-status-form.tsx");
const e2e = read("tests/e2e/story-7-3-migration-verification-report.spec.ts");
const schema = read("prisma/schema.prisma");
const migration = read("prisma/migrations/20260610203000_add_migration_verification_issues/migration.sql");
const auth = read("src/lib/authorization.ts");
const nav = read("src/lib/navigation.ts");
const docs = `${read("docs/modules/migration-verification.md")}\n${read("docs/modules/README.md")}`;
const context = read("_bmad-output/project-context.md");

for (const required of [
  "SHEET_FEATURE_MAPPINGS",
  "EXPECTED_SOURCE_SHEETS",
  "getSheetMappingSummary",
  "MIGRATION_EXPECTED_RESULTS",
  "MIGRATION_SOURCE_REFERENCES",
  "MigrationMismatchReport",
  "summary",
  "sheetRows",
  "calculationRows",
  "openIssueRows",
  "filters",
  "generatedAt",
  "preservationRate",
  "preservationGoalMet",
  "coreCalculationStatus",
  "calculation:calls.payment:call-complete-a-discount",
  "area",
  "fixtureId",
  "expected",
  "actual",
  "sourceReference",
  "relatedRequirement",
  "message"
]) {
  if (!service.includes(required)) errors.push(`report service missing Story 7.3 marker: ${required}`);
}

for (const area of [
  "calls.payment",
  "calls.discount",
  "calls.ops-credit",
  "calls.d-course",
  "rooms.status",
  "operations.daily-incentive",
  "operations.monthly-incentive",
  "earcare.zero-worker-pool",
  "therapist.role-settlement",
  "closing.final-payout"
]) {
  if (!service.includes(area) || !unitTest.includes(area)) errors.push(`Story 7.3 calculation area missing from service/test: ${area}`);
}

for (const status of ["미확인", "수정중", "재검증 필요", "통과"]) {
  if (!service.includes(status) || !form.includes(status) || !migration.includes(status)) {
    errors.push(`Story 7.3 status value must be represented in service/form/migration: ${status}`);
  }
}

for (const forbidden of ["readFileSync(\"sheet.xlsx\"", "xlsx.read", "parseCell", "workbookRange.split", "new MigrationCalculationEngine"]) {
  if (service.includes(forbidden) || unitTest.includes(forbidden) || page.includes(forbidden)) {
    errors.push(`Story 7.3 must not parse Excel/cell coordinates or create a calculation engine at runtime: ${forbidden}`);
  }
}

for (const required of [
  "model MigrationVerificationIssue",
  "model MigrationVerificationIssueHistory",
  "@@map(\"migration_verification_issues\")",
  "@@map(\"migration_verification_issue_histories\")",
  "changedByAccountId",
  "previousStatus",
  "newStatus",
  "@db.VarChar(500)"
]) {
  if (!schema.includes(required)) errors.push(`Prisma schema missing migration verification marker: ${required}`);
}

for (const required of [
  "migration_verification_issues",
  "migration_verification_issue_histories",
  "CHECK (\"status\" IN ('미확인', '수정중', '재검증 필요', '통과'))",
  "CHECK (\"kind\" IN ('sheet_mapping', 'calculation_comparison', 'manual_risk'))",
  "changed_by_account_id"
]) {
  if (!migration.includes(required)) errors.push(`Prisma migration missing migration verification marker: ${required}`);
}

for (const required of [
  "requireRouteAccess(\"/masters/sheet-mapping\")",
  "buildMigrationVerificationReport",
  "listMigrationVerificationIssues",
  "parseMigrationVerificationFilters",
  "MigrationIssueStatusForm",
  "기능 보존율",
  "누락 항목",
  "계산 불일치",
  "열린 추적",
  "숨김 목록 100% gate"
]) {
  if (!page.includes(required)) errors.push(`sheet mapping page missing report marker: ${required}`);
}

if (!action.includes("requirePermission(\"migration:write\")")) errors.push("sheet mapping action must require migration:write");
if (!action.includes("updateMigrationVerificationIssueStatus")) errors.push("sheet mapping action must delegate to domain tracking service");
if (!auth.includes("\"migration:write\"")) errors.push("authorization.ts must define migration:write permission");
if (!auth.includes("read_only_viewer: [\"/masters/sheet-mapping\"]")) errors.push("authorization.ts must preserve read_only_viewer exact sheet-mapping route");
if (auth.includes("read_only_viewer: [\"/rooms\", \"/tv\", \"/dashboard/today\", \"/dashboard/monthly\", \"/dashboard/reports\", \"/masters")) {
  errors.push("authorization.ts must not open /masters prefix to read_only_viewer");
}
if (!nav.includes("{ labelKey: \"nav.item.mastersSheetMapping\", href: \"/masters/sheet-mapping\", allowedRoles: [\"administrator\", \"read_only_viewer\"] }")) {
  errors.push("navigation.ts must keep 시트 기능 매핑표 for administrator/read_only_viewer only");
}

for (const required of [
  "preservation rate",
  "hidden 목록",
  "injected mismatch",
  "재검증 필요",
  "parseMigrationVerificationFilters",
  "updateMigrationVerificationIssueStatus"
]) {
  if (!unitTest.includes(required)) errors.push(`unit test missing Story 7.3 marker: ${required}`);
}

for (const required of [
  "source guardrails",
  "src/modules/migration/migration-verification-report.ts",
  "src/app/(erp)/masters/sheet-mapping/page.tsx",
  "prisma/schema.prisma",
  "validate-story-7-2.mjs && node scripts/validate-story-7-3.mjs",
  "PLAYWRIGHT_SKIP_WEBSERVER",
  "no runtime Excel parsing",
  "read-only viewer exact access"
]) {
  if (!e2e.includes(required)) errors.push(`E2E guardrail missing Story 7.3 marker: ${required}`);
}

for (const required of [
  "Story 7.3",
  "report DTO",
  "persisted QA tracking",
  "MigrationVerificationIssue",
  "MigrationVerificationIssueHistory",
  "미확인",
  "수정중",
  "재검증 필요",
  "통과",
  "숨김 목록",
  "100%",
  "no runtime Excel parsing",
  "read-only viewer exact access",
  "MigrationMismatchReport"
]) {
  if (!docs.includes(required)) errors.push(`docs missing Story 7.3 marker: ${required}`);
  if (!context.includes(required)) errors.push(`project-context missing Story 7.3 marker: ${required}`);
}

if (errors.length > 0) {
  console.error("Story 7.3 validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Story 7.3 validation passed.");
