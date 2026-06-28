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
  "src/modules/closing/monthly-closing-preview-service.ts",
  "src/modules/closing/monthly-closing-preview-service.test.ts",
  "src/app/(erp)/closing/page.tsx",
  "src/app/(erp)/closing/loading.tsx",
  "tests/e2e/story-5-1-monthly-closing-preview.spec.ts",
  "src/modules/closing/README.md",
  "_bmad-output/implementation-artifacts/5-1-월마감-미리보기-집계.md"
].forEach(requireFile);

const packageJson = readJson("package.json");
if (!packageJson.scripts?.lint?.includes("validate-story-4-6.mjs && node scripts/validate-story-5-1.mjs && node scripts/validate-story-5-2.mjs")) {
  errors.push("package.json lint script must run scripts/validate-story-5-1.mjs after validate-story-4-6.mjs and then scripts/validate-story-5-2.mjs");
}

const service = read("src/modules/closing/monthly-closing-preview-service.ts");
for (const required of [
  "export async function listMonthlyClosingPreview",
  "MonthlyClosingPreviewDomainError",
  "z.object",
  "safeParse",
  "operatingMonth",
  "startDate",
  "endDate",
  "dateRange",
  "listTherapistDailySettlements",
  "listOpsDailyIncentives",
  "listOpsMonthlyIncentivePreview",
  "listEarcareDailySettlements",
  "Employee.id",
  "draft_current",
  "closed_current",
  "fullAttendanceDays",
  "fullAttendanceAllowanceAmount",
  "finalPayoutAmount",
  "therapistPayoutAmount",
  "opsDailyIncentiveAmount",
  "opsMonthlyIncentiveAmount",
  "earcarePayoutAmount",
  "grandPayoutAmount",
  "warningCounts",
  "representativeEvidence",
  "undistributedDays",
  "normalStaffZeroDays"
]) {
  if (!service.includes(required)) errors.push(`monthly-closing-preview-service.ts missing ${required}`);
}
for (const forbidden of [
  "recordAuditEvent",
  "MonthlyClose",
  "monthlyClose",
  "closingSnapshot",
  "snapshot",
  "payoutPersistence",
  "create({",
  "update({",
  "updateMany",
  "deleteMany",
  "$transaction"
]) {
  if (service.includes(forbidden)) errors.push(`monthly-closing-preview-service.ts must remain read-only/no snapshot/no persistence: ${forbidden}`);
}

// ko/vi i18n migration: closing UI strings moved to t() keys in the ko catalog.
const koCatalog = read("src/lib/i18n/messages/ko.ts");
function requireMoved(contents, fileLabel, key, korean) {
  if (!contents.includes(key)) errors.push(`${fileLabel} missing t() key ${key}`);
  if (!koCatalog.includes(korean)) errors.push(`ko.ts missing ${korean}`);
}

const page = read("src/app/(erp)/closing/page.tsx");
for (const required of [
  "requireRouteAccess(\"/closing\")",
  "selectedOperatingMonthFor",
  "listOperatingMonths",
  "listMonthlyClosingPreview",
  "role=\"alert\""
]) {
  if (!page.includes(required)) errors.push(`closing page.tsx missing ${required}`);
}
requireMoved(page, "closing page.tsx", "closing.title", "월마감 미리보기");
requireMoved(page, "closing page.tsx", "common.operatingMonth", "운영월");
requireMoved(page, "closing page.tsx", "closing.summary.therapistPayout", "마사지사 지급 합계");
requireMoved(page, "closing page.tsx", "closing.summary.opsDaily", "운영팀 일일인센");
requireMoved(page, "closing page.tsx", "closing.summary.opsMonthly", "운영팀 월인센");
requireMoved(page, "closing page.tsx", "closing.summary.earcarePayout", "귀케어 지급 합계");
requireMoved(page, "closing page.tsx", "closing.summary.grandPayout", "전체 지급 합계");
requireMoved(page, "closing page.tsx", "closing.therapist.title", "마사지사");
requireMoved(page, "closing page.tsx", "closing.operations.title", "운영팀");
requireMoved(page, "closing page.tsx", "closing.earcare.title", "귀케어");
requireMoved(page, "closing page.tsx", "closing.evidence.title", "산출 근거/warning");
requireMoved(page, "closing page.tsx", "closing.preview.draftDescription", "미확정 미리보기");
requireMoved(page, "closing page.tsx", "closing.preview.current", "현재 기준 미리보기");
requireMoved(page, "closing page.tsx", "closing.preview.closedDescription", "확정값은 월마감 스냅샷 기준");
requireMoved(page, "closing page.tsx", "settlements.requery", "재조회");
for (const forbidden of ["use server", "action=", "recordAuditEvent", "revalidatePath", "MonthlyClose", "createMonthlyClose"]) {
  if (page.includes(forbidden)) errors.push(`closing page.tsx must not add write/snapshot behavior: ${forbidden}`);
}

const loading = read("src/app/(erp)/closing/loading.tsx");
for (const required of ["Skeleton", "Array.from({ length: 5 })"]) {
  if (!loading.includes(required)) errors.push(`closing loading.tsx missing ${required}`);
}
requireMoved(loading, "closing loading.tsx", "closing.loading.aria", "월마감");

const unitTest = read("src/modules/closing/monthly-closing-preview-service.test.ts");
for (const required of [
  "aggregates operating-month dates",
  "therapist:2026-06-01",
  "ops:2026-06-01",
  "earcare:2026-06-01",
  "finalPayoutAmount",
  "totalOpsPayoutAmount",
  "grandPayoutAmount",
  "earcareNormalStaffZeroDays",
  "closed_current",
  "INVALID_OPERATING_MONTH_DATE_RANGE",
  "OPERATING_MONTH_NOT_FOUND"
]) {
  if (!unitTest.includes(required)) errors.push(`monthly-closing-preview-service.test.ts missing ${required}`);
}

const e2e = read("tests/e2e/story-5-1-monthly-closing-preview.spec.ts");
for (const required of [
  "Story 5.1 monthly closing preview",
  "story51_settlement",
  "story51_admin",
  "story51_counter",
  "story51_waiter",
  "story51_readonly",
  "/closing?operatingMonthId",
  "월마감 미리보기",
  "마사지사 지급 합계",
  "운영팀 일일인센",
  "운영팀 월인센",
  "귀케어 지급 합계",
  "전체 지급 합계",
  "E2E51 마사지사",
  "1,400,000 VND",
  "E2E51 귀케어",
  "100,000 VND",
  "source day count 2",
  "excluded call count 1",
  "귀케어 정상근무자 0명",
  "미분배",
  "대표 evidence",
  "selectOption(seededData.lockedOperatingMonthId)",
  "미확정 미리보기",
  "현재 기준 미리보기",
  "확정값은 월마감 스냅샷 기준",
  "산출 근거/warning",
  "toHaveURL(/\\/calls/)",
  "toHaveURL(/\\/rooms/)"
]) {
  if (!e2e.includes(required)) errors.push(`story-5-1-monthly-closing-preview.spec.ts missing ${required}`);
}

const readme = read("src/modules/closing/README.md");
for (const required of [
  "Monthly Closing Preview Service",
  "listMonthlyClosingPreview",
  "listTherapistDailySettlements",
  "listOpsDailyIncentives",
  "listOpsMonthlyIncentivePreview",
  "listEarcareDailySettlements",
  "Employee.id",
  "read-only",
  "no persistence",
  "no `MonthlyClose`",
  "no audit event",
  "no status mutation"
]) {
  if (!readme.includes(required)) errors.push(`src/modules/closing/README.md missing ${required}`);
}

const schema = read("prisma/schema.prisma");
for (const forbidden of [
  "MonthlyClose",
  "monthly_closes",
  "MonthlyCloseSnapshot",
  "closing_snapshots",
  "PayoutSnapshot",
  "monthly_payouts"
]) {
  if (schema.includes(forbidden)) errors.push(`schema.prisma must not include out-of-scope monthly close persistence model: ${forbidden}`);
}

if (errors.length > 0) {
  console.error("Story 5.1 validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Story 5.1 validation passed.");
